import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { readMyKey } from '../lib/my-orders'

/**
 * 「내 주문 전체 보기」 — 주문 화면에서 개인 링크로 이어주는 작은 판.
 * welcome(첫 발급 직후)이면 링크를 저장하라고 눈에 띄게 알립니다.
 */
export default function MyLinkPanel() {
  const router = useRouter()
  const welcome = router.query?.welcome === '1' // 첫 발급 직후(신청서에서 넘어옴)
  const [key, setKey] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { setKey(readMyKey()) }, [])
  const link = key && typeof window !== 'undefined' ? `${window.location.origin}/my?k=${key}` : ''
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* 무시 */ }
  }
  return (
    <section className="panel" style={welcome ? { border: '2px solid #ff9a1f' } : undefined}>
      <div className={`panel__head${welcome ? ' panel__head--accent' : ''}`}>
        <span>📒 내 주문 전체 보기</span>
        {welcome && <span className="hint-strong">링크를 저장하세요</span>}
      </div>
      <div className="panel__body">
        {key ? (
          <>
            <p className="note" style={{ marginBottom: 10, fontSize: 13 }}>
              회원가입 없이 이 <b>개인 링크</b>로 폰·PC 어디서든 내 주문을 봅니다.
              <b> 카카오톡 「나에게 보내기」</b>에 넣어 두세요. 남에게는 보내지 마세요.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--sm" onClick={copy}>{copied ? '✓ 복사됨' : '링크 복사'}</button>
              <Link href="/my" className="btn btn--ghost btn--sm">내 주문 보기 →</Link>
            </div>
          </>
        ) : (
          <p className="note" style={{ fontSize: 13 }}>
            다른 기기에서 접수한 주문까지 한 번에 보시려면 <Link href="/my"><b>내 주문</b></Link>에서 개인 링크를 받으세요.
          </p>
        )}
      </div>
    </section>
  )
}
