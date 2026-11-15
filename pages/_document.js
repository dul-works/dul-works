import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preload" href="/fonts/GmarketSans-Light.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/GmarketSans-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {/* 스튜디오와 같은 방식: 정사각 svg에 로고가 높이를 꽉 채우고, 다크 탭에서는 밝은 색 (public/icon.svg). PNG·ICO는 밝은 타일 */}
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/icon-16.png" type="image/png" sizes="16x16" />
        <link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
