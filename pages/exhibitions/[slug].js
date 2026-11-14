// 전시 상세 (전용 보드 없음 → 작품 상세 P3/Site-10의 짜임 + Site-04 톤)
// 위: 경로, 제목(EN/KR) | 정보 칸(기간·장소·종류) → 포스터(원본 비율) | 설명 → 본문(EN | KR) → 출품작 → 관련 글
import Link from 'next/link';
import { Layout, WorkCard, RelationLists, Masonry } from '../../components/ui';
import Body from '../../components/Body';
import { getSite, getPageBody, byNewest, card, textRow, REVALIDATE } from '../../lib/data';
import { firstImage } from '../../lib/blocks';

export default function Exhibition({ e, poster, body, works, texts }) {
  const rows = [
    ['period', e.periodLabel],
    (e.venue || e.venueKr) && ['venue', e.venue, e.venueKr],
    ['type', `${e.kind} exhibition`],
  ].filter(Boolean);
  const hasDesc = e.description || e.descriptionKr;
  return (
    <Layout title={e.name} description={[`${e.kind} exhibition`, e.venue, e.periodLabel].filter(Boolean).join(', ')} image={poster}>
      <div className="wrap">
        <div className="work-top">
          <div>
            <nav aria-label="breadcrumb" className="crumbs">
              <Link href="/works?group=exhibition">exhibitions</Link> / <span aria-current="page">{e.name}</span>
            </nav>
            <h1>
              <span className="t-page" style={{ display: 'block' }}>{e.name}</span>
              {e.nameKr && e.nameKr !== e.name && <span className="t-page-kr" lang="ko" style={{ marginTop: 8 }}>{e.nameKr}</span>}
            </h1>
          </div>
          <div className="info-wrap">
            <dl className="info">
              {rows.map(([k, en, ko]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{en}{ko && <span className="kr" lang="ko">{ko}</span>}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {(poster || hasDesc) && (
          <div className={`ex-lead${poster ? "" : " solo"}`}>
            {poster && (
              <figure className="ex-poster">
                <img src={poster} alt={`${e.name} poster`} style={{ width: '100%', height: 'auto' }} fetchpriority="high" />
              </figure>
            )}
            {hasDesc && (
              <div className="ex-desc">
                {e.description && <p className="en">{e.description}</p>}
                {e.descriptionKr && <p className="kr" lang="ko">{e.descriptionKr}</p>}
              </div>
            )}
          </div>
        )}
        <Body body={body} mode="parallel" title={e.name} defaultHead={{ en: [{ x: 'about the exhibition' }] }} />
        {works.length > 0 && (
          <section className="also rule">
            <div className="head"><h2 className="section-label">works shown</h2></div>
            <Masonry cols={3}>{works.map((w) => <WorkCard key={w.slug} work={w} />)}</Masonry>
          </section>
        )}
        <RelationLists exhibited={[]} texts={texts} />
      </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  const site = await getSite();
  return { paths: site.exhibitions.map((e) => ({ params: { slug: e.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const site = await getSite();
  const e = site.exhibitions.find((x) => x.slug === decodeURIComponent(params.slug));
  if (!e) return { notFound: true, revalidate: 60 };
  const body = await getPageBody(e.id);
  // 예전 노션 데이터는 Description에 장소를 적어 둠 → 장소와 같으면 설명으로 쓰지 않음
  const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
  return {
    props: {
      e: { ...e, description: same(e.description, e.venue) ? null : e.description, descriptionKr: same(e.descriptionKr, e.venueKr) ? null : e.descriptionKr },
      poster: e.cover || firstImage(body),
      body,
      works: site.artworks.filter((a) => a.exhibitionIds.includes(e.id)).sort(byNewest).map(card),
      texts: site.texts.filter((t) => t.workIds.includes(e.id)).map(textRow),
    },
    revalidate: REVALIDATE,
  };
}
