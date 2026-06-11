import Layout from '../../components/Layout';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { getExhibitionBasicBySlug, getAllExhibitionSlugs, getExhibitionSecondaryData } from '../../lib/exhibition-detail-processor';
import { createSlug } from '../../lib/slug-utils';
import Link from 'next/link';

export default function ExhibitionDetail({ exhibition, relatedTexts = [], artworks = [] }) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Client-side fetching logic removed for Static Export compatibility

  if (!exhibition) {
    return (
      <Layout title="Portfolio - Exhibition Detail">
        <div>전시를 찾을 수 없습니다.</div>
      </Layout>
    );
  }

  // 팝업용: 모든 이미지를 정렬된 순서로
  const sortedImages = exhibition.images || [];

  // 이미지를 열별로 그룹화
  const column1Images = (exhibition.images || []).filter(img => img.column === 1);
  const column2Images = (exhibition.images || []).filter(img => img.column === 2);
  // 2열 레이아웃을 위해 모든 이미지 합치기
  const allImages = [...column1Images, ...column2Images];

  // 3번째 열에 이미지가 없으면 2번째 열 이미지가 2, 3번 열을 합친 크기로 표시
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
    <Layout title={`Portfolio - ${exhibition.name}`}>
      <div className={`artwork-detail-container ${!hasColumn2Images ? 'no-second-column' : ''}`}>
        {/* 1번째 열: 텍스트 정보 */}
        <div className="artwork-detail-text-column">
          <h2 className="artwork-detail-name">{exhibition.name}</h2>

          {/* Period와 Description EN */}
          {(exhibition.period || exhibition.description) && (
            <div className="artwork-detail-metadata">
              {exhibition.period && (
                <div className="artwork-detail-timeline">{exhibition.period}</div>
              )}
              {exhibition.description && (
                <div className="artwork-detail-caption">{exhibition.description}</div>
              )}
            </div>
          )}

          {/* EN 토글 텍스트 */}
          {exhibition.pageText && Array.isArray(exhibition.pageText) && exhibition.pageText.length > 0 ? (
            <div className="artwork-detail-page-text">
              {exhibition.pageText.map((paragraph, idx) => {
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
          ) : exhibition.pageText && !Array.isArray(exhibition.pageText) ? (
            <div className="artwork-detail-page-text">
              {exhibition.pageText}
            </div>
          ) : (
            <div className="artwork-detail-page-text">
              none
            </div>
          )}

          {/* ARTWORKS 섹션 (Static Data) */}
          <div className="exhibition-detail-artworks-section">
            <h3 className="exhibition-detail-artworks-title">ARTWORKS</h3>
            {artworks.length > 0 ? (
              <div className="exhibition-detail-artworks-list">
                {artworks.map((artwork, idx) => (
                  <Link
                    key={idx}
                    href={`/work/${artwork.slug}`}
                    className="exhibition-detail-artwork-item"
                  >
                    <div className="exhibition-detail-artwork-metadata">
                      <div className="exhibition-detail-artwork-name-wrapper">
                        <h4 className="exhibition-detail-artwork-name arrow-animated-link">{artwork.name}</h4>
                      </div>
                      {artwork.artist && (
                        <div className="exhibition-detail-artwork-artist">{artwork.artist}</div>
                      )}
                      {artwork.dimension && (
                        <div className="exhibition-detail-artwork-dimension">{artwork.dimension}</div>
                      )}
                      {artwork.caption && (
                        <div className="exhibition-detail-artwork-caption">{artwork.caption}</div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          {/* Related Text 섹션 (Static Data) */}
          {relatedTexts.length > 0 && (
            <div className="exhibition-detail-related-text">
              <h2 className="artwork-detail-name">RELATED</h2>
              <div className="exhibition-detail-related-links">
                {relatedTexts.map((relatedText, idx) => {
                  const isExternal = !!relatedText.url;
                  const href = isExternal ? relatedText.url : `/exhibition/${exhibition.slug}/related/${createSlug(relatedText.title)}`;

                  return (
                    <div key={idx} className="exhibition-detail-related-link-wrapper">
                      <Link
                        href={href}
                        className="exhibition-detail-related-link"
                        target={isExternal ? "_blank" : undefined}
                        rel={isExternal ? "noopener noreferrer" : undefined}
                      >
                        <span className="exhibition-detail-related-link-text" style={{ display: 'flex', flexDirection: 'column' }}>
                          {relatedText.type && relatedText.rawTitle ? (
                            <>
                              <h4 className="arrow-animated-link" style={{ marginBottom: '5px' }}>{relatedText.rawTitle}</h4>
                              <span style={{ opacity: 0.3 }}>{relatedText.type}</span>
                            </>
                          ) : (
                            relatedText.title
                          )}
                        </span>
                      </Link>
                    </div>
                  );
                })}
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
                  alt={`${exhibition.name} - Image ${image.row}`}
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
                    alt={`${exhibition.name} - Image ${image.row}`}
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
            const imageIndex = idx;
            return (
              <div
                key={idx}
                className="artwork-detail-image-wrapper"
                onClick={() => handleImageClick(imageIndex)}
              >
                <Image
                  src={image.path}
                  alt={`${exhibition.name} - Image ${idx + 1}`}
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

      {/* 이미지 확대 팝업 */}
      {isPopupOpen && sortedImages.length > 0 && (
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
                src={sortedImages[currentImageIndex].path}
                alt={`${exhibition.name} - Image ${currentImageIndex + 1}`}
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
      )}
    </Layout>
  );
}

export async function getStaticPaths() {
  try {
    const slugs = await getAllExhibitionSlugs();

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
    // Basic 데이터
    const exhibition = await getExhibitionBasicBySlug(params.slug);

    if (!exhibition) {
      return {
        notFound: true
      };
    }

    // Secondary 데이터 (Related Texts, Artworks)
    const secondaryData = await getExhibitionSecondaryData(params.slug);

    return {
      props: {
        exhibition,
        relatedTexts: secondaryData.relatedTexts || [],
        artworks: secondaryData.artworks || []
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

