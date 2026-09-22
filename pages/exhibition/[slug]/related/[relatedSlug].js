import Layout from '../../../../components/Layout';
import { getExhibitionBySlug, getRelatedTextPage } from '../../../../lib/exhibition-detail-processor';
import { createSlug } from '../../../../lib/slug-utils';
import RichParagraphs from '../../../../components/RichParagraphs';

export default function ExhibitionRelatedText({ relatedText }) {
  return (
    <Layout title={`Portfolio - ${relatedText.title || 'Related Text'}`}>
      <div className="related-text-page-container">
        <h1 className="related-text-page-title">{relatedText.title || 'Related Text'}</h1>

        {relatedText.contentType === 'file' && relatedText.fileName ? (
          <div className="pdf-container" style={{ width: '100%', height: '80vh' }}>
            <embed
              src={`/assets/pdf/${encodeURIComponent(relatedText.fileName.endsWith('.pdf') ? relatedText.fileName : relatedText.fileName + '.pdf')}`}
              type="application/pdf"
              width="100%"
              height="100%"
            />
          </div>
        ) : (
          relatedText.content && (
            <div className="related-text-page-content">
              {Array.isArray(relatedText.content) ? (
                <RichParagraphs paragraphs={relatedText.content} />
              ) : (
                <div>{relatedText.content}</div>
              )}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}


export async function getServerSideProps({ params }) {
  try {
    const exhibition = await getExhibitionBySlug(params.slug, false);

    if (!exhibition) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[RelatedText] 전시를 찾을 수 없음: ${params.slug}`);
      }
      return {
        notFound: true
      };
    }

    // Related Text 찾기
    const relatedText = exhibition.relatedTexts?.find(rt => {
      const rtSlug = createSlug(rt.title);
      return rtSlug === params.relatedSlug;
    });

    if (!relatedText) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[RelatedText] 관련 텍스트를 찾을 수 없음: ${params.relatedSlug} in ${params.slug}`);
      }
      return {
        notFound: true
      };
    }

    // Related Text 페이지 내용 가져오기
    const relatedTextContent = await getRelatedTextPage(relatedText.pageId);

    return {
      props: {
        relatedText: {
          ...relatedText,
          content: relatedTextContent?.content || []
        }
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[RelatedText] getServerSideProps 오류 (${params.slug}/${params.relatedSlug}):`, error);
    }
    return {
      notFound: true
    };
  }
}

