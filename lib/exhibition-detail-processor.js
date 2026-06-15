// Exhibition 상세 페이지 데이터 처리 유틸리티

import { getWORKDataServer, getARTWORKDataServer } from './notion-api-server.js';
import { getPageBlocksServer, getBlockChildrenServer, getPageInfoServer } from './notion-api-server.js';
import { extractText, extractDate, findProperty, extractRelation, findTitleProperty, extractNumber } from './notion-utils.js';
import { createSlug } from './slug-utils.js';

/**
 * 이미지 파일명에서 위치 정보 추출
 * 예: poster-exhibition-name-1-1.jpg -> { column: 1, row: 1 }
 * poster로 시작하는 이미지는 1-1 위치
 */
function parseImagePosition(filename) {
  const normalizedFilename = filename.toLowerCase();

  // poster로 시작하는 이미지는 항상 1-1 위치
  if (normalizedFilename.startsWith('poster')) {
    return {
      column: 1,
      row: 1
    };
  }

  // 파일명 끝에 있는 -숫자-숫자.확장자 패턴 찾기
  const pattern = /-(\d+)-(\d+)(?:\.(jpg|jpeg|png|gif|webp))?$/i;
  const match = filename.match(pattern);

  if (match) {
    return {
      column: parseInt(match[1], 10), // 1 = 2번째 열, 2 = 3번째 열
      row: parseInt(match[2], 10)
    };
  }

  return null;
}

/**
 * 블록에서 이미지 추출 (Column List 구조 기반)
 * Notion Block:
 * - Col 1: Text (Skip)
 * - Col 2: Images -> Frontend Col 1
 * - Col 3: Images -> Frontend Col 2
 * 
 * *수정*: 첫 번째 column_list(EN 블록)만 처리하여 KR 블록(구분선 아래)의 중복 이미지 방지
 */
async function extractImagesFromBlocks(blocks) {
  let images = [];

  // 첫 번째 column_list만 사용 (EN 블록)
  const enBlock = blocks.find(b => b.type === 'column_list');

  if (enBlock) {
    const columns = await getBlockChildrenServer(enBlock.id);

    // 2번째 열 (Index 1) -> Frontend Column 1
    if (columns.length > 1) {
      const col2 = columns[1];
      const col2Blocks = await getBlockChildrenServer(col2.id);
      const col2Images = await extractImagesFromColumnBlocks(col2Blocks, 1);
      images.push(...col2Images);
    }

    // 3번째 열 (Index 2) -> Frontend Column 2
    if (columns.length > 2) {
      const col3 = columns[2];
      const col3Blocks = await getBlockChildrenServer(col3.id);
      const col3Images = await extractImagesFromColumnBlocks(col3Blocks, 2);
      images.push(...col3Images);
    }
  }

  return images;
}

/**
 * 컬럼 내부 블록에서 이미지 추출 (재귀)
 */
async function extractImagesFromColumnBlocks(blocks, frontendColumnIndex) {
  let images = [];

  for (const block of blocks) {
    if (block.type === 'image') {
      const image = block.image;
      let imageUrl = null;
      if (image.file) {
        imageUrl = image.file.url;
      } else if (image.external) {
        imageUrl = image.external.url;
      }

      if (imageUrl) {
        const caption = image.caption && image.caption.length > 0 ? image.caption[0].plain_text : '';
        let filename = caption.trim();

        if (!filename) {
          try {
            const urlObj = new URL(imageUrl);
            const pathname = urlObj.pathname;
            filename = pathname.split('/').pop();
          } catch (e) {
            filename = `image-${Date.now()}.jpg`;
          }
        }

        if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          filename += '.jpg';
        }

        const basePath = '';
        images.push({
          filename: filename,
          path: imageUrl, // getExhibitionBySlug에서 로컬 경로로 변환 (현재 로직 유지)
          // 하지만 User Request에 따라 수정 필요한 부분이 있을 수 있음.
          // 여기서 path는 Notion URL임. getExhibitionBySlug에서 변환함?
          // getArtworkBySlug와 달리 getExhibitionBySlug는 이 함수를 쓰고나서 path를 변환하는 로직이 내부에 있음?
          // 아니, getExhibitionBySlug (file end)를 보면 extractImagesFromBlocks 호출 후 path 변환 로직이 안보이는데...
          // 아, view_file로 끝까지 안봐서 모름. 하지만 아래쪽 extractImagesFromImageField는 /assets/...를 직접 반환함.
          // 여기 extractImagesFromColumnBlocks는 path: imageUrl (Notion URL)을 반환하고 있음.
          // 그리고 getExhibitionBySlug에서 이를 변환하는지 확인 필요.
          // 만약 변환한다면 거기서 basePath를 붙여야 함.
          // 일단 여기서는 imageUrl을 반환하므로 basePath 적용 대상 아님.
          column: frontendColumnIndex,
          row: 0
        });
      }
    }
  }

  return images;
}

