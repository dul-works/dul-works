// 작품 상세 (Dul-P3)
import Link from 'next/link';
import { Layout, TitlePair, WorkCard, RelationLists, Masonry } from '../../components/ui';
import Body from '../../components/Body';
import { getSite, getPageBody, byNewest, card, exhibitedRow, textRow, periodCmp, REVALIDATE } from '../../lib/data';
import { firstImage, rtText } from '../../lib/blocks';

function Info({ w, credits }) {
  const rows = [
    w.year && ['year', w.year],
    (w.caption || w.captionKr) && ['medium', w.caption, w.captionKr],
    w.dimension && ['dimensions', w.dimension],
    w.artist && !/^dul$/i.test(w.artist) && ['artist', w.artist],
    ...credits.map((r, i) => [i === 0 ? 'credits' : '', r.en, r.ko]),
  ].filter(Boolean);
  if (!rows.length) return null;
  return (
    <dl className="info">
      {rows.map(([k, en, ko], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd>{en}{ko && <span className="kr" lang="ko">{ko}</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Work({ w, project, body, cover, credits, exhibited, texts, also, prev, next }) {
  return (
    <Layout title={w.name} description={w.description || w.caption || undefined} image={cover}>
      <div className="wrap">
        <div className="work-top">
          <div>
            <nav aria-label="breadcrumb" className="crumbs">
              <Link href="/works">works</Link> /{' '}
              {project ? (
                <><Link href={`/projects/${project.slug}`}>{project.name}{project.nameKr && <> <span lang="ko">{project.nameKr}</span></>}</Link> / </>
              ) : null}
              <span aria-current="page">{w.name}{w.nameKr && <> <span lang="ko">{w.nameKr}</span></>}</span>
            </nav>
            <h1>
              <span className="t-page" style={{ display: 'block' }}>{w.name}</span>
              {w.nameKr && <span className="t-page-kr" lang="ko">{w.nameKr}</span>}
            </h1>
          </div>
          <div className="info-wrap"><Info w={w} credits={credits} /></div>
        </div>
        {cover && (
          <figure className="work-cover bleed">
            <img src={cover} alt={`${w.name}, image 1`} style={{ width: '100%', height: 'auto' }} fetchpriority="high" />
          </figure>
        )}
        <Body zoom body={body} mode="parallel" title={w.name} defaultHead={{ en: [{ x: 'about the work' }] }} skip={(s) => /^credits$/i.test(rtText(s.head?.en).trim())} />
        <RelationLists exhibited={exhibited} texts={texts} />
        {also.length > 0 && (
          <section className="also rule">
            <div className="head">
              <h2 className="section-label">also in project ‘{project.name}’</h2>
              <Link href={`/projects/${project.slug}`} className="tlink tlink-tight">view project</Link>
            </div>
            <Masonry cols={4} rowwise>{also.map((a) => <WorkCard key={a.slug} work={a} />)}</Masonry>
          </section>
        )}
        <nav className="prevnext" aria-label="previous and next work">
          {prev && (
            <Link href={`/works/${prev.slug}`} rel="prev">
              <span className="gray" style={{ fontSize: 14 }}><span aria-hidden="true">← </span>previous</span>
              <TitlePair name={prev.name} nameKr={prev.nameKr} as="span" />
            </Link>
          )}
          {next && (
            <Link href={`/works/${next.slug}`} rel="next" className="next">
              <span className="gray" style={{ fontSize: 14 }}>next<span aria-hidden="true"> →</span></span>
              <TitlePair name={next.name} nameKr={next.nameKr} as="span" />
            </Link>
          )}
        </nav>
      </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  const site = await getSite();
  return { paths: site.artworks.map((a) => ({ params: { slug: a.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const site = await getSite();
  const slug = decodeURIComponent(params.slug);
  const a = site.artworks.find((x) => x.slug === slug);
  if (!a) {
    // 예전 주소(/work/작품-이름) → 새 Slug
    const old = site.artworks.find((x) => x.oldSlug === slug);
    return old ? { redirect: { destination: `/works/${old.slug}`, permanent: true } } : { notFound: true, revalidate: 60 };
  }
  const body = await getPageBody(a.id);
  const creditsSec = body.sections.find((s) => /^credits$/i.test(rtText(s.head?.en).trim()));
  const credits = (creditsSec?.items.find((n) => n.t === 'table')?.rows || []).map((r) => {
    const cells = r.map(rtText);
    const ko = cells.find((c, i) => i > 0 && /[가-힣]/.test(c));
    return { en: cells.filter((c) => c && c !== ko).join(' — '), ko: ko ? `${cells[0]} — ${ko}` : null };
  });

  const project = site.projects.find((p) => p.id === a.projectId) || null;
  const ordered = [...site.artworks].sort(byNewest);
  const i = ordered.findIndex((x) => x.id === a.id);
  const pn = (x) => (x ? { slug: x.slug, name: x.name, nameKr: x.nameKr } : null);

  return {
    props: {
      w: a,
      project: project && { slug: project.slug, name: project.name, nameKr: project.nameKr },
      body,
      cover: a.cover || firstImage(body),
      credits,
      exhibited: [...site.exhibitions, ...site.hiddenExhibitions].filter((e) => a.exhibitionIds.includes(e.id)).sort(periodCmp).map(exhibitedRow),
      texts: site.texts.filter((t) => t.artworkIds.includes(a.id)).map(textRow),
      also: project ? ordered.filter((x) => x.projectId === project.id && x.id !== a.id).map(card) : [],
      prev: pn(ordered[i - 1]),
      next: pn(ordered[i + 1]),
    },
    revalidate: REVALIDATE,
  };
}
