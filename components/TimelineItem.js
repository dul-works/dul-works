import ImageWithOverlay from './ImageWithOverlay';

export default function TimelineItem({ timeline, artworkImages, isFirstTimeline = false }) {
  const { name } = timeline;

  const columnArrays = {
    1: [],
    2: []
  };
  const fullWidthImages = [];

  // Timeline 텍스트 콘텐츠 생성
  const textContent = (
    <div key="text" className="timeline-name">{name}</div>
  );

  // Timeline 텍스트는 항상 첫 번째에 배치
  columnArrays[1].push(textContent);

  // 이미지들을 Timeline-Index에 따라 배치
  if (artworkImages && artworkImages.length > 0) {
    let isFirstImage = isFirstTimeline;
    artworkImages.forEach((imageData) => {
      if (!imageData.url || imageData.url === '') return;

      if (!imageData.timelineIndex) {
        // Timeline-Index가 없는 이미지는 왼쪽 열에 순서대로 추가
        columnArrays[1].push(
          <ImageWithOverlay
            key={`${imageData.url}-${imageData.timelineIndex || 'default'}`}
            imageUrl={imageData.url}
            name={imageData.name}
            timeline={name}
            priority={isFirstImage}
          />
        );
        isFirstImage = false;
        return;
      }

      const indexStr = imageData.timelineIndex.toString().trim();
      if (indexStr.toLowerCase() === 'full') {
        fullWidthImages.push(
          <ImageWithOverlay
            key={`${imageData.url}-full`}
            imageUrl={imageData.url}
            name={imageData.name}
            timeline={name}
            isFullWidth={true}
            priority={isFirstImage}
          />
        );
        isFirstImage = false;
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
              timeline={name}
              priority={isFirstImage}
            />
          );
          isFirstImage = false;

          // 텍스트가 이미 1열 1번 위치에 있으므로, 이미지 Index는 텍스트를 제외한 위치
          // Index "1,1"은 텍스트 위치이므로, 실제로는 텍스트 다음 위치(2)에 배치
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
    <div className="timeline-item">
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

