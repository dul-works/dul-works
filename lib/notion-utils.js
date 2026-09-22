// Notion 데이터 파싱 유틸리티 함수들

import { r2KeyFromUrl, blockImageFilename } from './r2-key.js';

/**
 * Notion property에서 텍스트 추출
 */
export function extractText(property) {
  if (!property) return '';

  if (property.title && property.title.length > 0) {
    return property.title.map(t => t.plain_text).join('');
  }
  if (property.rich_text && property.rich_text.length > 0) {
    return property.rich_text.map(t => t.plain_text).join('');
  }
  if (property.select) {
    return property.select.name || '';
  }
  if (property.date) {
    const date = property.date;
    if (date.start) {
      return date.end ? `${date.start} - ${date.end}` : date.start;
    }
  }
  if (typeof property.number === 'number') {
    return property.number.toString();
  }

  if (property.url) {
    return property.url;
  }

  return '';
}

/**
 * Notion property에서 날짜 추출
 */
export function extractDate(property) {
  if (!property) return '';

  if (property.date) {
    const date = property.date;
    if (date.start) {
      return date.end ? `${date.start} - ${date.end}` : date.start;
    }
  }
  if (property.rich_text && property.rich_text.length > 0) {
    return property.rich_text.map(t => t.plain_text).join('');
  }
  if (property.title && property.title.length > 0) {
    return property.title.map(t => t.plain_text).join('');
  }
  if (property.select) {
    return property.select.name || '';
  }

  return '';
}

/**
 * Notion property에서 숫자 추출
 */
export function extractNumber(property) {
  if (!property) return null;

  if (typeof property.number === 'number') {
    return property.number;
  }
  if (property.rich_text && property.rich_text.length > 0) {
    const text = property.rich_text[0].plain_text || '';
    const num = parseInt(text, 10);
    return isNaN(num) ? null : num;
  }
  if (property.title && property.title.length > 0) {
    const text = property.title[0].plain_text || '';
    const num = parseInt(text, 10);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Notion property에서 인덱스 문자열 추출 (예: "2,3" 또는 "full")
 */
export function extractIndex(property) {
  if (!property) return null;

  if (property.rich_text && property.rich_text.length > 0) {
    return property.rich_text.map(t => t.plain_text).join('').trim() || null;
  }
  if (property.title && property.title.length > 0) {
    return property.title.map(t => t.plain_text).join('').trim() || null;
  }
  if (typeof property.number === 'number') {
    return property.number.toString();
  }
  if (property.select) {
    return property.select.name ? property.select.name.trim() : null;
  }
  if (property.formula) {
    if (property.formula.string) {
      return property.formula.string.trim();
    }
    if (property.formula.number) {
      return property.formula.number.toString();
    }
  }

  return null;
}

/**
 * Notion property에서 relation 추출 (ID 배열 반환)
 */
export function extractRelation(property) {
  if (!property || property.type !== 'relation' || !property.relation) return [];

  return property.relation.map(item => item.id);
}

/**
 * Notion property에서 타입이 title인 속성 찾기
 */
export function findTitleProperty(properties) {
  return Object.values(properties || {}).find(p => p.type === 'title') || null;
}

/**
 * index 오름차순 정렬, index가 null인 항목은 맨 뒤로
 */
export function byIndexNullsLast(a, b) {
  if (a.index === null && b.index === null) return 0;
  if (a.index === null) return 1;
  if (b.index === null) return -1;
  return a.index - b.index;
}

/**
 * Notion property에서 다양한 필드명으로 값 찾기
 */
export function findProperty(properties, ...fieldNames) {
  for (const fieldName of fieldNames) {
    const property = properties[fieldName];
    if (property) return property;
  }
  return null;
}

/**
 * R2 저장 키로 실제 이미지 URL 생성
 */
export function getImageUrl(key) {
  if (!key) return null;

  const baseUrl = process.env.R2_PUBLIC_URL;
  if (!baseUrl) {
    throw new Error('R2_PUBLIC_URL 환경 변수가 설정되지 않았습니다.');
  }

  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl.replace(/\/$/, '')}/${encodedKey}`;
}

// R2에 실제로 있는 키 목록 (scripts/sync-images-to-r2.js가 manifest.json으로 기록)
const MANIFEST_TTL = 60 * 1000;
let manifestKeys = null;
let manifestFetchedAt = 0;
let manifestRequest = null;

/**
 * R2 manifest를 1분 단위로 갱신. 실패하면 이전 목록 유지 (목록이 없으면 모든 이미지를 R2에 있다고 간주)
 */
export async function refreshR2Manifest() {
  const baseUrl = process.env.R2_PUBLIC_URL;
  if (!baseUrl || Date.now() - manifestFetchedAt < MANIFEST_TTL) return;
  if (!manifestRequest) {
    manifestRequest = fetch(`${baseUrl.replace(/\/$/, '')}/manifest.json`, { cache: 'no-store', signal: AbortSignal.timeout(3000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.keys) manifestKeys = new Set(data.keys);
      })
      .catch(() => {})
      .finally(() => {
        manifestFetchedAt = Date.now();
        manifestRequest = null;
      });
  }
  await manifestRequest;
}

// 아직 R2에 동기화되지 않은 Notion 이미지는 Notion 원본 주소로 임시 표시
function resolveNotionImage(url, key) {
  if (!key) return null;
  if (manifestKeys && !manifestKeys.has(key)) return url;
  return getImageUrl(key);
}

/**
 * Notion Page Cover 이미지 URL
 */
export function getCoverImageUrl(item) {
  const url = item?.cover?.file?.url || item?.cover?.external?.url;
  if (!url) return null;
  return resolveNotionImage(url, r2KeyFromUrl(url));
}

/**
 * Notion 이미지 블록의 파일명과 URL
 */
export function getBlockImage(image) {
  const url = image?.file?.url || image?.external?.url;
  if (!url) return null;
  const filename = blockImageFilename(image, url);
  return { filename, path: resolveNotionImage(url, r2KeyFromUrl(url, filename)) };
}

/**
 * Notion property에서 체크박스 값 추출
 */
export function extractCheckbox(property) {
  if (!property || property.type !== 'checkbox') return false;
  return property.checkbox || false;
}

