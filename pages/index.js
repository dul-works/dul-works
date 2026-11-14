// 홈 (Site-01)
import { useEffect } from 'react';
import Link from 'next/link';
import { Layout, Cover, TitlePair, WorkCard, Masonry } from '../components/ui';
import { getSite, exhibitionsOnHome, card, REVALIDATE } from '../lib/data';
import { rtText } from '../lib/blocks';
import sharp from 'sharp';

/** 대표 사진의 실제 크기 (R2 이미지 머리만 읽음). 모르면 가로로 취급 */
async function imageShape(src) {
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(10000) });
    const { width, height } = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    return { portrait: height > width, ratio: +(height / width).toFixed(4) };
  } catch {
    return { portrait: false, ratio: null };
  }
}

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

const HERO_FIT = `(function(){var el=document.getElementById('hero-portrait');if(!el)return;var r=parseFloat(el.style.getPropertyValue('--r'));function fit(){var w=el.getBoundingClientRect().width;el.dataset.size=(w/2*r>window.innerHeight)?'third':'half';}fit();window.addEventListener('resize',fit);})();`;

export default function Home({ hero, selected, now, upcoming, about, sloganKr }) {
  // 다른 페이지에서 넘어올 때는 위 인라인 스크립트가 돌지 않으므로 여기서 한 번 더
  useEffect(() => { if (hero?.portrait) new Function(HERO_FIT)(); }, [hero]);
  const groups = [['now on view', now], ['upcoming', upcoming]].filter(([, list]) => list.length);
  const [wide, ...rest] = selected;
  const alts = rest.slice(0, 2);
  const pairs = rest.slice(2);
  return (
    <Layout description={about?.en || SLOGAN_EN} image={hero?.cover}>
      <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>dul — new media artist, Seoul</h1>
      {hero && !hero.portrait && (
        <Link href={`/works/${hero.slug}`} className="card">
          <Cover src={hero.cover} className="hero" alt={hero.name} eager />
          <div className="wrap hero-meta">
            <TitlePair name={hero.name} nameKr={hero.nameKr} year={hero.year} as="h2" en="t-card" kr="t-card-kr" />
          </div>
        </Link>
      )}
      {hero && hero.portrait && (
        // 세로 이미지: 왼쪽에 콘텐츠 폭의 1/2, 그래도 화면보다 길면 1/3. 제목·연도는 오른쪽 아래
        <div className="wrap">
          <Link href={`/works/${hero.slug}`} className="card hero-portrait" id="hero-portrait" style={{ '--r': hero.ratio }}>
            <Cover src={hero.cover} className="hero-img" alt={hero.name} eager />
            <div className="hero-meta">
              <TitlePair name={hero.name} nameKr={hero.nameKr} year={hero.year} as="h2" en="t-card" kr="t-card-kr" />
            </div>
          </Link>
          {/* 그리기 전에 폭을 정해 깜빡임 없게: 1/2 폭에서 이미지 높이가 화면 높이를 넘으면 1/3 */}
          <script dangerouslySetInnerHTML={{ __html: HERO_FIT }} />
        </div>
      )}
      <div className="wrap">
        <div className={`home-top${groups.length ? '' : ' solo'}`}>
          <p className="slogan">
            <span className="t-stmt">{SLOGAN_EN}</span>
            <span className="t-stmt-kr" lang="ko">{sloganKr}</span>
          </p>
          {groups.length > 0 && (
            <div>
              {groups.map(([label, list], gi) => (
                <section key={label} aria-label={label} style={gi ? { marginTop: 40 } : undefined}>
                  <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{label}</h2>
                  {list.map((e) => (
                    <Link key={e.slug} href={`/exhibitions/${e.slug}`} className="now-row card">
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
              ))}
            </div>
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
                <WorkCard work={wide} />
              </div>
            )}
            {alts.map((w, i) => (
              <div key={w.slug} className={`sel-alt${i % 2 ? ' flip' : ''}`}>
                <Link href={`/works/${w.slug}`} className="card sel-img" tabIndex={-1} aria-hidden="true">
                  <Cover src={w.cover} />
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
              <Masonry cols={2} className="sel-pair">
                {pairs.map((w) => <WorkCard key={w.slug} work={w} />)}
              </Masonry>
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
  // Selected 체크한 작품만 Order 순으로 (첫 번째가 대표 사진). 체크가 없으면 대표 사진·selected works 칸 모두 숨김
  const picks = site.artworks.filter((a) => a.selected).sort((a, b) => a.order - b.order);
  const [hero, ...selected] = picks.map(card);
  if (hero) Object.assign(hero, await imageShape(hero.cover));

  const st = site.statement?.sections?.[0]?.items || [];
  const first = st.find((n) => n.t === 'p');
  const krHead = st.find((n) => n.t === 'h' && n.ko && !n.en);
  return {
    props: {
      hero: hero || null,
      selected,
      ...exhibitionsOnHome(site.exhibitions),
      about: first ? { en: rtText(first.en) || null, ko: rtText(first.ko) || null } : null,
      sloganKr: krHead ? rtText(krHead.ko).replace(/[.\s]*$/, '.') : SLOGAN_KR,
    },
    revalidate: REVALIDATE,
  };
}
