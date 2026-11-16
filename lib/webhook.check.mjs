// node lib/webhook.check.mjs (npm run check:webhook): 웹훅 서명 확인 함수
import assert from 'node:assert';
import { sign, verify } from './webhook-sig.js';
const raw = '{"type":"page.content_updated"}';
assert.ok(verify(raw, sign(raw, 't'), 't'));
assert.ok(!verify(raw, sign(raw, 'x'), 't'), 'wrong token');
assert.ok(!verify(raw + ' ', sign(raw, 't'), 't'), 'changed body');
assert.ok(!verify(raw, undefined, 't'), 'no header');
assert.ok(!verify(raw, sign(raw, 't'), ''), 'no env token');
assert.ok(!verify(raw, 'sha256=00', 't'), 'short header');
console.log('webhook check ok');
