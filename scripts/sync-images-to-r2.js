// Notion 이미지를 Cloudflare R2로 동기화하는 스크립트
// 사용법: npm run sync-images-to-r2 (GitHub Actions: .github/workflows/sync-images.yml)
//
// - R2 버킷에 이미 있는 파일은 건너뜀
// - Notion에서 사라진 이미지는 R2에서도 삭제 (조회 오류가 있던 회차는 삭제하지 않음)
// - 끝나면 manifest.json에 R2 파일 목록 기록 → 사이트는 목록에 없는 이미지를 Notion 주소로 임시 표시
// - public/assets/{images,videos,pdf} 의 로컬 파일도 함께 업로드 (images는 루트 키, videos/·pdf/ 접두어)
// - Notion 커버, Files 속성, 페이지 본문 이미지 블록을 모두 수집
// - Notion 원본은 WebP(긴 변 2400px, 품질 85)로 변환해서 업로드
// - R2 키 규칙은 사이트와 공유 (lib/r2-key.js)
// - dev/main 브랜치가 같은 R2 버킷을 참조하므로 한 번 올리면 양쪽에서 공유됨

const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const https = require('https');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { r2KeyFromUrl, blockImageFilename } = require('../lib/r2-key');

// 로컬 정적 파일 → R2 키 접두어. images는 Image 필드 레거시 참조용이라 루트 키 그대로
const LOCAL_DIRS = [
  { dir: 'public/assets/images', prefix: '' },
  { dir: 'public/assets/videos', prefix: 'videos/' },
  { dir: 'public/assets/pdf', prefix: 'pdf/' },
];
const MAX_EDGE = 2400;
const WEBP_QUALITY = 85;
const CONCURRENCY = 4;
const UNOPTIMIZED_SIZE = 3 * 1024 * 1024;
const MANAGED_PREFIXES = ['notion/', 'external/'];
const MAX_DELETE_RATIO = 0.5;
const MANIFEST_KEY = 'manifest.json';

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

function getContentType(key) {
  const ext = path.extname(key).toLowerCase();
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

// 일시적 네트워크 오류(타임아웃, DNS 실패 등) 재시도
async function withRetry(fn, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts || err.permanent) throw err;
      await new Promise((r) => setTimeout(r, i * 2000));
    }
  }
}

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadToBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function notionRequest(method, apiPath, apiKey, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.notion.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
        ...(payload && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, retryAfter: res.headers['retry-after'], data: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function notionCall(method, apiPath, apiKey, body) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await withRetry(() => notionRequest(method, apiPath, apiKey, body));
    if (res.status !== 429) {
      if (res.status >= 400) {
        const err = new Error(`Notion API ${res.status}: ${res.data.message || ''}`);
        err.permanent = true;
        err.status = res.status;
        throw err;
      }
      return res.data;
    }
    const delay = parseInt(res.retryAfter || '1', 10) * 1000 + attempt * 500;
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new Error('Notion API rate limit 재시도 초과');
}

async function fetchNotionDatabase(databaseId, apiKey) {
  const results = [];
  let cursor = undefined;
  const cleanedId = databaseId.trim().replace(/-/g, '');

  while (true) {
    const data = await notionCall('POST', `/v1/databases/${cleanedId}/query`, apiKey, cursor ? { start_cursor: cursor } : {});
    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return results;
}

async function fetchBlockChildren(blockId, apiKey) {
  const results = [];
  let cursor = undefined;

  while (true) {
    const query = cursor ? `?start_cursor=${cursor}` : '';
    const data = await notionCall('GET', `/v1/blocks/${blockId}/children${query}`, apiKey);
    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return results;
}

function addImageBlock(block, found) {
  const image = block.image;
  const url = image.file?.url || image.external?.url;
  if (!url) return;
  const key = r2KeyFromUrl(url, blockImageFilename(image, url));
  if (key) found.set(key, url);
}

// 페이지 최상위 + column_list > column 안의 이미지 블록 수집
async function collectBlockImages(pageId, apiKey, found) {
  const blocks = await fetchBlockChildren(pageId, apiKey);

  for (const block of blocks) {
    if (block.type === 'image') addImageBlock(block, found);
    if (block.type !== 'column_list') continue;

    const columns = await fetchBlockChildren(block.id, apiKey);
    for (const column of columns) {
      const columnBlocks = await fetchBlockChildren(column.id, apiKey);
      for (const b of columnBlocks) {
        if (b.type === 'image') addImageBlock(b, found);
      }
    }
  }
}

function collectPropertyImages(page, found) {
  const cover = page.cover;
  const coverUrl = cover?.file?.url || cover?.external?.url;
  if (coverUrl) {
    const key = r2KeyFromUrl(coverUrl);
    if (key) found.set(key, coverUrl);
  }

  for (const prop of Object.values(page.properties || {})) {
    if (prop.type !== 'files') continue;
    for (const file of prop.files || []) {
      const url = file.file?.url || file.external?.url;
      const key = url && r2KeyFromUrl(url);
      if (key) found.set(key, url);
    }
  }
}

async function listExistingKeys(s3, bucket) {
  const keys = new Map();
  let continuationToken = undefined;

  while (true) {
    const res = await withRetry(() => s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })));
    for (const obj of res.Contents || []) keys.set(obj.Key, obj.Size);
    if (!res.IsTruncated) break;
    continuationToken = res.NextContinuationToken;
  }

  return keys;
}

