#!/bin/bash
# HyperFrames 运行时初始化（每次客户开机执行）
set -e

RUNTIME_ROOT=/root/autodl-tmp/hyperframes
mkdir -p "$RUNTIME_ROOT"/{jobs,renders,config,logs,assets}

export PUPPETEER_CACHE_DIR=/opt/hyperframes-cache
export HYPERFRAMES_BROWSER_PATH=/opt/hyperframes-cache/manual-131.0.6778.85/chrome-headless-shell-linux64/chrome-headless-shell

echo "[$(date)] HyperFrames runtime initialized" >> "$RUNTIME_ROOT/logs/init.log"
