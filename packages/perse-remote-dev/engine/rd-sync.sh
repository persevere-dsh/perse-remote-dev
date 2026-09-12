#!/usr/bin/env bash
# rd-sync.sh — Codex 式远程开发 git 中转引擎（M0，ARCH v0.1）
#
# 拓扑：mac 权威主树 W ⇄ 远端主机镜像 M（agent 唯一可写面），中间放 bare hub H（远端主机上）。
#   W  push approved base → H(rd-base) → M fetch+rebase（在途批次骑在新基线上）
#   M  冻结批次(freeze) → mac 取 batch diff → 审阅 → 批准 → W apply → 再 push-base
# 纯 bash+git、零依赖，可脱离 DSH 运行与验证；DSH 工具（rd_* / spark 批次提交）只是它的薄包装。
#
# 用法：rd-sync.sh <cmd> [args…]
# 通用 env：RD_SSH（远端 ssh 目标，必须显式提供，例如 RD_SSH=<your-host>；无个人默认值）
# 输出约定：机器可读行到 stdout（key=value / json），人读信息到 stderr。远端脚本逐行经 ssh stdin 传 bash -s。
# 引号安全：远端脚本内容由本文件逐行构造；远端变量在远端展开，本地值经 printf %q 嵌入。

set -uo pipefail
RD_SSH="${RD_SSH:-}"
SSH_BASE=(ssh -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=30 -o ServerAliveCountMax=10)

# 把脚本行数组送到远端执行（不经过本地 shell 二次展开）
rd() { # rd <ssh-host> line...   → 远端 bash -s 逐行执行
  local host="$1"; shift
  if [ -z "$host" ]; then
    echo "RD_SSH 未设置：请指定远端 ssh 目标，例如 RD_SSH=<your-host> bash rd-sync.sh <cmd> …" >&2
    exit 2
  fi
  printf '%s\n' "$@" | "${SSH_BASE[@]}" "$host" -- bash -s
}
q() { printf '%s' "$(printf %q "$1")"; }

# ---------- 引导 ----------

# w-init <wdir> <hub-url>     W 接 hub（remote 名 rd-hub）
cmd_w_init() {
  git -C "$1" remote remove rd-hub 2>/dev/null || true
  git -C "$1" remote add rd-hub "$2" >/dev/null
  echo "#W_INIT_OK"
}

# h-init <hub-path>           远端建 bare hub（幂等）
cmd_h_init() {
  local hub="$1"
  rd "$RD_SSH" \
    "mkdir -p $(q "$(dirname "$hub")")" \
    "git init -q --bare $(q "$hub") 2>/dev/null || true" \
    "echo '#H_INIT_OK'"
}

# push-base <wdir>            W HEAD → hub rd-base
cmd_push_base() {
  git -C "$1" push -q rd-hub HEAD:refs/heads/rd-base || { echo "#ERR_PUSH"; exit 30; }
  echo "#PUSH_BASE_OK head=$(git -C "$1" rev-parse HEAD)"
}

# m-init <mdir> <hub-local>   M 建成 hub clone、固定工作分支 rd-agent 并对齐 rd-base（引导用：会重置 M 到基线！）
cmd_m_init() {
  local m="$1" hl="$2"
  rd "$RD_SSH" \
    "if [ ! -d $(q "$m/.git") ]; then mkdir -p $(q "$(dirname "$m")"); git clone -q $(q "$hl") $(q "$m") || exit 9; fi" \
    "git -C $(q "$m") remote remove rd-hub 2>/dev/null || true" \
    "git -C $(q "$m") remote add rd-hub $(q "$hl")" \
    "git -C $(q "$m") config user.name rd-agent" \
    "git -C $(q "$m") config user.email rd-agent@spark.local" \
    "git -C $(q "$m") checkout -q -B rd-agent 2>/dev/null || true" \
    "git -C $(q "$m") fetch -q rd-hub rd-base || exit 10" \
    "git -C $(q "$m") reset -q --hard FETCH_HEAD || exit 11" \
    "echo '#M_INIT_OK'"
}

# ---------- 远端运行 ----------

# freeze <mdir>   提交 M 全部改动为批次提交；输出 head= committed= dirty=
cmd_freeze() {
  local m="$1"
  rd "$RD_SSH" \
    "cd $(q "$m") || exit 5" \
    "git add -A" \
    "git reset -q -- '._*' 2>/dev/null || true" \
    "if git diff --cached --quiet; then" \
    "  head=\$(git rev-parse HEAD); echo \"head=\$head\"; echo committed=false" \
    "else" \
    "  git commit -q -m \"rd batch: \$(date -u +%FT%TZ)\"" \
    "  head=\$(git rev-parse HEAD); echo \"head=\$head\"; echo committed=true" \
    "fi" \
    "echo \"dirty=\$(git status --porcelain | wc -l | tr -d ' ')\""
}

# batch <mdir> <base>   输出基线..HEAD 的 numstat + 完整 unified diff
cmd_batch() {
  local m="$1" base="$2"
  rd "$RD_SSH" \
    "cd $(q "$m") || exit 5" \
    "git cat-file -e $(q "$base")^{commit} 2>/dev/null || { echo '#ERR_BASE_UNKNOWN'; exit 6; }" \
    "head=\$(git rev-parse HEAD)" \
    "echo \"base=$base\"" \
    "echo \"head=\$head\"" \
    "echo '#FILES'" \
    "git diff --no-color --numstat $(q "$base") HEAD" \
    "echo '#DIFF'" \
    "git diff --no-color $(q "$base") HEAD" \
    "echo '#END'"
}

