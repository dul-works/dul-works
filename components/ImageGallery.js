import Image from 'next/image';
import { useState, useEffect } from 'react';

// 상세 페이지 공통: 텍스트 열(children) + 이미지 열 + 확대 팝업
export default function ImageGallery({ images, name, children }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const count = images.length;
  // 두 번째 이미지 열이 없으면 첫 번째 이미지 열이 두 열을 모두 차지
  const hasColumn2Images = images.some(img => img.column === 2);

  const handleImageClick = (imageIndex) => {
    setCurrentImageIndex(imageIndex);
    setIsPopupOpen(true);
  };

  const closePopup = () => setIsPopupOpen(false);
  const goToPreviousImage = () => setCurrentImageIndex((prev) => (prev === 0 ? count - 1 : prev - 1));
  const goToNextImage = () => setCurrentImageIndex((prev) => (prev === count - 1 ? 0 : prev + 1));

  // 키보드 이벤트 처리
  useEffect(() => {
    if (!isPopupOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePopup();
      } else if (e.key === 'ArrowLeft') {
        goToPreviousImage();
      } else if (e.key === 'ArrowRight') {
        goToNextImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopupOpen, count]);

  // body 스크롤 잠금
  useEffect(() => {
    if (isPopupOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isPopupOpen]);

  const renderImage = (image, idx, imageIndex, alt, size, style) => (
    <div
      key={idx}
      className="artwork-detail-image-wrapper"
      onClick={() => handleImageClick(imageIndex)}
      style={style}
    >
      <Image
        src={image.path}
        alt={alt}
        width={size}
        height={size}
        className="artwork-detail-image"
        priority={idx === 0}
        quality={90}
        style={{
          width: '100%',
          height: 'auto',
          cursor: 'pointer',
        }}
      />
    </div>
  );

  const columns = [
    { column: 1, className: `artwork-detail-column artwork-detail-column-1 ${!hasColumn2Images ? 'artwork-detail-column-full-width' : ''}` },
    { column: 2, className: 'artwork-detail-column artwork-detail-column-2' },
  ].filter(({ column }) => column === 1 || hasColumn2Images);

  return (
    <>
      <div className={`artwork-detail-container ${!hasColumn2Images ? 'no-second-column' : ''}`}>
        {children}

        {/* column 1/2 이미지 열 (2열은 이미지가 있을 때만) */}
        {columns.map(({ column, className }) => (
          <div key={column} className={className}>
            {images.filter(img => img.column === column).map((image, idx) =>
              renderImage(
                image,
                idx,
                images.findIndex(img => img.path === image.path),
                `${name} - Image ${image.row}`,
                500,
                { gridRow: image.row }
              )
            )}
          </div>
        ))}

        {/* 반응형 (1024px 미만): 1열로 이미지 표시 */}
        <div className="artwork-detail-column artwork-detail-column-responsive">
          {images.map((image, idx) => renderImage(image, idx, idx, `${name} - Image ${idx + 1}`, 800))}
        </div>
      </div>

      {/* 이미지 확대 팝업 */}
      {isPopupOpen && count > 0 && (
        <div className="artwork-image-popup-overlay" onClick={closePopup}>
          <div className="artwork-image-popup-container" onClick={(e) => e.stopPropagation()}>
            <button
              className="artwork-image-popup-close"
              onClick={closePopup}
              aria-label="닫기"
            >
              ×
            </button>
            <button
              className="artwork-image-popup-nav artwork-image-popup-prev"
              onClick={goToPreviousImage}
              aria-label="이전 이미지"
            >
              <Image
                src="/assets/icons/arrow_back.svg"
                alt="이전"
                width={24}
                height={24}
              />
            </button>
            <button
              className="artwork-image-popup-nav artwork-image-popup-next"
              onClick={goToNextImage}
              aria-label="다음 이미지"
            >
              <Image
                src="/assets/icons/arrow_forward.svg"
                alt="다음"
                width={24}
                height={24}
              />
            </button>
            <div className="artwork-image-popup-image-wrapper">
              <Image
                src={images[currentImageIndex].path}
                alt={`${name} - Image ${currentImageIndex + 1}`}
                width={1920}
                height={1080}
                className="artwork-image-popup-image"
                quality={95}
                priority
              />
            </div>
            <div className="artwork-image-popup-counter">
              {currentImageIndex + 1} / {count}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
