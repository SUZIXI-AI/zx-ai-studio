#!/bin/bash
# 验证开发环境脚本
# 用于验证开发环境是否正常配置

echo "=========================================="
echo "开发环境验证脚本"
echo "=========================================="
echo ""

DEV_DIR="${ZX_AI_STUDIO_DEV_DIR:-/root/zx-ai-studio-dev}"
ERRORS=0
WARNINGS=0

# 检查开发目录
echo "🔍 检查目录结构..."
if [ -d "$DEV_DIR" ]; then
    echo "✅ 开发目录存在: $DEV_DIR"
else
    echo "❌ 开发目录不存在: $DEV_DIR"
    exit 1
fi

# 检查必要的子目录
REQUIRED_DIRS=(
    "pages"
    "scripts"
    "public"
    "utils"
    "md"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$DEV_DIR/$dir" ]; then
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
    "index.tsx"
    "start-services.sh"
    "start-dev.sh"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$DEV_DIR/$file" ]; then
        echo "✅ $file 存在"
    else
        echo "❌ $file 缺失"
        ((ERRORS++))
    fi
done

echo ""

# 检查脚本权限
echo "🔍 检查脚本权限..."
SCRIPTS=(
    "start-services.sh"
    "start-dev.sh"
    "start-comfyui.sh"
    "verify-deployment-package.sh"
    "scripts/build-and-sync.sh"
    "scripts/build-and-sync-test.sh"
    "scripts/build-frontend-only.sh"
    "scripts/sync-to-prod.sh"
    "scripts/check-service.sh"
    "scripts/install-nodejs.sh"
    "scripts/create-production.sh"
    "scripts/create-full-production.sh"
    "scripts/setup-autodl-autostart.sh"
    "scripts/setup-new-host.sh"
    "scripts/improved-autostart.sh"
    "scripts/daemon.sh"
    "scripts/deploy-complete.sh"
    "scripts/compile-sageattention-4090.sh"
    "scripts/compile-sageattention-universal.sh"
    "scripts/download-react.sh"
    "scripts/verify-dev-env.sh"
    "scripts/verify-prod-env.sh"
)

MISSING_PERMISSIONS=()

for script in "${SCRIPTS[@]}"; do
    if [ -f "$DEV_DIR/$script" ]; then
        if [ -x "$DEV_DIR/$script" ]; then
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

if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm 可用: v$NPM_VERSION"
else
    echo "❌ npm 不可用"
    ((ERRORS++))
fi

if [ -d "$DEV_DIR/node_modules" ]; then
    DEP_COUNT=$(ls "$DEV_DIR/node_modules" 2>/dev/null | wc -l)
    echo "✅ node_modules 目录存在 ($DEP_COUNT 个包)"
else
    echo "⚠️  node_modules 目录缺失（可能需要运行 npm install）"
    ((WARNINGS++))
fi

echo ""

# 检查端口
echo "🔍 检查端口..."
if lsof -i :6008 >/dev/null 2>&1; then
    echo "⚠️  端口 6008 已被占用（可能已有服务在运行）"
    lsof -i :6008 | head -3
    ((WARNINGS++))
else
    echo "✅ 端口 6008 可用"
fi

echo ""

# 检查配置文件
echo "🔍 检查配置文件..."
if [ -f "$DEV_DIR/config.json" ]; then
    echo "✅ config.json 存在"
else
    echo "⚠️  config.json 缺失"
    ((WARNINGS++))
fi

if [ -f "$DEV_DIR/app.yaml" ]; then
    echo "✅ app.yaml 存在"
else
    echo "⚠️  app.yaml 缺失（可选）"
fi

echo ""

# 生成报告
echo "=========================================="
echo "验证报告"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "✅ 验证结果: PASS"
    echo "🚀 开发环境配置正常，可以开始开发"
    STATUS=0
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  验证结果: PASS (有警告)"
    echo "⚠️  发现 $WARNINGS 个警告，建议修复"
    STATUS=0
else
    echo "❌ 验证结果: FAIL"
    echo "❌ 发现 $ERRORS 个错误，$WARNINGS 个警告"
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
    echo "cd $DEV_DIR"
    for script in "${MISSING_PERMISSIONS[@]}"; do
        echo "chmod +x $script"
    done
    echo ""
    echo "或者批量修复所有脚本："
    echo "find $DEV_DIR -name '*.sh' -type f -exec chmod +x {} \\;"
    echo ""
fi

exit $STATUS
