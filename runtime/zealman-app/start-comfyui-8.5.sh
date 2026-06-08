#!/bin/bash
# ============================================================
# 重要：修改说明
# ------------------------------------------------------------
# /root/zealman-app/start-comfyui.sh 是符号链接，指向：
#   /.autodl/users/9/98101/start-comfyui-8.x.sh（外部只读文件）
#
# 该外部文件由管理员统一管理，用于跨镜像推送启动脚本更新。
#
# 如需修改启动脚本，请：
#   1. 修改本文件：/root/zealman-app/start-comfyui-8.x.sh
#   2. 通知管理员将本文件内容替换到外部文件：
#      /.autodl/users/9/98101/start-comfyui-8.x.sh
#   3. 管理员更新后，符号链接自动生效，无需其他操作
#
# 请勿直接修改 start-comfyui-8.x.sh（只读符号链接）
# ============================================================
# ComfyUI 启动脚本 (适用于 ComfyUI 0.18.X 以上，自动探测 CUDA 运行库)

set -e

# 日志函数
log_info() {
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_warn() {
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# ── 环境变量（静态，无需运行时解析） ──
export PATH="/usr/local/bin:/root/miniconda3/bin:$PATH"

if [ "${OMP_NUM_THREADS}" = "0" ]; then
    export OMP_NUM_THREADS=1
    log_info "修复 OMP_NUM_THREADS: 0 -> 1"
fi

export NUMBA_THREADING_LAYER=workqueue
export NO_ALBUMENTATIONS_UPDATE=1

# ── 代理检测（精简版：镜像内 lsof 必定存在，省去 fallback） ──
CLASH_SERVICE_RUNNING=false
set +e
if lsof -Pi :7890 -sTCP:LISTEN -t >/dev/null 2>&1 || lsof -Pi :7891 -sTCP:LISTEN -t >/dev/null 2>&1; then
    CLASH_SERVICE_RUNNING=true
    log_info "检测到代理端口正在监听（7890 或 7891）"
elif pgrep -f "mihomo|clash" >/dev/null 2>&1; then
    CLASH_SERVICE_RUNNING=true
    log_info "检测到代理进程正在运行"
fi
set -e

# 处理代理环境变量
CURRENT_PROXY="${http_proxy:-${HTTP_PROXY}}"
IS_LOCAL_PROXY=false
[[ "$CURRENT_PROXY" == *"127.0.0.1"* || "$CURRENT_PROXY" == *"localhost"* ]] && IS_LOCAL_PROXY=true

if [ -n "$CURRENT_PROXY" ]; then
    if [ "$IS_LOCAL_PROXY" = "true" ] && [ "$CLASH_SERVICE_RUNNING" = "false" ]; then
        log_warn "本地代理环境变量已设但服务未运行，清理以防连接错误..."
        unset http_proxy HTTP_PROXY https_proxy HTTPS_PROXY all_proxy ALL_PROXY
    else
        log_info "使用代理: $CURRENT_PROXY"
    fi
elif [ "$CLASH_SERVICE_RUNNING" = "true" ]; then
    PROXY_URL="http://127.0.0.1:7890"
    export http_proxy="$PROXY_URL" HTTP_PROXY="$PROXY_URL"
    export https_proxy="$PROXY_URL" HTTPS_PROXY="$PROXY_URL"
    export all_proxy="socks5h://127.0.0.1:7890" ALL_PROXY="socks5h://127.0.0.1:7890"
    log_info "代理服务运行中，已自动设置: $PROXY_URL"
else
    log_info "未检测到代理服务或代理环境变量"
fi

# 统一设置 no_proxy
if [[ -z "$no_proxy" ]] && [[ -z "$NO_PROXY" ]]; then
    export no_proxy="localhost,127.0.0.1,::1"
    export NO_PROXY="$no_proxy"
fi

# ── LD_LIBRARY_PATH（用一次 Python 调用替代两次） ──
CONDA_PREFIX="/root/miniconda3"
PYTHON_BIN="${CONDA_PREFIX}/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
    log_error "Python 未找到: $PYTHON_BIN"
    exit 1
fi

# 缓存文件：避免每次启动都冷启动 Python 解析路径
LD_CACHE="/tmp/.comfyui-ld-cache"
if [ -f "$LD_CACHE" ]; then
    EXTRA_LD=$(cat "$LD_CACHE")
    log_info "从缓存加载 LD_LIBRARY_PATH"
else
    # 单次 Python 调用同时获取 site-packages 和 nvidia lib 目录
    EXTRA_LD=$("$PYTHON_BIN" -c "
import site, glob, os
sp = site.getsitepackages()[0]
parts = ['${CONDA_PREFIX}/lib']
nv = [p for p in glob.glob(os.path.join(sp, 'nvidia', '*', 'lib')) if os.path.isdir(p)]
if nv: parts.append(':'.join(sorted(nv)))
llama = os.path.join(sp, 'llama_cpp', 'lib')
if os.path.isdir(llama): parts.append(llama)
print(':'.join(parts))
" 2>/dev/null || echo "${CONDA_PREFIX}/lib")
    echo "$EXTRA_LD" > "$LD_CACHE"
    log_info "已解析并缓存 LD_LIBRARY_PATH"
fi

if [ -z "$LD_LIBRARY_PATH" ]; then
    export LD_LIBRARY_PATH="$EXTRA_LD"
else
    export LD_LIBRARY_PATH="$EXTRA_LD:$LD_LIBRARY_PATH"
fi
log_info "LD_LIBRARY_PATH: $LD_LIBRARY_PATH"

# ── 检查 ComfyUI 目录 ──
cd /root/ComfyUI || { log_error "无法进入 ComfyUI 目录"; exit 1; }

if [ ! -f "main.py" ]; then
    log_error "main.py 文件不存在"
    exit 1
fi

# 清理 Jupyter 检查点
rm -rf custom_nodes/.ipynb_checkpoints 2>/dev/null || true

# ── 更新模型符号链接 ──
if [ -f "/root/zealman-app/update-symlinks.sh" ]; then
    log_info "更新模型符号链接..."
    set +e
    OLD_LD_LIBRARY_PATH="$LD_LIBRARY_PATH"
    export LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH#/root/miniconda3/lib:}"
    bash /root/zealman-app/update-symlinks.sh 2>&1 | grep -v "no version information available" || true
    SYMLINK_EXIT_CODE=${PIPESTATUS[0]}
    export LD_LIBRARY_PATH="$OLD_LD_LIBRARY_PATH"
    set -e
    if [ $SYMLINK_EXIT_CODE -eq 0 ]; then
        log_info "模型符号链接更新完成"
    else
        log_warn "模型符号链接更新出错，继续启动"
    fi
fi

# ── 端口清理（按需等待） ──
PORT=6006
set +e
PORT_PIDS=$(lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null)
set -e

if [ -n "$PORT_PIDS" ]; then
    log_warn "端口 $PORT 被占用，终止占用进程..."
    echo "$PORT_PIDS" | xargs kill -9 2>/dev/null || true
    # 等待端口释放，最多 3s
    for i in 1 2 3; do
        if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
fi

# ── 启动 ComfyUI ──
log_info "启动 ComfyUI（端口 $PORT）..."
set +e
/root/miniconda3/bin/python main.py --port $PORT --listen 127.0.0.1 --enable-cors-header "*"
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -ne 0 ]; then
    log_error "ComfyUI 启动失败，退出码: $EXIT_CODE"
    exit $EXIT_CODE
fi
