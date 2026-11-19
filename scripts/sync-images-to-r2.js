// Notion 이미지를 Cloudflare R2로 동기화하는 스크립트
// 사용법: npm run sync-images-to-r2 (GitHub Actions: .github/workflows/sync-images.yml)
//
// - R2 버킷에 이미 있는 파일은 건너뜀
// - Notion에서 사라진 이미지는 R2에서도 삭제 (조회 오류가 있던 회차는 삭제하지 않음)
// - 끝나면 manifest.json에 R2 파일 목록 기록 → 사이트는 목록에 없는 이미지를 Notion 주소로 임시 표시
// - public/assets/{images,videos,pdf} 의 로컬 파일도 함께 업로드 (images는 루트 키, videos/·pdf/ 접두어)
// - Notion 커버, Files 속성, 페이지 본문(열·토글 안쪽 포함)의 이미지·영상·소리·파일·pdf 블록을 모두 수집
// - 이미지만 WebP로 바꾸고, 나머지는 원본 그대로
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
const os = require('os');
const { execFile } = require('child_process');
const { r2KeyFromUrl, blockImageFilename, isVideo, webVideoKey, posterKey } = require('../lib/r2-key');

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
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
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
      res.on('end', () => {
        // 게이트웨이 오류(502/504)는 본문이 JSON이 아님. 콜백 안의 예외는 프로세스를 죽이므로 여기서 처리
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { message: raw.slice(0, 200) };
        }
        resolve({ status: res.statusCode, retryAfter: res.headers['retry-after'], data });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Notion API timeout')));
    if (payload) req.write(payload);
    req.end();
  });
}

async function notionCall(method, apiPath, apiKey, body) {
  let lastStatus;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await withRetry(() => notionRequest(method, apiPath, apiKey, body));
    if (res.status !== 429 && res.status < 500) {
      if (res.status >= 400) {
        const err = new Error(`Notion API ${res.status}: ${res.data.message || ''}`);
        err.permanent = true;
        err.status = res.status;
        throw err;
      }
      return res.data;
    }
    lastStatus = res.status;
    const waitSec = parseInt(res.retryAfter || String(2 ** attempt), 10);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
  }
  throw new Error(`Notion API ${lastStatus} 재시도 초과`);
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

// 이미지는 캡션 기반 파일명(사이트와 같은 규칙), 영상·소리·파일·pdf는 URL 파일명 그대로
function addMediaBlock(block, found) {
  const value = block[block.type];
  if (!value) return;
  // 외부 이미지는 예전처럼 복사해 두고, 외부 영상·파일(YouTube 등)은 올리지 않음
  if (value.type !== 'file' && block.type !== 'image') return;
  const url = value.file?.url || value.external?.url;
  if (!url) return;
  const key = block.type === 'image' ? r2KeyFromUrl(url, blockImageFilename(value, url)) : r2KeyFromUrl(url);
  if (key) found.set(key, url);
}

const MEDIA_BLOCKS = new Set(['image', 'video', 'audio', 'file', 'pdf']);

// 페이지 본문 전체(열·토글·목록 안쪽 포함)의 미디어 블록 수집. 하위 페이지·DB 보기는 제외
async function collectBlockImages(blockId, apiKey, found, depth = 0) {
  const blocks = await fetchBlockChildren(blockId, apiKey);
  for (const block of blocks) {
    if (MEDIA_BLOCKS.has(block.type)) addMediaBlock(block, found);
    if (block.has_children && depth < 6 && block.type !== 'child_page' && block.type !== 'child_database') {
      await collectBlockImages(block.id, apiKey, found, depth + 1);
    }
  }
}

// 작품 Cover 속성의 영상: 원본은 R2에 올리지 않고(found에 넣지 않음) 웹 사본·poster만 만든다
function collectPropertyImages(page, found, coverVideos) {
  const cover = page.cover;
  const coverUrl = cover?.file?.url || cover?.external?.url;
  if (coverUrl) {
    const key = r2KeyFromUrl(coverUrl);
    if (key) found.set(key, coverUrl);
  }

  for (const [name, prop] of Object.entries(page.properties || {})) {
    if (prop.type !== 'files') continue;
    for (const file of prop.files || []) {
      const url = file.file?.url || file.external?.url;
      const key = url && r2KeyFromUrl(url);
      if (!key) continue;
      if (name.toLowerCase() === 'cover' && isVideo(key)) coverVideos.set(key, url);
      else found.set(key, url);
    }
  }
}

