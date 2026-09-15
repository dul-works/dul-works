// URL slug 유틸리티 함수

/**
 * 프로젝트 이름을 URL-safe slug로 변환
 */
export function createSlug(name) {
  if (!name) return '';

  const toSlug = (pattern) => name
    .toLowerCase()
    .replace(pattern, '-')
    .replace(/^-+|-+$/g, '');

  // 영문/숫자가 하나도 없는 이름(한글 전시명 등)은 유니코드 문자를 살림. 기존 영문 slug는 그대로 유지
  return toSlug(/[^a-z0-9]+/g) || toSlug(/[^\p{L}\p{N}]+/gu);
}


