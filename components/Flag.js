import { FLAG_INNER } from '../lib/ui/flags'

/** 국기 — 이모지 대신 그림. 윈도우에서 「VN」「KR」 글자로 보이던 것을 고칩니다 (26-09-06). */
export default function Flag({ code, size = 16, style }) {
  const inner = FLAG_INNER[code]
  if (!inner) return null
  return (
    <svg viewBox="0 0 30 20" width={size * 1.5} height={size} role="img" aria-label={code === 'kr' ? '한국' : '베트남'}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,.15)', flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: inner }} />
  )
}
