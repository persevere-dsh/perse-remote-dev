/**
 * Style injection for the browser half.
 *
 * The official preset would compile CSS Modules with lightningcss; this
 * out-of-tree bundle cannot reach that preset, so the client lane ships one plain
 * stylesheet as a tagged `<style>` element, following the dynamic-package
 * guidance: build markup with `React.createElement` and ship CSS through
 * `styles.insert`.
 *
 * Every colour comes from a real DSH semantic token (`--dsw-alias-*`). Tokens
 * such as `--dsw-border`/`--dsw-accent` do not exist, so inputs must not use
 * them (they would render borderless).
 */

/** `id` of the single injected stylesheet element. */
export const STYLE_ID = 'perse-remote-dev-style'

const CSS = [
  '.rws_badge{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:3px 6px;border-radius:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);cursor:default;user-select:none}',
  '.rws_badge:hover{color:var(--dsw-alias-label-secondary)}',
  '.rws_dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}',
  '.rws_dot[data-state=connected]{background:var(--dsw-alias-state-success-primary,rgb(46,160,67))}',
  '.rws_dot[data-state=connecting],.rws_dot[data-state=reconnecting]{background:var(--dsw-alias-state-warn-primary,rgb(210,153,34))}',
  '.rws_dot[data-state=disconnected]{background:var(--dsw-alias-state-error-primary,rgb(248,81,73))}',
  '.rws_host{color:var(--dsw-alias-label-secondary)}',
  '.rws_sep{opacity:.45}',
  '.rws_mask{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center}',
  '.rws_dlg{width:min(760px,92vw);max-height:82vh;display:flex;flex-direction:column;border-radius:12px;background:var(--dsw-alias-bg-layer-1,#1e1e1e);color:var(--dsw-alias-label-primary,#eee);box-shadow:0 12px 40px rgba(0,0,0,.5);overflow:hidden}',
  '.rws_dlgHead{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));font-size:13px;font-weight:600}',
  '.rws_dlgBody{padding:10px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px}',
  '.rws_dlgFoot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22))}',
  '.rws_row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.rws_lbl{font-size:12px;color:var(--dsw-alias-label-tertiary);min-width:32px}',
  '.rws_chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;font-size:12px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.rws_chip:hover{border-color:var(--dsw-alias-label-tertiary)}',
  '.rws_chip[data-selected=true]{color:var(--dsw-alias-label-primary,#fff);border-color:var(--dsw-alias-label-secondary);background:rgba(127,127,127,.16)}',
  '.rws_chipDetail{opacity:.6;font-size:11px}',
  '.rws_crumbs{display:flex;align-items:center;gap:4px;flex-wrap:wrap;font-size:12px;min-height:22px}',
  '.rws_crumb{background:none;border:0;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:2px 4px;border-radius:4px;font-size:12px}',
  '.rws_crumb:hover{background:rgba(127,127,127,.16)}',
  '.rws_crumbHost{color:var(--dsw-alias-label-primary,#fff);font-weight:600}',
  '.rws_crumbSep{opacity:.45}',
  '.rws_list{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.22));border-radius:8px;max-height:38vh;overflow:auto}',
  '.rws_item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:none;border:0;color:inherit;padding:6px 10px;font-size:12px;line-height:18px;cursor:pointer}',
  '.rws_item:hover{background:rgba(127,127,127,.14)}',
  '.rws_itemName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.rws_itemHidden{opacity:.55}',
  '.rws_empty{padding:14px;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
  '.rws_btn{padding:5px 11px;border-radius:6px;font-size:12px;line-height:18px;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.rws_btn:hover{border-color:var(--dsw-alias-label-tertiary)}',
  '.rws_btn[disabled]{opacity:.4;cursor:not-allowed}',
  '.rws_btnPrimary{background:var(--dsw-alias-brand-primary,#2f6feb);border-color:var(--dsw-alias-brand-primary,#2f6feb);color:#fff}',
  '.rws_grow{flex:1}',
  '.rws_note{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary,#d29922)}',
  '.rws_err{font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#f85149)}',
  '.rws_input{padding:4px 8px;border-radius:6px;font-size:12px;background:rgba(127,127,127,.14);color:inherit;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.rws_launcher{position:fixed;right:14px;bottom:14px;z-index:8800;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;font-size:12px;line-height:18px;cursor:pointer;color:var(--dsw-alias-label-secondary,#ddd);background:var(--dsw-alias-bg-layer-1,#242424);border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.32));box-shadow:0 4px 14px rgba(0,0,0,.28)}',
  '.rws_launcher:hover{border-color:var(--dsw-alias-label-tertiary)}',
  '.rws_launcherPending{border-color:var(--dsw-alias-state-warn-primary,#d29922)}',
  '.rws_card{display:flex;flex-direction:column;gap:4px;padding:8px 10px;border-radius:8px;background:rgba(127,127,127,.1);font-size:12px;line-height:18px}',
  '.rws_cardTop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.rws_sha{font-family:ui-monospace,Menlo,monospace;font-size:11px;opacity:.85}',
  '.rws_tag{display:inline-block;min-width:16px;text-align:center;border-radius:4px;padding:0 4px;font-size:11px;font-weight:700}',
  '.rws_tagA{background:rgba(46,160,67,.22);color:rgb(63,185,80)}',
  '.rws_tagM{background:rgba(210,153,34,.22);color:rgb(210,153,34)}',
  '.rws_tagD{background:rgba(248,81,73,.22);color:rgb(248,81,73)}',
  '.rws_frow{display:flex;align-items:center;gap:8px;width:100%;background:none;border:0;color:inherit;padding:5px 8px;font-size:12px;border-radius:6px}',
  '.rws_frow[data-active=true]{background:rgba(47,111,235,.16)}',
  '.rws_fpath{flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:ui-monospace,Menlo,monospace;background:none;border:0;color:inherit;cursor:pointer}',
  '.rws_num{font-family:ui-monospace,Menlo,monospace;font-size:11px}',
  '.rws_add{color:rgb(63,185,80)}',
  '.rws_del{color:rgb(248,81,73)}',
  '.rws_verdict{font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid transparent;cursor:pointer;background:transparent;color:inherit}',
  '.rws_verdictApprove{border-color:rgba(46,160,67,.6);color:rgb(63,185,80)}',
  '.rws_verdictReject{border-color:rgba(248,81,73,.6);color:rgb(248,81,73)}',
  '.rws_diff{margin:0;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,.28);font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:16px;max-height:26vh;overflow:auto;white-space:pre}',
  '.rws_diffAdd{color:rgb(63,185,80)}',
  '.rws_diffDel{color:rgb(248,81,73)}',
  '.rws_diffMeta{opacity:.6}',
  '.rws_status{display:flex;flex-direction:column;gap:3px;font-size:11px;line-height:16px;padding:7px 9px;border-radius:8px;background:rgba(127,127,127,.1)}',
  '.rws_statusRow{display:flex;align-items:center;gap:6px}',
  '.rws_ok{color:rgb(63,185,80)}',
  '.rws_bad{color:rgb(248,81,73)}',
  '.rws_area{width:100%;box-sizing:border-box;min-height:52px;resize:vertical;padding:6px 8px;border-radius:8px;font-size:12px;line-height:18px;background:rgba(127,127,127,.14);color:inherit;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3))}',
  '.rws_sec{display:flex;flex-direction:column;gap:14px;font-size:13px;line-height:1.6}',
  '.rws-lead{margin:0;color:var(--dsw-alias-label-secondary)}',
  '.rws-dim{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px}',
  '.rws-err{margin:0;color:var(--dsw-alias-state-error-primary)}',
  '.rws-status{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-primary)}',
  '.rws-dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--dsw-alias-label-tertiary)}',
  '.rws-dot-on{background:var(--dsw-alias-state-success-primary)}',
  '.rws-dot-off{background:var(--dsw-alias-state-warn-primary)}',
  '.rws-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:14px;display:flex;flex-direction:column;gap:12px}',
  '.rws-card-head{display:flex;align-items:center;gap:8px}',
  '.rws-card-title{font-weight:600;color:var(--dsw-alias-label-primary)}',
  '.rws-tag{font-size:11px;padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}',
  '.rws-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}',
  '.rws-fld{display:flex;flex-direction:column;gap:5px;min-width:0}',
  '.rws-fld-label{font-size:12px;color:var(--dsw-alias-label-secondary)}',
  '.rws-fld-input{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:6px 9px;color:var(--dsw-alias-label-primary);font:inherit;outline:none}',
  '.rws-fld-input:focus{border-color:var(--dsw-alias-brand-primary)}',
  '.rws-card-act{display:flex;justify-content:flex-end;gap:8px}',
  '.rws-btn{background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 12px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer}',
  '.rws-btn:hover{background:var(--dsw-alias-bg-layer-2)}',
  '.rws-btn-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}',
  '.rws-btn[disabled]{opacity:.5;cursor:default}',
  '.rws-import{display:flex;flex-direction:column;gap:8px}',
  '.rws-chips{display:flex;flex-wrap:wrap;gap:6px}',
  '.rws-chip{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit}',
  '.rws-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.rws-diag{display:inline-block;width:0;height:0;overflow:hidden}',
].join('')

/**
 * Inject the stylesheet once per document.
 */
export function ensureStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID) !== null) return
  const element = document.createElement('style')
  element.id = STYLE_ID
  element.textContent = CSS
  document.head.appendChild(element)
}
