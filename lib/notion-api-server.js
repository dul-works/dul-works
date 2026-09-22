// 서버 사이드에서 사용하는 Notion API 헬퍼 함수

import { refreshR2Manifest, findProperty, extractCheckbox } from './notion-utils.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const isDev = process.env.NODE_ENV === 'development';

const DATABASES = {
  CV: process.env.NOTION_DB_CV,
  WORK: process.env.NOTION_DB_WORK,
  ARTWORK: process.env.NOTION_DB_ARTWORK
};

// 429 rate limit 시 자동 재시도
async function fetchWithRetry(url, options, retries = 5) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
    const delay = (retryAfter * 1000) + (i * 500);
    await new Promise(r => setTimeout(r, delay));
  }
  return fetch(url, options);
}

function assertApiKey() {
  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
}

// Notion API 호출 (API 키 확인 + 공통 헤더)
function notionFetch(path, body) {
  assertApiKey();
  const headers = {
    'Authorization': `Bearer ${NOTION_API_KEY}`,
    'Notion-Version': '2022-06-28'
  };
  if (body) headers['Content-Type'] = 'application/json';
  return fetchWithRetry(`https://api.notion.com/v1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
}

const cleanId = (id) => id.trim().replace(/-/g, '');

/**
 * Notion 데이터베이스를 직접 호출하여 데이터를 가져옵니다.
 * @param {string} databaseName - 'CV', 'WORK', 'ARTWORK' 중 하나
 */
async function fetchNotionDatabaseDirect(databaseName) {
  // 이미지 URL을 만들기 전에 R2 파일 목록 갱신 (모든 페이지가 DB 조회를 먼저 거침)
  await refreshR2Manifest();

  const databaseId = DATABASES[databaseName];
  if (!databaseId) {
    throw new Error(`데이터베이스 ${databaseName}의 ID가 설정되지 않았습니다.`);
  }

  // Notion은 한 번에 최대 100개만 반환하므로 next_cursor를 따라가며 전부 수집
  const results = [];
  let nextCursor = null;
  do {
    const body = { page_size: 100, sorts: [] };
    if (nextCursor) body.start_cursor = nextCursor;

    const response = await notionFetch(`databases/${cleanId(databaseId)}/query`, body);
    if (!response.ok) {
      const errorData = await response.json();
      if (isDev) console.error('Notion API Error:', errorData);
      throw new Error(`Notion API 오류: ${response.status}`);
    }

    const data = await response.json();
    results.push(...(data.results || []));
    nextCursor = data.has_more ? data.next_cursor || null : null;
  } while (nextCursor);

  return results;
}

/**
 * parent를 따라 올라가 소속 페이지 ID 반환 (토글·섹션·탭 안에 있어도 찾음)
 */
export async function getContainingPageId(parent) {
  let p = parent;
  for (let i = 0; p && i < 10; i++) {
    if (p.type === 'page_id') return p.page_id;
    if (p.type !== 'block_id') return null;
    const response = await notionFetch(`blocks/${cleanId(p.block_id)}`);
    if (!response.ok) return null;
    p = (await response.json()).parent;
  }
  return null;
}

/**
 * 데이터베이스 메타데이터 가져오기 (Parent ID 확인용)
 */
export async function getDatabaseMetadataServer(databaseName) {
  const dbId = DATABASES[databaseName];
  if (!dbId) return null;

  assertApiKey();
  try {
    const response = await notionFetch(`databases/${cleanId(dbId)}`);
    if (!response.ok) {
      throw new Error(`DB Metadata Fetch Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching DB metadata:', error);
    return null;
  }
}

/**
 * 블록(페이지)의 children 전부 가져오기 (페이지네이션)
 */
async function fetchBlockChildren(blockId) {
  const path = `blocks/${cleanId(blockId)}/children`;
  assertApiKey(); // 키 누락은 삼키지 않고 throw

  try {
    const allResults = [];
    let nextCursor = null;
    do {
      const response = await notionFetch(nextCursor ? `${path}?start_cursor=${encodeURIComponent(nextCursor)}` : path);
      if (!response.ok) {
        const errorData = await response.json();
        if (isDev) console.error('Notion Blocks API Error:', errorData);
        break;
      }

      const data = await response.json();
      allResults.push(...(data.results || []));
      nextCursor = data.has_more ? data.next_cursor || null : null;
    } while (nextCursor);

    return allResults;
  } catch (error) {
    if (isDev) console.error('Error fetching block children:', error);
    return [];
  }
}

export const getPageBlocksServer = fetchBlockChildren;
export const getBlockChildrenServer = fetchBlockChildren;

export async function getCVDataServer() {
  return fetchNotionDatabaseDirect('CV');
}

export async function getWORKDataServer() {
  return fetchNotionDatabaseDirect('WORK');
}

export async function getARTWORKDataServer() {
  // Post 체크된 작품만 사이트에 노출 (작품 목록·상세·전시 페이지 모두 여기를 거침)
  const artworks = await fetchNotionDatabaseDirect('ARTWORK');
  return artworks.filter(item => extractCheckbox(findProperty(item.properties || {}, 'Post', 'post', 'POST')));
}

/**
 * 페이지 정보 가져오기 (서버 사이드)
 */
export async function getPageInfoServer(pageId) {
  assertApiKey();
  try {
    const response = await notionFetch(`pages/${cleanId(pageId)}`);
    if (!response.ok) {
      const errorData = await response.json();
      if (isDev) console.error(`Page ${pageId} 정보 가져오기 오류:`, errorData);
      return null;
    }
    return await response.json();
  } catch (error) {
    if (isDev) console.error(`Page ${pageId} 정보 가져오기 실패:`, error);
    return null;
  }
}
