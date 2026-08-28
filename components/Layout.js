import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCart } from './CartProvider'

const NAV = [
  { href: '/', icon: '🏠', label: '홈' },
  { href: '/products', icon: '🛍️', label: '상품' },
  { href: '/rates', icon: '📦', label: '배송요금' },
  { href: '/cart', icon: '🧾', label: '견적함' },
]

function SourceBadge({ status }) {
  if (!status) return null
  const live = status.live
  return (
    <span className={`source-badge ${live ? 'source-badge--live' : 'source-badge--seed'}`}>
      <span className="source-badge__dot" />
      {live ? '쿠팡 실시간' : '예시 데이터'}
    </span>
  )
}

export default function Layout({ children, title, sourceStatus }) {
  const router = useRouter()
  const { count } = useCart()

  const pageTitle = title ? `${title} · K뷰티 하노이` : 'K뷰티 하노이 — 한국 여성 화장품 직구'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5"
        />
        <meta name="description" content="하노이에서 받는 한국 여성 화장품 구매대행. 쿠팡 가격 연동, 무게 자동 산정, 1kg당 배송비 즉시 견적." />
        <meta name="theme-color" content="#ef4a76" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header__bar">
            <Link href="/" className="header__logo">
              K뷰티 <span>하노이</span>
            </Link>
            <div className="header__spacer" />
            <SourceBadge status={sourceStatus} />
          </div>
        </header>

        <main>{children}</main>
      </div>

      <nav className="bottom-nav">
        <div className="bottom-nav__inner">
          {NAV.map((item) => {
            const active =
              item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} data-active={active}>
                <span className="bottom-nav__icon">
                  {item.icon}
                  {item.href === '/cart' && count > 0 && (
                    <span className="bottom-nav__badge">{count > 99 ? '99+' : count}</span>
                  )}
                </span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
