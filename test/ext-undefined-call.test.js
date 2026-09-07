/**
 * 확장 원본 파일에서 **정의 없는 함수를 부르는 곳**이 없는지.
 *
 * 왜 있나 (26-09-06): 자동입력을 걷어낼 때 함수 clearSpotlight 는 지웠는데
 * 호출 두 곳이 남았습니다. 콘텐츠 스크립트는 번들을 거치지 않고 그대로
 * 실리므로 아무도 잡지 못했고, 고객이 ✕ 를 눌러도 카드가 2초 뒤 되살아났습니다.
 * 이 테스트는 그 부류 — "함수는 지우고 호출은 남기는" 실수 — 를 잡습니다.
 *
 * 방식: 주석·문자열을 걷어낸 뒤 `이름(` 꼴을 모아, 파일 안에서 정의된 이름과
 * 브라우저 내장 이름을 빼고 남는 것이 있으면 실패합니다. 정밀한 파서는 아니지만
 * 화살표 함수·매개변수·구조분해까지 정의로 인정하므로 헛경보가 거의 없습니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const FILES = [
  'src/content/order-capture.js', 'src/content/main.js', 'src/content/panel.js',
  'src/content/extract.js', 'src/content/parse-page.js', 'src/content/patterns.js',
  'src/popup/popup.js', 'src/background/service-worker.js', 'src/worker/worker.js',
]

const BUILTINS = new Set(('if for while switch catch return typeof await async function new of ' +
  'String Number Boolean Array Object JSON Math Date Promise RegExp Error Map Set WeakMap WeakSet Symbol BigInt ' +
  'parseInt parseFloat isNaN isFinite setTimeout setInterval clearTimeout clearInterval queueMicrotask ' +
  'encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape structuredClone ' +
  'fetch alert confirm prompt requestAnimationFrame getComputedStyle matchMedia getSelection open close focus scrollTo ' +
  'MutationObserver DOMParser CustomEvent Event KeyboardEvent MouseEvent AbortController URL URLSearchParams ' +
  'Blob TextEncoder TextDecoder FormData Image Audio Response Request Headers atob btoa Intl Proxy Reflect ' +
  'Node Element HTMLElement HTMLInputElement HTMLTextAreaElement HTMLSelectElement NodeFilter Range Selection ' +
  'console document window location history navigator chrome globalThis self sessionStorage localStorage ' +
  'importScripts postMessage addEventListener removeEventListener dispatchEvent').split(' '))

/** 다른 파일이 window 에 걸어 두는 전역 — 이름이 K 로 시작합니다 (K, KBPanel, KBPatterns …) */
const isSharedGlobal = (n) => /^K(?:[A-Z]|$)/.test(n)

function undefinedCalls(src) {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""')
  const defs = new Set()
  const add = (s) => { const n = s.trim().split('=')[0].trim().split(':').pop().trim(); if (n) defs.add(n) }
  for (const m of code.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)/g)) defs.add(m[1])
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defs.add(m[1])
  for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) defs.add(m[1])
  for (const m of code.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}/g)) m[1].split(',').forEach(add)
  for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) m[1].split(',').forEach(add)
  for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) defs.add(m[1])
  for (const m of code.matchAll(/\bfunction\s*[\w$]*\s*\(([^)]*)\)/g)) m[1].split(',').forEach(add)
  for (const m of code.matchAll(/^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm)) defs.add(m[1])
  for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function|\()/g)) defs.add(m[1])
  const out = new Map()
  for (const m of code.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const n = m[1]
    if (BUILTINS.has(n) || defs.has(n) || isSharedGlobal(n)) continue
    out.set(n, (out.get(n) ?? 0) + 1)
  }
  return out
}

for (const f of FILES) {
  test(`정의 없는 함수 호출 없음 — ${f}`, () => {
    const src = readFileSync(new URL(`../extension/${f}`, import.meta.url), 'utf8')
    const bad = [...undefinedCalls(src)].map(([n, c]) => `${n}() ×${c}`)
    assert.deepEqual(bad, [], `${f}: 정의가 없는데 부르는 함수 — ${bad.join(', ')}`)
  })
}

test('검사기 자체가 살아 있다 — 정의 없는 호출을 실제로 잡는다', () => {
  const r = undefinedCalls('function a() { b() }\nconst c = () => a()\n')
  assert.deepEqual([...r.keys()], ['b'])
})
