#!/usr/bin/env bash
set -euo pipefail

APP_REPO="${APP_REPO:-https://github.com/SUZIXI-AI/zx-ai-studio.git}"
APP_ROOT="${APP_ROOT:-/root/zealman-app}"

log() {
  printf '[ZX AI Studio installer] %s\n' "$*"
}

if ! command -v git >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git
fi

if ! command -v node >/dev/null 2>&1; then
  log "Node.js is not installed. Please install Node.js 20+ or use the project install-nodejs script."
fi

if [ ! -d "$APP_ROOT/.git" ]; then
  log "cloning app repo"
  rm -rf "$APP_ROOT"
  git clone "$APP_REPO" "$APP_ROOT"
else
  log "updating app repo"
  git -C "$APP_ROOT" pull --ff-only
fi

cd "$APP_ROOT"
if [ -f package-lock.json ]; then
  npm ci --omit=dev || npm install --omit=dev
elif [ -f package.json ]; then
  npm install --omit=dev
fi

mkdir -p /root/autodl-tmp/hyperframes/jobs
mkdir -p /root/autodl-tmp/hyperframes/renders
mkdir -p /root/autodl-tmp/hyperframes/assets
mkdir -p /root/autodl-tmp/hyperframes/logs
mkdir -p /root/autodl-tmp/hyperframes/config

chmod +x "$APP_ROOT/scripts/autodl-start.sh"
log "installed. Start with: bash $APP_ROOT/scripts/autodl-start.sh"

