#!/bin/bash
# 开机后更新前端文件脚本
# 从软连接指向的实际文件拷贝到本地 dist/assets 目录

SOURCE_CSS="/.autodl/users/9/98101/index.css"
SOURCE_JS="/.autodl/users/9/98101/index.js"
TARGET_DIR="/root/zealman-app/dist/assets"

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a /var/log/frontend-update.log
}

log "开始更新前端文件..."

# 检查源文件是否存在
if [ ! -f "$SOURCE_CSS" ]; then
    log "错误: CSS 源文件不存在: $SOURCE_CSS"
    exit 1
fi

if [ ! -f "$SOURCE_JS" ]; then
    log "错误: JS 源文件不存在: $SOURCE_JS"
    exit 1
fi

# 检查目标目录是否存在
if [ ! -d "$TARGET_DIR" ]; then
    log "错误: 目标目录不存在: $TARGET_DIR"
    exit 1
fi

# 获取实际文件路径（如果是软连接，会解析到实际文件）
REAL_CSS=$(readlink -f "$SOURCE_CSS" 2>/dev/null || echo "$SOURCE_CSS")
REAL_JS=$(readlink -f "$SOURCE_JS" 2>/dev/null || echo "$SOURCE_JS")

log "CSS 源文件: $REAL_CSS"
log "JS 源文件: $REAL_JS"

# 首先尝试从 index.html 中读取实际引用的文件名
INDEX_HTML="/root/zealman-app/dist/index.html"
CSS_FILES=""
JS_FILES=""

if [ -f "$INDEX_HTML" ]; then
    # 从 HTML 中提取实际引用的文件名
    HTML_CSS=$(grep -oE 'index-[^"]+\.css' "$INDEX_HTML" 2>/dev/null | head -1)
    HTML_JS=$(grep -oE 'index-[^"]+\.js' "$INDEX_HTML" 2>/dev/null | head -1)
    
    if [ -n "$HTML_CSS" ] && [ -f "$TARGET_DIR/$HTML_CSS" ]; then
        CSS_FILES="$TARGET_DIR/$HTML_CSS"
        log "从 HTML 中找到 CSS 文件: $HTML_CSS"
    fi
    
    if [ -n "$HTML_JS" ] && [ -f "$TARGET_DIR/$HTML_JS" ]; then
        JS_FILES="$TARGET_DIR/$HTML_JS"
        log "从 HTML 中找到 JS 文件: $HTML_JS"
    fi
fi

# 如果从 HTML 中没找到，则查找所有匹配的文件（支持带哈希的文件名）
if [ -z "$CSS_FILES" ]; then
    CSS_FILES=$(find "$TARGET_DIR" -name "index-*.css" -type f 2>/dev/null)
    log "使用通配符查找 CSS 文件"
fi

if [ -z "$JS_FILES" ]; then
    JS_FILES=$(find "$TARGET_DIR" -name "index-*.js" -type f 2>/dev/null)
    log "使用通配符查找 JS 文件"
fi

# 拷贝 CSS 文件
if [ -n "$CSS_FILES" ]; then
    for css_file in $CSS_FILES; do
        log "更新 CSS 文件: $(basename $css_file)"
        cp -f "$REAL_CSS" "$css_file"
        if [ $? -eq 0 ]; then
            log "✓ CSS 文件更新成功: $(basename $css_file)"
        else
            log "✗ CSS 文件更新失败: $(basename $css_file)"
        fi
    done
else
    log "警告: 未找到目标 CSS 文件"
fi

# 拷贝 JS 文件
if [ -n "$JS_FILES" ]; then
    for js_file in $JS_FILES; do
        log "更新 JS 文件: $(basename $js_file)"
        cp -f "$REAL_JS" "$js_file"
        if [ $? -eq 0 ]; then
            log "✓ JS 文件更新成功: $(basename $js_file)"
        else
            log "✗ JS 文件更新失败: $(basename $js_file)"
        fi
    done
else
    log "警告: 未找到目标 JS 文件"
fi

log "前端文件更新完成"
