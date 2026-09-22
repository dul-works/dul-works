// Artwork 데이터 처리 유틸리티

import { extractText, extractIndex, findProperty, extractRelation, getCoverImageUrl } from './notion-utils.js';
import { processTimelineData } from './timeline-processor.js';

/**
 * Artwork 항목에서 메타데이터 추출
 */
function extractArtworkMetadata(item, timelineMap) {
  const properties = item.properties || {};

  const indexProperty = findProperty(
    properties,
    'Index', 'index', 'INDEX',
    'Order', 'order', 'ORDER',
    'Position', 'position', 'POSITION'
  );
  const index = extractIndex(indexProperty);

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  const timelineProperty = findProperty(
    properties,
    'Timeline', 'timeline', 'TIMELINE',
    'Date', 'date', 'DATE',
    'Time', 'time', 'TIME',
    'Year', 'year', 'YEAR',
    'Period', 'period', 'PERIOD'
  );

  let timeline = '';
  if (timelineProperty && timelineProperty.type === 'relation') {
    const relationIds = extractRelation(timelineProperty);
    if (relationIds.length > 0 && timelineMap[relationIds[0]]) {
      timeline = timelineMap[relationIds[0]];
    }
  } else {
    timeline = extractText(timelineProperty);
  }

  const descriptionProperty = findProperty(
    properties,
    'Description', 'description', 'DESCRIPTION',
    'Description EN', 'description en', 'Description En', 'Description en'
  );
  const description = extractText(descriptionProperty);

  return { index, name, timeline, description };
}

/**
 * Artwork 항목에서 Timeline 메타데이터 추출 (Timeline-Index 포함)
 */
function extractTimelineArtworkMetadata(item) {
  const properties = item.properties || {};

  const timelineIndexProperty = findProperty(
    properties,
    'Timeline-Index', 'timeline-index', 'TIMELINE-INDEX', 'Timeline Index', 'timeline index', 'TIMELINE INDEX',
    'TimelineIndex', 'timelineIndex', 'TIMELINEINDEX'
  );
  const timelineIndex = extractIndex(timelineIndexProperty);

  const nameProperty = findProperty(
    properties,
    'Name', 'name', 'NAME',
    'Title', 'title', 'TITLE'
  );
  const name = extractText(nameProperty);

  return { timelineIndex, name };
}

/**
 * 프로젝트(ID 또는 이름)에 해당하는 Artwork 이미지들 가져오기
 */
export function loadArtworkImagesForProject(projectId, projectName, artworkData, allProjectNames, timelineMap = {}) {
  try {
    const normalizedProjectName = projectName ? projectName.trim().toLowerCase() : '';
    // Notion ID는 하이픈 포함/미포함이 혼용될 수 있으므로 하이픈 제거 후 비교
    const targetId = projectId ? projectId.replaceAll('-', '') : null;

    const matchingItems = artworkData.filter(item => {
      const properties = item.properties || {};

      // 1. Project Relation 확인 (우선순위)
      const projectRelationProperty = findProperty(
        properties,
        'Project', 'project', 'PROJECT'
      );
      const relationIds = extractRelation(projectRelationProperty);

      if (targetId && relationIds.length > 0) {
        // relationId도 하이픈 제거 후 비교
        const hasMatch = relationIds.some(id => id.replaceAll('-', '') === targetId);
        if (hasMatch) return true;
      }

      // 2. Project 필드(Relation)가 없거나 일치하지 않을 경우, Artwork Name에서 프로젝트 이름 추출 시도 (Fallback)
      const artworkNameProperty = findProperty(properties, 'Name', 'name', 'NAME', 'Title', 'title', 'TITLE');
      const artworkName = extractText(artworkNameProperty);
      const extractedProjectName = extractProjectNameFromArtworkName(artworkName, allProjectNames);

      if (extractedProjectName && extractedProjectName.toLowerCase() === normalizedProjectName) {
        return true;
      }

      return false;
    });

    // 일치하는 항목의 Cover 이미지와 메타데이터
    return matchingItems
      .map(item => ({ url: getCoverImageUrl(item), ...extractArtworkMetadata(item, timelineMap) }))
      .filter(data => data.url !== null);
  } catch (error) {
    console.error('Artwork 이미지 로드 오류:', error);
    return [];
  }
}

