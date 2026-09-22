// 프로젝트 상세 페이지 정적 데이터

export const projectData = {
  'newborn-space': {
    name: '신생공NEWBORN SPACE'
  }
};

/**
 * slug로 프로젝트 데이터 가져오기
 */
export function getProjectBySlug(slug) {
  return projectData[slug] || null;
}
