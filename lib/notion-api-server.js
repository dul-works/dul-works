// 서버 사이드에서 사용하는 Notion API 헬퍼 함수

const NOTION_API_KEY = process.env.NOTION_API_KEY;

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
const DATABASES = {
  CV: process.env.NOTION_DB_CV,
  WORK: process.env.NOTION_DB_WORK,
  ARTWORK: process.env.NOTION_DB_ARTWORK,
  RELATED: process.env.NOTION_DB_RELATED
};

// 개발 모드용 캐시 (메모리 기반)
const isDev = process.env.NODE_ENV === 'development';
const CACHE_TTL = 5 * 60 * 1000; // 5분 캐시
const cache = {
  CV: { data: null, timestamp: null },
  WORK: { data: null, timestamp: null },
  ARTWORK: { data: null, timestamp: null },
  RELATED: { data: null, timestamp: null },
  blocks: new Map(), // 페이지별 블록 캐시
  pages: new Map()   // 페이지 정보 캐시
};

function getCachedData(key) {
  if (!isDev) return null;

  const cached = cache[key];
  if (!cached || !cached.data) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache[key] = { data: null, timestamp: null };
    return null;
  }

  return cached.data;
}

function setCachedData(key, data) {
  if (!isDev) return;
  cache[key] = { data, timestamp: Date.now() };
}

function getCachedBlocks(pageId) {
  if (!isDev) return null;

  const cached = cache.blocks.get(pageId);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.blocks.delete(pageId);
    return null;
  }

  return cached.data;
}

function setCachedBlocks(pageId, data) {
  if (!isDev) return;
  cache.blocks.set(pageId, { data, timestamp: Date.now() });
}

function getCachedPage(pageId) {
  if (!isDev) return null;
  const cached = cache.pages.get(pageId);
  if (!cached) return null;
  const now = Date.now();
  if (now - cached.timestamp > CACHE_TTL) {
    cache.pages.delete(pageId);
    return null;
  }
  return cached.data;
}

function setCachedPage(pageId, data) {
  if (!isDev) return;
  cache.pages.set(pageId, { data, timestamp: Date.now() });
}

/**
 * Notion 데이터베이스를 직접 호출하여 데이터를 가져옵니다.
 *
 * @param {string} databaseName - 'CV', 'WORK', 'ARTWORK' 중 하나
 * @returns {Promise<Array>} 데이터베이스 항목 배열
 * @throws {Error} API 키 누락 또는 요청 실패 시
 */

async function fetchNotionDatabaseDirect(databaseName) {
  // 캐시 확인
  const cached = getCachedData(databaseName);
  if (cached) {
    return cached;
  }

  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  const databaseId = DATABASES[databaseName];
  if (!databaseId) {
    throw new Error(`데이터베이스 ${databaseName}의 ID가 설정되지 않았습니다.`);
  }

  const cleanedId = databaseId.trim().replace(/-/g, '');

  try {
    const response = await fetchWithRetry(`https://api.notion.com/v1/databases/${cleanedId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        page_size: 100,
        sorts: []
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (isDev) {
        console.error('Notion API Error:', errorData);
      }
      throw new Error(`Notion API 오류: ${response.status}`);
    }

    const data = await response.json();
    const results = data.results;

    // 캐시에 저장
    setCachedData(databaseName, results);

    return results;
  } catch (error) {
    if (isDev) {
      console.error('Error fetching Notion database:', error);
    }
    throw error;
  }
}

/**
 * 데이터베이스 메타데이터 가져오기 (Parent ID 확인용)
 */
async function getDatabaseMetadataDirect(databaseId) {
  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  const cleanedId = databaseId.trim().replace(/-/g, '');

  try {
    const response = await fetchWithRetry(`https://api.notion.com/v1/databases/${cleanedId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      throw new Error(`DB Metadata Fetch Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching DB metadata:', error);
    return null;
  }
}

export async function getDatabaseMetadataServer(databaseName) {
  const dbId = DATABASES[databaseName];
  if (!dbId) return null;
  return await getDatabaseMetadataDirect(dbId);
}

async function fetchPageBlocksDirect(pageId) {
  const cleanedPageId = pageId.trim().replace(/-/g, '');

  // 캐시 확인
  const cached = getCachedBlocks(cleanedPageId);
  if (cached) {
    return cached;
  }

  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  try {
    const allResults = [];
    let hasMore = true;
    let nextCursor = null;

    while (hasMore) {
      const url = new URL(`https://api.notion.com/v1/blocks/${cleanedPageId}/children`);
      if (nextCursor) url.searchParams.append('start_cursor', nextCursor);

      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (isDev) {
          console.error('Notion Blocks API Error:', errorData);
        }
        break;
      }

      const data = await response.json();
      const results = data.results || [];
      allResults.push(...results);

      hasMore = data.has_more || false;
      nextCursor = data.next_cursor || null;
    }

    // 캐시에 저장
    setCachedBlocks(cleanedPageId, allResults);

    return allResults;
  } catch (error) {
    if (isDev) {
      console.error('Error fetching page blocks:', error);
    }
    return [];
  }
}

