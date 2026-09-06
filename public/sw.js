/* 폰 웹앱(홈 화면에 추가)용 서비스 워커 — 설치만 돕고, 아무것도 저장하지 않습니다.
   주문·금액·환율은 항상 서버의 최신 값이어야 하므로 캐시를 두지 않습니다. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
