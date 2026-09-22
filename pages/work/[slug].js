import Layout from '../../components/Layout';
import Link from 'next/link';
import ImageGallery from '../../components/ImageGallery';
import RichParagraphs from '../../components/RichParagraphs';
import { getArtworkBySlug } from '../../lib/artwork-detail-processor';
import { createSlug } from '../../lib/slug-utils';


export default function ArtworkDetail({ artwork, relatedExhibitions }) {
  return (
    <Layout title={`Portfolio - ${artwork.name}`}>
      <ImageGallery images={artwork.images || []} name={artwork.name}>
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
          <div className="artwork-detail-page-text">
            {Array.isArray(artwork.pageText) && artwork.pageText.length > 0 ? (
              <RichParagraphs paragraphs={artwork.pageText} />
            ) : artwork.pageText && !Array.isArray(artwork.pageText) ? (
              <div>{artwork.pageText}</div>
            ) : (
              <div>none</div>
            )}
          </div>

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
      </ImageGallery>
    </Layout>
  );
}


export async function getServerSideProps({ params }) {
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
      // WORK 데이터 로드 (Exhibition 찾기 위해)
      const { getWORKDataServer } = await import('../../lib/notion-api-server');
      const WORK = await getWORKDataServer();
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
    };
  } catch (error) {
    console.error('getServerSideProps 오류:', error);
    return {
      notFound: true
    };
  }
}

