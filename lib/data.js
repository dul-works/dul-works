// 사이트 전체 데이터: 노션 네 DB를 한 번 읽어 작품·프로젝트·전시·글·이력으로 정리 (W2 속성 지도)

import { queryNamedDatabase, queryDatabase, getDatabase, getChildren, getBlockTree, getContainingPageId } from './notion-api-server.js';
import { text, num, checked, relation, titleOf, prop, coverUrl, refreshR2Manifest } from './notion-utils.js';
import { parseBody, firstLink, firstImage, firstParagraph } from './blocks.js';
import { createSlug } from './slug-utils.js';

export const REVALIDATE = 600; // 10분. 노션 파일 주소가 1시간이면 만료되므로 그보다 짧게

// ---------- 기간 ----------

const pad = (n) => String(n).padStart(2, '0');

/** '2024.11.02 - 2024.12.12', '2026 -', 'Mar. 2018 - Aug. 2024' → {start, end, year} (ISO 문자열) */
export function parsePeriod(s) {
  const parts = (s || '').split(/\s+[-–~]\s*|\s*[-–~]\s+/);
  const date = (p) => {
    const m = (p || '').match(/(\d{4})(?:[.\-/](\d{1,2})(?:[.\-/](\d{1,2}))?)?/);
    return m ? { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null } : null;
  };
  const a = date(parts[0]);
  let b = date(parts[1]);
  // '2026.11.20 - 12.14' 처럼 끝 연도를 생략한 경우
  if (!b && parts[1]) {
    const m = parts[1].match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (m && a) b = { y: a.y, m: +m[1], d: +m[2] };
  }
  const iso = (x) => (x && x.m && x.d ? `${x.y}-${pad(x.m)}-${pad(x.d)}` : null);
  return { start: iso(a), end: iso(b) || iso(a), year: a?.y ?? null, endYear: b?.y ?? null, open: /[-–]\s*$/.test((s || '').trim()) };
}

/** '2026.11.20 – 12.14' (같은 해면 끝 연도 생략) */
export function formatPeriod(start, end, raw) {
  if (!start) return raw || '';
  const [ys, ms, ds] = start.split('-');
  if (!end || end === start) return `${ys}.${ms}.${ds}`;
  const [ye, me, de] = end.split('-');
  return ye === ys ? `${ys}.${ms}.${ds} – ${me}.${de}` : `${ys}.${ms}.${ds} – ${ye}.${me}.${de}`;
}

const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); // 서울 기준

// ---------- 정리 ----------

const firstLine = (s) => (s || '').split('\n').map((x) => x.trim()).find(Boolean) || null;
const orNull = (s) => (s && s.trim()) || null;

function uniqueSlugs(items) {
  const seen = new Set();
  for (const it of items) {
    let s = it.slug || it.id.replace(/-/g, '').slice(0, 12);
    if (seen.has(s)) s = `${s}-${it.id.replace(/-/g, '').slice(0, 6)}`;
    seen.add(s);
    it.slug = s;
  }
}

async function getRelatedRows(workDb) {
  // .env의 NOTION_DB_RELATED는 data source id라 조회가 안 되는 경우가 있어 WORKS.Related 관계의 DB id를 씀
  const id = workDb.properties?.Related?.relation?.database_id || process.env.NOTION_DB_RELATED;
  if (!id) return [];
  try {
    return await queryDatabase(id);
  } catch (e) {
    console.warn('RELATED 조회 실패:', e.message);
    return [];
  }
}

async function getStatement(workDb) {
  try {
    const pageId = await getContainingPageId(workDb.parent);
    if (!pageId) return null;
    const blocks = await getChildren(pageId);
    const i = blocks.findIndex((b) => b.type.startsWith('heading') && /artist statement/i.test(b[b.type].rich_text.map((r) => r.plain_text).join('')));
    if (i < 0) return null;
    const body = [];
    for (const b of blocks.slice(i + 1)) {
      if (b.type.startsWith('heading') || b.type === 'divider') break;
      if (b.has_children) b.children = await getBlockTree(b.id);
      body.push(b);
    }
    return parseBody(body);
  } catch (e) {
    console.warn('Artist Statement 조회 실패:', e.message);
    return null;
  }
}

