// Artwork 데이터 처리 유틸리티

// Artwork 데이터 처리 유틸리티

import { extractText, extractIndex, findProperty, extractCoverImageFilename, extractRelation, extractCheckbox } from './notion-utils.js';

/**
 * Artwork 항목에서 이미지 URL 추출 (Page Cover에서 파일명 가져오기)
 */
function extractImageFromArtwork(item) {
  const filename = extractCoverImageFilename(item);

  if (!filename) {
    return null;
  }

  const basePath = '';
  return `${basePath}/assets/images/${filename}`;
}

/**
 * Artwork 항목에서 메타데이터 추출
 */
function extractArtworkMetadata(item, timelineMap = {}) {
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

  const postProperty = findProperty(properties, 'Post', 'post', 'POST');
  const isPost = extractCheckbox(postProperty);

  return { index, name, timeline, description, post: isPost };
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
export async function loadArtworkImagesForProject(projectId, projectName, artworkData, allProjectNames, timelineMap = {}) {
  try {
    const normalizedProjectName = projectName ? projectName.trim().toLowerCase() : '';
    // Project ID 정규화 (하이픈 제거 등 필요 시) - Notion ID는 하이픈 포함/미포함 혼용될 수 있으므로 주의. 
    // 여기서는 API에서 오는 ID 그대로 사용 (보통 하이픈 포함).
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

    if (matchingItems.length === 0) {
      return [];
    }

    // 모든 일치하는 항목의 이미지와 메타데이터 가져오기
    const imageData = matchingItems.map((item) => {
      const imageUrl = extractImageFromArtwork(item);
      const metadata = extractArtworkMetadata(item, timelineMap);

      return {
        url: imageUrl,
        ...metadata
      };
    });
    const filteredData = imageData.filter(data => data.url !== null && data.post !== false);

    return filteredData;
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
export async function preloadAllArtworkImages(workData, artworkData) {
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

  // Timeline ID -> Name 맵 생성 (Relation Resolution용)
  const timelineMap = {};
  workData.forEach(item => {
    const properties = item.properties || {};
    const classProperty = findProperty(
      properties,
      'Class', 'class', 'CLASS',
      'Type', 'type', 'TYPE',
      'Category', 'category', 'CATEGORY'
    );
    const classValue = extractText(classProperty);

    if (classValue.toUpperCase() === 'TIMELINE') {
      const nameProperty = findProperty(
        properties,
        'Name', 'name', 'NAME',
        'Title', 'title', 'TITLE'
      );
      const name = extractText(nameProperty);
      if (item.id && name) {
        timelineMap[item.id] = name;
      }
    }
  });

  // 프로젝트별로 이미지 로드 (ID 기반 + 이름 Fallback)
  for (const project of projects) {
    artworkMap[project.name] = await loadArtworkImagesForProject(project.id, project.name, artworkData, projectNames, timelineMap);
  }

  // Relation으로 매칭되지 않은 Artwork 중, 이름 기반으로만 매칭해야 하는 경우 처리
  // (위 loop에서 이미 이름 fallback은 포함되어 있지만, 프로젝트 Relation이 아예 없는 고아 Artwork들을 위해)
  const unprocessedArtworks = artworkData.filter(item => {
    // 이미 매칭된 artwork인지 확인하는 로직은 복잡하므로, 단순하게 Project Relation이 없는 것들만 살핌
    const properties = item.properties || {};
    const projectProperty = findProperty(
      properties,
      'Project', 'project', 'PROJECT'
    );
    const ids = extractRelation(projectProperty);
    return ids.length === 0;
  });

  // 이 부분은 loadArtworkImagesForProject 내부의 Fallback 로직이 이미 커버하지만,
  // '프로젝트 Relation이 없는 Artwork'가 특정 프로젝트 이름만으로 매칭되기를 원한다면 
  // loadArtworkImagesForProject 호출 시 이미 처리됨.
  // 따라서 별도 처리는 제거하거나 최소화.

  return artworkMap;
}

/**
 * Timeline(ID 또는 이름)에 해당하는 Artwork 이미지들 가져오기
 */
export async function loadArtworkImagesForTimeline(timelineId, timelineName, artworkData) {
  try {
    const normalizedTimelineName = timelineName ? timelineName.trim().toLowerCase() : '';
    const targetId = timelineId ? timelineId.replaceAll('-', '') : null;

    const matchingItems = artworkData.filter(item => {
      const properties = item.properties || {};

      // 1. Timeline Relation 확인
      const timelineRelationProperty = findProperty(
        properties,
        'Timeline', 'timeline', 'TIMELINE'
      );
      const relationIds = extractRelation(timelineRelationProperty);

      if (targetId && relationIds.length > 0) {
        const hasMatch = relationIds.some(id => id.replaceAll('-', '') === targetId);
        if (hasMatch) return true;
      }

      // 2. Timeline 필드(Relation)가 없으면 이름 매칭 Fallback
      // 기존 로직: Timeline 텍스트 속성 (지금은 Relation으로 바뀜)
      // 만약 기존 Timeline 텍스트 속성이 남아있지 않고 Relation만 있다면 아래 로직은 동작하지 않음.
      // 하지만 사용자가 '모두 관계형 속성으로 바꿔서'라고 했으므로 텍스트 속성은 없을 가능성 큼.
      // 그래도 안전장치로 남겨둠 (혹시 다른 텍스트 속성에 적혀있을지도 모르니? 아니면 'Name'에서 유추?)
      // 기존 로직은 'Timeline' 속성에서 텍스트를 읽어서 비교했음.

      // 여기서는 Relation 매칭 실패 시, Artwork에는 Timeline 정보가 없을 수도 있음.
      // (Timeline Relation이 비어있으면 매칭 불가)
      return false;
    });

    if (matchingItems.length === 0) {
      return [];
    }

    // 모든 일치하는 항목의 이미지와 메타데이터 가져오기
    const imageData = matchingItems.map((item) => {
      const imageUrl = extractImageFromArtwork(item);
      const metadata = extractTimelineArtworkMetadata(item);

      return {
        url: imageUrl,
        ...metadata
      };
    });
    const filteredData = imageData.filter(data => data.url !== null && data.post !== false);

    return filteredData;
  } catch (error) {
    console.error('Timeline Artwork 이미지 로드 오류:', error);
    return [];
  }
}

/**
 * 모든 Timeline에 대한 Artwork 이미지 미리 로드
 * timelineData: processTimelineData를 거친 데이터 (id 포함됨)
 */
export async function preloadAllTimelineImages(timelineData, artworkData) {
  const timelineMap = {};

  for (const timeline of timelineData) {
    if (timeline.name) {
      timelineMap[timeline.name] = await loadArtworkImagesForTimeline(timeline.id, timeline.name, artworkData);
    }
  }

  return timelineMap;
}

