// Notion 페이지 블록에서 본문 텍스트·이미지를 추출하는 공통 유틸리티 (artwork/exhibition 상세 페이지)

import { getBlockChildrenServer } from './notion-api-server.js';
import { getImageUrl, getBlockImage } from './notion-utils.js';

const TEXT_BLOCK_TYPES = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'];

/**
 * 이미지 파일명에서 위치 정보 추출
 * 예: artwork-newborn-space-v200-1-1.jpg -> { column: 1, row: 1 }
 * posterFirst: poster로 시작하는 파일은 항상 1-1 위치 (exhibition)
 */
function parseImagePosition(filename, posterFirst) {
  if (posterFirst && filename.toLowerCase().startsWith('poster')) {
    return { column: 1, row: 1 };
  }

  // 파일명 끝에 있는 -숫자-숫자.확장자 패턴 찾기
  const match = filename.match(/-(\d+)-(\d+)(?:\.(jpg|jpeg|png|gif|webp))?$/i);
  if (match) {
    return {
      column: parseInt(match[1], 10), // 1 = 2번째 열, 2 = 3번째 열
      row: parseInt(match[2], 10)
    };
  }

  return null;
}

/**
 * Image 필드(줄바꿈 구분 파일명)에서 이미지 목록 추출 및 정렬 (Fallback)
 */
export function extractImagesFromImageField(imageText, { posterFirst = false } = {}) {
  if (!imageText || imageText.trim() === '') {
    return [];
  }

  const images = imageText.split('\n')
    .map(f => f.trim())
    .filter(f => f !== '')
    .map(filename => {
      const position = parseImagePosition(filename, posterFirst);
      return {
        filename,
        path: getImageUrl(filename),
        column: position ? position.column : null,
        row: position ? position.row : null
      };
    });

  // 위치가 있는 이미지만 남기고 정렬 (열 우선, 그 다음 행)
  return images
    .filter(img => img.column !== null && img.row !== null)
    .sort((a, b) => (a.column !== b.column ? a.column - b.column : a.row - b.row));
}

/**
 * 블록에서 이미지 추출 (Column List 구조 기반)
 * - Col 1: Text (Skip)
 * - Col 2: Images -> Frontend Col 1
 * - Col 3: Images -> Frontend Col 2
 * 첫 번째 column_list(EN 블록)만 처리하여 KR 블록(구분선 아래)의 중복 이미지 방지
 */
export async function extractImagesFromBlocks(blocks) {
  const images = [];
  const enBlock = blocks.find(b => b.type === 'column_list');
  if (!enBlock) return images;

  const columns = await getBlockChildrenServer(enBlock.id);
  for (const col of [1, 2]) {
    if (columns.length <= col) break;
    const colBlocks = await getBlockChildrenServer(columns[col].id);
    for (const block of colBlocks) {
      if (block.type !== 'image') continue;
      const blockImage = getBlockImage(block.image);
      if (blockImage) images.push({ ...blockImage, column: col, row: 0 }); // Row는 자동 정렬됨
    }
  }

  return images;
}

/**
 * 블록 목록에서 단순 텍스트 추출 (EN 토글 로직 없이, 1단계 깊이만)
 * 빈 텍스트 블록은 null(빈 줄)
 */
export function extractSimpleTextFromBlocks(blocks) {
  return blocks
    .filter(block => TEXT_BLOCK_TYPES.includes(block.type))
    .map(block => {
      const richText = block[block.type]?.rich_text || [];
      return richText.length > 0 ? richText : null;
    });
}

/**
 * "EN" 표시(토글 제목 또는 텍스트) 이후/내부의 텍스트 추출 (컨테이너 블록은 재귀 탐색)
 * rich_text 구조를 유지하여 bold 등의 스타일 정보 보존
 */
export async function extractTextFromBlocks(blocks) {
  let foundEN = false;
  const enBlocks = [];

  for (const block of blocks) {
    let currentRichText = null;
    let blockText = '';

    if (TEXT_BLOCK_TYPES.includes(block.type) || block.type === 'toggle') {
      currentRichText = block[block.type]?.rich_text || [];
      blockText = currentRichText.map(t => t.plain_text).join('').trim().toUpperCase();
    }

    if (!foundEN && (blockText === 'EN' || blockText.startsWith('EN:'))) {
      foundEN = true;
      // EN 토글의 children은 바로 수집
      if (block.type === 'toggle' || block.has_children) {
        enBlocks.push(...extractSimpleTextFromBlocks(await getBlockChildrenServer(block.id)));
      }
      continue; // "EN" 자체는 텍스트에 포함 안 함
    }

    if (foundEN && currentRichText) {
      enBlocks.push(currentRichText.length > 0 ? currentRichText : null);
    }

    // 컨테이너 블록(column_list, column 등) 재귀 탐색
    if ((block.type === 'column_list' || block.type === 'column' || (block.type === 'toggle' && !foundEN)) && block.has_children) {
      const childrenTexts = await extractTextFromBlocks(await getBlockChildrenServer(block.id));
      if (childrenTexts.length > 0) {
        // 자식 탐색 중 EN을 찾았다면 그 텍스트들만 반환
        if (!foundEN) return childrenTexts;
        enBlocks.push(...childrenTexts);
      }
    }
  }

  return foundEN ? enBlocks : [];
}

/**
 * 페이지 블록에서 본문 텍스트 추출
 * 1) 첫 column_list의 가장 왼쪽 열 2) EN 표시 3) 최상위 텍스트 블록 전체 순으로 시도
 * blocks: getPageBlocksServer로 이미 가져온 최상위 블록 배열
 */
export async function extractPageText(blocks) {
  try {
    if (!blocks || blocks.length === 0) {
      return [];
    }

    let textBlocks = [];
    const firstColumnList = blocks.find(b => b.type === 'column_list');
    if (firstColumnList) {
      const columns = await getBlockChildrenServer(firstColumnList.id);
      if (columns.length > 0) {
        textBlocks = extractSimpleTextFromBlocks(await getBlockChildrenServer(columns[0].id));
      }
    }

    if (textBlocks.length === 0) {
      textBlocks = await extractTextFromBlocks(blocks);
    }
    if (textBlocks.length === 0) {
      textBlocks = extractSimpleTextFromBlocks(blocks);
    }

    return textBlocks;
  } catch (error) {
    console.error('extractPageText Error:', error);
    return [];
  }
}

/**
 * 본문 텍스트가 비어있으면 description 속성을 줄 단위 문단으로 사용
 */
export function withDescriptionFallback(pageText, description) {
  if (pageText.length > 0 || !description) return pageText;
  return description.split('\n')
    .filter(line => line.trim() !== '')
    .map(line => [{ plain_text: line.trim(), annotations: {} }]);
}
