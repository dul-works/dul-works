import Layout from '../../components/Layout';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getArtworkBySlug, getAllArtworkSlugs } from '../../lib/artwork-detail-processor';
import { createSlug } from '../../lib/slug-utils';


export default function ArtworkDetail({ artwork, relatedExhibitions }) {
  const basePath = process.env.NODE_ENV === 'production' ? '/dul-works' : '';
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!artwork) {
    return (
      <Layout title="Portfolio - Work Detail">
        <div>작품을 찾을 수 없습니다.</div>
      </Layout>
    );
  }

  // 팝업용: 모든 이미지를 정렬된 순서로 (이미 정렬되어 있음)
  const sortedImages = artwork.images || [];

  // 이미지를 열별로 그룹화
  const column1Images = (artwork.images || []).filter(img => img.column === 1);
  const column2Images = (artwork.images || []).filter(img => img.column === 2);
  // 2열 레이아웃을 위해 모든 이미지 합치기
  const allImages = [...column1Images, ...column2Images];

  // 두 번째 열에 이미지가 없으면 첫 번째 열 이미지가 첫 번째, 두 번째 열을 모두 차지하도록 표시
  const hasColumn2Images = column2Images.length > 0;

  // 이미지 클릭 핸들러
  const handleImageClick = (imageIndex) => {
    setCurrentImageIndex(imageIndex);
    setIsPopupOpen(true);
  };

  // 팝업 닫기
  const closePopup = () => {
    setIsPopupOpen(false);
  };

  // 이전 이미지
  const goToPreviousImage = () => {
    setCurrentImageIndex((prev) => {
      if (prev === 0) {
        return sortedImages.length - 1;
      }
      return prev - 1;
    });
  };

  // 다음 이미지
  const goToNextImage = () => {
    setCurrentImageIndex((prev) => {
      if (prev === sortedImages.length - 1) {
        return 0;
      }
      return prev + 1;
    });
  };

  // 키보드 이벤트 처리
  useEffect(() => {
    if (!isPopupOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closePopup();
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => {
          if (prev === 0) {
            return sortedImages.length - 1;
          }
          return prev - 1;
        });
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => {
          if (prev === sortedImages.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPopupOpen, sortedImages.length]);

  // body 스크롤 잠금
  useEffect(() => {
    if (isPopupOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isPopupOpen]);

  return (
    <Layout title={`Portfolio - ${artwork.name}`}>
      <div className={`artwork-detail-container ${!hasColumn2Images ? 'no-second-column' : ''}`}>
        {/* 1번째 열: 텍스트 정보 */}
        <div className="artwork-detail-text-column">
          <h2 className="artwork-detail-name">{artwork.name}</h2>
          {(artwork.artist || artwork.timeline || artwork.dimension || artwork.caption) && (
            <div className="artwork-detail-metadata">
              {artwork.artist && (
                <div className="artwork-detail-artist">{artwork.artist}</div>
              )}
              {artwork.timeline && (
                <div className="artwork-detail-timeline">{artwork.timeline}</div>
              )}
              {artwork.dimension && (
                <div className="artwork-detail-dimension">{artwork.dimension}</div>
              )}
              {artwork.caption && (
                <div className="artwork-detail-caption">{artwork.caption}</div>
              )}
            </div>
          )}
          {artwork.pageText && Array.isArray(artwork.pageText) && artwork.pageText.length > 0 ? (
            <div className="artwork-detail-page-text">
              {artwork.pageText.map((paragraph, idx) => {
                if (paragraph === null) {
                  // 문단 구분 (작은 간격)
                  return <div key={idx} className="artwork-detail-paragraph-break"></div>;
                }

                // rich_text 배열인 경우 스타일 적용
                if (Array.isArray(paragraph)) {
                  return (
                    <p key={idx} className="artwork-detail-paragraph">
                      {paragraph.map((textItem, textIdx) => {
                        const text = textItem.plain_text || '';
                        const annotations = textItem.annotations || {};

                        // bold 처리
                        if (annotations.bold) {
                          return <strong key={textIdx}>{text}</strong>;
                        }
                        return text;
                      })}
                    </p>
                  );
                }

                // 문자열인 경우 (하위 호환성)
                return <p key={idx} className="artwork-detail-paragraph">{paragraph}</p>;
              })}
            </div>
          ) : artwork.pageText && !Array.isArray(artwork.pageText) ? (
            <div className="artwork-detail-page-text">
              <div>{artwork.pageText}</div>
            </div>
          ) : (
            <div className="artwork-detail-page-text">
              <div>none</div>
            </div>
          )}


          {/* Related Exhibition Section (Moved inside text column) */}
          {relatedExhibitions && relatedExhibitions.length > 0 && (
            <div className="exhibition-detail-artworks-section">
              <h3 className="exhibition-detail-artworks-title">EXHIBITION</h3>
              <div className="exhibition-detail-artworks-list">
                {relatedExhibitions.map((exhibition, idx) => (
                  <Link
                    key={idx}
                    href={`/exhibition/${createSlug(exhibition.name)}`}
                    className="exhibition-detail-artwork-item"
                  >
                    <div className="exhibition-detail-artwork-metadata">
                      <div className="exhibition-detail-artwork-name-wrapper">
                        <h4 className="exhibition-detail-artwork-name arrow-animated-link">{exhibition.name}</h4>
                      </div>
                      {exhibition.period && (
                        <div className="exhibition-detail-artwork-artist">{exhibition.period}</div>
                      )}
                      {exhibition.description && (
                        <div className="exhibition-detail-artwork-caption">
                          {exhibition.description.split('\n').map((line, i) => (
                            <span key={i} style={{ display: 'block' }}>{line}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 2번째 열: column이 1인 이미지들 */}
        <div className={`artwork-detail-column artwork-detail-column-1 ${!hasColumn2Images ? 'artwork-detail-column-full-width' : ''}`}>
          {column1Images.map((image, idx) => {
            const imageIndex = sortedImages.findIndex(img => img.path === image.path);
            return (
              <div
                key={idx}
                className="artwork-detail-image-wrapper"
                onClick={() => handleImageClick(imageIndex)}
                style={{ gridRow: image.row }}
              >
                <Image
                  src={image.path}
                  alt={`${artwork.name} - Image ${image.row}`}
                  width={500}
                  height={500}
                  className="artwork-detail-image"
                  loading={idx === 0 ? undefined : "lazy"}
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
          })}
        </div>

        {/* 3번째 열: column이 2인 이미지들 - 이미지가 있을 때만 렌더링 */}
        {hasColumn2Images && (
          <div className="artwork-detail-column artwork-detail-column-2">
            {column2Images.map((image, idx) => {
              const imageIndex = sortedImages.findIndex(img => img.path === image.path);
              return (
                <div
                  key={idx}
                  className="artwork-detail-image-wrapper"
                  onClick={() => handleImageClick(imageIndex)}
                  style={{ gridRow: image.row }}
                >
                  <Image
                    src={image.path}
                    alt={`${artwork.name} - Image ${image.row}`}
                    width={500}
                    height={500}
                    className="artwork-detail-image"
                    loading={idx === 0 ? undefined : "lazy"}
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
            })}
          </div>
        )}

        {/* 반응형 (1024px 미만): 1열로 이미지 표시 */}
        <div className="artwork-detail-column artwork-detail-column-responsive">
          {sortedImages.map((image, idx) => {
            // sortedImages는 이미 정렬되어 있으므로 그대로 출력 (index mismatch 방지)
            const imageIndex = idx;
            return (
              <div
                key={idx}
                className="artwork-detail-image-wrapper"
                onClick={() => handleImageClick(imageIndex)}
              >
                <Image
                  src={image.path}
                  alt={`${artwork.name} - Image ${idx + 1}`}
                  width={800}
                  height={800}
                  className="artwork-detail-image"
                  loading={idx === 0 ? undefined : "lazy"}
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
          })}
        </div>
      </div>

      {/* Related Exhibition Section */}



      {/* 이미지 확대 팝업 */}
      {
        isPopupOpen && sortedImages.length > 0 && (
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
                  src={`${basePath}/assets/icons/arrow_back.svg`}
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
                  src={`${basePath}/assets/icons/arrow_forward.svg`}
                  alt="다음"
                  width={24}
                  height={24}
                />
              </button>
              <div className="artwork-image-popup-image-wrapper">
                <Image
                  src={sortedImages[currentImageIndex].path}
                  alt={`${artwork.name} - Image ${currentImageIndex + 1}`}
                  width={1920}
                  height={1080}
                  className="artwork-image-popup-image"
                  quality={95}
                  priority
                />
              </div>
              <div className="artwork-image-popup-counter">
                {currentImageIndex + 1} / {sortedImages.length}
              </div>
            </div>
          </div>
        )
      }
    </Layout >
  );
}

export async function getStaticPaths() {
  try {
    const slugs = await getAllArtworkSlugs();

    return {
      paths: slugs.map(slug => ({
        params: { slug }
      })),
      fallback: 'blocking'
    };
  } catch (error) {
    console.error('getStaticPaths 오류:', error);
    return {
      paths: [],
      fallback: false
    };
  }
}

export async function getStaticProps({ params }) {
  try {
    const artwork = await getArtworkBySlug(params.slug);

    if (!artwork) {
      return {
        notFound: true
      };
    }

    // 관련 전시 데이터 가져오기
    let relatedExhibitions = [];
    if (artwork.exhibitionIds && artwork.exhibitionIds.length > 0) {
      // 모든 WORK 데이터 로드 (Exhibition 찾기 위해)
      const { getAllNotionDataServer } = await import('../../lib/notion-api-server');
      const { WORK } = await getAllNotionDataServer();
      const { extractExhibitionData } = await import('../../lib/exhibition-processor');

      // 모든 연결된 전시 찾기 (Promise.all로 병렬 처리)
      const exhibitionPromises = artwork.exhibitionIds.map(async (targetId) => {
        const exhibitionItem = WORK.find(item => item.id === targetId);
        if (exhibitionItem) {
          const processed = await extractExhibitionData(exhibitionItem);
          if (processed) {
            return {
              ...processed,
              imageUrl: null // Force remove image (User Req: "포스터만 빼고")
            };
          }
        }
        return null; // 못 찾으면 null
      });

      const results = await Promise.all(exhibitionPromises);
      // null 값 필터링
      relatedExhibitions = results.filter(item => item !== null);
    }

    return {
      props: {
        artwork,
        relatedExhibitions
      },
      revalidate: 300
    };
  } catch (error) {
    console.error('getStaticProps 오류:', error);
    return {
      notFound: true
    };
  }
}

