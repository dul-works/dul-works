// R2 저장 키 규칙 — 사이트(lib/*)와 업로드 스크립트(scripts/sync-images-to-r2.js)가 함께 사용
// Notion 업로드 파일은 이름이 겹칠 수 있으므로(image.png 등) URL 속 고유 파일 ID를 키에 포함한다.

const NOTION_HOST = /(amazonaws\.com|notion\.so|notion-static\.com|notionusercontent\.com)$/;

function lastSegment(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] || '';
}

// Notion 이미지 블록의 파일명: 캡션 우선, 없으면 URL 파일명. 이미지 확장자가 없으면 .jpg
function blockImageFilename(image, url) {
  const caption = image.caption && image.caption.length > 0 ? image.caption[0].plain_text : '';
  let filename = caption.trim();
  if (!filename) {
    try {
      filename = decodeURIComponent(lastSegment(new URL(url).pathname));
    } catch {
      return null;
    }
  }
  if (!filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    filename += '.jpg';
  }
  return filename;
}

function r2KeyFromUrl(url, filename) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  const segments = u.pathname.split('/').filter(Boolean);
  const name = filename || decodeURIComponent(segments[segments.length - 1] || '');
  if (!name) return null;

  if (NOTION_HOST.test(u.hostname) && segments.length >= 2) {
    return `notion/${segments[segments.length - 2]}/${name}`;
  }

  return `external/${u.hostname}${decodeURIComponent(u.pathname)}`;
}

module.exports = { r2KeyFromUrl, blockImageFilename };
