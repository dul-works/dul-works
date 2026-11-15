// 프로젝트 (Site-04, 연구 페이지): column 모드, 섹션 번호 자동, 끝에 works · exhibited · archive
import Link from 'next/link';
import { Layout, WorkCard, Masonry, ext } from '../../components/ui';
import Body, { FileButton } from '../../components/Body';
import { getSite, getPageBody, byNewest, card, exhibitedRow, textRow, periodCmp, REVALIDATE } from '../../lib/data';

const pad2 = (n) => String(n).padStart(2, '0');

function RelCol({ no, title, rows }) {
  return (
    <section>
      <h2 className="sec-head" style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <span className="no gray" style={{ fontSize: 15 }}>{pad2(no)}</span>
        <span className="t-head">{title}</span>
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {rows.map((r) => (
          <li key={r.key} style={{ fontSize: 16, lineHeight: 1.45 }}>
            {r.href ? (
              <a href={r.href} {...ext(r.href)} style={{ textDecoration: 'none' }}>
                <span>{r.en}{r.year ? `, ${r.year}` : ''}{r.external && <span aria-hidden="true"> ↗</span>}</span>
                {r.ko && <span className="kr" lang="ko" style={{ display: 'block', fontSize: 15 }}>{r.ko}</span>}
              </a>
            ) : (
              <span>{r.en}{r.year ? `, ${r.year}` : ''}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Project({ p, body, buttons, works, exhibited, texts }) {
  const headed = body.sections.filter((s) => s.head).length;
  let no = headed;
  return (
    <Layout title={p.name} description={p.description || undefined} image={p.cover}>
      <div className="wrap">
        <header className="proj-top">
          <p className="gray" style={{ fontSize: 15 }}>project{p.period ? `, ${p.period}` : ''}</p>
          <h1>{p.name}</h1>
          {p.nameKr && p.nameKr !== p.name && <p className="t-kr" lang="ko">{p.nameKr}</p>}
          {buttons.length > 0 && <div className="buttons">{buttons.map((b, i) => <FileButton key={i} n={b} />)}</div>}
        </header>
        {p.cover && (
          <figure className="col proj-cover">
            <img src={p.cover} alt={`${p.name}, cover`} style={{ width: '100%', height: 'auto' }} fetchpriority="high" />
          </figure>
        )}
        <Body body={body} mode="column" title={p.name} />
        <div className="col">
          {works.length > 0 && (
            <section className="sec">
              <h2 className="sec-head" style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                <span className="no gray" style={{ fontSize: 15 }}>{pad2(++no)}</span>
                <span className="t-head">works</span>
              </h2>
              <Masonry cols={3} rowwise className="mt24">{works.map((w) => <WorkCard key={w.slug} work={w} />)}</Masonry>
            </section>
          )}
          {(exhibited.length > 0 || texts.length > 0) && (
            <div className="relations" style={{ paddingTop: 0 }}>
              {exhibited.length > 0 && <RelCol no={++no} title="exhibited" rows={exhibited.map((e) => ({ ...e, year: null }))} />}
              {texts.length > 0 && <RelCol no={++no} title="archive" rows={texts} />}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  const site = await getSite();
  return { paths: site.projects.filter((p) => !p.etc).map((p) => ({ params: { slug: p.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const site = await getSite();
  const p = site.projects.find((x) => x.slug === decodeURIComponent(params.slug) && !x.etc);
  if (!p) return { notFound: true, revalidate: 60 };
  const body = await getPageBody(p.id);
  // 첫 제목 앞의 북마크·파일 = 제목 블록 버튼 줄
  const buttons = [];
  const intro = body.sections[0];
  if (intro && !intro.head) {
    intro.items = intro.items.filter((n) => {
      if (n.t === 'bookmark' || n.t === 'file') {
        buttons.push(n.t === 'bookmark' ? { url: n.url, cap: n.cap, name: n.url } : n);
        return false;
      }
      return true;
    });
    if (!intro.items.length) body.sections.shift();
  }
  const works = site.artworks.filter((a) => a.projectId === p.id).sort(byNewest);
  const workIds = new Set(works.map((w) => w.id));
  const exhibitions = [...site.exhibitions, ...site.hiddenExhibitions].filter((e) => works.some((w) => w.exhibitionIds.includes(e.id))).sort(periodCmp);
  const exIds = new Set(exhibitions.map((e) => e.id));
  // 프로젝트·작품·작품이 나온 전시에 연결된 글
  const texts = site.texts.filter((t) => t.workIds.includes(p.id) || t.workIds.some((id) => exIds.has(id)) || t.artworkIds.some((id) => workIds.has(id)));
  return {
    props: {
      p,
      body,
      buttons,
      works: works.map(card),
      exhibited: exhibitions.map((e) => ({ ...exhibitedRow(e), en: [e.name, e.venue].filter(Boolean).join(', ') + (e.year ? `, ${e.year}` : ''), ko: e.nameKr ? [e.nameKr, e.venueKr].filter(Boolean).join(', ') + (e.year ? `, ${e.year}` : '') : null })),
      texts: texts.map(textRow),
    },
    revalidate: REVALIDATE,
  };
}
