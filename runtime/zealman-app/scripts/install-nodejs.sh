#!/bin/bash

# Node.js 系统级安装脚本
# 用于系统级安装 node-v22.19.0-linux-x64.tar.xz
# 安装到 /usr/local 目录，所有用户都可以使用

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 检查是否为root用户
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_message $RED "错误: 请以root用户运行此脚本"
        exit 1
    fi
}

# 检查Node.js文件是否存在
check_nodejs_file() {
    local nodejs_file="/root/zealman-app/node-v22.19.0-linux-x64.tar.xz"
    if [ ! -f "$nodejs_file" ]; then
        print_message $RED "错误: 找不到Node.js文件: $nodejs_file"
        exit 1
    fi
    print_message $GREEN "✅ 找到Node.js文件: $nodejs_file"
}

# 检查系统架构
check_architecture() {
    local arch=$(uname -m)
    if [ "$arch" != "x86_64" ]; then
        print_message $YELLOW "警告: 当前系统架构为 $arch，此Node.js版本适用于x86_64"
        read -p "是否继续安装? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_message $RED "安装已取消"
            exit 1
        fi
    fi
    print_message $GREEN "✅ 系统架构检查通过: $arch"
}

# 备份现有的Node.js安装
backup_existing_nodejs() {
    if command -v node >/dev/null 2>&1; then
        local current_version=$(node --version 2>/dev/null || echo "unknown")
        print_message $YELLOW "检测到现有Node.js版本: $current_version"
        
        # 创建备份目录
        local backup_dir="/root/nodejs-backup-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        
        # 备份现有的node和npm
        if [ -f "/usr/local/bin/node" ]; then
            cp /usr/local/bin/node "$backup_dir/"
            print_message $BLUE "已备份: /usr/local/bin/node"
        fi
        if [ -f "/usr/local/bin/npm" ]; then
            cp /usr/local/bin/npm "$backup_dir/"
            print_message $BLUE "已备份: /usr/local/bin/npm"
        fi
        if [ -f "/usr/local/bin/npx" ]; then
            cp /usr/local/bin/npx "$backup_dir/"
            print_message $BLUE "已备份: /usr/local/bin/npx"
        fi
        
        print_message $GREEN "✅ 现有Node.js已备份到: $backup_dir"
    fi
}

