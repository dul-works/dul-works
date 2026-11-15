// 글 읽기 (Site-09): EN | KR 두 열. 모바일은 both / EN / KR 전환
import { useState } from 'react';
import Link from 'next/link';
import { Layout, Rich } from '../../components/ui';
import { getSite, getPageBody, REVALIDATE } from '../../lib/data';

function Column({ items, side }) {
  return items.filter((n) => n[side]).map((n, i) => {
    const Tag = n.t === 'h' ? 'h2' : 'p';
    return <Tag key={i} style={n.t === 'h' ? { fontWeight: 600, fontSize: 19 } : undefined}><Rich rt={n[side]} lang={side === 'ko' ? 'ko' : undefined} /></Tag>;
  });
}

export default function Read({ t, items, lang, about }) {
  const [show, setShow] = useState('both');
  const hasEn = items.some((n) => n.en);
  const hasKo = items.some((n) => n.ko);
  const both = hasEn && hasKo;
  const label = [t.type?.toLowerCase(), t.publication, t.year].filter(Boolean).join(', ');
  return (
    <Layout title={t.name} description={label || undefined}>
      <div className="wrap">
        <header className="read-top">
          {label && <p className="gray" style={{ fontSize: 15 }}>{label}</p>}
          <h1>
            <span className="t-page" style={{ display: 'block', fontSize: 'clamp(33px, 4.8vw, 69px)' }}>{t.name}</span>
            {t.nameKr && <span className="t-page-kr" lang="ko" style={{ marginTop: 8 }}>{t.nameKr}</span>}
          </h1>
          {t.author && <p style={{ marginTop: 18, fontSize: 17 }}>by {t.author}</p>}
          {both && (
            <div className="tabs read-switch" role="group" aria-label="language">
              {[['both', 'both'], ['en', 'EN'], ['ko', 'KR']].map(([k, l]) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{l}</button>)}
            </div>
          )}
        </header>
        <div className={`read-body${both ? '' : ' solo'}`} data-show={show}>
          {hasEn && (
            <div className="en">
              {both && <p className="lang-head">english</p>}
              <Column items={items} side="en" />
            </div>
          )}
          {hasKo && (
            <div className="kr" lang="ko">
              {both && <p className="lang-head">korean</p>}
              <Column items={items} side="ko" />
            </div>
          )}
        </div>
        <div className="read-foot">
          {about.length > 0 && (
            <section>
              <h2 className="section-label">about</h2>
              <div className="rows">
                {about.map((a) => {
                  const inner = (<>{a.en}{a.ko && <span className="kr" lang="ko">{a.ko}</span>}</>);
                  // 페이지가 없는 전시(Post 꺼짐)는 링크 없이 글자만
                  return a.href ? <Link key={a.en} href={a.href} style={{ textDecoration: 'none' }}>{inner}</Link> : <span key={a.en}>{inner}</span>;
                })}
              </div>
            </section>
          )}
          {(t.publication || t.url) && (
            <section>
              <h2 className="section-label">source</h2>
              <div className="rows">
                {t.publication && <span>{t.publication}{t.year ? `, ${t.year}` : ''}</span>}
                {t.url && <a className="tlink" href={t.url} style={{ minHeight: 'auto' }}>original{t.isFile ? ' (pdf)' : ''}</a>}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  const site = await getSite();
  return { paths: site.texts.filter((t) => t.readable).map((t) => ({ params: { slug: t.slug } })), fallback: 'blocking' };
}

export async function getStaticProps({ params }) {
  const site = await getSite();
  const t = site.texts.find((x) => x.slug === decodeURIComponent(params.slug));
  if (!t) return { notFound: true, revalidate: 60 };
  if (!t.readable) return t.url ? { redirect: { destination: t.url, permanent: false } } : { notFound: true, revalidate: 60 };
  const body = await getPageBody(t.id);
  const items = body.sections.flatMap((s) => [...(s.head ? [{ t: 'h', ...s.head }] : []), ...s.items.filter((n) => n.en || n.ko)]);
  // '글. 이름' 같은 서명 줄은 필자 칸이 비었을 때 필자로
  const sign = items.length && items[items.length - 1];
  const signText = sign && (sign.ko || sign.en || []).map((r) => r.x).join('');
  const m = signText && signText.match(/^\s*(?:글|text|written by)\s*[.:·]?\s*(.{1,30})$/i);
  const author = t.author || (m ? m[1].trim() : null);
  if (m) items.pop();
  const about = [
    ...site.artworks.filter((a) => t.artworkIds.includes(a.id)).map((a) => ({ href: `/works/${a.slug}`, en: a.name, ko: a.nameKr })),
    ...site.projects.filter((p) => !p.etc && t.workIds.includes(p.id)).map((p) => ({ href: `/projects/${p.slug}`, en: `project ‘${p.name}’`, ko: p.nameKr || null })),
    ...[...site.exhibitions, ...site.hiddenExhibitions].filter((e) => t.workIds.includes(e.id)).map((e) => ({ href: e.slug && site.exhibitions.includes(e) ? `/exhibitions/${e.slug}` : null, en: e.name, ko: e.nameKr })),
  ];
  return { props: { t: { ...t, author }, items, lang: body.lang, about }, revalidate: REVALIDATE };
}
