// 노션 웹훅 서명: X-Notion-Signature = "sha256=" + HMAC-SHA256(원문 본문, verification_token)
import crypto from 'node:crypto';

export const sign = (raw, token) => 'sha256=' + crypto.createHmac('sha256', token).update(raw).digest('hex');

export function verify(raw, header, token) {
  if (!token || !header) return false;
  const a = Buffer.from(sign(raw, token));
  const b = Buffer.from(String(header));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
