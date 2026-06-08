#!/bin/bash
# 从开发环境同步文件到生产环境的脚本（单向更新）

DEV_DIR="${ZX_AI_STUDIO_DEV_DIR:-/root/zx-ai-studio-dev}"
PROD_DIR="/root/zealman-app"

# 混淆工具路径
OBFUSCATOR="$DEV_DIR/node_modules/.bin/javascript-obfuscator"

# 检查开发环境是否存在
if [ ! -d "$DEV_DIR" ]; then
    echo "开发环境不存在: $DEV_DIR"
    exit 1
fi

echo "开始从开发环境同步文件到生产环境..."

# 确保生产环境必要目录存在
mkdir -p "$PROD_DIR/dist"
mkdir -p "$PROD_DIR/scripts"

# 同步构建文件
if [ -d "$DEV_DIR/dist" ]; then
    echo "同步 dist/ 目录..."
    rsync -av --delete "$DEV_DIR/dist/" "$PROD_DIR/dist/"
fi

# 混淆并同步后端模块目录（routes/ utils/ config/ lib/）
# 使用 javascript-obfuscator 对每个 .js 文件单独混淆后写入生产环境
obfuscate_dir() {
    local src_dir="$1"
    local dst_dir="$2"
    local dir_name
    dir_name=$(basename "$src_dir")
    echo "混淆并同步 ${dir_name}/ 目录..."
    mkdir -p "$dst_dir"
    # 删除生产环境中已不存在于源目录的文件
    find "$dst_dir" -name "*.js" | while read -r dst_file; do
        local base
        base=$(basename "$dst_file")
        if [ ! -f "$src_dir/$base" ]; then
            rm -f "$dst_file"
        fi
    done
    # 混淆每个 .js 文件
    for src_file in "$src_dir"/*.js; do
        [ -f "$src_file" ] || continue
        local base
        base=$(basename "$src_file")
        local dst_file="$dst_dir/$base"
        # 转换行尾符后混淆
        local tmp_file
        tmp_file=$(mktemp /tmp/obf_XXXXXX.js)
        sed 's/\r$//' "$src_file" > "$tmp_file"
        "$OBFUSCATOR" "$tmp_file" \
            --config "$DEV_DIR/obfuscator-config.json" \
            --output "$dst_file" 2>/dev/null
        if [ $? -ne 0 ]; then
            echo "  ⚠️  混淆失败: $base，使用原文件"
            cp "$tmp_file" "$dst_file"
        else
            echo "  ✅ $base"
        fi
        rm -f "$tmp_file"
    done
}

if [ -d "$DEV_DIR/routes" ]; then
    obfuscate_dir "$DEV_DIR/routes" "$PROD_DIR/routes"
fi

if [ -d "$DEV_DIR/utils" ]; then
    # utils/ 中只同步后端 .js 文件，跳过前端源码（.tsx .ts）
    obfuscate_dir "$DEV_DIR/utils" "$PROD_DIR/utils"
    # 删除误同步的前端文件
    rm -f "$PROD_DIR/utils"/*.tsx "$PROD_DIR/utils"/*.ts 2>/dev/null
fi

if [ -d "$DEV_DIR/config" ]; then
    obfuscate_dir "$DEV_DIR/config" "$PROD_DIR/config"
fi

# 混淆并同步 lib/（routes等引用的后端模块，如 studioScriptStore.js）
if [ -d "$DEV_DIR/lib" ]; then
    obfuscate_dir "$DEV_DIR/lib" "$PROD_DIR/lib"
    rm -f "$PROD_DIR/lib"/*.tsx "$PROD_DIR/lib"/*.ts 2>/dev/null
fi

# 同步 public/libs/ 目录（React 本地 fallback 文件）
# 注意：虽然 Vite 构建时会复制 public/ 到 dist/，但为了确保生产环境有完整的 React fallback，
# 需要单独同步 public/libs/ 目录，因为服务器需要直接提供 /libs/ 路径的文件
if [ -d "$DEV_DIR/public/libs" ]; then
    echo "同步 public/libs/ 目录..."
    mkdir -p "$PROD_DIR/public/libs"
    rsync -av --delete "$DEV_DIR/public/libs/" "$PROD_DIR/public/libs/"
fi

# 删除生产环境中的 clash-for-linux-install 目录（如果存在）
if [ -d "$PROD_DIR/public/clash-for-linux-install" ]; then
    echo "删除 public/clash-for-linux-install/ 目录..."
    rm -rf "$PROD_DIR/public/clash-for-linux-install"
fi

# 注意：不同步 workflows/、model.yaml 和 app.yaml，生产环境从远程仓库自动更新

# 同步快捷生成页面 A-H 组的 yaml 配置文件
if [ -d "$DEV_DIR/quick-generate-models" ]; then
    echo "同步 quick-generate-models/ 目录..."
    mkdir -p "$PROD_DIR/quick-generate-models"
    rsync -av --delete "$DEV_DIR/quick-generate-models/" "$PROD_DIR/quick-generate-models/"
fi

# 注意：不同步根目录的 index.html，生产环境使用 dist/index.html

# 同步后端文件（如果存在）
# 注意：server.js 不再同步，将使用混淆后的版本
# if [ -f "$DEV_DIR/server.js" ]; then
#     echo "同步 server.js..."
#     cp "$DEV_DIR/server.js" "$PROD_DIR/server.js"
# fi

# 同步 package.json 和 package-lock.json (npm 依赖配置)
# 注意：自动转换 Windows 行尾符（CRLF）为 Unix 行尾符（LF）
if [ -f "$DEV_DIR/package.json" ]; then
    echo "同步 package.json..."
    sed 's/\r$//' "$DEV_DIR/package.json" > "$PROD_DIR/package.json"
fi

if [ -f "$DEV_DIR/package-lock.json" ]; then
    echo "同步 package-lock.json..."
    sed 's/\r$//' "$DEV_DIR/package-lock.json" > "$PROD_DIR/package-lock.json"
fi

# 同步 start-services.sh (生产环境核心启动脚本)
# 注意：自动转换 Windows 行尾符（CRLF）为 Unix 行尾符（LF）
if [ -f "$DEV_DIR/start-services.sh" ]; then
    echo "同步 start-services.sh..."
    sed 's/\r$//' "$DEV_DIR/start-services.sh" > "$PROD_DIR/start-services.sh"
    chmod +x "$PROD_DIR/start-services.sh"
fi

# 同步自动启动脚本
# 注意：自动转换 Windows 行尾符（CRLF）为 Unix 行尾符（LF）
if [ -f "$DEV_DIR/scripts/improved-autostart.sh" ]; then
    echo "同步 improved-autostart.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/improved-autostart.sh" > "$PROD_DIR/scripts/improved-autostart.sh"
    chmod +x "$PROD_DIR/scripts/improved-autostart.sh"
fi

if [ -f "$DEV_DIR/scripts/setup-autodl-autostart.sh" ]; then
    echo "同步 setup-autodl-autostart.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/setup-autodl-autostart.sh" > "$PROD_DIR/scripts/setup-autodl-autostart.sh"
    chmod +x "$PROD_DIR/scripts/setup-autodl-autostart.sh"
fi

if [ -f "$DEV_DIR/scripts/daemon.sh" ]; then
    echo "同步 daemon.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/daemon.sh" > "$PROD_DIR/scripts/daemon.sh"
    chmod +x "$PROD_DIR/scripts/daemon.sh"
fi

if [ -f "$DEV_DIR/scripts/check-service.sh" ]; then
    echo "同步 check-service.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/check-service.sh" > "$PROD_DIR/scripts/check-service.sh"
    chmod +x "$PROD_DIR/scripts/check-service.sh"
fi

# 同步验证脚本
if [ -f "$DEV_DIR/scripts/verify-dev-env.sh" ]; then
    echo "同步 verify-dev-env.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/verify-dev-env.sh" > "$PROD_DIR/scripts/verify-dev-env.sh"
    chmod +x "$PROD_DIR/scripts/verify-dev-env.sh"
fi

if [ -f "$DEV_DIR/scripts/verify-prod-env.sh" ]; then
    echo "同步 verify-prod-env.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/verify-prod-env.sh" > "$PROD_DIR/scripts/verify-prod-env.sh"
    chmod +x "$PROD_DIR/scripts/verify-prod-env.sh"
fi


if [ -f "$DEV_DIR/scripts/zx-ai-studio.service" ]; then
    echo "同步 zx-ai-studio.service..."
    # 注意：自动转换 Windows 行尾符（CRLF）为 Unix 行尾符（LF）
    sed 's/\r$//' "$DEV_DIR/scripts/zx-ai-studio.service" > "$PROD_DIR/scripts/zx-ai-studio.service"
fi

# 同步其他生产环境脚本
# 注意：以下文件已不存在，已从同步列表中移除：
# - container-startup.sh
# - cron-startup.sh

if [ -f "$DEV_DIR/scripts/install-nodejs.sh" ]; then
    echo "同步 install-nodejs.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/install-nodejs.sh" > "$PROD_DIR/scripts/install-nodejs.sh"
    chmod +x "$PROD_DIR/scripts/install-nodejs.sh"
fi

# 同步手动更新控制面板脚本
if [ -f "$DEV_DIR/scripts/manual-update-panel.sh" ]; then
    echo "同步 manual-update-panel.sh..."
    sed 's/\r$//' "$DEV_DIR/scripts/manual-update-panel.sh" > "$PROD_DIR/scripts/manual-update-panel.sh"
    chmod +x "$PROD_DIR/scripts/manual-update-panel.sh"
fi

# start-comfyui.sh 入口链接由生产环境和外部只读脚本独立维护，部署流程不修改。

# 注意：以下文件不同步到生产环境，生产环境需要独立维护：
# - start-comfyui-new.sh（生产环境独立版本）
# - update-symlinks-new.sh（生产环境独立版本）

# 同步 modellink 目录
if [ -d "$DEV_DIR/modellink" ]; then
    echo "同步 modellink/ 目录..."
    mkdir -p "$PROD_DIR/modellink"
    rsync -av --delete "$DEV_DIR/modellink/" "$PROD_DIR/modellink/"
fi

# 同步 Wuli-API 画布系统
if [ -d "$DEV_DIR/Wuli-API" ]; then
    echo "同步 Wuli-API/ 画布系统..."
    mkdir -p "$PROD_DIR/Wuli-API"
    rsync -av --delete \
        --exclude "data/" \
        --exclude "output/" \
        --exclude "history.json" \
        --exclude "global_config.json" \
        --exclude "__pycache__/" \
        "$DEV_DIR/Wuli-API/" "$PROD_DIR/Wuli-API/"
fi

# 同步 ComfyUI workflows 目录
# 从 /root/ComfyUI/user/default/workflows 同步到 /root/zealman-app/comfyui-workflows
COMFYUI_WORKFLOWS_SRC="/root/ComfyUI/user/default/workflows"
COMFYUI_WORKFLOWS_DST="$PROD_DIR/comfyui-workflows"
if [ -d "$COMFYUI_WORKFLOWS_SRC" ]; then
    echo "同步 ComfyUI workflows/ 目录..."
    mkdir -p "$COMFYUI_WORKFLOWS_DST"
    rsync -av --delete "$COMFYUI_WORKFLOWS_SRC/" "$COMFYUI_WORKFLOWS_DST/"
    echo "✅ ComfyUI workflows 同步完成"
else
    echo "⚠️  警告: ComfyUI workflows 源目录不存在: $COMFYUI_WORKFLOWS_SRC"
fi

# 确保所有脚本文件都有执行权限
echo "设置所有脚本文件的执行权限..."
find "$PROD_DIR" -name "*.sh" -type f -exec chmod +x {} \;

echo "同步完成！"
