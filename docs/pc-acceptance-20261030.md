# PC remote control — end-to-end acceptance record (2026-10-30)

Date: 2026-10-30 (Asia/Shanghai). Scope: one real second machine (`spark-9732`, Linux) paired to a real isolated PC instance on this Mac, over the real wire. This is real-host evidence for the plugin-only line; it is not upstream DSH acceptance and it does not certify the not-yet-built remote folder picker.

## Versions under test

| Component | Version / revision | Verified how |
|---|---|---|
| Host (Perse Remote) | `perse-remote 0.3.1-rc.2`, `protocolVersion 1.4` | `host.info` over the wire |
| PC plugin | `perse-remote-dev 0.3.1-rc.7` | installed profile `package.json` + rendered UI |
| Patched DSH runtime | built from `perse-dsh-native@42aa2bf7` (18 packages refreshed into the isolated runtime) | `perse-native-runtime-refresh.json` |
| Suite state | `npm test` 73/73, `npm run test:pc-ui` 26/26, `npm run pack` exit 0 | independent re-run by the primary agent |

Machines: PC side is an isolated DSH instance (`DSH_HOME=…/native-dsh-home`, profile `native-pc`, its own Chrome profile `/tmp/perse-n09-chrome`). Spark side is a `dsh` install under `~/.local/share/perse-remote-test` with profile `perse-remote-test`, bound to `127.0.0.1` only, reached through an SSH tunnel (`ssh -N -L 18791:127.0.0.1:18791`). The installed Harness app and the operator's own DSH profiles were not modified.

## Acceptance items and their evidence

Window: Chrome PID `84095`, window_id `8801`, 1440×900. Captures below are cua-driver `get_window_state` results; `capture_id` and `snapshot_id` are the driver's own handles for the state the click was taken from.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| A1 | Pairing preview parses locally and shows host identity before any trust | PASS | `/tmp/spark-01-pairing-preview.png` (sha256 `1f0afdb67bcabaae…`): 主机 spark-9732, hostId `252c5c7b-66a5-4ded-8ba8-b268f5447688`, `ws://127.0.0.1:18791/rpc`, local |
| A2 | Saved host shows verified connection | PASS | `/tmp/spark-02-paired.png` (sha256 `bd69cc8c08424289…`): `spark-9732 · 已验证连接 · local` |
| A3 | Host reports 1.4 and advertises the 1.4 surface | PASS | `host.info → protocolVersion: 1.4`, capabilities include `folderBrowse`, `projectTrust`, `modelList`, `modelSelect` |
| A4 | Untrusted folder refuses agent work and creates nothing | PASS | `session.create` on `/home/lxl/workspace/digital-organism` → `-32004 {"method":"session.create","reason":"trust-required"}`; also covered by the probe script (14/0, exit 0) |
| A5 | Explicit trust makes the same folder startable | PASS | `project.add {trust:"workspace-write"}` → `trustSetAt=2026-10-30T09:06:19`, then `session.create` succeeded on the same workspace |
| A6 | Folder browse is host-resolved and fenced | PASS | `folder.browse {}` → `root=/home/lxl`, 74 entries, `truncated=false`; `folder.browse {path:"/etc/../etc"}` → `-32004 outside-roots` |
| A7 | Remote model catalog is read from the host, never locally | PASS | `model.list → 4 models / 0 failures`, default `deepseek-v4-flash`; UI renders the remote model selector: `/tmp/spark-05-remote-session-model-seat.png` (sha256 `6be7f6cb1f70a8e9…`), header `anything 远程 · spark-9732` |
| A8 | Stored hosts are listed even when offline, with the right row action | PASS | `/tmp/rc7-02-both-offline-with-reconnect.png` (sha256 `2973dce546e5960a…`), capture `…_0000000000000064`, snapshot `s000000d1`: rows `lxldeMac-mini.local · PC phase4 validation · 离线` + `重连`, `spark-9732 · spark 真机 · 离线` + `重连` |
| A9 | Both states coexist, and the connected host shows its projects | PASS | `/tmp/rc7-01-two-hosts-two-states.png` (sha256 `f9993f54a19bc405…`), capture `…_0000000000000068`, snapshot `s000000d5`: one row offline + `重连`, one row green with `anything · 45 个会话 ⊕` and `digital-organism · 7 个会话 ⊕` |
| A10 | A host whose intent is `connected` comes back by itself after a restart | PASS | Fresh instance (new PID, new port): stored `status: connected / desiredState: connected` for both hosts, protocols mixed (1.2 mac-mini, 1.4 spark), no manual click. Spark returned on its own once its transport came back |
| A11 | Remote group lives in the workspace region, not the sidebar footer | PASS (structural) | Rows render after the local workspace rows, inside the core's `sidebar.workspaces.secondary` section; `连接设置` stays reachable from inside the group. Note: with a short local tree the visual delta is small — placement inside the region is what is certified, not a specific pixel height |

