// 노션 본문 → 웹 블록 (W1 규칙)
// 영문 전체 → 구분선 → 국문 전체를 나누고, 제목 순서로 섹션을, 섹션 안에서 문단을 순서대로 짝지어 {t, en, ko} 목록으로.
// 미디어는 영문 쪽에서만 (국문 쪽에 다시 올린 같은 이미지는 버림).

import { plain, hangulRatio, blockImage, blockFile } from './notion-utils.js';

const TEXT = { paragraph: 'p', heading_1: 'h', heading_2: 'h', heading_3: 'h', bulleted_list_item: 'ul', numbered_list_item: 'ol', quote: 'quote', callout: 'callout' };
const MEDIA = new Set(['image', 'video', 'embed', 'audio']);
const plain2 = (rt) => (rt || []).map((r) => r.x).join('').trim();
const isText = (n) => ['p', 'h', 'ul', 'ol', 'quote', 'callout'].includes(n.t);

/** 노션 rich_text → 작은 JSON (색·밑줄·취소선은 버림) */
const rich = (rt) => (rt || []).map((r) => {
  const o = { x: r.plain_text };
  if (r.annotations?.bold) o.b = 1;
  if (r.annotations?.italic) o.i = 1;
  if (r.annotations?.code) o.c = 1;
  if (r.href) o.h = r.href;
  return o;
});

/** 캡션: 1줄 영문, Shift+Enter, 2줄 국문. 한 줄뿐이면 그 언어만 */
export function splitCaption(rt) {
  const lines = plain(rt).split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) return { en: lines[0], ko: lines.slice(1).join(' ') };
  if (!lines.length) return null;
  return hangulRatio(lines[0]) > 0.5 ? { en: null, ko: lines[0] } : { en: lines[0], ko: null };
}

const embedUrl = (url) => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
};

const deepText = (nodes) => (nodes || []).map((n) => (n.rt ? n.rt.map((r) => r.x).join('') : '') + deepText(n.kids || n.en || []) + deepText(n.cols?.flat() || [])).join(' ');

/** 노션 블록 하나 → 노드 (배열: 토글·동기화 블록은 안쪽 내용을 펼침) */
// '웹에 안 나옴'으로 시작하는 블록(체크리스트·토글·문단 등 어떤 모양이든)은 안쪽 내용까지 통째로 웹에서 숨김.
// 작가가 국문 쪽에 중복으로 올려 둔 사진 등을 여기에 넣어 둠
const HIDDEN = /^\s*(웹에\s*안\s*나옴|not on (the )?web)/i;

function simplify(b) {
  const v = b[b.type] || {};
  if (HIDDEN.test(plain(v.rich_text))) return [];
  const kids = () => (b.children || []).flatMap(simplify);
  if (TEXT[b.type]) {
    const rt = rich(v.rich_text);
    const node = { t: TEXT[b.type], rt };
    if (node.t === 'h') node.lvl = Number(b.type.slice(-1));
    const k = kids();
    if (k.length) node.kids = k;
    if (!rt.length && !k.length) return []; // 빈 줄
    return [node];
  }
  switch (b.type) {
    case 'toggle':
    case 'synced_block':
    case 'column':
      return kids();
    case 'divider':
      return [{ t: 'divider' }];
    case 'code':
      return [{ t: 'code', rt: rich(v.rich_text) }];
    case 'image': {
      const img = blockImage(v);
      return img ? [{ t: 'image', ...img, cap: splitCaption(v.caption) }] : [];
    }
    case 'video': {
      const f = blockFile(v);
      if (!f) return [];
      const embed = f.external && embedUrl(f.src);
      if (embed) return [{ t: 'embed', src: embed, cap: splitCaption(v.caption) }];
      return [{ t: 'video', src: f.src, cap: splitCaption(v.caption) }];
    }
    case 'audio': {
      const f = blockFile(v);
      return f ? [{ t: 'audio', src: f.src, name: f.name, cap: splitCaption(v.caption) }] : [];
    }
    case 'file':
    case 'pdf': {
      const f = blockFile(v);
      return f ? [{ t: 'file', src: f.src, name: v.name || f.name, cap: splitCaption(v.caption) }] : [];
    }
    case 'bookmark':
    case 'embed':
    case 'link_preview': {
      const embed = v.url && embedUrl(v.url);
      if (embed) return [{ t: 'embed', src: embed, cap: splitCaption(v.caption) }];
      return v.url ? [{ t: 'bookmark', url: v.url, cap: splitCaption(v.caption) }] : [];
    }
    case 'table': {
      const rows = (b.children || []).filter((r) => r.type === 'table_row').map((r) => r.table_row.cells.map(rich));
      return rows.length ? [{ t: 'table', rows: v.has_column_header ? rows.slice(1) : rows }] : [];
    }
    case 'column_list': {
      const cols = b.children || [];
      return columnList(cols.map((c) => (c.children || []).flatMap(simplify)), cols.map((c) => c.column?.width_ratio ?? null));
    }
    default:
      return []; // 하위 페이지, DB 보기, 목차, 할 일, 수식 …
  }
}

