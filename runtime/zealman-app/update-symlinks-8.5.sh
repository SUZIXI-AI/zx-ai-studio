#!/bin/bash

# 将 ComfyUI 期望路径指向 AutoDL 缓存（Hash 目录），并同步用户目录下的工作流 JSON。
# 机制同 update-symlinks-8.x.sh：计数汇总、源缺失跳过、目标已是正确链接跳过、目标为普通文件/目录则跳过不覆盖。

set -e

log_info() {
  echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
  echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
  echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

created_count=0
skipped_count=0
error_count=0
wf_copied=0
wf_skipped=0

# SOURCE：AutoDL 实际路径；TARGET：ComfyUI 侧符号链接路径（ln -s SOURCE TARGET）
link_model() {
  local SOURCE="$1"
  local TARGET="$2"

  if [ ! -e "$SOURCE" ]; then
    log_warn "源文件不存在，跳过: $SOURCE -> $TARGET"
    skipped_count=$((skipped_count + 1))
    return 0
  fi

  mkdir -p "$(dirname "$TARGET")"

  if [ -L "$TARGET" ]; then
    local current_target
    local source_real
    current_target="$(readlink -f "$TARGET" 2>/dev/null || true)"
    source_real="$(readlink -f "$SOURCE" 2>/dev/null || true)"

    if [ "$current_target" = "$source_real" ] && [ -n "$current_target" ] && [ -n "$source_real" ]; then
      log_info "符号链接已存在且正确，跳过: $TARGET"
      skipped_count=$((skipped_count + 1))
    else
      log_info "符号链接指向不同目标，重新创建: $TARGET"
      rm -f "$TARGET"
      if ln -s "$SOURCE" "$TARGET"; then
        log_info "已创建符号链接: $SOURCE -> $TARGET"
        created_count=$((created_count + 1))
      else
        log_error "创建符号链接失败: $SOURCE -> $TARGET"
        error_count=$((error_count + 1))
      fi
    fi
  elif [ -e "$TARGET" ]; then
    log_warn "目标路径已存在但不是符号链接，跳过: $TARGET"
    skipped_count=$((skipped_count + 1))
  else
    if ln -s "$SOURCE" "$TARGET"; then
      log_info "已创建符号链接: $SOURCE -> $TARGET"
      created_count=$((created_count + 1))
    else
      log_error "创建符号链接失败: $SOURCE -> $TARGET"
      error_count=$((error_count + 1))
    fi
  fi
}

# 每项：SOURCE|TARGET（AutoDL hash 完整路径 | ComfyUI 期望路径；路径中含 | 时请改分隔符）
# 示例（添加新行时复制一行修改即可）：
#   "/.autodl/ab/cd/ef/abcdef...hash...|/root/ComfyUI/models/checkpoints/example.safetensors"
declare -a LINK_PAIRS=(
  "/.autodl/0a/d6/14/0ad6142ee6f845949e5eecf71de1bf40|/root/ComfyUI/models/loras/Ltx/ltx2.3-video-restoration-general.safetensors"
  "/.autodl/f7/76/4d/f7764df2e2e5b438baaf718eac8d0c27|/root/ComfyUI/models/loras/Ltx/ltx2.3-ic-watermark-remove-general.safetensors"
  "/.autodl/f5/36/a2/f536a2858e0055b6314883c48c65c45a|/root/ComfyUI/models/loras/Ltx/ltx2.3-ic-video-upscale-general.safetensors"
  "/.autodl/c3/69/64/c369647777098e518c48cbc250e92c29|/root/ComfyUI/models/loras/Ltx/ltx2.3-ic-subtitles-remove-general.safetensors"
  "/.autodl/85/3b/14/853b14e229190880904fe0790b8137ca|/root/ComfyUI/models/loras/Ltx/ltx2.3_upscale_ic-lora_06250.safetensors"
  "/.autodl/63/b2/16/63b216ae9455eb1c19c358eb627fdf65|/root/ComfyUI/models/checkpoints/Qwen-Rapid-AIO-NSFW-v19.safetensors"
)

total_planned=${#LINK_PAIRS[@]}

for pair in "${LINK_PAIRS[@]}"; do
  IFS='|' read -r SOURCE TARGET <<<"$pair"
  link_model "$SOURCE" "$TARGET"
done

# --- 工作流 JSON：复制到 ComfyUI user workflows 子目录 ---
# 填写 AutoDL 上工作流 JSON 绝对路径与 ComfyUI 目标目录；留空则跳过复制。
WORKFLOW_JSON_SRC=""
WORKFLOW_JSON_DIR=""

if [ -z "$WORKFLOW_JSON_SRC" ]; then
  log_info "未配置工作流（WORKFLOW_JSON_SRC 为空），跳过工作流复制"
  wf_skipped=$((wf_skipped + 1))
elif [ -z "$WORKFLOW_JSON_DIR" ]; then
  log_warn "已设置 WORKFLOW_JSON_SRC 但 WORKFLOW_JSON_DIR 为空，跳过工作流复制"
  wf_skipped=$((wf_skipped + 1))
elif [ ! -f "$WORKFLOW_JSON_SRC" ]; then
  log_warn "工作流源文件不存在，跳过: $WORKFLOW_JSON_SRC"
  wf_skipped=$((wf_skipped + 1))
else
  mkdir -p "$WORKFLOW_JSON_DIR"
  if cp -f "$WORKFLOW_JSON_SRC" "$WORKFLOW_JSON_DIR/"; then
    log_info "已复制工作流: ${WORKFLOW_JSON_SRC} -> ${WORKFLOW_JSON_DIR}/$(basename "$WORKFLOW_JSON_SRC")"
    wf_copied=$((wf_copied + 1))
  else
    log_error "复制工作流失败: $WORKFLOW_JSON_SRC -> $WORKFLOW_JSON_DIR/"
    error_count=$((error_count + 1))
  fi
fi

log_info "符号链接更新完成（本次符号链接配置 ${total_planned} 条）"
log_info "创建: ${created_count} 个"
log_info "跳过: ${skipped_count} 个"
log_info "错误: ${error_count} 个"
log_info "工作流复制 — 成功: ${wf_copied} 个，跳过: ${wf_skipped} 个"

echo "[INFO] update-symlinks-8.5.sh 完成"
if [ "$error_count" -gt 0 ]; then
  exit 1
else
  exit 0
fi