async function upload(s3, bucket, key, body, contentType = getContentType(key)) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

// Notion 원본(수 MB)을 웹용 WebP로 변환. 키(확장자)는 사이트 규칙 유지를 위해 그대로 두고 Content-Type만 webp
async function optimizeImage(buffer) {
  const image = sharp(buffer, { failOn: 'none', animated: true });
  const { format } = await image.metadata();
  if (format === 'gif' || format === 'svg') {
    return { body: buffer, contentType: null };
  }
  const body = await image
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return { body, contentType: 'image/webp' };
}

async function runPool(items, limit, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      await worker(items[next++]);
    }
  }));
}

async function main() {
  const required = ['NOTION_API_KEY', 'NOTION_DB_WORK', 'NOTION_DB_ARTWORK',
    'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ 환경변수가 설정되지 않았습니다: ${missing.join(', ')}`);
    process.exit(1);
  }

  const { NOTION_API_KEY, NOTION_DB_WORK, NOTION_DB_ARTWORK, NOTION_DB_RELATED,
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
  });

  console.log('☁️  R2 버킷의 기존 파일 목록 조회 중...');
  const existingKeys = await listExistingKeys(s3, R2_BUCKET_NAME);
  console.log(`📁 R2 기존 파일: ${existingKeys.size}개`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  // 1) 로컬 정적 파일 업로드 (public/assets/images, videos, pdf)
  for (const { dir, prefix } of LOCAL_DIRS) {
    const absDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(absDir)) continue;
    const localFiles = fs.readdirSync(absDir).filter((f) => CONTENT_TYPES[path.extname(f).toLowerCase()]);
    console.log(`
💾 로컬 파일 (${dir}): ${localFiles.length}개`);
    for (const filename of localFiles) {
      const key = prefix + filename;
      if (existingKeys.has(key)) { skipped++; continue; }
      try {
        const body = fs.readFileSync(path.join(absDir, filename));
        await withRetry(() => upload(s3, R2_BUCKET_NAME, key, body));
        existingKeys.set(key, body.length);
        console.log(`✅ 업로드(로컬): ${key}`);
        uploaded++;
      } catch (err) {
        console.warn(`⚠️  실패(로컬): ${key} — ${err.message}`);
        failed++;
      }
    }
  }

  // 2) Notion 이미지 수집 — 하나라도 조회 실패하면 이번 회차는 삭제하지 않음
  console.log('\n📡 Notion 데이터 로드 중...');
  let scanComplete = true;
  const databaseIds = [NOTION_DB_WORK, NOTION_DB_ARTWORK, NOTION_DB_RELATED].filter(Boolean);
  const pages = [];
  for (const dbId of databaseIds) {
    try {
      pages.push(...await fetchNotionDatabase(dbId, NOTION_API_KEY));
    } catch (err) {
      // 404 = 인테그레이션에 공유되지 않은 DB. 사이트도 못 읽으므로 빈 DB로 취급
      if (err.status !== 404) scanComplete = false;
      console.warn(`⚠️  DB 조회 실패 (건너뜀): ${dbId} — ${err.message}`);
    }
  }
  console.log(`📄 페이지: ${pages.length}개 — 본문 이미지 블록 탐색 중 (시간이 걸릴 수 있어요)`);

  const found = new Map();
  for (const page of pages) {
    collectPropertyImages(page, found);
    try {
      await collectBlockImages(page.id, NOTION_API_KEY, found);
    } catch (err) {
      scanComplete = false;
      console.warn(`⚠️  블록 조회 실패: ${page.id} — ${err.message}`);
    }
  }
  console.log(`🔍 Notion 이미지: ${found.size}개`);

  // 이미 있어도 최적화 전 원본 크기면 다시 올림
  const pending = [...found].filter(([key]) => {
    const size = existingKeys.get(key);
    if (size !== undefined && size <= UNOPTIMIZED_SIZE) { skipped++; return false; }
    return true;
  });
  console.log(`⬆️  업로드 대상: ${pending.length}개 (동시 ${CONCURRENCY}개)`);

  await runPool(pending, CONCURRENCY, async ([key, url]) => {
    try {
      const original = await withRetry(() => downloadToBuffer(url));
      const { body, contentType } = await optimizeImage(original);
      await withRetry(() => upload(s3, R2_BUCKET_NAME, key, body, contentType || getContentType(key)));
      existingKeys.set(key, body.length);
      console.log(`✅ 업로드(Notion): ${key} (${(original.length / 1e6).toFixed(1)}MB → ${(body.length / 1e6).toFixed(2)}MB)`);
      uploaded++;
    } catch (err) {
      console.warn(`⚠️  실패(Notion): ${key} — ${err.message}`);
      failed++;
    }
  });

  // 3) Notion에서 사라진 이미지 삭제 (Notion에서 온 notion/, external/ 키만 대상)
  const orphans = [...existingKeys.keys()].filter((key) => MANAGED_PREFIXES.some((p) => key.startsWith(p)) && !found.has(key));
  const managedCount = [...existingKeys.keys()].filter((key) => MANAGED_PREFIXES.some((p) => key.startsWith(p))).length;
  let deleted = 0;

  if (orphans.length === 0) {
    console.log('\n🧹 삭제할 이미지 없음');
  } else if (!scanComplete) {
    console.warn(`\n🛑 Notion 조회 중 오류가 있어 삭제를 건너뜀 (삭제 후보 ${orphans.length}개)`);
  } else if (orphans.length > 5 && orphans.length > managedCount * MAX_DELETE_RATIO) {
    console.warn(`\n🛑 삭제 후보가 너무 많아 중단 (${orphans.length}/${managedCount}개). Notion 권한이나 DB 설정을 확인하세요.`);
  } else {
    for (let i = 0; i < orphans.length; i += 1000) {
      const batch = orphans.slice(i, i + 1000);
      await withRetry(() => s3.send(new DeleteObjectsCommand({
        Bucket: R2_BUCKET_NAME,
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true }
      })));
    }
    for (const key of orphans) {
      existingKeys.delete(key);
      console.log(`🗑️  삭제: ${key}`);
    }
    deleted = orphans.length;
  }

  // 4) 사이트가 참고하는 파일 목록 기록 (없는 이미지는 사이트가 Notion 주소로 임시 표시)
  const manifestKeys = [...existingKeys.keys()].filter((key) => key !== MANIFEST_KEY).sort();
  await withRetry(() => s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: MANIFEST_KEY,
    Body: JSON.stringify({ generatedAt: new Date().toISOString(), keys: manifestKeys }),
    ContentType: 'application/json',
    CacheControl: 'no-cache'
  })));
  console.log(`📝 ${MANIFEST_KEY} 갱신 (${manifestKeys.length}개)`);

  console.log(`\n완료 — 업로드: ${uploaded}개, 삭제: ${deleted}개, 건너뜀: ${skipped}개, 실패: ${failed}개`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
