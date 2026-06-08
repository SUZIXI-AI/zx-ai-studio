#!/bin/bash
# 创建带日期的发布压缩包
# 将 dist/ 目录和 server.js 打包成 tar.gz 文件

PROD_DIR="/root/zealman-app"
PACKAGE_DIR="/root/zealman-app/releases"
DATE=$(date '+%Y%m%d-%H%M%S')
PACKAGE_NAME="zealman-app-${DATE}.tar.gz"
PACKAGE_PATH="${PACKAGE_DIR}/${PACKAGE_NAME}"

echo "📦 开始创建发布压缩包..."

# 检查生产环境是否存在
if [ ! -d "$PROD_DIR" ]; then
    echo "❌ 生产环境不存在: $PROD_DIR"
    exit 1
fi

# 检查必要文件是否存在
if [ ! -d "$PROD_DIR/dist" ] || [ ! -f "$PROD_DIR/dist/index.html" ]; then
    echo "❌ dist/ 目录或 dist/index.html 不存在"
    exit 1
fi

if [ ! -f "$PROD_DIR/server.js" ]; then
    echo "❌ server.js 不存在"
    exit 1
fi

# 创建 releases 目录
mkdir -p "$PACKAGE_DIR"

# 进入生产环境目录
cd "$PROD_DIR"

# 创建临时目录用于打包
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# 复制 dist/ 目录到临时目录
echo "📋 复制 dist/ 目录..."
cp -r dist "$TEMP_DIR/"

# 复制 server.js 到临时目录
echo "📋 复制 server.js..."
cp server.js "$TEMP_DIR/"

# 创建压缩包
echo "🗜️  创建压缩包: $PACKAGE_NAME"
cd "$TEMP_DIR"
tar -czf "$PACKAGE_PATH" dist/ server.js

if [ $? -eq 0 ]; then
    PACKAGE_SIZE=$(du -h "$PACKAGE_PATH" | cut -f1)
    echo "✅ 压缩包创建成功: $PACKAGE_PATH"
    echo "📊 压缩包大小: $PACKAGE_SIZE"
    
    # 显示压缩包信息
    echo ""
    echo "📦 压缩包信息:"
    echo "   - 文件名: $PACKAGE_NAME"
    echo "   - 路径: $PACKAGE_PATH"
    echo "   - 大小: $PACKAGE_SIZE"
    echo "   - 包含: dist/ 目录和 server.js"
    
    # 列出 releases 目录中的压缩包（最多显示5个最新的）
    echo ""
    echo "📚 最近的发布包:"
    ls -lht "$PACKAGE_DIR"/*.tar.gz 2>/dev/null | head -5 | awk '{print "   - " $9 " (" $5 ")"}'
    
    exit 0
else
    echo "❌ 压缩包创建失败"
    exit 1
fi