## Re-verification (repeatable, read-only)

```sh
PERSE_VERIFY_TOKEN=<paired device token> npm run verify:remote-e2e -- \
  --endpoint ws://127.0.0.1:18791/rpc \
  --project-path /home/lxl/workspace/digital-organism
```

Recorded result on 2026-10-30: **14 通过 / 0 失败, exit 0** (output in `/tmp/e2e-spark.txt`). The script never creates a session, project, worktree, or file; the trust-gate probe runs only while the target is untrusted so its expected refusal cannot have a side effect, and it says so when it skips. The token is read from the environment and is never printed.

## Known gaps at record time

1. **Remote folder picker (007 P4) is not built.** `folder.browse` / `folder.create` / `project.add` work on the host; the PC UI still has no picker that targets a remote host, which needs a small generic "picker target" seam in core first.
2. **Open-dropdown screenshot not captured.** Chromium exposes this app's session rows and the model `<select>` only partially in the accessibility tree (no element token), and typed browser attachment is refused without `--grant existing-profile`. The positive state (selector rendered with remote models) is certified by A7; the expanded list is not.
3. Operator's own gateway on `127.0.0.1:8787` was left untouched by this work. It answered `health 200` at 16:2x after the rollback of the accidental rc.1 install, and had no listening process when checked at 20:39; this record does not explain that and no action here stopped it.

## Recovery notes

- The SSH tunnel used for these runs (`ServerAliveInterval=20`) was closed by the remote host after ~2h (`exit 255`, `Connection to ohmyllm.deslord.xyz closed by remote host`). Cause not established: `sshd -T` yields no usable output for a non-root caller, so neither an idle timeout nor an intermediate NAT can be blamed with evidence. Re-established with `ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4`, then `127.0.0.1:18791/health → 200` at 20:29.
- `pkill -f "perse-remote-test"`-style matching self-matches the caller's own ssh command line. Stop processes by PID.
- Two `pgrep -f "perse-remote-test --no-open"` matches can include the caller's own ssh line; `ss -ltnp` proved a single listener (PID `810260`) on `127.0.0.1:18791`.

## Addendum (2026-10-31): the hidden-page gap found on this build, and its fix

Observed on a page left open since the 2026-10-30 runs: both stored hosts read 离线 · 重连 while the host behind the tunnel was alive (`health 200`) and both stored intents were still `connected`.

The first explanation written here — Chrome freezing timers in a hidden tab — was **wrong**, and the record is corrected because it was tested rather than assumed. Reproduced on `0.3.1-rc.8` in a visible tab: the tunnel was closed at 14:47, restored at 14:48, and the row still read 离线 two minutes later, with no attempt. An explicit click on the row's 重连 (`s000000e1:31`, status `connected` 1.27s later) proved the whole connect path is healthy and fast, so what was missing was not a timer — the retry was never armed. Cause: the loss of a live link was only recognized when a call failed (connection status `error`). A page that simply sits idle never fails a call, so a host-side socket death — the normal case — left the client holding a stale "connected" snapshot, and that same stale snapshot made the healthy path stop any backoff.

Two rules were added, contract first: a profile row that said `connected` for a generation and then reads `offline` is itself the loss trigger (the transition, so a just-paired saved row that never said connected cannot be mistaken for a loss); and an attempt is no longer cancelled as "already connected" while the host says the profile is offline. The visibility rule added the same morning stays — a resume runs a waiting attempt — but it is a convenience on top of the above, not the fix.

Fix, in `0.3.1-rc.8` (commit `67f1d5f`): the contract states the hidden-page rule, and the integration runs every pending attempt when the page becomes visible again, without resetting the ladder and without bypassing the intent re-read. Two tests added (73 → 75, exit 0): a hidden resume attempts nothing, a visible resume runs the waiting attempt inside the smallest backoff step; `test:pc-ui` unchanged at 26/26.

Live re-verification of `0.3.1-rc.8` on a fresh process (instance `http://127.0.0.1:59603`, new token, same isolated profile and Chrome window `8801`): stored state came back `spark-9732 status=connected protocol=1.4` with no manual click, `lxldeMac-mini.local status=offline` with intent `connected` (its gateway really is down). Screenshot `/tmp/rc8-01-two-states-fresh-process.png` (sha256 `323ad82470ecd4ff…`) shows both row states together, with the online host's two projects and per-project new-session controls.

Interaction limit found the same morning: coordinate clicks were dispatched to window `8801` and changed nothing (the screenshot hash was bit-for-bit identical before and after two clicks). When the isolated Chrome window is not the frontmost window, pointer events land elsewhere; raising it steals the operator's focus, so the attempt was stopped rather than escalated.
