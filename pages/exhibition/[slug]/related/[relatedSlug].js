import Layout from '../../../../components/Layout';
import { getExhibitionBySlug, getRelatedTextPage } from '../../../../lib/exhibition-detail-processor';
import { createSlug } from '../../../../lib/slug-utils';
import { getImageUrl } from '../../../../lib/notion-utils';
import RichParagraphs from '../../../../components/RichParagraphs';

export default function ExhibitionRelatedText({ relatedText }) {
  return (
    <Layout title={`Portfolio - ${relatedText.title || 'Related Text'}`}>
      <div className="related-text-page-container">
        <h1 className="related-text-page-title">{relatedText.title || 'Related Text'}</h1>

        {relatedText.pdfUrl ? (
          <div className="pdf-container" style={{ width: '100%', height: '80vh' }}>
            <embed
              src={relatedText.pdfUrl}
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

    // PDF는 R2의 pdf/ 에서 제공 (scripts/sync-images-to-r2.js가 업로드)
    let pdfUrl = null;
    if (relatedText.contentType === 'file' && relatedText.fileName) {
      const fileName = relatedText.fileName.endsWith('.pdf') ? relatedText.fileName : relatedText.fileName + '.pdf';
      pdfUrl = getImageUrl(`pdf/${fileName}`);
    }

    return {
      props: {
        relatedText: {
          ...relatedText,
          pdfUrl,
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

