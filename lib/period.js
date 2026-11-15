// Period 텍스트 읽기·표시·정렬 키 (순수 함수, lib/period.check.mjs로 확인)
// 입력 예: '2024.11.02 - 2024.12.12', '2026 -', '2020 - 2021', 'Mar. 2018 - Aug. 2024', '2026.11.20 - 12.14', '2023'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');

/** 한 날짜 글자 → {y, m, d} (월·일이 없으면 null). 월 이름(영문 약어·전체)도 읽음 */
function parseDate(p) {
  p = (p || '').trim();
  const m = p.match(/(\d{4})(?:\s*[.\-/]\s*(\d{1,2})(?:\s*[.\-/]\s*(\d{1,2}))?)?/);
  if (!m) return null;
  const name = p.toLowerCase().match(/(?:^|[^a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/);
  if (name && !m[2]) return { y: +m[1], m: MONTHS.indexOf(name[1]) + 1, d: null };
  return { y: +m[1], m: m[2] ? +m[2] : null, d: m[3] ? +m[3] : null };
}

export function parsePeriod(s) {
  const raw = (s || '').trim();
  const parts = raw.split(/\s+[-–~]\s*|\s*[-–~]\s+/);
  const a = parseDate(parts[0]);
  let b = parseDate(parts[1]);
  // '2026.11.20 - 12.14' 처럼 끝 연도를 생략한 경우
  if (!b && parts[1]) {
    const m = parts[1].match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (m && a) b = { y: a.y, m: +m[1], d: +m[2] };
  }
  const iso = (x) => (x && x.m && x.d ? `${x.y}-${pad(x.m)}-${pad(x.d)}` : null);
  const open = /[-–]\s*$/.test(raw);
  return {
    start: iso(a), // 연·월·일이 다 있을 때만 (now on view 계산용)
    end: iso(b) || iso(a),
    year: a?.y ?? null,
    endYear: b?.y ?? null,
    open,
    a,
    b,
    // 정렬 키: 없는 월·일은 시작은 00, 끝은 99
    sortStart: a ? `${a.y}-${pad(a.m ?? 0)}-${pad(a.d ?? 0)}` : '',
    sortEnd: b ? `${b.y}-${pad(b.m ?? 99)}-${pad(b.d ?? 99)}` : a ? `${a.y}-${pad(a.m ?? 99)}-${pad(a.d ?? 99)}` : '',
  };
}

const fmt = (x) => (x ? `${x.y}${x.m ? `.${pad(x.m)}` : ''}${x.d ? `.${pad(x.d)}` : ''}` : '');

/** 연.월.일 표시. 같은 해면 끝 연도 생략. 일이 없으면 월까지, 월도 없으면 연도만. 읽을 수 없으면 원래 글자 */
export function formatPeriod(s) {
  const { a, b, open } = parsePeriod(s);
  if (!a) return (s || '').trim();
  const start = fmt(a);
  if (!b) return open ? `${start} –` : start;
  const end = b.y === a.y && a.m && b.m ? fmt({ ...b, y: null }).replace(/^null\.?/, '') : fmt(b);
  return end && end !== start ? `${start} – ${end}` : start;
}

/** Period 최신순 비교: 시작 내림차순 → 끝 내림차순 → 이름. Period가 없으면 맨 뒤 */
export const periodCmp = (a, b) =>
  (b.sortStart || '').localeCompare(a.sortStart || '') ||
  (b.sortEnd || '').localeCompare(a.sortEnd || '') ||
  (a.name || '').localeCompare(b.name || '');
