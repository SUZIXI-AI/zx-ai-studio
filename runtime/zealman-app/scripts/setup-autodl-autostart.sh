#!/bin/bash
# Zealman-AutoDL 专用开机自启配置脚本
# 针对AutoDL容器环境(无cron/systemd)优化
# 使用容器启动钩子实现真正的开机自启

set -e

# 设置 PATH 确保使用系统级 Node.js
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_message() {
    echo -e "${1}${2}${NC}"
}

print_title() {
    echo ""
    print_message $CYAN "=========================================="
    print_message $CYAN "$1"
    print_message $CYAN "=========================================="
    echo ""
}

print_title "🚀 AutoDL容器专用开机自启配置"

print_message $BLUE "📋 AutoDL容器环境说明:"
print_message $YELLOW "  - AutoDL容器不支持systemd和cron"
print_message $YELLOW "  - 需要使用容器启动钩子实现开机自启"
print_message $YELLOW "  - 本脚本将配置多种启动方式确保可靠性"
echo ""

# 方法1: 配置 /etc/rc.local (容器启动时执行)
setup_rc_local() {
    print_message $BLUE "🔧 配置 /etc/rc.local 启动..."
    
    # 检查rc.local是否存在
    if [ ! -f /etc/rc.local ]; then
        print_message $BLUE "   创建 /etc/rc.local..."
        cat > /etc/rc.local << 'EOF'
#!/bin/bash
# AutoDL容器启动脚本

# 等待系统就绪
sleep 5

# 启动Zealman-AutoDL服务
if [ -f /root/zealman-app/scripts/improved-autostart.sh ]; then
    nohup bash /root/zealman-app/scripts/improved-autostart.sh > /tmp/zealman-rc-local.log 2>&1 &
fi

exit 0
EOF
        chmod +x /etc/rc.local
        print_message $GREEN "✅ /etc/rc.local 已创建"
    else
        # 检查是否已存在配置
        if grep -q "zealman-app" /etc/rc.local; then
            print_message $YELLOW "⚠️  /etc/rc.local 中已存在配置"
        else
            # 在exit 0之前添加启动命令
            print_message $BLUE "   添加启动命令到 /etc/rc.local..."
            sed -i '/^exit 0/i \
# 启动Zealman-AutoDL服务\
if [ -f /root/zealman-app/scripts/improved-autostart.sh ]; then\
    nohup bash /root/zealman-app/scripts/improved-autostart.sh > /tmp/zealman-rc-local.log 2>&1 &\
fi\
' /etc/rc.local
            print_message $GREEN "✅ /etc/rc.local 已配置"
        fi
    fi
    
    print_message $BLUE "   - 触发: 容器启动时"
    print_message $BLUE "   - 延迟: 5秒"
    print_message $BLUE "   - 日志: /tmp/zealman-rc-local.log"
}

# 方法2: 配置 /etc/profile.d/ (所有用户登录时执行)
setup_profile_d() {
    print_message $BLUE "🔧 配置 /etc/profile.d/ 启动..."
    
    # 创建profile.d脚本
    cat > /etc/profile.d/zealman-autostart.sh << 'EOF'
#!/bin/bash
# Zealman-AutoDL 自动启动脚本
# 在所有用户登录时执行

if [ -f /root/zealman-app/scripts/improved-autostart.sh ]; then
    nohup bash /root/zealman-app/scripts/improved-autostart.sh > /tmp/zealman-profile-d.log 2>&1 &
fi
EOF
    
    chmod +x /etc/profile.d/zealman-autostart.sh
    
    print_message $GREEN "✅ /etc/profile.d/zealman-autostart.sh 已创建"
    print_message $BLUE "   - 触发: 任何用户登录时"
    print_message $BLUE "   - 日志: /tmp/zealman-profile-d.log"
}

# 方法3: 配置 .bashrc (已存在,确保正确配置)
check_bashrc() {
    print_message $BLUE "🔍 检查 .bashrc 配置..."
    
    if grep -q "zealman-app.*improved-autostart" /root/.bashrc; then
        print_message $GREEN "✅ .bashrc 已配置"
    else
        print_message $YELLOW "⚠️  .bashrc 未配置,正在添加..."
        cat >> /root/.bashrc << 'EOF'

# ==================== Zealman-AutoDL 自动启动 ====================
if [ -f "/root/zealman-app/scripts/improved-autostart.sh" ]; then
    nohup bash /root/zealman-app/scripts/improved-autostart.sh > /tmp/zealman-bashrc.log 2>&1 &
fi
# ================================================================
EOF
        print_message $GREEN "✅ .bashrc 已配置"
    fi
}

