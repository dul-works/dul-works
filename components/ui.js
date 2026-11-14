import { Children, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

export const SITE = 'https://dul-works.com';
export const STUDIO = 'https://studio-edul.com';
export const EMAIL = 'easyone.work@gmail.com';
export const INSTAGRAM = 'https://www.instagram.com/easy_dul/';

// 열린 선 로고 (Dul-01). stroke는 크기에 맞춰 조정
export function Logo({ width = 38, height = 58, stroke = 12, ...rest }) {
  return (
    <svg width={width} height={height} viewBox="0 0 633 963" fill="none" aria-hidden="true" {...rest}>
      <mask id={`dlm${stroke}`} style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="331" y="1" width="301" height="301">
        <rect x="331.5" y="1.5" width="300" height="300" fill="#fff" />
      </mask>
      <g mask={`url(#dlm${stroke})`}><circle cx="331.5" cy="301.5" r="298.5" strokeWidth={stroke} stroke="currentColor" /></g>
      <path d="M331.5 811.5C331.5 894.343 398.657 961.5 481.5 961.5C564.343 961.5 631.5 894.343 631.5 811.5C631.5 728.657 564.343 661.5 481.5 661.5" strokeWidth={stroke} stroke="currentColor" />
      <path d="M301.5 151.5C301.5 234.343 234.343 301.5 151.5 301.5C68.6573 301.5 1.5 234.343 1.5 151.5C1.5 68.6573 68.6573 1.5 151.5 1.5" strokeWidth={stroke} stroke="currentColor" />
      <path d="M301 661.5L2.5 961" strokeWidth={stroke} stroke="currentColor" />
    </svg>
  );
}

const NAV = [
  ['works', '/works'],
  ['texts', '/texts'],
  ['cv', '/cv'],
  ['contact', '/contact'],
];

export function Layout({ title, description, image, children }) {
  const { asPath } = useRouter();
  const path = asPath.split(/[?#]/)[0];
  const fullTitle = title ? `${title} — dul` : 'dul';
  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {description && <meta name="description" content={description} />}
        <meta property="og:title" content={fullTitle} />
        {description && <meta property="og:description" content={description} />}
        {image && <meta property="og:image" content={image} />}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${SITE}${path === '/' ? '' : path}`} />
        <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
        <link rel="canonical" href={`${SITE}${path === '/' ? '' : path}`} />
      </Head>
      <a className="skip" href="#main">skip to content</a>
      <header className="site-header">
        <Link href="/" className="logo" aria-label="dul, home">
          <Logo />
        </Link>
        <nav aria-label="main" className="site-nav">
          {NAV.map(([label, href]) => (
            <Link key={href} href={href} aria-current={path === href || path.startsWith(`${href}/`) ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="studio-link">
          <a href={STUDIO}>studio.edul <span aria-hidden="true">↗</span></a>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="wrap">
          <span>© dul</span>
          <a href={INSTAGRAM}>instagram</a>
          <a href={STUDIO}>studio.edul <span aria-hidden="true">↗</span></a>
        </div>
      </footer>
    </>
  );
}

/** 노션 rich text (굵게, 기울임은 영문만, 코드, 링크) */
export function Rich({ rt, lang }) {
  if (!rt) return null;
  return rt.map((r, i) => {
    let el = r.x;
    if (r.c) el = <code className="rt-c">{el}</code>;
    if (r.b) el = <strong className="rt-b">{el}</strong>;
    if (r.i && lang !== 'ko') el = <em>{el}</em>;
    if (r.h) {
      const internal = r.h.startsWith('/');
      el = internal ? <Link className="rt-a" href={r.h}>{el}</Link> : <a className="rt-a" href={r.h}>{el}</a>;
    }
    return <span key={i}>{el}</span>;
  });
}

/**
 * 커버 이미지: 원본 비율 그대로(폭 맞춤, 높이는 이미지대로, 자르지 않음).
 * 이미지가 없을 때만 #F1F2F2 빈 칸 + 작은 로고 (placeholder 비율은 className, 기본 4:3)
 */
export function Cover({ src, alt = '', className = '', placeholder = 'ratio-43', eager = false }) {
  if (!src) {
    return (
      <div className={`ph ${placeholder} ${className}`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <Logo width={32} height={48} stroke={14} style={{ color: '#666B6A' }} />
      </div>
    );
  }
  return (
    <div className={className}>
      <img className="cover-img" src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" fetchpriority={eager ? 'high' : undefined} />
    </div>
  );
}

/** 작품 제목 짝: 영문 + 연도, 아래 국문. 이름이 한글뿐이면 국문 서체 한 줄 */
export function TitlePair({ name, nameKr, year, as: Tag = 'h3', en = 't-card', kr = 't-card-kr' }) {
  const krOnly = /[가-힣]/.test(name) && !/[A-Za-z]/.test(name);
  return (
    <>
      <div className="title-row">
        <Tag className={krOnly ? kr : en} lang={krOnly ? 'ko' : undefined}>{name}</Tag>
        {year && <span className="year">{year}</span>}
      </div>
      {nameKr && !krOnly && nameKr !== name && <span className={kr} lang="ko">{nameKr}</span>}
    </>
  );
}

export function WorkCard({ work, heading = 'h3', showDesc = false }) {
  return (
    <Link href={`/works/${work.slug}`} className="card">
      <Cover src={work.cover} />
      <div className="meta">
        <TitlePair name={work.name} nameKr={work.nameKr} year={work.year} as={heading} />
        {work.year && <span className="year-m" hidden>{work.year}</span>}
      </div>
      {showDesc && (work.description || work.descriptionKr) && (
        <p className="card-desc">
          {work.description}
          {work.descriptionKr && <span className="kr" lang="ko">{work.descriptionKr}</span>}
        </p>
      )}
    </Link>
  );
}

/** 영문 줄 + 국문 줄 (국문이 비면 영문만) */
export function Two({ en, ko, className = '' }) {
  return (
    <span className={className}>
      {en && <span className="en">{en}</span>}
      {ko && (
        <span className="kr" lang="ko" style={{ display: en ? 'block' : undefined }}>
          {ko}
        </span>
      )}
    </span>
  );
}

const RowLink = ({ href, children }) => (href ? <a href={href}>{children}</a> : <span>{children}</span>);

export function RelationLists({ exhibited, texts }) {
  if (!exhibited.length && !texts.length) return null;
  return (
    <div className="relations rule">
      {exhibited.length > 0 && (
        <section>
          <h2 className="section-label">exhibited</h2>
          <ul>
            {exhibited.map((e) => (
              <li key={e.key} className="rel-row">
                <span className="gray">{e.year}</span>
                <Link href={e.href}><span className="en">{e.en}</span>{e.ko && <span className="kr" lang="ko">{e.ko}</span>}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {texts.length > 0 && (
        <section>
          <h2 className="section-label">texts</h2>
          <ul>
            {texts.map((t) => (
              <li key={t.key} className="rel-row">
                <span className="gray">{t.year}</span>
                <RowLink href={t.href}><span className="en">{t.en}{t.external && <span aria-hidden="true"> ↗</span>}</span>{t.ko && <span className="kr" lang="ko">{t.ko}</span>}</RowLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}


/**
 * 원본 비율 카드를 열 너비는 같게, 간격은 일정하게 쌓기 (높이가 달라도 빈 줄 없이).
 * DOM·읽는 순서는 그대로(왼→오, 위→아래). 각 칸의 실제 높이를 재서 grid 행 span을 정하고,
 * grid가 순서대로 다음 빈 자리에 놓음. JS 전에는 같은 grid가 위쪽 정렬로 보임.
 */
export function Masonry({ cols = 2, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const fit = () => {
      const unit = parseFloat(getComputedStyle(ul).gridAutoRows) || 4;
      for (const li of ul.children) {
        const h = li.firstElementChild ? li.firstElementChild.getBoundingClientRect().height : 0;
        li.style.gridRowEnd = `span ${Math.ceil(h / unit) + 1}`;
      }
      ul.classList.add('masonry-on');
    };
    fit();
    const ro = new ResizeObserver(fit);
    for (const li of ul.children) if (li.firstElementChild) ro.observe(li.firstElementChild);
    return () => ro.disconnect();
  }, [children]);
  return (
    <ul ref={ref} className={`masonry c${cols} ${className}`}>
      {Children.toArray(children).map((c, i) => <li key={i}><div>{c}</div></li>)}
    </ul>
  );
}
