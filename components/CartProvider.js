/**
 * 장바구니 상태 (Context + localStorage)
 *
 * 구매대행 특성상 "확정 결제"가 아니라 "견적 담기"에 가깝습니다.
 * 담긴 상품의 상품명·가격을 그대로 보관해 무게/배송비를 실시간 재계산합니다.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'

const STORAGE_KEY = 'kbeauty-hanoi:cart:v1'
const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const [ready, setReady] = useState(false)

  // 최초 1회 복원
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setItems(parsed)
      }
    } catch {
      // 저장소 접근 불가(시크릿 모드 등) — 빈 장바구니로 시작
    }
    setReady(true)
  }, [])

  // 변경 시 저장
  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // 저장 실패는 무시 (메모리 상태는 유지)
    }
  }, [items, ready])

  const add = useCallback((product, quantity = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.productId === product.productId)
      if (found) {
        return prev.map((i) =>
          i.productId === product.productId ? { ...i, quantity: i.quantity + quantity } : i,
        )
      }
      return [
        ...prev,
        {
          productId: product.productId,
          productName: product.productName,
          productPrice: product.productPrice,
          productUrl: product.productUrl,
          productImage: product.productImage,
          subcategoryId: product.subcategoryId,
          subcategoryLabel: product.subcategoryLabel,
          quantity,
        },
      ]
    })
  }, [])

  const setQuantity = useCallback((productId, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    )
  }, [])

  const remove = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const count = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items])

  const value = useMemo(
    () => ({ items, count, ready, add, setQuantity, remove, clear }),
    [items, count, ready, add, setQuantity, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart 는 CartProvider 안에서만 사용할 수 있습니다.')
  return ctx
}
