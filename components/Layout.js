import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'

const NAV = [
  { href: '/', icon: '🏠', label: '홈' },
  { href: '/rates', icon: '📦', label: '요금·계산기' },
  { href: '/orders', icon: '🧾', label: '주문조회' },
]

export default function Layout({ children, title, badge }) {
  const router = useRouter()

  const pageTitle = title ? `${title} · 쿠팡 하노이` : '쿠팡 하노이 직구 — 도착 가격 즉시 계산'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5"
        />
        <meta name="description" content="쿠팡에서 바로 하노이 도착 가격을 확인하세요. 무게 자동 산정, kg당 배송비, 관세·VAT까지 즉시 계산." />
        <meta name="theme-color" content="#ef4a76" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header__bar">
            <Link href="/" className="header__logo">
              쿠팡 <span>하노이</span>
            </Link>
            <div className="header__spacer" />
            {badge && <span className="source-badge source-badge--live"><span className="source-badge__dot" />{badge}</span>}
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
                <span className="bottom-nav__icon">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
