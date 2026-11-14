// 노션 본문 렌더러 (Dul-W1). mode: 'column' = 프로젝트(Site-04), 'parallel' = 작품·글(Site-10, Site-09)
import { useEffect, useRef, useState } from 'react';
import { Rich, Masonry } from './ui';

const hasHangul = (rt) => /[가-힣]/.test((rt || []).map((r) => r.x).join(''));
const pad2 = (n) => String(n).padStart(2, '0');

/** 열 블록 안의 노드는 짝 전이라 rt만 있음 → 글자에 따라 en/ko 자리로 */
const norm = (n) => (n.rt && !n.en && !n.ko ? { ...n, [hasHangul(n.rt) ? 'ko' : 'en']: n.rt, kids: n.kids?.map(norm) } : n);

// ---------- 미디어 ----------

let playingAudio = null;

function AudioPill({ src, cap }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(null);
  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      if (playingAudio && playingAudio !== a) playingAudio.pause();
      playingAudio = a;
      a.play();
    } else a.pause();
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${pad2(Math.round(s % 60))}`;
  return (
    <>
      <button type="button" className="audio" onClick={toggle} aria-pressed={playing}>
        <span className={playing ? 'bars' : 'tri'} aria-hidden="true" />
        <span>
          {cap?.en || (!cap?.ko && 'sound')}
          {cap?.ko && <span className="kr" lang="ko" style={{ marginLeft: cap?.en ? 8 : 0, fontSize: 13 }}>{cap.ko}</span>}
        </span>
        {dur && <span className="dur">{fmt(dur)}</span>}
        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{playing ? 'pause' : 'play'}</span>
      </button>
      <audio ref={ref} src={src} preload="metadata" onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </>
  );
}

/** 업로드 mp4: 소리 없이 반복 재생. 움직임 줄이기 → 첫 프레임 + 재생 버튼 */
function Video({ src, label }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    v.play().catch(() => {}); // 자동 재생이 막히면 재생 버튼이 남음
  }, []);
  return (
    <div className="vid">
      <video ref={ref} src={`${src}#t=0.1`} muted={muted} loop playsInline preload="metadata" aria-label={label} onPlay={() => setPaused(false)} onPause={() => setPaused(true)} style={{ width: '100%' }} />
      {paused && (
        <button type="button" className="play" onClick={() => ref.current?.play()} aria-label="play video">
          <svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M0 0L20 11L0 22Z" fill="#fff" /></svg>
        </button>
      )}
      <button type="button" className="sound" onClick={() => setMuted(!muted)} aria-pressed={!muted}>
        {muted ? 'sound off' : 'sound on'}
      </button>
    </div>
  );
}

function Caption({ cap, prefix }) {
  if (!cap && !prefix) return null;
  if (!cap) return null;
  return (
    <figcaption>
      {cap.en && <span className="en">{prefix?.en}{cap.en}</span>}
      {cap.ko && <span className="kr" lang="ko">{!cap.en && prefix?.en}{cap.ko}</span>}
    </figcaption>
  );
}

function Media({ n, ctx }) {
  const fig = ctx.numbered && (n.t === 'image' || n.t === 'video' || n.t === 'embed') ? ++ctx.fig : null;
  const prefix = fig ? { en: `fig. ${fig}, `, ko: '' } : null; // 사이트가 붙이는 글자는 영문만
  const alt = n.cap?.en || `${ctx.title}, image ${++ctx.img}`;
  let el = null;
  if (n.t === 'image') el = <img src={n.src} alt={alt} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto' }} />;
  if (n.t === 'video') el = <Video src={n.src} label={alt} />;
  if (n.t === 'embed') el = <iframe className="embed" src={n.src} title={n.cap?.en || `${ctx.title}, video`} loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  if (n.t === 'audio') return <AudioPill src={n.src} cap={n.cap} />;
  return (
    <figure className="fig">
      {el}
      <Caption cap={n.cap} prefix={prefix} />
    </figure>
  );
}

// 사진 묶음: 2장 → 2열, 3장 이상 → 3열. 원본 비율, 간격 일정 (P7)
function Gallery({ items, ctx }) {
  return (
    <Masonry cols={Math.min(items.length, 3)} className="gallery">
      {items.map((m, i) => <Media key={i} n={m} ctx={ctx} />)}
    </Masonry>
  );
}

