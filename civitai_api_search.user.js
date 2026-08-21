// ==UserScript==
// @name         Civitai API検索
// @namespace    https://civitai.com/
// @version      1.3.0
// @description  Civitai上からGitHub版のCivitai API検索画面を直接開きます。左右分割レイアウト・動画サムネイル・検索キーワード関連度順に対応。
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

  function injectRelevanceSupport(html) {
    const newestOption = '<option value="Newest">新着順</option>';
    const relevanceOption = '<option value="Relevance">関連度順（検索語）</option>';

    if (!html.includes('value="Relevance"') && html.includes(newestOption)) {
      html = html.replace(newestOption, `${newestOption}\n          ${relevanceOption}`);
    }

    if (!html.includes('api-relevance-fetch-patch')) {
      const patch = `<script id="api-relevance-fetch-patch">
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);

  function rewriteRequest(input) {
    try {
      const sourceUrl = typeof input === 'string'
        ? input
        : (input instanceof Request ? input.url : String(input));
      const url = new URL(sourceUrl, location.href);

      if (url.pathname === '/api/v1/models' && url.searchParams.get('sort') === 'Relevance') {
        const query = (url.searchParams.get('query') || '').trim();
        if (query) {
          url.searchParams.delete('sort');
          url.searchParams.delete('period');
        } else {
          url.searchParams.set('sort', 'Newest');
          url.searchParams.delete('period');
        }

        if (typeof input === 'string') return url.toString();
        if (input instanceof Request) return new Request(url.toString(), input);
      }
    } catch {}
    return input;
  }

  window.fetch = (input, init) => nativeFetch(rewriteRequest(input), init);

  document.addEventListener('click', (event) => {
    if (event.target?.id !== 'searchBtn') return;
    const sort = document.getElementById('sort');
    const query = document.getElementById('query');
    if (sort?.value === 'Relevance' && !(query?.value || '').trim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById('status');
      if (status) status.textContent = '関連度順を使う場合は検索語を入力してください。';
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.target?.id !== 'query') return;
    const sort = document.getElementById('sort');
    const query = document.getElementById('query');
    if (sort?.value === 'Relevance' && !(query?.value || '').trim()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const status = document.getElementById('status');
      if (status) status.textContent = '関連度順を使う場合は検索語を入力してください。';
    }
  }, true);
})();
</script>`;
      html = html.replace(/<script>/i, `${patch}\n\n<script>`);
    }

    return html;
  }

  function prepareHtml(html) {
    html = injectRelevanceSupport(html);
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

  function injectRuntimeCss(doc) {
    if (doc.getElementById('api-userscript-runtime-css')) return;
    const style = doc.createElement('style');
    style.id = 'api-userscript-runtime-css';
    style.textContent = `
      html,body{height:100%;overflow:hidden}
      .wrap{max-width:none!important;width:100%;height:100vh;margin:0!important;padding:0!important;display:flex;flex-direction:column;overflow:hidden}
      .api-page-header{flex:0 0 auto;padding:11px 16px 10px;background:#121721;border-bottom:1px solid var(--line)}
      .api-page-header h1{margin:0 0 3px;font-size:20px;line-height:1.25}
      .api-page-header .subtitle{margin:0;font-size:12px;line-height:1.45}
      .api-layout{display:grid;grid-template-columns:300px minmax(0,1fr);flex:1;min-height:0;overflow:hidden;transition:grid-template-columns .22s cubic-bezier(.4,0,.2,1)}
      .api-sidebar{min-width:0;overflow:auto;padding:14px;background:#111620;border-right:1px solid #2b3241;opacity:1;transform:translateX(0);transition:opacity .16s ease,transform .22s cubic-bezier(.4,0,.2,1),padding-left .22s cubic-bezier(.4,0,.2,1),padding-right .22s cubic-bezier(.4,0,.2,1),border-color .16s ease}
      .api-sidebar-header{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
      .api-sidebar-title{font-size:14px;font-weight:900;color:var(--text)}
      .api-collapse-btn,.api-expand-btn{flex:0 0 auto;width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid #3a4356;border-radius:999px;background:#202839;color:#eef2f8;font-size:17px;line-height:1;font-weight:900;cursor:pointer;box-shadow:none}
      .api-sidebar .panel{padding:0;border:0;border-radius:0;background:transparent}
      .api-sidebar .controls,.api-sidebar .controls.secondary-row{display:flex;flex-direction:column;gap:12px;margin:0;align-items:stretch}
      .api-sidebar .controls.secondary-row{margin-top:12px}
      .api-sidebar .field{width:100%}
      .api-sidebar .controls > .field > button,.api-sidebar .controls.secondary-row > button{width:100%}
      .api-sidebar .controls.secondary-row > div:empty{display:none}
      .api-results-pane{min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#0e1117}
      .api-results-topbar{flex:0 0 auto;min-height:54px;display:flex;align-items:stretch;border-bottom:1px solid #2b3241;background:#121721}
      .api-expand-slot{flex:0 0 0;width:0;overflow:hidden;display:flex;align-items:center;justify-content:center;opacity:0;transform:translateX(-8px);transition:width .22s cubic-bezier(.4,0,.2,1),flex-basis .22s cubic-bezier(.4,0,.2,1),opacity .16s ease,transform .22s cubic-bezier(.4,0,.2,1)}
      .api-results-topbar .toolbar{flex:1;min-width:0;margin:0;padding:8px 14px}
      .api-results-scroll{flex:1;min-height:0;overflow:auto;padding:14px;scrollbar-gutter:stable}
      .api-results-scroll .grid{grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
      .api-results-scroll .foot{margin:16px 0 0}
      .wrap.sidebar-hidden .api-layout{grid-template-columns:0px minmax(0,1fr)}
      .wrap.sidebar-hidden .api-sidebar{opacity:0;transform:translateX(-24px);padding-left:0;padding-right:0;border-right-color:transparent;pointer-events:none}
      .wrap.sidebar-hidden .api-expand-slot{flex-basis:48px;width:48px;opacity:1;transform:translateX(0)}
      .api-video-badge{position:absolute;right:10px;top:10px;z-index:5;background:rgba(8,10,15,.84);border:1px solid rgba(255,255,255,.18);box-shadow:0 2px 7px rgba(0,0,0,.3);backdrop-filter:blur(5px);border-radius:999px;padding:5px 8px;font-size:11px;line-height:1;font-weight:900;color:#fff;pointer-events:none}
      .thumb-wrap.api-has-video .top-badges{right:82px}
      video.thumb{background:#080a0f}
      @media(prefers-reduced-motion:reduce){.api-layout,.api-sidebar,.api-expand-slot{transition:none!important}}
      @media(max-width:900px){.api-layout{grid-template-columns:250px minmax(0,1fr)}.api-results-scroll .grid{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}}
      @media(max-width:680px){html,body{overflow:auto}.wrap{height:auto;min-height:100vh;overflow:visible}.api-layout{display:flex;flex-direction:column;overflow:visible}.api-sidebar{border-right:0;border-bottom:1px solid #2b3241}.api-results-pane,.api-results-scroll{overflow:visible}.wrap.sidebar-hidden .api-sidebar{max-height:0;padding-top:0;padding-bottom:0;border-bottom-color:transparent;overflow:hidden}}
    `;
    doc.head.appendChild(style);
  }

  function applySplitLayout(doc) {
    const wrap = doc.querySelector('.wrap');
    if (!wrap || wrap.dataset.apiSplitLayout === '1') return;
    const title = wrap.querySelector(':scope > h1');
    const subtitle = wrap.querySelector(':scope > .subtitle');
    const panel = wrap.querySelector(':scope > .panel');
    const toolbar = wrap.querySelector(':scope > .toolbar');
    const results = wrap.querySelector(':scope > #results');
    const foot = wrap.querySelector(':scope > .foot');
    if (!panel || !toolbar || !results) return;

    wrap.dataset.apiSplitLayout = '1';
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
    sidebarHeader.innerHTML = '<div class="api-sidebar-title">検索・絞り込み</div><button class="api-collapse-btn" id="api-collapse-sidebar" type="button" title="検索欄を隠す">≪</button>';
    sidebar.append(sidebarHeader, panel);

    const resultsPane = doc.createElement('section');
    resultsPane.className = 'api-results-pane';
    const topbar = doc.createElement('div');
    topbar.className = 'api-results-topbar';
    const expandSlot = doc.createElement('div');
    expandSlot.className = 'api-expand-slot';
    expandSlot.innerHTML = '<button class="api-expand-btn" id="api-expand-sidebar" type="button" title="検索欄を表示">≫</button>';
    topbar.append(expandSlot, toolbar);
    const scroll = doc.createElement('div');
    scroll.className = 'api-results-scroll';
    scroll.appendChild(results);
    if (foot) scroll.appendChild(foot);
    resultsPane.append(topbar, scroll);
    layout.append(sidebar, resultsPane);
    wrap.replaceChildren(header, layout);

    const setVisible = (visible) => {
      wrap.classList.toggle('sidebar-hidden', !visible);
      try { localStorage.setItem('civitai-api-search-sidebar-visible', visible ? '1' : '0'); } catch {}
    };
    let visible = true;
    try { visible = localStorage.getItem('civitai-api-search-sidebar-visible') !== '0'; } catch {}
    setVisible(visible);
    doc.getElementById('api-collapse-sidebar')?.addEventListener('click', () => setVisible(false));
    doc.getElementById('api-expand-sidebar')?.addEventListener('click', () => setVisible(true));
  }

  function inferUrlKind(url) {
    const value = String(url || '').toLowerCase();
    if (/\.(mp4|webm|mov|m4v)(?:[?#].*)?$/.test(value)) return 'video';
    if (/\.(png|jpe?g|webp|gif|avif)(?:[?#].*)?$/.test(value)) return 'image';
    if (/\/original(?:[?#].*)?$/.test(value) || /civitai-media-cache/.test(value)) return 'unknown';
    return 'image';
  }

  function addVideoBadge(doc, wrap) {
    wrap.classList.add('api-has-video');
    if (wrap.querySelector('.api-video-badge')) return;
    const badge = doc.createElement('span');
    badge.className = 'api-video-badge';
    badge.textContent = '▶ VIDEO';
    wrap.appendChild(badge);
  }

  function replaceImageWithVideo(doc, img) {
    if (!img?.isConnected || img.dataset.apiVideoConverted === '1') return;
    const wrap = img.closest('.thumb-wrap');
    if (!wrap) return;
    const video = doc.createElement('video');
    video.className = img.className || 'thumb';
    video.src = img.currentSrc || img.src;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.dataset.apiVideoConverted = '1';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.addEventListener('error', () => {
      if (!video.isConnected) return;
      const ph = doc.createElement('div');
      ph.className = 'placeholder';
      ph.textContent = 'メディア読込失敗';
      video.replaceWith(ph);
    }, { once: true });
    img.replaceWith(video);
    addVideoBadge(doc, wrap);
  }

  function enhanceThumbnailImage(doc, img) {
    if (!(img instanceof doc.defaultView.HTMLImageElement) || !img.classList.contains('thumb')) return;
    if (img.dataset.apiMediaEnhanced === '1') return;
    img.dataset.apiMediaEnhanced = '1';
    const kind = inferUrlKind(img.currentSrc || img.src);
    if (kind === 'video') {
      replaceImageWithVideo(doc, img);
      return;
    }
    if (kind === 'unknown') {
      img.addEventListener('error', () => replaceImageWithVideo(doc, img), { once: true });
      if (img.complete && img.naturalWidth === 0) replaceImageWithVideo(doc, img);
    }
  }

  function installVideoSupport(doc) {
    if (doc.documentElement.dataset.apiVideoSupport === '1') return;
    doc.documentElement.dataset.apiVideoSupport = '1';
    doc.querySelectorAll('.thumb-wrap img.thumb').forEach((img) => enhanceThumbnailImage(doc, img));
    const observer = new doc.defaultView.MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof doc.defaultView.Element)) continue;
          if (node.matches?.('.thumb-wrap img.thumb')) enhanceThumbnailImage(doc, node);
          node.querySelectorAll?.('.thumb-wrap img.thumb').forEach((img) => enhanceThumbnailImage(doc, img));
        }
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });

    doc.addEventListener('mouseover', (event) => {
      const wrap = event.target?.closest?.('.thumb-wrap');
      if (!wrap) return;
      const video = wrap.querySelector('video.thumb');
      if (video) video.play().catch(() => {});
    });
    doc.addEventListener('mouseout', (event) => {
      const wrap = event.target?.closest?.('.thumb-wrap');
      if (!wrap || wrap.contains(event.relatedTarget)) return;
      const video = wrap.querySelector('video.thumb');
      if (!video) return;
      video.pause();
      try { video.currentTime = 0; } catch {}
    });
  }

  function enhanceFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      injectRuntimeCss(doc);
      applySplitLayout(doc);
      installVideoSupport(doc);
    } catch (error) {
      console.error('[Civitai API検索] iframe enhancement failed', error);
    }
  }

  function createOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;background:rgba(5,7,11,.88);backdrop-filter:blur(5px);padding:14px;box-sizing:border-box';
    overlay.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#0d0f14;border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)">
        <div id="${OVERLAY_ID}-status" style="position:absolute;inset:0;display:grid;place-items:center;color:#dce5f5;font:600 14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#0d0f14;z-index:1;padding:30px;text-align:center">API検索画面を読み込んでいます…</div>
        <iframe id="${OVERLAY_ID}-frame" title="Civitai API検索" style="width:100%;height:100%;border:0;display:block;background:#0d0f14"></iframe>
        <button id="${OVERLAY_ID}-close" type="button" title="閉じる (Esc)" style="position:absolute;top:12px;right:14px;z-index:5;width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(15,18,25,.88);color:#fff;font:700 24px/1 system-ui;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.35)">×</button>
      </div>`;
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
      enhanceFrame(frame);
      return;
    }

    status.style.display = 'grid';
    status.textContent = 'API検索画面を読み込んでいます…';
    try {
      const html = await getHtml();
      frame.addEventListener('load', () => {
        status.style.display = 'none';
        enhanceFrame(frame);
      }, { once: true });
      frame.srcdoc = html;
      frame.dataset.loaded = '1';
    } catch (error) {
      console.error('[Civitai API検索]', error);
      status.textContent = `API検索画面を読み込めませんでした: ${error?.message || String(error)}`;
    }
  }

  function ensureLauncher() {
    if (document.getElementById(APP_ID) || !document.body) return;
    const button = document.createElement('button');
    button.id = APP_ID;
    button.type = 'button';
    button.textContent = 'API検索';
    button.title = 'Civitai API検索を開く';
    button.style.cssText = 'position:fixed;right:18px;bottom:78px;z-index:2147483646;height:42px;padding:0 15px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:linear-gradient(135deg,#5d8cff,#7a67ff);color:#fff;font:800 13px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35)';
    button.addEventListener('click', openOverlay);
    document.body.appendChild(button);
  }

  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlay(); });
  ensureLauncher();
  const observer = new MutationObserver(() => { if (!document.getElementById(APP_ID)) ensureLauncher(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
