// Notion API (server only): DB 조회, 블록 트리, 429 재시도

const NOTION_API_KEY = process.env.NOTION_API_KEY;

const DATABASES = {
  CV: process.env.NOTION_DB_CV,
  WORK: process.env.NOTION_DB_WORK,
  ARTWORK: process.env.NOTION_DB_ARTWORK,
};

const cleanId = (id) => id.trim().replace(/-/g, '');

async function notionFetch(path, body) {
  if (!NOTION_API_KEY) throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  const options = {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`https://api.notion.com/v1/${path}`, options);
    if (res.status !== 429 && res.status < 500) return res;
    const retryAfter = parseInt(res.headers.get('Retry-After') || '1', 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000 + i * 500));
  }
  return fetch(`https://api.notion.com/v1/${path}`, options);
}

async function notionJson(path, body) {
  const res = await notionFetch(path, body);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`Notion API ${res.status}: ${data.message || path}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function queryDatabase(databaseId) {
  const results = [];
  let cursor = null;
  do {
    const data = await notionJson(`databases/${cleanId(databaseId)}/query`, { page_size: 100, ...(cursor && { start_cursor: cursor }) });
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
}

export const queryNamedDatabase = (name) => queryDatabase(DATABASES[name]);

export const getDatabase = (name) => notionJson(`databases/${cleanId(DATABASES[name])}`);

export async function getChildren(blockId) {
  const results = [];
  let cursor = null;
  do {
    const data = await notionJson(`blocks/${cleanId(blockId)}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`);
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
}

/** 블록 트리 전체 (하위 페이지·DB 보기 안쪽은 내려가지 않음) */
export async function getBlockTree(blockId) {
  const blocks = await getChildren(blockId);
  for (const b of blocks) {
    if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
      b.children = await getBlockTree(b.id);
    }
  }
  return blocks;
}

/** parent를 따라 올라가 소속 페이지 ID (토글·탭 안의 DB도 찾음) */
export async function getContainingPageId(parent) {
  let p = parent;
  for (let i = 0; p && i < 10; i++) {
    if (p.type === 'page_id') return p.page_id;
    if (p.type !== 'block_id') return null;
    p = (await notionJson(`blocks/${cleanId(p.block_id)}`)).parent;
  }
  return null;
}
