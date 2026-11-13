// 홈 (Site-01)
import Link from 'next/link';
import { Layout, Cover, TitlePair, WorkCard } from '../components/ui';
import { getSite, nowOnView, byNewest, card, REVALIDATE } from '../lib/data';
import { rtText } from '../lib/blocks';

const SLOGAN_EN = 'using technology to sustain what technology threatens to erase.';
const SLOGAN_KR = '기술로 인해 사라질 것들을, 기술로 지속시킨다.';

function Desc({ w }) {
  if (!w.description && !w.descriptionKr) return null;
  return (
    <p className="card-desc" style={{ fontSize: 16 }}>
      {w.description}
      {w.descriptionKr && <span className="kr" lang="ko">{w.descriptionKr}</span>}
    </p>
  );
}

export default function Home({ hero, selected, now, about, sloganKr }) {
  const [wide, ...rest] = selected;
  const alts = rest.slice(0, 2);
  const pairs = rest.slice(2);
  return (
    <Layout description={about?.en || SLOGAN_EN} image={hero?.cover}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>dul — new media artist, Seoul</h1>
      {hero && (
        <Link href={`/works/${hero.slug}`} className="card">
          <Cover src={hero.cover} className="hero" alt={hero.name} eager />
          <div className="wrap hero-meta">
            <TitlePair name={hero.name} nameKr={hero.nameKr} year={hero.year} as="h2" en="t-card" kr="t-card-kr" />
          </div>
        </Link>
      )}
      <div className="wrap">
        <div className={`home-top${now.length ? '' : ' solo'}`}>
          <p className="slogan">
            <span className="t-stmt">{SLOGAN_EN}</span>
            <span className="t-stmt-kr" lang="ko">{sloganKr}</span>
          </p>
          {now.length > 0 && (
            <section aria-labelledby="now-h">
              <h2 id="now-h" style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>now on view</h2>
              {now.map((e) => (
                <Link key={e.slug} href={`/works?group=exhibition#${e.slug}`} className="now-row card">
                  <Cover src={e.cover} className="poster" alt={`${e.name} poster`} />
                  <div className="info">
                    <TitlePair name={e.name} nameKr={e.nameKr} as="h3" />
                    {e.venue && <span style={{ marginTop: 8 }}>{e.venue}</span>}
                    {e.venueKr && <span className="kr" lang="ko" style={{ fontSize: 15 }}>{e.venueKr}</span>}
                    <span className="gray" style={{ fontSize: 14, marginTop: 4 }}>{e.periodLabel}</span>
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>

        {about && (
          <section className="about rule" aria-labelledby="about-h">
            <h2 id="about-h" className="section-label">about</h2>
            <div className="about-text">
              {about.en && <p className="en">{about.en}</p>}
              {about.ko && <p className="kr" lang="ko">{about.ko}</p>}
              <div><Link href="/cv#statement" className="tlink" style={{ fontSize: 17 }}>about dul</Link></div>
            </div>
          </section>
        )}

        {selected.length > 0 && (
          <>
            <div className="selected-head rule">
              <h2 className="section-label">selected works</h2>
              <Link href="/works" className="tlink" style={{ minHeight: 'auto' }}>all works</Link>
            </div>
            {wide && (
              <div className="sel-wide">
                <WorkCard work={wide} ratio="ratio-169" />
              </div>
            )}
            {alts.map((w, i) => (
              <div key={w.slug} className={`sel-alt${i % 2 ? ' flip' : ''}`}>
                <Link href={`/works/${w.slug}`} className="card sel-img" tabIndex={-1} aria-hidden="true">
                  <Cover src={w.cover} className="ratio-43" />
                </Link>
                <div>
                  <Link href={`/works/${w.slug}`} className="card">
                    <TitlePair name={w.name} nameKr={w.nameKr} year={w.year} />
                  </Link>
                  <Desc w={w} />
                </div>
              </div>
            ))}
            {pairs.length > 0 && (
              <div className="sel-pair">
                {pairs.map((w) => <WorkCard key={w.slug} work={w} />)}
              </div>
            )}
            <div className="all-works">
              <Link href="/works" className="tlink" style={{ fontSize: 18 }}>all works</Link>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const site = await getSite();
  // Featured 체크한 작품을 Order 순으로. 아직 아무것도 체크되지 않았으면 최신 작품 6점
  let picks = site.artworks.filter((a) => a.featured).sort((a, b) => a.order - b.order);
  if (!picks.length) picks = [...site.artworks].filter((a) => a.cover).sort(byNewest).slice(0, 6);
  const [hero, ...selected] = picks.map(card);

  const st = site.statement?.sections?.[0]?.items || [];
  const first = st.find((n) => n.t === 'p');
  const krHead = st.find((n) => n.t === 'h' && n.ko && !n.en);
  return {
    props: {
      hero: hero || null,
      selected,
      now: nowOnView(site.exhibitions),
      about: first ? { en: rtText(first.en) || null, ko: rtText(first.ko) || null } : null,
      sloganKr: krHead ? rtText(krHead.ko).replace(/[.\s]*$/, '.') : SLOGAN_KR,
    },
    revalidate: REVALIDATE,
  };
}
