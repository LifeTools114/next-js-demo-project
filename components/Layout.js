import Link from 'next/link'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { CONTACT } from '../config/contact'
import { serviceAreaText } from './ServiceAreaNotice'

/**
 * 화면 뼈대 — 다크 글래스 테마 (운영자 26-09-12, DESIGN_AND_MENU_SPEC.md 기준)
 *
 *   위: 브랜드 + 📋 이용약관, 그 아래 🚚 배송 가능 지역 한 줄
 *   아래: 고정 5탭 — 🛒 신청 · 📊 요금 · 📦 내 신청 · 📖 안내 · 👤 마이
 *
 * 탭이 곧 메뉴라 화면마다 「홈으로」「계산기 열기」 같은 이동 버튼은 두지 않습니다.
 * 이 파일은 PC 에서도 그려지므로 남의 상호를 적지 않습니다 (test/pwa.test.js).
 */
const NAV = [
  { href: '/send', icon: '🛒', label: '신청', match: ['/send', '/checkout'], home: true },
  { href: '/rates', icon: '📊', label: '요금', match: ['/rates'] },
  { href: '/orders', icon: '📦', label: '내 신청', match: ['/orders'] },
  { href: '/guide', icon: '📖', label: '안내', match: ['/guide', '/notice', '/privacy'] },
  { href: '/my', icon: '👤', label: '마이', match: ['/my'] },
]

export default function Layout({ children, title, badge }) {
  const router = useRouter()
  const path = router.pathname
  const { cities, notServed } = serviceAreaText()

  const pageTitle = title ? `${title} · 베트남 직구` : '베트남 직구 — 한국 쇼핑몰 → 베트남'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5"
        />
        <meta name="description" content="한국 쇼핑몰 상품을 베트남 북부까지. 링크만 붙여넣으면 무게·배송비가 바로 계산됩니다." />
        <meta name="theme-color" content="#0b0f19" />
      </Head>

      <div className="app">
        <header className="header">
          <div className="header__bar">
            <Link href="/" className="header__logo">
              베트남 <span>직구</span>
            </Link>
            <div className="header__spacer" />
            {badge && <span className="source-badge source-badge--live"><span className="source-badge__dot" />{badge}</span>}
            <Link href="/notice" className="header__action">📋 이용약관</Link>
          </div>
          {/* 배송 가능 지역 — 목록 밖 도시는 보내지 못하므로 어느 화면에서든 보입니다 (운영자 26-09-06) */}
          <div className="notice-bar" role="note">
            <span>🚚 배송 가능: {cities}</span>
            <b>· {notServed} 불가</b>
          </div>
        </header>

        <main>{children}</main>

        <footer style={{
          padding: '18px 14px 8px',
          borderTop: '1px solid var(--line)',
          fontSize: '0.74rem',
          lineHeight: 1.7,
          color: 'var(--text-3)',
          textAlign: 'center',
        }}>
          {/* 문의 — 눈에 띄게 크게 (운영자 26-09-06: "조금 더 크게") */}
          <div style={{ marginBottom: 8, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)' }}>
            {CONTACT.kakaoOpenChat ? (
              <a href={CONTACT.kakaoOpenChat} target="_blank" rel="noreferrer" className="btn btn--sm"
                style={{ display: 'inline-flex', minHeight: 44, fontSize: '0.9rem' }}>
                💬 {CONTACT.label} 오픈채팅
              </a>
            ) : <span>{CONTACT.label}</span>}
            {CONTACT.kakaoId ? (
              <span style={{ display: 'block', marginTop: 6, fontSize: '0.86rem', color: 'var(--text-2)' }}>
                {CONTACT.label} ID <b style={{ color: 'var(--accent)' }}>{CONTACT.kakaoId}</b>
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/guide">이용 안내</Link>
            <Link href="/notice">이용약관</Link>
            {/* 개인정보 처리방침 — 크롬 웹스토어 등록에 필요한 공개 주소이기도 합니다 */}
            <Link href="/privacy">개인정보 처리방침</Link>
          </div>
        </footer>

        <nav className="tab-bar" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = (item.home && path === '/') || item.match.some((m) => path === m || path.startsWith(`${m}/`))
            return (
              <Link key={item.href} href={item.href} data-active={active} className="tab-bar__item">
                <span className="tab-bar__icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