/**
 * Image 필드에서 이미지 목록 추출 및 정렬
 */
function extractImagesFromImageField(imageText) {
  if (!imageText || imageText.trim() === '') {
    return [];
  }

  // 줄바꿈으로 분리
  const filenames = imageText.split('\n')
    .map(f => f.trim())
    .filter(f => f !== '');

  const images = filenames.map(filename => {
    const normalizedFilename = filename.trim();
    const position = parseImagePosition(normalizedFilename);
    const basePath = '';

    return {
      filename: normalizedFilename,
      path: `${basePath}/assets/images/${normalizedFilename}`,
      column: position ? position.column : null,
      row: position ? position.row : null
    };
  });

  // 위치가 있는 이미지만 필터링하고 정렬 (열 우선, 그 다음 행)
  const positionedImages = images.filter(img => img.column !== null && img.row !== null);
  positionedImages.sort((a, b) => {
    if (a.column !== b.column) {
      return a.column - b.column;
    }
    return a.row - b.row;
  });

  return positionedImages;
}

/**
 * Exhibition 항목에서 상세 데이터 추출
 */
function extractExhibitionDetail(item) {
  const properties = item.properties || {};

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  const periodProperty = findProperty(
    properties,
    'Period', 'period', 'PERIOD',
    'Date', 'date', 'DATE',
    'Year', 'year', 'YEAR',
    'Time', 'time', 'TIME'
  );
  const period = extractDate(periodProperty);

  const descriptionProperty = findProperty(
    properties,
    'Description EN', 'description en', 'Description En', 'Description en',
    'DESCRIPTION EN', 'DescriptionEN', 'descriptionEN',
    'Description', 'description', 'DESCRIPTION'
  );
  const description = extractText(descriptionProperty);

  // Image 필드에서 이미지 목록 추출
  const imageProperty = findProperty(
    properties,
    'Image', 'image', 'IMAGE'
  );

  let images = [];
  if (imageProperty) {
    const imageText = extractText(imageProperty);
    images = extractImagesFromImageField(imageText);
  }

  return {
    name,
    period,
    description,
    images,
    pageId: item.id
  };
}

/**
 * 블록에서 텍스트 추출 (재귀적으로 children 처리)
 * rich_text 구조를 유지하여 bold 등의 스타일 정보 보존
 */