# m-sync <mdir> <hub-local>   M 对齐新批准基线 rd-base：
#   ① 工作树脏 → #ERR_DIRTY_M(46)；② 树与 rd-base 相同 → reset（无损，跳过中间提交回放）；
#   ③ 真有额外在途提交 → rebase；冲突 → exit 42 + 冲突文件清单。
cmd_m_sync() {
  local m="$1" hl="$2"
  rd "$RD_SSH" \
    "cd $(q "$m") || exit 5" \
    "git fetch -q rd-hub rd-base || { echo '#ERR_FETCH'; exit 41; }" \
    "if [ -n \"\$(git status --porcelain)\" ]; then echo '#ERR_DIRTY_M'; exit 46; fi" \
    "if git diff --quiet HEAD FETCH_HEAD; then" \
    "  git reset -q --hard FETCH_HEAD" \
    "else" \
    "  if ! git rebase FETCH_HEAD; then" \
    "    echo '#CONFLICT'" \
    "    git diff --name-only --diff-filter=U" \
    "    exit 42" \
    "  fi" \
    "fi" \
    "head=\$(git rev-parse HEAD)" \
    "echo \"#M_SYNC_OK head=\$head\""
}

# ---------- 本地 W 侧 ----------

# apply <wdir> <patch-file>   git apply 直落到 W（干净树语义）→ 仅提交补丁涉及路径
# 漂移/冲突语义（v0）：任何落盘失败即拒（#ERR_APPLY_CONFLICT），不做自动 3-way 合并。
cmd_apply() {
  local w="$1" patch="$2"
  [ -f "$patch" ] || { echo "#ERR_PATCH_MISSING"; exit 7; }
  local aerr arc
  aerr="$(git -C "$w" apply --whitespace=nowarn "$patch" 2>&1)"; arc=$?
  if [ "$arc" -ne 0 ]; then
    printf '%s\n' "$aerr" | head -8 >&2
    echo "#ERR_APPLY_CONFLICT"; exit 43
  fi
  local paths
  paths=$(git -C "$w" apply --numstat "$patch" 2>/dev/null | awk '{print $3}' | LC_ALL=C sort -u)
  if [ -n "$paths" ]; then
    # shellcheck disable=SC2086
    git -C "$w" add -A -- $paths
  fi
  git -C "$w" commit -q -m "rd-apply: $(basename "$patch")"
  echo "#APPLY_OK head=$(git -C "$w" rev-parse HEAD)"
}

# rollback <wdir> <ref>   W 干净时回滚到某基线（ref=commit）
cmd_rollback() {
  local w="$1" ref="$2"
  if git -C "$w" status --porcelain | grep -q .; then
    echo "#ERR_DIRTY_W"; exit 45
  fi
  git -C "$w" reset -q --hard "$ref" || { echo "#ERR_ROLLBACK"; exit 44; }
  echo "#ROLLBACK_OK head=$(git -C "$w" rev-parse HEAD)"
}

# verify <wdir> <cmd...>   在 W 上跑验证命令（双端验证），rc=命令退出码
cmd_verify() {
  local w="$1"; shift
  ( cd "$w" && "$@" >/dev/null 2>&1 ); local rc=$?
  echo "#VERIFY rc=$rc"
  exit "$rc"
}

# status <wdir> <mdir>   三端状态（W head/branch、rd-base、M head/dirty）——rd_status 的数据面
cmd_status() {
  local w="$1" m="$2"
  echo "w_head=$(git -C "$w" rev-parse HEAD 2>/dev/null || echo '?')"
  echo "w_branch=$(git -C "$w" branch --show-current 2>/dev/null || echo '?')"
  echo "base=$(git -C "$w" ls-remote rd-hub refs/heads/rd-base 2>/dev/null | awk '{print $1}')"
  rd "$RD_SSH" \
    "cd $(q "$m") 2>/dev/null || { echo 'm_head=?'; echo 'm_dirty=?'; exit 0; }" \
    "echo \"m_head=\$(git rev-parse HEAD 2>/dev/null || echo '?')\"" \
    "echo \"m_dirty=\$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')\""
}

# ---------- 分发 ----------
cmd="${1:-}"; shift || true
case "$cmd" in
  w-init)    cmd_w_init "$1" "$2" ;;
  h-init)    cmd_h_init "$1" ;;
  push-base) cmd_push_base "$1" ;;
  m-init)    cmd_m_init "$1" "$2" ;;
  freeze)    cmd_freeze "$1" ;;
  batch)     cmd_batch "$1" "$2" ;;
  m-sync)    cmd_m_sync "$1" "$2" ;;
  apply)     cmd_apply "$1" "$2" ;;
  rollback)  cmd_rollback "$1" "$2" ;;
  verify)    cmd_verify "$@" ;;
  status)    cmd_status "$1" "$2" ;;
  *) echo "usage: rd-sync.sh <w-init|h-init|push-base|m-init|freeze|batch|m-sync|apply|rollback|verify|status>" >&2; exit 2 ;;
esac
