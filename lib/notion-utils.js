// Notion 속성 읽기 + 미디어 주소를 R2로 바꾸기

import { r2KeyFromUrl, blockImageFilename } from './r2-key.js';

export const plain = (rt) => (rt || []).map((t) => t.plain_text).join('');

/** title / rich_text / select / number / url / date 를 글자로 */
export function text(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title':
    case 'rich_text':
      return plain(prop[prop.type]).trim();
    case 'select':
      return prop.select?.name || '';
    case 'number':
      return prop.number == null ? '' : String(prop.number);
    case 'url':
      return prop.url || '';
    case 'date':
      return prop.date ? [prop.date.start, prop.date.end].filter(Boolean).join(' - ') : '';
    default:
      return '';
  }
}

export const num = (prop) => (prop?.type === 'number' ? prop.number : (Number.isFinite(parseFloat(text(prop))) ? parseFloat(text(prop)) : null));
export const checked = (prop) => prop?.type === 'checkbox' && prop.checkbox;
export const relation = (prop) => (prop?.type === 'relation' ? prop.relation.map((r) => r.id) : []);
export const titleOf = (page) => plain(Object.values(page.properties || {}).find((p) => p.type === 'title')?.title).trim();

/** 대소문자·띄어쓰기가 조금 달라도 속성을 찾음 ('post' / 'Post') */
export function prop(page, ...names) {
  const props = page.properties || {};
  for (const n of names) if (props[n]) return props[n];
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase().replace(/\s+/g, ''), v]));
  for (const n of names) {
    const v = lower[n.toLowerCase().replace(/\s+/g, '')];
    if (v) return v;
  }
  return null;
}

export const hangulRatio = (s) => {
  const letters = (s || '').match(/[A-Za-z가-힣]/g) || [];
  if (!letters.length) return 0;
  return letters.filter((c) => c >= '가').length / letters.length;
};

// ---------- R2 ----------

export function r2Url(key) {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) throw new Error('R2_PUBLIC_URL 환경 변수가 설정되지 않았습니다.');
  return `${base.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

// R2에 실제로 있는 키 목록 (scripts/sync-images-to-r2.js가 manifest.json으로 기록)
let manifest = null;
let manifestAt = 0;

export async function refreshR2Manifest() {
  const base = process.env.R2_PUBLIC_URL;
  if (!base || Date.now() - manifestAt < 60 * 1000) return;
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/manifest.json`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (res.ok) manifest = new Set((await res.json()).keys);
  } catch {}
  manifestAt = Date.now();
}

/** R2에 있으면 R2 주소, 아직 동기화 전이면 Notion 원본(만료됨 → ISR이 다시 만듦) */
function resolve(url, key, fallbackKeys = []) {
  if (!key) return url;
  if (!manifest || manifest.has(key)) return r2Url(key);
  const alt = fallbackKeys.find((k) => manifest.has(k));
  return alt ? r2Url(alt) : url;
}

const fileUrl = (f) => f?.file?.url || f?.external?.url || null;
const baseName = (url) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop());
  } catch {
    return '';
  }
};

export function coverUrl(page) {
  const url = fileUrl(page?.cover);
  return url ? resolve(url, r2KeyFromUrl(url)) : null;
}

/** 이미지 블록 → {src, name}. 예전 로컬 파일(이름 그대로 R2 루트·webp)도 대체 후보 */
export function blockImage(image) {
  const url = fileUrl(image);
  if (!url) return null;
  const name = baseName(url);
  const webp = name.replace(/\.(png|jpe?g)$/i, '.webp');
  const legacy = /^image\.\w+$/i.test(name) ? [] : [name, webp]; // 'image.png' 같은 흔한 이름은 다른 파일일 수 있음
  return { src: resolve(url, r2KeyFromUrl(url, blockImageFilename(image, url)), legacy), name };
}

/** 영상·소리·파일·pdf 블록 → {src, name, external} */
export function blockFile(value) {
  const url = fileUrl(value);
  if (!url) return null;
  const name = baseName(url);
  if (value.type === 'external') return { src: url, name, external: true };
  return { src: resolve(url, r2KeyFromUrl(url), [`pdf/${name}`, `videos/${name}`]), name, external: false };
}
