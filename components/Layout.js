import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CONTACT } from '../config/contact'

const NAV = [
  { href: '/', icon: '🏠', label: '홈' },
  { href: '/rates', icon: '🧮', label: '요금·계산기' },
  { href: '/orders', icon: '📋', label: '주문조회' },
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
        {/* 상단 고정 — 브랜드 바 + 큰 탭 3개. 스크롤을 내려도 항상 붙어 있어
            어느 화면에서든 한 번의 탭으로 이동할 수 있습니다. */}
        <header className="header">
          <div className="header__bar">
            <Link href="/" className="header__logo">
              쿠팡 <span>하노이</span>
            </Link>
            <div className="header__spacer" />
            {badge && <span className="source-badge source-badge--live"><span className="source-badge__dot" />{badge}</span>}
          </div>
          <nav className="top-nav" aria-label="주요 메뉴">
            {NAV.map((item) => {
              const active =
                item.href === '/' ? router.pathname === '/' : router.pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} data-active={active} className="top-nav__item">
                  <span className="top-nav__icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </header>

        <main>{children}</main>

        {/* 쿠팡 파트너스 대가성 고지 — 사이트 전체 하단 상시 표시 (공정위·파트너스 요건) */}
        <footer style={{
          padding: '14px 14px 10px',
          borderTop: '1px solid var(--line)',
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--ink-500)',
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 6 }}>
            문의 :{' '}
            {CONTACT.kakaoOpenChat ? (
              <a href={CONTACT.kakaoOpenChat} target="_blank" rel="noreferrer"
                style={{ color: 'var(--brand)', fontWeight: 700 }}>
                {CONTACT.label} 오픈채팅
              </a>
            ) : <span style={{ fontWeight: 700 }}>{CONTACT.label}</span>}
            {CONTACT.kakaoId ? <span> · 카카오톡 ID <b>{CONTACT.kakaoId}</b></span> : null}
          </div>
          본 서비스는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받을 수 있습니다.
          고객님이 지불하시는 구매 금액은 동일합니다.
        </footer>
      </div>
    </>
  )
}
