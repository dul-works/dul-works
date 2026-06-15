// Work 데이터 처리 유틸리티

import { extractText, extractNumber, extractDate, findProperty, extractCheckbox } from './notion-utils.js';

/**
 * Work 항목에서 프로젝트 데이터 추출
 */
export function extractProjectData(item) {
  const properties = item.properties || {};

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  /* Index 추출 */
  const indexProperty = findProperty(
    properties,
    'Index', 'index', 'INDEX',
    'Order', 'order', 'ORDER',
    'Number', 'number', 'NUMBER'
  );
  // Index를 숫자로 추출 (정수 하나)
  const index = extractNumber(indexProperty);

  /* Period 추출 */
  const periodProperty = findProperty(
    properties,
    'Period', 'period', 'PERIOD',
    'Date', 'date', 'DATE',
    'Year', 'year', 'YEAR',
    'Time', 'time', 'TIME'
  );
  const period = extractDate(periodProperty);

  /* Description 추출 */
  const descriptionProperty = findProperty(
    properties,
    'Description EN', 'description en', 'Description En', 'Description en',
    'DESCRIPTION EN', 'DescriptionEN', 'descriptionEN',
    'Description', 'description', 'DESCRIPTION'
  );
  const description = extractText(descriptionProperty);

  /* Current Checkbox 추출 */
  const currentProperty = findProperty(
    properties,
    'Current', 'current', 'CURRENT'
  );
  const isCurrent = extractCheckbox(currentProperty);

  /* Post Checkbox 추출 */
  const postProperty = findProperty(
    properties,
    'Post', 'post', 'POST'
  );
  const isPost = extractCheckbox(postProperty);

  return {
    id: item.id,
    name: name || null,
    index: index !== null && !isNaN(index) ? index : null,
    period: period || '',
    description: description || '',
    current: isCurrent,
    post: isPost
  };
}

/**
 * Work 데이터에서 PROJECT 클래스 항목만 필터링 및 정렬
 */
export function processWorkData(workData) {
  const projectItems = workData
    .filter(item => {
      const properties = item.properties || {};
      const classProperty = findProperty(
        properties,
        'Class', 'class', 'CLASS',
        'Type', 'type', 'TYPE',
        'Category', 'category', 'CATEGORY'
      );

      if (!classProperty) return false;

      const classValue = extractText(classProperty);
      return classValue.toUpperCase() === 'PROJECT';
    })
    .map(extractProjectData)
    .filter(item => item.name !== null)
    .filter(item => item.post === true);

  // Index 기준으로 오름차순 정렬 (1, 2, 3... 순서)
  // Index가 없는 항목은 맨 뒤로
  projectItems.sort((a, b) => {
    if (a.index === null && b.index === null) return 0;
    if (a.index === null) return 1;
    if (b.index === null) return -1;
    // 오름차순 정렬: 1, 2, 3...
    return a.index - b.index;
  });

  return projectItems;
}

/**
 * Artist Statement 데이터 추출
 */
export async function getArtistStatement(workData) {
  try {
    const { getPageBlocksServer, getBlockChildrenServer, getDatabaseMetadataServer } = await import('./notion-api-server.js');

    // 1. WORK DB의 상위 페이지(Web DB) ID 알아내기
    const workDbMeta = await getDatabaseMetadataServer('WORK');
    if (!workDbMeta || !workDbMeta.parent || workDbMeta.parent.type !== 'page_id') {
      console.log('WORK DB Metadata load failed or parent is not page');
      return null;
    }

    const parentPageId = workDbMeta.parent.page_id;

    // 2. 상위 페이지의 블록 가져오기
    const blocks = await getPageBlocksServer(parentPageId);
    if (!blocks || blocks.length === 0) {
      console.log('No blocks in parent page');
      return null;
    }

    // 3. "Artist Statement" 헤딩 찾기
    let targetBlockIndex = -1;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (['heading_1', 'heading_2', 'heading_3'].includes(block.type)) {
        const richText = block[block.type]?.rich_text;
        if (richText && richText.length > 0) {
          const text = richText.map(t => t.plain_text).join('').trim().toLowerCase();
          if (text === 'artist statement') {
            targetBlockIndex = i;
            break;
          }
        }
      }
    }

    if (targetBlockIndex === -1) {
      console.log('Artist Statement heading not found');
      return null; // 헤딩 없음
    }

    // 4. 헤딩 바로 다음 블록들이 텍스트인지 혹은 Column List인지 확인
    let textBlocks = [];
    const nextBlock = blocks[targetBlockIndex + 1];

    if (nextBlock && nextBlock.type === 'column_list') {
      const columns = await getBlockChildrenServer(nextBlock.id);
      if (columns && columns.length > 0) {
        // 왼쪽 열(0번)
        const firstColumn = columns[0];
        const columnContent = await getBlockChildrenServer(firstColumn.id);
        if (columnContent) {
          for (const block of columnContent) {
            if (['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(block.type)) {
              const richText = block[block.type]?.rich_text || [];
              if (richText.length > 0) {
                textBlocks.push({ type: block.type, rich_text: richText });
              } else {
                textBlocks.push(null); // 빈 줄
              }
            }
          }
        }
      }
    } else {
      // Column List가 아니라면, 다음 헤딩이 나오기 전까지의 텍스트 블록들을 수집
      for (let i = targetBlockIndex + 1; i < blocks.length; i++) {
        const block = blocks[i];
        // 새로운 헤딩을 만나면 중단
        if (['heading_1', 'heading_2', 'heading_3'].includes(block.type)) {
          break;
        }
        if (['paragraph', 'bulleted_list_item', 'numbered_list_item', 'quote'].includes(block.type)) {
          const richText = block[block.type]?.rich_text || [];
          if (richText.length > 0) {
            textBlocks.push({ type: block.type, rich_text: richText });
          } else {
            textBlocks.push(null); // 빈 줄
          }
        }
      }
    }

    return textBlocks;
  } catch (error) {
    console.error('Artist Statement 추출 오류:', error);
    return null;
  }
}
