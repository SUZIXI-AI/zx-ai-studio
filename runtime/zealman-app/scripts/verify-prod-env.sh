#!/bin/bash
# 验证生产环境脚本
# 用于验证生产环境（/root/zealman-app/）是否正常配置和运行

echo "=========================================="
echo "生产环境验证脚本"
echo "=========================================="
echo ""

PROD_DIR="/root/zealman-app"
ERRORS=0
WARNINGS=0

# 检查生产目录
echo "🔍 检查目录结构..."
if [ -d "$PROD_DIR" ]; then
    echo "✅ 生产目录存在: $PROD_DIR"
else
    echo "❌ 生产目录不存在: $PROD_DIR"
    echo "💡 提示: 运行 'npm run create-prod' 创建生产环境"
    exit 1
fi

# 检查必要的子目录
REQUIRED_DIRS=(
    "dist"
    "utils"
    "scripts"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$PROD_DIR/$dir" ]; then
        echo "✅ $dir/ 目录存在"
    else
        echo "⚠️  $dir/ 目录缺失"
        ((WARNINGS++))
    fi
done

echo ""

# 检查文件完整性
echo "🔍 检查文件完整性..."
REQUIRED_FILES=(
    "server.js"
    "package.json"
    "config.json"
    "dist/index.html"
    "start-services.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$PROD_DIR/$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 缺失"
        ((ERRORS++))
    fi
done

echo ""

# 检查服务状态
echo "🔍 检查服务状态..."

# 检查 Node.js 进程
if pgrep -f "node server.js" >/dev/null 2>&1; then
    PID=$(pgrep -f "node server.js" | head -1)
    echo "✅ Node.js 进程正在运行 (PID: $PID)"
    ps aux | grep "node server.js" | grep -v grep | head -1
else
    echo "❌ Node.js 进程未运行"
    echo "💡 提示: 运行 'cd $PROD_DIR && node server.js' 启动服务"
    ((ERRORS++))
fi

echo ""

# 检查端口
if lsof -i :6008 >/dev/null 2>&1; then
    echo "✅ 端口 6008 已被占用"
    lsof -i :6008 | head -3
else
    echo "❌ 端口 6008 未被占用"
    ((WARNINGS++))
fi

echo ""

# 检查 API 健康状态
echo "🔍 检查 API 健康状态..."
if curl -s http://127.0.0.1:6008/api/health >/dev/null 2>&1; then
    echo "✅ API 健康检查通过"
    HEALTH_RESPONSE=$(curl -s http://127.0.0.1:6008/api/health 2>/dev/null)
    if [ -n "$HEALTH_RESPONSE" ]; then
        echo "   响应: $HEALTH_RESPONSE"
    fi
else
    echo "❌ API 健康检查失败"
    echo "💡 提示: 服务可能未启动或配置有误"
    ((ERRORS++))
fi

echo ""

# 检查脚本权限
echo "🔍 检查脚本权限..."
SCRIPTS=(
    "start-services.sh"
    "scripts/check-service.sh"
    "scripts/verify-prod-env.sh"
)

MISSING_PERMISSIONS=()

for script in "${SCRIPTS[@]}"; do
    if [ -f "$PROD_DIR/$script" ]; then
        if [ -x "$PROD_DIR/$script" ]; then
            echo "✅ $script (可执行)"
        else
            echo "⚠️  $script (缺少执行权限)"
            MISSING_PERMISSIONS+=("$script")
            ((WARNINGS++))
        fi
    fi
done

echo ""

# 检查依赖
echo "🔍 检查依赖..."
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 已安装: $NODE_VERSION"
else
    echo "❌ Node.js 未安装"
    ((ERRORS++))
fi

if [ -d "$PROD_DIR/node_modules" ]; then
    DEP_COUNT=$(ls "$PROD_DIR/node_modules" 2>/dev/null | wc -l)
    if [ "$DEP_COUNT" -gt 0 ]; then
        echo "✅ node_modules 目录存在 ($DEP_COUNT 个包)"
    else
        echo "⚠️  node_modules 目录为空（可能需要运行 npm install）"
        ((WARNINGS++))
    fi
else
    echo "❌ node_modules 目录缺失"
    ((ERRORS++))
fi

echo ""

# 检查构建产物
echo "🔍 检查构建产物..."
if [ -d "$PROD_DIR/dist" ]; then
    DIST_FILES=$(find "$PROD_DIR/dist" -type f 2>/dev/null | wc -l)
    if [ "$DIST_FILES" -gt 0 ]; then
        echo "✅ dist/ 目录存在 ($DIST_FILES 个文件)"
    else
        echo "⚠️  dist/ 目录为空（可能需要运行 npm run build）"
        ((WARNINGS++))
    fi
else
    echo "❌ dist/ 目录缺失"
    ((ERRORS++))
fi

echo ""

# 检查日志文件
echo "🔍 检查日志文件..."
LOG_FILES=(
    "/tmp/merged-service.log"
    "/tmp/zealman-app-improved-autostart.log"
    "/tmp/zealman-daemon.log"
)

for log_file in "${LOG_FILES[@]}"; do
    if [ -f "$log_file" ]; then
        SIZE=$(du -h "$log_file" 2>/dev/null | cut -f1)
        echo "✅ $log_file 存在 ($SIZE)"
    else
        echo "⚠️  $log_file 不存在（服务可能未启动过）"
    fi
done

echo ""

# 检查最近的错误日志
if [ -f "/tmp/merged-service.log" ]; then
    ERROR_COUNT=$(grep -i "error\|failed\|exception" /tmp/merged-service.log 2>/dev/null | tail -5 | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "⚠️  发现最近的错误日志 ($ERROR_COUNT 条)"
        echo "   最近的错误："
        grep -i "error\|failed\|exception" /tmp/merged-service.log 2>/dev/null | tail -3 | sed 's/^/   /'
    else
        echo "✅ 未发现最近的错误日志"
    fi
fi

echo ""

# 生成报告
echo "=========================================="
echo "验证报告"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ 验证结果: PASS"
    echo "🚀 生产环境配置正常，服务运行正常"
    STATUS=0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  验证结果: PASS (有警告)"
    echo "⚠️  发现 $WARNINGS 个警告，建议检查"
    STATUS=0
else
    echo "❌ 验证结果: FAIL"
    echo "❌ 发现 $ERRORS 个错误，$WARNINGS 个警告"
    echo "💡 请根据上述错误信息进行修复"
    STATUS=1
fi

echo ""

# 如果有缺少权限的脚本，提供修复建议
if [ ${#MISSING_PERMISSIONS[@]} -gt 0 ]; then
    echo "=========================================="
    echo "权限修复建议"
    echo "=========================================="
    echo ""
    echo "以下脚本缺少执行权限，可以使用以下命令修复："
    echo ""
    echo "cd $PROD_DIR"
    for script in "${MISSING_PERMISSIONS[@]}"; do
        echo "chmod +x $script"
    done
    echo ""
    echo "或者批量修复所有脚本："
    echo "find $PROD_DIR -name '*.sh' -type f -exec chmod +x {} \\;"
    echo ""
fi

exit $STATUS

