#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/root/zealman-app}"
COMFY_ROOT="${COMFY_ROOT:-/root/ComfyUI}"
PYTHON_BIN="${PYTHON_BIN:-/root/miniconda3/bin/python}"
COMFY_HOST="${COMFY_HOST:-127.0.0.1}"
COMFY_PORT="${COMFY_PORT:-6006}"
WEB_PORT="${WEB_PORT:-6008}"
WULI_PORT="${WULI_PORT:-6010}"

log() {
  printf '[ZX AI Studio] %s\n' "$*"
}

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k -n tcp "$port" >/dev/null 2>&1 || true
  fi
}

wait_http() {
  local name="$1"
  local url="$2"
  local max="${3:-60}"
  local i code
  for i in $(seq 1 "$max"); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)"
    if [ "$code" = "200" ]; then
      log "$name ready: $url"
      return 0
    fi
    sleep 1
  done
  log "$name did not become ready: $url"
  return 1
}

init_runtime_dirs() {
  mkdir -p /root/autodl-tmp/hyperframes/jobs
  mkdir -p /root/autodl-tmp/hyperframes/renders
  mkdir -p /root/autodl-tmp/hyperframes/assets
  mkdir -p /root/autodl-tmp/hyperframes/logs
  mkdir -p /root/autodl-tmp/hyperframes/config

  if [ ! -f /root/autodl-tmp/hyperframes/config/api-keys.json ]; then
    cat > /root/autodl-tmp/hyperframes/config/api-keys.json <<'JSON'
{
  "claude_api_key": "",
  "openai_api_key": "",
  "custom_api_key": "",
  "tts_config": {
    "openai_api_key": "",
    "google_api_key": "",
    "minimax_api_key": ""
  }
}
JSON
    chmod 600 /root/autodl-tmp/hyperframes/config/api-keys.json
  fi
}

start_comfyui() {
  if [ ! -f "$COMFY_ROOT/main.py" ]; then
    log "ComfyUI not found at $COMFY_ROOT, skipping ComfyUI startup"
    return 0
  fi
  kill_port "$COMFY_PORT"
  log "starting ComfyUI on ${COMFY_HOST}:${COMFY_PORT}"
  cd "$COMFY_ROOT"
  nohup "$PYTHON_BIN" main.py --listen "$COMFY_HOST" --port "$COMFY_PORT" \
    > /tmp/comfyui-service.log 2>&1 &
}

start_wuli_api() {
  if [ ! -f "$APP_ROOT/Wuli-API/main.py" ]; then
    log "Wuli-API not found, skipping video API startup"
    return 0
  fi
  kill_port "$WULI_PORT"
  log "starting Wuli-API on 127.0.0.1:${WULI_PORT}"
  cd "$APP_ROOT/Wuli-API"
  COMFYUI_INSTANCES="${COMFY_HOST}:${COMFY_PORT}" \
    nohup "$PYTHON_BIN" -m uvicorn main:app --host 127.0.0.1 --port "$WULI_PORT" \
    > /tmp/wuli-api-service.log 2>&1 &
}

start_web() {
  if [ ! -f "$APP_ROOT/server.js" ]; then
    log "server.js not found at $APP_ROOT"
    exit 1
  fi
  if [ ! -d "$APP_ROOT/dist" ]; then
    log "dist directory not found at $APP_ROOT/dist"
    exit 1
  fi
  kill_port "$WEB_PORT"
  log "starting web app on 0.0.0.0:${WEB_PORT}"
  cd "$APP_ROOT"
  PORT="$WEB_PORT" nohup node server.js > /tmp/zealman-web.log 2>&1 &
}

main() {
  log "booting"
  init_runtime_dirs
  start_comfyui
  start_wuli_api
  start_web
  wait_http "Web UI" "http://127.0.0.1:${WEB_PORT}/api/health" 60 || true
  wait_http "Video API" "http://127.0.0.1:${WULI_PORT}/api/hyperframes/templates" 60 || true
  log "done"
  tail -f /tmp/zealman-web.log /tmp/wuli-api-service.log /tmp/comfyui-service.log
}

main "$@"

