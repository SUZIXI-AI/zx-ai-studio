#!/usr/bin/env bash
set -euo pipefail

APP_REPO="${APP_REPO:-https://github.com/SUZIXI-AI/zx-ai-studio.git}"
APP_ROOT="${APP_ROOT:-/root/zealman-app}"
TEMPLATE_ROOT="${TEMPLATE_ROOT:-/root/hyperframes-templates}"
SOURCE_ROOT="${SOURCE_ROOT:-/tmp/zx-ai-studio-release}"

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

if [ ! -d "$SOURCE_ROOT/.git" ]; then
  log "cloning app repo"
  rm -rf "$SOURCE_ROOT"
  git clone "$APP_REPO" "$SOURCE_ROOT"
else
  log "updating app repo"
  git -C "$SOURCE_ROOT" pull --ff-only
fi

if [ -d "$SOURCE_ROOT/runtime/zealman-app" ]; then
  log "installing runtime files to $APP_ROOT"
  rm -rf "$APP_ROOT"
  mkdir -p "$(dirname "$APP_ROOT")"
  cp -a "$SOURCE_ROOT/runtime/zealman-app" "$APP_ROOT"
fi

if [ -d "$SOURCE_ROOT/runtime/hyperframes-templates" ]; then
  log "installing templates to $TEMPLATE_ROOT"
  rm -rf "$TEMPLATE_ROOT"
  cp -a "$SOURCE_ROOT/runtime/hyperframes-templates" "$TEMPLATE_ROOT"
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
