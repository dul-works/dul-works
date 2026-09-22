import ImageWithOverlay from './ImageWithOverlay';
import Link from 'next/link';
import { createSlug } from '@/lib/slug-utils';

export default function ProjectItem({ project, artworkImages, isFirstProject = false }) {
  const { name, period, description, index } = project;
  const slug = name ? createSlug(name) : null;

  const columnArrays = {
    1: [],
    2: []
  };
  const fullWidthImages = [];

  // 프로젝트 텍스트 콘텐츠 생성
  const periodHtml = period ? <div className="project-period">{period}</div> : '';
  const descriptionContent = description || '';
  const descriptionHtml = (periodHtml || descriptionContent) ? (
    <div className="description-box">
      {periodHtml}
      {descriptionContent.split('\n').map((line, idx) => (
        <p key={idx} className="artwork-detail-paragraph">{line}</p>
      ))}
    </div>
  ) : null;

  const textContent = (
    <Link key="text" href={slug ? `/project/${slug}` : '#'} className="project-link">
      <h2 className="project-item arrow-animated-link">{name}</h2>
      {descriptionHtml}
    </Link>
  );

  // 프로젝트 텍스트는 항상 첫 번째에 배치
  // (프로젝트 항목 자체의 위치는 WorkContent에서 index로 결정)
  columnArrays[1].push(textContent);

  // 이미지들을 index에 따라 배치
  if (artworkImages && artworkImages.length > 0) {
    // 첫 번째 프로젝트의 모든 이미지에 priority 적용 (LCP 경고 해결)
    let imageCount = 0;
    artworkImages.forEach((imageData) => {
      if (!imageData.url || imageData.url === '') return;

      // 첫 번째 프로젝트의 첫 3개 이미지에 priority 적용
      const shouldHavePriority = isFirstProject && imageCount < 3;
      imageCount++;

      if (!imageData.index) {
        // Index가 없는 이미지는 왼쪽 열에 순서대로 추가
        columnArrays[1].push(
          <ImageWithOverlay
            key={`${imageData.url}-${imageData.index || 'default'}`}
            imageUrl={imageData.url}
            name={imageData.name}
            timeline={imageData.timeline}
            description={imageData.description}
            priority={shouldHavePriority}
          />
        );
        return;
      }

      const indexStr = imageData.index.toString().trim();
      if (indexStr.toLowerCase() === 'full') {
        fullWidthImages.push(
          <ImageWithOverlay
            key={`${imageData.url}-full`}
            imageUrl={imageData.url}
            name={imageData.name}
            timeline={imageData.timeline}
            description={imageData.description}
            isFullWidth={true}
            priority={shouldHavePriority}
          />
        );
        return;
      }

      // 콤마로 분리하고 각 부분의 공백 제거
      const parts = indexStr.split(',').map(part => part.trim()).filter(part => part !== '');
      if (parts.length >= 2) {
        const column = parseInt(parts[0], 10);
        const row = parseInt(parts[1], 10);

        if (!isNaN(column) && !isNaN(row) && (column === 1 || column === 2)) {
          const imageWithOverlay = (
            <ImageWithOverlay
              key={`${imageData.url}-${column}-${row}`}
              imageUrl={imageData.url}
              name={imageData.name}
              timeline={imageData.timeline}
              description={imageData.description}
              priority={shouldHavePriority}
            />
          );

          // 텍스트가 이미 1열 1번 위치에 있으므로, 이미지 Index는 텍스트를 제외한 위치
          // Index "1,1"은 텍스트 위치이므로, 실제로는 텍스트 다음 위치(2)에 배치
          // Index "1,2"는 텍스트 다음 다음 위치(3)에 배치
          const actualRow = column === 1 ? row + 1 : row; // 1열은 텍스트가 있으므로 +1

          while (columnArrays[column].length < actualRow) {
            columnArrays[column].push(null);
          }

          columnArrays[column][actualRow - 1] = imageWithOverlay;
        }
      }
    });
  }

  const leftColumnContent = columnArrays[1].filter(img => img !== null);
  const rightColumnContent = columnArrays[2].filter(img => img !== null);

  return (
    <div className="name-container">
      <div className="columns-container">
        <div className="column">
          {leftColumnContent}
        </div>
        <div className="column">
          {rightColumnContent}
        </div>
      </div>
      {fullWidthImages.length > 0 && (
        <div className="full-width-images-wrapper">
          {fullWidthImages}
        </div>
      )}
    </div>
  );
}