/**
 * CV 데이터베이스에서 데이터 가져오기 (서버 사이드)
 */
export async function getCVDataServer() {
  return await fetchNotionDatabaseDirect('CV');
}

/**
 * WORK 데이터베이스에서 데이터 가져오기 (서버 사이드)
 */
export async function getWORKDataServer() {
  return await fetchNotionDatabaseDirect('WORK');
}

/**
 * ARTWORK 데이터베이스에서 데이터 가져오기 (서버 사이드)
 */
export async function getARTWORKDataServer() {
  return await fetchNotionDatabaseDirect('ARTWORK');
}

/**
 * RELATED 데이터베이스에서 데이터 가져오기 (서버 사이드)
 */
export async function getRELATEDDataServer() {
  return await fetchNotionDatabaseDirect('RELATED');
}

/**
 * 블록의 children 가져오기 (서버 사이드)
 */
async function fetchBlockChildrenDirect(blockId) {
  const cleanedBlockId = blockId.trim().replace(/-/g, '');

  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  try {
    const allResults = [];
    let hasMore = true;
    let nextCursor = null;

    while (hasMore) {
      const url = new URL(`https://api.notion.com/v1/blocks/${cleanedBlockId}/children`);
      if (nextCursor) url.searchParams.append('start_cursor', nextCursor);

      const response = await fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (isDev) {
          console.error('Notion Block Children API Error:', errorData);
        }
        break;
      }

      const data = await response.json();
      const results = data.results || [];
      allResults.push(...results);

      hasMore = data.has_more || false;
      nextCursor = data.next_cursor || null;
    }

    return allResults;
  } catch (error) {
    if (isDev) {
      console.error('Error fetching block children:', error);
    }
    return [];
  }
}

/**
 * 페이지의 블록 가져오기 (서버 사이드)
 */
export async function getPageBlocksServer(pageId) {
  return await fetchPageBlocksDirect(pageId);
}

/**
 * 페이지 정보 가져오기 (서버 사이드)
 */
export async function getPageInfoServer(pageId) {
  const cleanedPageId = pageId.trim().replace(/-/g, '');

  // 캐시 확인
  const cached = getCachedPage(cleanedPageId);
  if (cached) return cached;

  if (!NOTION_API_KEY) {
    throw new Error('NOTION_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  try {
    const response = await fetchWithRetry(`https://api.notion.com/v1/pages/${cleanedPageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (isDev) {
        console.error(`Page ${pageId} 정보 가져오기 오류:`, errorData);
      }
      return null;
    }

    const data = await response.json();
    setCachedPage(cleanedPageId, data);
    return data;
  } catch (error) {
    if (isDev) {
      console.error(`Page ${pageId} 정보 가져오기 실패:`, error);
    }
    return null;
  }
}

/**
 * 블록의 children 가져오기 (서버 사이드)
 */
export async function getBlockChildrenServer(blockId) {
  return await fetchBlockChildrenDirect(blockId);
}

/**
 * 모든 데이터베이스 데이터 가져오기 (서버 사이드)
 */
export async function getAllNotionDataServer() {
  try {
    const cvData = await getCVDataServer().catch(err => { console.error('CV DB 로드 실패:', err.message); return []; });
    const workData = await getWORKDataServer().catch(err => { console.error('WORK DB 로드 실패:', err.message); return []; });
    const artworkData = await getARTWORKDataServer().catch(err => { console.error('ARTWORK DB 로드 실패:', err.message); return []; });
    const relatedData = await getRELATEDDataServer().catch(err => { console.error('RELATED DB 로드 실패:', err.message); return []; });

    return {
      CV: cvData,
      WORK: workData,
      ARTWORK: artworkData,
      RELATED: relatedData
    };
  } catch (error) {
    if (isDev) {
      console.error('데이터 가져오기 실패 (치명적 오류):', error);
    }
    throw error;
  }
}

