// CV 데이터 처리 유틸리티

import { extractText, extractDate, findProperty } from './notion-utils.js';

/**
 * CV 항목에서 데이터 추출
 */
function extractCVItemData(item) {
  const properties = item.properties || {};

  const periodProperty = findProperty(
    properties,
    'Period', 'period', 'PERIOD',
    'Date', 'date', 'DATE',
    'Year', 'year', 'YEAR'
  );
  const period = extractDate(periodProperty);

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  const clientProperty = findProperty(
    properties,
    'Client', 'client', 'CLIENT',
    'Cline', 'cline', 'CLINE',
    'Venue', 'venue', 'VENUE'
  );
  const client = extractText(clientProperty);

  const placeProperty = findProperty(
    properties,
    'Place', 'place', 'PLACE',
    'Location', 'location', 'LOCATION'
  );
  const place = extractDate(placeProperty);

  const indexProperty = findProperty(
    properties,
    'Index', 'index', 'INDEX',
    'Order', 'order', 'ORDER'
  );
  // 숫자로 변환 가능한 값이면 숫자로, 아니면 0으로 처리 (정렬 위함)
  let index = 0;
  if (indexProperty) {
    if (indexProperty.number !== undefined) {
      index = indexProperty.number;
    } else {
      // 텍스트 등의 다른 형식이면 숫자만 추출 시도
      const textVal = extractText(indexProperty);
      const parsed = parseInt(textVal, 10);
      if (!isNaN(parsed)) index = parsed;
    }
  }

  const roleProperty = findProperty(
    properties,
    'Role', 'role', 'ROLE'
  );
  const role = extractText(roleProperty);

  return { period, name, client, place, index, role };
}

/**
 * CV 데이터를 Class별로 그룹화
 */
export function groupCVDataByClass(cvData) {
  const classGroups = {};

  cvData.forEach(item => {
    const properties = item.properties || {};
    const classProperty = findProperty(properties, 'Class', 'class', 'CLASS');

    if (classProperty && classProperty.select) {
      const className = classProperty.select.name;
      if (className) {
        if (!classGroups[className]) {
          classGroups[className] = [];
        }
        classGroups[className].push(extractCVItemData(item));
      }
    }
  });

  // 각 그룹 내 아이템을 Index 기준으로 정렬 (오름차순: 1, 2, 3...)
  Object.keys(classGroups).forEach(className => {
    classGroups[className].sort((a, b) => {
      // Index가 0(없음)인 경우 맨 뒤로 가거나, 원하는 로직에 따라 처리
      // 여기서는 단순 오름차순 정렬
      return a.index - b.index;
    });
  });

  // 순서 정의
  const order = [
    'EDUCATION',
    'SOLO EXHIBITION',
    'GROUP EXHIBITION',
    'AWARDS',
    'RESIDENCY',
    'PARTICIPATED WORK'
  ];

  // 순서대로 정렬된 Class 목록
  const sortedClasses = Object.keys(classGroups).sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);

    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return { classGroups, sortedClasses };
}
