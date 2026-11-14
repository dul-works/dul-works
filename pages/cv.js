// cv (Site-07). 전시 이력은 WORKS에서, 나머지(학력·수상·레지던시·참여작)는 CV DB에서
import Link from 'next/link';
import { Layout, Rich } from '../components/ui';
import { getSite, REVALIDATE } from '../lib/data';

const yearSpan = (a, b) => (a && b && b !== a ? `${a} – ${b}` : a || '');

// 3단: 연도 | 영문(항목명, 아래 장소 등) | 국문(Name(KR), 국문 장소). 국문 값이 없으면 빈 칸 (영문을 복사하지 않음)
function Section({ title, rows }) {
  if (!rows.length) return null;
  return (
    <section className="cv-sec">
      <h2>{title}</h2>
      <ul className="cv-rows">
        {rows.map((r) => (
          <li key={r.key} className="cv-row">
            <span className="yr">{r.year}</span>
            <span className="cv-en">
              {r.href ? <Link href={r.href}>{r.en}</Link> : r.en}
              {r.enSub && <span className="sub">{r.enSub}</span>}
            </span>
            <span className="cv-kr" lang="ko">
              {r.ko}
              {r.koSub && <span className="sub">{r.koSub}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CV({ statement, sections }) {
  return (
    <Layout title="cv" description="dul (Lee Jiwon), new media artist based in Seoul. Exhibitions, education, awards and residencies.">
      <div className="wrap">
        <div className="cv-top">
          <div>
            <h1>
              <span className="t-page" style={{ display: 'block' }}>dul</span>
              <span className="t-page-kr" lang="ko" style={{ marginTop: 6 }}>둘</span>
            </h1>
            <p className="bio">
              b. 2000, Seoul. Lives and works in Seoul.
              <span className="kr" lang="ko">2000년 서울 출생. 서울에서 활동.</span>
            </p>
          </div>
          {statement.length > 0 && (
            <section id="statement" className="statement" aria-label="artist statement">
              {statement.map((p, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {p.en && <p><Rich rt={p.en} /></p>}
                  {p.ko && <p className="kr" lang="ko"><Rich rt={p.ko} lang="ko" /></p>}
                </div>
              ))}
            </section>
          )}
        </div>
        {sections.map((s) => <Section key={s.title} {...s} />)}
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const site = await getSite();
  const { cv } = site;
  const kr = (ko, en) => (ko && ko !== en ? ko : null);
  const ex = (kind) => site.exhibitions.filter((e) => e.kind === kind).map((e) => ({
    key: e.slug, year: e.year, en: e.name, enSub: e.venue, ko: kr(e.nameKr, e.name), koSub: e.venueKr, href: `/exhibitions/${e.slug}`,
  }));
  const sections = [
    { title: 'education', rows: cv.education.map((r) => ({ key: r.id, year: yearSpan(r.year, r.endYear), en: r.place || r.name, enSub: [r.name, r.client].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name) })) },
    { title: 'solo exhibitions', rows: ex('solo') },
    { title: 'group exhibitions', rows: ex('group') },
    { title: 'grants and awards', rows: cv.awards.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.place?.trim()].filter(Boolean).join(', '), enSub: r.client, ko: kr(r.nameKr, r.name) })) },
    { title: 'artist in residency', rows: cv.residency.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.client].filter(Boolean).join(', '), enSub: r.place, ko: kr(r.nameKr, r.name) })) },
    { title: 'etc', rows: cv.participated.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.client].filter(Boolean).join(', '), enSub: [r.role, r.place].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name) })) },
  ];
  const statement = (site.statement?.sections || []).flatMap((s) => s.items).filter((n) => n.t === 'p').map((n) => ({ en: n.en, ko: n.ko }));
  return { props: { statement, sections }, revalidate: REVALIDATE };
}
