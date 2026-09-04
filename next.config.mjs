/**
 * 집·사무실 와이파이의 사설 IP 대역.
 *
 * Next 는 개발 서버의 내부 자원(/_next/…)을 localhost 밖에서 부르면
 * **403 으로 막습니다.** 그래서 사장님 PC에서 서버를 켜고 폰으로
 * `http://192.168.0.12:3000` 처럼 들어가면 화면이 통째로 깨집니다.
 * (실제로 403 이 나는 것을 확인했습니다 — 26-09-04)
 *
 * 공유기마다 대역이 달라 한 줄로는 안 됩니다.
 *   192.168.x.x   대부분의 가정용 공유기
 *   10.x.x.x      회사·일부 공유기
 *   172.16~31.x.x SK브로드밴드가 172.30.1.x 를 씁니다
 *
 * 개발용 설정이라 실제 서비스(next start)에는 영향이 없습니다.
 */
const PRIVATE_LAN = [
  '192.168.*.*',
  '10.*.*.*',
  // 172.16.0.0/12 — 172.16 부터 172.31 까지만 사설 대역입니다.
  // '172.*.*.*' 로 뭉뚱그리면 남의 공인 IP까지 열리므로 나눠 적습니다.
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // 쿠팡 상품 이미지 CDN
    remotePatterns: [
      { protocol: 'https', hostname: '**.coupangcdn.com' },
      { protocol: 'https', hostname: 'image**.coupangcdn.com' },
    ],
  },
  /** 같은 와이파이의 폰에서 개발 서버로 접속 허용 (개발 전용) */
  allowedDevOrigins: PRIVATE_LAN,
}

export default nextConfig
