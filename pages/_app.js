import { useEffect } from 'react'
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  // 폰 웹앱 설치용 서비스 워커 — 배포(production)에서만. 개발 중에는 옛 파일이 남지 않게 등록하지 않습니다.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => { /* 지원하지 않는 환경 — 사이트는 그대로 됩니다 */ })
  }, [])
  return <Component {...pageProps} />
}
