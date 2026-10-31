/** Theme-token styles for the plugin-owned remote host/project/session group.
 *
 * Height contract: `.pcRemoteRoot` is the bounded root — `max-height: 42vh`
 * with `.pcRemoteList` as its own scroll area — because the core's
 * `sidebar.workspaces.secondary` wrapper is `flex: none` under the local
 * tree and guarantees nothing about contribution height. An uncapped group
 * would squeeze the tree; 42vh keeps at least ~58% of the sidebar with the
 * tree and scrolls the host list instead of growing.
 */
export const REMOTE_NAV_CSS = [
  '.pcRemoteRoot{box-sizing:border-box;display:flex;min-width:0;flex:0 1 auto;flex-direction:column;max-height:42vh;overflow:hidden;color:var(--dsw-alias-label-primary);font:12px/1.45 system-ui,-apple-system,sans-serif}',
  '.pcRemoteChevron{flex:0 0 auto;transition:transform .12s ease}.pcRemoteChevronOpen{flex:0 0 auto;transform:rotate(90deg);transition:transform .12s ease}',
  '.pcRemoteHeader,.pcRemoteHostButton,.pcRemoteWorkspaceButton,.pcRemoteSession,.pcRemoteSessionSelected{box-sizing:border-box;min-width:0;width:100%;display:flex;align-items:center;border:0;background:transparent;text-align:left}',
  '.pcRemoteHeader{gap:4px;height:26px;padding:0 4px 0 2px}',
  '.pcRemoteTitle{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:5px;padding:0;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:600 11px/20px inherit;text-align:left;cursor:pointer}',
  '.pcRemoteManage,.pcRemoteNew,.pcRemoteAction{display:inline-flex;align-items:center;justify-content:center;gap:4px;flex:0 0 auto;border:0;border-radius:var(--dsw-radius-sm,6px);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;padding:2px 5px;font:inherit}',
  '.pcRemoteManage{font-size:11px}.pcRemoteNew{height:22px;width:22px;padding:0}',
  '.pcRemoteAction{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;padding:2px 6px}',
  '.pcRemoteTitle:hover,.pcRemoteManage:hover,.pcRemoteNew:hover,.pcRemoteAction:hover,.pcRemoteHostButton:hover,.pcRemoteWorkspaceButton:hover,.pcRemoteSession:hover{background:var(--dsw-alias-interactive-bg-hover)}',
  '.pcRemoteHostRow{display:flex;align-items:center;gap:2px;min-width:0}',
  '.pcRemoteHostRow>.pcRemoteHostButton{flex:1 1 auto;width:auto}',
  '.pcRemoteHostButton{height:28px;gap:5px;padding:0 4px;border-radius:var(--dsw-radius-sm,6px);color:var(--dsw-alias-label-secondary);cursor:pointer}',
  '.pcRemoteHostName{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.pcRemoteStatus{flex:0 0 auto;color:var(--dsw-alias-label-tertiary);font-size:11px}',
  // The connected marker: a solid green dot. The state word stays in the
  // row's aria-label; the visible marker is the dot itself.
  '.pcRemoteDot{flex:0 0 auto;width:8px;height:8px;margin:0 4px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}',
  '.pcRemoteList{display:flex;min-height:0;flex-direction:column;overflow-y:auto;padding-left:10px}',
  '.pcRemoteWorkspaceButton{gap:5px;min-height:26px;padding:0 4px;border-radius:var(--dsw-radius-sm,6px);color:var(--dsw-alias-label-secondary);cursor:pointer}',
  '.pcRemoteWorkspaceRow{display:flex;align-items:center;gap:2px;min-width:0}',
  '.pcRemoteWorkspaceRow>.pcRemoteWorkspaceButton{flex:1 1 auto;width:auto}',
  '.pcRemoteCount{flex:0 0 auto;color:var(--dsw-alias-label-tertiary);font-size:11px}',
  '.pcRemoteSession,.pcRemoteSessionSelected{gap:5px;min-height:26px;padding:0 6px 0 14px;border-radius:var(--dsw-radius-sm,6px);color:var(--dsw-alias-label-secondary);cursor:pointer}',
  '.pcRemoteSessionSelected{background:var(--dsw-alias-interactive-bg-selected,var(--dsw-alias-interactive-bg-hover));color:var(--dsw-alias-label-primary)}',
  '.pcRemoteSessionTitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.pcRemoteRunning{flex:0 0 auto;color:var(--dsw-alias-state-business-primary);font-size:11px}',
  '.pcRemoteNote{margin:2px 0 4px;padding:0 4px;color:var(--dsw-alias-label-tertiary);font-size:11px;overflow-wrap:anywhere}',
  '.pcRemoteNote[data-tone=warn]{color:var(--dsw-alias-state-warn-primary)}',
  '.pcRemoteRoot :focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}',
].join('')