// 영상 첫 프레임(0.5초) → PNG 버퍼. ffmpeg 없거나 실패하면 null
function firstFrame(url) {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-loglevel', 'error', '-ss', '0.5', '-i', url, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
      { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
      (err, stdout) => resolve(err || !stdout.length ? null : stdout));
  });
}

// 웹용 사본: 가로 1280 이하, H.264 crf 27, 소리 없음, faststart → 파일 경로 또는 null
function webCopy(url) {
  const tmp = path.join(os.tmpdir(), `portfolio-web-${Date.now()}.mp4`);
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-loglevel', 'error', '-y', '-i', url, '-an', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', tmp],
      { timeout: 30 * 60 * 1000 }, (err) => resolve(err ? null : tmp));
  });
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
  // NOTION_DB_RELATED가 data source id라 조회가 안 될 수 있어 WORKS.Related 관계의 DB id를 우선 씀
  let relatedDbId = NOTION_DB_RELATED;
  try {
    const workDb = await notionCall('GET', `/v1/databases/${NOTION_DB_WORK.trim().replace(/-/g, '')}`, NOTION_API_KEY);
    relatedDbId = workDb.properties?.Related?.relation?.database_id || relatedDbId;
  } catch (err) {
    console.warn(`⚠️  WORKS DB 정보 조회 실패: ${err.message}`);
  }
  const databaseIds = [NOTION_DB_WORK, NOTION_DB_ARTWORK, relatedDbId].filter(Boolean);
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
  const coverVideos = new Map(); // key → Notion URL (원본은 올리지 않음)
  for (const page of pages) {
    collectPropertyImages(page, found, coverVideos);
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
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(key);
    if (size !== undefined && (!isImage || size <= UNOPTIMIZED_SIZE)) { skipped++; return false; }
    return true;
  });
  console.log(`⬆️  업로드 대상: ${pending.length}개 (동시 ${CONCURRENCY}개)`);

  await runPool(pending, CONCURRENCY, async ([key, url]) => {
    try {
      const original = await withRetry(() => downloadToBuffer(url));
      const isImage = /\.(jpe?g|png|gif|webp|heic|tiff?)$/i.test(key) || !path.extname(key);
      const { body, contentType } = isImage ? await optimizeImage(original) : { body: original, contentType: null };
      await withRetry(() => upload(s3, R2_BUCKET_NAME, key, body, contentType || getContentType(key)));
      existingKeys.set(key, body.length);
      console.log(`✅ 업로드(Notion): ${key} (${(original.length / 1e6).toFixed(1)}MB → ${(body.length / 1e6).toFixed(2)}MB)`);
      uploaded++;
    } catch (err) {
      console.warn(`⚠️  실패(Notion): ${key} — ${err.message}`);
      failed++;
    }
  });

  // 2-2) Cover 영상: 웹 사본 + poster만 R2에 (항상 변환, 원본 업로드 없음). 파생 키는 삭제 대상에서 제외
  for (const [key, url] of coverVideos) {
    const wk = webVideoKey(key);
    const pk = posterKey(key);
    found.set(wk, null);
    found.set(pk, null);
    try {
      if (!existingKeys.has(pk)) {
        const frame = await firstFrame(url);
        if (!frame) throw new Error('poster (ffmpeg)');
        const jpg = await sharp(frame).resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        await withRetry(() => upload(s3, R2_BUCKET_NAME, pk, jpg, 'image/jpeg'));
        existingKeys.set(pk, jpg.length);
        console.log(`🖼️  ${pk}`);
        uploaded++;
      }
      if (!existingKeys.has(wk)) {
        console.log(`🎞️  변환 중 ${key} …`);
        const tmp = await webCopy(url);
        if (!tmp) throw new Error('web copy (ffmpeg)');
        const out = fs.readFileSync(tmp);
        fs.rmSync(tmp, { force: true });
        await withRetry(() => upload(s3, R2_BUCKET_NAME, wk, out, 'video/mp4'));
        existingKeys.set(wk, out.length);
        console.log(`🎞️  ${wk} (${(out.length / 1048576).toFixed(1)}MB)`);
        uploaded++;
      }
    } catch (err) {
      console.warn(`⚠️  Cover 영상 실패: ${key} — ${err.message}`);
      failed++;
    }
  }

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