async function extractTextFromBlocks(blocks, depth = 0) {
  let textBlocks = [];
  let foundEN = false;
  let enBlocks = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let currentRichText = null;
    let blockText = '';

    // 1. 블록 타입별 텍스트 추출
    if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'toggle', 'quote'].includes(block.type)) {
      currentRichText = block[block.type]?.rich_text || [];
      blockText = currentRichText.map(t => t.plain_text).join('').trim().toUpperCase();
    }

    // 2. EN 표시 찾기 (토글 제목이거나 일반 텍스트가 "EN"인 경우)
    if (!foundEN && (blockText === 'EN' || blockText.startsWith('EN:'))) {
      foundEN = true;
      // 토글인 경우 children도 즉시 확인
      if (block.type === 'toggle' || block.has_children) {
        const children = await getBlockChildrenServer(block.id);
        if (children && children.length > 0) {
          // EN 토글의 children은 이미 EN을 찾은 상태이므로 직접 처리
          for (const childBlock of children) {
            if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(childBlock.type)) {
              const childRichText = childBlock[childBlock.type]?.rich_text || [];
              enBlocks.push(childRichText.length > 0 ? childRichText : null);
            }
          }
        }
      }
      continue; // "EN" 자체는 텍스트에 포함 안 함
    }

    // 3. EN을 찾은 상태라면 텍스트 블록 수집
    if (foundEN && currentRichText) {
      enBlocks.push(currentRichText.length > 0 ? currentRichText : null);
    }

    // 4. 컨테이너 블록(column_list, column 등) 재귀 탐색
    if (block.type === 'column_list' || block.type === 'column' || (block.type === 'toggle' && !foundEN)) {
      if (block.has_children) {
        const children = await getBlockChildrenServer(block.id);
        const childrenTexts = await extractTextFromBlocks(children, depth + 1);

        // 만약 자식 블록들 중에서 EN을 찾았다면 그 결과물을 채택
        if (childrenTexts.length > 0) {
          if (foundEN) {
            enBlocks.push(...childrenTexts);
          } else {
            // 자식 탐색 중 EN을 찾았다면 그 텍스트들만 반환하고 종료
            return childrenTexts;
          }
        }
      }
    }
  }

  return foundEN ? enBlocks : [];
}

/**
 * 블록 목록에서 단순 텍스트 추출 (EN 토글 로직 없이, 보여지는 대로)
 */
async function extractSimpleTextFromBlocks(blocks) {
  let textBlocks = [];

  for (const block of blocks) {
    // 텍스트 포함 블록
    if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(block.type)) {
      const richText = block[block.type]?.rich_text || [];
      if (richText.length > 0) {
        textBlocks.push(richText);
      } else {
        textBlocks.push(null); // 빈 줄
      }
    }
    // 하위 블록이 있는 컨테이너 (toggle, column_list 등) - 필요시 재귀 호호출 가능하나
    // 현재 요구사항은 "가장 왼쪽 열에 있는 텍스트"이므로 열 내부의 텍스트만 가져오면 됨
    // 열 내부 구조가 복잡할 경우(예: 내부에 또 토글이 있는 등)를 대비해 재귀 처리할 수도 있으나
    // 우선 1단계 깊이의 텍스트 블록만 수집
  }
  return textBlocks;
}

/**
 * 페이지 블록에서 텍스트 내용 추출 (EN 토글 내부만)
 */
async function extractPageText(pageId) {
  try {
    const blocks = await getPageBlocksServer(pageId);

    if (!blocks || blocks.length === 0) {
      return [];
    }

    let textBlocks = [];

    // 신규 로직: column_list 확인
    // 페이지 최상위 블록 중 첫 번째 column_list를 찾음 (이것이 EN 블록이라고 가정)
    const firstColumnList = blocks.find(b => b.type === 'column_list');

    if (firstColumnList) {
      // column_list의 자식들(columns) 가져오기
      const columns = await getBlockChildrenServer(firstColumnList.id);

      if (columns && columns.length > 0) {
        // 첫 번째 열 (가장 왼쪽 열)
        const firstColumn = columns[0];

        // 첫 번째 열의 자식들(실제 텍스트 콘텐츠) 가져오기
        const columnContent = await getBlockChildrenServer(firstColumn.id);

        if (columnContent && columnContent.length > 0) {
          textBlocks = await extractSimpleTextFromBlocks(columnContent);
        }
      }
    }

    // 신규 로직으로 텍스트를 못 찾았을 경우, 기존 로직(EN 토글/전체 텍스트) 사용
    if (textBlocks.length === 0) {
      // 1. 먼저 "EN" 표시를 찾아서 그 내부/이후 텍스트 추출 시도
      textBlocks = await extractTextFromBlocks(blocks);

      // 2. 만약 "EN" 표시를 못 찾았다면, 페이지의 모든 텍스트 블록을 그냥 가져오기 (마지막 보루)
      if (!textBlocks || textBlocks.length === 0) {
        textBlocks = [];
        const collectAllText = (blks) => {
          let result = [];
          for (const b of blks) {
            if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(b.type)) {
              const rt = b[b.type]?.rich_text || [];
              result.push(rt.length > 0 ? rt : null);
            }
          }
          return result;
        };
        textBlocks = collectAllText(blocks);
      }
    }

    // 각 블록을 문단으로 분리
    const paragraphs = [];
    for (let i = 0; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      if (!block || (Array.isArray(block) && block.length === 0)) {
        paragraphs.push(null);
      } else {
        paragraphs.push(block);
      }
    }

    return paragraphs.length > 0 ? paragraphs : [];
  } catch (error) {
    console.error('extractPageText Error:', error);
    return [];
  }
}

