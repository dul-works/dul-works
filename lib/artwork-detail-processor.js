// Artwork 상세 페이지 데이터 처리 유틸리티

import { getARTWORKDataServer, getPageBlocksServer } from './notion-api-server.js';
import { extractText, findProperty, extractRelation, getBlockImage, getCoverImageUrl } from './notion-utils.js';
import { extractImagesFromImageField, extractImagesFromBlocks, extractPageText, withDescriptionFallback } from './notion-blocks.js';
import { createSlug } from './slug-utils.js';

const NAME_FIELDS = ['Name', 'name', 'NAME', 'Title', 'title', 'TITLE'];

/**
 * Artwork 항목에서 대표 이미지 URL 추출
 * blocks: getPageBlocksServer로 이미 가져온 최상위 블록 배열
 */
function extractImageFromArtwork(item, blocks) {
  for (const block of blocks) {
    if (block.type !== 'image') continue;
    const blockImage = getBlockImage(block.image);
    if (blockImage) return blockImage.path;
  }

  // 블록에서 이미지를 못 찾으면 cover 이미지 확인
  return getCoverImageUrl(item);
}

/**
 * Artwork 항목에서 상세 데이터 추출
 */
function extractArtworkDetail(item) {
  const properties = item.properties || {};

  const name = extractText(findProperty(properties, ...NAME_FIELDS));

  const timeline = extractText(findProperty(
    properties,
    'Timeline', 'timeline', 'TIMELINE',
    'Date', 'date', 'DATE',
    'Time', 'time', 'TIME',
    'Year', 'year', 'YEAR',
    'Period', 'period', 'PERIOD'
  ));

  const dimension = extractText(findProperty(
    properties,
    'Dimension', 'dimension', 'DIMENSION',
    'Size', 'size', 'SIZE'
  ));

  const description = extractText(findProperty(
    properties,
    'Description', 'description', 'DESCRIPTION',
    'Description EN', 'description en', 'Description En', 'Description en'
  ));

  const artist = extractText(findProperty(
    properties,
    'Artist', 'artist', 'ARTIST',
    'Author', 'author', 'AUTHOR'
  ));

  const caption = extractText(findProperty(properties, 'Caption', 'caption', 'CAPTION'));

  // Image 필드에서 이미지 목록 추출 (Legacy Fallback)
  const images = extractImagesFromImageField(extractText(findProperty(properties, 'Image', 'image', 'IMAGE')));

  // Exhibition Relation ID 배열
  const exhibitionIds = extractRelation(findProperty(
    properties,
    'Exhibition', 'exhibition', 'EXHIBITION',
    'Exhibitions', 'exhibitions', 'EXHIBITIONS'
  ));

  return {
    name,
    timeline,
    dimension,
    description,
    artist,
    caption,
    images,
    exhibitionIds,
    pageId: item.id
  };
}

/**
 * slug로 Artwork 상세 데이터 가져오기
 */
export async function getArtworkBySlug(slug) {
  try {
    const artworkData = await getARTWORKDataServer();

    const matchingItem = artworkData.find(item =>
      createSlug(extractText(findProperty(item.properties || {}, ...NAME_FIELDS))) === slug
    );
    if (!matchingItem) {
      return null;
    }

    const detail = extractArtworkDetail(matchingItem);

    // 블록 데이터는 한 번만 가져와서 대표 이미지·텍스트·이미지 목록 추출에 함께 사용
    const blocks = await getPageBlocksServer(matchingItem.id);
    const imageUrl = extractImageFromArtwork(matchingItem, blocks);
    const pageText = withDescriptionFallback(await extractPageText(blocks), detail.description);

    // 블록 이미지가 없으면 기존 Image 필드 데이터 사용 (Fallback)
    let images = await extractImagesFromBlocks(blocks);
    if (images.length === 0) {
      images = detail.images;
    }

    return {
      ...detail,
      imageUrl,
      pageText,
      images,
      slug: createSlug(detail.name)
    };
  } catch (error) {
    return null;
  }
}
