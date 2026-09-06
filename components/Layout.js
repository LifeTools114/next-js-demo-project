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

  const pageTitle = title ? `${title} · 베트남 직구` : '베트남 직구 — 도착 가격 즉시 계산'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5"
        />
        <meta name="description" content="쇼핑몰에서 바로 베트남 도착 가격을 확인하세요. 무게 자동 산정, kg당 배송비, 관세·VAT까지 즉시 계산." />
        <meta name="theme-color" content="#0a2e9c" />
      </Head>

      <div className="app">
        {/* 상단 고정 — 브랜드 바 + 큰 탭 3개. 스크롤을 내려도 항상 붙어 있어
            어느 화면에서든 한 번의 탭으로 이동할 수 있습니다. */}
        <header className="header">
          <div className="header__bar">
            <Link href="/" className="header__logo">
              베트남 <span>직구</span>
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

        <footer style={{
          padding: '18px 14px 12px',
          borderTop: '1px solid var(--line)',
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--ink-500)',
          textAlign: 'center',
        }}>
          {/* 문의 — 신청서에서 잘 보이게 크게 (운영자 26-09-06: "조금 더 크게") */}
          <div style={{ marginBottom: 10, fontSize: 15, fontWeight: 800, color: 'var(--ink-900)', lineHeight: 1.7 }}>
            문의 :{' '}
            {CONTACT.kakaoOpenChat ? (
              <a href={CONTACT.kakaoOpenChat} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', padding: '5px 13px', borderRadius: 999,
                background: 'var(--cta-grad)', color: '#fff', fontWeight: 900, boxShadow: 'var(--cta-shadow)',
              }}>
                💬 {CONTACT.label} 오픈채팅
              </a>
            ) : <span style={{ fontWeight: 800 }}>{CONTACT.label}</span>}
            {CONTACT.kakaoId ? (
              <span> · 카카오톡 ID <b style={{ color: 'var(--brand-600)', fontSize: 16 }}>{CONTACT.kakaoId}</b></span>
            ) : null}
          </div>
          {/* 개인정보 처리방침 — 크롬 웹스토어 등록에 필요한 공개 주소이기도 합니다 */}
          <a href="/privacy" style={{ color: 'var(--ink-500)', textDecoration: 'underline' }}>개인정보 처리방침</a>
        </footer>
      </div>
    </>
  )
}