# 方法4: 配置 .profile (已存在,确保正确配置)
check_profile() {
    print_message $BLUE "🔍 检查 .profile 配置..."
    
    if grep -q "zealman-app.*improved-autostart" /root/.profile; then
        print_message $GREEN "✅ .profile 已配置"
    else
        print_message $YELLOW "⚠️  .profile 未配置,正在添加..."
        cat >> /root/.profile << 'EOF'

# ==================== Zealman-AutoDL 自动启动 ====================
if [ -f "/root/zealman-app/scripts/improved-autostart.sh" ]; then
    nohup bash /root/zealman-app/scripts/improved-autostart.sh > /tmp/zealman-profile.log 2>&1 &
fi
# ================================================================
EOF
        print_message $GREEN "✅ .profile 已配置"
    fi
}

# 方法5: 创建后台守护进程
create_daemon() {
    print_message $BLUE "🔧 创建后台守护进程..."
    
    cat > /root/zealman-app/scripts/daemon.sh << 'EOF'
#!/bin/bash
# Zealman-AutoDL 后台守护进程
# 持续监控服务状态,自动重启

LOG_FILE="/tmp/zealman-daemon.log"

echo "$(date): 守护进程启动" >> "$LOG_FILE"

while true; do
    # 检查服务是否运行
    if ! lsof -i :6008 >/dev/null 2>&1; then
        echo "$(date): 服务未运行,尝试启动..." >> "$LOG_FILE"
        /root/zealman-app/scripts/improved-autostart.sh >> "$LOG_FILE" 2>&1
    fi
    
    # 每5分钟检查一次
    sleep 300
done
EOF
    
    chmod +x /root/zealman-app/scripts/daemon.sh
    
    print_message $GREEN "✅ 守护进程脚本已创建"
    print_message $BLUE "   - 路径: /root/zealman-app/scripts/daemon.sh"
    print_message $BLUE "   - 检查间隔: 5分钟"
    print_message $BLUE "   - 日志: /tmp/zealman-daemon.log"
}

# 方法6: 启动守护进程
start_daemon() {
    print_message $BLUE "🚀 启动后台守护进程..."
    
    # 检查守护进程是否已在运行
    if pgrep -f "daemon.sh" >/dev/null 2>&1; then
        print_message $YELLOW "⚠️  守护进程已在运行"
        return 0
    fi
    
    # 启动守护进程
    nohup /root/zealman-app/scripts/daemon.sh > /dev/null 2>&1 &
    
    sleep 2
    
    if pgrep -f "daemon.sh" >/dev/null 2>&1; then
        print_message $GREEN "✅ 守护进程已启动"
        print_message $BLUE "   - PID: $(pgrep -f daemon.sh)"
    else
        print_message $RED "❌ 守护进程启动失败"
    fi
}

# 方法7: 配置守护进程开机启动
setup_daemon_autostart() {
    print_message $BLUE "🔧 配置守护进程开机启动..."
    
    # 在rc.local中添加守护进程启动
    if ! grep -q "daemon.sh" /etc/rc.local 2>/dev/null; then
        sed -i '/^exit 0/i \
# 启动Zealman-AutoDL守护进程\
if [ -f /root/zealman-app/scripts/daemon.sh ]; then\
    nohup bash /root/zealman-app/scripts/daemon.sh > /dev/null 2>&1 &\
fi\
' /etc/rc.local
        print_message $GREEN "✅ 守护进程已添加到 rc.local"
    else
        print_message $YELLOW "⚠️  守护进程已在 rc.local 中"
    fi
}

# 创建检测脚本
create_check_script() {
    print_message $BLUE "🔍 创建服务检测脚本..."
    
    cat > /root/zealman-app/scripts/check-service.sh << 'EOF'
#!/bin/bash
# 检查 Zealman-AutoDL 服务状态

echo "=========================================="
echo "Zealman-AutoDL 服务状态检查"
echo "=========================================="
echo ""

# 检查端口
echo "🔍 检查端口 6008..."
if lsof -i :6008 >/dev/null 2>&1; then
    echo "✅ 端口 6008 已被占用"
    lsof -i :6008
else
    echo "❌ 端口 6008 未被占用"
fi
echo ""

# 检查进程
echo "🔍 检查 Node.js 进程..."
if pgrep -f "node server.js" >/dev/null 2>&1; then
    echo "✅ Node.js 进程正在运行"
    ps aux | grep "node server.js" | grep -v grep
else
    echo "❌ Node.js 进程未运行"
fi
echo ""

# 检查守护进程
echo "🔍 检查守护进程..."
if pgrep -f "daemon.sh" >/dev/null 2>&1; then
    echo "✅ 守护进程正在运行"
    ps aux | grep "daemon.sh" | grep -v grep
else
    echo "❌ 守护进程未运行"
fi
echo ""

# 检查API健康
echo "🔍 检查 API 健康状态..."
if curl -s http://127.0.0.1:6008/api/health >/dev/null 2>&1; then
    echo "✅ API 健康检查通过"
    curl -s http://127.0.0.1:6008/api/health | python3 -m json.tool 2>/dev/null || echo "API响应正常"
else
    echo "❌ API 健康检查失败"
fi
echo ""

echo "=========================================="
echo "日志文件位置:"
echo "=========================================="
echo "  - 主服务: /tmp/merged-service.log"
echo "  - 启动脚本: /tmp/zealman-app-improved-autostart.log"
echo "  - rc.local: /tmp/zealman-rc-local.log"
echo "  - profile.d: /tmp/zealman-profile-d.log"
echo "  - 守护进程: /tmp/zealman-daemon.log"
echo ""
EOF
    
    chmod +x /root/zealman-app/scripts/check-service.sh
    
    print_message $GREEN "✅ 检测脚本已创建"
}

