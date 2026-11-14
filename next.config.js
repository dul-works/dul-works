/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // 빌드 때 페이지 생성 워커를 하나로: 노션 데이터를 한 번만 읽어 모든 페이지가 같이 씀 (여러 워커 = 429)
  experimental: { cpus: 1, workerThreads: false },
  staticPageGenerationTimeout: 300,
  // 예전 주소 → 새 주소
  async redirects() {
    return [
      { source: '/work', destination: '/works', permanent: true },
      { source: '/work/:slug', destination: '/works/:slug', permanent: true }, // 이름 기반 예전 slug는 /works/[slug]가 다시 넘김
      { source: '/project/:slug', destination: '/projects/:slug', permanent: true },
      { source: '/projects', destination: '/works', permanent: true },
      { source: '/exhibition/:slug/related/:related', destination: '/texts', permanent: true },
      { source: '/exhibition/:slug', destination: '/exhibitions/:slug', permanent: true },
      { source: '/exhibitions', destination: '/works?group=exhibition', permanent: true },
      { source: '/exhibition', destination: '/works?group=exhibition', permanent: true },
      { source: '/timeline', destination: '/works?group=year', permanent: true },
      { source: '/studio-edul', destination: 'https://studio-edul.com', permanent: true },
    ];
  },
};
