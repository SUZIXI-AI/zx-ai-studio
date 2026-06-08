#!/bin/bash

# 启动 TSX 界面服务的脚本
# 用法: ./start-services.sh [--force-build|-f]
# --force-build 或 -f: 强制重新构建前端文件，忽略时间戳检查

echo "启动 ZX AI Studio 界面服务..."

# ==================== 环境检查阶段 ====================
echo "🔍 开始环境检查..."

# 检查并停止现有服务
echo "停止现有服务..."
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# 强制清理端口占用函数
kill_on_port() {
    local port="$1"
    echo "检查并清理端口 ${port} 占用..."
    # 若 fuser/lsof 均不可用，尝试安装 lsof（非交互）
    if ! command -v fuser >/dev/null 2>&1 && ! command -v lsof >/dev/null 2>&1; then
        if command -v apt-get >/dev/null 2>&1; then
            echo "安装 lsof 用于端口占用检测..."
            DEBIAN_FRONTEND=noninteractive apt-get update -y >/dev/null 2>&1 || true
            DEBIAN_FRONTEND=noninteractive apt-get install -y lsof >/dev/null 2>&1 || true
        fi
    fi
    # 使用 fuser 尝试杀进程
    if command -v fuser >/dev/null 2>&1; then
        fuser -k -n tcp "$port" 2>/dev/null || true
    fi
    # 使用 lsof 作为兜底
    if command -v lsof >/dev/null 2>&1; then
        PIDS=$(lsof -t -i:"$port" -sTCP:LISTEN 2>/dev/null || true)
        if [ -n "$PIDS" ]; then
            echo "$PIDS" | xargs -r kill -9 2>/dev/null || true
        fi
    fi
    sleep 1
    # 验证端口是否已释放（/dev/tcp 检测）
    if (echo > /dev/tcp/127.0.0.1/$port) >/dev/null 2>&1; then
        echo "❌ 无法释放端口 $port"
        exit 1
    else
        echo "✅ 端口 $port 已可用"
    fi
}

# 强制确保 6008 端口可用
kill_on_port 6008
# 画布服务端口（6010）：默认按需启动，启动脚本中只在显式 AUTOSTART_WULI=1 时清理端口
# 若画布已在跑且我们不准备重启它，这里就不要杀掉，避免误伤用户当前正在用的画布
if [ "${AUTOSTART_WULI:-1}" = "1" ]; then
    kill_on_port 6010
fi

# 使用 install-nodejs.sh 安装正确的 Node.js 和 Vite 版本
install_environment() {
    echo "🔄 环境检查失败，使用 install-nodejs.sh 安装正确的环境..."
    
    # 检查 install-nodejs.sh 是否存在
    if [ -f "/root/zealman-app/scripts/install-nodejs.sh" ]; then
        echo "📦 运行 install-nodejs.sh 安装 Node.js v22.19.0 和 Vite 7.0.0..."
        chmod +x /root/zealman-app/scripts/install-nodejs.sh
        /root/zealman-app/scripts/install-nodejs.sh
        
        if [ $? -eq 0 ]; then
            echo "✅ 环境安装成功"
            # 更新 PATH 确保使用新安装的 Node.js
            export PATH="/usr/local/bin:$PATH"

# HyperFrames runtime init: ensure autodl-tmp runtime dirs exist.
if [ -x /root/zealman-app/scripts/init-hyperframes.sh ]; then
    /root/zealman-app/scripts/init-hyperframes.sh >> /tmp/hyperframes-init.log 2>&1 || true
fi
            # 验证安装结果
            if command -v node >/dev/null 2>&1; then
                local node_version=$(node --version)
                echo "✅ 当前Node.js版本: $node_version"
            fi
            return 0
        else
            echo "❌ 环境安装失败"
            return 1
        fi
    else
        echo "❌ 找不到 install-nodejs.sh 脚本"
        echo "请确保 /root/zealman-app/scripts/install-nodejs.sh 存在"
        return 1
    fi
}

# 设置 PATH 确保使用系统级 Node.js 版本
export PATH="/usr/local/bin:$PATH"

# 检查 Node.js 环境
echo "🔍 检查Node.js环境..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "当前Node.js版本: $NODE_VERSION"
    
    # 检查是否为正确的版本 (v22.19.0)
    if [ "$NODE_VERSION" = "v22.19.0" ]; then
        echo "✅ Node.js版本正确: $NODE_VERSION"
    else
        echo "❌ Node.js版本不正确 ($NODE_VERSION != v22.19.0)"
        install_environment
        if [ $? -ne 0 ]; then
            echo "❌ 环境安装失败，退出"
            exit 1
        fi
    fi
else
    echo "❌ 未找到Node.js，开始安装..."
    install_environment
    if [ $? -ne 0 ]; then
        echo "❌ 环境安装失败，退出"
        exit 1
    fi
fi

# 最终验证 Node.js 版本
FINAL_NODE_VERSION=$(node --version)
if [ "$FINAL_NODE_VERSION" = "v22.19.0" ]; then
    echo "✅ Node.js环境检查完成: $FINAL_NODE_VERSION"
