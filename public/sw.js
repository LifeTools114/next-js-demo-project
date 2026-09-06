/* 폰 웹앱(홈 화면에 추가)용 서비스 워커.
   하는 일은 하나 — 쇼핑몰 앱·캡처에서 「공유」로 들어온 것(POST /send)을 받아 신청 화면(GET /send?…)으로 넘깁니다.
   캡처 이미지는 이 브라우저 안의 임시 보관함(kb-share)에 잠깐 두었다가 화면이 읽으면 지웁니다.
   그 밖의 요청은 손대지 않고, 페이지·주문·금액을 캐시하지 않습니다 (항상 서버의 최신 값). */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/send') return
  event.respondWith((async () => {
    const params = new URLSearchParams()
    try {
      const form = await event.request.formData()
      for (const k of ['title', 'text', 'url']) {
        const v = form.get(k)
        if (typeof v === 'string' && v.trim()) params.set(k, v.trim().slice(0, 1000))
      }
      const shot = form.getAll('shots').find((f) => f && typeof f === 'object' && f.size > 0)
      if (shot) {
        const cache = await caches.open('kb-share')
        await cache.put('/kb-share/shot', new Response(shot, { headers: { 'Content-Type': shot.type || 'image/png' } }))
        params.set('shot', '1')
      }
    } catch { /* 폼을 못 읽어도 신청 화면은 엽니다 */ }
    return Response.redirect(`/send?${params.toString()}`, 303)
  })())
})
