/* 폰 웹앱(홈 화면에 추가)용 서비스 워커 — 설치만 돕고, 아무것도 저장하지 않습니다.
   주문·금액·환율은 항상 서버의 최신 값이어야 하므로 캐시를 두지 않습니다.
   fetch 리스너는 비어 있습니다 — 일부 안드로이드 크롬은 이 리스너가 있어야
   「앱 설치」(WebAPK)로 올려 주고, 그래야 쇼핑몰 앱의 공유 목록에 나타납니다. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* 네트워크 그대로 — 가로채지 않습니다 */ })
