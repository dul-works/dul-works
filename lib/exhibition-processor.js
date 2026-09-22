// Exhibition 데이터 처리 유틸리티

import { extractText, extractDate, extractNumber, findProperty, extractCheckbox, getCoverImageUrl, byIndexNullsLast } from './notion-utils.js';

// WORK 항목의 Class 값 (대문자, 공백 제거)
function getClassType(item) {
  const classProperty = findProperty(
    item.properties || {},
    'Class', 'class', 'CLASS',
    'Type', 'type', 'TYPE',
    'Category', 'category', 'CATEGORY'
  );
  return extractText(classProperty).toUpperCase().trim();
}

/**
 * SOLO EXHIBITION 또는 GROUP EXHIBITION 클래스인지 확인
 */
export function isExhibitionItem(item) {
  const classType = getClassType(item);
  return classType === 'SOLO EXHIBITION' || classType === 'GROUP EXHIBITION';
}

/**
 * Exhibition 항목에서 데이터 추출
 */
export function extractExhibitionData(item) {
  try {
    const properties = item.properties || {};

    const name = extractText(findProperty(
      properties,
      'Name', 'name', 'NAME',
      'Title', 'title', 'TITLE'
    ));

    const index = extractNumber(findProperty(
      properties,
      'Index', 'index', 'INDEX',
      'Order', 'order', 'ORDER',
      'Position', 'position', 'POSITION'
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

    // Page Cover 이미지
    const imageUrl = getCoverImageUrl(item);

    return {
      id: item.id,
      name: name || null,
      index,
      period: period || '',
      description: description || '',
      imageUrl: imageUrl || null,
      classType: getClassType(item), // SOLO EXHIBITION 또는 GROUP EXHIBITION
      current: extractCheckbox(findProperty(properties, 'Current', 'current', 'CURRENT'))
    };
  } catch (error) {
    console.error('Exhibition 데이터 추출 오류:', error);
    return null;
  }
}

/**
 * Work 데이터에서 EXHIBITION 클래스 항목만 필터링 및 정렬
 * SOLO 먼저, GROUP 나중에 — 각각 Index 오름차순 (Index 없으면 맨 뒤)
 */
export function processExhibitionData(workData) {
  try {
    const items = workData
      .filter(isExhibitionItem)
      .map(extractExhibitionData)
      .filter(item => item !== null && item.name !== null);

    const solo = items.filter(item => item.classType === 'SOLO EXHIBITION').sort(byIndexNullsLast);
    const group = items.filter(item => item.classType === 'GROUP EXHIBITION').sort(byIndexNullsLast);
    return [...solo, ...group];
  } catch (error) {
    console.error('[Exhibition] 데이터 처리 오류:', error);
    console.error('[Exhibition] 에러 스택:', error.stack);
    return [];
  }
}
