// ==UserScript==
// @name         Civitai Prompt Auto Sort Copy
// @namespace    https://civitai.com/
// @version      1.0.0
// @description  Civitaiでプロンプトをコピーすると、指定カテゴリ順に自動整列してコピーします。
// @homepageURL  https://github.com/j13351th-coder/civitai_api_search
// @supportURL   https://github.com/j13351th-coder/civitai_api_search/issues
// @updateURL    https://raw.githubusercontent.com/j13351th-coder/civitai_api_search/main/civitai_prompt_sorter.user.js
// @downloadURL  https://raw.githubusercontent.com/j13351th-coder/civitai_api_search/main/civitai_prompt_sorter.user.js
// @match        https://civitai.com/*
// @match        https://civitai.red/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';

  const ORDER = ['quality','count','series','artist','hair','face','body','top','bottom','shoes','accessory','background','camera','expression','pose','action','other'];
  const FORCE_OTHER = new Set(['mature female','medium build','female focus','feet','toes','groin']);
  const FORCE_ARTIST = new Set(['@hspani']);
  const FORCE_EXPRESSION = new Set(['looking down at viewer']);
  const SERIES_TAGS = new Set([]); // 必要なら追加
  const ARTIST_TAGS = new Set([]); // 必要なら追加

  const RX = {
    quality: /^(masterpiece|best quality|high quality|great quality|good quality|normal quality|low quality|worst quality|amazing quality|very aesthetic|aesthetic|ultra detailed|highly detailed|absurdres|highres|official art|key visual|safe|sensitive|questionable|explicit|newest|recent|mid|old|early|late|meta|commentary request|translation request|score_\d+(?:_up)?|source_[a-z0-9_ -]+|rating[: _-]?(?:safe|general|sensitive|questionable|explicit)|19\d{2}s?|20\d{2}s?|\d{4}|year\s*\d{4}|circa\s*\d{4})$/,
    count: /^(?:\d+(?:girl|boy|other|woman|man|female|male)s?|multiple girls|multiple boys|multiple others)$/,
    hair: /\b(?:hair|bangs|fringe|ahoge|sidelocks|ponytail|twintails?|twin braids?|braid(?:ed|s)?|bun|hime cut|bob cut|short hair|long hair|medium hair|very long hair|curly hair|wavy hair|straight hair|messy hair|hair over one eye|hair between eyes|hair intakes?)\b/,
    face: /\b(?:eyes?|eyelashes?|eyebrows?|eyelids?|heterochromia|pupils?|iris|sclera|mouth|lips?|teeth|fangs?|tongue|nose|ears?|cheeks?|face)\b/,
    body: /\b(?:breasts?|chest|cleavage|waist|hips?|thighs?|legs?|arms?|hands?|fingers?|navel|stomach|belly|back|shoulders?|muscular|slim|skinny|petite|tall|short stature|wide hips|thick thighs|body hair|freckles|mole|tan|dark skin|pale skin|skin tone)\b/,
    top: /\b(?:shirt|t-?shirt|blouse|sweater|hoodie|jacket|coat|cardigan|vest|jersey|top|tank top|crop top|halter top|bra|bikini top|sports bra|camisole|kimono top|sailor collar|off-shoulder|turtleneck|long sleeves?|short sleeves?|sleeveless)\b/,
    bottom: /\b(?:skirt|shorts?|pants?|trousers?|jeans|leggings|tights|pantyhose|stockings|panties|underwear|bikini bottom|loincloth|hakama|miniskirt|pleated skirt)\b/,
    shoes: /\b(?:shoes?|boots?|sandals?|sneakers?|loafers?|heels?|high heels?|pumps?|slippers?|footwear)\b/,
    accessory: /\b(?:hat|cap|beret|hood|headwear|headband|hairband|hair ribbon|hair ornament|hairclip|hair bow|ribbon|bow|necktie|bowtie|scarf|belt|gloves?|mittens?|bracelet|necklace|choker|earrings?|piercing|ring|jewelry|glasses|goggles|mask|watch|bag|backpack|uniform|dress|gown|swimsuit|bikini|leotard|bodysuit|apron|costume|outfit)\b/,
    background: /\b(?:background|indoors?|outdoors?|room|bedroom|living room|kitchen|bathroom|classroom|school|street|city|building|house|shop|cafe|restaurant|bar|park|beach|pool|forest|mountain|sky|clouds?|night|day|sunset|sunrise|rain|snow|window|door|bed|sofa|chair|table|castle|temple|shrine)\b/,
    camera: /\b(?:from above|from below|from behind|from side|from front|high angle|low angle|dutch angle|side view|back view|front view|profile|close-?up|extreme close-?up|portrait|upper body|lower body|full body|cowboy shot|wide shot|medium shot|depth of field|foreshortening|fisheye|first-person view|pov)\b/,
    expression: /\b(?:looking at viewer|looking away|looking back|looking up|looking down|sideways glance|eye contact|closed eyes|one eye closed|wink|smile|grin|smirk|frown|angry|sad|crying|tears|blush|embarrassed|surprised|scared|serious|expressionless|open mouth|closed mouth|tongue out)\b/,
    pose: /\b(?:standing|sitting|kneeling|squatting|lying|on back|on side|on stomach|crossed legs|legs crossed|arms crossed|arms up|one arm up|hands on hips|hand on hip|hands behind back|spread legs|legs together|contrapposto|posing|pose)\b/,
    action: /\b(?:walking|running|jumping|dancing|swimming|holding|carrying|grabbing|reaching|pointing|eating|drinking|cooking|reading|writing|sleeping|shouting|talking|playing|fighting|hugging|kissing|waving|clapping|climbing)\b/
  };

  function splitPrompt(input) {
    const out=[]; let cur='', p=0,b=0,c=0,q='',esc=false;
    for (const ch of String(input ?? '')) {
      if (esc) { cur+=ch; esc=false; continue; }
      if (ch==='\\') { cur+=ch; esc=true; continue; }
      if (q) { cur+=ch; if (ch===q) q=''; continue; }
      if (ch==='"'||ch==="'") { cur+=ch; q=ch; continue; }
      if (ch==='(') p++; else if (ch===')'&&p) p--;
      else if (ch==='[') b++; else if (ch===']'&&b) b--;
      else if (ch==='{') c++; else if (ch==='}'&&c) c--;
      if (ch===','&&!p&&!b&&!c) { if (cur.trim()) out.push(cur.trim()); cur=''; } else cur+=ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function normalizeToken(token) {
    let s=String(token??'').trim().replace(/\\([()\[\]{}])/g,'$1');
    let changed=true;
    while (changed&&s.length>1) {
      changed=false;
      for (const [a,z] of [['(',')'],['[',']'],['{','}']]) if (s.startsWith(a)&&s.endsWith(z)) { s=s.slice(1,-1).trim(); changed=true; break; }
    }
    return s.replace(/\s*:\s*-?\d+(?:\.\d+)?\s*$/,'').toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
  }

  function classify(token) {
    const n=normalizeToken(token);
    if (!n||FORCE_OTHER.has(n)) return 'other';
    if (FORCE_ARTIST.has(n)||ARTIST_TAGS.has(n)||/^artist\s*[:：]/.test(n)) return 'artist';
    if (FORCE_EXPRESSION.has(n)) return 'expression';
    if (SERIES_TAGS.has(n)||/^(series|copyright)\s*[:：]/.test(n)) return 'series';
    for (const key of ORDER) if (RX[key]?.test(n)) return key;
    return 'other';
  }

  function looksLikePrompt(text) {
    const t=splitPrompt(text); if (t.length<3) return false;
    let recognized=0; for (const x of t.slice(0,30)) if (classify(x)!=='other') recognized++;
    return recognized>=1||t.length>=6;
  }

  function sortPrompt(text) {
    const buckets=Object.fromEntries(ORDER.map(k=>[k,[]]));
    for (const token of splitPrompt(text)) buckets[classify(token)].push(token.trim());
    return ORDER.map(k=>buckets[k].filter(Boolean).join(', ')).filter(Boolean).join('\n');
  }

  const transform=(text)=>looksLikePrompt(text)?sortPrompt(text):String(text??'');

  // Civitaiの「コピー」ボタンなどが Clipboard.writeText() を使う場合を自動変換。
  try {
    const proto=globalThis.Clipboard?.prototype;
    if (proto?.writeText&&!proto.writeText.__cpsPatched) {
      const original=proto.writeText;
      const patched=function(text){ return original.call(this,transform(text)); };
      patched.__cpsPatched=true; proto.writeText=patched;
    }
  } catch (e) { console.warn('[Civitai Prompt Sorter] clipboard patch failed',e); }

  // Ctrl+C / 選択コピーにも対応。
  document.addEventListener('copy',(event)=>{
    try {
      const selected=String(document.getSelection?.()||'');
      if (!looksLikePrompt(selected)) return;
      event.preventDefault(); event.clipboardData?.setData('text/plain',sortPrompt(selected));
    } catch (e) { console.warn('[Civitai Prompt Sorter] copy transform failed',e); }
  },true);

  globalThis.civitaiPromptSorter=Object.freeze({sortPrompt,classify,normalizeToken,splitPrompt});
})();
