// ==UserScript==
// @name         Civitai Prompt Auto Sort Copy
// @namespace    https://civitai.com/
// @version      1.2.0
// @description  Civitaiでポジティブプロンプトを指定カテゴリ順に自動整列。ネガティブプロンプトはそのままコピーします。
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
  const SERIES_TAGS = new Set([]);
  const ARTIST_TAGS = new Set([]);

  const RX = {
    quality: /^(?:masterpiece|best quality|high quality|great quality|good quality|normal quality|low quality|worst quality|amazing quality|very aesthetic|aesthetic|ultra[- ]detailed|highly detailed|high detailed|detailed|intricate details|absurdres|incredibly absurdres|highres|official art|key visual|illustration|highly detailed illustration|artstation style|perfect composition|elegant|sharp focus|realistic|photo|detailed face and eyes|detailed skin|safe|sensitive|questionable|explicit|newest|recent|mid|old|early|late|meta|commentary request|translation request|score[ _]\d+(?:[ _]up)?|source[ _][a-z0-9_ -]+|rating[: _-]?(?:safe|general|sensitive|questionable|explicit)|19\d{2}s?|20\d{2}s?|\d{4}|year\s*\d{4}|circa\s*\d{4})$/,
    count: /^(?:solo|\d+(?:girl|boy|other|woman|man|female|male)s?|multiple girls|multiple boys|multiple others)$/,
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

  let lastInteractionTarget = null;
  let lastInteractionAt = 0;

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

  function unwrapToken(token) {
    let s=String(token??'').trim().replace(/\\([()\[\]{}])/g,'$1');
    let changed=true;
    while (changed&&s.length>1) {
      changed=false;
      for (const [a,z] of [['(',')'],['[',']'],['{','}']]) {
        if (s.startsWith(a)&&s.endsWith(z)) { s=s.slice(1,-1).trim(); changed=true; break; }
      }
    }
    return s;
  }

  function normalizeToken(token) {
    return unwrapToken(token)
      .replace(/\s*:\s*-?\d+(?:\.\d+)?\s*$/,'')
      .toLowerCase()
      .replace(/_/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function isLoraTag(token) {
    return unwrapToken(token).toLowerCase().startsWith('<lora:');
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
    const t=splitPrompt(text).filter(x=>!isLoraTag(x));
    if (t.length<3) return false;
    let recognized=0;
    for (const x of t.slice(0,30)) if (classify(x)!=='other') recognized++;
    return recognized>=1||t.length>=6;
  }

  function formatLine(tokens) {
    const items=tokens.filter(Boolean);
    return items.length ? `${items.join(', ')}, ` : '';
  }

  function sortPrompt(text) {
    const buckets=Object.fromEntries(ORDER.map(k=>[k,[]]));
    for (const token of splitPrompt(text)) {
      if (isLoraTag(token)) continue;
      const clean=token.trim();
      if (clean) buckets[classify(clean)].push(clean);
    }

    const line=(...keys)=>formatLine(keys.flatMap(k=>buckets[k]));
    const sections=[
      [line('quality')],
      [line('count')],
      [line('series','artist')],
      [line('hair','face','body'),line('top'),line('bottom'),line('shoes','accessory')],
      [line('background')],
      [line('camera')],
      [line('expression','pose','action')],
      [line('other')]
    ];

    return sections
      .map(lines=>lines.filter(Boolean))
      .filter(lines=>lines.length)
      .map(lines=>lines.join('\n'))
      .join('\n\n');
  }

  function nodeText(node) {
    if (!node) return '';
    const parts=[];
    try {
      if (node.getAttribute) {
        parts.push(node.getAttribute('aria-label')||'');
        parts.push(node.getAttribute('title')||'');
        parts.push(node.getAttribute('data-label')||'');
      }
      parts.push(node.textContent||'');
    } catch {}
    return parts.join(' ').replace(/\s+/g,' ').trim();
  }

  function isNegativeContext(node) {
    const rx=/\bnegative\s*prompt\b|ネガティブ\s*プロンプト/i;
    let cur=node?.nodeType===1?node:node?.parentElement;
    for (let depth=0;cur&&depth<8;depth++,cur=cur.parentElement) {
      const t=nodeText(cur);
      if (t.length<=2500&&rx.test(t)) return true;
    }
    return false;
  }

  function selectionIsNegative() {
    try {
      const sel=document.getSelection?.();
      if (!sel||!sel.rangeCount) return false;
      return isNegativeContext(sel.getRangeAt(0).commonAncestorContainer);
    } catch { return false; }
  }

  function recentCopyIsNegative() {
    return Date.now()-lastInteractionAt<3000&&isNegativeContext(lastInteractionTarget);
  }

  function transform(text) {
    const raw=String(text??'');
    if (/^\s*negative\s*prompt\s*[:：]/i.test(raw)) return raw;
    if (recentCopyIsNegative()) return raw;
    return looksLikePrompt(raw)?sortPrompt(raw):raw;
  }

  document.addEventListener('pointerdown',(event)=>{
    lastInteractionTarget=event.target;
    lastInteractionAt=Date.now();
  },true);
  document.addEventListener('click',(event)=>{
    lastInteractionTarget=event.target;
    lastInteractionAt=Date.now();
  },true);

  try {
    const proto=globalThis.Clipboard?.prototype;
    if (proto?.writeText&&!proto.writeText.__cpsPatched) {
      const original=proto.writeText;
      const patched=function(text){ return original.call(this,transform(text)); };
      patched.__cpsPatched=true;
      proto.writeText=patched;
    }
  } catch (e) { console.warn('[Civitai Prompt Sorter] clipboard patch failed',e); }

  document.addEventListener('copy',(event)=>{
    try {
      const selected=String(document.getSelection?.()||'');
      if (!selected||selectionIsNegative()||!looksLikePrompt(selected)) return;
      event.preventDefault();
      event.clipboardData?.setData('text/plain',sortPrompt(selected));
    } catch (e) { console.warn('[Civitai Prompt Sorter] copy transform failed',e); }
  },true);

  globalThis.civitaiPromptSorter=Object.freeze({sortPrompt,classify,normalizeToken,splitPrompt,isLoraTag});
})();
