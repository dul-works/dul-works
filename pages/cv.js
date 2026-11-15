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

export default function CV({ statement, sections, description }) {
  return (
    <Layout title="cv" description={description}>
      <div className="wrap">
        {/* 위쪽도 이력과 같은 3단: 라벨 | 영문 | 국문 (열 위치 x가 아래 이력 행과 같음) */}
        <section className="cv-sec cv-intro" aria-label="about">
          <span aria-hidden="true" />
          <ul className="cv-rows">
            <li className="cv-row cv-name">
              <span className="yr">name</span>
              <h1 className="cv-en t-page">dul</h1>
              <span className="cv-kr t-page-kr" lang="ko">둘</span>
            </li>
            {statement.map((p, i) => (
              <li key={i} className="cv-row cv-stmt" id={i === 0 ? 'statement' : undefined}>
                <span className="yr">{i === 0 ? 'statement' : ''}</span>
                <span className="cv-en">{p.en && <Rich rt={p.en} />}</span>
                <span className="cv-kr" lang="ko">{p.ko && <Rich rt={p.ko} lang="ko" />}</span>
              </li>
            ))}
          </ul>
        </section>
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
    { title: 'education', rows: cv.education.map((r) => ({ key: r.id, year: yearSpan(r.year, r.endYear), en: r.place || r.name, enSub: [r.name, r.client].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
    { title: 'solo exhibitions', rows: ex('solo') },
    { title: 'group exhibitions', rows: ex('group') },
    { title: 'grants and awards', rows: cv.awards.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.place?.trim()].filter(Boolean).join(', '), enSub: r.client, ko: [kr(r.nameKr, r.name), r.placeKr].filter(Boolean).join(', ') || null })) },
    { title: 'artist in residency', rows: cv.residency.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.client].filter(Boolean).join(', '), enSub: r.place, ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
    { title: 'etc', rows: cv.participated.map((r) => ({ key: r.id, year: r.year, en: [r.name, r.client].filter(Boolean).join(', '), enSub: [r.role, r.place].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
  ];
  const statement = (site.statement?.sections || []).flatMap((s) => s.items).filter((n) => n.t === 'p').map((n) => ({ en: n.en, ko: n.ko }));
  // 검색·공유용 설명 = 노션 Artist Statement 첫 문단 영문 (직접 쓴 문구 없음)
  const description = statement[0]?.en ? statement[0].en.map((r) => r.x).join('').slice(0, 200) : null;
  return { props: { statement, sections, description }, revalidate: REVALIDATE };
}
