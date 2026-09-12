/* 폰 웹앱(홈 화면에 추가)용 서비스 워커 — 설치 요건을 채우는 빈 껍데기입니다.
   아무것도 캐시하지 않습니다 (주문·금액은 항상 서버의 최신 값).
   쇼핑몰 앱의 「공유」는 GET /send?url=… 로 바로 들어오므로 여기서 할 일이 없습니다.
   (캡처 이미지 공유·임시 보관함은 운영자 지시 26-09-12 로 뺐습니다 — 폰 길은 상품 링크 하나) */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => { /* 손대지 않습니다 */ })