async function loadSite() {
  await refreshR2Manifest();
  const workDb = await getDatabase('WORK');
  // 동시에 너무 많이 부르면 429 → 순서대로
  const works = await queryNamedDatabase('WORK');
  const artRows = await queryNamedDatabase('ARTWORK');
  const cvRows = await queryNamedDatabase('CV');
  const relRows = await getRelatedRows(workDb);
  const statement = await getStatement(workDb);

  const timelineYear = Object.fromEntries(works.filter((w) => text(prop(w, 'Class')) === 'TIMELINE').map((w) => [w.id, parseInt(titleOf(w), 10) || null]));

  // 프로젝트 (post 체크와 무관 — 지금 노션의 프로젝트 행 대부분이 post 꺼짐)
  const projects = works.filter((w) => text(prop(w, 'Class')) === 'PROJECT').map((w) => {
    const name = titleOf(w);
    return {
      id: w.id,
      slug: createSlug(name),
      name,
      nameKr: orNull(text(prop(w, 'Name KR'))),
      period: orNull(text(prop(w, 'Period'))),
      description: firstLine(text(prop(w, 'Description EN', 'Description'))),
      descriptionKr: firstLine(text(prop(w, 'Description KR'))),
      order: num(prop(w, 'Order')) ?? num(prop(w, 'index')) ?? 999,
      cover: coverUrl(w),
      relatedIds: relation(prop(w, 'Related')),
      etc: /^etc$/i.test(name), // 'ETC' 행은 프로젝트가 아니라 'other works' 묶음
    };
  });

  // Post가 꺼진 전시: 페이지는 없고, 그 전시를 가리키는 관계는 링크 없이 글자만 (W1 G)
  const hiddenExhibitions = works
    .filter((w) => /EXHIBITION/.test(text(prop(w, 'Class'))) && !checked(prop(w, 'post')))
    .map((w) => {
      const p = parsePeriod(text(prop(w, 'Period')));
      return { id: w.id, slug: null, name: titleOf(w), nameKr: orNull(text(prop(w, 'Name KR'))), kind: /SOLO/.test(text(prop(w, 'Class'))) ? 'solo' : 'group', venue: orNull(text(prop(w, 'Venue'))), venueKr: orNull(text(prop(w, 'Venue KR'))), year: p.year, start: p.start };
    });

  const exhibitions = works
    .filter((w) => /EXHIBITION/.test(text(prop(w, 'Class'))) && checked(prop(w, 'post')))
    .map((w) => {
      const name = titleOf(w);
      const period = text(prop(w, 'Period'));
      const p = parsePeriod(period);
      return {
        id: w.id,
        slug: createSlug(name),
        name,
        nameKr: orNull(text(prop(w, 'Name KR'))),
        kind: /SOLO/.test(text(prop(w, 'Class'))) ? 'solo' : 'group',
        // Venue가 비면 예전처럼 Description EN/KR에 적힌 장소를 씀
        venue: orNull(text(prop(w, 'Venue'))) || orNull(text(prop(w, 'Description EN'))),
        venueKr: orNull(text(prop(w, 'Venue KR'))) || orNull(text(prop(w, 'Description KR'))),
        description: orNull(text(prop(w, 'Description EN'))),
        descriptionKr: orNull(text(prop(w, 'Description KR'))),
        period,
        periodLabel: formatPeriod(p.start, p.end, period),
        start: p.start,
        end: p.end,
        year: p.year,
        cover: coverUrl(w),
        order: num(prop(w, 'Order')) ?? 999,
        relatedIds: relation(prop(w, 'Related')),
      };
    })
    .sort((a, b) => (b.start || `${b.year}`).localeCompare(a.start || `${a.year}`));

  const artworks = artRows.filter((a) => checked(prop(a, 'post'))).map((a) => {
    const name = titleOf(a);
    const timeline = relation(prop(a, 'Timeline')).map((id) => timelineYear[id]).find(Boolean);
    return {
      id: a.id,
      slug: orNull(text(prop(a, 'Slug'))) || createSlug(name),
      oldSlug: createSlug(name),
      name,
      nameKr: orNull(text(prop(a, 'Name KR'))),
      year: num(prop(a, 'Year')) ?? timeline ?? null,
      caption: orNull(text(prop(a, 'Caption'))),
      captionKr: orNull(text(prop(a, 'Caption KR'))),
      description: orNull(text(prop(a, 'Description'))),
      descriptionKr: orNull(text(prop(a, 'Description KR'))),
      dimension: orNull(text(prop(a, 'dimension', 'Dimension', 'Dimensions'))),
      artist: orNull(text(prop(a, 'Artist'))),
      projectId: relation(prop(a, 'Project'))[0] || null,
      exhibitionIds: relation(prop(a, 'Exhibition')),
      textIds: relation(prop(a, 'Texts')),
      order: num(prop(a, 'Order')) ?? 999,
      selected: checked(prop(a, 'Selected')), // 홈 selected works (예전 이름 Featured)
      cover: coverUrl(a),
    };
  });
  uniqueSlugs(artworks);

  const etcIds = new Set(projects.filter((p) => p.etc).map((p) => p.id));
  for (const a of artworks) if (etcIds.has(a.projectId)) a.projectId = null;

  const texts = [];
  for (const r of relRows) {
    const name = titleOf(r);
    const content = text(prop(r, 'Content'));
    let url = orNull(text(prop(r, 'URL')));
    let isFile = false;
    const file = (prop(r, 'File')?.files || [])[0];
    if (!url && file) {
      url = file.file?.url || file.external?.url;
      isFile = true;
    }
    if (!url && content !== 'Text') {
      // 링크·파일 글은 URL을 본문에 적어 둠
      try {
        const link = firstLink(await getChildren(r.id));
        if (link) {
          url = link.url;
          isFile = !!link.file;
        }
      } catch {}
    }
    const workIds = relation(prop(r, 'Related'));
    texts.push({
      id: r.id,
      slug: createSlug(name).slice(0, 80).replace(/-+$/, ''),
      name,
      nameKr: orNull(text(prop(r, 'Name KR'))),
      type: orNull(text(prop(r, 'Type'))),
      content,
      year: num(prop(r, 'Year')) ?? exhibitions.find((e) => workIds.includes(e.id))?.year ?? null,
      author: orNull(text(prop(r, 'Author'))),
      publication: orNull(text(prop(r, 'Publication'))),
      url: url || null,
      isFile: !!(isFile || /\.pdf($|\?)/i.test(url || '')),
      workIds,
      artworkIds: relation(prop(r, 'Artworks')),
      index: num(prop(r, 'Index')) ?? 999,
      readable: content === 'Text',
    });
  }
  uniqueSlugs(texts);
  texts.sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || a.index - b.index);

  // 작품 ↔ 글: RELATED.Artworks 또는 ARTWORK.Texts
  for (const t of texts) for (const a of artworks) if (a.textIds.includes(t.id) && !t.artworkIds.includes(a.id)) t.artworkIds.push(a.id);

  // CV: 전시(SOLO/GROUP)는 WORKS에서 만들므로 여기선 학력·수상·레지던시·참여작만
  const cvClass = { EDUCATION: 'education', AWARDS: 'awards', RESIDENCY: 'residency', 'PARTICIPATED WORK': 'participated' };
  const cv = { education: [], awards: [], residency: [], participated: [] };
  for (const r of cvRows) {
    const key = cvClass[text(prop(r, 'Class'))];
    if (!key) continue;
    const period = text(prop(r, 'Period'));
    const p = parsePeriod(period);
    cv[key].push({
      id: r.id,
      // 이 DB는 제목 속성이 Name(KR), 영문은 Name
      name: orNull(text(prop(r, 'Name'))) || titleOf(r),
      nameKr: titleOf(r),
      place: orNull(text(prop(r, 'Place'))),
      client: orNull(text(prop(r, 'Client'))),
      role: orNull(text(prop(r, 'Role'))),
      period,
      year: p.year,
      endYear: p.endYear,
      index: num(prop(r, 'Index')) ?? 999,
    });
  }
  for (const k of Object.keys(cv)) cv[k].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || a.index - b.index);

  // 커버 없는 작품 카드 = 본문 첫 이미지, 설명 없는 프로젝트 = 본문 첫 문단 짝 (W1 G). 빌드·재생성 때 한 번만 읽음
  for (const a of artworks) {
    if (a.cover) continue;
    try {
      a.cover = firstImage(parseBody(await getBlockTree(a.id)));
    } catch {}
  }
  for (const p of projects) {
    if (p.etc || p.description || p.descriptionKr) continue;
    try {
      const fp = firstParagraph(parseBody(await getBlockTree(p.id)));
      if (fp) {
        p.description = fp.en;
        p.descriptionKr = fp.ko;
      }
    } catch {}
  }

  return { projects, exhibitions, hiddenExhibitions, artworks, texts, cv, statement, builtAt: today() };
}