/**
 * WORK DB의 "Related Text" 속성에서 관련 페이지 정보 추출
 */
async function extractRelatedTextFromProperties(properties) {
  const relatedTextProperty = findProperty(
    properties,
    'Related', 'related', 'RELATED',
    'Related Text', 'related text', 'RELATED TEXT',
    'Related DB', 'related db', 'RELATED DB'
  );

  if (!relatedTextProperty || relatedTextProperty.type !== 'relation') {
    return [];
  }

  const pageIds = extractRelation(relatedTextProperty);

  // 병렬 처리로 성능 개선
  const relatedTexts = await Promise.all(pageIds.map(async (pageId) => {
    try {
      const pageInfo = await getPageInfoServer(pageId);
      if (pageInfo && pageInfo.properties) {
        // 우선 타입이 title인 속성을 찾고, 없으면 일반적인 이름으로 찾음
        const titleProperty = findTitleProperty(pageInfo.properties) ||
          findProperty(pageInfo.properties, 'title', 'Title', 'TITLE', 'Name', 'name', 'NAME', '이름');

        const title = extractText(titleProperty) || 'Untitled';

        // Type 속성 찾기 (Select)
        const typeProperty = findProperty(
          pageInfo.properties,
          'Type', 'type', 'TYPE',
          'Category', 'category', 'CATEGORY'
        );

        let typeValue = '';
        if (typeProperty) {
          if (typeProperty.type === 'select' && typeProperty.select) {
            typeValue = typeProperty.select.name;
          } else if (typeProperty.type === 'multi_select' && typeProperty.multi_select && typeProperty.multi_select.length > 0) {
            typeValue = typeProperty.multi_select[0].name;
          } else {
            typeValue = extractText(typeProperty);
          }
        }

        // 제목 포맷팅: [Type] Title
        const formattedTitle = typeValue ? `[${typeValue}] ${title.trim()}` : title.trim();

        // Content 속성 찾기 (Select type: 'Text' or 'Link')
        const contentProperty = findProperty(
          pageInfo.properties,
          'Content', 'content', 'CONTENT'
        );
        let contentValue = '';
        if (contentProperty) {
          if (contentProperty.select) {
            contentValue = contentProperty.select.name;
          } else if (contentProperty.rich_text) {
            contentValue = extractText(contentProperty);
          }
        }

        // Link 속성 찾기
        const linkProperty = findProperty(
          pageInfo.properties,
          'Link', 'link', 'LINK',
          'URL', 'url', 'Url',
          'Website', 'website', 'WEBSITE'
        );
        const link = extractText(linkProperty);

        // File 속성 찾기 (PDF 파일명)
        const fileProperty = findProperty(
          pageInfo.properties,
          'File', 'file', 'FILE',
          'Filename', 'filename', 'FILENAME',
          'File Name', 'file name', 'FILE NAME',
          'Pdf', 'pdf', 'PDF'
        );
        const fileName = extractText(fileProperty);

        // 1. Content가 'Link'인데 Link 속성이 비어있으면 -> 본문 블록에서 URL 찾기 Fallback
        let fallbackUrlFromBlocks = null;
        const normalizedContentValue = contentValue ? contentValue.trim().toLowerCase() : '';

        let contentType = 'text'; // default
        if (normalizedContentValue === 'link') contentType = 'link';
        if (normalizedContentValue === 'file') contentType = 'file';

        if (contentType === 'link' && !link) {
          try {
            // 성능을 위해 첫 5개 블록만 확인
            const blocks = await getPageBlocksServer(pageId);
            const blocksToSearch = blocks.slice(0, 5);
            for (const block of blocksToSearch) {
              if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
                const text = block.paragraph.rich_text.map(t => t.plain_text).join('');
                // URL 정규식
                const urlMatch = text.match(/https?:\/\/[^\s]+/);
                if (urlMatch) {
                  fallbackUrlFromBlocks = urlMatch[0];
                  break;
                }
              }
              if (block.type === 'bookmark' && block.bookmark) {
                fallbackUrlFromBlocks = block.bookmark.url;
                break;
              }
            }
          } catch (blockErr) {
            console.error(`[extractRelatedTextFromProperties] Block fetch failed for ${pageId}`, blockErr);
          }
        }

        // 2. Content가 'File'인데 File 속성이 비어있으면 -> 본문 블록에서 파일명 찾기 Fallback
        let fallbackFileNameFromBlocks = null;
        if (contentType === 'file' && !fileName) {
          try {
            // 성능을 위해 첫 5개 블록만 확인
            const blocks = await getPageBlocksServer(pageId);
            const blocksToSearch = blocks.slice(0, 5);
            for (const block of blocksToSearch) {
              // Case A: File Block (Notion File Upload)
              if (block.type === 'file' || block.type === 'pdf') {
                const fileObj = block[block.type];
                if (fileObj) {
                  // 파일 이름 추출
                  if (fileObj.name) {
                    fallbackFileNameFromBlocks = fileObj.name;
                  } else if (fileObj.file && fileObj.file.url) {
                    // URL에서 추출
                    try {
                      const urlObj = new URL(fileObj.file.url);
                      const pathname = urlObj.pathname; // /something/filename.pdf
                      fallbackFileNameFromBlocks = decodeURIComponent(pathname.split('/').pop());
                    } catch (e) { }
                  } else if (fileObj.external && fileObj.external.url) {
                    try {
                      const urlObj = new URL(fileObj.external.url);
                      const pathname = urlObj.pathname;
                      fallbackFileNameFromBlocks = decodeURIComponent(pathname.split('/').pop());
                    } catch (e) { }
                  }
                  if (fallbackFileNameFromBlocks) break;
                }
              }
              // Case B: Text Block containing filename (if user just typed it) - Optional, but let's stick to file blocks first.
            }
          } catch (blockErr) {
            console.error(`[extractRelatedTextFromProperties] Block fetch failed for File ${pageId}`, blockErr);
          }
        }

        const effectiveFileName = fileName ? fileName.trim() : fallbackFileNameFromBlocks;

        const effectiveLink = link ? link.trim() : fallbackUrlFromBlocks;
        let finalUrl = null;

        if (contentType === 'link') {
          finalUrl = effectiveLink;
        } else if (contentType === 'text' || contentType === 'file') {
          finalUrl = null; // 내부 페이지로 이동
        } else {
          // Fallback
          finalUrl = effectiveLink;
        }

        // 정렬을 위한 Index 속성 추출
        const indexProperty = findProperty(
          pageInfo.properties,
          'Index', 'index', 'INDEX',
          'Order', 'order', 'ORDER',
          'No', 'no', 'NO'
        );
        const indexValue = extractNumber(indexProperty);

        return {
          pageId: pageId,
          title: formattedTitle,
          rawTitle: title.trim(),
          type: typeValue,
          url: finalUrl,
          index: indexValue !== null ? indexValue : 9999, // Index 없으면 맨 뒤로
          contentType: contentType,
          fileName: effectiveFileName
        };
      }
    } catch (error) {
      console.error(`[extractRelatedTextFromProperties] 페이지 정보 가져오기 실패 (${pageId}):`, error);
      return null;
    }
  }));

  // 유효한 결과만 필터링하고 Index 기준으로 정렬
  return relatedTexts
    .filter(item => item !== null)
    .sort((a, b) => a.index - b.index);
}

