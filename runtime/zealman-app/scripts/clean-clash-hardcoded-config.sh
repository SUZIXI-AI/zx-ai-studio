#!/bin/bash
# 清理 Clash 配置文件中硬编码的节点信息
# 这些配置应该从 config.json 动态生成，而不是硬编码在文件中

CLASH_BASE_DIR="/root/clashctl"
CONFIG_JSON="/root/zealman-app/config.json"

echo "🧹 开始清理 Clash 硬编码配置..."

if [ ! -d "$CLASH_BASE_DIR" ]; then
    echo "❌ Clash 目录不存在: $CLASH_BASE_DIR"
    exit 1
fi

# 读取 config.json 中的节点信息（用于识别硬编码的配置）
if [ -f "$CONFIG_JSON" ]; then
    SERVER=$(grep -o '"server":\s*"[^"]*"' "$CONFIG_JSON" | cut -d'"' -f4)
    PASSWORD=$(grep -o '"password":\s*"[^"]*"' "$CONFIG_JSON" | cut -d'"' -f4)
    echo "📋 从 config.json 读取节点信息:"
    echo "   Server: ${SERVER:0:20}..."
    echo "   Password: ${PASSWORD:0:10}..."
else
    echo "⚠️  警告: config.json 不存在，将清理所有包含常见节点信息的文件"
    SERVER="65.49.207"
    PASSWORD="udL3WZnByE5yPwLH"
fi

CLEANED_COUNT=0

# 清理 profiles 目录中的硬编码配置
PROFILES_DIR="$CLASH_BASE_DIR/resources/profiles"
if [ -d "$PROFILES_DIR" ]; then
    echo ""
    echo "📁 清理 profiles 目录..."
    for file in "$PROFILES_DIR"/*.yaml "$PROFILES_DIR"/*.yml; do
        if [ -f "$file" ]; then
            if grep -q "$SERVER\|$PASSWORD" "$file" 2>/dev/null; then
                echo "   🗑️  删除: $(basename "$file")"
                rm -f "$file"
                ((CLEANED_COUNT++))
            fi
        fi
    done
fi

# 清理 temp.yaml（临时文件）
TEMP_FILE="$CLASH_BASE_DIR/resources/temp.yaml"
if [ -f "$TEMP_FILE" ]; then
    if grep -q "$SERVER\|$PASSWORD" "$TEMP_FILE" 2>/dev/null; then
        echo ""
        echo "📁 清理 temp.yaml..."
        echo "   🗑️  删除: temp.yaml"
        rm -f "$TEMP_FILE"
        ((CLEANED_COUNT++))
    fi
fi

# 清理 config.yaml（会被动态生成）
CONFIG_FILE="$CLASH_BASE_DIR/resources/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
    if grep -q "$SERVER\|$PASSWORD" "$CONFIG_FILE" 2>/dev/null; then
        echo ""
        echo "📁 清理 config.yaml（将保留为空文件，等待动态生成）..."
        echo "   🗑️  清空: config.yaml"
        echo "" > "$CONFIG_FILE"
        ((CLEANED_COUNT++))
    fi
fi

# 清理 runtime.yaml（运行时文件，会被重新生成）
RUNTIME_FILE="$CLASH_BASE_DIR/resources/runtime.yaml"
if [ -f "$RUNTIME_FILE" ]; then
    if grep -q "$SERVER\|$PASSWORD" "$RUNTIME_FILE" 2>/dev/null; then
        echo ""
        echo "📁 清理 runtime.yaml（运行时文件，会被重新生成）..."
        echo "   🗑️  清空: runtime.yaml"
        echo "" > "$RUNTIME_FILE"
        ((CLEANED_COUNT++))
    fi
fi

# 清理 profiles.yaml（订阅列表，会被重新生成）
PROFILES_YAML="$CLASH_BASE_DIR/resources/profiles.yaml"
if [ -f "$PROFILES_YAML" ]; then
    if grep -q "$SERVER\|$PASSWORD\|file:///tmp/clash-node-config.yaml" "$PROFILES_YAML" 2>/dev/null; then
        echo ""
        echo "📁 清理 profiles.yaml（订阅列表，会被重新生成）..."
        echo "   🗑️  重置: profiles.yaml"
        cat > "$PROFILES_YAML" << 'EOF'
# 当前使用的订阅
use: null
# 订阅列表
profiles: []
EOF
        ((CLEANED_COUNT++))
    fi
fi

echo ""
if [ $CLEANED_COUNT -gt 0 ]; then
    echo "✅ 清理完成！共清理 $CLEANED_COUNT 个文件"
    echo ""
    echo "💡 提示："
    echo "   - 配置文件现在会从 config.json 动态生成"
    echo "   - 下次启动 ComfyUI 时会自动使用 config.json 中的最新配置"
    echo "   - mixin.yaml 文件已保留（这是模板文件，不包含节点信息）"
else
    echo "✅ 未发现需要清理的硬编码配置文件"
fi
