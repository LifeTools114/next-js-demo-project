import Link from 'next/link'
import Layout from '../components/Layout'
import CategoryChips from '../components/CategoryChips'
import ProductCard from '../components/ProductCard'
import { fetchCatalog, sourceStatus } from '../lib/coupang/source'
import { getRateTable } from '../lib/pricing/shipping'
import { SHIPPING } from '../config/shipping'
import { krw, formatDateTime } from '../lib/format'

export default function Home({ products, status, fetchedAt, rateTable }) {
  return (
    <Layout sourceStatus={status}>
      <div className="hero">
        <h1 className="hero__title">하노이에서 받는 한국 화장품 🇰🇷 → 🇻🇳</h1>
        <p className="hero__desc">
          쿠팡 가격을 그대로 확인하고, 무게와 배송비까지 담는 즉시 계산합니다.
          <br />
          국제배송비는 <strong>1kg당 {krw(rateTable[0].ratePerKg)}</strong>부터 · 하노이 도착{' '}
          {SHIPPING.leadTimeDays.min}~{SHIPPING.leadTimeDays.max}영업일
        </p>
      </div>

      <CategoryChips />

      <div className="section" style={{ paddingBottom: 8 }}>
        <h2 className="section__title">
          인기 상품
          {fetchedAt && (
            <small style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-500)' }}>
              {formatDateTime(fetchedAt)} 기준
            </small>
          )}
        </h2>
        <p className="section__sub">
          {status.live
            ? '쿠팡 판매가를 주기적으로 동기화합니다.'
            : '쿠팡 API 키가 없어 예시 데이터를 표시하고 있습니다.'}
        </p>
      </div>

      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.productId} product={p} />
        ))}
      </div>

      <div className="section">
        <Link href="/products" className="btn btn--ghost">
          전체 상품 보기 →
        </Link>
      </div>

      <section className="panel">
        <div className="panel__head">국제배송 요금 (1kg당)</div>
        <div className="panel__body">
          <table className="rate-table">
            <thead>
              <tr>
                <th>구간</th>
                <th>1kg당 요율</th>
              </tr>
            </thead>
            <tbody>
              {rateTable.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td>{krw(r.ratePerKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note" style={{ marginTop: 12 }}>
            청구무게는 실무게와 부피무게 중 큰 값을 {SHIPPING.roundingStepKg}kg 단위로 올림합니다.
            최소 청구무게는 {SHIPPING.minBillableKg}kg 입니다.
          </p>
          <div style={{ marginTop: 12 }}>
            <Link href="/rates" className="btn btn--ghost">
              배송비 계산기 열기
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  )
}

export async function getServerSideProps() {
  const { products, fetchedAt } = await fetchCatalog({ limit: 12 })
  return {
    props: {
      products,
      fetchedAt: fetchedAt ?? null,
      status: sourceStatus(),
      rateTable: getRateTable().map(({ label, ratePerKg }) => ({ label, ratePerKg })),
    },
  }
}
