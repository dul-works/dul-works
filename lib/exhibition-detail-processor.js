// Exhibition 상세 페이지 데이터 처리 유틸리티

import { getWORKDataServer, getARTWORKDataServer, getPageBlocksServer, getPageInfoServer } from './notion-api-server.js';
import { extractText, extractDate, findProperty, extractRelation, findTitleProperty, extractNumber } from './notion-utils.js';
import { extractImagesFromImageField, extractImagesFromBlocks, extractTextFromBlocks, extractSimpleTextFromBlocks, extractPageText, withDescriptionFallback } from './notion-blocks.js';
import { isExhibitionItem } from './exhibition-processor.js';
import { createSlug } from './slug-utils.js';

/**
 * Exhibition 항목에서 상세 데이터 추출
 */
function extractExhibitionDetail(item) {
  const properties = item.properties || {};

  const name = extractText(findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  ));

  const period = extractDate(findProperty(
    properties,
    'Period', 'period', 'PERIOD',
    'Date', 'date', 'DATE',
    'Year', 'year', 'YEAR',
    'Time', 'time', 'TIME'
  ));

  const description = extractText(findProperty(
    properties,
    'Description EN', 'description en', 'Description En', 'Description en',
    'DESCRIPTION EN', 'DescriptionEN', 'descriptionEN',
    'Description', 'description', 'DESCRIPTION'
  ));

  // Image 필드에서 이미지 목록 추출 (poster로 시작하는 파일은 1-1 위치)
  const images = extractImagesFromImageField(
    extractText(findProperty(properties, 'Image', 'image', 'IMAGE')),
    { posterFirst: true }
  );

  return {
    name,
    period,
    description,
    images,
    pageId: item.id
  };
}

/**
 * WORK DB에서 slug와 일치하는 전시 항목 찾기
 */
async function findExhibitionBySlug(slug) {
  const workData = await getWORKDataServer();
  return workData.find(item => isExhibitionItem(item) && createSlug(extractExhibitionDetail(item).name) === slug);
}

// 파일 URL에서 파일명 추출
function fileNameFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop());
  } catch (e) {
    return null;
  }
}

// 본문 첫 5개 블록에서 URL 찾기 (paragraph 텍스트 또는 bookmark)
function findUrlInBlocks(blocks) {
  for (const block of blocks.slice(0, 5)) {
    if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
      const urlMatch = block.paragraph.rich_text.map(t => t.plain_text).join('').match(/https?:\/\/[^\s]+/);
      if (urlMatch) return urlMatch[0];
    }
    if (block.type === 'bookmark' && block.bookmark) {
      return block.bookmark.url;
    }
  }
  return null;
}

