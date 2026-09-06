import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* 없으면 모든 화면에서 404 가 하나씩 납니다 — 브라우저가 자동으로 찾습니다 */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        {/* 폰에서 「홈 화면에 추가」하면 앱처럼 열립니다 — public/manifest.webmanifest (공유 받기 포함) */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="베트남 직구" />
        <meta name="application-name" content="베트남 직구" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
