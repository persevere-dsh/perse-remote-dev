/**
 * Code-discriminated failure copy.
 *
 * Every branch keys on `error.code` — never on `instanceof`, never on message
 * text. The vocabulary is the host package's 26
 * domain codes plus the three protocol carrier codes; an unknown code is shown
 * verbatim so a newer host cannot be silently mislabelled.
 */
import type { Failure } from './model.ts'

/** Read one string field out of an untyped `details` bag. */
function detailString(details: unknown, key: string): string {
  if (typeof details !== 'object' || details === null) return ''
  const value = (details as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

/** Read one string-array field out of an untyped `details` bag. */
function detailList(details: unknown, key: string): readonly string[] {
  if (typeof details !== 'object' || details === null) return []
  const value = (details as Record<string, unknown>)[key]
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

/**
 * Whether re-reading the host can plausibly recover from this failure.
 *
 * `location-mismatch` is the documented case: the host signs every path with a
 * per-instance random key, so a profile restart or a stale listing invalidates
 * the proof. Re-listing issues a fresh one — it must not surface as a fatal
 * error.
 * @param code - the Remote failure code.
 * @returns true when a re-list + retry is the right recovery.
 */
export function isRecoverable(code: string): boolean {
  return code === 'remote-dev/location-mismatch'
}

/**
 * Human copy for one Remote failure.
 * @param failure - flattened Remote failure.
 * @returns product-visible message.
 */
export function failureText(failure: Failure): string {
  const { code, message, details } = failure
  switch (code) {
    case 'remote-dev/target-unknown':
      return `未知主机 ${detailString(details, 'hostId') || '（未提供）'}：请先在「设置 › 远程开发」添加，或检查 ~/.ssh/config 别名。`
    case 'remote-dev/target-not-remote':
      return `该操作需要 ssh 主机，但收到的是本机（${detailString(details, 'hostId') || 'local'}）。`
    case 'remote-dev/ssh-unreachable':
      return `ssh 无法连接到 ${detailString(details, 'hostId')}：${detailString(details, 'stderr') || message}`
    case 'remote-dev/remote-dsh-down':
      return `已连上 ${detailString(details, 'hostId')}，但远端 DSH（端口 ${detailString(details, 'port')}）没有在监听。`
    case 'remote-dev/tunnel-failed':
      return `隧道建立失败（${detailString(details, 'hostId')}）：${detailString(details, 'stderr') || message}`
    case 'remote-dev/tunnel-port-exhausted':
      return `本地端口已用尽（${detailString(details, 'from')}–${detailString(details, 'to')}）。`
    case 'remote-dev/tunnel-not-found':
      return `${detailString(details, 'hostId')} 上没有活动隧道。`
    case 'remote-dev/token-unavailable': {
      const url = detailString(details, 'url')
      return `未取得远端访问令牌：${detailString(details, 'reason') || message}${url === '' ? '' : `　降级地址：${url}`}`
    }
    case 'remote-dev/location-invalid':
      return `路径不合法：${detailString(details, 'path')}`
    case 'remote-dev/location-mismatch':
      return `目录身份凭证已失效（主机 ${detailString(details, 'hostId')} / ${detailString(details, 'path')}）：已重新读取目录，请再试一次。`
    case 'remote-dev/name-invalid':
      return `目录名不合法：${detailString(details, 'name')}`
    case 'remote-dev/directory-exists':
      return `目录已存在：${detailString(details, 'path')}`
    case 'remote-dev/directory-unreadable':
      return `目录不可访问：${detailString(details, 'path')}（${detailString(details, 'reason') || message}）`
    case 'remote-dev/list-failed':
      return `列举目录失败（${detailString(details, 'hostId')}，exit ${detailString(details, 'code')}）：${detailString(details, 'stderr')}`
    case 'remote-dev/mkdir-failed':
      return `创建目录失败：${detailString(details, 'path')}（${detailString(details, 'reason') || message}）`
    case 'remote-dev/settings-unavailable':
      return '宿主 settings 服务不可用，配置面无法读写。'
    case 'remote-dev/config-invalid':
      return `配置校验未通过：${detailList(details, 'problems').join('；') || message}`
    case 'remote-dev/review-target-missing':
      return `审查回路未就绪，缺少：${detailList(details, 'missing').join('、')}`
    case 'remote-dev/engine-unconfigured':
      return '未配置 rd-core 引擎路径（enginePath）。'
    case 'remote-dev/engine-failed':
      return `引擎步骤 ${detailString(details, 'step')} 失败（exit ${detailString(details, 'code')}）：${detailString(details, 'output').slice(0, 200)}`
    case 'remote-dev/base-missing':
      return `汇总仓库 ${detailString(details, 'hub')} 上没有 rd-base。`
    case 'remote-dev/files-empty':
      return '未选择任何文件。'
    case 'remote-dev/files-unchanged':
      return `所选文件在当前批次里没有改动：${detailList(details, 'files').join('、')}`
    case 'remote-dev/patch-empty':
      return '裁剪后补丁为空。'
    case 'remote-dev/comment-empty':
      return '拒绝需要填写拒因。'
    case 'remote-dev/ref-missing':
      return '回滚缺少 ref。'
    case 'gateway/bad-request':
      return `请求未通过宿主校验：${message}`
    case 'gateway/cancelled':
      return '调用已取消。'
    case 'gateway/internal':
      return `宿主内部错误：${message}`
    default:
      return `${code}: ${message}`
  }
}