// 본문 첫 5개 블록에서 파일(file/pdf 블록) 이름 찾기
function findFileNameInBlocks(blocks) {
  for (const block of blocks.slice(0, 5)) {
    if (block.type !== 'file' && block.type !== 'pdf') continue;
    const fileObj = block[block.type];
    if (!fileObj) continue;
    const url = fileObj.file?.url || fileObj.external?.url;
    const name = fileObj.name || (url ? fileNameFromUrl(url) : null);
    if (name) return name;
  }
  return null;
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

  const relatedTexts = await Promise.all(extractRelation(relatedTextProperty).map(async (pageId) => {
    try {
      const pageInfo = await getPageInfoServer(pageId);
      if (!pageInfo || !pageInfo.properties) return null;
      const props = pageInfo.properties;

      // 우선 타입이 title인 속성을 찾고, 없으면 일반적인 이름으로 찾음
      const titleProperty = findTitleProperty(props) ||
        findProperty(props, 'title', 'Title', 'TITLE', 'Name', 'name', 'NAME', '이름');
      const title = extractText(titleProperty) || 'Untitled';

      // Type 속성 (Select)
      const typeProperty = findProperty(props, 'Type', 'type', 'TYPE', 'Category', 'category', 'CATEGORY');
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

      // Content 속성 (Select: 'Text' | 'Link' | 'File')
      const contentProperty = findProperty(props, 'Content', 'content', 'CONTENT');
      let contentValue = '';
      if (contentProperty) {
        if (contentProperty.select) {
          contentValue = contentProperty.select.name;
        } else if (contentProperty.rich_text) {
          contentValue = extractText(contentProperty);
        }
      }
      const normalizedContentValue = contentValue ? contentValue.trim().toLowerCase() : '';
      let contentType = 'text';
      if (normalizedContentValue === 'link') contentType = 'link';
      if (normalizedContentValue === 'file') contentType = 'file';

      const link = extractText(findProperty(
        props,
        'Link', 'link', 'LINK',
        'URL', 'url', 'Url',
        'Website', 'website', 'WEBSITE'
      ));

      // File 속성 (PDF 파일명)
      const fileName = extractText(findProperty(
        props,
        'File', 'file', 'FILE',
        'Filename', 'filename', 'FILENAME',
        'File Name', 'file name', 'FILE NAME',
        'Pdf', 'pdf', 'PDF'
      ));

      // Link/File 속성이 비어있으면 본문 블록에서 찾기 (Fallback)
      let finalUrl = null; // text/file은 내부 페이지로 이동
      if (contentType === 'link') {
        finalUrl = link ? link.trim() : null;
        if (!link) {
          try {
            finalUrl = findUrlInBlocks(await getPageBlocksServer(pageId));
          } catch (blockErr) {
            console.error(`[extractRelatedTextFromProperties] Block fetch failed for ${pageId}`, blockErr);
          }
        }
      }

      let effectiveFileName = fileName ? fileName.trim() : null;
      if (contentType === 'file' && !fileName) {
        try {
          effectiveFileName = findFileNameInBlocks(await getPageBlocksServer(pageId));
        } catch (blockErr) {
          console.error(`[extractRelatedTextFromProperties] Block fetch failed for File ${pageId}`, blockErr);
        }
      }

      // 정렬을 위한 Index 속성
      const indexValue = extractNumber(findProperty(
        props,
        'Index', 'index', 'INDEX',
        'Order', 'order', 'ORDER',
        'No', 'no', 'NO'
      ));

      return {
        pageId,
        title: typeValue ? `[${typeValue}] ${title.trim()}` : title.trim(), // [Type] Title
        rawTitle: title.trim(),
        type: typeValue,
        url: finalUrl,
        index: indexValue !== null ? indexValue : 9999, // Index 없으면 맨 뒤로
        contentType,
        fileName: effectiveFileName
      };
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
 * 전시 ID와 Relation으로 연결된 ARTWORK DB 작품 목록
 */
async function getArtworksByExhibition(exhibitionId) {
  try {
    const artworkData = await getARTWORKDataServer();
    const targetId = exhibitionId.replaceAll('-', '');

    return artworkData
      .filter(item => {
        const relationIds = extractRelation(findProperty(item.properties || {}, 'Exhibition', 'exhibition', 'EXHIBITION'));
        return relationIds.some(id => id.replaceAll('-', '') === targetId);
      })
      .map(item => {
        const properties = item.properties || {};
        const name = extractText(findProperty(properties, 'Name', 'name', 'NAME', 'Title', 'title', 'TITLE'));
        return {
          name,
          artist: extractText(findProperty(properties, 'Artist', 'artist', 'ARTIST', 'Author', 'author', 'AUTHOR')),
          dimension: extractText(findProperty(
            properties,
            'Dimension', 'dimension', 'DIMENSION',
            'Size', 'size', 'SIZE',
            'Dimensions', 'dimensions', 'DIMENSIONS'
          )),
          caption: extractText(findProperty(properties, 'Caption', 'caption', 'CAPTION')),
          slug: createSlug(name),
          pageId: item.id
        };
      })
      .filter(artwork => artwork.name); // 이름이 있는 작품만
  } catch (error) {
    console.error('전시 작품 목록 로드 오류:', error);
    return [];
  }
}

/**
 * Related Text와 작품 목록 (Secondary 데이터)
 */
async function loadSecondary(item) {
  let relatedTexts = [];
  try {
    relatedTexts = await extractRelatedTextFromProperties(item.properties);
  } catch (error) {
    // Related Text 추출 실패 시 빈 배열 유지
  }
  const artworks = await getArtworksByExhibition(item.id);
  return { relatedTexts, artworks };
}

/**
 * slug로 Basic Exhibition 상세 데이터 가져오기 (텍스트, 이미지 등 핵심 정보만)
 */
export async function getExhibitionBasicBySlug(slug) {
  return getExhibitionBySlug(slug, true);
}

/**
 * slug로 Secondary Exhibition 데이터 가져오기 (Related Text, Artworks)
 */
export async function getExhibitionSecondaryData(slug) {
  try {
    const matchingItem = await findExhibitionBySlug(slug);
    if (!matchingItem) {
      return { relatedTexts: [], artworks: [] };
    }
    return await loadSecondary(matchingItem);
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

    // EN 토글 우선, 못 찾으면 페이지의 모든 텍스트 블록
    let content = await extractTextFromBlocks(blocks);
    if (content.length === 0) {
      content = extractSimpleTextFromBlocks(blocks);
    }

    return { pageId, content };
  } catch (error) {
    console.error('Related Text 페이지 내용 추출 오류:', error);
    return null;
  }
}

/**
 * slug로 Exhibition 상세 데이터 가져오기
 */
export async function getExhibitionBySlug(slug, isBasicOnly = false) {
  try {
    const matchingItem = await findExhibitionBySlug(slug);
    if (!matchingItem) {
      return null;
    }

    const detail = extractExhibitionDetail(matchingItem);

    // 블록 데이터는 한 번만 가져와서 텍스트·이미지 추출에 함께 사용
    const blocks = await getPageBlocksServer(matchingItem.id);
    const pageText = withDescriptionFallback(await extractPageText(blocks), detail.description);

    // 블록 이미지가 없으면 기존 Image 필드 데이터 사용
    let images = await extractImagesFromBlocks(blocks);
    if (images.length === 0) {
      images = detail.images;
    }

    // Basic 모드일 경우 Related Text와 Artworks는 빈 배열
    const { relatedTexts, artworks } = isBasicOnly
      ? { relatedTexts: [], artworks: [] }
      : await loadSecondary(matchingItem);

    return {
      ...detail,
      pageText,
      images,
      relatedTexts,
      artworks,
      slug: createSlug(detail.name)
    };
  } catch (error) {
    console.error('Exhibition 상세 데이터 로드 오류:', error);
    return null;
  }
}
