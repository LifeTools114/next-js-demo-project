/**
 * 폰에서 개발 서버로 접속할 수 있는가
 *
 * Next 는 개발 서버의 내부 자원(/_next/…)을 localhost 밖에서 부르면
 * **403 으로 막습니다.** 그래서 사장님 PC에서 서버를 켜고 폰으로
 * `http://192.168.0.12:3000` 에 들어가면 흰 화면만 나옵니다.
 * (26-09-04 에 실제로 403 이 나는 것을 확인하고 next.config.mjs 에
 *  사설 대역을 열었습니다)
 *
 * 이 설정은 눈에 잘 안 띄어서 정리하다 지우기 쉽습니다. 지우면 폰
 * 테스트가 통째로 막히므로 여기서 지킵니다.
 *
 * 함께 지키는 것: **사설 대역만** 열어야 합니다. 172.16~31 만 사설이고
 * 172.32 부터는 남의 공인 IP 라, '172.*.*.*' 로 뭉뚱그리면 안 됩니다.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import config from '../next.config.mjs'

/** Next 가 쓰는 규칙과 같게: '.' 로 쪼개고 '*' 는 한 칸을 아무거나 */
const matches = (host, pattern) => {
  const h = host.split('.')
  const p = pattern.split('.')
  if (h.length !== p.length) return false
  return p.every((seg, i) => seg === '*' || seg === h[i])
}
const allowed = (host) => (config.allowedDevOrigins ?? []).some((p) => matches(host, p))

test('같은 와이파이의 폰 주소는 열려 있다', () => {
  assert.ok(Array.isArray(config.allowedDevOrigins), 'next.config.mjs 에 allowedDevOrigins 가 있어야 합니다')
  const phones = [
    '192.168.0.12',    // 가장 흔한 가정용 공유기
    '192.168.1.7',
    '192.168.219.104', // KT
    '172.30.1.5',      // SK브로드밴드
    '172.16.4.2',
    '172.31.255.254',
    '10.0.0.7',        // 회사·일부 공유기
  ]
  for (const ip of phones) {
    assert.ok(allowed(ip), `${ip} 에서 들어오는 폰이 막힙니다 — 폰 테스트가 안 됩니다`)
  }
})

test('사설 대역이 아닌 곳은 계속 막혀 있다', () => {
  // 172.16~31 만 사설입니다. 아래는 모두 남의 공인 IP 이거나 바깥 도메인입니다.
  const outsiders = [
    '172.15.0.1',
    '172.32.5.5',
    '173.16.0.1',
    '8.8.8.8',
    '1.1.1.1',
    'evil.example.com',
    '192.168.0.12.evil.com', // 우리 IP 를 흉내 낸 도메인
  ]
  for (const host of outsiders) {
    assert.ok(!allowed(host), `${host} 까지 열려 있습니다 — 사설 대역만 열어야 합니다`)
  }
})

test('시작 스크립트가 폰 주소를 찾아 알려준다', async () => {
  // 사장님은 IP 를 직접 찾을 방법이 없습니다. 스크립트가 알려줘야 합니다.
  const { readFileSync } = await import('node:fs')
  const ps1 = readFileSync(new URL('../scripts/start-server.ps1', import.meta.url), 'utf8')
  assert.ok(ps1.includes('폰에서 보려면'), '시작 화면에 폰 접속 주소 안내가 있어야 합니다')
  assert.ok(ps1.includes('Get-NetIPAddress'), '사설 IP 를 찾아야 합니다')
  // 가상 랜카드(WSL·도커) IP 를 알려주면 폰에서 절대 안 열립니다.
  assert.ok(ps1.includes('vEthernet'), '가상 랜카드를 걸러야 합니다')
})
