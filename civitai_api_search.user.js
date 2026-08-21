// ==UserScript==
// @name         Civitai API検索
// @namespace    https://civitai.com/
// @version      1.1.0
// @description  Civitai上からGitHub版のCivitai API検索画面を直接開きます。コレクション横断検索と同じ左右分割レイアウト対応。
// @homepageURL  https://github.com/j13351th-coder/civitai_api_search
// @supportURL   https://github.com/j13351th-coder/civitai_api_search/issues
// @updateURL    https://raw.githubusercontent.com/j13351th-coder/civitai_api_search/main/civitai_api_search.user.js
// @downloadURL  https://raw.githubusercontent.com/j13351th-coder/civitai_api_search/main/civitai_api_search.user.js
// @match        https://civitai.com/*
// @match        https://civitai.red/*
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  const APP_ID = 'civitai-api-search-launcher';
  const OVERLAY_ID = 'civitai-api-search-overlay';
  const RAW_HTML_URL = 'https://raw.githubusercontent.com/j13351th-coder/civitai_api_search/main/civitai_api_search_v4.html';

  let loadedHtml = null;
  let loadingPromise = null;
  let previousOverflow = '';

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 20000,
        headers: { Accept: 'text/html,text/plain;q=0.9,*/*;q=0.8' },
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText || '');
          else reject(new Error(`GitHub HTML取得失敗: HTTP ${res.status}`));
        },
        onerror: () => reject(new Error('GitHub HTMLの取得中に通信エラーが発生しました。')),
        ontimeout: () => reject(new Error('GitHub HTMLの取得がタイムアウトしました。')),
      });
    });
  }

  function prepareHtml(html) {
    const baseTag = `<base href="${location.origin}/">`;
    if (/<head(?:\s[^>]*)?>/i.test(html)) {
      return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}\n${baseTag}`);
    }
    return `${baseTag}\n${html}`;
  }

  async function getHtml() {
    if (loadedHtml) return loadedHtml;
    if (!loadingPromise) {
      loadingPromise = requestText(`${RAW_HTML_URL}?t=${Date.now()}`)
        .then((html) => {
          if (!html.trim()) throw new Error('GitHubから空のHTMLが返されました。');
          loadedHtml = prepareHtml(html);
          return loadedHtml;
        })
        .finally(() => { loadingPromise = null; });
    }
    return loadingPromise;
  }

  function applyCollectionStyleLayout(frame) {
    const doc = frame.contentDocument;
    if (!doc?.body || doc.documentElement.dataset.collectionStyleLayout === '1') return;

    const wrap = doc.querySelector('.wrap');
    if (!wrap) return;

    const title = wrap.querySelector(':scope > h1');
    const subtitle = wrap.querySelector(':scope > .subtitle');
    const panel = wrap.querySelector(':scope > .panel');
    const toolbar = wrap.querySelector(':scope > .toolbar');
    const results = wrap.querySelector(':scope > #results');
    const foot = wrap.querySelector(':scope > .foot');
    if (!panel || !toolbar || !results) return;

    doc.documentElement.dataset.collectionStyleLayout = '1';

    const style = doc.createElement('style');
    style.textContent = `
      html,body{height:100%;overflow:hidden}
      body{margin:0;background:#0e1117}
      .wrap{max-width:none!important;width:100%!important;height:100vh!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
      .api-page-header{flex:0 0 auto;padding:11px 16px 10px;background:#121721;border-bottom:1px solid #2b3241}
      .api-page-header h1{margin:0 0 3px!important;font-size:20px!important;line-height:1.25}
      .api-page-header .subtitle{margin:0!important;font-size:12px!important;line-height:1.45}
      .api-layout{display:grid;grid-template-columns:300px minmax(0,1fr);flex:1;min-height:0;overflow:hidden;transition:grid-template-columns .22s cubic-bezier(.4,0,.2,1)}
      .api-sidebar{min-width:0;overflow:auto;padding:14px;background:#111620;border-right:1px solid #2b3241;opacity:1;transform:translateX(0);transition:opacity .16s ease,transform .22s cubic-bezier(.4,0,.2,1),padding-left .22s cubic-bezier(.4,0,.2,1),padding-right .22s cubic-bezier(.4,0,.2,1),border-color .16s ease}
      .api-sidebar-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;min-width:0}
      .api-sidebar-title{font-size:14px;font-weight:900;color:#edf1f7}
      .api-collapse-btn,.api-expand-btn{flex:0 0 auto;width:34px!important;height:34px!important;min-height:34px!important;padding:0!important;display:grid!important;place-items:center!important;border:1px solid #3a4356!important;border-radius:999px!important;background:#202839!important;color:#eef2f8!important;font-size:17px!important;line-height:1!important;font-weight:900!important;cursor:pointer!important;box-shadow:none!important}
      .api-collapse-btn:hover,.api-expand-btn:hover{background:#2a3448!important}
      .api-sidebar .panel{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important}
      .api-sidebar .controls,.api-sidebar .controls.secondary-row{display:flex!important;flex-direction:column!important;grid-template-columns:none!important;gap:12px!important;margin:0!important;align-items:stretch!important}
      .api-sidebar .controls.secondary-row{margin-top:12px!important}
      .api-sidebar .field{width:100%!important;gap:6px!important}
      .api-sidebar .controls > .field > button,.api-sidebar .controls.secondary-row > button{width:100%!important}
      .api-sidebar .controls.secondary-row > div:empty{display:none!important}
      .api-sidebar input[type="text"],.api-sidebar select{height:40px!important}
      .api-sidebar .check{height:40px!important}
      .api-sidebar button{min-height:40px}
      .api-sidebar .notice{margin-top:12px!important}
      .api-results-pane{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#0e1117}
      .api-results-topbar{flex:0 0 auto;min-height:54px;display:flex;align-items:stretch;border-bottom:1px solid #2b3241;background:#121721}
      .api-expand-slot{flex:0 0 0;width:0;overflow:hidden;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateX(-8px);transition:width .22s cubic-bezier(.4,0,.2,1),flex-basis .22s cubic-bezier(.4,0,.2,1),opacity .16s ease,transform .22s cubic-bezier(.4,0,.2,1)}
      .api-results-topbar .toolbar{flex:1;min-width:0;margin:0!important;padding:8px 14px!important}
      .api-results-scroll{flex:1;min-height:0;overflow:auto;padding:14px;scrollbar-gutter:stable}
      .api-results-scroll .grid{grid-template-columns:repeat(auto-fill,minmax(270px,1fr))!important;gap:14px!important}
      .api-results-scroll .foot{margin:16px 0 0!important}
      .wrap.sidebar-hidden .api-layout{grid-template-columns:0px minmax(0,1fr)}
      .wrap.sidebar-hidden .api-sidebar{opacity:0;transform:translateX(-24px);padding-left:0;padding-right:0;border-right-color:transparent;pointer-events:none}
      .wrap.sidebar-hidden .api-expand-slot{flex-basis:48px;width:48px;opacity:1;transform:translateX(0)}
      @media (prefers-reduced-motion: reduce){.api-layout,.api-sidebar,.api-expand-slot{transition:none!important}}
      @media(max-width:900px){.api-layout{grid-template-columns:250px minmax(0,1fr)}.api-results-scroll .grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))!important}}
      @media(max-width:680px){html,body{overflow:auto}.wrap{height:auto!important;min-height:100vh!important;overflow:visible!important}.api-layout{display:flex;flex-direction:column;overflow:visible}.api-sidebar{max-height:none;border-right:0;border-bottom:1px solid #2b3241}.api-results-pane{overflow:visible;min-height:520px}.api-results-scroll{overflow:visible}.wrap.sidebar-hidden .api-sidebar{max-height:0;padding-top:0;padding-bottom:0;border-bottom-color:transparent;overflow:hidden}.wrap.sidebar-hidden .api-layout{display:flex}}
    `;
    doc.head.appendChild(style);

    const header = doc.createElement('header');
    header.className = 'api-page-header';
    if (title) header.appendChild(title);
    if (subtitle) header.appendChild(subtitle);

    const layout = doc.createElement('div');
    layout.className = 'api-layout';

    const sidebar = doc.createElement('aside');
    sidebar.className = 'api-sidebar';

    const sidebarHeader = doc.createElement('div');
    sidebarHeader.className = 'api-sidebar-header';
    sidebarHeader.innerHTML = `<div class="api-sidebar-title">検索・絞り込み</div><button class="api-collapse-btn" type="button" title="検索欄を隠す" aria-label="検索欄を隠す">≪</button>`;
    sidebar.appendChild(sidebarHeader);
    sidebar.appendChild(panel);

    const resultsPane = doc.createElement('section');
    resultsPane.className = 'api-results-pane';

    const resultsTopbar = doc.createElement('div');
    resultsTopbar.className = 'api-results-topbar';

    const expandSlot = doc.createElement('div');
    expandSlot.className = 'api-expand-slot';
    expandSlot.innerHTML = `<button class="api-expand-btn" type="button" title="検索欄を表示" aria-label="検索欄を表示">≫</button>`;
    resultsTopbar.appendChild(expandSlot);
    resultsTopbar.appendChild(toolbar);

    const resultsScroll = doc.createElement('div');
    resultsScroll.className = 'api-results-scroll';
    resultsScroll.appendChild(results);
    if (foot) resultsScroll.appendChild(foot);

    resultsPane.appendChild(resultsTopbar);
    resultsPane.appendChild(resultsScroll);
    layout.appendChild(sidebar);
    layout.appendChild(resultsPane);
    wrap.replaceChildren(header, layout);

    const setSidebarVisible = (visible) => {
      wrap.classList.toggle('sidebar-hidden', !visible);
      try { localStorage.setItem('civitai-api-search-sidebar-visible', visible ? '1' : '0'); } catch {}
    };

    let initialVisible = true;
    try { initialVisible = localStorage.getItem('civitai-api-search-sidebar-visible') !== '0'; } catch {}
    setSidebarVisible(initialVisible);

    sidebarHeader.querySelector('.api-collapse-btn')?.addEventListener('click', () => setSidebarVisible(false));
    expandSlot.querySelector('.api-expand-btn')?.addEventListener('click', () => setSidebarVisible(true));
  }

  function createOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = ['position:fixed','inset:0','z-index:2147483647','display:none','background:rgba(5,7,11,.88)','backdrop-filter:blur(5px)','padding:14px','box-sizing:border-box'].join(';');

    overlay.innerHTML = `<div style="position:relative;width:100%;height:100%;background:#0d0f14;border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)"><div id="${OVERLAY_ID}-status" style="position:absolute;inset:0;display:grid;place-items:center;color:#dce5f5;font:600 14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#0d0f14;z-index:1;padding:30px;text-align:center">API検索画面を読み込んでいます…</div><iframe id="${OVERLAY_ID}-frame" title="Civitai API検索" style="width:100%;height:100%;border:0;display:block;background:#0d0f14"></iframe><button id="${OVERLAY_ID}-close" type="button" title="閉じる (Esc)" aria-label="API検索を閉じる" style="position:absolute;top:12px;right:14px;z-index:5;width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(15,18,25,.88);color:#fff;font:700 24px/1 system-ui;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.35)">×</button></div>`;

    document.body.appendChild(overlay);
    overlay.querySelector(`#${OVERLAY_ID}-close`).addEventListener('click', closeOverlay);
    return overlay;
  }

  function closeOverlay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.style.display === 'none') return;
    overlay.style.display = 'none';
    document.documentElement.style.overflow = previousOverflow;
  }

  async function openOverlay() {
    const overlay = createOverlay();
    const frame = overlay.querySelector(`#${OVERLAY_ID}-frame`);
    const status = overlay.querySelector(`#${OVERLAY_ID}-status`);

    previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    overlay.style.display = 'block';

    if (frame.dataset.loaded === '1') {
      status.style.display = 'none';
      return;
    }

    status.style.display = 'grid';
    status.textContent = 'API検索画面を読み込んでいます…';

    try {
      const html = await getHtml();
      frame.addEventListener('load', () => {
        try { applyCollectionStyleLayout(frame); }
        catch (error) { console.error('[Civitai API検索] レイアウト適用エラー', error); }
        status.style.display = 'none';
      }, { once: true });
      frame.srcdoc = html;
      frame.dataset.loaded = '1';
    } catch (error) {
      console.error('[Civitai API検索]', error);
      status.innerHTML = `<div><div style="font-size:18px;font-weight:800;margin-bottom:8px">API検索画面を読み込めませんでした</div><div style="color:#ffb8b8">${escapeHtml(error?.message || String(error))}</div><button id="${OVERLAY_ID}-retry" type="button" style="margin-top:16px;height:38px;padding:0 14px;border:0;border-radius:9px;background:#5865f2;color:white;font-weight:800;cursor:pointer">再試行</button></div>`;
      status.querySelector(`#${OVERLAY_ID}-retry`)?.addEventListener('click', () => {
        loadedHtml = null;
        openOverlay();
      }, { once: true });
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function ensureLauncher() {
    if (document.getElementById(APP_ID) || !document.body) return;

    const button = document.createElement('button');
    button.id = APP_ID;
    button.type = 'button';
    button.textContent = 'API検索';
    button.title = 'Civitai API検索を開く';
    button.style.cssText = ['position:fixed','right:18px','bottom:78px','z-index:2147483646','height:42px','padding:0 15px','border:1px solid rgba(255,255,255,.16)','border-radius:999px','background:linear-gradient(135deg,#5d8cff,#7a67ff)','color:#fff','font:800 13px/1 system-ui,-apple-system,Segoe UI,sans-serif','letter-spacing:.02em','cursor:pointer','box-shadow:0 6px 20px rgba(0,0,0,.35)'].join(';');

    button.addEventListener('click', openOverlay);
    document.body.appendChild(button);
  }

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlay(); });

  ensureLauncher();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(APP_ID)) ensureLauncher();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
