import Link from 'next/link'
import { SUBCATEGORIES } from '../config/catalog'

export default function CategoryChips({ active }) {
  return (
    <div className="chips">
      <Link href="/products" className={`chip ${!active ? 'chip--active' : ''}`}>
        전체
      </Link>
      {SUBCATEGORIES.map((s) => (
        <Link
          key={s.id}
          href={`/products?category=${s.id}`}
          className={`chip ${active === s.id ? 'chip--active' : ''}`}
        >
          <span aria-hidden="true">{s.emoji}</span>
          {s.label}
        </Link>
      ))}
    </div>
  )
}