/** 열 블록: [글 | 이미지] = 본문 + 갤러리, [EN | KR] 글 두 열 = 짝, 나머지는 열 그대로 */
function columnList(cols, ratios = []) {
  const keep = cols.map((c) => c.length > 0);
  ratios = ratios.filter((_, i) => keep[i]);
  cols = cols.filter((c) => c.length);
  const kind = (c) => (c.every((n) => MEDIA.has(n.t)) ? 'media' : c.some((n) => MEDIA.has(n.t)) ? 'mixed' : 'text');
  const kinds = cols.map(kind);
  if (kinds.includes('text') && kinds.includes('media') && !kinds.includes('mixed')) {
    const text = cols.filter((_, i) => kinds[i] === 'text').flat();
    const media = cols.filter((_, i) => kinds[i] === 'media').flat();
    return [...text, { t: 'gallery', items: media }];
  }
  if (cols.length === 2 && kinds.every((k) => k === 'text') && hangulRatio(deepText(cols[0])) < 0.3 && hangulRatio(deepText(cols[1])) > 0.5) {
    return [{ t: 'pairs', en: cols[0], ko: cols[1] }];
  }
  if (cols.length === 1) return cols[0];
  // 이미지만 있는 여러 열 = 노션 열 배치 그대로 (열 수·열 안 위→아래 순서·열 너비 비율)
  if (kinds.every((k) => k === 'media')) return [{ t: 'imgcols', cols, ratios }];
  return cols.length ? [{ t: 'columns', cols }] : [];
}

// ---------- 짝짓기 ----------

function pairItems(en, ko) {
  const out = [];
  const koText = ko.filter(isText);
  let ki = 0;
  const push = (e, k) => {
    const same = e && k && plain2(e.rt) === plain2(k.rt); // 국문 쪽에 영문 그대로 쓴 제목은 한 번만
    const n = { t: (e || k).t, en: e?.rt || null, ko: same ? null : k?.rt || null };
    const lvl = (e || k).lvl;
    if (lvl) n.lvl = lvl;
    if (e?.kids || k?.kids) n.kids = pairItems(e?.kids || [], k?.kids || []);
    out.push(n);
  };
  for (const n of en) {
    if (n.t === 'pairs') out.push(...pairItems(n.en, n.ko));
    else if (isText(n)) push(n, koText[ki++]);
    else out.push(n);
  }
  while (ki < koText.length) push(null, koText[ki++]);
  if (!en.length) out.push(...ko.filter((n) => !isText(n) && n.t !== 'pairs'));
  // 국문 쪽에만 있는 2열 짝 블록
  for (const n of ko) if (n.t === 'pairs') out.push(...pairItems(n.en, n.ko));
  return out;
}

/** 소제목에서 끊어 조각끼리 짝짓기 (한쪽에만 있는 문단이 뒤 소제목을 밀어내지 않게) */
function pairChunks(en, ko) {
  const chunk = (arr) => arr.reduce((acc, n) => {
    if (n.t === 'h' && acc[acc.length - 1].length) acc.push([]);
    acc[acc.length - 1].push(n);
    return acc;
  }, [[]]);
  const e = chunk(en);
  const k = chunk(ko);
  const media = en.some((n) => !isText(n));
  const out = [];
  for (let i = 0; i < Math.max(e.length, k.length); i++) {
    // 미디어는 영문 쪽만. 영문 쪽에 미디어가 하나도 없을 때만 국문 쪽 미디어를 씀
    out.push(...pairItems(e[i] || [], (k[i] || []).filter((n) => isText(n) || n.t === 'pairs' || !media)));
  }
  return out;
}