else
    echo "❌ Node.js版本仍然不正确: $FINAL_NODE_VERSION (需要 v22.19.0)"
    exit 1
fi

# 检查 npm 依赖
echo "🔍 检查npm依赖..."
cd /root/zealman-app

# 使用系统中的 npm
NPM_CMD="npm"

if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    echo "📦 安装npm依赖..."
    $NPM_CMD install
    if [ $? -ne 0 ]; then
        echo "❌ npm依赖安装失败"
        exit 1
    fi
    echo "✅ npm依赖安装完成"
else
    echo "✅ npm依赖已存在"
fi

# 生产环境不再依赖 Vite（禁止在线构建），跳过 Vite 检查
echo "🔍 跳过Vite检查（生产环境禁止构建，仅使用 dist）"

# ==================== 构建阶段 ====================
echo "🔍 检查前端文件（生产环境禁止构建）..."
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "❌ 未找到构建产物 dist/index.html。生产环境禁止在线构建，请先在开发环境构建并同步。"
    exit 1
fi
echo "✅ 已找到构建产物，跳过构建"

# ==================== 启动服务阶段 ====================
echo "🚀 开始启动服务..."

# 画布服务（Wuli-API, 端口 6010）默认不开机启动
# 用户在主面板点击 “画布” 时，由 /api/wuli/start 按需启动（routes/system.js）
# 如需开机自启，可设置环境变量 AUTOSTART_WULI=1 后再执行本脚本
if [ "${AUTOSTART_WULI:-1}" = "1" ]; then
    echo "启动画布服务 Wuli-API (端口 6010, ComfyUI=127.0.0.1:6006)..."
    cd /root/zealman-app/Wuli-API
    COMFYUI_INSTANCES="${COMFYUI_INSTANCES:-127.0.0.1:6006}" nohup /root/miniconda3/bin/python -m uvicorn main:app --host 127.0.0.1 --port 6010 > /tmp/wuli-api-service.log 2>&1 &
    WULI_PID=$!
    echo "画布服务 PID: $WULI_PID"

    echo "等待画布服务启动..."
    wuli_attempts=0
    wuli_max_attempts=20
    while [ $wuli_attempts -lt $wuli_max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:6010/api/hyperframes/templates 2>/dev/null | grep -q "^200$"; then
            echo "✅ 画布服务启动成功"
            break
        fi
        echo "⏳ 等待画布服务启动... ($((wuli_attempts + 1))/$wuli_max_attempts)"
        sleep 1
        wuli_attempts=$((wuli_attempts + 1))
    done

    if [ $wuli_attempts -eq $wuli_max_attempts ]; then
        echo "⚠️ 画布服务启动失败 - 超时（不影响主面板，主面板会按需再次拉起）"
    fi
else
    echo "🖌  画布服务 (Wuli-API/6010) 跳过开机自启 — 将在用户点击“画布”时按需启动"
fi

# 启动合并服务（后端+前端）
echo "启动合并服务 (端口 6008)..."
cd /root/zealman-app
nohup node server.js > /tmp/merged-service.log 2>&1 &
SERVICE_PID=$!
echo "合并服务 PID: $SERVICE_PID"

# 等待服务启动并检查健康状态
echo "等待服务启动..."
attempts=0
max_attempts=30  # 30秒超时

while [ $attempts -lt $max_attempts ]; do
    if curl -s http://127.0.0.1:6008/api/health > /dev/null 2>&1; then
        echo "✅ 合并服务启动成功"
        break
    fi
    echo "⏳ 等待服务启动... ($((attempts + 1))/$max_attempts)"
    sleep 1
    attempts=$((attempts + 1))
done

if [ $attempts -eq $max_attempts ]; then
    echo "❌ 合并服务启动失败 - 超时"
    echo "请检查日志: tail -f /tmp/merged-service.log"
    echo "最近的日志内容:"
    tail -20 /tmp/merged-service.log 2>/dev/null || echo "无法读取日志文件"
    exit 1
fi

# 生产环境不再需要更新开始页面外网地址
# if [ -f "/root/zx-ai-studio-dev/scripts/update-start-html.sh" ]; then
#     chmod +x /root/zx-ai-studio-dev/scripts/update-start-html.sh
#     bash /root/zx-ai-studio-dev/scripts/update-start-html.sh
# fi

echo ""
echo "🎉 合并服务启动完成！"
echo "📱 前端界面: http://127.0.0.1:6008/"
echo "🔧 后端 API: http://127.0.0.1:6008/api/"
echo "🌐 外网访问: 通过 autodl 随机域名映射到 6008 端口"
echo ""
echo "📋 服务状态:"
echo "   - 合并服务日志: /tmp/merged-service.log"
echo "   - 画布服务日志（按需启动后产生）: /tmp/wuli-api-service.log"
echo ""
echo "🛑 停止服务: pkill -f 'node server.js' && pkill -f 'uvicorn main:app --host 127.0.0.1 --port 6010'"
