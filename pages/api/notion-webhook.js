// 노션 웹훅 → 바뀐 페이지만 바로 다시 만들기 (온디맨드 ISR). 10분 주기 갱신(REVALIDATE)은 그대로.
import { verify } from '../../lib/webhook-sig.js';
import { getSite, resetSite } from '../../lib/data';

export const config = { api: { bodyParser: false } };

const raw = (req) => new Promise((ok, no) => {
  const c = [];
  req.on('data', (d) => c.push(d));
  req.on('end', () => ok(Buffer.concat(c).toString('utf8')));
  req.on('error', no);
});
const nid = (s) => String(s || '').replace(/-/g, '');
const COMMON = ['/', '/works', '/cv', '/archive', '/contact'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).setHeader('Allow', 'POST').end();
  const body = await raw(req);
  let json = null;
  try { json = JSON.parse(body); } catch {}

  // 구독을 만든 직후 한 번: 토큰만 오는 요청. 사용자가 Vercel 로그에서 복사해 노션에 붙여 넣음
  // 노션은 이 요청에도 서명 헤더를 붙여 보냄(토큰 등록 전이라 검증 불가) → 헤더 유무와 상관없이 토큰 본문이면 받음
  if (json && json.verification_token && !json.type) {
    console.log('notion verification_token:', json.verification_token);
    return res.status(200).json({ ok: true });
  }

  if (!verify(body, req.headers['x-notion-signature'], process.env.NOTION_WEBHOOK_TOKEN)) return res.status(401).json({ error: 'bad signature' });
  if (!json) return res.status(400).json({ error: 'bad body' });

  const paths = new Set(COMMON);
  try {
    resetSite();
    const site = await getSite();
    const ids = [json.entity?.id, json.data?.parent?.id].filter(Boolean).map(nid);
    const hit = (list, dir) => list.filter((x) => x.slug && ids.includes(nid(x.id))).forEach((x) => paths.add(`${dir}/${x.slug}`));
    hit(site.artworks, '/works');
    hit(site.exhibitions, '/exhibitions');
    hit(site.projects, '/projects');
    hit(site.texts, '/archive');
  } catch (e) {
    console.error('webhook: lookup failed', e.message); // 못 찾으면 공통 경로만
  }

  const failed = [];
  await Promise.all([...paths].map((p) => res.revalidate(p).catch((e) => failed.push({ path: p, error: e.message }))));
  return res.status(200).json({ revalidated: [...paths].filter((p) => !failed.some((f) => f.path === p)), failed });
}
