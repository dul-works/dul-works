// cv (Site-07). 전체가 노션 CV DB 한 곳에서 옴 (전시 SOLO/GROUP 행 포함). WORKS 전시 페이지가 있으면 이름·시작일로 링크만 연결
import Link from 'next/link';
import { Layout, Rich } from '../components/ui';
import { getSite, REVALIDATE } from '../lib/data';

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
    <Layout title="cv" description="dul (Lee Jiwon), new media artist. Exhibitions, education, awards and residencies.">
      <div className="wrap">
        {/* 위쪽도 이력과 같은 3단: 라벨 | 영문 | 국문 (열 위치 x가 아래 이력 행과 같음) */}
        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>cv — dul</h1>
        <section className="cv-sec cv-intro" aria-label="about">
          <span aria-hidden="true" />
          <ul className="cv-rows">
            <li className="cv-row">
              <span className="yr">born</span>
              <span className="cv-en">2000, Seoul</span>
              <span className="cv-kr" lang="ko">2000, 서울</span>
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

// CV 전시 행 → WORKS 전시 페이지 연결 규칙: ① 영문 이름이 같음(대소문자·공백·기호 무시) ② 국문 이름이 같음 ③ 시작일(연.월.일)이 같음. 먼저 맞는 것 하나, 없으면 링크 없음
const norm = (t) => (t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export async function getStaticProps() {
  const site = await getSite();
  const { cv } = site;
  const kr = (ko, en) => (ko && ko !== en ? ko : null);
  const pageFor = (r) => site.exhibitions.find((e) => norm(e.name) === norm(r.name) || (r.nameKr && norm(e.nameKr) === norm(r.nameKr)) || (r.start && e.start === r.start));
  const ex = (rows) => rows.map((r) => {
    const e = pageFor(r);
    return { key: r.id, year: r.periodLabel, en: r.name, enSub: r.place, ko: kr(r.nameKr, r.name), koSub: r.placeKr, href: e ? `/exhibitions/${e.slug}` : null };
  });
  const sections = [
    { title: 'education', rows: cv.education.map((r) => ({ key: r.id, year: r.periodLabel, en: r.place || r.name, enSub: [r.name, r.client].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
    { title: 'solo exhibitions', rows: ex(cv.solo) },
    { title: 'group exhibitions', rows: ex(cv.group) },
    { title: 'grants and awards', rows: cv.awards.map((r) => ({ key: r.id, year: r.periodLabel, en: [r.name, r.place?.trim()].filter(Boolean).join(', '), enSub: r.client, ko: [kr(r.nameKr, r.name), r.placeKr].filter(Boolean).join(', ') || null })) },
    { title: 'artist in residency', rows: cv.residency.map((r) => ({ key: r.id, year: r.periodLabel, en: [r.name, r.client].filter(Boolean).join(', '), enSub: r.place, ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
    { title: 'etc', rows: cv.participated.map((r) => ({ key: r.id, year: r.periodLabel, en: [r.name, r.client].filter(Boolean).join(', '), enSub: [r.role, r.place].filter(Boolean).join(', '), ko: kr(r.nameKr, r.name), koSub: r.placeKr })) },
  ];
  const statement = (site.statement?.sections || []).flatMap((s) => s.items).filter((n) => n.t === 'p').map((n) => ({ en: n.en, ko: n.ko }));
  return { props: { statement, sections }, revalidate: REVALIDATE };
}