let cache = null;
let cachedAt = 0;

/** 한 프로세스 안에서 1분간 공유 (빌드 중 여러 페이지가 같은 데이터를 씀) */
export function getSite() {
  if (!cache || Date.now() - cachedAt > 60 * 1000) {
    cachedAt = Date.now();
    cache = loadSite().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

// ---------- 정렬·조회 ----------

/** works 목록과 같은 순서: 연도 최신순, 같은 연도는 Order. 연도 없음은 맨 뒤 */
export const byNewest = (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || a.order - b.order || a.name.localeCompare(b.name);

export const UPCOMING_DAYS = 90; // 예정 전시는 시작일이 오늘(서울)부터 90일 이내인 것만

/** 홈 오른쪽 칸: 진행 중(시작 ≤ 오늘 ≤ 끝, 끝나는 순) + 예정(시작이 90일 이내, 가까운 순) */
export function exhibitionsOnHome(exhibitions) {
  const t = today();
  const limit = new Date(Date.parse(t) + UPCOMING_DAYS * 86400000).toISOString().slice(0, 10);
  const now = exhibitions.filter((e) => e.start && e.end && e.start <= t && t <= e.end).sort((a, b) => a.end.localeCompare(b.end));
  const upcoming = exhibitions.filter((e) => e.start && e.start > t && e.start <= limit).sort((a, b) => a.start.localeCompare(b.start));
  return { now, upcoming };
}

/** 카드·목록에 넘길 작품 요약 */
export const card = (a) => ({ slug: a.slug, name: a.name, nameKr: a.nameKr, year: a.year, cover: a.cover, description: a.description, descriptionKr: a.descriptionKr });

export async function getPageBody(pageId) {
  return parseBody(await getBlockTree(pageId));
}

// ---------- 관계 목록 줄 (작품·프로젝트 페이지의 exhibited / texts) ----------

export const exhibitedRow = (e) => ({
  key: e.slug,
  year: e.year,
  en: [e.name, `${e.kind} exhibition`, e.venue].filter(Boolean).join(', '),
  ko: e.nameKr || e.venueKr ? [e.nameKr || e.name, e.venueKr].filter(Boolean).join(', ') : null, // 전시 종류 라벨은 영문 줄에만
  href: e.slug ? `/exhibitions/${e.slug}` : null,
});

export const textRow = (t) => ({
  key: t.slug,
  year: t.year,
  en: [t.name, t.publication].filter(Boolean).join(', '),
  ko: t.nameKr,
  href: t.readable ? `/archive/${t.slug}` : t.url,
  external: !t.readable && !!t.url,
});
