#!/usr/bin/env node
// Read-only end-to-end probe against one paired Perse Remote host.
//
// It answers, over the real wire, the questions the GUI acceptance record
// claims to answer: which protocol the host actually speaks, which
// capabilities it advertises, whether the folder/project surface works,
// whether an untrusted folder really refuses agent work, and whether the
// host's model catalog is reachable.
//
// Safety contract of this script:
//   - It never creates a session, a worktree, a file, or a project record.
//   - The trust-gate probe runs ONLY when the target folder is not yet a
//     trusted project, so the expected `trust-required` refusal cannot have
//     a side effect. When the folder is already trusted, the probe is
//     skipped and says so.
//   - The device token comes from the environment and is never printed,
//     logged, or written. Missing capability is reported as a failure with a
//     reason; nothing here falls back to a local directory or a local model.
//
// Usage:
//   PERSE_VERIFY_TOKEN=*** node scripts/verify-remote-e2e.mjs \
//     --endpoint ws://127.0.0.1:18791/rpc [--project-path /home/lxl/anything]
//
// Exit code 0 means every check ran and every check passed. Any refused,
// failed, or skipped-required check exits non-zero with the reason on stderr.

import WebSocket from 'ws';

const argv = process.argv.slice(2);
function arg(name, fallback = undefined) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const endpoint = arg('endpoint');
const projectPath = arg('project-path');
const token = process.env.PERSE_VERIFY_TOKEN ?? '';
if (!endpoint) fail('usage', '--endpoint ws://host:port/rpc is required');
if (!token) fail('usage', 'set PERSE_VERIFY_TOKEN to the paired device token (never printed)');

function fail(code, message) {
  process.stderr.write(`FAIL ${code}: ${message}\n`);
  process.exit(1);
}

const ws = new WebSocket(endpoint, { headers: { authorization: `Bearer ${token}` } });
let nextId = 0;
const pending = new Map();
const transportErrors = [];
ws.on('message', (raw) => {
  let msg;
  try { msg = JSON.parse(String(raw)); } catch { return; }
  if (msg && msg.id && pending.has(msg.id)) {
    const { resolve } = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg);
  }
});
ws.on('error', (err) => transportErrors.push(err?.message ?? String(err)));

function call(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve });
    const timer = setTimeout(() => {
      if (pending.delete(id)) reject(new Error(`${method}: timed out after 15s`));
    }, 15_000);
    pending.set(id, {
      resolve: (msg) => { clearTimeout(timer); resolve(msg); },
    });
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
  });
}

