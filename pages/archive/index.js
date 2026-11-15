// archive (Site-08, 메뉴 이름 texts → archive): RELATED DB. 필터 = Type, 정렬 newest / oldest
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout, ext } from '../../components/ui';
import { getSite, REVALIDATE } from '../../lib/data';

export default function Texts({ texts, types }) {
  const router = useRouter();
  const type = types.includes(router.query.type) ? router.query.type : 'all';
  const sort = router.query.sort === 'oldest' ? 'oldest' : 'newest';
  const set = (k, v) => router.replace({ query: { ...router.query, [k]: v } }, undefined, { shallow: true, scroll: false });
  let list = type === 'all' ? texts : texts.filter((t) => t.type?.toLowerCase() === type);
  if (sort === 'oldest') list = [...list].reverse();

  return (
    <Layout title="archive" description="Critique, press, documentation and links about dul’s works and exhibitions.">
      <div className="wrap">
        <div className="page-head">
          <h1 className="t-page">archive</h1>
        </div>
        <div className="text-tabs">
          <div className="tabs" role="group" aria-label="filter by type">
            {['all', ...types].map((t) => <button key={t} type="button" aria-pressed={type === t} onClick={() => set('type', t)}>{t}</button>)}
          </div>
          <div className="tabs" role="group" aria-label="sort">
            <span className="tabs-key">sort</span>
            {['newest', 'oldest'].map((s) => <button key={s} type="button" aria-pressed={sort === s} onClick={() => set('sort', s)}>{s}</button>)}
          </div>
        </div>
        {list.length === 0 ? (
          <p className="empty-line">nothing here yet <Link href="/works" className="tlink" style={{ marginLeft: 12 }}>works</Link></p>
        ) : (
          <ul className="text-list">
            {list.map((t) => {
              const Title = (
                <>
                  <span className="t-card" style={{ display: 'block' }}>{t.name}{t.external && <span aria-hidden="true"> ↗</span>}</span>
                  {t.nameKr && <span className="t-card-kr" lang="ko" style={{ display: 'block', marginTop: 4 }}>{t.nameKr}</span>}
                </>
              );
              return (
                <li key={t.slug} className="text-row">
                  <div>
                    <h2 style={{ fontWeight: 'inherit' }}>{t.href ? <a className="title" href={t.href} {...ext(t.href)}>{Title}</a> : Title}</h2>
                    {t.on.length > 0 && (
                      <p className="on">on {t.on.map((o) => o.en).join(', ')}{t.on.some((o) => o.ko && o.ko !== o.en) && <span className="kr" lang="ko">{t.on.map((o) => o.ko || o.en).join(', ')}</span>}</p>
                    )}
                  </div>
                  <span className="col-by">{t.author || ''}</span>
                  <span className="col-src">{[t.publication, t.type?.toLowerCase()].filter(Boolean).join(', ')}</span>
                  <span className="col-year">{t.year || ''}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const site = await getSite();
  const names = {};
  for (const a of site.artworks) names[a.id] = { en: a.name, ko: a.nameKr };
  for (const p of site.projects) if (!p.etc) names[p.id] = { en: p.name, ko: p.nameKr };
  for (const e of [...site.exhibitions, ...site.hiddenExhibitions]) names[e.id] = { en: e.name, ko: e.nameKr }; // Post 꺼진 전시도 글자로
  const texts = site.texts.map((t) => ({
    slug: t.slug,
    name: t.name,
    nameKr: t.nameKr,
    type: t.type,
    author: t.author,
    publication: t.publication,
    year: t.year,
    href: t.readable ? `/archive/${t.slug}` : t.url,
    external: !t.readable && !!t.url,
    on: [...t.artworkIds, ...t.workIds].map((id) => names[id]).filter(Boolean).map((o) => ({ en: o.en, ko: o.ko && o.ko !== o.en ? o.ko : null })),
  }));
  const types = [...new Set(site.texts.map((t) => t.type?.toLowerCase()).filter(Boolean))].sort();
  return { props: { texts, types }, revalidate: REVALIDATE };
}