# 安装Node.js
install_nodejs() {
    local nodejs_file="/root/zealman-app/node-v22.19.0-linux-x64.tar.xz"
    local install_dir="/usr/local"
    local temp_dir="/tmp/nodejs-install"
    
    print_message $BLUE "开始系统级安装Node.js..."
    
    # 创建临时目录
    mkdir -p "$temp_dir"
    cd "$temp_dir"
    
    # 解压Node.js文件
    print_message $BLUE "解压Node.js文件..."
    tar -xf "$nodejs_file"
    
    # 检查解压结果
    local extracted_dir="node-v22.19.0-linux-x64"
    if [ ! -d "$extracted_dir" ]; then
        print_message $RED "错误: 解压失败，未找到目录 $extracted_dir"
        exit 1
    fi
    
    # 系统级安装：复制文件到系统目录
    print_message $BLUE "复制文件到系统目录..."
    cp -r "$extracted_dir"/* "$install_dir/"
    
    # 设置正确的文件权限
    print_message $BLUE "设置文件权限..."
    chmod +x "$install_dir/bin/node"
    chmod +x "$install_dir/bin/npm"
    chmod +x "$install_dir/bin/npx"
    
    # 创建系统级符号链接
    print_message $BLUE "创建系统级符号链接..."
    ln -sf "$install_dir/bin/node" /usr/local/bin/node 2>/dev/null || true
    
    # 检查并创建正确的npm和npx符号链接
    if [ -f "$install_dir/lib/node_modules/npm/bin/npm-cli.js" ]; then
        ln -sf "$install_dir/lib/node_modules/npm/bin/npm-cli.js" /usr/local/bin/npm 2>/dev/null || true
        print_message $GREEN "✅ npm符号链接创建成功"
    else
        print_message $YELLOW "⚠️  未找到npm-cli.js，尝试备用方案"
        ln -sf "$install_dir/bin/npm" /usr/local/bin/npm 2>/dev/null || true
    fi
    
    if [ -f "$install_dir/lib/node_modules/npm/bin/npx-cli.js" ]; then
        ln -sf "$install_dir/lib/node_modules/npm/bin/npx-cli.js" /usr/local/bin/npx 2>/dev/null || true
        print_message $GREEN "✅ npx符号链接创建成功"
    else
        print_message $YELLOW "⚠️  未找到npx-cli.js，尝试备用方案"
        ln -sf "$install_dir/bin/npx" /usr/local/bin/npx 2>/dev/null || true
    fi
    
    # 创建全局npm配置目录
    mkdir -p /usr/local/lib/node_modules
    mkdir -p /usr/local/share/npm
    
    # 设置npm全局安装路径
    if command -v npm >/dev/null 2>&1; then
        npm config set prefix /usr/local
        npm config set cache /tmp/.npm
    fi
    
    # 清理临时文件
    rm -rf "$temp_dir"
    
    print_message $GREEN "✅ Node.js系统级安装完成"
}

# 验证系统级安装
verify_installation() {
    print_message $BLUE "验证系统级安装..."
    
    # 检查node版本
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        print_message $GREEN "✅ Node.js版本: $node_version"
        
        # 检查Node.js安装路径
        local node_path=$(which node)
        print_message $BLUE "  - Node.js路径: $node_path"
    else
        print_message $RED "❌ Node.js安装失败"
        exit 1
    fi
    
    # 检查npm版本
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        print_message $GREEN "✅ npm版本: $npm_version"
        
        # 检查npm配置
        local npm_prefix=$(npm config get prefix 2>/dev/null || echo "未配置")
        local npm_cache=$(npm config get cache 2>/dev/null || echo "未配置")
        print_message $BLUE "  - npm全局前缀: $npm_prefix"
        print_message $BLUE "  - npm缓存目录: $npm_cache"
    else
        print_message $RED "❌ npm安装失败"
        exit 1
    fi
    
    # 检查npx版本
    if command -v npx >/dev/null 2>&1; then
        local npx_version=$(npx --version)
        print_message $GREEN "✅ npx版本: $npx_version"
    else
        print_message $YELLOW "⚠️  npx未找到，但这是正常的"
    fi
    
    # 检查系统级文件权限
    if [ -f "/usr/local/bin/node" ] && [ -x "/usr/local/bin/node" ]; then
        print_message $GREEN "✅ Node.js可执行文件权限正确"
    else
        print_message $RED "❌ Node.js可执行文件权限错误"
    fi
    
    # 检查全局模块目录
    if [ -d "/usr/local/lib/node_modules" ]; then
        print_message $GREEN "✅ 全局模块目录存在: /usr/local/lib/node_modules"
    else
        print_message $YELLOW "⚠️  全局模块目录不存在"
    fi
}

# 更新环境变量
update_environment() {
    print_message $BLUE "更新系统环境变量..."
    
    # 系统级环境变量配置
    local system_profile="/etc/profile"
    local bashrc_files=("/root/.bashrc" "/etc/bash.bashrc")
    
    # 检查系统级PATH配置
    if ! grep -q "/usr/local/bin" "$system_profile" 2>/dev/null; then
        print_message $YELLOW "添加/usr/local/bin到系统PATH..."
        echo 'export PATH="/usr/local/bin:$PATH"' >> "$system_profile"
        print_message $GREEN "✅ 已添加到系统配置文件: $system_profile"
    else
        print_message $GREEN "✅ 系统PATH已包含/usr/local/bin"
    fi
    
    # 更新用户级配置文件
    for bashrc_file in "${bashrc_files[@]}"; do
        if [ -f "$bashrc_file" ] && ! grep -q "/usr/local/bin" "$bashrc_file" 2>/dev/null; then
            echo 'export PATH="/usr/local/bin:$PATH"' >> "$bashrc_file"
            print_message $GREEN "✅ 已添加到: $bashrc_file"
        fi
    done
    
    # 创建系统级Node.js环境配置
    local node_env_file="/etc/environment.d/nodejs.conf"
    mkdir -p "$(dirname "$node_env_file")"
    cat > "$node_env_file" << EOF
# Node.js 环境配置
NODE_PATH="/usr/local/lib/node_modules"
PATH="/usr/local/bin:\$PATH"
EOF
    print_message $GREEN "✅ 已创建系统级Node.js环境配置: $node_env_file"
    
    # 立即更新当前会话的PATH
    export PATH="/usr/local/bin:$PATH"
    
    # 确保当前会话能立即使用新的Node.js
    if command -v node >/dev/null 2>&1; then
        local final_version=$(node --version)
        print_message $GREEN "✅ 当前会话Node.js版本: $final_version"
    fi
}

# 确保npm命令可用
ensure_npm_available() {
    # 确保环境变量正确加载
    export PATH="/usr/local/bin:$PATH"
    
    # 如果npm不可用，尝试重新加载环境变量
    if ! command -v npm >/dev/null 2>&1; then
        print_message $YELLOW "⚠️  npm命令不可用，尝试重新加载环境变量..."
        
        # 重新加载系统环境变量
        if [ -f "/etc/profile" ]; then
            source /etc/profile
        fi
        
        # 重新加载用户环境变量
        if [ -f "/root/.bashrc" ]; then
            source /root/.bashrc
        fi
        
        # 再次设置PATH
        export PATH="/usr/local/bin:$PATH"
        
        # 检查npm是否现在可用
        if ! command -v npm >/dev/null 2>&1; then
            print_message $RED "❌ npm命令仍然不可用"
            print_message $BLUE "调试信息:"
            print_message $BLUE "  - 当前PATH: $PATH"
            print_message $BLUE "  - Node.js路径: $(which node 2>/dev/null || echo '未找到')"
            print_message $BLUE "  - npm文件存在: $([ -f /usr/local/bin/npm ] && echo '是' || echo '否')"
            print_message $BLUE "  - npm文件权限: $(ls -la /usr/local/bin/npm 2>/dev/null || echo '文件不存在')"
            return 1
        fi
    fi
    
    print_message $GREEN "✅ npm命令可用: $(which npm)"
    return 0
}

# 安装Vite（从package.json读取版本）
install_vite() {
    local project_package_json="/root/zealman-app/package.json"
    
    if [ ! -f "$project_package_json" ]; then
        print_message $YELLOW "⚠️  未找到项目目录，跳过Vite安装"
        return 1
    fi
    
    # 从package.json读取Vite版本
    local target_version=$(node -e "try { const pkg = require('$project_package_json'); console.log(pkg.devDependencies?.vite || 'not-found'); } catch(e) { console.log('not-found'); }" 2>/dev/null | sed 's/[\^~]//g')
    
    if [ "$target_version" = "not-found" ]; then
        print_message $YELLOW "⚠️  无法从package.json读取Vite版本"
        return 1
    fi
    
    print_message $BLUE "开始安装Vite $target_version..."
    cd /root/zealman-app
    print_message $BLUE "在项目目录中安装Vite..."
    
    # 确保npm命令可用
    if ! ensure_npm_available; then
        print_message $RED "❌ 无法确保npm命令可用，跳过Vite安装"
        return 1
    fi
    
    # 创建node_modules目录
    mkdir -p node_modules
    
    # 尝试使用npm安装Vite
    print_message $BLUE "尝试使用npm安装Vite..."
    if npm install --save-dev --no-optional --no-audit --no-fund 2>/dev/null; then
        print_message $GREEN "✅ Vite $target_version安装成功"
    else
        print_message $YELLOW "⚠️  npm安装失败，尝试手动安装依赖..."
        
        # 手动安装所有依赖
        if npm install --force --no-optional --no-audit --no-fund; then
            print_message $GREEN "✅ 依赖安装成功"
        else
            print_message $RED "❌ 依赖安装失败，请检查网络连接和权限"
            return 1
        fi
    fi
    
    # 验证Vite安装
    if [ -d "node_modules/vite" ] && [ -f "node_modules/vite/package.json" ]; then
        local installed_version=$(node -e "console.log(require('./node_modules/vite/package.json').version)" 2>/dev/null || echo "unknown")
        print_message $GREEN "✅ Vite版本: $installed_version"
    else
        print_message $RED "❌ Vite安装验证失败"
        return 1
    fi
}

# 显示系统级安装信息
show_installation_info() {
    print_message $GREEN "🎉 Node.js系统级安装成功！"
    echo
    print_message $BLUE "系统级安装信息:"
    echo "  - Node.js版本: $(node --version)"
    echo "  - npm版本: $(npm --version)"
    echo "  - 安装路径: /usr/local"
    echo "  - 可执行文件: /usr/local/bin/node, /usr/local/bin/npm, /usr/local/bin/npx"
    echo "  - 全局模块目录: /usr/local/lib/node_modules"
    echo "  - npm配置前缀: $(npm config get prefix 2>/dev/null || echo '未配置')"
    echo "  - npm缓存目录: $(npm config get cache 2>/dev/null || echo '未配置')"
    
    # 显示系统环境配置
    echo
    print_message $BLUE "系统环境配置:"
    echo "  - 系统配置文件: /etc/profile"
    echo "  - Node.js环境配置: /etc/environment.d/nodejs.conf"
    echo "  - 用户配置文件: /root/.bashrc, /etc/bash.bashrc"
    
    # 显示项目依赖信息
    if [ -f "/root/zealman-app/node_modules/vite/package.json" ]; then
        local vite_version=$(node -e "console.log(require('/root/zealman-app/node_modules/vite/package.json').version)" 2>/dev/null || echo "unknown")
        echo "  - Vite版本: $vite_version"
        echo "  - 项目依赖路径: /root/zealman-app/node_modules"
    else
        echo "  - 项目依赖: 未安装或安装失败"
    fi
    
    echo
    print_message $YELLOW "系统级安装说明:"
    echo "  - Node.js已安装到系统目录，所有用户都可以使用"
    echo "  - 环境变量已配置到系统级配置文件"
    echo "  - 新终端会话将自动加载Node.js环境"
    echo "  - 如需立即生效，请运行: source /etc/profile"
}

# 检查Node.js版本
check_nodejs_version() {
    if command -v node >/dev/null 2>&1; then
        local current_version=$(node --version)
        local target_version="v22.19.0"
        
        if [ "$current_version" = "$target_version" ]; then
            print_message $GREEN "✅ Node.js版本已正确: $current_version"
            return 0
        else
            print_message $YELLOW "⚠️  当前Node.js版本: $current_version，目标版本: $target_version"
            return 1
        fi
    else
        print_message $YELLOW "⚠️  Node.js未安装"
        return 1
    fi
}

# 检查Vite版本
check_vite_version() {
    local project_package_json="/root/zealman-app/package.json"
    
    if [ -f "$project_package_json" ]; then
        # 从package.json读取目标Vite版本
        local target_version=$(node -e "try { const pkg = require('$project_package_json'); console.log(pkg.devDependencies?.vite || 'not-found'); } catch(e) { console.log('not-found'); }" 2>/dev/null | sed 's/[\^~]//g')
        
        if [ "$target_version" = "not-found" ]; then
            print_message $YELLOW "⚠️  无法从package.json读取Vite版本"
            return 1
        fi
        
        # 检查当前安装的Vite版本
        if [ -f "/root/zealman-app/node_modules/vite/package.json" ]; then
            local current_version=$(node -e "console.log(require('/root/zealman-app/node_modules/vite/package.json').version)" 2>/dev/null || echo "unknown")
            
            # 比较版本（简化版本比较）
            if [ "$current_version" = "$target_version" ] || [[ "$current_version" == "$target_version"* ]]; then
                print_message $GREEN "✅ Vite版本已正确: $current_version (目标: $target_version)"
                return 0
            else
                print_message $YELLOW "⚠️  当前Vite版本: $current_version，目标版本: $target_version"
                return 1
            fi
        else
            print_message $YELLOW "⚠️  Vite未安装"
            return 1
        fi
    else
        print_message $YELLOW "⚠️  未找到package.json文件"
        return 1
    fi
}

# 主函数
main() {
    print_message $BLUE "🚀 开始系统级安装Node.js v22.19.0和项目依赖..."
    echo
    
    # 确保环境变量正确加载
    export PATH="/usr/local/bin:$PATH"
    
    check_root
    check_nodejs_file
    check_architecture
    
    # 早期检查：如果Node.js和Vite版本都正确，完全跳过安装
    if check_nodejs_version && check_vite_version; then
        print_message $GREEN "✅ Node.js和Vite版本都正确，完全跳过安装过程"
        show_installation_info
        print_message $GREEN "✅ 检查完成！"
        return 0
    fi
    
    # 检查Node.js版本
    if ! check_nodejs_version; then
        print_message $BLUE "需要安装/更新Node.js..."
        backup_existing_nodejs
        install_nodejs
        verify_installation
        update_environment
    else
        print_message $GREEN "Node.js版本正确，跳过安装"
    fi
    
    # 检查Vite版本
    if ! check_vite_version; then
        print_message $BLUE "需要安装/更新Vite..."
        install_vite
    else
        print_message $GREEN "Vite版本正确，跳过安装"
    fi
    
    show_installation_info
    print_message $GREEN "✅ 检查完成！"
}

# 运行主函数
main "$@"
