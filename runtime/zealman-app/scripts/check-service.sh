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