/**
 * slug로 Basic Exhibition 상세 데이터 가져오기 (텍스트, 이미지 등 핵심 정보만)
 */
export async function getExhibitionBasicBySlug(slug) {
  return await getExhibitionBySlug(slug, true); // true = basic mode
}

/**
 * slug로 Secondary Exhibition 데이터 가져오기 (Related Text, Artworks)
 */
export async function getExhibitionSecondaryData(slug) {
  try {
    const workData = await getWORKDataServer();

    // WORK DB에서 Exhibition 클래스 항목만 필터링 (최적화를 위해 getExhibitionBySlug 로직 일부 중복 허용)
    const exhibitionFiltered = workData.filter(item => {
      const properties = item.properties || {};
      const classProperty = findProperty(
        properties,
        'Class', 'class', 'CLASS',
        'Type', 'type', 'TYPE',
        'Category', 'category', 'CATEGORY'
      );

      if (!classProperty) {
        return false;
      }

      const classValue = extractText(classProperty);
      const normalizedClass = classValue ? classValue.toUpperCase().trim() : '';

      return normalizedClass === 'SOLO EXHIBITION' || normalizedClass === 'GROUP EXHIBITION';
    });

    // slug와 일치하는 항목 찾기
    const matchingItem = exhibitionFiltered.find(item => {
      const detail = extractExhibitionDetail(item);
      const itemSlug = createSlug(detail.name);
      return itemSlug === slug;
    });

    if (!matchingItem) {
      return { relatedTexts: [], artworks: [] };
    }

    const detail = extractExhibitionDetail(matchingItem);

    // WORK DB의 "Related Text" 속성에서 관련 페이지 정보 추출
    let relatedTexts = [];
    try {
      relatedTexts = await extractRelatedTextFromProperties(matchingItem.properties);
    } catch (error) {
      // Related Text 추출 실패 시 빈 배열 유지
    }

    // 해당 전시의 작품 목록 가져오기
    const artworks = await getArtworksByExhibition(matchingItem.id, detail.name);

    return {
      relatedTexts,
      artworks: artworks || []
    };
  } catch (error) {
    console.error('Exhibition Secondary 데이터 로드 오류:', error);
    return { relatedTexts: [], artworks: [] };
  }
}