function Table({ rows }) {
  const width = Math.max(...rows.map((r) => r.length));
  return (
    <table className="btable">
      <tbody>
        {rows.map((r, i) => {
          // 항목 | (연도) | 영문 | 국문 → 마지막 두 칸을 위아래로
          const stacked = width >= 3 && hasHangul(r[width - 1]) && !hasHangul(r[width - 2]);
          const lead = stacked ? r.slice(0, width - 2) : r;
          return (
            <tr key={i}>
              {lead.map((c, j) => (
                <td key={j} className={j === 0 ? 'k' : j === 1 && stacked ? 'g' : ''}><Rich rt={c} /></td>
              ))}
              {stacked && (
                <td>
                  <Rich rt={r[width - 2]} />
                  <span className="kr" lang="ko"><Rich rt={r[width - 1]} lang="ko" /></span>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const domain = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
};

function Bookmark({ n }) {
  return (
    <a className="bookmark" href={n.url}>
      <span className="name">{n.cap?.en || domain(n.url)} <span aria-hidden="true">↗</span></span>
      {n.cap && <span className="cap">{n.cap.ko && <span lang="ko">{n.cap.ko}</span>}</span>}
      <span className="dom">{domain(n.url)}</span>
    </a>
  );
}

export function FileButton({ n }) {
  const en = n.cap?.en || n.name || 'file';
  return (
    <a className="pill" href={n.src || n.url}>
      {en}
      {n.cap?.ko && <span className="kr" lang="ko">{n.cap.ko}</span>}
    </a>
  );
}

// ---------- 글 ----------

function List({ items, ordered, mode }) {
  return (
    <ol className="b-list" style={{ listStyle: 'none' }}>
      {items.map((it, i) => (
        <li key={i}>
          <span className="mark" aria-hidden="true">{ordered ? pad2(i + 1) : '—'}</span>
          <div>
            <TextPair n={it} mode={mode} />
            {it.kids?.length > 0 && <List items={it.kids.map(norm)} ordered={it.kids[0].t === 'ol'} mode={mode} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TextPair({ n, mode, level = 1 }) {
  const en = n.en && <Rich rt={n.en} />;
  const ko = n.ko && <Rich rt={n.ko} lang="ko" />;
  if (n.t === 'h') {
    const rel = n.lvl - (level || 1);
    const cls = rel <= 1 ? 'b-sub' : 'b-item';
    const Tag = rel <= 1 ? 'h3' : 'h4';
    return (
      <Tag className={cls}>
        {en && <span className="en">{en}</span>}
        {ko && <span className="kr" lang="ko">{ko}</span>}
      </Tag>
    );
  }
  if (n.t === 'quote') {
    return (
      <blockquote className="b-quote">
        {en && <span className="en">{en}</span>}
        {ko && <span className="kr" lang="ko">{ko}</span>}
      </blockquote>
    );
  }
  if (n.t === 'callout') {
    return (
      <div className="b-callout">
        {en && <span>{en}</span>}
        {ko && <span className="kr" lang="ko">{ko}</span>}
      </div>
    );
  }
  return (
    <div className="pair">
      {en && <p className="en">{en}</p>}
      {ko && <p className="kr" lang="ko">{ko}</p>}
    </div>
  );
}

// 연속된 목록 항목을 하나의 목록으로
function groupLists(items) {
  const out = [];
  for (let n of items) {
    n = norm(n);
    const last = out[out.length - 1];
    if ((n.t === 'ul' || n.t === 'ol') && last?.t === `${n.t}-group`) last.items.push(n);
    else if (n.t === 'ul' || n.t === 'ol') out.push({ t: `${n.t}-group`, items: [n] });
    else if (n.t === 'divider' && (!last || last.t === 'divider')) continue; // 맨 앞·연속 구분선은 하나로
    else out.push(n);
  }
  while (out[out.length - 1]?.t === 'divider') out.pop(); // 맨 끝 구분선은 버림
  return out;
}

function Block({ n, ctx, mode }) {
  n = norm(n);
  switch (n.t) {
    case 'p':
    case 'h':
    case 'quote':
    case 'callout':
      return <TextPair n={n} mode={mode} level={ctx.level} />;
    case 'ul-group':
    case 'ol-group':
      return <List items={n.items} ordered={n.t === 'ol-group'} mode={mode} />;
    case 'code':
      return <pre className="b-code"><Rich rt={n.rt} /></pre>;
    case 'divider':
      return <div className="b-spacer" aria-hidden="true" />;
    case 'image':
    case 'video':
    case 'embed':
    case 'audio':
      return <Media n={n} ctx={ctx} />;
    case 'gallery':
      return n.items.length === 1 ? <Media n={n.items[0]} ctx={ctx} /> : <Gallery items={n.items} ctx={ctx} />;
    case 'table':
      return <Table rows={n.rows} />;
    case 'bookmark':
      return <Bookmark n={n} />;
    case 'file':
      return <div><FileButton n={n} /></div>;
    case 'columns':
      return (
        <div className="b-cols" style={{ gridTemplateColumns: `repeat(${n.cols.length}, minmax(0, 1fr))` }}>
          {n.cols.map((c, i) => (
            <div key={i}>{groupLists(c).map((m, j) => <Block key={j} n={m} ctx={ctx} mode={mode} />)}</div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

const isWide = (n) => ['image', 'video', 'embed', 'gallery', 'columns', 'table', 'code'].includes(n.t);

/** parallel 모드의 한 줄: 영문 칸 | 국문 칸 */
function ParRow({ n, ctx, solo }) {
  n = norm(n);
  if (n.t === 'ul-group' || n.t === 'ol-group') {
    const side = (k) => ({ ...n, items: n.items.map((it) => ({ ...it, en: k === 'en' ? it.en : null, ko: k === 'ko' ? it.ko : null })) });
    return (
      <div className={`row${solo ? ' solo' : ''}`}>
        {n.items.some((i) => i.en) && <div className="en"><Block n={side('en')} ctx={ctx} mode="parallel" /></div>}
        {n.items.some((i) => i.ko) && <div className="kr" lang="ko"><Block n={side('ko')} ctx={ctx} mode="parallel" /></div>}
      </div>
    );
  }
  if (['p', 'h', 'quote', 'callout'].includes(n.t)) {
    const Tag = n.t === 'h' ? 'h3' : 'p';
    const style = n.t === 'h' ? { fontWeight: 600 } : undefined;
    return (
      <div className={`row${solo ? ' solo' : ''}`}>
        {n.en && <Tag className="en" style={style}><Rich rt={n.en} /></Tag>}
        {n.ko && <Tag className="kr" lang="ko" style={{ ...style, gridColumn: solo ? 1 : 2 }}><Rich rt={n.ko} lang="ko" /></Tag>}
      </div>
    );
  }
  return <div className={isWide(n) ? 'wide' : 'full'}><Block n={n} ctx={ctx} mode="parallel" /></div>;
}

/**
 * body: lib/blocks parseBody 결과
 * defaultHead: 제목 없는 첫 섹션의 레일 이름 (작품 페이지 'about the work', 사이트 라벨은 영문만)
 * skip: 다른 자리로 옮긴 섹션 (credits)
 */
export default function Body({ body, mode = 'column', title = '', defaultHead, skip = () => false, startNumber = 1 }) {
  if (!body?.sections?.length) return null;
  const ctx = { fig: 0, img: 0, numbered: mode === 'column', title, level: body.level };
  const solo = body.lang !== 'both';
  let no = startNumber - 1;
  const sections = body.sections.filter((s) => !skip(s));
  if (mode === 'column') {
    return (
      <div className={`col${solo ? ' one-lang' : ''}`}>
        {sections.map((s, i) => (
          <section key={i} className="sec">
            {s.head && (
              // 번호 + 영문 제목은 왼쪽 열, 국문 제목은 오른쪽 열 머리 (Site-04)
              <h2 className="sec-head">
                <span className="sec-en">
                  <span className="no">{pad2(++no)}</span>
                  {s.head.en && <span className="t-head"><Rich rt={s.head.en} /></span>}
                </span>
                {s.head.ko && <span className="t-head-kr" lang="ko"><Rich rt={s.head.ko} lang="ko" /></span>}
              </h2>
            )}
            {groupLists(s.items).map((n, j) => <Block key={j} n={n} ctx={ctx} mode="column" />)}
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="par">
      {sections.map((s, i) => {
        const head = s.head || (i === 0 ? defaultHead : null);
        return (
          <section key={i} className="sec">
            <div className="rail">
              {head?.en && <h2 className="section-label"><Rich rt={head.en} /></h2>}
              {head?.ko && <span className="kr" lang="ko"><Rich rt={head.ko} lang="ko" /></span>}
            </div>
            {groupLists(s.items).map((n, j) => <ParRow key={j} n={n} ctx={ctx} solo={solo} />)}
          </section>
        );
      })}
    </div>
  );
}
