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
}

export default nextConfig
