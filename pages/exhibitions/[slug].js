// 전시 상세 (전용 보드 없음 → 작품 상세 P3/Site-10의 짜임 + Site-04 톤)
// 위: [경로·제목·본문 글 EN | KR] | [정보 칸 → 포스터] → 본문 사진 → 출품작 → 관련 글
import Link from 'next/link';
import { Layout, WorkCard, RelationLists, Masonry, Rich } from '../../components/ui';
import Body from '../../components/Body';
import { getSite, getPageBody, byNewest, card, textRow, REVALIDATE } from '../../lib/data';
import { firstImage } from '../../lib/blocks';

const TEXT = new Set(['p', 'h', 'ul', 'ol', 'quote', 'callout']);

/** 본문의 글만: 짝마다 한 줄, 왼쪽 영문 | 오른쪽 국문 (모바일은 영문 위, 국문 아래) */
function TextPairs({ items }) {
  return (
    <div className="ex-text">
      {items.map((n, i) => {
        const Tag = n.t === 'h' ? 'h2' : 'p';
        const cls = n.t === 'h' ? ' ex-h' : '';
        return (
          <div key={i} className={`ex-row${n.en && n.ko ? '' : ' solo'}`}>
            {n.en && <Tag className={`en${cls}`}><Rich rt={n.en} /></Tag>}
            {n.ko && <Tag className={`kr${cls}`} lang="ko"><Rich rt={n.ko} lang="ko" /></Tag>}
          </div>
        );
      })}
    </div>
  );
}

export default function Exhibition({ e, poster, text, media, works, texts }) {
  const rows = [
    ['period', e.periodLabel],
    (e.venue || e.venueKr) && ['venue', e.venue, e.venueKr],
    ['type', `${e.kind} exhibition`],
  ].filter(Boolean);
  return (
    <Layout title={e.name} description={[`${e.kind} exhibition`, e.venue, e.periodLabel].filter(Boolean).join(', ')} image={poster}>
      <div className="wrap">
        {/* 왼쪽: 경로 → 제목 → (설명) → 본문 EN | KR / 오른쪽: 정보 칸 → 포스터. 모바일: 경로·제목 → 정보·포스터 → 본문 */}
        <div className="ex-top">
          <div className="ex-head">
            <nav aria-label="breadcrumb" className="crumbs">
              <Link href="/works?group=exhibition">exhibitions</Link> / <span aria-current="page">{e.name}</span>
            </nav>
            <h1>
              <span className="t-page" style={{ display: 'block' }}>{e.name}</span>
              {e.nameKr && e.nameKr !== e.name && <span className="t-page-kr" lang="ko" style={{ marginTop: 8 }}>{e.nameKr}</span>}
            </h1>
          </div>
          <div className="ex-side">
            <dl className="info">
              {rows.map(([k, en, ko]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{en}{ko && <span className="kr" lang="ko">{ko}</span>}</dd>
                </div>
              ))}
            </dl>
            {poster && (
              <figure className="ex-poster">
                <img src={poster} alt={`${e.name} poster`} style={{ width: '100%', height: 'auto' }} fetchpriority="high" />
              </figure>
            )}
          </div>
          <div className="ex-body">
            {(e.description || e.descriptionKr) && <TextPairs items={[{ t: 'p', en: e.description ? [{ x: e.description }] : null, ko: e.descriptionKr ? [{ x: e.descriptionKr }] : null }]} />}
            {text.length > 0 && <TextPairs items={text} />}
          </div>
        </div>
        {media.sections.length > 0 && <div className="ex-media"><Body body={media} mode="parallel" title={e.name} /></div>}
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
  return {
    props: {
      e,
      poster: e.cover || firstImage(body),
      // 글은 제목 아래로, 사진·영상·표는 아래 그리드로 (섹션 제목은 글 쪽에)
      text: body.sections.flatMap((sec) => [...(sec.head ? [{ t: 'h', ...sec.head }] : []), ...sec.items.filter((n) => TEXT.has(n.t))]),
      media: { ...body, sections: body.sections.map((sec) => ({ head: null, items: sec.items.filter((n) => !TEXT.has(n.t)) })).filter((sec) => sec.items.length) },
      works: site.artworks.filter((a) => a.exhibitionIds.includes(e.id)).sort(byNewest).map(card),
      texts: site.texts.filter((t) => t.workIds.includes(e.id)).map(textRow),
    },
    revalidate: REVALIDATE,
  };
}
