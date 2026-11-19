// node lib/cover.check.mjs (npm run check:cover): 작품 Cover 속성 → 대표 미디어 규칙
import assert from 'node:assert';
process.env.R2_PUBLIC_URL = 'https://r2.test';
const vkey = 'notion/abc123/loop.mp4';
const keys = [vkey + '.web.mp4', vkey + '.poster.jpg', 'notion/img456/pic.png', 'notion/nopost789/clip.mp4.web.mp4'];
globalThis.fetch = async () => ({ ok: true, json: async () => ({ keys }) });
const { coverMedia } = await import('./notion-utils.js');
const { refreshR2Manifest } = await import('./notion-utils.js');
await refreshR2Manifest();
const page = (url) => ({ properties: { Cover: { type: 'files', files: url ? [{ file: { url } }] : [] } } });
const S3 = 'https://prod-files-secure.s3.us-west-2.amazonaws.com';
// 비어 있으면 null → 페이지 커버로 대체
assert.equal(coverMedia(page(null)), null);
assert.equal(coverMedia({ properties: {} }), null);
// 이미지: image만
const img = coverMedia(page(`${S3}/ws/img456/pic.png?X=1`));
assert.equal(img.video, null);
assert.equal(img.image, 'https://r2.test/notion/img456/pic.png');
// 영상(웹 사본·poster 있음): video=.web.mp4, image=poster. 원본 키는 어디에도 안 나옴
const vid = coverMedia(page(`${S3}/ws/abc123/loop.mp4?X=1`));
assert.equal(vid.video, 'https://r2.test/notion/abc123/loop.mp4.web.mp4');
assert.equal(vid.image, 'https://r2.test/notion/abc123/loop.mp4.poster.jpg');
assert.ok(!JSON.stringify(vid).endsWith('loop.mp4"}') && !Object.values(vid).includes('https://r2.test/notion/abc123/loop.mp4'));
// 영상인데 아직 동기화 전: null (예전 커버로 대체, 깨진 영상 안 만듦)
assert.equal(coverMedia(page(`${S3}/ws/zzz000/new.mp4?X=1`)), null);
// 웹 사본만 있고 poster 없음: image null
const np = coverMedia(page(`${S3}/ws/nopost789/clip.mp4?X=1`));
assert.equal(np.image, null);
assert.ok(np.video.endsWith('clip.mp4.web.mp4'));
console.log('cover.check ok');