/**
 * Related Text 페이지 내용 가져오기
 */
export async function getRelatedTextPage(pageId) {
  try {
    const blocks = await getPageBlocksServer(pageId);
    if (!blocks || blocks.length === 0) {
      return null;
    }

    // 페이지 제목 가져오기 (페이지 속성에서)
    // 블록에서 텍스트 추출
    // 블록에서 텍스트 추출 (EN 토글 우선)
    let textBlocks = await extractTextFromBlocks(blocks);

    // Fallback: EN 토글이나 텍스트를 못 찾았을 경우, 페이지의 모든 텍스트 블록 가져오기
    if (!textBlocks || textBlocks.length === 0) {
      const collectAllText = (blks) => {
        let result = [];
        for (const b of blks) {
          if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(b.type)) {
            const rt = b[b.type]?.rich_text || [];
            result.push(rt.length > 0 ? rt : null);
          }
        }
        return result;
      };
      textBlocks = collectAllText(blocks);
    }

    // 페이지 제목은 첫 번째 블록에서 추출하거나 별도로 처리 필요
    // 일단 블록 내용만 반환
    const paragraphs = [];

    for (let i = 0; i < textBlocks.length; i++) {
      const block = textBlocks[i];

      if (!block || (Array.isArray(block) && block.length === 0)) {
        paragraphs.push(null);
      } else if (Array.isArray(block)) {
        paragraphs.push(block);
      } else {
        const isEmpty = !block || block.trim() === '';
        paragraphs.push(isEmpty ? null : block);
      }
    }

    return {
      pageId: pageId,
      content: paragraphs
    };
  } catch (error) {
    console.error('Related Text 페이지 내용 추출 오류:', error);
    return null;
  }
}

