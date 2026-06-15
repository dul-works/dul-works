// Artwork 상세 페이지 데이터 처리 유틸리티

import { getARTWORKDataServer } from './notion-api-server.js';
import { getPageBlocksServer, getBlockChildrenServer } from './notion-api-server.js';
import { extractText, findProperty, extractRelation } from './notion-utils.js';
import { createSlug } from './slug-utils.js';

/**
 * Artwork 항목에서 이미지 URL 추출
 */
async function extractImageFromArtwork(item) {
  const pageId = item.id;

  // 페이지의 블록 가져오기
  const blocks = await getPageBlocksServer(pageId);
  let imageUrl = null;

  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      if (block.type === 'image') {
        const image = block.image;
        if (image) {
          if (image.file) {
            imageUrl = image.file.url;
          } else if (image.external) {
            imageUrl = image.external.url;
          }
        }
        if (imageUrl) break;
      }
    }
  }

  // 블록에서 이미지를 못 찾으면 cover 이미지 확인
  if (!imageUrl && item.cover) {
    if (item.cover.file) {
      imageUrl = item.cover.file.url;
    } else if (item.cover.external) {
      imageUrl = item.cover.external.url;
    }
  }

  return imageUrl;
}

/**
 * 이미지 파일명에서 위치 정보 추출
 * 예: artwork-newborn-space-v200-1-1.jpg -> { column: 1, row: 1 }
 * 파일명 끝에 있는 -숫자-숫자 패턴을 찾음
 */
function parseImagePosition(filename) {
  // 파일명에서 마지막 -숫자-숫자.확장자 패턴 찾기
  // 예: artwork-newborn-space-v200-1-1.jpg -> -1-1 추출
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
 */
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
      const col2Images = await extractImagesFromColumnBlocks(col2Blocks, 1); // 1 = Frontend Col 1
      images.push(...col2Images);
    }

    // 3번째 열 (Index 2) -> Frontend Column 2
    if (columns.length > 2) {
      const col3 = columns[2];
      const col3Blocks = await getBlockChildrenServer(col3.id);
      const col3Images = await extractImagesFromColumnBlocks(col3Blocks, 2); // 2 = Frontend Col 2
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
        // 캡션에서 파일명 추출 시도 (없으면 URL 해싱 또는 임의 생성 필요하나, 
        // 기존 시스템이 로컬 파일을 기대하므로 최대한 캡션/URL 활용)
        const caption = image.caption && image.caption.length > 0 ? image.caption[0].plain_text : '';
        let filename = caption.trim();

        // 캡션이 없으면 URL에서 추출
        if (!filename) {
          try {
            const urlObj = new URL(imageUrl);
            const pathname = urlObj.pathname;
            filename = pathname.split('/').pop();
          } catch (e) {
            filename = `image-${Date.now()}.jpg`;
          }
        }

        // 확장자 확인
        if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          filename += '.jpg'; // 기본 확장자
        }

        images.push({
          filename: filename,
          path: imageUrl, // 우선 URL 저장 (추후 download script와 연동 필요)
          // 기존 Frontend는 path가 로컬 경로(/assets/...)를 기대함. 
          // download-images.js가 실행되지 않은 상태라면 Notion URL을 직접 써야 할 수도 있음.
          // 하지만 User Request는 "방식 수정"이므로, 우선 URL을 추출.
          // *중요*: 기존 컴포넌트(Image)는 'src'에 도메인이 허용되어야 함.
          // 일단 path에 Notion URL을 넣으면 next/image 설정이 없으면 에러남.
          // 하지만 여기선 추출 로직만 변경.
          column: frontendColumnIndex,
          row: 0 // Row는 자동 정렬됨
        });
      }
    }

    // 중첩 구조 지원 (필요 시)
    if (block.has_children) {
      // 재귀 호출은 생략 (일반적으로 이미지는 최상위에 배치)
    }
  }

  return images;
}

/**
 * Image 필드에서 이미지 목록 추출 및 정렬 (Legacy Support/Fallback)
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
 * Artwork 항목에서 상세 데이터 추출
 */