/**
 * Artwork 이름에서 프로젝트 이름 추출
 */
function extractProjectNameFromArtworkName(artworkName, projectNames) {
  if (!artworkName) return null;

  const normalizedArtworkName = artworkName.toLowerCase();

  // 각 프로젝트 이름과 매칭 시도
  for (const projectName of projectNames) {
    const normalizedProjectName = projectName.toLowerCase();

    // 프로젝트 이름이 artwork 이름에 포함되어 있는지 확인
    if (normalizedArtworkName.includes(normalizedProjectName)) {
      return projectName;
    }

    // 프로젝트 이름의 주요 키워드 추출
    const projectKeywords = normalizedProjectName
      .split(/\s+/)
      .filter(word => word.length > 2 && !['the', 'of', 'for', 'a', 'an', 'speaker'].includes(word));

    // 키워드들이 artwork 이름에 포함되어 있는지 확인
    if (projectKeywords.length > 0 && projectKeywords.every(keyword => normalizedArtworkName.includes(keyword))) {
      return projectName;
    }
  }

  return null;
}

/**
 * 모든 프로젝트에 대한 Artwork 이미지 미리 로드
 * workData: WORK DB의 모든 데이터 (raw data)
 */
export function preloadAllArtworkImages(workData, artworkData) {
  // PROJECT 클래스만 필터링하여 ID와 Name 추출
  const projects = workData
    .filter(item => {
      const properties = item.properties || {};
      const classProperty = findProperty(
        properties,
        'Class', 'class', 'CLASS',
        'Type', 'type', 'TYPE',
        'Category', 'category', 'CATEGORY'
      );
      const classValue = extractText(classProperty);
      return classValue.toUpperCase() === 'PROJECT';
    })
    .map(item => {
      const properties = item.properties || {};
      const nameProperty = findProperty(
        properties,
        'Name', 'name', 'NAME',
        'Title', 'title', 'TITLE'
      );
      return {
        id: item.id,
        name: extractText(nameProperty)
      };
    })
    .filter(p => p.name);

  const projectNames = projects.map(p => p.name);
  const artworkMap = {};

  // Timeline ID -> Name 맵 (Relation Resolution용)
  const timelineMap = {};
  for (const timeline of processTimelineData(workData)) {
    timelineMap[timeline.id] = timeline.name;
  }

  // 프로젝트별로 이미지 로드 (ID 기반 + 이름 Fallback)
  for (const project of projects) {
    artworkMap[project.name] = loadArtworkImagesForProject(project.id, project.name, artworkData, projectNames, timelineMap);
  }

  return artworkMap;
}

/**
 * Timeline Relation으로 연결된 Artwork 이미지들 가져오기
 */
function loadArtworkImagesForTimeline(timelineId, artworkData) {
  try {
    const targetId = timelineId ? timelineId.replaceAll('-', '') : null;

    return artworkData
      .filter(item => {
        const relationIds = extractRelation(findProperty(item.properties || {}, 'Timeline', 'timeline', 'TIMELINE'));
        return targetId && relationIds.some(id => id.replaceAll('-', '') === targetId);
      })
      .map(item => ({ url: getCoverImageUrl(item), ...extractTimelineArtworkMetadata(item) }))
      .filter(data => data.url !== null);
  } catch (error) {
    console.error('Timeline Artwork 이미지 로드 오류:', error);
    return [];
  }
}

/**
 * 모든 Timeline에 대한 Artwork 이미지 미리 로드
 * timelineData: processTimelineData를 거친 데이터 (id 포함됨)
 */
export function preloadAllTimelineImages(timelineData, artworkData) {
  const timelineMap = {};

  for (const timeline of timelineData) {
    if (timeline.name) {
      timelineMap[timeline.name] = loadArtworkImagesForTimeline(timeline.id, artworkData);
    }
  }

  return timelineMap;
}

