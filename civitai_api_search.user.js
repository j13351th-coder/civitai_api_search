// ==UserScript==
// @name         Civitai API検索
// @namespace    https://civitai.com/
// @version      1.0.0
// @description  Civitai上からGitHub版のCivitai API検索画面を直接開きます。
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
          if (res.status >= 200 && res.status < 300) {
            resolve(res.responseText || '');
          } else {
            reject(new Error(`GitHub HTML取得失敗: HTTP ${res.status}`));
          }
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
        .finally(() => {
          loadingPromise = null;
        });
    }
    return loadingPromise;
  }

  function createOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483647',
      'display:none',
      'background:rgba(5,7,11,.88)',
      'backdrop-filter:blur(5px)',
      'padding:14px',
      'box-sizing:border-box'
    ].join(';');

    overlay.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#0d0f14;border:1px solid rgba(255,255,255,.14);border-radius:14px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.55)">
        <div id="${OVERLAY_ID}-status" style="position:absolute;inset:0;display:grid;place-items:center;color:#dce5f5;font:600 14px/1.6 system-ui,-apple-system,Segoe UI,sans-serif;background:#0d0f14;z-index:1;padding:30px;text-align:center">
          API検索画面を読み込んでいます…
        </div>
        <iframe id="${OVERLAY_ID}-frame" title="Civitai API検索" style="width:100%;height:100%;border:0;display:block;background:#0d0f14"></iframe>
        <button id="${OVERLAY_ID}-close" type="button" title="閉じる (Esc)" aria-label="API検索を閉じる" style="position:absolute;top:12px;right:14px;z-index:5;width:42px;height:42px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(15,18,25,.88);color:#fff;font:700 24px/1 system-ui;cursor:pointer;box-shadow:0 5px 18px rgba(0,0,0,.35)">×</button>
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
      return;
    }

    status.style.display = 'grid';
    status.textContent = 'API検索画面を読み込んでいます…';

    try {
      const html = await getHtml();
      frame.srcdoc = html;
      frame.dataset.loaded = '1';
      frame.addEventListener('load', () => {
        status.style.display = 'none';
      }, { once: true });
    } catch (error) {
      console.error('[Civitai API検索]', error);
      status.innerHTML = `
        <div>
          <div style="font-size:18px;font-weight:800;margin-bottom:8px">API検索画面を読み込めませんでした</div>
          <div style="color:#ffb8b8">${escapeHtml(error?.message || String(error))}</div>
          <button id="${OVERLAY_ID}-retry" type="button" style="margin-top:16px;height:38px;padding:0 14px;border:0;border-radius:9px;background:#5865f2;color:white;font-weight:800;cursor:pointer">再試行</button>
        </div>`;
      status.querySelector(`#${OVERLAY_ID}-retry`)?.addEventListener('click', () => {
        loadedHtml = null;
        openOverlay();
      }, { once: true });
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function ensureLauncher() {
    if (document.getElementById(APP_ID) || !document.body) return;

    const button = document.createElement('button');
    button.id = APP_ID;
    button.type = 'button';
    button.textContent = 'API検索';
    button.title = 'Civitai API検索を開く';
    button.style.cssText = [
      'position:fixed',
      'right:18px',
      'bottom:78px',
      'z-index:2147483646',
      'height:42px',
      'padding:0 15px',
      'border:1px solid rgba(255,255,255,.16)',
      'border-radius:999px',
      'background:linear-gradient(135deg,#5d8cff,#7a67ff)',
      'color:#fff',
      'font:800 13px/1 system-ui,-apple-system,Segoe UI,sans-serif',
      'letter-spacing:.02em',
      'cursor:pointer',
      'box-shadow:0 6px 20px rgba(0,0,0,.35)'
    ].join(';');

    button.addEventListener('click', openOverlay);
    document.body.appendChild(button);
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOverlay();
  });

  ensureLauncher();

  // CivitaiはSPAのため、ページ遷移でボタンが消えた場合だけ復元する。
  const observer = new MutationObserver(() => {
    if (!document.getElementById(APP_ID)) ensureLauncher();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
