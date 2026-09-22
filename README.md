# Portfolio Website

개인 포트폴리오 웹사이트로, 작품, 전시, 프로젝트를 소개하는 아티스트 포트폴리오 사이트입니다.

## 소개

이 웹사이트는 Next.js와 Notion API를 활용하여 구축된 포트폴리오 플랫폼입니다. Notion을 CMS(Content Management System)로 사용하여 작품, 전시, 프로젝트 정보를 관리하고, 이를 동적으로 웹사이트에 표시합니다.

## 주요 기능

### 📁 WORK
- **프로젝트**: 진행 중인 프로젝트들을 카테고리별로 탐색
- **전시**: 개인전 및 그룹전 정보와 상세 내용
- **타임라인**: 시간순으로 정리된 작품 및 전시 이력

각 작품과 전시는 상세 페이지를 통해 더 자세한 정보를 확인할 수 있습니다.

### 📄 CV
이력서 페이지로, 학력, 경력, 수상 내역 등을 카테고리별로 정리하여 표시합니다.

### 🎨 작품 상세 페이지
- 작품 이미지 갤러리
- 작품 설명 (영문)
- 작품 정보 (크기, 재료 등)

### 🖼️ 전시 상세 페이지
- 전시 개요 및 설명
- 전시에 포함된 작품 목록
- 관련 자료 및 링크

### 🔬 프로젝트 상세 페이지
- 프로젝트 개요 및 기술적 설명
- 프로젝트 진행 과정 및 워크플로우
- 프로젝트 작품 갤러리

## 기술 스택

- **Next.js**: React 기반의 서버 사이드 렌더링 프레임워크
- **Notion API**: 콘텐츠 관리 시스템으로 사용
- **Tailwind CSS**: 유틸리티 기반 CSS 프레임워크
- **Cloudflare R2**: Notion 이미지 저장소 (`scripts/sync-images-to-r2.js`를 GitHub Actions가 dev 푸시·15분마다 실행)

## 특징

- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모든 기기에서 최적화된 경험
- **이미지**: Notion 이미지를 WebP로 변환해 R2에서 제공 (동기화 전 이미지는 Notion 원본으로 임시 표시)
- **영상·PDF**: 저장소에 두지 않고 R2의 `videos/`, `pdf/` 에서 제공 (동기화 스크립트가 `public/assets/videos`, `public/assets/pdf` 에 있는 파일을 올림)
- **SSR**: 요청마다 Notion을 조회해 즉시 반영. ARTWORK DB는 `Post` 체크된 작품만 노출
- **애니메이션**: 부드러운 페이지 전환 및 인터랙티브 요소

## 페이지 구조

- `/` - 홈
- `/work` - 작품 및 전시 목록
- `/work/[slug]` - 작품 상세 페이지
- `/exhibition/[slug]` - 전시 상세 페이지
- `/exhibition/[slug]/related/[relatedSlug]` - 전시 관련 자료 페이지
- `/project/[slug]` - 프로젝트 상세 페이지
- `/cv` - 이력서
- `/contact` - 연락처
- `/studio-edul` - Studio Edul (준비 중)

## 환경 변수

`NOTION_API_KEY`, `NOTION_DB_CV`, `NOTION_DB_WORK`, `NOTION_DB_ARTWORK`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
(R2 동기화 스크립트는 추가로 `NOTION_DB_RELATED`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`)
