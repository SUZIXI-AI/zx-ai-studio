#!/bin/bash

# 脚本权限和行尾符检查和修复工具
# 用法: ./fix-script-permissions.sh [--check-only|-c]
# --check-only 或 -c: 仅检查权限和行尾符，不进行修复

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK_ONLY=false

# 解析参数
if [ "$1" = "--check-only" ] || [ "$1" = "-c" ]; then
    CHECK_ONLY=true
fi

# 期望的权限（八进制）
EXPECTED_PERM_OCTAL="755"
EXPECTED_PERM_STRING="rwxr-xr-x"

# 统计变量
TOTAL_SCRIPTS=0
CORRECT_PERMS=0
FIXED_PERMS=0
CORRECT_EOL=0
FIXED_EOL=0
ERROR_COUNT=0

echo "=========================================="
echo "脚本权限和行尾符检查和修复工具"
echo "=========================================="
echo ""

# 查找所有 .sh 脚本文件
find_scripts() {
    find "$SCRIPT_DIR" -type f -name "*.sh" ! -path "*/node_modules/*" 2>/dev/null
}

# 检查文件是否有 CRLF 行尾符
check_eol() {
    local file="$1"
    # 使用 file 命令检查，或者直接检查文件内容
    if file "$file" 2>/dev/null | grep -q "CRLF"; then
        return 1  # 有 CRLF，需要修复
    fi
    # 或者直接检查文件是否包含 \r
    if grep -q $'\r' "$file" 2>/dev/null; then
        return 1  # 有 CRLF，需要修复
    fi
    return 0  # 行尾符正确
}

# 修复文件的行尾符（CRLF -> LF）
fix_eol() {
    local file="$1"
    # 使用 sed 删除行尾的 \r
    if sed -i 's/\r$//' "$file" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# 检查并修复单个文件的权限和行尾符
check_and_fix_permission() {
    local file="$1"
    local current_perm=$(stat -c "%a" "$file" 2>/dev/null)
    local current_perm_string=$(stat -c "%A" "$file" 2>/dev/null)
    local perm_ok=false
    local eol_ok=false
    local perm_fixed=false
    local eol_fixed=false
    
    TOTAL_SCRIPTS=$((TOTAL_SCRIPTS + 1))
    
    if [ -z "$current_perm" ]; then
        echo "❌ 无法读取文件权限: $file"
        ERROR_COUNT=$((ERROR_COUNT + 1))
        return 1
    fi
    
    # 显示文件信息
    printf "📄 %-60s\n" "$file"
    
    # 检查权限
    printf "   权限: %s (%s) " "$current_perm_string" "$current_perm"
    if [ "$current_perm" = "$EXPECTED_PERM_OCTAL" ]; then
        echo "✅"
        CORRECT_PERMS=$((CORRECT_PERMS + 1))
        perm_ok=true
    else
        echo "⚠️  不正确"
        if [ "$CHECK_ONLY" = false ]; then
            # 修复权限
            if chmod "$EXPECTED_PERM_OCTAL" "$file" 2>/dev/null; then
                local new_perm=$(stat -c "%a" "$file" 2>/dev/null)
                if [ "$new_perm" = "$EXPECTED_PERM_OCTAL" ]; then
                    echo "      ✅ 已修复为 $EXPECTED_PERM_STRING ($EXPECTED_PERM_OCTAL)"
                    FIXED_PERMS=$((FIXED_PERMS + 1))
                    perm_fixed=true
                else
                    echo "      ❌ 修复失败"
                    ERROR_COUNT=$((ERROR_COUNT + 1))
                fi
            else
                echo "      ❌ 无法修改权限（可能需要 root 权限）"
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        else
            echo "      (仅检查模式，未修复)"
        fi
    fi
    
    # 检查行尾符
    printf "   行尾符: "
    if check_eol "$file"; then
        echo "✅ Unix (LF)"
        CORRECT_EOL=$((CORRECT_EOL + 1))
        eol_ok=true
    else
        echo "⚠️  Windows (CRLF)"
        if [ "$CHECK_ONLY" = false ]; then
            # 修复行尾符
            if fix_eol "$file"; then
                # 验证修复结果
                if check_eol "$file"; then
                    echo "      ✅ 已修复为 Unix (LF)"
                    FIXED_EOL=$((FIXED_EOL + 1))
                    eol_fixed=true
                else
                    echo "      ❌ 修复失败"
                    ERROR_COUNT=$((ERROR_COUNT + 1))
                fi
            else
                echo "      ❌ 无法修复行尾符"
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        else
            echo "      (仅检查模式，未修复)"
        fi
    fi
    
    # 如果权限和行尾符都正确，返回成功
    if [ "$perm_ok" = true ] && [ "$eol_ok" = true ]; then
        return 0
    elif [ "$perm_fixed" = true ] || [ "$eol_fixed" = true ]; then
        return 0
    else
        return 1
    fi
}

# 主执行流程
echo "🔍 正在查找脚本文件..."
echo ""

# 查找并处理所有脚本
SCRIPT_FILES=$(find_scripts)

if [ -z "$SCRIPT_FILES" ]; then
    echo "⚠️  未找到任何 .sh 脚本文件"
    exit 0
fi

# 处理每个脚本文件
while IFS= read -r script_file; do
    if [ -n "$script_file" ]; then
        check_and_fix_permission "$script_file"
    fi
done <<< "$SCRIPT_FILES"

echo ""
echo "=========================================="
echo "检查结果汇总"
echo "=========================================="
echo "总脚本数:     $TOTAL_SCRIPTS"
echo ""
echo "权限检查:"
echo "  正确:       $CORRECT_PERMS"
if [ "$CHECK_ONLY" = false ]; then
    echo "  已修复:     $FIXED_PERMS"
fi
echo ""
echo "行尾符检查:"
echo "  正确:       $CORRECT_EOL"
if [ "$CHECK_ONLY" = false ]; then
    echo "  已修复:     $FIXED_EOL"
fi
echo ""
echo "错误数:       $ERROR_COUNT"
echo ""

if [ "$CHECK_ONLY" = true ]; then
    echo "💡 提示: 运行不带参数的命令可自动修复权限和行尾符问题"
    echo "   例如: ./fix-script-permissions.sh"
else
    if [ $ERROR_COUNT -eq 0 ] && [ $FIXED_PERMS -eq 0 ] && [ $FIXED_EOL -eq 0 ]; then
        echo "✅ 所有脚本权限和行尾符正常，无需修复"
    elif [ $ERROR_COUNT -eq 0 ]; then
        echo "✅ 所有脚本权限和行尾符已修复完成"
    else
        echo "⚠️  部分脚本修复失败，请检查错误信息"
    fi
fi

echo ""
exit $ERROR_COUNT

