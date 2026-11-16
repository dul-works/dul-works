// 사이트 전체 데이터: 노션 네 DB를 한 번 읽어 작품·프로젝트·전시·글·이력으로 정리 (W2 속성 지도)

import { queryNamedDatabase, queryDatabase, getDatabase, getChildren, getBlockTree, getContainingPageId } from './notion-api-server.js';
import { text, num, checked, relation, titleOf, prop, coverUrl, refreshR2Manifest } from './notion-utils.js';
import { parseBody, firstLink, firstImage, firstParagraph } from './blocks.js';
import { createSlug } from './slug-utils.js';
import { parsePeriod, formatPeriod, periodCmp } from './period.js';

export const REVALIDATE = 600; // 10분. 노션 파일 주소가 1시간이면 만료되므로 그보다 짧게

// ---------- 기간 ---------- (읽기·표시·정렬은 lib/period.js)
export { periodCmp, formatPeriod };

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
      order: num(prop(w, 'Order')) ?? 999,
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
      return { id: w.id, slug: null, name: titleOf(w), nameKr: orNull(text(prop(w, 'Name KR'))), kind: /SOLO/.test(text(prop(w, 'Class'))) ? 'solo' : 'group', venue: orNull(text(prop(w, 'Venue'))), venueKr: orNull(text(prop(w, 'Venue KR'))), periodLabel: formatPeriod(text(prop(w, 'Period'))), cover: coverUrl(w), current: checked(prop(w, 'Current')), year: p.year, start: p.start, end: p.end, sortStart: p.sortStart, sortEnd: p.sortEnd };
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
        venue: orNull(text(prop(w, 'Venue'))),
        venueKr: orNull(text(prop(w, 'Venue KR'))),
        current: checked(prop(w, 'Current')), // 홈 now on view / upcoming 후보
        description: orNull(text(prop(w, 'Description EN'))),
        descriptionKr: orNull(text(prop(w, 'Description KR'))),
        period,
        periodLabel: formatPeriod(period),
        start: p.start,
        end: p.end,
        sortStart: p.sortStart,
        sortEnd: p.sortEnd,
        year: p.year,
        cover: coverUrl(w),
        relatedIds: relation(prop(w, 'Related')),
      };
    })
    .sort(periodCmp); // index·Order 없이 Period 최신순만

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
      homeOrder: num(prop(a, 'Home Order')), // 홈 selected works 순서 (소수 가능, 비면 Order)
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
      year: num(prop(r, 'Year')) ?? [...exhibitions, ...hiddenExhibitions].find((e) => workIds.includes(e.id))?.year ?? null, // Post 꺼진 전시의 Period 연도도 씀
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

  // CV: CV DB가 따로 관리됨(전시 SOLO/GROUP 행 포함). 웹 cv 페이지는 이 DB만 읽음. WORKS 전시와는 이름·시작일로 링크만 이음 (pages/cv.js)
  const cvClass = { EDUCATION: 'education', 'SOLO EXHIBITION': 'solo', 'GROUP EXHIBITION': 'group', AWARDS: 'awards', RESIDENCY: 'residency', 'PARTICIPATED WORK': 'participated' };
  const cv = { education: [], solo: [], group: [], awards: [], residency: [], participated: [] };
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
      placeKr: orNull(text(prop(r, 'Place KR'))),
      client: orNull(text(prop(r, 'Client'))),
      role: orNull(text(prop(r, 'Role'))),
      period,
      periodLabel: formatPeriod(period),
      start: p.start,
      end: p.end,
      sortStart: p.sortStart,
      sortEnd: p.sortEnd,
      year: p.year,
      endYear: p.endYear,
    });
  }
  for (const k of Object.keys(cv)) cv[k].sort(periodCmp); // Period 최신순 (같으면 끝일 → 이름)

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

/**
 * 홈 오른쪽 칸: WORKS `Current`가 체크된 전시만 (날짜 창 계산 없음, Post 꺼진 전시도 포함 → 링크 없이 표시).
 * 시작일이 오늘(서울)보다 뒤 = upcoming(시작 가까운 순), 나머지 = now on view(끝 늦은 순).
 * 작가가 일부러 체크한 지난 전시도 now on view에 둠. Current가 꺼진 전시는 날짜와 상관없이 안 나옴
 */
export function exhibitionsOnHome(exhibitions) {
  const t = today();
  const picked = exhibitions.filter((e) => e.current);
  const upcoming = picked.filter((e) => e.start && e.start > t).sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
  const now = picked.filter((e) => !(e.start && e.start > t)).sort((a, b) => (b.sortEnd || '').localeCompare(a.sortEnd || '') || a.name.localeCompare(b.name));
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