# 测试启动
test_startup() {
    print_message $BLUE "🧪 测试服务启动..."
    
    if lsof -i :6008 >/dev/null 2>&1; then
        print_message $GREEN "✅ 服务已在运行"
    else
        print_message $BLUE "   启动服务中..."
        /root/zealman-app/scripts/improved-autostart.sh
        sleep 5
        
        if lsof -i :6008 >/dev/null 2>&1; then
            print_message $GREEN "✅ 服务启动成功"
        else
            print_message $RED "❌ 服务启动失败"
            print_message $YELLOW "   请查看日志: tail -f /tmp/merged-service.log"
        fi
    fi
}

# 显示配置摘要
show_summary() {
    print_title "📋 配置摘要"
    
    print_message $CYAN "已配置的启动方式:"
    print_message $GREEN "  ✅ /etc/rc.local (容器启动时)"
    print_message $GREEN "  ✅ /etc/profile.d/ (任何用户登录时)"
    print_message $GREEN "  ✅ .bashrc (root用户SSH登录时)"
    print_message $GREEN "  ✅ .profile (root用户登录shell时)"
    print_message $GREEN "  ✅ 后台守护进程 (持续监控,每5分钟检查)"
    
    echo ""
    print_message $CYAN "启动流程:"
    print_message $BLUE "  1. 容器启动 → rc.local执行 → 启动服务 + 守护进程"
    print_message $BLUE "  2. 守护进程每5分钟检查 → 服务停止则自动重启"
    print_message $BLUE "  3. SSH登录 → bashrc/profile执行 → 备用启动"
    
    echo ""
    print_message $CYAN "日志文件:"
    print_message $BLUE "  - /tmp/merged-service.log (主服务)"
    print_message $BLUE "  - /tmp/zealman-rc-local.log (rc.local启动)"
    print_message $BLUE "  - /tmp/zealman-daemon.log (守护进程)"
    print_message $BLUE "  - /tmp/zealman-profile-d.log (profile.d启动)"
    
    echo ""
    print_message $CYAN "常用命令:"
    print_message $BLUE "  - 检查服务: /root/zealman-app/scripts/check-service.sh"
    print_message $BLUE "  - 查看日志: tail -f /tmp/merged-service.log"
    print_message $BLUE "  - 重启守护进程: pkill -f daemon.sh && nohup /root/zealman-app/scripts/daemon.sh &"
}

# 主函数
main() {
    # 配置各种启动方式
    setup_rc_local
    echo ""
    
    setup_profile_d
    echo ""
    
    check_bashrc
    echo ""
    
    check_profile
    echo ""
    
    create_daemon
    echo ""
    
    setup_daemon_autostart
    echo ""
    
    start_daemon
    echo ""
    
    create_check_script
    echo ""
    
    test_startup
    echo ""
    
    show_summary
    
    # 最终提示
    print_title "✅ 配置完成"
    
    print_message $GREEN "🎉 AutoDL容器开机自启动已配置完成！"
    echo ""
    print_message $YELLOW "⚠️  重要说明:"
    print_message $BLUE "  1. 容器重启后,服务将通过 rc.local 自动启动 (无需SSH登录)"
    print_message $BLUE "  2. 后台守护进程每5分钟检查服务状态,自动恢复"
    print_message $BLUE "  3. SSH登录时也会触发启动检查 (多重保障)"
    echo ""
    print_message $CYAN "📝 测试方法:"
    print_message $BLUE "  1. 在AutoDL控制台重启容器"
    print_message $BLUE "  2. 等待 1-2 分钟 (不要SSH登录)"
    print_message $BLUE "  3. 访问 Web 界面检查服务是否运行"
    print_message $BLUE "  4. 或SSH登录后运行: /root/zealman-app/scripts/check-service.sh"
    echo ""
}

# 执行主函数
main "$@"

