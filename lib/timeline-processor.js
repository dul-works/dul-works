// Timeline 데이터 처리 유틸리티

import { extractText, extractNumber, findProperty, byIndexNullsLast } from './notion-utils.js';

/**
 * Timeline 항목에서 데이터 추출
 */
function extractTimelineData(item) {
  const properties = item.properties || {};

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  const indexProperty = findProperty(
    properties,
    'Index', 'index', 'INDEX',
    'Order', 'order', 'ORDER',
    'Position', 'position', 'POSITION'
  );
  const index = extractNumber(indexProperty);

  return {
    id: item.id,
    name: name || null,
    index
  };
}

/**
 * Work 데이터에서 TIMELINE 클래스 항목만 필터링 및 정렬
 */
export function processTimelineData(workData) {
  const timelineItems = workData
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
      return classValue.toUpperCase() === 'TIMELINE';
    })
    .map(extractTimelineData)
    .filter(item => item.name !== null);

  // Index 오름차순, Index 없는 항목은 맨 뒤로
  return timelineItems.sort(byIndexNullsLast);
}

