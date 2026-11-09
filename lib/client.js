/* qqpilot-dsh-plugin — browser half (hand-written __ModuleLoader__ bundle, no build step).
 * Adds a 「QQPilot 接入」 section to DSH Settings with three tabs:
 *   概览  — run mode (agent / compat / silent), endpoint, stats, connection test
 *   聊天动态 — live QQ chat feed polled from /qqpilot/api/activity every 2s
 *   设置  — run mode, extra instructions, model info
 * Routes are served by lib/index.js. No build step, React.createElement only.
 */
window.__ModuleLoader__.load({
  id: 'qqpilot-dsh-plugin',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');

    // Opens the DSH system directory picker; installed by apply() from the
    // Client uiWorkspace service and used by the workspace setting.
    var pickDirectoryHandler = null;

    var CSS = `.qqp-root{display:flex;flex-direction:column;gap:14px;padding:2px 2px 24px;color:var(--dsw-alias-label-primary,#1f2329);font-size:13px;line-height:1.55;}
.qqp-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.qqp-title{font-size:16px;font-weight:600;}
.qqp-spacer{flex:1;}
.qqp-pill{display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-2,#f5f6f8);font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);white-space:nowrap;}
.qqp-pill-dot{width:6px;height:6px;border-radius:50%;background:currentColor;}
.qqp-pill.ok{color:var(--dsw-alias-state-success-primary,#1f9e4f);}
.qqp-pill.err{color:var(--dsw-alias-state-error-primary,#e5484d);}
.qqp-pill.busy{color:var(--dsw-alias-state-warn-primary,#d97706);}
.qqp-pill.mode{border-color:var(--dsw-alias-brand-primary,#12b7f5);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-uptime{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);white-space:nowrap;}
.qqp-desc{color:var(--dsw-alias-label-secondary,#646a73);font-size:12px;}
.qqp-card{display:flex;flex-direction:column;gap:10px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);padding:12px 14px;}
.qqp-section-title{font-size:13px;font-weight:600;}
.qqp-hint{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-hint code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e6eb);word-break:break-all;}
.qqp-tabs{display:flex;align-items:flex-end;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e6eb);padding:0 2px;}
.qqp-tab{position:relative;top:1px;appearance:none;border:1px solid transparent;border-bottom:none;border-radius:8px 8px 0 0;background:transparent;color:var(--dsw-alias-label-secondary,#646a73);font:inherit;font-size:13px;padding:7px 14px;cursor:pointer;transition:color .15s,background .15s,border-color .15s;}
.qqp-tab:hover{color:var(--dsw-alias-label-primary,#1f2329);background:var(--dsw-alias-bg-layer-1,#fff);}
.qqp-tab.active{border-color:var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-brand-primary,#12b7f5);font-weight:600;}
.qqp-tab:disabled{opacity:.55;cursor:default;}
.qqp-mode-select{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}
.qqp-mode-btn{display:flex;flex-direction:column;gap:2px;appearance:none;text-align:left;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:9px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);font:inherit;padding:9px 10px;cursor:pointer;transition:border-color .15s,background .15s,opacity .15s;}
.qqp-mode-btn:hover{border-color:var(--dsw-alias-border-l2,#c9cdd4);background:var(--dsw-alias-bg-layer-2,#f5f6f8);}
.qqp-mode-btn.active{border-color:var(--dsw-alias-brand-primary,#12b7f5);box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#12b7f5);background:var(--dsw-alias-bg-layer-1,#fff);}
.qqp-mode-btn:disabled{opacity:.55;cursor:default;}
.qqp-mode-name{font-size:13px;font-weight:600;line-height:1.4;}
.qqp-mode-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);line-height:1.4;}
.qqp-mode-list{display:flex;flex-direction:column;gap:8px;}
.qqp-mode-item{display:flex;align-items:flex-start;gap:10px;}
.qqp-mode-item-name{flex:none;min-width:64px;font-size:12px;font-weight:600;}
.qqp-mode-item-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-endpoint-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.qqp-code{flex:1 1 220px;min-width:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-1,#fff);word-break:break-all;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-btn{flex:none;appearance:none;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);font:inherit;font-size:12px;padding:6px 12px;cursor:pointer;transition:background .15s,border-color .15s,opacity .15s;}
.qqp-btn:hover{background:var(--dsw-alias-bg-layer-2,#f5f6f8);}
.qqp-btn:disabled{opacity:.55;cursor:default;}
.qqp-btn.primary{background:var(--dsw-alias-brand-primary,#12b7f5);border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:500;}
.qqp-btn.primary:hover{opacity:.9;background:var(--dsw-alias-brand-primary,#12b7f5);}
.qqp-divider{height:1px;background:var(--dsw-alias-border-l1,#e5e6eb);margin:2px 0;}
.qqp-field{display:flex;flex-direction:column;gap:6px;}
.qqp-field-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-textarea,.qqp-input{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);font:inherit;font-size:13px;padding:8px 10px;outline:none;}
.qqp-select{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);font:inherit;font-size:13px;padding:8px 10px;outline:none;cursor:pointer;}
.qqp-select:focus{border-color:var(--dsw-alias-brand-primary,#12b7f5);}
.qqp-model-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.qqp-textarea{min-height:64px;resize:vertical;line-height:1.5;}
.qqp-textarea:focus,.qqp-input:focus{border-color:var(--dsw-alias-brand-primary,#12b7f5);}
.qqp-inline{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.qqp-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
.qqp-stat{border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);padding:8px 10px;}
.qqp-stat-num{font-size:17px;font-weight:600;line-height:1.3;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-stat-label{font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-error{font-size:12px;color:var(--dsw-alias-state-error-primary,#e5484d);word-break:break-word;}
.qqp-notice{font-size:12px;padding:6px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-2,#f5f6f8);color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-notice.ok{color:var(--dsw-alias-state-success-primary,#1f9e4f);}
.qqp-notice.err{color:var(--dsw-alias-state-error-primary,#e5484d);}
.qqp-test-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.qqp-test-row .qqp-input{flex:1 1 200px;width:auto;}
.qqp-test-result{display:flex;flex-direction:column;gap:6px;}
.qqp-tag{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;font-size:11px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-tag.brand{border-color:var(--dsw-alias-brand-primary,#12b7f5);}
.qqp-reply{margin:0;max-height:160px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:12px;line-height:1.55;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-switch-row{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,#c9cdd4);background:var(--dsw-alias-bg-layer-1,#fff);cursor:pointer;transition:background .15s,border-color .15s;}
.qqp-switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary,#12b7f5);border-color:transparent;}
.qqp-switch:disabled{opacity:.55;cursor:default;}
.qqp-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-secondary,#646a73);transition:transform .15s,background .15s;}
.qqp-switch[aria-checked="true"] .qqp-knob{transform:translateX(18px);background:var(--dsw-alias-label-primary-foreground,#fff);}
.qqp-log-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.qqp-log{display:flex;flex-direction:column;gap:10px;max-height:480px;overflow:auto;padding:2px;}
.qqp-log-row{display:flex;flex-direction:column;gap:8px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);padding:10px 12px;}
.qqp-log-row.error{border-color:var(--dsw-alias-state-error-primary,#e5484d);}
.qqp-log-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;}
.qqp-log-time{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-log-sender{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-badge{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;border:1px solid currentColor;font-size:11px;white-space:nowrap;}
.qqp-badge.reply{color:var(--dsw-alias-state-success-primary,#1f9e4f);}
.qqp-badge.silence{color:var(--dsw-alias-state-idle-primary,#8f959e);}
.qqp-badge.error{color:var(--dsw-alias-state-error-primary,#e5484d);}
.qqp-log-body{display:flex;flex-direction:column;gap:6px;}
.qqp-msg{display:flex;align-items:flex-start;gap:8px;max-width:100%;}
.qqp-msg-label{flex:none;min-width:32px;padding-top:4px;font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-bubble{max-width:100%;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:9px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);padding:7px 10px;font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-bubble.out{border-left:3px solid var(--dsw-alias-brand-primary,#12b7f5);background:var(--dsw-alias-bg-layer-1,#fff);}
.qqp-bubble.none{color:var(--dsw-alias-label-secondary,#646a73);border-style:dashed;}
.qqp-log-error{font-size:12px;color:var(--dsw-alias-state-error-primary,#e5484d);word-break:break-word;}
.qqp-log-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 16px;border:1px dashed var(--dsw-alias-border-l1,#e5e6eb);border-radius:10px;color:var(--dsw-alias-label-secondary,#646a73);font-size:12px;text-align:center;}
.qqp-note{font-size:12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-note code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#e5e6eb);word-break:break-all;}
.qqp-dock{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#f5f6f8);color:var(--dsw-alias-label-primary,#1f2329);font-size:12px;line-height:1.5;overflow:hidden;}
.qqp-dock-head{display:flex;align-items:center;gap:8px;padding:6px 10px;cursor:pointer;user-select:none;}
.qqp-dock-title{flex:none;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-dock-summary{flex:1;min-width:0;color:var(--dsw-alias-label-secondary,#646a73);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qqp-dock-chevron{flex:none;color:var(--dsw-alias-label-secondary,#646a73);font-size:11px;}
.qqp-dock-body{display:flex;flex-direction:column;gap:4px;max-height:240px;overflow:auto;padding:2px 10px 10px;border-top:1px solid var(--dsw-alias-border-l1,#e5e6eb);}
.qqp-dock-row{display:flex;flex-direction:column;gap:3px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#e5e6eb);}
.qqp-dock-row:last-child{border-bottom:none;}
.qqp-dock-line{display:flex;align-items:flex-start;gap:6px;min-width:0;}
.qqp-dock-time{flex:none;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--dsw-alias-label-secondary,#646a73);padding-top:2px;}
.qqp-dock-name{flex:none;max-width:110px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.qqp-dock-text{flex:1;min-width:0;color:var(--dsw-alias-label-primary,#1f2329);word-break:break-word;white-space:pre-wrap;}
.qqp-dock-reply{flex:1;min-width:0;color:var(--dsw-alias-label-primary,#1f2329);word-break:break-word;white-space:pre-wrap;border-left:2px solid var(--dsw-alias-brand-primary,#12b7f5);padding-left:6px;}
.qqp-dock-meta{display:flex;gap:8px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-dock-empty{padding:10px 0 12px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-dock-error{color:var(--dsw-alias-state-error-primary,#e5484d);}
.qqp-incoming-line{display:flex;gap:4px;padding:1px 0;align-items:flex-start;}
.qqp-incoming-sender{flex:none;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329);}
.qqp-tool-pill{display:inline-flex;align-items:center;padding:1px 8px;border-radius:999px;border:1px solid currentColor;font-size:11px;white-space:nowrap;}
.qqp-tool-pill.off{color:var(--dsw-alias-state-idle-primary,#8f959e);}
.qqp-tool-pill.safe{color:var(--dsw-alias-state-success-primary,#1f9e4f);}
.qqp-tool-pill.all{color:var(--dsw-alias-state-warn-primary,#d97706);}
.qqp-tool-list{display:flex;flex-wrap:wrap;gap:6px;}
.qqp-chip{display:inline-flex;align-items:center;padding:1px 7px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,#e5e6eb);background:var(--dsw-alias-bg-layer-1,#fff);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-secondary,#646a73);}
.qqp-dock-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary,#1f9e4f);}
@keyframes qqp-dotpulse{0%{opacity:.35}50%{opacity:1}100%{opacity:.35}}
.qqp-dock-dot.busy{background:var(--dsw-alias-state-warn-primary,#d97706);animation:qqp-dotpulse 1.6s infinite;}
.qqp-dock-dot.err{background:var(--dsw-alias-state-error-primary,#e5484d);}
@media (max-width:520px){.qqp-stats{grid-template-columns:repeat(2,minmax(0,1fr));}.qqp-mode-select{grid-template-columns:1fr;}}`;

    // ── constants ────────────────────────────────────────────────────────────
    var MODES = [
      {
        id: 'agent',
        label: '工具模式',
        short: '模型自主决定回复',
        desc: '模型通过 qqpilot_reply / qqpilot_do_not_reply 工具决定是否回复，并可使用工具；推荐用于支持工具调用的模型。'
      },
      {
        id: 'compat',
        label: '兼容模式',
        short: '模型输出即回复',
        desc: '不向模型提供工具，模型输出直接作为 QQ 回复返回，适合不支持工具调用的模型或服务商。'
      },
      {
        id: 'silent',
        label: '静默模式',
        short: '只记录不回复',
        desc: '宿主完全不调用模型，只记录收到的 QQ 消息，不发送任何回复；适合观察或暂时关闭机器人时使用。'
      }
    ];

    function modeInfo(id) {
      var i;
      for (i = 0; i < MODES.length; i++) {
        if (MODES[i].id === id) return MODES[i];
      }
      return MODES[0];
    }

    function modeLabel(id) {
      if (id === 'compat-fallback') return '兼容模式（回退）';
      return modeInfo(id).label;
    }

    function configMode(config) {
      var m = config && String(config.mode || '');
      if (m === 'agent' || m === 'compat' || m === 'silent') return m;
      if (config && config.compatibilityMode === true) return 'compat';
      return 'agent';
    }

    var DSH_TOOL_POLICIES = [
      {
        id: 'off',
        label: '关闭',
        short: '不提供 DSH 工具',
        desc: '模型只能使用 qqpilot_reply / qqpilot_do_not_reply，无法调用 DSH 工具。'
      },
      {
        id: 'safe',
        label: '安全（默认）',
        short: '只读 + 联网',
        desc: '额外提供 read / glob / grep / read_image / web_search / web_fetch 等只读与联网工具，模型可以先查资料再回复。写文件、执行命令、子代理等不会开放。'
      },
      {
        id: 'all',
        label: '全部',
        short: '除危险工具外全部',
        desc: '提供当前 DSH 可见的大部分工具；pwsh / bash / write / edit / subagent / workflow 等危险工具仍保持在拒绝名单里。'
      }
    ];

    function dshToolPolicyInfo(id) {
      var i;
      for (i = 0; i < DSH_TOOL_POLICIES.length; i++) {
        if (DSH_TOOL_POLICIES[i].id === id) return DSH_TOOL_POLICIES[i];
      }
      return DSH_TOOL_POLICIES[1];
    }

    function decisionInfo(kind) {
      if (kind === 'reply') return { label: '已回复', cls: 'reply' };
      if (kind === 'silence') return { label: '沉默', cls: 'silence' };
      return { label: '错误', cls: 'error' };
    }

    // ── helpers ──────────────────────────────────────────────────────────────
    function errText(err) {
      if (!err) return '未知错误';
      return String(err.message || err);
    }

    function request(method, path, body) {
      if (typeof fetch !== 'function') return Promise.reject(new Error('当前环境不支持 fetch'));
      var init = {
        method: method,
        cache: 'no-store',
        headers: body === undefined ? {} : { 'content-type': 'application/json' }
      };
      if (body !== undefined) init.body = JSON.stringify(body);
      return fetch(path, init).then(function (res) {
        return res.text().then(function (text) {
          var data = null;
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error('响应不是 JSON（HTTP ' + res.status + '）');
            }
          }
          if (!res.ok) {
            throw new Error((data && data.error) || ('HTTP ' + res.status));
          }
          return data;
        });
      });
    }

    function baseUrl(endpoint) {
      return String(endpoint || '')
        .replace(/\/+$/, '')
        .replace(/\/v1$/i, '');
    }

    function clip(text, max) {
      var s = String(text === null || text === undefined ? '' : text);
      if (s.length <= max) return s;
      return s.slice(0, max) + '…';
    }

    function pad2(n) {
      n = Number(n) || 0;
      return n < 10 ? '0' + n : String(n);
    }

    function formatTime(at) {
      if (typeof at !== 'number' || !isFinite(at) || at <= 0) return '--:--:--';
      var d = new Date(at);
      if (isNaN(d.getTime())) return '--:--:--';
      return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function formatWhen(value) {
      if (typeof value === 'number' && isFinite(value) && value > 0) {
        var d = new Date(value);
        if (!isNaN(d.getTime())) {
          return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + formatTime(value);
        }
        return '';
      }
      if (typeof value === 'string' && value) {
        var parsed = new Date(value);
        if (!isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return pad2(parsed.getMonth() + 1) + '-' + pad2(parsed.getDate()) + ' ' + formatTime(parsed.getTime());
        }
        return clip(value, 40);
      }
      return '';
    }

    function formatUptime(ms) {
      if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '';
      var sec = Math.floor(ms / 1000);
      var d = Math.floor(sec / 86400);
      sec -= d * 86400;
      var h = Math.floor(sec / 3600);
      sec -= h * 3600;
      var m = Math.floor(sec / 60);
      sec -= m * 60;
      if (d > 0) return d + ' 天 ' + h + ' 小时';
      if (h > 0) return h + ' 小时 ' + m + ' 分';
      if (m > 0) return m + ' 分 ' + sec + ' 秒';
      return sec + ' 秒';
    }

    function countOf(value) {
      return typeof value === 'number' && isFinite(value) ? value : 0;
    }

    function usageTotal(usage) {
      if (!usage || typeof usage.total_tokens !== 'number' || !isFinite(usage.total_tokens)) return null;
      return usage.total_tokens;
    }

    function statusClass(status) {
      if (status === 'ok') return 'ok';
      if (status === 'error') return 'err';
      return 'busy';
    }

    function statusLabel(status) {
      if (status === 'ok') return '已连接';
      if (status === 'error') return '失败';
      return '加载中';
    }

    // Report client-side failures to the host so a blank panel is diagnosable.
    function reportClientError(source, error, info) {
      try {
        var message = error && (error.message || String(error));
        var stack = (error && error.stack) || (info && info.componentStack) || '';
        if (typeof fetch !== 'function') return;
        fetch('/qqpilot/api/client-error', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ source: source, message: message, stack: stack })
        }).catch(function () {
          /* host may be reloading */
        });
      } catch (e) {
        /* never throw from the reporter */
      }
    }

    // Keep one failing view from blanking the whole settings panel.
    function withErrorBoundary(label, Inner) {
      if (!React.Component) return Inner;
      class Boundary extends React.Component {
        constructor(props) {
          super(props);
          this.state = { error: null };
        }
        static getDerivedStateFromError(error) {
          return { error: error };
        }
        componentDidCatch(error, info) {
          reportClientError(label, error, info);
        }
        render() {
          if (this.state && this.state.error) {
            const message = this.state.error.message || String(this.state.error);
            return React.createElement(
              'div',
              { className: 'qqp-root' },
              React.createElement('div', { className: 'qqp-notice err' }, 'QQPilot 界面渲染出错：' + clip(message, 300)),
              React.createElement('div', { className: 'qqp-hint' }, '请刷新 DSH 页面重试；错误已上报到宿主日志（[qqpilot] 客户端错误）。')
            );
          }
          return React.createElement(Inner, this.props);
        }
      }
      return Boundary;
    }

    function mergeActivity(prev, incoming) {
      var seen = {};
      var merged = [];
      var i;
      var list = Array.isArray(prev) ? prev : [];
      var fresh = Array.isArray(incoming) ? incoming : [];
      for (i = 0; i < fresh.length; i++) {
        var entry = fresh[i];
        if (!entry || typeof entry.id !== 'number' || seen[entry.id]) continue;
        seen[entry.id] = true;
        merged.push(entry);
      }
      for (i = 0; i < list.length; i++) {
        var old = list[i];
        if (!old || typeof old.id !== 'number' || seen[old.id]) continue;
        seen[old.id] = true;
        merged.push(old);
      }
      merged.sort(function (a, b) {
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
      return merged.slice(0, 80);
    }

    // ── small presentational pieces ──────────────────────────────────────────
    function Btn(props) {
      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'qqp-btn' + (props.primary ? ' primary' : ''),
          disabled: !!props.disabled,
          onClick: props.onClick
        },
        props.children
      );
    }

    function Stat(props) {
      var value = props.value === null || props.value === undefined ? '-' : String(props.value);
      return React.createElement(
        'div',
        { className: 'qqp-stat' },
        React.createElement('div', { className: 'qqp-stat-num' }, value),
        React.createElement('div', { className: 'qqp-stat-label' }, props.label)
      );
    }

    function Switch(props) {
      return React.createElement(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': props.checked ? 'true' : 'false',
          'aria-label': props.label,
          className: 'qqp-switch',
          disabled: !!props.disabled,
          onClick: function () {
            if (!props.disabled) props.onChange(!props.checked);
          }
        },
        React.createElement('span', { className: 'qqp-knob' })
      );
    }

    function Header(props) {
      var uptime = formatUptime(props.uptimeMs);
      return React.createElement(
        'div',
        { className: 'qqp-header' },
        React.createElement('div', { className: 'qqp-title' }, 'QQPilot 接入'),
        React.createElement(
          'span',
          { className: 'qqp-pill ' + statusClass(props.status) },
          React.createElement('span', { className: 'qqp-pill-dot' }),
          statusLabel(props.status)
        ),
        React.createElement('span', { className: 'qqp-pill mode' }, '运行模式：' + modeLabel(props.mode)),
        React.createElement('span', { className: 'qqp-spacer' }),
        uptime ? React.createElement('span', { className: 'qqp-uptime' }, '已运行 ' + uptime) : null,
        React.createElement(
          Btn,
          { onClick: props.onRefresh, disabled: props.status === 'loading' },
          props.status === 'loading' ? '刷新中…' : '刷新'
        )
      );
    }

    function Tabs(props) {
      var tabs = [
        { id: 'overview', label: '概览' },
        { id: 'activity', label: '聊天动态' },
        { id: 'settings', label: '设置' }
      ];
      return React.createElement(
        'div',
        { className: 'qqp-tabs', role: 'tablist' },
        tabs.map(function (tab) {
          var active = props.active === tab.id;
          return React.createElement(
            'button',
            {
              key: tab.id,
              type: 'button',
              role: 'tab',
              'aria-selected': active ? 'true' : 'false',
              className: 'qqp-tab' + (active ? ' active' : ''),
              onClick: function () {
                props.onChange(tab.id);
              }
            },
            tab.label
          );
        })
      );
    }

    function ModeSelector(props) {
      var mode = props.mode || 'agent';
      return React.createElement(
        'div',
        { className: 'qqp-mode-select', role: 'group', 'aria-label': '运行模式' },
        MODES.map(function (item) {
          var active = item.id === mode;
          return React.createElement(
            'button',
            {
              key: item.id,
              type: 'button',
              'aria-pressed': active ? 'true' : 'false',
              className: 'qqp-mode-btn' + (active ? ' active' : ''),
              disabled: !!props.disabled,
              onClick: function () {
                if (!props.disabled) props.onSelect(item.id);
              }
            },
            React.createElement('span', { className: 'qqp-mode-name' }, item.label),
            React.createElement('span', { className: 'qqp-mode-sub' }, item.short)
          );
        })
      );
    }

    // ── 概览 ─────────────────────────────────────────────────────────────────
    function OverviewTab(props) {
      var config = props.config || {};
      var stat = props.stats || {};
      var mode = props.mode;
      var info = modeInfo(mode);
      var replyInfo = (props.testResult && props.testResult.reply) || {};
      var imageCount = countOf(replyInfo.images);
      var messageCount = countOf(replyInfo.messages);
      var replyText = clip(replyInfo.text || '', 300);
      var lastError = stat.lastError ? clip(stat.lastError, 300) : '';

      return React.createElement(
        'div',
        { className: 'qqp-root' },
        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '运行模式'),
          React.createElement(ModeSelector, {
            mode: mode,
            disabled: props.saving,
            onSelect: props.onSelectMode
          }),
          React.createElement('div', { className: 'qqp-desc' }, info.desc),
          React.createElement('div', { className: 'qqp-divider' }),
          React.createElement(
            'div',
            { className: 'qqp-mode-list' },
            MODES.map(function (item) {
              return React.createElement(
                'div',
                { key: item.id, className: 'qqp-mode-item' },
                React.createElement('span', { className: 'qqp-mode-item-name' }, item.label),
                React.createElement('span', { className: 'qqp-mode-item-desc' }, item.desc)
              );
            })
          )
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '接口地址'),
          React.createElement(
            'div',
            { className: 'qqp-endpoint-row' },
            React.createElement('code', { className: 'qqp-code' }, props.endpoint || '（尚未获取到地址）'),
            React.createElement(
              Btn,
              { onClick: props.onCopyEndpoint, disabled: !props.endpoint },
              props.copied ? '已复制' : '复制'
            )
          ),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '在 QQPilot 的 config.ini 里设置 ',
            React.createElement('code', null, 'server_url = ' + (props.endpoint ? baseUrl(props.endpoint) : '…')),
            '，api_key 留空即可（本机回环地址不会带鉴权头）。'
          )
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '运行统计'),
          React.createElement(
            'div',
            { className: 'qqp-stats' },
            React.createElement(Stat, { label: '请求', value: stat.requests }),
            React.createElement(Stat, { label: '回复', value: stat.replies }),
            React.createElement(Stat, { label: '沉默', value: stat.silences }),
            React.createElement(Stat, { label: '错误', value: stat.errors })
          ),
          lastError ? React.createElement('div', { className: 'qqp-error' }, '最近错误：' + lastError) : null,
          stat.lastRequestAt
            ? React.createElement('div', { className: 'qqp-hint' }, '最近请求：' + formatWhen(stat.lastRequestAt))
            : null,
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '当前模型：' + (config.provider || '未知') + '/' + (config.model || '未知')
          )
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '测试连接'),
          React.createElement(
            'div',
            { className: 'qqp-test-row' },
            React.createElement('input', {
              className: 'qqp-input',
              type: 'text',
              value: props.testText,
              placeholder: '在吗',
              onChange: function (e) {
                props.onTestText(e.target.value);
              },
              onKeyDown: props.onTestKeyDown
            }),
            React.createElement(
              Btn,
              { onClick: props.onTest, disabled: props.testing, primary: true },
              props.testing ? '测试中…' : '测试连接'
            )
          ),
          props.testError
            ? React.createElement('div', { className: 'qqp-error' }, '测试失败：' + props.testError)
            : null,
          props.testResult
            ? React.createElement(
                'div',
                { className: 'qqp-test-result' },
                React.createElement(
                  'div',
                  { className: 'qqp-meta' },
                  React.createElement(
                    'span',
                    { className: 'qqp-tag brand' },
                    modeLabel(props.testResult.mode || mode)
                  ),
                  React.createElement(
                    'span',
                    null,
                    '用时 ' + (typeof props.testResult.elapsedMs === 'number' ? props.testResult.elapsedMs : '-') + ' ms'
                  ),
                  React.createElement('span', null, '图片 ' + imageCount + ' 张'),
                  messageCount > 1 ? React.createElement('span', null, '消息 ' + messageCount + ' 条') : null
                ),
                React.createElement(
                  'pre',
                  { className: 'qqp-reply' },
                  replyText || (imageCount > 0 ? '（仅发送图片，无文字回复）' : '（本次未产生文字回复）')
                )
              )
            : null
        )
      );
    }

    // ── 聊天动态 ─────────────────────────────────────────────────────────────
    function ActivityRow(props) {
      var entry = props.entry || {};
      var kind = entry.kind === 'reply' || entry.kind === 'silence' || entry.kind === 'error' ? entry.kind : 'silence';
      var badge = decisionInfo(kind);
      var images = countOf(entry.images);
      var elapsed = typeof entry.elapsedMs === 'number' && isFinite(entry.elapsedMs) ? entry.elapsedMs : null;
      var tokens = usageTotal(entry.usage);
      var text = clip(entry.text, 180);
      var reply = clip(entry.reply, 180);
      var isError = kind === 'error';
      var tools = Array.isArray(entry.tools) ? entry.tools : [];
      var msgCount = typeof entry.messages === 'number' && isFinite(entry.messages) ? entry.messages : 0;
      var participants = Array.isArray(entry.participants) ? entry.participants : [];
      var userCount = typeof entry.userCount === 'number' && isFinite(entry.userCount) ? entry.userCount : 0;

      var meta = [];
      meta.push(React.createElement('span', { key: 'mode' }, '模式：' + modeLabel(entry.mode)));
      if (participants.length > 1) {
        meta.push(React.createElement('span', { key: 'users' }, '用户 ' + participants.length + ' 位：' + clip(participants.join('、'), 48)));
      }
      if (userCount > 1) {
        meta.push(React.createElement('span', { key: 'inputs' }, '输入 ' + userCount + ' 条'));
      }
      if (msgCount > 1) {
        meta.push(React.createElement('span', { key: 'msgs' }, '消息 ' + msgCount + ' 条'));
      }
      if (images > 0) {
        meta.push(React.createElement('span', { key: 'img' }, '图片 ' + images + ' 张'));
      }
      if (elapsed !== null) {
        meta.push(React.createElement('span', { key: 'ms' }, '用时 ' + elapsed + ' ms'));
      }
      if (tokens !== null) {
        meta.push(React.createElement('span', { key: 'tok' }, 'Token 总数 ' + tokens));
      }
      if (tools.length) {
        meta.push(React.createElement('span', { key: 'tools' }, 'DSH 工具：' + tools.join(', ')));
      }

      return React.createElement(
        'div',
        { className: 'qqp-log-row' + (isError ? ' error' : '') },
        React.createElement(
          'div',
          { className: 'qqp-log-head' },
          React.createElement('span', { className: 'qqp-log-time' }, formatTime(entry.at)),
          React.createElement('span', { className: 'qqp-log-sender' }, entry.sender || '未知发送者'),
          React.createElement('span', { className: 'qqp-badge ' + badge.cls }, badge.label),
          React.createElement('span', { className: 'qqp-spacer' })
        ),
        React.createElement(
          'div',
          { className: 'qqp-log-body' },
          React.createElement(
            'div',
            { className: 'qqp-msg' },
            React.createElement('span', { className: 'qqp-msg-label' }, '收到'),
            React.createElement(
              'div',
              { className: 'qqp-bubble' },
              (Array.isArray(entry.incoming) ? entry.incoming : []).length > 1
                ? entry.incoming.map(function (item, index) {
                    return React.createElement(
                      'div',
                      { key: index, className: 'qqp-incoming-line' },
                      React.createElement('span', { className: 'qqp-incoming-sender' }, (item.sender || 'QQ 用户') + '：'),
                      item.text || '（空消息）'
                    );
                  })
                : text || '（空消息）'
            )
          ),
          kind === 'reply'
            ? React.createElement(
                'div',
                { className: 'qqp-msg' },
                React.createElement('span', { className: 'qqp-msg-label' }, '回复'),
                React.createElement(
                  'div',
                  { className: 'qqp-bubble out' },
                  reply || (images > 0 ? '（仅发送图片，无文字回复）' : '（空回复）')
                )
              )
            : null,
          kind === 'silence'
            ? React.createElement(
                'div',
                { className: 'qqp-msg' },
                React.createElement('span', { className: 'qqp-msg-label' }, '决定'),
                React.createElement('div', { className: 'qqp-bubble none' }, '模型选择沉默，未发送回复。')
              )
            : null,
          isError
            ? React.createElement(
                'div',
                { className: 'qqp-log-error' },
                '错误：' + (clip(entry.error || '', 300) || '处理消息时发生未知错误')
              )
            : null
        ),
        meta.length ? React.createElement('div', { className: 'qqp-log-meta' }, meta) : null
      );
    }

    function ActivityTab(props) {
      var entries = Array.isArray(props.entries) ? props.entries : [];
      var empty = entries.length === 0 && props.status !== 'loading' && !props.error;

      return React.createElement(
        'div',
        { className: 'qqp-root' },
        React.createElement(
          'div',
          { className: 'qqp-log-toolbar' },
          React.createElement('div', { className: 'qqp-section-title' }, '聊天动态'),
          React.createElement('span', { className: 'qqp-spacer' }),
          React.createElement('span', { className: 'qqp-hint' }, '每 2 秒自动刷新'),
          React.createElement(
            'span',
            { className: 'qqp-switch-row' },
            React.createElement('span', null, props.paused ? '已暂停（继续）' : '自动刷新'),
            React.createElement(Switch, {
              label: props.paused ? '继续自动刷新聊天动态' : '暂停自动刷新聊天动态',
              checked: !props.paused,
              onChange: function (next) {
                props.onTogglePause(!next);
              }
            })
          )
        ),
        React.createElement(
          'div',
          { className: 'qqp-desc' },
          '这里实时展示 QQPilot 收到的 QQ 消息，以及 AI 对每条消息的决定（回复 / 沉默 / 错误）。'
        ),
        props.error
          ? React.createElement('div', { className: 'qqp-error' }, '动态刷新失败：' + props.error)
          : null,
        React.createElement(
          'div',
          { className: 'qqp-log' },
          entries.length
            ? entries.map(function (entry, index) {
                return React.createElement(ActivityRow, {
                  key: String(entry && entry.id !== undefined && entry.id !== null ? entry.id : index),
                  entry: entry
                });
              })
            : null,
          empty
            ? React.createElement(
                'div',
                { className: 'qqp-empty' },
                React.createElement('span', null, '等待 QQPilot 消息…（在 QQPilot 里发一条 QQ 消息即可看到）')
              )
            : null,
          !entries.length && props.status === 'loading'
            ? React.createElement('div', { className: 'qqp-empty' }, '正在读取聊天动态…')
            : null
        )
      );
    }

    // ── 设置 ─────────────────────────────────────────────────────────────────
    function SettingsTab(props) {
      var config = props.config || {};
      var mode = props.mode;
      var dirty = props.draft !== props.saved;

      return React.createElement(
        'div',
        { className: 'qqp-root' },
        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '运行模式'),
          React.createElement(ModeSelector, {
            mode: mode,
            disabled: props.saving,
            onSelect: props.onSelectMode
          }),
          React.createElement('div', { className: 'qqp-hint' }, modeInfo(mode).desc)
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '模型'),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '默认跟随 DSH 全局默认模型；也可以只为 QQPilot 指定一个 provider / model（保存后下一轮生效）。'
          ),
          React.createElement(
            'div',
            { className: 'qqp-inline' },
            React.createElement('span', { className: 'qqp-field-label' }, '跟随 DSH 默认模型'),
            React.createElement(Switch, {
              label: '跟随 DSH 默认模型',
              checked: !!props.modelFollow,
              disabled: !!props.saving,
              onChange: function (next) {
                props.onModelFollow(next);
              }
            }),
            React.createElement(
              'span',
              { className: 'qqp-hint' },
              '默认：' +
                ((props.modelCatalog && props.modelCatalog.defaultSelection && props.modelCatalog.defaultSelection.provider) || '?') +
                '/' +
                ((props.modelCatalog && props.modelCatalog.defaultSelection && props.modelCatalog.defaultSelection.model) || '?')
            )
          ),
          !props.modelFollow
            ? React.createElement(
                'div',
                { className: 'qqp-model-grid' },
                React.createElement(
                  'label',
                  { className: 'qqp-field' },
                  React.createElement('span', { className: 'qqp-field-label' }, 'Provider'),
                  React.createElement(
                    'select',
                    {
                      className: 'qqp-select',
                      value: props.modelProvider || '',
                      disabled: !!props.saving,
                      onChange: function (e) {
                        props.onModelProvider(e.target.value);
                      }
                    },
                    React.createElement('option', { value: '' }, '（选择 provider）'),
                    ((props.modelCatalog && props.modelCatalog.providers) || []).map(function (provider) {
                      return React.createElement('option', { key: provider.id, value: provider.id }, provider.name || provider.id);
                    })
                  )
                ),
                React.createElement(
                  'label',
                  { className: 'qqp-field' },
                  React.createElement('span', { className: 'qqp-field-label' }, 'Model'),
                  React.createElement(
                    'select',
                    {
                      className: 'qqp-select',
                      value: props.modelModel || '',
                      disabled: !!props.saving,
                      onChange: function (e) {
                        props.onModelModel(e.target.value);
                      }
                    },
                    React.createElement('option', { value: '' }, '（选择 model）'),
                    (((props.modelCatalog && props.modelCatalog.providers) || []).filter(function (provider) {
                      return provider.id === props.modelProvider;
                    })[0] || { models: [] }).models.map(function (model) {
                      return React.createElement('option', { key: model.id, value: model.id }, model.name || model.id);
                    })
                  )
                )
              )
            : null,
          React.createElement(
            'div',
            { className: 'qqp-inline' },
            React.createElement(
              Btn,
              { onClick: props.onSaveModel, disabled: !!props.saving, primary: true },
              props.saving ? '保存中…' : '保存模型'
            ),
            React.createElement(
              'span',
              { className: 'qqp-hint' },
              '当前生效：' + (config.provider || '?') + '/' + (config.model || '?') + '（' +
                (config.modelSource === 'override' ? 'QQPilot 指定' : 'DSH 默认') + '）'
            )
          ),
          props.modelNotice
            ? React.createElement(
                'div',
                { className: 'qqp-notice ' + (props.modelNotice.kind || '') },
                props.modelNotice.text
              )
            : null,
          props.modelCatalog && props.modelCatalog.errors && props.modelCatalog.errors.length
            ? React.createElement('div', { className: 'qqp-error' }, '模型列表提示：' + props.modelCatalog.errors.join('；'))
            : null
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '工具与工作区'),
          React.createElement(
            'div',
            { className: 'qqp-model-grid' },
            React.createElement(
              'label',
              { className: 'qqp-field' },
              React.createElement('span', { className: 'qqp-field-label' }, '工具轮数上限（1-32）'),
              React.createElement('input', {
                className: 'qqp-input',
                type: 'number',
                min: 1,
                max: 32,
                step: 1,
                value: props.roundsDraft,
                disabled: !!props.saving,
                onChange: function (e) {
                  props.onRoundsDraft(e.target.value);
                }
              })
            ),
            React.createElement(
              'div',
              { className: 'qqp-field' },
              React.createElement('span', { className: 'qqp-field-label' }, '保存'),
              React.createElement(
                Btn,
                { onClick: props.onSaveRounds, disabled: !!props.saving, primary: true },
                props.saving ? '保存中…' : '保存轮数'
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '模型在一次回复里最多进行几轮工具调用；调大可以让 AI 多查几轮资料，但会更慢、更费 token。'
          ),
          React.createElement('div', { className: 'qqp-divider' }),
          React.createElement(
            'div',
            { className: 'qqp-field' },
            React.createElement('span', { className: 'qqp-field-label' }, '工作空间路径'),
            React.createElement('input', {
              className: 'qqp-input',
              type: 'text',
              value: props.workspaceDraft,
              placeholder: '留空 = 跟随 DSH 当前工作区；或填绝对路径，例如 D:\\QQPilotWorkspace',
              disabled: !!props.saving,
              onChange: function (e) {
                props.onWorkspaceDraft(e.target.value);
              }
            }),
            React.createElement(
              'div',
              { className: 'qqp-inline' },
              React.createElement(
                Btn,
                { onClick: props.onPickWorkspace, disabled: !!props.saving },
                '选择目录…'
              ),
              React.createElement(
                Btn,
                { onClick: props.onSaveWorkspace, disabled: !!props.saving, primary: true },
                props.saving ? '保存中…' : '保存工作空间'
              ),
              React.createElement(
                'span',
                { className: 'qqp-hint' },
                '当前生效：' + ((config && config.effectiveWorkspace) || '（未知）')
              )
            )
          ),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '工作空间供桥接 AI 的 DSH 工具（read / 写文件等）与本地图片路径使用；相对路径会按 DSH 进程目录解析，目录不存在时会在保存时自动创建。'
          ),
          React.createElement('div', { className: 'qqp-divider' }),
          React.createElement('div', { className: 'qqp-section-title' }, '上下文模式'),
          React.createElement(
            'div',
            { className: 'qqp-mode-select', role: 'group', 'aria-label': '上下文模式' },
            [
              { id: 'all', label: '完整上下文', short: '参考所有用户的消息' },
              { id: 'latest', label: '旧版单条', short: '只看最后一条消息' }
            ].map(function (item) {
              var active = (config.contextMode || 'all') === item.id;
              return React.createElement(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  'aria-pressed': active ? 'true' : 'false',
                  className: 'qqp-mode-btn' + (active ? ' active' : ''),
                  disabled: !!props.saving,
                  onClick: function () {
                    if (!props.saving) props.onSelectContextMode(item.id);
                  }
                },
                React.createElement('span', { className: 'qqp-mode-name' }, item.label),
                React.createElement('span', { className: 'qqp-mode-sub' }, item.short)
              );
            })
          ),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            (config.contextMode || 'all') === 'all'
              ? 'QQPilot 一次请求可能包含多个用户的多条消息。完整上下文会把全部消息交给模型，并在系统提示里列出本次参与的用户与尚未回复的消息，模型可综合全部内容回复（必要时一次回复多条并 @ 对方）。'
              : '旧版单条：只把最后一条用户消息和系统提示交给模型，忽略请求里更早的用户/历史消息（省 token，但无法参考其他用户刚说的话）。'
          ),
          props.workspaceNotice
            ? React.createElement(
                'div',
                { className: 'qqp-notice ' + (props.workspaceNotice.kind || '') },
                props.workspaceNotice.text
              )
            : null
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '附加指令'),
          React.createElement('textarea', {
            className: 'qqp-textarea',
            value: props.draft,
            rows: 4,
            placeholder: '例如：回复尽量简短，用中文，不要使用表情。',
            onChange: function (e) {
              props.onDraft(e.target.value);
            }
          }),
          React.createElement(
            'div',
            { className: 'qqp-inline' },
            React.createElement(
              Btn,
              { onClick: props.onSaveInstructions, disabled: !dirty || props.saving, primary: true },
              props.saving ? '保存中…' : '保存'
            ),
            dirty ? React.createElement('span', { className: 'qqp-hint' }, '有未保存的修改') : null
          ),
          React.createElement('div', { className: 'qqp-hint' }, '附加指令会追加到系统提示词中，用来约束回复风格。')
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, 'DSH 工具'),
          React.createElement(
            'div',
            { className: 'qqp-hint' },
            '允许桥接后的 AI 在工具模式下调用 DSH 工具（例如先 web_search 查资料、read 读文件），最后仍通过 qqpilot_reply / qqpilot_do_not_reply 收尾。'
          ),
          React.createElement(
            'div',
            { className: 'qqp-mode-select', role: 'group', 'aria-label': 'DSH 工具策略' },
            DSH_TOOL_POLICIES.map(function (item) {
              var active = (config.dshTools || 'safe') === item.id;
              return React.createElement(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  'aria-pressed': active ? 'true' : 'false',
                  className: 'qqp-mode-btn' + (active ? ' active' : ''),
                  disabled: !!props.saving,
                  onClick: function () {
                    if (!props.saving) props.onSelectDshTools(item.id);
                  }
                },
                React.createElement('span', { className: 'qqp-mode-name' }, item.label),
                React.createElement('span', { className: 'qqp-mode-sub' }, item.short)
              );
            })
          ),
          React.createElement('div', { className: 'qqp-hint' }, dshToolPolicyInfo(config.dshTools).desc),
          React.createElement(
            'div',
            { className: 'qqp-tool-list' },
            (props.availableDshTools || []).length
              ? props.availableDshTools.map(function (name) {
                  return React.createElement('span', { key: name, className: 'qqp-chip' }, name);
                })
              : React.createElement('span', { className: 'qqp-hint' }, '当前没有向模型提供 DSH 工具（策略为关闭、或不在工具模式）。')
          ),
          React.createElement(
            'div',
            { className: 'qqp-inline' },
            React.createElement(
              Btn,
              { onClick: props.onToolsTest, disabled: !!props.toolsTesting },
              props.toolsTesting ? '测试中…' : '测试 DSH 工具'
            ),
            React.createElement('span', { className: 'qqp-hint' }, '通过真实工具管线读取本插件 package.json，验证调用链路。')
          ),
          props.toolsTest
            ? React.createElement(
                'div',
                { className: 'qqp-notice ' + (props.toolsTest.ok ? 'ok' : 'err') },
                props.toolsTest.ok
                  ? '工具调用成功（' + (props.toolsTest.tool || 'read') + ' / ' + (props.toolsTest.elapsedMs || 0) + ' ms）：' +
                    clip(props.toolsTest.preview || '', 240)
                  : '工具调用失败：' + clip(props.toolsTest.error || '未知错误', 240)
              )
            : null,
          props.toolsError ? React.createElement('div', { className: 'qqp-error' }, '工具测试失败：' + props.toolsError) : null,
          React.createElement(
            'div',
            { className: 'qqp-note' },
            '危险工具（pwsh / bash / write / edit / subagent / workflow / plugin_manager）始终在拒绝名单里；可在 cordis.patch.yml 的 dshToolDeny 中调整。'
          )
        ),

        React.createElement(
          'div',
          { className: 'qqp-card' },
          React.createElement('div', { className: 'qqp-section-title' }, '模型与持久化'),
          React.createElement(
            'div',
            { className: 'qqp-meta' },
            React.createElement('span', null, '模型：' + (config.provider || '未知') + '/' + (config.model || '未知')),
            typeof config.maxToolRounds === 'number'
              ? React.createElement('span', null, '工具轮数上限：' + config.maxToolRounds)
              : null,
            React.createElement(
              'span',
              null,
              '兼容回退：' + (config.fallbackToCompat ? '开启' : '关闭')
            )
          ),
          React.createElement(
            'div',
            { className: 'qqp-note' },
            '以上设置保存在 ',
            React.createElement('code', null, '~/.dsh/qqpilot-dsh-plugin.json'),
            '，修改后立即生效，无需重启 DSH；接口地址随 DSH 端口变化。'
          )
        )
      );
    }

    // ── chat-window dock: live QQPilot status inside the conversation ────────
    function DockRow(props) {
      var entry = props.entry || {};
      var kind = entry.kind === 'reply' || entry.kind === 'silence' || entry.kind === 'error' ? entry.kind : 'silence';
      var badge = decisionInfo(kind);
      var images = countOf(entry.images);
      var elapsed = typeof entry.elapsedMs === 'number' && isFinite(entry.elapsedMs) ? entry.elapsedMs : null;
      var tokens = usageTotal(entry.usage);
      var tools = Array.isArray(entry.tools) ? entry.tools : [];
      var msgCount = typeof entry.messages === 'number' && isFinite(entry.messages) ? entry.messages : 0;
      var participants = Array.isArray(entry.participants) ? entry.participants : [];
      var userCount = typeof entry.userCount === 'number' && isFinite(entry.userCount) ? entry.userCount : 0;
      var text = clip(entry.text, 160);
      var reply = clip(entry.reply, 160);
      var meta = [];
      meta.push(React.createElement('span', { key: 'mode' }, modeLabel(entry.mode)));
      if (participants.length > 1) meta.push(React.createElement('span', { key: 'users' }, '用户 ' + participants.length + ' 位'));
      if (userCount > 1) meta.push(React.createElement('span', { key: 'inputs' }, '输入 ' + userCount + ' 条'));
      if (msgCount > 1) meta.push(React.createElement('span', { key: 'msgs' }, msgCount + ' 条消息'));
      if (images > 0) meta.push(React.createElement('span', { key: 'img' }, '图片 ' + images + ' 张'));
      if (elapsed !== null) meta.push(React.createElement('span', { key: 'ms' }, elapsed + ' ms'));
      if (tokens !== null) meta.push(React.createElement('span', { key: 'tok' }, tokens + ' tokens'));
      if (tools.length) meta.push(React.createElement('span', { key: 'tools' }, 'DSH 工具：' + tools.join(', ')));

      return React.createElement(
        'div',
        { className: 'qqp-dock-row' },
        React.createElement(
          'div',
          { className: 'qqp-dock-line' },
          React.createElement('span', { className: 'qqp-dock-time' }, formatTime(entry.at)),
          React.createElement('span', { className: 'qqp-dock-name' }, entry.sender || 'QQ 用户'),
          React.createElement('span', { className: 'qqp-badge ' + badge.cls }, badge.label)
        ),
        React.createElement(
          'div',
          { className: 'qqp-dock-line' },
          React.createElement('span', { className: 'qqp-dock-name' }, '收到'),
          React.createElement('span', { className: 'qqp-dock-text' }, text || '（空消息）')
        ),
        kind === 'reply'
          ? React.createElement(
              'div',
              { className: 'qqp-dock-line' },
              React.createElement('span', { className: 'qqp-dock-name' }, '回复'),
              React.createElement(
                'span',
                { className: 'qqp-dock-reply' },
                reply || (images > 0 ? '（仅发送图片）' : '（空回复）')
              )
            )
          : null,
        kind === 'error'
          ? React.createElement(
              'div',
              { className: 'qqp-dock-line' },
              React.createElement('span', { className: 'qqp-dock-name' }, '错误'),
              React.createElement('span', { className: 'qqp-dock-text qqp-dock-error' }, clip(entry.error || '处理消息时发生未知错误', 220))
            )
          : null,
        meta.length ? React.createElement('div', { className: 'qqp-dock-meta' }, meta) : null
      );
    }

    function ChatDock() {
      var aes = React.useState([]);
      var entries = aes[0];
      var setEntries = aes[1];
      var ss = React.useState('loading');
      var status = ss[0];
      var setStatus = ss[1];
      var es = React.useState(null);
      var error = es[0];
      var setError = es[1];
      var xs = React.useState(true);
      var expanded = xs[0];
      var setExpanded = xs[1];
      var ms = React.useState('agent');
      var mode = ms[0];
      var setMode = ms[1];
      var latestIdRef = React.useRef(0);

      React.useEffect(function () {
        var alive = true;
        var inflight = false;

        function pull() {
          if (!alive || inflight) return;
          inflight = true;
          request('GET', '/qqpilot/api/activity?since=' + latestIdRef.current + '&limit=20')
            .then(function (data) {
              inflight = false;
              if (!alive) return;
              if (!data || data.ok !== true) {
                throw new Error((data && data.error) || '读取聊天动态失败');
              }
              var list = Array.isArray(data.activity) ? data.activity : [];
              if (typeof data.latestId === 'number' && data.latestId > latestIdRef.current) {
                latestIdRef.current = data.latestId;
              } else if (list.length) {
                var i;
                for (i = 0; i < list.length; i++) {
                  if (list[i] && typeof list[i].id === 'number' && list[i].id > latestIdRef.current) {
                    latestIdRef.current = list[i].id;
                  }
                }
              }
              setEntries(function (prev) {
                return mergeActivity(prev, list);
              });
              if (data.config) setMode(configMode(data.config));
              setStatus('ok');
              setError(null);
            })
            .catch(function (err) {
              inflight = false;
              if (!alive) return;
              setStatus('error');
              setError(errText(err));
            });
        }

        pull();
        var timer = setInterval(pull, 2000);
        return function () {
          alive = false;
          clearInterval(timer);
        };
      }, []);

      var latest = entries.length ? entries[0] : null;
      var summary = latest
        ? formatTime(latest.at) + ' · ' + (latest.sender || 'QQ') + '：' + clip(latest.text || '', 60)
        : status === 'error'
          ? '聊天动态暂不可用'
          : '等待 QQPilot 消息…';
      var rows = entries.slice(0, 6);

      function toggle() {
        setExpanded(!expanded);
      }

      return React.createElement(
        'div',
        { className: 'qqp-dock' },
        React.createElement(
          'div',
          {
            className: 'qqp-dock-head',
            role: 'button',
            tabIndex: 0,
            'aria-expanded': expanded ? 'true' : 'false',
            onClick: toggle,
            onKeyDown: function (e) {
              if (e && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                toggle();
              }
            }
          },
          React.createElement('span', {
            className: 'qqp-dock-dot ' + (status === 'error' ? 'err' : status === 'loading' ? 'busy' : '')
          }),
          React.createElement('span', { className: 'qqp-dock-title' }, 'QQPilot'),
          React.createElement('span', { className: 'qqp-pill mode' }, modeLabel(mode)),
          React.createElement('span', { className: 'qqp-dock-summary' }, summary),
          React.createElement('span', { className: 'qqp-dock-chevron' }, expanded ? '收起' : '展开')
        ),
        expanded
          ? React.createElement(
              'div',
              { className: 'qqp-dock-body' },
              error ? React.createElement('div', { className: 'qqp-dock-empty qqp-dock-error' }, '聊天动态暂不可用：' + error) : null,
              !error && rows.length === 0
                ? React.createElement(
                    'div',
                    { className: 'qqp-dock-empty' },
                    '等待 QQPilot 消息…在 QQPilot 里发一条 QQ 消息即可看到；完整记录见 设置 → QQPilot 接入 → 聊天动态。'
                  )
                : null,
              rows.map(function (entry) {
                return React.createElement(DockRow, { key: entry.id, entry: entry });
              })
            )
          : null
      );
    }

    // ── main settings card ───────────────────────────────────────────────────
    function SettingsCard() {
      var cs = React.useState(null);
      var config = cs[0];
      var setConfig = cs[1];
      var ss = React.useState('loading');
      var status = ss[0];
      var setStatus = ss[1];
      var es = React.useState(null);
      var error = es[0];
      var setError = es[1];
      var eps = React.useState('');
      var endpoint = eps[0];
      var setEndpoint = eps[1];
      var sts = React.useState(null);
      var stats = sts[0];
      var setStats = sts[1];
      var us = React.useState(null);
      var uptimeMs = us[0];
      var setUptimeMs = us[1];
      var ds = React.useState('');
      var draft = ds[0];
      var setDraft = ds[1];
      var svs = React.useState('');
      var saved = svs[0];
      var setSaved = svs[1];
      var bss = React.useState(false);
      var saving = bss[0];
      var setSaving = bss[1];
      var ns = React.useState(null);
      var notice = ns[0];
      var setNotice = ns[1];
      var cps = React.useState(false);
      var copied = cps[0];
      var setCopied = cps[1];
      var tts = React.useState('在吗');
      var testText = tts[0];
      var setTestText = tts[1];
      var tbs = React.useState(false);
      var testing = tbs[0];
      var setTesting = tbs[1];
      var trs = React.useState(null);
      var testResult = trs[0];
      var setTestResult = trs[1];
      var tes = React.useState(null);
      var testError = tes[0];
      var setTestError = tes[1];
      var ats = React.useState([]);
      var availableDshTools = ats[0];
      var setAvailableDshTools = ats[1];
      var tls = React.useState(null);
      var toolsTest = tls[0];
      var setToolsTest = tls[1];
      var tlbs = React.useState(false);
      var toolsTesting = tlbs[0];
      var setToolsTesting = tlbs[1];
      var tles = React.useState(null);
      var toolsError = tles[0];
      var setToolsError = tles[1];
      var mcs = React.useState(null);
      var modelCatalog = mcs[0];
      var setModelCatalog = mcs[1];
      var mcp = React.useState('');
      var modelProvider = mcp[0];
      var setModelProvider = mcp[1];
      var mcm = React.useState('');
      var modelModel = mcm[0];
      var setModelModel = mcm[1];
      var mcf = React.useState(true);
      var modelFollow = mcf[0];
      var setModelFollow = mcf[1];
      var mcn = React.useState(null);
      var modelNotice = mcn[0];
      var setModelNotice = mcn[1];
      var rds = React.useState('4');
      var roundsDraft = rds[0];
      var setRoundsDraft = rds[1];
      var wds = React.useState('');
      var workspaceDraft = wds[0];
      var setWorkspaceDraft = wds[1];
      var wns = React.useState(null);
      var workspaceNotice = wns[0];
      var setWorkspaceNotice = wns[1];
      var tas = React.useState('overview');
      var activeTab = tas[0];
      var setActiveTab = tas[1];
      var aes = React.useState([]);
      var activity = aes[0];
      var setActivity = aes[1];
      var aps = React.useState(false);
      var paused = aps[0];
      var setPaused = aps[1];
      var ass = React.useState('idle');
      var activityStatus = ass[0];
      var setActivityStatus = ass[1];
      var aerrs = React.useState(null);
      var activityError = aerrs[0];
      var setActivityError = aerrs[1];
      var latestIdRef = React.useRef(0);

      function load() {
        setStatus('loading');
        setError(null);
        setCopied(false);
        request('GET', '/qqpilot/api/config')
          .then(function (data) {
            if (!data || data.ok !== true) {
              throw new Error((data && data.error) || '读取配置失败');
            }
            var cfg = data.config || {};
            setConfig(cfg);
            setEndpoint(data.endpoint || cfg.endpoint || '');
            setStats(data.stats || null);
            setAvailableDshTools(Array.isArray(data.availableDshTools) ? data.availableDshTools : []);
            if (typeof data.uptimeMs === 'number') setUptimeMs(data.uptimeMs);
            setDraft(cfg.extraInstructions || '');
            setSaved(cfg.extraInstructions || '');
            setRoundsDraft(String(typeof cfg.maxToolRounds === 'number' ? cfg.maxToolRounds : 4));
            setWorkspaceDraft(cfg.workspaceRoot || '');
            setStatus('ok');
            loadModels(cfg);
          })
          .catch(function (err) {
            setStatus('error');
            setError(errText(err));
          });
      }

      function loadModels(cfg) {
        request('GET', '/qqpilot/api/models')
          .then(function (data) {
            if (!data || data.ok !== true) {
              throw new Error((data && data.error) || '读取模型列表失败');
            }
            setModelCatalog(data);
            var overrideProvider = cfg.providerOverride || '';
            var overrideModel = cfg.modelOverride || '';
            setModelFollow(!(overrideProvider || overrideModel));
            setModelProvider(overrideProvider || (data.current && data.current.provider) || '');
            setModelModel(overrideModel || (data.current && data.current.model) || '');
            setModelNotice(null);
          })
          .catch(function (err) {
            setModelNotice({ kind: 'err', text: '读取模型列表失败：' + errText(err) });
          });
      }

      React.useEffect(function () {
        load();
      }, []);

      // Poll activity feed while the 聊天动态 tab is mounted and not paused.
      React.useEffect(function () {
        if (activeTab !== 'activity' || paused) return undefined;
        var alive = true;
        var inflight = false;

        function pull() {
          if (!alive || inflight) return;
          inflight = true;
          request('GET', '/qqpilot/api/activity?since=' + latestIdRef.current + '&limit=60')
            .then(function (data) {
              inflight = false;
              if (!alive) return;
              if (!data || data.ok !== true) {
                throw new Error((data && data.error) || '读取聊天动态失败');
              }
              var list = Array.isArray(data.activity) ? data.activity : [];
              if (typeof data.latestId === 'number' && data.latestId > latestIdRef.current) {
                latestIdRef.current = data.latestId;
              } else if (list.length) {
                var i;
                for (i = 0; i < list.length; i++) {
                  if (list[i] && typeof list[i].id === 'number' && list[i].id > latestIdRef.current) {
                    latestIdRef.current = list[i].id;
                  }
                }
              }
              setActivity(function (prev) {
                return mergeActivity(prev, list);
              });
              if (data.stats) setStats(data.stats);
              if (typeof data.uptimeMs === 'number') setUptimeMs(data.uptimeMs);
              setActivityStatus('ok');
              setActivityError(null);
            })
            .catch(function (err) {
              inflight = false;
              if (!alive) return;
              setActivityError(errText(err));
              setActivityStatus('error');
            });
        }

        setActivityStatus('loading');
        pull();
        var timer = setInterval(pull, 2000);
        return function () {
          alive = false;
          clearInterval(timer);
        };
      }, [activeTab, paused]);

      function patchConfig(patch, okMessage) {
        var prev = config || {};
        var next = {};
        var key;
        for (key in prev) {
          if (Object.prototype.hasOwnProperty.call(prev, key)) next[key] = prev[key];
        }
        for (key in patch) {
          if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
        }
        setConfig(next);
        setSaving(true);
        setNotice(null);
        return request('POST', '/qqpilot/api/config', patch)
          .then(function (data) {
            if (!data || data.ok !== true) {
              throw new Error((data && data.error) || '保存失败');
            }
            if (data.config) setConfig(data.config);
            if (data.endpoint) setEndpoint(data.endpoint);
            if (data.stats) setStats(data.stats);
            if (Array.isArray(data.availableDshTools)) setAvailableDshTools(data.availableDshTools);
            if (okMessage) setNotice({ kind: 'ok', text: okMessage });
            setSaving(false);
            setStatus('ok');
            return true;
          })
          .catch(function (err) {
            setConfig(prev);
            setSaving(false);
            setNotice({ kind: 'err', text: '保存失败：' + errText(err) });
            return false;
          });
      }

      function selectMode(mode) {
        if (!config || saving) return;
        var current = configMode(config);
        if (mode === current) return;
        patchConfig({ mode: mode }, '运行模式已切换为' + modeLabel(mode));
      }

      function selectContextMode(mode) {
        if (!config || saving) return;
        if ((config.contextMode || 'all') === mode) return;
        patchConfig(
          { contextMode: mode },
          mode === 'all' ? '已切换到完整上下文模式' : '已切换到旧版单条模式'
        );
      }

      function selectDshTools(policy) {
        if (!config || saving) return;
        if ((config.dshTools || 'safe') === policy) return;
        patchConfig({ dshTools: policy }, 'DSH 工具策略已保存：' + dshToolPolicyInfo(policy).label);
      }

      function changeModelProvider(provider) {
        setModelProvider(provider);
        var entry = null;
        var providers = (modelCatalog && modelCatalog.providers) || [];
        var i;
        for (i = 0; i < providers.length; i++) {
          if (providers[i].id === provider) entry = providers[i];
        }
        var hasModel = false;
        if (entry && entry.models) {
          for (i = 0; i < entry.models.length; i++) {
            if (entry.models[i].id === modelModel) hasModel = true;
          }
          if (!hasModel && entry.models.length) setModelModel(entry.models[0].id);
        }
      }

      function changeModelFollow(follow) {
        setModelFollow(!!follow);
        setModelNotice(null);
      }

      function saveModel() {
        if (saving) return;
        if (!modelFollow && (!modelProvider || !modelModel)) {
          setModelNotice({ kind: 'err', text: '请选择 provider 和 model，或打开“跟随 DSH 默认模型”。' });
          return;
        }
        var payload = modelFollow ? { provider: '', model: '' } : { provider: modelProvider, model: modelModel };
        patchConfig(payload, '模型已保存').then(function (ok) {
          if (!ok) return;
          setModelNotice({
            kind: 'ok',
            text: modelFollow ? '已恢复为跟随 DSH 默认模型' : '已指定模型 ' + modelProvider + '/' + modelModel + '（下一轮请求生效）',
          });
        });
      }

      function saveRounds() {
        if (saving) return;
        var n = parseInt(String(roundsDraft || '').trim(), 10);
        if (!isFinite(n) || n < 1 || n > 32) {
          setWorkspaceNotice({ kind: 'err', text: '工具轮数上限必须是 1-32 的整数。' });
          return;
        }
        patchConfig({ maxToolRounds: n }, '工具轮数上限已保存').then(function (ok) {
          if (!ok) return;
          setWorkspaceNotice({ kind: 'ok', text: '工具轮数上限已设为 ' + n + '（下一轮请求生效）' });
        });
      }

      function saveWorkspace() {
        if (saving) return;
        var path = String(workspaceDraft || '').trim();
        patchConfig({ workspaceRoot: path }, '工作空间已保存').then(function (ok) {
          if (!ok) return;
          setWorkspaceNotice({
            kind: 'ok',
            text: path ? '工作空间已设为 ' + path : '已恢复为跟随 DSH 默认工作区',
          });
        });
      }

      function pickWorkspace() {
        if (saving) return;
        if (typeof pickDirectoryHandler !== 'function') {
          setWorkspaceNotice({ kind: 'err', text: '当前环境不支持系统目录选择器，请手动填写路径。' });
          return;
        }
        setWorkspaceNotice({ kind: '', text: '正在打开系统目录选择器…' });
        pickDirectoryHandler()
          .then(function (dir) {
            if (!dir) {
              setWorkspaceNotice(null);
              return;
            }
            setWorkspaceDraft(dir);
            setWorkspaceNotice({ kind: 'ok', text: '已选择：' + dir + '（点“保存工作空间”后生效）' });
          })
          .catch(function (err) {
            setWorkspaceNotice({ kind: 'err', text: '选择目录失败：' + errText(err) });
          });
      }

      function runToolsTest() {
        if (toolsTesting) return;
        setToolsTesting(true);
        setToolsTest(null);
        setToolsError(null);
        request('POST', '/qqpilot/api/tools/test', {})
          .then(function (data) {
            setToolsTesting(false);
            setToolsTest(data || { ok: false, error: '空响应' });
          })
          .catch(function (err) {
            setToolsTesting(false);
            setToolsError(errText(err));
          });
      }

      function saveInstructions() {
        if (saving) return;
        var text = draft || '';
        patchConfig({ extraInstructions: text }, '附加指令已保存').then(function (ok) {
          if (ok) setSaved(text);
        });
      }

      function copyEndpoint() {
        if (!endpoint) return;
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(endpoint).then(
              function () {
                setCopied(true);
              },
              function () {
                /* clipboard unavailable — ignore */
              }
            );
          }
        } catch (e) {
          /* ignore */
        }
      }

      function runTest() {
        if (testing) return;
        var text = String(testText || '').trim() || '在吗';
        setTesting(true);
        setTestResult(null);
        setTestError(null);
        request('POST', '/qqpilot/api/test', { text: text })
          .then(function (data) {
            setTesting(false);
            if (!data || data.ok !== true) {
              throw new Error((data && data.error) || '测试失败');
            }
            setTestResult(data);
          })
          .catch(function (err) {
            setTesting(false);
            setTestError(errText(err));
          });
      }

      function onTestKeyDown(e) {
        if (e && e.key === 'Enter') {
          e.preventDefault();
          runTest();
        }
      }

      if (!config) {
        return React.createElement(
          'div',
          { className: 'qqp-root' },
          React.createElement(Header, {
            status: status,
            mode: 'agent',
            uptimeMs: uptimeMs,
            onRefresh: load
          }),
          error
            ? React.createElement('div', { className: 'qqp-error' }, '加载配置失败：' + error)
            : React.createElement('div', { className: 'qqp-desc' }, '正在加载 QQPilot 接入配置…'),
          error ? React.createElement(Btn, { onClick: load }, '重新加载') : null
        );
      }

      var mode = configMode(config);

      return React.createElement(
        'div',
        { className: 'qqp-root' },
        React.createElement(Header, {
          status: status,
          mode: mode,
          uptimeMs: uptimeMs,
          onRefresh: load
        }),
        React.createElement(Tabs, { active: activeTab, onChange: setActiveTab }),
        notice ? React.createElement('div', { className: 'qqp-notice ' + (notice.kind || '') }, notice.text) : null,
        error ? React.createElement('div', { className: 'qqp-error' }, '刷新失败：' + error) : null,

        activeTab === 'overview'
          ? React.createElement(OverviewTab, {
              config: config,
              stats: stats,
              endpoint: endpoint,
              mode: mode,
              saving: saving,
              copied: copied,
              testText: testText,
              testing: testing,
              testResult: testResult,
              testError: testError,
              onSelectMode: selectMode,
              onCopyEndpoint: copyEndpoint,
              onTestText: setTestText,
              onTest: runTest,
              onTestKeyDown: onTestKeyDown
            })
          : null,

        activeTab === 'activity'
          ? React.createElement(ActivityTab, {
              entries: activity,
              status: activityStatus,
              error: activityError,
              paused: paused,
              onTogglePause: setPaused
            })
          : null,

        activeTab === 'settings'
          ? React.createElement(SettingsTab, {
              config: config,
              mode: mode,
              draft: draft,
              saved: saved,
              saving: saving,
              availableDshTools: availableDshTools,
              toolsTest: toolsTest,
              toolsTesting: toolsTesting,
              toolsError: toolsError,
              modelCatalog: modelCatalog,
              modelProvider: modelProvider,
              modelModel: modelModel,
              modelFollow: modelFollow,
              modelNotice: modelNotice,
              roundsDraft: roundsDraft,
              workspaceDraft: workspaceDraft,
              workspaceNotice: workspaceNotice,
              onModelFollow: changeModelFollow,
              onModelProvider: changeModelProvider,
              onModelModel: setModelModel,
              onSaveModel: saveModel,
              onRoundsDraft: setRoundsDraft,
              onWorkspaceDraft: setWorkspaceDraft,
              onSaveRounds: saveRounds,
              onSaveWorkspace: saveWorkspace,
              onPickWorkspace: pickWorkspace,
              onSelectContextMode: selectContextMode,
              onSelectMode: selectMode,
              onSelectDshTools: selectDshTools,
              onToolsTest: runToolsTest,
              onDraft: setDraft,
              onSaveInstructions: saveInstructions
            })
          : null
      );
    }

    var inject = ['slots'];

    function apply(ctx) {
      var style = document.createElement('style');
      style.setAttribute('data-plugin', 'qqpilot-dsh-plugin');
      style.textContent = CSS;
      (document.head || document.documentElement).appendChild(style);

      ctx.effect(function () {
        return function () {
          if (style.parentNode) style.parentNode.removeChild(style);
        };
      }, 'qqpilot-dsh-plugin: styles');

      // System directory picker comes from the DSH Client uiWorkspace service.
      function resolveUiWorkspace() {
        try {
          if (ctx && typeof ctx.get === 'function') return ctx.get('uiWorkspace');
        } catch (e) {
          /* fall through to the service accessor */
        }
        try {
          return ctx ? ctx.uiWorkspace : undefined;
        } catch (e) {
          return undefined;
        }
      }
      pickDirectoryHandler = function () {
        var service = resolveUiWorkspace();
        if (!service || typeof service.pickDirectory !== 'function') {
          return Promise.reject(new Error('当前 DSH 环境没有 uiWorkspace.pickDirectory 服务'));
        }
        return Promise.resolve(service.pickDirectory());
      };
      ctx.effect(function () {
        return function () {
          pickDirectoryHandler = null;
        };
      }, 'qqpilot-dsh-plugin: directory picker');

      // Surface uncaught client failures in the host log for diagnosis.
      var onWindowError = function (e) {
        reportClientError('window.error', (e && (e.error || e.message)) || 'unknown error', e);
      };
      var onUnhandledRejection = function (e) {
        reportClientError('unhandledrejection', (e && e.reason) || 'unhandled rejection', e);
      };
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('error', onWindowError);
        window.addEventListener('unhandledrejection', onUnhandledRejection);
      }
      ctx.effect(function () {
        return function () {
          if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('error', onWindowError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
          }
        };
      }, 'qqpilot-dsh-plugin: client error reporting');

      var SafeSettingsCard = withErrorBoundary('settings', SettingsCard);
      var SafeChatDock = withErrorBoundary('chat-dock', ChatDock);

      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          {
            name: 'settings.section',
            id: 'qqpilot',
            order: 62,
            label: function () {
              return 'QQPilot 接入';
            }
          },
          SafeSettingsCard
        );
      });

      // Live QQPilot status strip directly inside the chat window (above the
      // composer), kept in addition to the full settings page.
      ctx.slots.inject('conversation.input.dock', function () {
        return ctx.slots.register(
          {
            name: 'conversation.input.dock',
            id: 'qqpilot-status',
            order: 70
          },
          SafeChatDock
        );
      });
    }

    exports.inject = inject;
    exports.apply = apply;
    exports.name = 'qqpilot-dsh-plugin';
    return module.exports;
  }
});