function extractArtworkDetail(item) {
  const properties = item.properties || {};

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  const projectProperty = findProperty(
    properties,
    'Project', 'project', 'PROJECT'
  );
  const project = extractText(projectProperty);

  const timelineProperty = findProperty(
    properties,
    'Timeline', 'timeline', 'TIMELINE',
    'Date', 'date', 'DATE',
    'Time', 'time', 'TIME',
    'Year', 'year', 'YEAR',
    'Period', 'period', 'PERIOD'
  );
  const timeline = extractText(timelineProperty);

  const dimensionProperty = findProperty(
    properties,
    'Dimension', 'dimension', 'DIMENSION',
    'Size', 'size', 'SIZE'
  );
  const dimension = extractText(dimensionProperty);

  const descriptionProperty = findProperty(
    properties,
    'Description', 'description', 'DESCRIPTION',
    'Description EN', 'description en', 'Description En', 'Description en'
  );
  const description = extractText(descriptionProperty);

  const artistProperty = findProperty(
    properties,
    'Artist', 'artist', 'ARTIST',
    'Author', 'author', 'AUTHOR'
  );
  const artist = extractText(artistProperty);

  const captionProperty = findProperty(
    properties,
    'Caption', 'caption', 'CAPTION'
  );
  const caption = extractText(captionProperty);

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

  // Exhibition Relation 추출
  const exhibitionProperty = findProperty(
    properties,
    'Exhibition', 'exhibition', 'EXHIBITION',
    'Exhibitions', 'exhibitions', 'EXHIBITIONS'
  );
  // Relation ID 배열 추출
  const exhibitionIds = exhibitionProperty ? extractRelation(exhibitionProperty) : [];

  return {
    name,
    project,
    timeline,
    dimension,
    description,
    artist,
    caption,
    images,
    exhibitionIds, // Relation IDs 추가
    pageId: item.id
  };
}

/**
 * 블록에서 텍스트 추출 (재귀적으로 모든 블록 탐색)
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
 * 페이지 블록에서 텍스트 내용 추출
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
 * slug로 Artwork 상세 데이터 가져오기
 */
export async function getArtworkBySlug(slug) {
  try {
    const artworkData = await getARTWORKDataServer();

    // slug와 일치하는 항목 찾기
    const matchingItem = artworkData.find(item => {
      const detail = extractArtworkDetail(item);
      const itemSlug = createSlug(detail.name);
      return itemSlug === slug;
    });

    if (!matchingItem) {
      return null;
    }

    const detail = extractArtworkDetail(matchingItem);
    const imageUrl = await extractImageFromArtwork(matchingItem);

    // 블록 데이터 가져오기 (텍스트와 이미지 추출용)
    const blocks = await getPageBlocksServer(matchingItem.id);

    // 텍스트 추출 (Blocks 전달 최적화가 안되어 있으니 기존 함수 활용... 하려 했으나
    // extractPageText가 내부에서 getPageBlocksServer를 또 부름. 성능 낭비지만 우선 기능 구현 집중)
    let pageText = await extractPageText(matchingItem.id);

    // 이미지 추출 (신규 로직)
    let images = await extractImagesFromBlocks(blocks);

    // 블록 이미지가 없으면 기존 Image 필드 데이터 사용 (Fallback)
    if (images.length === 0) {
      images = detail.images;
    } else {
      // 경로 수정 (로컬 assets 경로로 변환)
      // 다운로더가 실행되어 파일이 존재한다고 가정
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

    return {
      ...detail,
      imageUrl,
      pageText,
      images, // 블록에서 추출한 이미지 또는 Fallback 이미지
      slug: createSlug(detail.name)
    };
  } catch (error) {
    return null;
  }
}

/**
 * 모든 Artwork의 slug 목록 가져오기 (getStaticPaths용)
 */
export async function getAllArtworkSlugs() {
  try {
    const artworkData = await getARTWORKDataServer();

    const slugs = artworkData
      .map(item => {
        const detail = extractArtworkDetail(item);
        return createSlug(detail.name);
      })
      .filter(slug => slug); // 빈 slug 제거

    return slugs;
  } catch (error) {
    return [];
  }
}