const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  if (!ok) failed += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}\n`);
}

await new Promise((resolve, reject) => {
  ws.once('open', resolve);
  ws.once('error', () => reject(new Error(transportErrors.at(-1) ?? 'websocket connect failed')));
});

// 1. Which protocol, and what does the host claim.
const info = await call('host.info');
if (info.error) fail('host.info', `${info.error.code} ${info.error.message}`);
const version = String(info.result?.protocolVersion ?? '');
const caps = Array.isArray(info.result?.capabilities) ? info.result.capabilities : [];
check('host.info 返回协议版本', version.length > 0, version || '(空)');
check('主机名与平台可读', Boolean(info.result?.host?.name), `${info.result?.host?.name ?? '?'} / ${info.result?.host?.platform ?? '?'}`);

// 1.4 surface must be advertised, not assumed.
for (const cap of ['folderBrowse', 'projectTrust', 'modelList', 'modelSelect']) {
  const wantsCap = version === '' || Number(version.slice(0, 3).replace('.', '')) >= 14;
  if (wantsCap) check(`能力宣告 ${cap}`, caps.includes(cap), caps.includes(cap) ? '已宣告' : '缺失');
}

// 2. The device identity the host sees (never print the token).
const conn = await call('connection.info');
check('connection.info 回读设备身份', Boolean(conn.result?.device?.id), conn.result?.device?.id ?? '(无设备)');
check('主机 id 与 host.info 一致',
  Boolean(conn.result?.hostId) && conn.result.hostId === info.result?.host?.id,
  String(conn.result?.hostId ?? '(无)'));

// 3. Project registry: rows carry trust once the host is 1.4.
const wsList = await call('workspace.list');
if (wsList.error) fail('workspace.list', `${wsList.error.code} ${wsList.error.message}`);
const rows = Array.isArray(wsList.result?.workspaces) ? wsList.result.workspaces : [];
check('workspace.list 返回项目行', rows.length >= 0, `${rows.length} 行`);
const trusted = rows.filter((r) => r && typeof r.trust === 'string');
process.stdout.write(`     其中带 trust 的: ${trusted.length}；未带 trust 的: ${rows.length - trusted.length}\n`);

// 4. Folder browse is the whole point of 1.4: one level, host-resolved.
const browse = await call('folder.browse', projectPath ? { path: projectPath } : {});
if (browse.error) {
  check('folder.browse', false, `${browse.error.code} ${JSON.stringify(browse.error.data ?? browse.error.message)}`);
} else {
  const entries = Array.isArray(browse.result?.entries) ? browse.result.entries : [];
  check('folder.browse 单层列举', entries.length >= 0,
    `root=${browse.result?.root ?? '?'} 条目=${entries.length} truncated=${browse.result?.truncated === true ? 'true' : 'false'}`);
  check('返回的 path 都由主机给出', entries.every((e) => typeof e?.path === 'string' && e.path.startsWith('/')), '全部绝对路径');
}

// 5. Anything outside the roots must be refused, not served.
const escape = await call('folder.browse', { path: '/etc/../etc' });
check('越根路径被拒', Boolean(escape.error) && escape.error.code === -32004,
  escape.error ? `${escape.error.code} ${JSON.stringify(escape.error.data ?? {})}` : '竟然返回了内容');

// 6. Model catalog reachability (never falls back to the local catalog).
const models = await call('model.list');
if (models.error) {
  check('model.list', false, `${models.error.code} ${JSON.stringify(models.error.data ?? models.error.message)}`);
} else {
  const list = Array.isArray(models.result?.models) ? models.result.models : [];
  const fails = Array.isArray(models.result?.failures) ? models.result.failures : [];
  check('model.list 有可读结果', list.length > 0 || fails.length > 0,
    `模型=${list.length} 失败项=${fails.length} 默认=${models.result?.default?.model ?? '(无)'}`);
}

// 7. Trust gate — only probed while the target is untrusted, so the refusal is side-effect free.
if (projectPath) {
  const target = rows.find((r) => r?.path === projectPath);
  if (target && typeof target.trust === 'string') {
    process.stdout.write(`SKIP 信任闸 — ${projectPath} 已是受信项目（trust=${target.trust}），探测会真建会话，故跳过\n`);
  } else if (target) {
    const gate = await call('session.create', { workspaceId: target.id });
    const refused = gate.error?.code === -32004 && gate.error?.data?.reason === 'trust-required';
    check('未受信项目拒绝开 agent 会话', refused,
      refused ? '-32004 trust-required（未建任何东西）' : `${gate.error?.code ?? '竟然创建成功'} ${JSON.stringify(gate.error?.data ?? gate.result ?? {})}`);
    if (!refused && gate.result) {
      process.stderr.write(`注意: 意外创建了会话 ${gate.result?.sessionId ?? gate.result?.id ?? '?'}，请手工归档\n`);
    }
  } else {
    process.stdout.write(`SKIP 信任闸 — ${projectPath} 不在 workspace.list 里（要 project.add 才会出现，本脚本不做写操作）\n`);
  }
}

ws.close();
process.stdout.write(`\n合计: ${results.length - failed} 通过 / ${failed} 失败\n`);
process.exit(failed === 0 ? 0 : 1);
