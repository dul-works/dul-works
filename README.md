# dul-works.com

작가 dul(이지원)의 포트폴리오. Next.js 14(pages router) + Notion API + Cloudflare R2, Vercel 배포.
디자인 기준: Design 캔버스 `dul` 페이지(Dul-W1 렌더러, Dul-W2 속성 지도, Site-01/04/07/08/09, Dul-P2/P3/P5, 모바일 Dul-M1·M4).

## 페이지

| 주소 | 내용 | 노션 |
|---|---|---|
| `/` | 대표 사진, 문장, now on view · upcoming, about, selected works | ARTWORK `Selected`·`Order`, WORKS 전시 `Period`(진행 중 + 90일 이내 예정), Artist Statement |
| `/works` | group by project / exhibition / year, sort newest / oldest | ARTWORK, WORKS |
| `/works/[slug]` | 작품 상세 (EN \| KR 두 열 본문 + 갤러리) | ARTWORK (`Slug`) |
| `/exhibitions/[slug]` | 전시 상세 (포스터, 기간·장소·종류, 본문 EN \| KR, 출품작, 관련 글) | WORKS `Class = SOLO/GROUP EXHIBITION`, 페이지 커버 = 포스터 |
| `/projects/[slug]` | 프로젝트 연구 페이지 (영문 아래 국문, 섹션 번호) | WORKS `Class = PROJECT` |
| `/texts`, `/texts/[slug]` | 글 목록, 읽기 (`Content = Text`인 글만 읽기 페이지, 나머지는 바깥 링크) | RELATED |
| `/cv` | 학력·전시·수상·레지던시·참여작 (전시는 WORKS에서) | CV, WORKS |
| `/contact` | 연락처 | — |

예전 주소(`/work`, `/work/[이름]`, `/project/…`, `/exhibition/…` → `/exhibitions/…`, `/timeline`, `/studio-edul`)는 `next.config.js`에서 새 주소로 넘깁니다.

## 이미지

사이트 어디서도 이미지를 자르지 않습니다(원본 비율, 폭만 맞춤). 카드 묶음은 `components/ui.js`의 `Masonry`로 열 너비·간격만 맞추고 높이는 이미지대로 쌓습니다. 이미지가 없는 칸만 4:3 빈 칸입니다.

## 노션 → 웹

- 본문은 "영문 전체 → 구분선 → 국문 전체". `lib/blocks.js`가 구분선에서 나누고, 제목 순서로 섹션을, 소제목·문단 순서로 짝지어 `{t, en, ko}` 블록으로 만듭니다. 미디어는 영문 쪽만 씁니다.
- `[글 | 이미지]` 열 = 본문 + 갤러리, `[EN 글 | KR 글]` 열 = 짝, 그 밖의 열은 열 그대로.
- 값이 비면 W1 G절대로: 국문 속성이 없으면 영문 줄만, `Year`가 없으면 `Timeline` 관계의 연도, 커버가 없으면 본문 첫 이미지, 관계가 없으면 섹션째 생략.
- 렌더링은 ISR(`revalidate` 10분, `lib/data.js`의 `REVALIDATE`).

## 미디어 (R2)

`scripts/sync-images-to-r2.js`가 노션 커버·Files 속성·본문의 이미지/영상/소리/파일/pdf를 R2로 복사하고 `manifest.json`을 씁니다(이미지는 WebP 변환). 사이트는 manifest에 있는 미디어를 R2 주소로, 아직 없는 것은 노션 원본 주소로 잠깐 보여 줍니다. GitHub Actions(`.github/workflows/sync-images.yml`)가 dev 푸시와 15분마다 실행합니다.

## 서체

제목 Gmarket Sans(OFL, `public/fonts`, 공식 배포처 TTF를 WOFF2로 변환, `public/fonts/OFL.txt`). 본문 Archivo + Noto Sans KR(`next/font`로 빌드 때 받아 함께 배포).

## 환경 변수

`NOTION_API_KEY`, `NOTION_DB_CV`, `NOTION_DB_WORK`, `NOTION_DB_ARTWORK`, `R2_PUBLIC_URL`
(동기화 스크립트는 추가로 `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`. RELATED DB는 WORKS의 `Related` 관계에서 찾으므로 `NOTION_DB_RELATED`는 없어도 됩니다.)
