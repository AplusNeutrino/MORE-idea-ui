// ==UserScript==
// @name         NGA · Visual Studio Code 隐蔽工作区
// @namespace    https://github.com/AplusNeutrino/MORE-idea-ui
// @version      0.1.2
// @description  将 NGA 页面伪装为可切换 TypeScript / Python 的 Visual Studio Code 工作区，同时保留原生导航、阅读与发帖能力。
// @author       AplusNeutrino
// @match        https://bbs.nga.cn/*
// @match        https://ngabbs.com/*
// @match        https://nga.178.com/*
// @match        https://g.nga.cn/*
// @match        https://bbs.ngacn.cc/*
// @match        https://img4.nga.cn/common_res/ubbeditor_v2/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  const APP_ID = "nga-vsc-app";
  const STYLE_ID = "nga-vsc-style";
  const EARLY_STYLE_ID = "nga-vsc-early-style";
  const FAVICON_ID = "nga-vsc-favicon";
  const FRAME_HOST = "img4.nga.cn";
  const FRAME_PATH = "/common_res/ubbeditor_v2/";
  const FAKE_TITLE = "workspace — Visual Studio Code";
  const THEME_KEY = "nga-vsc-theme";
  const LANGUAGE_KEY = "nga-vsc-language";
  const SIDEBAR_KEY = "nga-vsc-sidebar";
  const SIDEBAR_VISIBLE_KEY = "nga-vsc-sidebar-visible";
  const TREE_COLLAPSED_KEY = "nga-vsc-tree-collapsed";
  const ZEN_KEY = "nga-vsc-zen-preferred";
  const ROOT_CLASS = "nga-vsc-root";
  const READY_CLASS = "nga-vsc-ready";
  const NATIVE_CLASS = "nga-vsc-native-debug";
  const FAILSAFE_MS = 2800;
  const RENDER_DELAY = 90;

  const state = {
    renderTimer: 0,
    renderSignature: "",
    identityBusy: false,
    identityObserver: null,
    sourceObserver: null,
    originalTitle: "",
    sidebarMode: "explorer",
    sidebarVisible: true,
    collapsedNodes: new Set(),
    terminalOpen: true,
    quickReply: null,
    resources: [],
    nativeActions: new Map(),
    searchTargets: new Map(),
    actionSerial: 0,
    searchSerial: 0,
    booted: false,
    failed: false,
    debugNative: false
  };

  const ICON_PATHS = {
    files: "M3 3h6l2 2h10v16H3V3zm2 4v12h14V7H5z",
    search: "M9.5 3a6.5 6.5 0 104.05 11.58L19.97 21 21 19.97l-6.42-6.42A6.5 6.5 0 009.5 3zm0 2a4.5 4.5 0 110 9 4.5 4.5 0 010-9z",
    branch: "M7 3a3 3 0 11-2 2.83v12.34A3 3 0 117 21a3 3 0 01-2-5.83V8.83A3 3 0 017 3zm10 0a3 3 0 11-1 5.83V11a4 4 0 01-4 4H9v-2h3a2 2 0 002-2V8.83A3 3 0 0117 3z",
    run: "M6 4l14 8-14 8V4zm2 3.45v9.1L15.96 12 8 7.45z",
    blocks: "M4 4h7v7H4V4zm2 2v3h3V6H6zm7-2h7v7h-7V4zm2 2v3h3V6h-3zM4 13h7v7H4v-7zm2 2v3h3v-3H6zm7-2h7v7h-7v-7zm2 2v3h3v-3h-3z",
    bookmark: "M6 3h12v19l-6-4-6 4V3zm2 2v13.26l4-2.67 4 2.67V5H8z",
    account: "M12 3a5 5 0 110 10 5 5 0 010-10zm0 2a3 3 0 100 6 3 3 0 000-6zm0 10c5 0 9 2.24 9 5v1H3v-1c0-2.76 4-5 9-5zm0 2c-3.1 0-5.58.93-6.62 2h13.24c-1.04-1.07-3.52-2-6.62-2z",
    gear: "M10.9 2h2.2l.45 2.1c.55.18 1.08.4 1.56.68l1.8-1.17 1.56 1.56-1.17 1.8c.28.48.5 1.01.68 1.56l2.1.45v2.2l-2.1.45c-.18.55-.4 1.08-.68 1.56l1.17 1.8-1.56 1.56-1.8-1.17c-.48.28-1.01.5-1.56.68l-.45 2.1h-2.2l-.45-2.1a8.2 8.2 0 01-1.56-.68l-1.8 1.17-1.56-1.56 1.17-1.8a8.2 8.2 0 01-.68-1.56l-2.1-.45v-2.2l2.1-.45c.18-.55.4-1.08.68-1.56l-1.17-1.8 1.56-1.56 1.8 1.17c.48-.28 1.01-.5 1.56-.68L10.9 2zm1.1 5a3 3 0 100 6 3 3 0 000-6z",
    chevron: "M9 5l7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5z",
    fileTs: "M5 2h10l4 4v16H5V2zm2 2v16h10V7h-3V4H7z",
    folder: "M3 5h7l2 2h9v13H3V5zm2 4v9h14V9H5z",
    close: "M6.7 5.3L12 10.6l5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4z",
    zen: "M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"
  };

  const VSCODE_FAVICON = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#23a8f2" d="M46.8 3.7L23.6 26.2 9.7 15.7 3.8 19l12.7 13L3.8 45l5.9 3.3 13.9-10.5 23.2 22.5L60.2 55V9L46.8 3.7zm0 15.6v25.4L31.2 32l15.6-12.7z"/></svg>'
  )}`;

  if (location.hostname === FRAME_HOST && location.pathname.startsWith(FRAME_PATH)) {
    bootEditorFrame();
    return;
  }

  if (window.top !== window.self) return;

  installEarlyShield();
  installIdentityGuard();
  const failsafe = window.setTimeout(failOpen, FAILSAFE_MS);

  whenBodyReady(() => {
    if (state.failed) return;
    try {
      injectStyles();
      ensureWorkbench();
      bindGlobalEvents();
      patchHistory();
      observeSource();
      applyWorkbench(true);
      state.booted = true;
      document.documentElement.classList.remove("nga-vsc-boot");
      document.documentElement.classList.add(ROOT_CLASS, READY_CLASS);
      window.clearTimeout(failsafe);
    } catch (error) {
      console.error("[NGA VS Code] initialization failed", error);
      failOpen();
    }
  });

  function whenBodyReady(callback) {
    if (document.body) { callback(); return; }
    let finished = false;
    const observer = new MutationObserver(() => run());
    const run = () => {
      if (finished || !document.body) return;
      finished = true;
      observer.disconnect();
      callback();
    };
    observer.observe(document.documentElement || document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", run, { once: true });
  }

  function installEarlyShield() {
    const install = () => {
      const root = document.documentElement;
      if (!root) return false;
      root.classList.add("nga-vsc-boot");
      if (!document.getElementById(EARLY_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = EARLY_STYLE_ID;
        style.textContent = `
          html.nga-vsc-boot, html.nga-vsc-boot body { background:#1e1e1e!important; color:#cccccc!important; }
          html.nga-vsc-boot body > * { visibility:hidden!important; }
          html.nga-vsc-boot body::before { content:""; visibility:visible; position:fixed; inset:0; background:#1e1e1e; z-index:2147483646; }
        `;
        root.appendChild(style);
      }
      return true;
    };
    if (install()) return;
    const observer = new MutationObserver(() => {
      if (!install()) return;
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  function failOpen() {
    if (state.booted) return;
    state.failed = true;
    state.identityObserver?.disconnect();
    document.documentElement.classList.remove("nga-vsc-boot", ROOT_CLASS, READY_CLASS);
    document.getElementById(EARLY_STYLE_ID)?.remove();
    document.getElementById(APP_ID)?.remove();
    document.getElementById(FAVICON_ID)?.remove();
    if (state.originalTitle) document.title = state.originalTitle;
  }

  function installIdentityGuard() {
    const enforceFavicon = (node) => {
      if (node.getAttribute("href") !== VSCODE_FAVICON) node.setAttribute("href", VSCODE_FAVICON);
    };
    const enforce = () => {
      if (state.failed || state.identityBusy) return;
      const head = document.head || document.documentElement;
      if (!head) return;
      state.identityBusy = true;
      try {
        if (document.title && document.title !== FAKE_TITLE) state.originalTitle = document.title;
        if (document.title !== FAKE_TITLE) document.title = FAKE_TITLE;
        let icon = document.getElementById(FAVICON_ID);
        if (!icon) {
          icon = document.createElement("link");
          icon.id = FAVICON_ID;
          icon.rel = "icon";
          head.appendChild(icon);
        }
        enforceFavicon(icon);
        for (const candidate of document.querySelectorAll('link[rel~="icon"]')) {
          if (candidate !== icon) enforceFavicon(candidate);
        }
      } finally {
        state.identityBusy = false;
      }
    };
    enforce();
    const start = () => {
      if (state.failed || !document.head || state.identityObserver) return;
      state.identityObserver = new MutationObserver(enforce);
      state.identityObserver.observe(document.head, { childList: true, subtree: true, characterData: true, attributes: true });
      enforce();
    };
    if (document.head) start();
    else {
      const headObserver = new MutationObserver(() => {
        if (!document.head) return;
        headObserver.disconnect();
        start();
      });
      headObserver.observe(document.documentElement || document, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", start, { once: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) enforce();
    });
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      html.${ROOT_CLASS} {
        --vsc-title:#181818; --vsc-activity:#181818; --vsc-sidebar:#181818; --vsc-editor:#1f1f1f;
        --vsc-editor-2:#1e1e1e; --vsc-panel:#181818; --vsc-status:#007acc; --vsc-border:#2b2b2b;
        --vsc-text:#cccccc; --vsc-muted:#8b8b8b; --vsc-bright:#ffffff; --vsc-hover:#2a2d2e;
        --vsc-active:#37373d; --vsc-input:#313131; --vsc-blue:#4daafc; --vsc-focus:#007fd4;
        --vsc-comment:#6a9955; --vsc-keyword:#c586c0; --vsc-string:#ce9178; --vsc-number:#b5cea8;
        --vsc-type:#4ec9b0; --vsc-function:#dcdcaa; --vsc-decorator:#d7ba7d; --vsc-gutter:#858585;
        color-scheme:dark; background:var(--vsc-editor)!important;
      }
      html.${ROOT_CLASS}.nga-vsc-light {
        --vsc-title:#f3f3f3; --vsc-activity:#f8f8f8; --vsc-sidebar:#f3f3f3; --vsc-editor:#ffffff;
        --vsc-editor-2:#ffffff; --vsc-panel:#f8f8f8; --vsc-status:#007acc; --vsc-border:#d4d4d4;
        --vsc-text:#333333; --vsc-muted:#6e6e6e; --vsc-bright:#111111; --vsc-hover:#e8e8e8;
        --vsc-active:#e4e6f1; --vsc-input:#ffffff; --vsc-blue:#0066b8; --vsc-focus:#007fd4;
        --vsc-comment:#008000; --vsc-keyword:#af00db; --vsc-string:#a31515; --vsc-number:#098658;
        --vsc-type:#267f99; --vsc-function:#795e26; --vsc-decorator:#795e26; --vsc-gutter:#237893;
        color-scheme:light;
      }
      html.${READY_CLASS}, html.${READY_CLASS} body { margin:0!important; width:100%!important; height:100%!important; overflow:hidden!important; background:var(--vsc-editor)!important; }
      html.${READY_CLASS} body > :not(#${APP_ID}):not(script):not(style) {
        position:fixed!important; left:-100000px!important; top:-100000px!important; width:1px!important; height:1px!important;
        overflow:hidden!important; opacity:0!important; pointer-events:none!important; visibility:hidden!important;
      }
      html.${READY_CLASS}.${NATIVE_CLASS} body > :not(#${APP_ID}):not(script):not(style) {
        position:static!important; width:auto!important; height:auto!important; overflow:visible!important; opacity:1!important;
        pointer-events:auto!important; visibility:visible!important;
      }
      html.${READY_CLASS}.${NATIVE_CLASS} #${APP_ID} { display:none!important; }
      #${APP_ID}, #${APP_ID} * { box-sizing:border-box; }
      #${APP_ID} { position:fixed; inset:0; z-index:2147483000; display:grid; grid-template-rows:35px minmax(0,1fr) 22px;
        color:var(--vsc-text); background:var(--vsc-editor); font:13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif; }
      .nga-vsc-titlebar { display:grid; grid-template-columns:auto 1fr auto; align-items:center; min-width:0; background:var(--vsc-title); border-bottom:1px solid var(--vsc-border); user-select:none; }
      .nga-vsc-menus { display:flex; align-items:center; padding-left:8px; min-width:410px; }
      .nga-vsc-menu { padding:4px 7px; border:0; color:var(--vsc-text); background:transparent; border-radius:4px; font:inherit; }
      .nga-vsc-menu:hover { background:var(--vsc-hover); }
      .nga-vsc-command { justify-self:center; width:min(520px,42vw); height:24px; display:flex; gap:7px; align-items:center; justify-content:center;
        border:1px solid var(--vsc-border); border-radius:6px; background:color-mix(in srgb,var(--vsc-input) 80%,transparent); color:var(--vsc-text); }
      .nga-vsc-command svg { width:14px; height:14px; opacity:.75; }
      .nga-vsc-window-actions { display:flex; height:100%; align-items:center; }
      .nga-vsc-window-btn { width:46px; height:100%; display:grid; place-items:center; border:0; background:transparent; color:var(--vsc-text); }
      .nga-vsc-window-btn:hover { background:var(--vsc-hover); }
      .nga-vsc-window-btn svg { width:14px; height:14px; }
      .nga-vsc-workarea { min-height:0; display:grid; grid-template-columns:48px var(--vsc-side-width,260px) minmax(0,1fr); }
      .nga-vsc-activity { grid-column:1; min-height:0; display:flex; flex-direction:column; align-items:center; background:var(--vsc-activity); border-right:1px solid var(--vsc-border); }
      .nga-vsc-activity-btn { position:relative; width:48px; height:48px; display:grid; place-items:center; border:0; background:transparent; color:var(--vsc-muted); }
      .nga-vsc-activity-btn:hover,.nga-vsc-activity-btn.is-active { color:var(--vsc-bright); }
      .nga-vsc-activity-btn.is-active::before { content:""; position:absolute; left:0; top:8px; bottom:8px; width:2px; background:var(--vsc-blue); }
      .nga-vsc-activity-btn svg { width:24px; height:24px; }
      .nga-vsc-activity-spacer { flex:1; }
      .nga-vsc-sidebar { grid-column:2; min-width:0; min-height:0; overflow:hidden; display:flex; flex-direction:column; background:var(--vsc-sidebar); border-right:1px solid var(--vsc-border); }
      #${APP_ID}[data-sidebar-visible="false"] .nga-vsc-workarea { grid-template-columns:48px 0 minmax(0,1fr); }
      #${APP_ID}[data-sidebar-visible="false"] .nga-vsc-sidebar { display:none; }
      .nga-vsc-side-title { height:35px; flex:0 0 35px; display:flex; align-items:center; padding:0 18px; text-transform:uppercase; font-size:11px; letter-spacing:.4px; }
      .nga-vsc-side-scroll { overflow:auto; min-height:0; padding-bottom:20px; scrollbar-color:var(--vsc-muted) transparent; }
      .nga-vsc-section-title { width:100%; height:22px; display:flex; align-items:center; gap:3px; padding:0 8px; border:0; background:transparent; color:var(--vsc-text); font:600 11px/22px "Segoe UI","Microsoft YaHei",sans-serif; text-align:left; text-transform:uppercase; cursor:pointer; }
      .nga-vsc-section-title:hover,.nga-vsc-folder-toggle:hover { background:var(--vsc-hover); }
      .nga-vsc-section-title svg { width:12px; height:12px; transform:rotate(90deg); }
      .nga-vsc-section-title[aria-expanded="false"] svg,.nga-vsc-folder-toggle[aria-expanded="false"] .nga-vsc-tree-chevron { transform:rotate(0deg); }
      .nga-vsc-tree-group[hidden] { display:none!important; }
      .nga-vsc-folder-toggle { width:100%; height:23px; display:flex; align-items:center; gap:5px; padding:0 8px 0 var(--tree-indent,8px); border:0; background:transparent; color:var(--vsc-text); font:inherit; text-align:left; cursor:pointer; }
      .nga-vsc-folder-toggle svg { width:16px; height:16px; flex:0 0 16px; color:#dcb67a; }
      .nga-vsc-folder-toggle .nga-vsc-tree-chevron { width:12px; height:12px; color:var(--vsc-muted); transform:rotate(90deg); }
      .nga-vsc-tree-group.is-nested .nga-vsc-tree-row { --tree-indent:38px; }
      .nga-vsc-tree-row { height:23px; display:flex; align-items:center; gap:5px; min-width:0; padding:0 8px 0 var(--tree-indent,14px); color:var(--vsc-text); cursor:default; text-decoration:none; }
      .nga-vsc-tree-row:hover,.nga-vsc-tree-row.is-current { background:var(--vsc-hover); }
      .nga-vsc-tree-row.is-current { background:var(--vsc-active); }
      .nga-vsc-tree-row svg { width:16px; height:16px; flex:0 0 16px; color:#519aba; }
      .nga-vsc-tree-row.is-folder svg { color:#dcb67a; }
      .nga-vsc-tree-label { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .nga-vsc-tree-meta { margin-left:auto; padding-left:6px; color:var(--vsc-muted); font-size:11px; }
      .nga-vsc-editor-shell { grid-column:3; min-width:0; min-height:0; display:grid; grid-template-rows:35px 24px minmax(0,1fr) auto; background:var(--vsc-editor); }
      .nga-vsc-tabs { min-width:0; display:flex; background:var(--vsc-title); border-bottom:1px solid var(--vsc-border); overflow:hidden; }
      .nga-vsc-tab { min-width:140px; max-width:310px; display:flex; align-items:center; gap:7px; padding:0 10px; background:var(--vsc-editor); border-right:1px solid var(--vsc-border); border-top:1px solid var(--vsc-blue); }
      .nga-vsc-tab svg { width:15px; height:15px; color:#519aba; }
      .nga-vsc-tab-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .nga-vsc-tab-close { margin-left:auto; opacity:.65; }
      .nga-vsc-breadcrumbs { min-width:0; display:flex; align-items:center; gap:4px; padding:0 12px; color:var(--vsc-muted); overflow:hidden; white-space:nowrap; }
      .nga-vsc-breadcrumbs > span:last-of-type { color:var(--vsc-text); overflow:hidden; text-overflow:ellipsis; }
      .nga-vsc-pager { margin-left:auto; display:flex; align-items:center; gap:2px; padding-left:12px; }
      .nga-vsc-page-btn { min-width:22px; height:20px; padding:0 5px; border:0; border-radius:3px; background:transparent; color:var(--vsc-muted); font:11px/20px "Segoe UI",sans-serif; cursor:pointer; }
      .nga-vsc-page-btn:hover { background:var(--vsc-hover); color:var(--vsc-text); }
      .nga-vsc-editor { min-width:0; min-height:0; overflow:auto; position:relative; background:var(--vsc-editor); scrollbar-color:var(--vsc-muted) transparent; }
      .nga-vsc-code { min-width:max-content; padding:8px 0 60px; font:14px/21px "Cascadia Code","SFMono-Regular",Consolas,"Liberation Mono","Microsoft YaHei",monospace; tab-size:4; }
      .nga-vsc-code-line { min-height:21px; display:grid; grid-template-columns:58px minmax(620px,1fr); }
      .nga-vsc-code-line:hover { background:color-mix(in srgb,var(--vsc-hover) 48%,transparent); }
      .nga-vsc-line-no { padding-right:16px; text-align:right; color:var(--vsc-gutter); user-select:none; }
      .nga-vsc-line-text { padding-right:32px; white-space:pre-wrap; overflow-wrap:anywhere; }
      .tok-comment { color:var(--vsc-comment); } .tok-keyword { color:var(--vsc-keyword); } .tok-string { color:var(--vsc-string); }
      .tok-number { color:var(--vsc-number); } .tok-type { color:var(--vsc-type); } .tok-function { color:var(--vsc-function); } .tok-decorator { color:var(--vsc-decorator); }
      .nga-vsc-code-link { color:var(--vsc-blue); text-decoration:none; cursor:pointer; }
      .nga-vsc-codelens { min-height:19px; display:grid; grid-template-columns:58px minmax(620px,1fr); font:12px/19px "Segoe UI",sans-serif; }
      .nga-vsc-codelens-actions { display:flex; gap:12px; }
      .nga-vsc-codelens button { padding:0; border:0; background:transparent; color:var(--vsc-blue); font:inherit; cursor:pointer; }
      .nga-vsc-codelens button:hover { text-decoration:underline; }
      .nga-vsc-welcome { height:100%; display:grid; place-items:center; padding:40px; }
      .nga-vsc-welcome-inner { width:min(760px,90%); display:grid; grid-template-columns:1fr 1fr; gap:44px; }
      .nga-vsc-logo { font-size:28px; color:var(--vsc-bright); margin-bottom:4px; } .nga-vsc-subtitle { color:var(--vsc-muted); font-size:18px; }
      .nga-vsc-command-list { margin-top:25px; display:grid; gap:10px; }
      .nga-vsc-command-link { border:0; padding:3px 0; background:transparent; color:var(--vsc-blue); text-align:left; font:inherit; cursor:pointer; }
      .nga-vsc-shortcuts { display:grid; gap:9px; align-content:center; } .nga-vsc-shortcut { display:flex; justify-content:space-between; gap:20px; }
      kbd { padding:2px 6px; border:1px solid var(--vsc-border); border-bottom-width:2px; border-radius:3px; background:var(--vsc-input); color:var(--vsc-text); font:11px Consolas,monospace; }
      .nga-vsc-changes { min-width:720px; padding:8px 0 50px; }
      .nga-vsc-change-head,.nga-vsc-change-row { display:grid; grid-template-columns:minmax(320px,1fr) 140px 90px 70px; align-items:center; min-height:27px; padding:0 15px; }
      .nga-vsc-change-head { color:var(--vsc-muted); border-bottom:1px solid var(--vsc-border); font-size:11px; text-transform:uppercase; }
      .nga-vsc-change-row { cursor:pointer; border-bottom:1px solid color-mix(in srgb,var(--vsc-border) 55%,transparent); }
      .nga-vsc-change-row:hover { background:var(--vsc-hover); }
      .nga-vsc-change-file { display:flex; align-items:center; gap:7px; min-width:0; } .nga-vsc-change-file svg { width:16px; color:#519aba; }
      .nga-vsc-change-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .nga-vsc-change-meta { color:var(--vsc-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .nga-vsc-modified { color:#e2c08d; font-weight:600; }
      .nga-vsc-panel { height:min(260px,36vh); min-height:150px; overflow:hidden; border-top:1px solid var(--vsc-border); background:var(--vsc-panel); }
      .nga-vsc-panel:empty { display:none; }
      .nga-vsc-panel[aria-hidden="true"] { display:none; }
      .nga-vsc-panel-title { height:30px; display:flex; align-items:center; gap:20px; padding:0 10px 0 14px; border-bottom:1px solid color-mix(in srgb,var(--vsc-border) 70%,transparent); font-size:11px; text-transform:uppercase; }
      .nga-vsc-panel-tab { height:30px; display:flex; align-items:center; border-bottom:1px solid var(--vsc-blue); color:var(--vsc-bright); }
      .nga-vsc-panel-tools { margin-left:auto; display:flex; align-items:center; gap:2px; }
      .nga-vsc-panel-tool { width:24px; height:24px; display:grid; place-items:center; padding:0; border:0; border-radius:3px; background:transparent; color:var(--vsc-text); cursor:pointer; }
      .nga-vsc-panel-tool:hover { background:var(--vsc-hover); }
      .nga-vsc-panel-tool svg { width:14px; height:14px; }
      .nga-vsc-panel-body { height:calc(100% - 30px); overflow:auto; padding:0 14px 12px; }
      .nga-vsc-terminal { position:relative; height:100%; overflow:auto; padding:8px 0 14px; color:var(--vsc-text); font:13px/20px "Cascadia Code","SFMono-Regular",Consolas,"Microsoft YaHei",monospace; }
      .nga-vsc-terminal-line { min-height:20px; white-space:pre-wrap; overflow-wrap:anywhere; }
      .nga-vsc-terminal-muted { color:var(--vsc-muted); }
      .nga-vsc-terminal-code { min-width:560px; margin-top:5px; }
      .nga-vsc-terminal-code-row { min-height:20px; display:grid; grid-template-columns:44px 26px minmax(0,1fr); }
      .nga-vsc-terminal-line-no { padding-right:10px; color:var(--vsc-gutter); text-align:right; user-select:none; white-space:pre; }
      .nga-vsc-terminal-prefix { color:var(--vsc-comment); white-space:pre; user-select:none; }
      .nga-vsc-terminal-source { color:var(--vsc-text); white-space:pre-wrap; }
      .nga-vsc-terminal-edit-row { align-items:start; background:color-mix(in srgb,var(--vsc-hover) 45%,transparent); }
      .nga-vsc-terminal-input { width:100%!important; min-height:60px!important; margin:0!important; padding:0 14px 0 0!important; resize:none!important; overflow:auto!important; border:0!important; outline:0!important; box-shadow:none!important; background:transparent!important; color:var(--vsc-comment)!important; caret-color:var(--vsc-bright)!important; font:13px/20px "Cascadia Code","SFMono-Regular",Consolas,"Microsoft YaHei",monospace!important; white-space:pre!important; }
      .nga-vsc-native-proxy { display:none!important; }
      .nga-vsc-native-slot { display:none!important; }
      .nga-vsc-statusbar { display:flex; align-items:center; min-width:0; padding:0 8px; background:var(--vsc-status); color:white; font-size:12px; user-select:none; }
      .nga-vsc-status-item { height:22px; display:flex; align-items:center; gap:5px; padding:0 7px; border:0; background:transparent; color:inherit; font:inherit; cursor:default; }
      button.nga-vsc-status-item { cursor:pointer; } .nga-vsc-status-item:hover { background:rgba(255,255,255,.14); }
      .nga-vsc-status-spacer { flex:1; }
      .nga-vsc-overlay { position:absolute; inset:35px 0 22px 48px; z-index:20; pointer-events:none; }
      .nga-vsc-overlay > * { pointer-events:auto; }
      .nga-vsc-search-page { padding:22px; max-width:850px; } .nga-vsc-search-group { margin-bottom:24px; }
      .nga-vsc-search-label { margin-bottom:8px; color:var(--vsc-muted); text-transform:uppercase; font-size:11px; }
      .nga-vsc-search-form { display:flex; gap:8px; } .nga-vsc-input { height:30px; flex:1; border:1px solid var(--vsc-border); outline:none; background:var(--vsc-input); color:var(--vsc-text); padding:0 8px; font:inherit; }
      .nga-vsc-input:focus { border-color:var(--vsc-focus); } .nga-vsc-button { min-width:90px; border:1px solid transparent; background:#0e639c; color:white; padding:5px 12px; font:inherit; cursor:pointer; }
      .nga-vsc-button:hover { background:#1177bb; }
      .nga-vsc-native-portal { min-height:100%; padding:12px 18px 55px; background:var(--vsc-editor); color:var(--vsc-text); font:13px "Segoe UI","Microsoft YaHei",sans-serif; }
      .nga-vsc-native-portal #mainmenu,.nga-vsc-native-portal #m_nav,.nga-vsc-native-portal #b_nav,.nga-vsc-native-portal #footer,.nga-vsc-native-portal #custombg { display:none!important; }
      .nga-vsc-native-portal .adshid,.nga-vsc-native-portal .nga_ads,.nga-vsc-native-portal [class*="adsbygoogle"],.nga-vsc-native-portal iframe[src*="/ad"],.nga-vsc-native-portal img[src*="avatar"] { display:none!important; }
      .nga-vsc-native-portal table,.nga-vsc-native-portal tbody,.nga-vsc-native-portal tr,.nga-vsc-native-portal td { background:transparent!important; color:var(--vsc-text)!important; border-color:var(--vsc-border)!important; }
      .nga-vsc-native-portal table { width:100%!important; }
      .nga-vsc-native-portal input,.nga-vsc-native-portal textarea,.nga-vsc-native-portal select { background:var(--vsc-input)!important; color:var(--vsc-text)!important; border:1px solid var(--vsc-border)!important; outline:none!important; font:14px/1.5 "Cascadia Code",Consolas,"Microsoft YaHei",monospace!important; }
      .nga-vsc-native-portal input:focus,.nga-vsc-native-portal textarea:focus,.nga-vsc-native-portal select:focus { border-color:var(--vsc-focus)!important; }
      .nga-vsc-native-portal input[type=button],.nga-vsc-native-portal input[type=submit],.nga-vsc-native-portal button { background:#0e639c!important; color:#fff!important; border:0!important; padding:5px 12px!important; }
      .nga-vsc-native-portal iframe { width:100%!important; min-height:420px!important; border:1px solid var(--vsc-border)!important; background:var(--vsc-editor)!important; }
      .nga-vsc-native-portal img:not([src*="smile"]):not([src*="ubb"]):not([src*="common_res"]) { max-width:100%; }
      .nga-vsc-native-portal a { color:var(--vsc-blue)!important; }
      .nga-vsc-asset-list { position:fixed; visibility:hidden; width:320px; max-height:260px; overflow:auto; padding:8px; border:1px solid var(--vsc-border); background:var(--vsc-panel); box-shadow:0 8px 30px rgba(0,0,0,.35); z-index:50; }
      .nga-vsc-tree-row:hover .nga-vsc-asset-list { visibility:visible; }
      .nga-vsc-asset-list img { display:block; max-width:300px; max-height:220px; margin:auto; }
      @media (max-width:999px) {
        #${APP_ID} { grid-template-rows:32px minmax(0,1fr) 22px; }
        .nga-vsc-menus { display:none; } .nga-vsc-command { width:min(70vw,440px); grid-column:1/3; }
        .nga-vsc-window-actions { position:absolute; right:0; top:0; height:32px; }
        .nga-vsc-workarea { grid-template-columns:42px minmax(0,1fr); }
        .nga-vsc-activity { width:42px; } .nga-vsc-activity-btn { width:42px; height:44px; }
        .nga-vsc-sidebar { display:none; } .nga-vsc-editor-shell { grid-column:2; }
        .nga-vsc-change-head,.nga-vsc-change-row { grid-template-columns:minmax(250px,1fr) 75px; }
        .nga-vsc-change-head > :nth-child(n+3),.nga-vsc-change-row > :nth-child(n+3) { display:none; }
        .nga-vsc-welcome-inner { grid-template-columns:1fr; } .nga-vsc-code-line,.nga-vsc-codelens { grid-template-columns:44px minmax(520px,1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureWorkbench() {
    if (document.getElementById(APP_ID)) return;
    const app = el("div", { id: APP_ID, "aria-label": "Visual Studio Code workspace", dataset: { sidebarVisible: "true" } });

    const titlebar = el("div", { class: "nga-vsc-titlebar" });
    const menus = el("div", { class: "nga-vsc-menus" });
    const menuCommands = { File: "home", Terminal: "terminal-toggle" };
    for (const label of ["File", "Edit", "Selection", "View", "Go", "Run", "Terminal", "Help"]) {
      menus.append(el("button", { class: "nga-vsc-menu", type: "button", text: label, dataset: menuCommands[label] ? { command: menuCommands[label] } : {} }));
    }
    const command = el("div", { class: "nga-vsc-command" }, icon("search"), el("span", { text: "workspace" }));
    const windowActions = el("div", { class: "nga-vsc-window-actions" },
      el("button", { class: "nga-vsc-window-btn", type: "button", title: "Toggle Zen Mode", dataset: { command: "zen" } }, icon("zen")),
      el("button", { class: "nga-vsc-window-btn", type: "button", title: "Close Editor", dataset: { command: "noop" } }, icon("close"))
    );
    titlebar.append(menus, command, windowActions);

    const workarea = el("div", { class: "nga-vsc-workarea" });
    const activity = el("nav", { class: "nga-vsc-activity", "aria-label": "Primary Side Bar" });
    const activities = [
      ["explorer", "files", "Explorer"], ["search", "search", "Search"], ["source", "branch", "Source Control"],
      ["run", "run", "Run and Debug"], ["extensions", "blocks", "Extensions"], ["bookmarks", "bookmark", "Bookmarks"]
    ];
    for (const [mode, iconName, title] of activities) activity.append(el("button", { class: `nga-vsc-activity-btn${mode === "explorer" ? " is-active" : ""}`, type: "button", title, dataset: { activity: mode } }, icon(iconName)));
    activity.append(el("div", { class: "nga-vsc-activity-spacer" }),
      el("button", { class: "nga-vsc-activity-btn", type: "button", title: "Accounts", dataset: { activity: "account" } }, icon("account")),
      el("button", { class: "nga-vsc-activity-btn", type: "button", title: "Manage", dataset: { command: "theme" } }, icon("gear"))
    );

    const sidebar = el("aside", { class: "nga-vsc-sidebar" }, el("div", { class: "nga-vsc-side-title", id: "nga-vsc-side-title", text: "Explorer" }), el("div", { class: "nga-vsc-side-scroll", id: "nga-vsc-side-scroll" }));
    const editorShell = el("main", { class: "nga-vsc-editor-shell" },
      el("div", { class: "nga-vsc-tabs", id: "nga-vsc-tabs" }),
      el("div", { class: "nga-vsc-breadcrumbs", id: "nga-vsc-breadcrumbs" }),
      el("div", { class: "nga-vsc-editor", id: "nga-vsc-editor" }),
      el("section", { class: "nga-vsc-panel", id: "nga-vsc-panel" })
    );
    workarea.append(activity, sidebar, editorShell);

    const status = el("footer", { class: "nga-vsc-statusbar" },
      el("button", { class: "nga-vsc-status-item", type: "button", title: "Source Control", dataset: { activity: "source" } }, icon("branch"), el("span", { text: "main*" })),
      el("span", { class: "nga-vsc-status-item", id: "nga-vsc-status-context", text: "workspace" }),
      el("span", { class: "nga-vsc-status-spacer" }),
      el("button", { class: "nga-vsc-status-item", type: "button", title: "Select Language Mode", dataset: { command: "language" }, id: "nga-vsc-language" }),
      el("button", { class: "nga-vsc-status-item", type: "button", title: "Select Color Theme", dataset: { command: "theme" }, id: "nga-vsc-theme" }),
      el("button", { class: "nga-vsc-status-item", type: "button", title: "Toggle Zen Mode", dataset: { command: "zen" }, text: "Zen Mode" })
    );
    const overlay = el("div", { class: "nga-vsc-overlay", id: "nga-vsc-overlay" });
    app.append(titlebar, workarea, status, overlay);
    document.body.appendChild(app);
  }

  function el(tag, attributes = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "id") node.id = value;
      else if (value !== undefined && value !== null) node.setAttribute(key, value);
    }
    for (const child of children.flat()) if (child) node.append(child);
    return node;
  }

  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICON_PATHS[name] || ICON_PATHS.fileTs);
    svg.appendChild(path);
    return svg;
  }

  function bindGlobalEvents() {
    const app = document.getElementById(APP_ID);
    if (!app || app.dataset.bound === "1") return;
    app.dataset.bound = "1";
    app.addEventListener("click", handleAppClick);
    app.addEventListener("submit", handleAppSubmit);
    document.addEventListener("fullscreenchange", updateStatus);
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        state.debugNative = !state.debugNative;
        if (state.debugNative) restoreQuickReply();
        document.documentElement.classList.toggle(NATIVE_CLASS, state.debugNative);
        if (!state.debugNative) {
          state.renderSignature = "";
          applyWorkbench(true);
        }
      } else if (event.ctrlKey && !event.altKey && !event.shiftKey && event.key === "`") {
        event.preventDefault();
        toggleTerminalPanel();
      }
    });
  }

  function handleAppClick(event) {
    const target = event.target.closest("button,a,.nga-vsc-change-row,.nga-vsc-tree-row");
    if (!target) return;
    const command = target.dataset.command;
    const activity = target.dataset.activity;
    const url = target.dataset.url;
    const actionId = target.dataset.nativeAction;
    if (command) {
      event.preventDefault();
      if (command === "theme") toggleTheme();
      else if (command === "language") toggleLanguage();
      else if (command === "zen") toggleZenMode();
      else if (command === "home") goHome();
      else if (command === "terminal-toggle") toggleTerminalPanel();
      else if (command === "terminal-close") toggleTerminalPanel(false);
      else if (command === "terminal-submit") triggerQuickReply();
      return;
    }
    const collapseId = target.dataset.collapseId;
    if (collapseId) {
      event.preventDefault();
      toggleTreeNode(collapseId);
      return;
    }
    if (activity) {
      activateActivity(activity);
      return;
    }
    if (actionId) {
      event.preventDefault();
      state.nativeActions.get(actionId)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      window.setTimeout(syncNativeOverlays, 50);
      return;
    }
    if (url) {
      event.preventDefault();
      const destination = new URL(url, location.href);
      if (!/^https?:$/.test(destination.protocol)) return;
      if (destination.origin !== location.origin) window.open(destination.href, "_blank", "noopener");
      else location.href = destination.href;
    }
  }

  function handleAppSubmit(event) {
    const form = event.target.closest("form[data-search-id]");
    if (!form) return;
    event.preventDefault();
    const target = state.searchTargets.get(form.dataset.searchId);
    const input = form.querySelector("input");
    if (!target || !input) return;
    target.input.value = input.value;
    target.input.dispatchEvent(new Event("input", { bubbles: true }));
    if (typeof target.form.requestSubmit === "function") target.form.requestSubmit();
    else target.form.submit();
  }

  function activateActivity(mode) {
    if (mode === "search") { location.href = new URL("/search.php", location.origin).href; return; }
    if (mode === "bookmarks") { location.href = new URL("/thread.php?favor=1", location.origin).href; return; }
    if (mode === "account") {
      const native = document.querySelector('#mainmenu a[title*="我的"],#mainmenu a[title*="消息"]');
      if (native) native.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      window.setTimeout(syncNativeOverlays, 50);
      return;
    }
    if (mode === "explorer" && state.sidebarMode === "explorer") {
      setSidebarVisible(!state.sidebarVisible);
      return;
    }
    state.sidebarMode = mode;
    setSidebarVisible(true);
    try { localStorage.setItem(SIDEBAR_KEY, mode); } catch { /* ignored */ }
    document.querySelectorAll(".nga-vsc-activity-btn[data-activity]").forEach((button) => button.classList.toggle("is-active", button.dataset.activity === mode));
    renderSidebar(buildPageContext());
  }

  function setSidebarVisible(visible) {
    state.sidebarVisible = Boolean(visible);
    const app = document.getElementById(APP_ID);
    if (app) app.dataset.sidebarVisible = state.sidebarVisible ? "true" : "false";
    try { localStorage.setItem(SIDEBAR_VISIBLE_KEY, state.sidebarVisible ? "1" : "0"); } catch { /* ignored */ }
  }

  function goHome() {
    const destination = new URL("/", location.origin);
    if (location.pathname === "/" && !location.search && !location.hash) {
      state.renderSignature = "";
      applyWorkbench(true);
      return;
    }
    location.assign(destination.href);
  }

  function toggleTerminalPanel(force) {
    state.terminalOpen = typeof force === "boolean" ? force : !state.terminalOpen;
    const panel = document.getElementById("nga-vsc-panel");
    if (panel) panel.setAttribute("aria-hidden", state.terminalOpen ? "false" : "true");
  }

  async function toggleZenMode() {
    try {
      if (!document.fullscreenElement) {
        try { localStorage.setItem(ZEN_KEY, "1"); } catch { /* ignored */ }
        await document.documentElement.requestFullscreen();
      }
      else await document.exitFullscreen();
    } catch (error) {
      console.warn("[NGA VS Code] Fullscreen request was rejected", error);
    }
  }

  function getTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch { /* ignored */ }
    return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignored */ }
    document.documentElement.classList.toggle("nga-vsc-light", theme === "light");
    postSettingsToEditors();
    updateStatus();
  }

  function toggleTheme() { setTheme(getTheme() === "dark" ? "light" : "dark"); }

  function getLanguage() {
    try { return localStorage.getItem(LANGUAGE_KEY) === "python" ? "python" : "typescript"; }
    catch { return "typescript"; }
  }

  function toggleLanguage() {
    const next = getLanguage() === "typescript" ? "python" : "typescript";
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* ignored */ }
    state.renderSignature = "";
    applyWorkbench(true);
  }

  function patchHistory() {
    if (history.__ngaVscPatched) return;
    history.__ngaVscPatched = true;
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        scheduleApply();
        return result;
      };
    }
    addEventListener("popstate", scheduleApply);
    addEventListener("hashchange", scheduleApply);
  }

  function observeSource() {
    if (state.sourceObserver) return;
    state.sourceObserver = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target.closest?.(`#${APP_ID}`))) return;
      scheduleApply();
      window.setTimeout(syncNativeOverlays, 20);
    });
    state.sourceObserver.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  function scheduleApply() {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(() => applyWorkbench(false), RENDER_DELAY);
  }

  function buildPageContext() {
    const url = new URL(location.href);
    const path = url.pathname.toLowerCase();
    let kind = "other";
    if (path.endsWith("/read.php")) kind = "read";
    else if (path.endsWith("/post.php")) kind = "post";
    else if (path.endsWith("/search.php")) kind = "search";
    else if (path.endsWith("/thread.php") && url.searchParams.get("favor")) kind = "favorites";
    else if (path.endsWith("/thread.php")) kind = "forum";
    else if (path === "/" || path.endsWith("/forum.php")) kind = "home";
    const rows = document.querySelectorAll("#topicrows tr.topicrow").length;
    const posts = document.querySelectorAll('[id^="post1strow"]').length;
    const lastRow = document.querySelector("#topicrows tr.topicrow:last-of-type .topic")?.textContent?.trim() || "";
    const lastPost = document.querySelector('[id^="post1strow"]:last-of-type .postcontent')?.textContent?.length || 0;
    return {
      kind, url, fid: url.searchParams.get("fid") || "", tid: url.searchParams.get("tid") || "",
      rows, posts, fingerprint: `${kind}|${url.pathname}|${url.search}|${rows}|${posts}|${lastRow.slice(0, 40)}|${lastPost}`
    };
  }

  function applyWorkbench(force) {
    if (!document.body) return;
    ensureWorkbench();
    if (!state.booted) {
      try {
        const savedSidebar = localStorage.getItem(SIDEBAR_KEY);
        if (["explorer", "source", "run", "extensions"].includes(savedSidebar)) state.sidebarMode = savedSidebar;
        state.sidebarVisible = localStorage.getItem(SIDEBAR_VISIBLE_KEY) !== "0";
        const savedCollapsed = JSON.parse(localStorage.getItem(TREE_COLLAPSED_KEY) || "[]");
        if (Array.isArray(savedCollapsed)) state.collapsedNodes = new Set(savedCollapsed.filter((item) => typeof item === "string"));
      } catch { /* ignored */ }
    }
    setTheme(getTheme());
    const context = buildPageContext();
    const signature = `${context.fingerprint}|${getLanguage()}`;
    if (!force && signature === state.renderSignature) { syncNativeOverlays(); return; }
    state.renderSignature = signature;
    state.nativeActions.clear();
    state.searchTargets.clear();
    state.resources = [];
    prepareChrome(context);
    renderSidebar(context);
    if (context.kind === "read") renderReadPage(context);
    else if (context.kind === "forum" || context.kind === "favorites") renderTopicList(context);
    else if (context.kind === "home") renderHome(context);
    else if (context.kind === "search") renderSearch(context);
    else if (context.kind === "post") renderNativePortal(context, true);
    else renderNativePortal(context, false);
    updateStatus(context);
    syncNativeOverlays();
    postSettingsToEditors();
  }

  function prepareChrome(context) {
    const fileName = currentFileName(context);
    const tabs = document.getElementById("nga-vsc-tabs");
    tabs.replaceChildren(el("div", { class: "nga-vsc-tab" }, icon("fileTs"), el("span", { class: "nga-vsc-tab-label", text: fileName }), el("span", { class: "nga-vsc-tab-close", text: "×" })));
    const crumbs = document.getElementById("nga-vsc-breadcrumbs");
    crumbs.replaceChildren(el("span", { text: "workspace" }), el("span", { text: "›" }), el("span", { text: context.kind === "favorites" ? "bookmarks" : "src" }), el("span", { text: "›" }), el("span", { text: fileName }));
    const pageLinks = collectPageLinks();
    if (pageLinks.length) {
      const pager = el("div", { class: "nga-vsc-pager", "aria-label": "Editor navigation" });
      for (const pageLink of pageLinks) pager.append(el("button", { class: "nga-vsc-page-btn", type: "button", dataset: { url: pageLink.url }, title: "Go to location", text: pageLink.label }));
      crumbs.append(pager);
    }
    const panel = document.getElementById("nga-vsc-panel");
    restoreQuickReply();
    panel.replaceChildren();
    panel.setAttribute("aria-hidden", state.terminalOpen ? "false" : "true");
  }

  function currentFileName(context) {
    const ext = getLanguage() === "python" ? "py" : "ts";
    if (context.kind === "home") return `workspace.${ext}`;
    if (context.kind === "forum") return `changes.${ext}`;
    if (context.kind === "favorites") return `bookmarks.${ext}`;
    if (context.kind === "search") return `search.${ext}`;
    if (context.kind === "post") return `issue.${ext}`;
    if (context.kind === "read") return `${sanitizeFileStem(getReadTitle())}.${ext}`;
    return `resource.${ext}`;
  }

  function renderSidebar(context) {
    const title = document.getElementById("nga-vsc-side-title");
    const scroll = document.getElementById("nga-vsc-side-scroll");
    if (!title || !scroll) return;
    const app = document.getElementById(APP_ID);
    if (app) app.dataset.sidebarVisible = state.sidebarVisible ? "true" : "false";
    const modeNames = { explorer: "Explorer", source: "Source Control", run: "Run and Debug", extensions: "Extensions" };
    title.textContent = modeNames[state.sidebarMode] || "Explorer";
    document.querySelectorAll(".nga-vsc-activity-btn[data-activity]").forEach((button) => button.classList.toggle("is-active", button.dataset.activity === state.sidebarMode));
    scroll.replaceChildren();
    const openEditors = treeGroup("open-editors");
    openEditors.append(treeRow(currentFileName(context), null, false, true));
    scroll.append(sectionTitle("Open Editors", "open-editors"), openEditors);
    if (state.sidebarMode === "run") {
      const runGroup = el("div", { class: "nga-vsc-tree-group" }, treeRow("Launch Workspace", null, false), treeRow("Debug Current File", null, false));
      scroll.append(sectionTitle("Run"), runGroup);
      return;
    }
    if (state.sidebarMode === "extensions") {
      const installed = el("div", { class: "nga-vsc-tree-group" }, treeRow("TypeScript Language Features", null, false), treeRow("Python", null, false), treeRow("Git", null, false));
      scroll.append(sectionTitle("Installed"), installed);
      return;
    }
    const workspace = treeGroup("workspace");
    const source = treeGroup("src", true);
    const topics = collectTopics();
    if (topics.length) {
      for (const topic of topics.slice(0, 60)) source.append(treeRow(topic.file, topic.url, false, context.kind === "read" && topic.title === getReadTitle(), topic.replies));
    } else {
      const links = collectHomeLinks();
      for (const item of links.slice(0, 60)) source.append(treeRow(item.file, item.url, item.folder));
    }
    workspace.append(folderToggle("src", "src"), source);
    if (state.resources.length) {
      const assets = treeGroup("assets", true);
      for (const resource of state.resources.slice(0, 30)) {
        const row = treeRow(resource.name, resource.url, false);
        if (resource.image) row.append(el("span", { class: "nga-vsc-asset-list" }, el("img", { src: resource.url, alt: "Preview" })));
        assets.append(row);
      }
      workspace.append(folderToggle("assets", "assets"), assets);
    }
    scroll.append(sectionTitle("workspace", "workspace"), workspace);
  }

  function sectionTitle(text, collapseId) {
    if (!collapseId) return el("div", { class: "nga-vsc-section-title" }, el("span", { text }));
    const expanded = !state.collapsedNodes.has(collapseId);
    return el("button", { class: "nga-vsc-section-title", type: "button", dataset: { collapseId }, "aria-expanded": String(expanded) }, icon("chevron"), el("span", { text }));
  }

  function folderToggle(text, collapseId) {
    const expanded = !state.collapsedNodes.has(collapseId);
    const chevron = icon("chevron");
    chevron.classList.add("nga-vsc-tree-chevron");
    return el("button", { class: "nga-vsc-folder-toggle", type: "button", dataset: { collapseId }, "aria-expanded": String(expanded) }, chevron, icon("folder"), el("span", { class: "nga-vsc-tree-label", text }));
  }

  function treeGroup(collapseId, nested = false) {
    const group = el("div", { class: `nga-vsc-tree-group${nested ? " is-nested" : ""}`, dataset: { collapseGroup: collapseId } });
    group.hidden = state.collapsedNodes.has(collapseId);
    return group;
  }

  function toggleTreeNode(collapseId) {
    if (state.collapsedNodes.has(collapseId)) state.collapsedNodes.delete(collapseId);
    else state.collapsedNodes.add(collapseId);
    const expanded = !state.collapsedNodes.has(collapseId);
    document.querySelectorAll(`[data-collapse-id="${cssEscape(collapseId)}"]`).forEach((toggle) => toggle.setAttribute("aria-expanded", String(expanded)));
    document.querySelectorAll(`[data-collapse-group="${cssEscape(collapseId)}"]`).forEach((group) => { group.hidden = !expanded; });
    try { localStorage.setItem(TREE_COLLAPSED_KEY, JSON.stringify([...state.collapsedNodes])); } catch { /* ignored */ }
  }

  function treeRow(label, url, folder, current, meta) {
    return el("div", { class: `nga-vsc-tree-row${folder ? " is-folder" : ""}${current ? " is-current" : ""}`, dataset: url ? { url } : {} },
      icon(folder ? "folder" : "fileTs"), el("span", { class: "nga-vsc-tree-label", text: label }), meta ? el("span", { class: "nga-vsc-tree-meta", text: String(meta) }) : null);
  }

  function collectTopics() {
    const result = [];
    for (const row of document.querySelectorAll("#topicrows tr.topicrow")) {
      const link = row.querySelector("a.topic[href]");
      if (!link) continue;
      const title = cleanText(link.textContent) || "untitled";
      const author = cleanText(row.querySelector(".author")?.textContent) || "contributor";
      const replies = cleanText(row.querySelector(".replies")?.textContent) || "0";
      const modified = cleanText(row.querySelector(".replydate,.postdate")?.textContent) || "modified";
      result.push({ title, file: `${sanitizeFileStem(title)}.${getLanguage() === "python" ? "py" : "ts"}`, url: link.href, author, replies, modified });
    }
    return result;
  }

  function collectHomeLinks() {
    const result = [];
    const seen = new Set();
    for (const link of document.querySelectorAll('[id^="indexBlock"] a[href]')) {
      const label = cleanText(link.textContent);
      if (!label || label.length > 56 || !/^https?:/i.test(link.href) || seen.has(link.href)) continue;
      seen.add(link.href);
      const folder = /thread\.php|forum\.php/i.test(link.href);
      result.push({ file: sanitizeFileStem(label) + (folder ? "" : `.${getLanguage() === "python" ? "py" : "ts"}`), url: link.href, folder });
    }
    return result;
  }

  function collectPageLinks() {
    const result = [];
    const seen = new Set();
    for (const anchor of document.querySelectorAll("#pagebtop a[href],#pagebbtm a[href]")) {
      if (!/^https?:/i.test(anchor.href) || seen.has(anchor.href)) continue;
      seen.add(anchor.href);
      const raw = cleanText(anchor.textContent);
      let label = (raw.match(/\d+/) || [""])[0];
      if (/上|prev|left|‹|«/i.test(raw)) label = "←";
      else if (/下|next|right|›|»/i.test(raw)) label = "→";
      if (!label) label = "•";
      result.push({ label, url: anchor.href });
    }
    return result.slice(0, 14);
  }

  function renderHome(context) {
    const editor = document.getElementById("nga-vsc-editor");
    editor.replaceChildren();
    const links = collectHomeLinks();
    const recent = links.slice(0, 6);
    const welcome = el("div", { class: "nga-vsc-welcome" }, el("div", { class: "nga-vsc-welcome-inner" },
      el("section", {}, el("div", { class: "nga-vsc-logo", text: "Visual Studio Code" }), el("div", { class: "nga-vsc-subtitle", text: "Editing evolved" }),
        el("div", { class: "nga-vsc-command-list" },
          ...recent.map((item) => el("button", { class: "nga-vsc-command-link", type: "button", dataset: { url: item.url }, text: `Open ${item.file}` })),
          el("button", { class: "nga-vsc-command-link", type: "button", dataset: { url: new URL("/search.php", location.origin).href }, text: "Search workspace…" })
        )),
      el("section", { class: "nga-vsc-shortcuts" }, shortcut("Show All Commands", "Ctrl+Shift+P"), shortcut("Go to File", "Ctrl+P"), shortcut("Find in Files", "Ctrl+Shift+F"), shortcut("Toggle Terminal", "Ctrl+`"), shortcut("Zen Mode", "Click title icon"))
    ));
    editor.append(welcome);
  }

  function shortcut(label, keys) { return el("div", { class: "nga-vsc-shortcut" }, el("span", { text: label }), el("kbd", { text: keys })); }

  function renderTopicList(context) {
    const editor = document.getElementById("nga-vsc-editor");
    editor.replaceChildren();
    const topics = collectTopics();
    const list = el("div", { class: "nga-vsc-changes" });
    list.append(el("div", { class: "nga-vsc-change-head" }, el("span", { text: "Path" }), el("span", { text: "Contributor" }), el("span", { text: "Modified" }), el("span", { text: "Problems" })));
    for (const topic of topics) {
      list.append(el("div", { class: "nga-vsc-change-row", dataset: { url: topic.url } },
        el("div", { class: "nga-vsc-change-file" }, icon("fileTs"), el("span", { class: "nga-vsc-change-name", text: `src/${topic.file}` })),
        el("span", { class: "nga-vsc-change-meta", text: `@${sanitizeIdentifier(topic.author)}` }),
        el("span", { class: "nga-vsc-change-meta", text: topic.modified }),
        el("span", { class: "nga-vsc-modified", text: topic.replies })
      ));
    }
    if (!topics.length) list.append(el("div", { class: "nga-vsc-change-row" }, el("span", { class: "nga-vsc-change-meta", text: "No changes detected." })));
    editor.append(list);
  }

  function getReadTitle() {
    return cleanText(document.querySelector('[id^="postsubject"]')?.textContent) || cleanText(document.querySelector("#m_nav")?.lastElementChild?.textContent) || stripSiteTitle(state.originalTitle) || "untitled";
  }

  function renderReadPage(context) {
    const editor = document.getElementById("nga-vsc-editor");
    editor.replaceChildren();
    const code = el("div", { class: "nga-vsc-code" });
    let lineNo = 1;
    const posts = collectPosts();
    state.resources = posts.flatMap((post) => post.resources);
    const language = getLanguage();
    const className = toPascalCase(sanitizeIdentifier(getReadTitle())) || "WorkspaceModule";
    const emit = (text, href) => { appendCodeLine(code, lineNo++, text, href); };
    if (language === "typescript") {
      emit('import { Workspace, Reply } from "./runtime";'); emit(""); emit(`export class ${className} extends Workspace {`);
      posts.forEach((post, index) => {
        appendCodeLens(code, post, index);
        emit(index === 0 ? "  /**" : `  @Reply({ floor: ${post.floorNumber || index + 1} })`);
        if (index === 0) {
          emit(`   * @author ${post.author}`); if (post.time) emit(`   * @since ${post.time}`); emit("   */");
          emit("  public initialize(): void {");
        } else {
          emit(`  public reply_${sanitizeIdentifier(post.author)}_${post.floorNumber || index + 1}(): void {`);
        }
        for (const line of post.quoteLines) emit(`    // > ${line}`);
        for (const line of post.bodyLines) emit(`    // ${line}`);
        for (const line of post.commentLines) emit(`    // comment: ${line}`);
        if (post.signatureLines.length) emit(`    // metadata: [folded ${post.signatureLines.length} line${post.signatureLines.length === 1 ? "" : "s"}]`);
        post.links.forEach((link, linkIndex) => emit(`    const reference_${index}_${linkIndex} = "${escapeCodeString(link.url)}";`, link.url));
        post.resources.forEach((resource, assetIndex) => emit(`    const asset_${index}_${assetIndex} = import("./assets/${resource.name}");`, resource.url));
        if (!post.bodyLines.length && !post.resources.length && !post.links.length) emit("    // no changes");
        emit("  }"); emit("");
      });
      emit("}");
    } else {
      emit("from runtime import Workspace, reply"); emit(""); emit(`class ${className}(Workspace):`);
      if (!posts.length) emit("    pass");
      posts.forEach((post, index) => {
        appendCodeLens(code, post, index);
        if (index === 0) {
          emit(`    \"\"\"@author ${post.author}${post.time ? ` · ${post.time}` : ""}\"\"\"`); emit("    def initialize(self):");
        } else {
          emit(`    @reply(floor=${post.floorNumber || index + 1})`); emit(`    def reply_${sanitizeIdentifier(post.author)}_${post.floorNumber || index + 1}(self):`);
        }
        for (const line of post.quoteLines) emit(`        # > ${line}`);
        for (const line of post.bodyLines) emit(`        # ${line}`);
        for (const line of post.commentLines) emit(`        # comment: ${line}`);
        if (post.signatureLines.length) emit(`        # metadata: [folded ${post.signatureLines.length} line${post.signatureLines.length === 1 ? "" : "s"}]`);
        post.links.forEach((link, linkIndex) => emit(`        reference_${index}_${linkIndex} = "${escapeCodeString(link.url)}"`, link.url));
        post.resources.forEach((resource, assetIndex) => emit(`        asset_${index}_${assetIndex} = load_asset("assets/${resource.name}")`, resource.url));
        if (!post.bodyLines.length && !post.resources.length && !post.links.length) emit("        pass");
        emit("");
      });
    }
    editor.append(code);
    renderQuickReplyPanel();
    renderSidebar(context);
  }

  function collectPosts() {
    const result = [];
    for (const row of document.querySelectorAll('[id^="post1strow"]')) {
      const match = row.id.match(/(\d+)$/);
      const index = match ? match[1] : String(result.length);
      const content = row.querySelector(`#postcontent${cssEscape(index)}`) || row.querySelector(".postcontent.ubbcode,.postcontent");
      if (!content) continue;
      const author = cleanText(row.querySelector(`#postauthor${cssEscape(index)}`)?.textContent) || "contributor";
      const time = cleanText(row.querySelector(`#postdate${cssEscape(index)}`)?.textContent);
      const floorText = cleanText(row.querySelector(`#postBtnPos${cssEscape(index)}`)?.textContent) || `#${Number(index) + 1}`;
      const floorNumber = Number((floorText.match(/\d+/) || [Number(index) + 1])[0]);
      const clone = content.cloneNode(true);
      const quoteLines = [];
      for (const quote of clone.querySelectorAll(".quote")) {
        quoteLines.push(...textLines(quote.textContent));
        quote.remove();
      }
      const bodyLines = textLines(clone.textContent);
      const resources = collectResources(content, index);
      const links = collectContentLinks(content, resources);
      const commentLines = [];
      const commentSeen = new Set();
      for (const comment of row.querySelectorAll('[id^="postcomment_"],.comment_c')) {
        const text = cleanText(comment.textContent);
        if (text && !commentSeen.has(text)) { commentSeen.add(text); commentLines.push(...textLines(text)); }
      }
      const signatureLines = textLines(row.querySelector(`#postsign${cssEscape(index)}`)?.textContent).slice(0, 20);
      result.push({ row, index, author, time, floorNumber, bodyLines, quoteLines, commentLines, signatureLines, links, resources });
    }
    return result;
  }

  function collectResources(content, postIndex) {
    const resources = [];
    const seen = new Set();
    const candidates = [...content.querySelectorAll("img[src],a[href]")];
    for (const node of candidates) {
      const url = node.tagName === "IMG" ? node.currentSrc || node.src : node.href;
      if (!url || seen.has(url)) continue;
      const isImage = node.tagName === "IMG" || /\.(?:png|jpe?g|gif|webp|bmp)(?:\?|$)/i.test(url);
      const isAttachment = isImage || /attach|attachment|download/i.test(url);
      if (!isAttachment) continue;
      seen.add(url);
      const path = new URL(url, location.href).pathname;
      const rawName = decodeURIComponent(path.split("/").pop() || `asset_${postIndex}_${resources.length + 1}`);
      resources.push({ name: sanitizeFileStem(rawName).slice(0, 56) || `asset_${postIndex}_${resources.length + 1}`, url, image: isImage });
    }
    return resources;
  }

  function collectContentLinks(content, resources) {
    const resourceUrls = new Set(resources.map((resource) => resource.url));
    const seen = new Set();
    const links = [];
    for (const anchor of content.querySelectorAll("a[href]")) {
      const url = anchor.href;
      if (!url || url.startsWith("javascript:") || resourceUrls.has(url) || seen.has(url)) continue;
      seen.add(url);
      links.push({ label: cleanText(anchor.textContent) || url, url });
    }
    return links.slice(0, 80);
  }

  function appendCodeLens(code, post, index) {
    const actions = el("div", { class: "nga-vsc-codelens-actions" });
    const specs = [
      [index === 0 ? "Run Module" : "Run Function", post.row.querySelector('a[href*="post.php"][title*="回复"],a[href*="post.php"]')],
      ["Bookmark Symbol", post.row.querySelector(".postfavb")], ["Source Actions", post.row.querySelector(".postoptb")], ["Add Reaction", post.row.querySelector(".ogoodbtn")]
    ];
    for (const [label, native] of specs) if (native) actions.append(el("button", { type: "button", dataset: { nativeAction: registerNativeAction(native) }, text: label }));
    if (!actions.childElementCount && index === 0) {
      const reply = document.querySelector('#m_pbtntop a[href*="post.php"],#m_pbtnbtm a[href*="post.php"]');
      if (reply) actions.append(el("button", { type: "button", dataset: { url: reply.href }, text: "Run Module" }));
    }
    code.append(el("div", { class: "nga-vsc-codelens" }, el("span", {}), actions));
  }

  function appendCodeLine(container, number, source, href) {
    const text = el("span", { class: "nga-vsc-line-text" });
    if (href) {
      const anchor = el("a", { class: "nga-vsc-code-link", href: "#", dataset: { url: href } });
      appendHighlighted(anchor, source);
      text.append(anchor);
    } else appendHighlighted(text, source);
    container.append(el("div", { class: "nga-vsc-code-line" }, el("span", { class: "nga-vsc-line-no", text: String(number) }), text));
  }

  function appendHighlighted(target, source) {
    const text = String(source ?? "");
    if (/^\s*(\/\/|\/\*|\*|#)/.test(text) || /^\s*\"\"\"/.test(text)) {
      target.append(el("span", { class: "tok-comment", text }));
      return;
    }
    const pattern = /(\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*')|(\b(?:import|from|export|class|extends|public|private|const|let|function|return|void|def|self|pass|as)\b)|(@[A-Za-z_][\w]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*(?=\s*\())/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      if (match.index > cursor) target.append(document.createTextNode(text.slice(cursor, match.index)));
      const cls = match[1] ? "tok-string" : match[2] ? "tok-keyword" : match[3] ? "tok-decorator" : match[4] ? "tok-number" : "tok-function";
      target.append(el("span", { class: cls, text: match[0] }));
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) target.append(document.createTextNode(text.slice(cursor)));
    if (!text) target.append(document.createTextNode(" "));
  }

  function renderQuickReplyPanel() {
    const native = document.querySelector("#fast_post_c");
    if (!native) return;
    const textarea = native.querySelector("textarea");
    const submit = [...native.querySelectorAll("a,button,input")].find((node) => node.matches("a.uitxt1") || /发表回复|add comment/i.test(cleanText(node.textContent || node.value)));
    if (!textarea || !submit || !textarea.parentNode) return;
    const panel = document.getElementById("nga-vsc-panel");
    const slot = el("span", { class: "nga-vsc-native-slot", "aria-hidden": "true" });
    const original = {
      parent: textarea.parentNode,
      className: textarea.className,
      style: textarea.getAttribute("style"),
      rows: textarea.getAttribute("rows"),
      wrap: textarea.getAttribute("wrap"),
      ariaLabel: textarea.getAttribute("aria-label")
    };
    textarea.parentNode.insertBefore(slot, textarea);
    native.classList.add("nga-vsc-native-proxy");
    native.setAttribute("aria-hidden", "true");

    const runButton = el("button", { class: "nga-vsc-panel-tool nga-vsc-terminal-run", type: "button", title: "Run Active File (Ctrl+Enter)", "aria-label": "Run Active File", dataset: { command: "terminal-submit" } }, icon("run"));
    const closeButton = el("button", { class: "nga-vsc-panel-tool", type: "button", title: "Close Panel", "aria-label": "Close Panel", dataset: { command: "terminal-close" } }, icon("close"));
    const title = el("div", { class: "nga-vsc-panel-title" },
      el("span", { class: "nga-vsc-panel-tab", text: "Terminal" }),
      el("div", { class: "nga-vsc-panel-tools" }, runButton, closeButton)
    );
    const body = el("div", { class: "nga-vsc-panel-body" });
    const terminal = el("div", { class: "nga-vsc-terminal", "aria-label": "Integrated Terminal" });
    const language = getLanguage();
    terminal.append(
      el("div", { class: "nga-vsc-terminal-line", text: language === "python" ? "PS C:\\workspace> python .\\src\\add_comment.py" : "PS C:\\workspace> npm run dev" }),
      el("div", { class: "nga-vsc-terminal-line nga-vsc-terminal-muted", text: language === "python" ? "[ready] Python worker attached to workspace" : "> workspace@1.0.0 dev" }),
      el("div", { class: "nga-vsc-terminal-line nga-vsc-terminal-muted", text: language === "python" ? "[edit] update the comment block, then press Ctrl+Enter" : "> tsx src/add-comment.ts" }),
      el("div", { class: "nga-vsc-terminal-line nga-vsc-terminal-muted", text: "[ready] editor attached · Ctrl+Enter to run" })
    );

    const code = el("div", { class: "nga-vsc-terminal-code" });
    const opening = language === "python" ? "def add_comment() -> None:" : "export async function addComment(): Promise<void> {";
    const indent = language === "python" ? "    " : "  ";
    const prefix = language === "python" ? "#" : "//";
    code.append(terminalSourceRow(1, "", opening));
    const lineNumbers = el("span", { class: "nga-vsc-terminal-line-no" });
    const prefixes = el("span", { class: "nga-vsc-terminal-prefix" });
    textarea.className = "nga-vsc-terminal-input";
    textarea.setAttribute("rows", "3");
    textarea.setAttribute("wrap", "off");
    textarea.setAttribute("aria-label", "Editable comment");
    textarea.removeAttribute("style");
    const editRow = el("div", { class: "nga-vsc-terminal-code-row nga-vsc-terminal-edit-row" }, lineNumbers, prefixes, textarea);
    const closing = terminalSourceRow(5, "", language === "python" ? `${indent}return` : "}");
    code.append(editRow, closing);
    terminal.append(code);
    body.append(terminal);
    panel.append(title, body, native);

    state.quickReply = { native, textarea, submit, slot, original, lineNumbers, prefixes, closingNumber: closing.querySelector(".nga-vsc-terminal-line-no"), prefix, baseLine: 2 };
    if (textarea.dataset.ngaVscTerminalBound !== "1") {
      textarea.dataset.ngaVscTerminalBound = "1";
      textarea.addEventListener("input", () => syncTerminalInput(textarea));
      textarea.addEventListener("keydown", (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
        if (state.quickReply?.textarea !== textarea) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        triggerQuickReply();
      }, true);
    }
    syncTerminalInput(textarea);
    panel.setAttribute("aria-hidden", state.terminalOpen ? "false" : "true");
  }

  function terminalSourceRow(number, prefix, source) {
    return el("div", { class: "nga-vsc-terminal-code-row" },
      el("span", { class: "nga-vsc-terminal-line-no", text: String(number) }),
      el("span", { class: "nga-vsc-terminal-prefix", text: prefix }),
      el("span", { class: "nga-vsc-terminal-source", text: source })
    );
  }

  function syncTerminalInput(textarea) {
    const binding = state.quickReply;
    if (!binding || binding.textarea !== textarea) return;
    const rows = Math.max(3, Math.min(8, String(textarea.value || "").replace(/\r/g, "").split("\n").length));
    textarea.setAttribute("rows", String(rows));
    textarea.style.setProperty("height", `${rows * 20}px`, "important");
    binding.lineNumbers.textContent = Array.from({ length: rows }, (_, index) => binding.baseLine + index).join("\n");
    binding.prefixes.textContent = Array.from({ length: rows }, () => binding.prefix).join("\n");
    binding.closingNumber.textContent = String(binding.baseLine + rows);
  }

  function triggerQuickReply() {
    const binding = state.quickReply;
    if (!binding?.submit?.isConnected) return;
    binding.submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  }

  function restoreQuickReply() {
    const binding = state.quickReply;
    if (!binding) return;
    const { textarea, slot, original, native } = binding;
    if (slot?.isConnected) slot.replaceWith(textarea);
    else if (original.parent?.isConnected) original.parent.append(textarea);
    textarea.className = original.className;
    restoreAttribute(textarea, "style", original.style);
    restoreAttribute(textarea, "rows", original.rows);
    restoreAttribute(textarea, "wrap", original.wrap);
    restoreAttribute(textarea, "aria-label", original.ariaLabel);
    native.classList.remove("nga-vsc-native-proxy");
    native.removeAttribute("aria-hidden");
    if (document.body && native.closest(`#${APP_ID}`)) document.body.append(native);
    state.quickReply = null;
  }

  function restoreAttribute(node, name, value) {
    if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
  }

  function renderSearch() {
    const editor = document.getElementById("nga-vsc-editor");
    const page = el("div", { class: "nga-vsc-search-page" });
    const forms = [...document.querySelectorAll("#mc form")].filter((form) => form.querySelector('input[type="text"],input:not([type])'));
    forms.forEach((nativeForm, index) => {
      const nativeInput = nativeForm.querySelector('input[type="text"],input:not([type])');
      if (!nativeInput) return;
      const id = `search-${++state.searchSerial}`;
      state.searchTargets.set(id, { form: nativeForm, input: nativeInput });
      const form = el("form", { class: "nga-vsc-search-form", dataset: { searchId: id } },
        el("input", { class: "nga-vsc-input", type: "search", value: nativeInput.value || "", placeholder: "Search workspace" }),
        el("button", { class: "nga-vsc-button", type: "submit", text: "Search" })
      );
      page.append(el("section", { class: "nga-vsc-search-group" }, el("div", { class: "nga-vsc-search-label", text: index === 0 ? "Search Files" : `Search Provider ${index + 1}` }), form));
    });
    if (!forms.length) page.append(el("div", { class: "nga-vsc-change-meta", text: "Search provider is loading…" }));
    editor.replaceChildren(page);
  }

  function renderNativePortal(context, isPost) {
    const editor = document.getElementById("nga-vsc-editor");
    let source = document.querySelector("#mc");
    if (!source || source.closest(`#${APP_ID}`)) source = document.querySelector(`#${APP_ID} #mc`);
    if (!source) {
      const code = el("div", { class: "nga-vsc-code" });
      appendCodeLine(code, 1, getLanguage() === "python" ? "# Resource is loading…" : "// Resource is loading…");
      editor.replaceChildren(code);
      return;
    }
    const portal = el("div", { class: "nga-vsc-native-portal", id: "nga-vsc-native-portal" });
    portal.append(source);
    renameNativeControls(portal);
    editor.replaceChildren(portal);
    if (isPost) {
      const panel = document.getElementById("nga-vsc-panel");
      panel.append(el("div", { class: "nga-vsc-panel-title" }, el("span", { text: "Problems" }), el("span", { text: "Output" }), el("span", { text: "Debug Console" })));
    }
  }

  function renameNativeControls(root) {
    const replacements = [
      [/NGA玩家社区|NGA|玩家社区/gi, "workspace"], [/发表主题|发新帖|发帖/g, "New File"], [/发表回复|回复主题|回复/g, "Add Comment"],
      [/收藏/g, "Bookmark"], [/搜索/g, "Search"], [/主题/g, "Module"], [/版面/g, "Folder"], [/楼主/g, "Owner"], [/提交|发送/g, "Commit Changes"], [/附件/g, "Assets"]
    ];
    for (const control of root.querySelectorAll('input[type="button"],input[type="submit"],button')) {
      if (control.tagName === "INPUT") {
        let value = control.value || "";
        for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
        if (value) control.value = value;
      } else {
        let text = control.textContent || "";
        for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
        if (text.trim()) control.textContent = text;
      }
    }
    for (const node of root.querySelectorAll("h1,h2,h3,legend,th,label")) {
      let text = node.textContent || "";
      for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
      if (text !== node.textContent) node.textContent = text;
    }
    for (const node of root.querySelectorAll("[title],[alt],[placeholder]")) {
      for (const attribute of ["title", "alt", "placeholder"]) {
        if (!node.hasAttribute(attribute)) continue;
        let value = node.getAttribute(attribute) || "";
        for (const [pattern, replacement] of replacements) value = value.replace(pattern, replacement);
        node.setAttribute(attribute, value);
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    for (const textNode of textNodes) {
      const parent = textNode.parentElement;
      if (!parent || parent.closest("textarea,input,script,style,.postcontent")) continue;
      let text = textNode.nodeValue || "";
      for (const [pattern, replacement] of replacements) text = text.replace(pattern, replacement);
      textNode.nodeValue = text;
    }
  }

  function registerNativeAction(node) {
    const id = `action-${++state.actionSerial}`;
    state.nativeActions.set(id, node);
    return id;
  }

  function syncNativeOverlays() {
    const overlay = document.getElementById("nga-vsc-overlay");
    if (!overlay) return;
    for (const popup of document.querySelectorAll("#startmenu,.commonwindow,.single_ttip2")) {
      if (popup.closest(`#${APP_ID}`)) continue;
      overlay.append(popup);
      popup.style.position = "absolute";
      popup.style.right = "12px";
      popup.style.top = "8px";
      popup.style.left = "auto";
      popup.style.background = "var(--vsc-panel)";
      popup.style.color = "var(--vsc-text)";
      popup.style.border = "1px solid var(--vsc-border)";
    }
  }

  function postSettingsToEditors() {
    const message = { type: "nga-vsc-settings", theme: getTheme(), language: getLanguage() };
    for (const frame of document.querySelectorAll(`iframe[src*="${FRAME_HOST}${FRAME_PATH}"]`)) {
      try { frame.contentWindow?.postMessage(message, `https://${FRAME_HOST}`); } catch { /* ignored */ }
      if (frame.dataset.ngaVscSettingsBound !== "1") {
        frame.dataset.ngaVscSettingsBound = "1";
        frame.addEventListener("load", () => {
          try { frame.contentWindow?.postMessage({ type: "nga-vsc-settings", theme: getTheme(), language: getLanguage() }, `https://${FRAME_HOST}`); } catch { /* ignored */ }
        });
      }
    }
  }

  function updateStatus(context = buildPageContext()) {
    const language = getLanguage();
    const languageButton = document.getElementById("nga-vsc-language");
    const themeButton = document.getElementById("nga-vsc-theme");
    const statusContext = document.getElementById("nga-vsc-status-context");
    if (languageButton) languageButton.textContent = language === "python" ? "Python" : "TypeScript";
    if (themeButton) themeButton.textContent = getTheme() === "light" ? "Light+" : "Dark+";
    const contextNames = { home: "workspace", forum: "source", favorites: "bookmarks", search: "search", read: "editor", post: "editor", other: "resource" };
    if (statusContext) statusContext.textContent = `${contextNames[context.kind] || "resource"} · ${context.tid ? `module ${context.tid}` : context.fid ? `folder ${context.fid}` : "workspace"}`;
  }

  function textLines(value) {
    const normalized = String(value || "").replace(/\r/g, "").replace(/[\t\u00a0]+/g, " ").replace(/ +\n/g, "\n");
    const result = [];
    for (const raw of normalized.split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;
      const chars = Array.from(line);
      for (let start = 0; start < chars.length; start += 108) result.push(chars.slice(start, start + 108).join(""));
    }
    return result.slice(0, 800);
  }

  function cleanText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function escapeCodeString(value) { return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }
  function stripSiteTitle(value) { return cleanText(value).replace(/\s*(?:NGA玩家社区|NGA).*$/i, "").trim(); }
  function sanitizeFileStem(value) {
    return cleanText(value).replace(/[\\/:*?"<>|#%&{}$!'@+`=]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 58) || "untitled";
  }
  function sanitizeIdentifier(value) {
    const cleaned = cleanText(value).replace(/[^\p{L}\p{N}_]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "contributor";
    return /^\d/.test(cleaned) ? `user_${cleaned}` : cleaned;
  }
  function toPascalCase(value) { return String(value || "").split(/_+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("").slice(0, 48); }
  function cssEscape(value) { return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^\w-]/g, "\\$&"); }

  function bootEditorFrame() {
    const FRAME_STYLE_ID = "nga-vsc-frame-style";
    const applyFrameTheme = (theme) => document.documentElement.classList.toggle("nga-vsc-frame-light", theme === "light");
    const install = () => {
      if (!document.body || document.getElementById(FRAME_STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = FRAME_STYLE_ID;
      style.textContent = `
        :root { --fe-bg:#1e1e1e; --fe-text:#d4d4d4; --fe-gutter:#858585; --fe-border:#3c3c3c; color-scheme:dark; }
        :root.nga-vsc-frame-light { --fe-bg:#fff; --fe-text:#333; --fe-gutter:#237893; --fe-border:#d4d4d4; color-scheme:light; }
        html,body { margin:0!important; width:100%!important; min-height:100%!important; background:var(--fe-bg)!important; color:var(--fe-text)!important; overflow:hidden!important; }
        body { position:relative!important; padding:0!important; }
        #nga-vsc-editor-gutter { position:fixed; z-index:2; inset:0 auto 0 0; width:48px; overflow:hidden; padding-top:8px; border-right:1px solid var(--fe-border); background:var(--fe-bg); color:var(--fe-gutter); text-align:right; padding-right:9px; white-space:pre; font:13px/21px "Cascadia Code",Consolas,monospace; pointer-events:none; }
        #nbWysiwyg { position:absolute!important; inset:0!important; width:100%!important; height:100vh!important; min-height:100vh!important; margin:0!important; padding:8px 16px 40px 58px!important; resize:none!important; border:0!important; outline:0!important; box-shadow:none!important; background:var(--fe-bg)!important; color:var(--fe-text)!important; caret-color:var(--fe-text)!important; font:14px/21px "Cascadia Code","Microsoft YaHei",Consolas,monospace!important; }
      `;
      document.head.append(style);
      const gutter = document.createElement("div");
      gutter.id = "nga-vsc-editor-gutter";
      gutter.setAttribute("aria-hidden", "true");
      gutter.textContent = Array.from({ length: 500 }, (_, index) => index + 1).join("\n");
      document.body.append(gutter);
      applyFrameTheme(matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    };
    if (document.body) install(); else document.addEventListener("DOMContentLoaded", install, { once: true });
    addEventListener("message", (event) => {
      if (!/^(https:\/\/(?:bbs\.nga\.cn|ngabbs\.com|nga\.178\.com|g\.nga\.cn|bbs\.ngacn\.cc))$/.test(event.origin)) return;
      if (event.data?.type === "nga-vsc-settings") applyFrameTheme(event.data.theme);
    });
  }
})();
