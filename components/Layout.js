import Head from 'next/head';
import Navigation from './Navigation';

export default function Layout({ children, title = 'Portfolio' }) {
  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
      </Head>
      <Navigation />
      {children}
    </>
  );
}

