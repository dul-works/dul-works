// node lib/home.check.mjs (npm run check:home): 홈 now on view / upcoming이 Current 체크 전시만 쓰는지
import assert from 'node:assert';
const { exhibitionsOnHome } = await import('./data.js');
const d = (n) => new Date(Date.now() + 9 * 3600e3 + n * 86400e3).toISOString().slice(0, 10);
const mk = (name, s, e, current, slug = 'x') => ({ name, slug, current, start: d(s), end: d(e), sortEnd: d(e) });
const r = exhibitionsOnHome([
  mk('upcoming-far', 200, 230, true), mk('upcoming-soon', 5, 20, true), mk('running-late', -3, 40, true), mk('running-early', -10, 2, true),
  mk('past-kept', -90, -60, true), mk('hidden-post-off', -1, 9, true, null),
  mk('running-not-current', -2, 8, false), mk('upcoming-not-current', 3, 9, false),
  { name: 'no-dates', slug: 'n', current: true, start: null, end: null, sortEnd: '' },
]);
assert.deepEqual(r.upcoming.map((e) => e.name), ['upcoming-soon', 'upcoming-far']);
assert.deepEqual(r.now.map((e) => e.name), ['running-late', 'hidden-post-off', 'running-early', 'past-kept', 'no-dates']);
console.log('home checks ok');