/**
 * 전시 이름으로 ARTWORK DB에서 작품 목록 가져오기
 */
/**
 * 문자열 정규화 함수 (공백, 대소문자, 특수문자 정규화)
 * 콤마, 콜론, 하이픈 등을 제거하여 매칭 정확도 향상
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/,/g, '') // 콤마 제거
    .replace(/[:\-]/g, ' ') // 콜론과 하이픈을 공백으로
    .replace(/\s+/g, ' ') // 여러 공백을 하나로
    .trim();
}

async function getArtworksByExhibition(exhibitionId, exhibitionName) {
  try {
    const artworkData = await getARTWORKDataServer();

    if (!exhibitionId) {
      // ID가 없으면 빈 배열 반환
      return [];
    }

    const targetId = exhibitionId.replaceAll('-', '');

    // 모든 작품의 Exhibition 속성 값 확인
    const allExhibitionValues = new Set();
    artworkData.forEach(item => {
      const properties = item.properties || {};
      const exhibitionProperty = findProperty(
        properties,
        'Exhibition', 'exhibition', 'EXHIBITION'
      );

      if (exhibitionProperty) {
        if (exhibitionProperty.type === 'multi_select' && exhibitionProperty.multi_select) {
          exhibitionProperty.multi_select.forEach(select => {
            if (select && select.name) {
              allExhibitionValues.add(select.name);
            }
          });
        } else if (exhibitionProperty.type === 'select' && exhibitionProperty.select) {
          if (exhibitionProperty.select.name) {
            allExhibitionValues.add(exhibitionProperty.select.name);
          }
        } else {
          const value = extractText(exhibitionProperty);
          if (value) {
            allExhibitionValues.add(value);
          }
        }
      }
    });

    // ARTWORK DB에서 Exhibition 속성(Relation)이 해당 전시 ID와 일치하는 작품 필터링
    const matchingArtworks = artworkData.filter(item => {
      const properties = item.properties || {};
      const exhibitionProperty = findProperty(
        properties,
        'Exhibition', 'exhibition', 'EXHIBITION'
      );

      const relationIds = extractRelation(exhibitionProperty);

      if (relationIds.length > 0) {
        // relationId도 하이픈 제거 후 비교
        const hasMatch = relationIds.some(id => id.replaceAll('-', '') === targetId);
        if (hasMatch) return true;
      }

      return false;
    });

    // 작품 데이터 추출
    const artworks = matchingArtworks.map(item => {
      const properties = item.properties || {};

      const nameProperty = findProperty(
        properties,
        'Name', 'name', 'NAME',
        'Title', 'title', 'TITLE'
      );
      const name = extractText(nameProperty);

      const artistProperty = findProperty(
        properties,
        'Artist', 'artist', 'ARTIST',
        'Author', 'author', 'AUTHOR'
      );
      const artist = extractText(artistProperty);

      const dimensionProperty = findProperty(
        properties,
        'Dimension', 'dimension', 'DIMENSION',
        'Size', 'size', 'SIZE',
        'Dimensions', 'dimensions', 'DIMENSIONS'
      );
      const dimension = extractText(dimensionProperty);

      const captionProperty = findProperty(
        properties,
        'Caption', 'caption', 'CAPTION'
      );
      const caption = extractText(captionProperty);

      return {
        name,
        artist,
        dimension,
        caption,
        slug: createSlug(name),
        pageId: item.id
      };
    }).filter(artwork => artwork.name); // 이름이 있는 작품만

    return artworks;
  } catch (error) {
    console.error('전시 작품 목록 로드 오류:', error);
    return [];
  }
}

/**
 * slug로 Exhibition 상세 데이터 가져오기
 */
