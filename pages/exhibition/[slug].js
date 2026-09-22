import Layout from '../../components/Layout';
import ImageGallery from '../../components/ImageGallery';
import RichParagraphs from '../../components/RichParagraphs';
import { getExhibitionBasicBySlug, getExhibitionSecondaryData } from '../../lib/exhibition-detail-processor';
import { createSlug } from '../../lib/slug-utils';
import Link from 'next/link';

export default function ExhibitionDetail({ exhibition, relatedTexts = [], artworks = [] }) {
  return (
    <Layout title={`Portfolio - ${exhibition.name}`}>
      <ImageGallery images={exhibition.images || []} name={exhibition.name}>
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
          <div className="artwork-detail-page-text">
            {Array.isArray(exhibition.pageText) && exhibition.pageText.length > 0 ? (
              <RichParagraphs paragraphs={exhibition.pageText} />
            ) : exhibition.pageText && !Array.isArray(exhibition.pageText) ? (
              exhibition.pageText
            ) : (
              'none'
            )}
          </div>

          {/* ARTWORKS 섹션 */}
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

          {/* Related Text 섹션 */}
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
      </ImageGallery>
    </Layout>
  );
}


export async function getServerSideProps({ params }) {
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
    };
  } catch (error) {
    console.error('getServerSideProps 오류:', error);
    return {
      notFound: true
    };
  }
}

