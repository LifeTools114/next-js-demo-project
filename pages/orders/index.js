import { useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'

/** 주문번호로 조회 — 로그인 없이 주문번호만으로 확인합니다. */
export default function OrderLookup() {
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')

  const submit = (e) => {
    e.preventDefault()
    const no = orderNo.trim().toUpperCase()
    if (no) router.push(`/orders/${no}`)
  }

  return (
    <Layout title="주문 조회">
      <div className="hero">
        <h1 className="hero__title">주문 조회</h1>
        <p className="hero__desc">주문번호를 입력하면 진행 상황과 결제 내역을 확인할 수 있습니다.</p>
      </div>

      <div className="section">
        <form onSubmit={submit}>
          <div className="field">
            <label className="field__label" htmlFor="no">주문번호</label>
            <input id="no" className="input" value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
              placeholder="HN2608280001" autoComplete="off" />
          </div>
          <button className="btn" type="submit" disabled={!orderNo.trim()}>조회하기</button>
        </form>
      </div>
    </Layout>
  )
}
