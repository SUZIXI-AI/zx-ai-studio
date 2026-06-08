#!/bin/bash
# Zealman-AutoDL 后台守护进程
# 持续监控服务状态,自动重启
# 自适应节奏：刚拉起失败后 60s 内快速重试，稳定运行后回退到 5min 检查。

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

LOG_FILE="/tmp/zealman-daemon.log"

echo "$(date): 守护进程启动" >> "$LOG_FILE"

consecutive_fail=0

while true; do
    # 只守护主面板（端口 6008）。画布服务默认不开机启动，由用户点击"画布"时按需拉起。
    if curl -s -o /dev/null --max-time 2 http://127.0.0.1:6008/api/health 2>/dev/null; then
        consecutive_fail=0
        sleep 300
    else
        consecutive_fail=$((consecutive_fail + 1))
        echo "$(date): 主面板未运行（连续失败 ${consecutive_fail} 次）,尝试启动..." >> "$LOG_FILE"
        /root/zealman-app/scripts/improved-autostart.sh >> "$LOG_FILE" 2>&1
        # 前 3 次失败 60s 后再试；之后回退到 5min。
        if [ "$consecutive_fail" -le 3 ]; then
            sleep 60
        else
            sleep 300
        fi
    fi
done
