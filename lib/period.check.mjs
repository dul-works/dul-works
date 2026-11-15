// node lib/period.check.mjs  (npm run check:period)
import assert from 'node:assert/strict';
import { parsePeriod, formatPeriod, periodCmp } from './period.js';

assert.equal(formatPeriod('2024.11.26 - 2024.12.14'), '2024.11.26 – 12.14');
assert.equal(formatPeriod('2024.11.30 - 2025.04.13'), '2024.11.30 – 2025.04.13');
assert.equal(formatPeriod('Mar. 2018 - Aug. 2024'), '2018.03 – 2024.08');
assert.equal(formatPeriod('March 2018 - August 2024'), '2018.03 – 2024.08');
assert.equal(formatPeriod('2018.03 - 2024.08'), '2018.03 – 2024.08');
assert.equal(formatPeriod('2024'), '2024');
assert.equal(formatPeriod('2020 - 2021'), '2020 – 2021');
assert.equal(formatPeriod('2026 -'), '2026 –');
assert.equal(formatPeriod('2026.11.20 - 12.14'), '2026.11.20 – 12.14');
assert.equal(formatPeriod('2023.11.11'), '2023.11.11');
assert.equal(formatPeriod(''), '');
assert.equal(formatPeriod('to be announced'), 'to be announced');
assert.equal(parsePeriod('Mar. 2018 - Aug. 2024').sortStart, '2018-03-00');
assert.equal(parsePeriod('Mar. 2018 - Aug. 2024').sortEnd, '2024-08-99');
assert.equal(parsePeriod('2024.11.02 - 2024.12.12').start, '2024-11-02');
// 정렬: 시작 최신순, 월 있는 쪽이 같은 해 연도만 쓴 것보다 뒤(연도만 = 연-00-00)
const rows = ['2020', '2024.11.26 - 2024.12.14', '2024.05.13 - 2024.05.31', 'Mar. 2018 - Aug. 2024', ''].map((p, i) => ({ name: `r${i}`, ...parsePeriod(p) }));
assert.deepEqual(rows.sort(periodCmp).map((r) => r.name), ['r1', 'r2', 'r0', 'r3', 'r4']);
console.log('period checks ok');