export async function getExhibitionBySlug(slug, isBasicOnly = false) {
  try {
    const workData = await getWORKDataServer();

    // WORK DB에서 Exhibition 클래스 항목만 필터링
    const exhibitionFiltered = workData.filter(item => {
      const properties = item.properties || {};
      const classProperty = findProperty(
        properties,
        'Class', 'class', 'CLASS',
        'Type', 'type', 'TYPE',
        'Category', 'category', 'CATEGORY'
      );

      if (!classProperty) {
        return false;
      }

      const classValue = extractText(classProperty);
      const normalizedClass = classValue ? classValue.toUpperCase().trim() : '';

      // SOLO EXHIBITION 또는 GROUP EXHIBITION인지 확인
      return normalizedClass === 'SOLO EXHIBITION' || normalizedClass === 'GROUP EXHIBITION';
    });

    // slug와 일치하는 항목 찾기
    const matchingItem = exhibitionFiltered.find(item => {
      const detail = extractExhibitionDetail(item);
      const itemSlug = createSlug(detail.name);
      return itemSlug === slug;
    });

    if (!matchingItem) {
      return null;
    }

    const detail = extractExhibitionDetail(matchingItem);

    // 블록 데이터 가져오기
    const blocks = await getPageBlocksServer(matchingItem.id);

    // 텍스트 추출
    let pageText = await extractPageText(matchingItem.id);

    // 이미지 추출 (신규 로직)
    let images = await extractImagesFromBlocks(blocks);

    // 블록 이미지가 없으면 기존 Image 필드 데이터 사용
    if (images.length === 0) {
      images = detail.images;
    } else {
      // 경로 수정
      const basePath = '';
      images = images.map(img => ({
        ...img,
        path: `${basePath}/assets/images/${img.filename}`
      }));
    }

    // pageText가 비어있고 description이 있으면 description을 사용 (fallback)
    if ((!pageText || pageText.length === 0) && detail.description) {
      const descriptionLines = detail.description.split('\n').filter(line => line.trim() !== '');
      pageText = descriptionLines.map(line => {
        return [{ plain_text: line.trim(), annotations: {} }];
      });
    }

    // Basic 모드일 경우 Related Text와 Artworks는 건너뛰거나 빈 배열 반환
    let relatedTexts = [];
    let artworks = [];

    if (!isBasicOnly) {
      // WORK DB의 "Related Text" 속성에서 관련 페이지 정보 추출
      try {
        relatedTexts = await extractRelatedTextFromProperties(matchingItem.properties);
      } catch (error) {
        // Related Text 추출 실패 시 빈 배열 유지
      }

      // 해당 전시의 작품 목록 가져오기
      artworks = await getArtworksByExhibition(detail.name);
    }

    return {
      ...detail,
      pageText,
      images, // 업데이트된 이미지 목록 사용
      relatedTexts,
      artworks: artworks || [], // 항상 배열로 보장
      slug: createSlug(detail.name)
    };
  } catch (error) {
    console.error('Exhibition 상세 데이터 로드 오류:', error);
    return null;
  }
}

/**
 * 모든 Exhibition의 slug 목록 가져오기 (getStaticPaths용)
 */
export async function getAllExhibitionSlugs() {
  try {
    const workData = await getWORKDataServer();

    // WORK DB에서 Exhibition 클래스 항목만 필터링
    const exhibitionFiltered = workData.filter(item => {
      const properties = item.properties || {};
      const classProperty = findProperty(
        properties,
        'Class', 'class', 'CLASS',
        'Type', 'type', 'TYPE',
        'Category', 'category', 'CATEGORY'
      );

      if (!classProperty) {
        return false;
      }

      const classValue = extractText(classProperty);
      const normalizedClass = classValue ? classValue.toUpperCase().trim() : '';

      return normalizedClass === 'SOLO EXHIBITION' || normalizedClass === 'GROUP EXHIBITION';
    });

    const slugs = exhibitionFiltered
      .map(item => {
        const detail = extractExhibitionDetail(item);
        return createSlug(detail.name);
      })
      .filter(slug => slug); // 빈 slug 제거

    return slugs;
  } catch (error) {
    console.error('Exhibition slug 목록 로드 오류:', error);
    return [];
  }
}
