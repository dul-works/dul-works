// Notion 이미지 동기화 스크립트
// 사용법: node scripts/sync-notion-images.js
//
// - 이미 public/assets/images/ 에 있는 파일은 건너뜀
// - Notion에 새로 추가된 이미지만 다운로드
// - 현재 빌드 프로세스에 연결되어 있지 않음 (수동 실행 전용)

const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(process.cwd(), 'public/assets/images');

function sanitizeFilename(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const basename = path.basename(pathname).split('?')[0];
    return basename.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
  } catch {
    return null;
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function fetchNotionDatabase(databaseId, apiKey) {
  const results = [];
  let cursor = undefined;

  while (true) {
    const body = cursor ? JSON.stringify({ start_cursor: cursor }) : '{}';
    const data = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.notion.com',
        path: `/v1/databases/${databaseId}/query`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        res.on('end', () => resolve(JSON.parse(raw)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return results;
}

function extractImageUrls(pages) {
  const urls = [];
  for (const page of pages) {
    // Page cover
    const cover = page.cover;
    if (cover?.type === 'file') urls.push(cover.file.url);
    if (cover?.type === 'external') urls.push(cover.external.url);

    // Properties의 Files & media 타입
    for (const prop of Object.values(page.properties || {})) {
      if (prop.type === 'files') {
        for (const file of prop.files || []) {
          if (file.type === 'file') urls.push(file.file.url);
          if (file.type === 'external') urls.push(file.external.url);
        }
      }
    }
  }
  return [...new Set(urls)];
}

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  const dbWork = process.env.NOTION_DB_WORK;
  const dbArtwork = process.env.NOTION_DB_ARTWORK;

  if (!apiKey || !dbWork || !dbArtwork) {
    console.error('❌ 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const existingFiles = new Set(fs.readdirSync(OUTPUT_DIR));
  console.log(`📁 기존 이미지: ${existingFiles.size}개`);

  console.log('📡 Notion 데이터 로드 중...');
  const [workPages, artworkPages] = await Promise.all([
    fetchNotionDatabase(dbWork, apiKey),
    fetchNotionDatabase(dbArtwork, apiKey)
  ]);

  const allUrls = extractImageUrls([...workPages, ...artworkPages]);
  console.log(`🔍 총 이미지 URL: ${allUrls.length}개`);

  let downloaded = 0;
  let skipped = 0;

  for (const url of allUrls) {
    const filename = sanitizeFilename(url);
    if (!filename) { skipped++; continue; }

    if (existingFiles.has(filename)) {
      skipped++;
      continue;
    }

    const destPath = path.join(OUTPUT_DIR, filename);
    try {
      await downloadFile(url, destPath);
      console.log(`✅ 다운로드: ${filename}`);
      downloaded++;
    } catch (err) {
      console.warn(`⚠️  실패: ${filename} — ${err.message}`);
    }
  }

  console.log(`\n완료 — 다운로드: ${downloaded}개, 건너뜀: ${skipped}개`);
}

main().catch((err) => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
