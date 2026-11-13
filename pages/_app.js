import { Archivo, Noto_Sans_KR } from 'next/font/google';
import '../styles/site.css';

// 본문: Archivo(영문, 폭 축 포함) + Noto Sans KR. 제목 Gmarket Sans는 site.css에서 직접 호스팅
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], display: 'swap' });
const notoKr = Noto_Sans_KR({ weight: ['400', '500', '600'], display: 'swap', preload: false });

export default function App({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-archivo: ${archivo.style.fontFamily};
          --font-kr: ${notoKr.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}