function sectionLevel(nodes) {
  const counts = {};
  for (const n of nodes) if (n.t === 'h') counts[n.lvl] = (counts[n.lvl] || 0) + 1;
  const levels = Object.keys(counts).map(Number).sort();
  return levels.find((l) => counts[l] >= 2) || levels[0] || null;
}

function sections(nodes, level) {
  const out = [{ head: null, items: [] }];
  nodes.forEach((n, i) => {
    if (n.t === 'h' && level && n.lvl <= level) {
      // 맨 앞의 더 큰 제목 하나는 페이지 제목과 겹치므로 생략
      if (n.lvl < level && !nodes.slice(0, i).some(isText)) return;
      out.push({ head: n, items: [] });
    } else out[out.length - 1].items.push(n);
  });
  return out;
}

/**
 * 블록 트리 → { sections: [{ head: {en, ko} | null, items }], level, lang }
 * lang: 'both' | 'en' | 'ko' (구분선이 없으면 한 언어)
 */
export function parseBody(tree) {
  const nodes = (tree || []).flatMap(simplify);
  const ratio = (arr) => hangulRatio(deepText(arr));
  let en = nodes;
  let ko = [];
  let lang = null;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].t !== 'divider') continue;
    const before = nodes.slice(0, i);
    const after = nodes.slice(i + 1);
    if (ratio(before) < 0.5 && ratio(after) >= 0.5 && deepText(after).trim()) {
      en = before;
      ko = after;
      lang = 'both';
      break;
    }
  }
  if (!lang) {
    const hasPairs = nodes.some((n) => n.t === 'pairs');
    lang = hasPairs ? 'both' : ratio(nodes) > 0.5 ? 'ko' : 'en';
    if (lang === 'ko') [en, ko] = [[], nodes];
  }
  const trim = (arr) => {
    while (arr[0]?.t === 'divider') arr = arr.slice(1);
    while (arr[arr.length - 1]?.t === 'divider') arr = arr.slice(0, -1);
    return arr;
  };
  en = trim(en);
  ko = trim(ko);
  const level = sectionLevel(en.length ? en : ko);
  const enS = sections(en, level);
  const koS = sections(ko, level);
  const out = [];
  for (let i = 0; i < Math.max(enS.length, koS.length); i++) {
    const e = enS[i];
    const k = koS[i];
    const same = e?.head && k?.head && plain2(e.head.rt) === plain2(k.head.rt);
    const head = e?.head || k?.head ? { en: e?.head?.rt || null, ko: same ? null : k?.head?.rt || null } : null;
    const items = pairChunks(e?.items || [], k?.items || []);
    if (items.length) out.push({ head, items });
  }
  return { sections: out, level, lang };
}

// ---------- 페이지가 쓰는 도우미 ----------

export const rtText = (rt) => (rt || []).map((r) => r.x).join('');

export function firstParagraph(body) {
  for (const s of body?.sections || []) {
    const p = s.items.find((n) => n.t === 'p' && (n.en || n.ko));
    if (p) return { en: rtText(p.en) || null, ko: rtText(p.ko) || null };
  }
  return null;
}

export function firstImage(body) {
  for (const s of body?.sections || []) {
    for (const n of s.items) {
      if (n.t === 'image') return n.src;
      const g = n.t === 'gallery' && n.items.find((m) => m.t === 'image');
      if (g) return g.src;
      const c = n.t === 'imgcols' && n.cols.flat().find((m) => m.t === 'image');
      if (c) return c.src;
    }
  }
  return null;
}

/** 본문 안의 첫 바깥 링크 (RELATED 링크 글은 URL을 본문에 적어 둠) */
export function firstLink(tree) {
  for (const b of tree || []) {
    const v = b[b.type] || {};
    if (b.type === 'bookmark' || b.type === 'embed' || b.type === 'link_preview') return { url: v.url };
    if (b.type === 'pdf' || b.type === 'file') {
      const f = blockFile(v);
      if (f) return { url: f.src, file: true };
    }
    for (const r of v.rich_text || []) {
      if (r.href) return { url: r.href };
      const m = r.plain_text.match(/https?:\/\/\S+/);
      if (m) return { url: m[0] };
    }
    const deep = firstLink(b.children);
    if (deep) return deep;
  }
  return null;
}
