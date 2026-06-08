#!/bin/bash
# ZX AI Studio 开机自动启动脚本（优化版）
# 针对开机冷启动场景精简，跳过不必要的版本检查和进程清理

set -e

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

LOG_FILE="/tmp/zealman-app-improved-autostart.log"
LOCK_FILE="/tmp/zealman-app-improved-autostart.lock"
PYTHON_BIN="/root/miniconda3/bin/python"
COMFYUI_INSTANCES="${COMFYUI_INSTANCES:-127.0.0.1:6006}"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $1" | tee -a "$LOG_FILE"
}

# ── 防重入 ──
if [ -f "$LOCK_FILE" ]; then
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
    if [ -n "$lock_pid" ] && kill -0 "$lock_pid" 2>/dev/null; then
        log "🔒 启动脚本已在运行 (PID: $lock_pid)，跳过"
        exit 0
    fi
    rm -f "$LOCK_FILE"
fi
echo $$ > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT INT TERM

# HyperFrames runtime init: creates /root/autodl-tmp/hyperframes on every boot.
if [ -x /root/zealman-app/scripts/init-hyperframes.sh ]; then
    /root/zealman-app/scripts/init-hyperframes.sh >> "$LOG_FILE" 2>&1 || log "[WARN] HyperFrames runtime init failed"
fi

# ── 检查现有服务 ──
panel_running=false
if curl -s -o /dev/null --max-time 1 http://127.0.0.1:6008/api/health 2>/dev/null; then
    panel_running=true
fi

wuli_running=false
if curl -s -o /dev/null --max-time 1 http://127.0.0.1:6010/api/hyperframes/templates 2>/dev/null; then
    wuli_running=true
fi

if [ "$panel_running" = true ] && [ "$wuli_running" = true ]; then
    log "✅ 主面板和一键成片后端均已运行"
    exit 0
fi

# ── 基本检查 ──
cd /root/zealman-app

if ! command -v node >/dev/null 2>&1; then
    log "❌ Node.js 未找到，尝试安装..."
    if [ -f scripts/install-nodejs.sh ]; then
        bash scripts/install-nodejs.sh >> "$LOG_FILE" 2>&1
        export PATH="/usr/local/bin:$PATH"
    else
        log "❌ 无法安装 Node.js，退出"
        exit 1
    fi
fi

if [ ! -f dist/index.html ]; then
    log "❌ 缺少构建产物 dist/index.html，退出"
    exit 1
fi

# ── 清理残留端口占用（开机一般无残留，快速跳过） ──
# 优先用 ss（iproute2 内置，无需 lsof 扫描全部 fd，更快）。
if [ "$panel_running" != true ]; then
    PIDS=""
    if command -v ss >/dev/null 2>&1; then
        PIDS=$(ss -tlnpH 2>/dev/null | awk '/:6008 /{print}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
    fi
    if [ -z "$PIDS" ] && command -v lsof >/dev/null 2>&1; then
        PIDS=$(lsof -t -i:6008 -sTCP:LISTEN 2>/dev/null || true)
    fi
    if [ -n "$PIDS" ]; then
        log "⚠️ 端口 6008 仍被占用，清理 PID: $PIDS"
        echo "$PIDS" | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi
fi

# ── 启动一键成片后端服务（Wuli-API/6010） ──
if [ "$wuli_running" != true ]; then
    if [ ! -x "$PYTHON_BIN" ]; then
        log "❌ 找不到 Python 解释器: $PYTHON_BIN"
        exit 1
    fi

    WULI_PIDS=""
    if command -v ss >/dev/null 2>&1; then
        WULI_PIDS=$(ss -tlnpH 2>/dev/null | awk '/:6010 /{print}' | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u || true)
    fi
    if [ -z "$WULI_PIDS" ] && command -v lsof >/dev/null 2>&1; then
        WULI_PIDS=$(lsof -t -i:6010 -sTCP:LISTEN 2>/dev/null || true)
    fi
    if [ -n "$WULI_PIDS" ]; then
        log "⚠️ 端口 6010 仍被占用，清理 PID: $WULI_PIDS"
        echo "$WULI_PIDS" | xargs -r kill -9 2>/dev/null || true
        sleep 1
    fi

    cd /root/zealman-app/Wuli-API
    log "🚀 启动 Wuli-API 6010 ..."
    COMFYUI_INSTANCES="$COMFYUI_INSTANCES" nohup "$PYTHON_BIN" -m uvicorn main:app --host 127.0.0.1 --port 6010 </dev/null > /tmp/wuli-api-service.log 2>&1 &
    WULI_PID=$!
    log "📌 一键成片后端 PID: $WULI_PID"
else
    log "✅ 一键成片后端已在运行"
fi

# ── 启动主面板服务 ──
cd /root/zealman-app
if [ "$panel_running" != true ]; then
    log "🚀 启动 node server.js ..."
    nohup node server.js > /tmp/merged-service.log 2>&1 &
    SERVICE_PID=$!
    log "📌 主面板 PID: $SERVICE_PID"
else
    log "✅ 主面板已在运行"
fi

# ── 健康检查（最多约 40 秒） ──
# 节奏：前 3s 每 0.2s 探测；3~8s 每 0.5s 探测；之后每 1s 探测。
# 这样在快路径（vite 移除后 panel 在 ~4-6s 就绪）下，脚本能近乎"瞬时"退出。
start_ts=$(date +%s%N)
for i in $(seq 1 80); do
    panel_ok=false
    wuli_ok=false
    if curl -s -o /dev/null --max-time 1 http://127.0.0.1:6008/api/health 2>/dev/null; then
        panel_ok=true
    fi
    if curl -s -o /dev/null --max-time 2 http://127.0.0.1:6010/api/hyperframes/templates 2>/dev/null; then
        wuli_ok=true
    fi
    if [ "$panel_ok" = true ] && [ "$wuli_ok" = true ]; then
        elapsed_ms=$(( ( $(date +%s%N) - start_ts ) / 1000000 ))
        log "✅ 主面板和一键成片后端启动成功（${elapsed_ms}ms / poll=${i}）"
        exit 0
    fi
    if [ "$i" -le 15 ]; then
        sleep 0.2
    elif [ "$i" -le 25 ]; then
        sleep 0.5
    else
        sleep 1
    fi
done

log "❌ 服务启动超时，panel_ok=${panel_ok:-false}, wuli_ok=${wuli_ok:-false}"
log "   主面板日志: tail -f /tmp/merged-service.log"
log "   一键成片后端日志: tail -f /tmp/wuli-api-service.log"
exit 1
