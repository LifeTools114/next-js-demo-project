import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// 상태 파일을 임시 디렉터리로 보내 이 파일 안에서 영속화를 켭니다.
process.env.ORDER_STORE_DIR = mkdtempSync(join(tmpdir(), 'kb-fx-'))

const { FX } = await import('../config/fx.js')
const { applyRates, refreshFx, fxStatus } = await import('../lib/fx/refresh.js')

const baseline = { usdToKrw: FX.usdToKrw, krwToVnd: FX.krwToVnd }

const fakeFetch = (payload, ok = true) => async () => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => payload,
})

test('환율 적용: 정상 범위를 벗어난 시세는 절대 적용하지 않는다', () => {
  const before = { ...baseline }
  assert.equal(applyRates({ usdToKrw: 50, krwToVnd: 18.4 }).applied, false, 'KRW 시세 붕괴 방어')
  assert.equal(applyRates({ usdToKrw: 1385, krwToVnd: 500 }).applied, false, 'VND 시세 붕괴 방어')
  assert.equal(FX.usdToKrw, before.usdToKrw)
  assert.equal(FX.krwToVnd, before.krwToVnd)
})

test('환율 갱신: API 시세를 환산·적용하고 파일에 남긴다', async () => {
  const r = await refreshFx({
    force: true,
    fetchImpl: fakeFetch({ result: 'success', rates: { KRW: 1402.5, VND: 25720 } }),
  })
  assert.equal(r.ok, true)
  assert.equal(FX.usdToKrw, 1402.5)
  // krwToVnd = VND ÷ KRW
  assert.ok(Math.abs(FX.krwToVnd - 25720 / 1402.5) < 0.001)
  assert.equal(fxStatus().stale, false, '갱신 직후에는 신선해야 합니다')
  assert.ok(existsSync(join(process.env.ORDER_STORE_DIR, 'fx.json')), '재시작 대비 파일이 남아야 합니다')
})

test('환율 갱신: 실패하면 기존 값을 유지한다', async () => {
  const before = { usdToKrw: FX.usdToKrw, krwToVnd: FX.krwToVnd }

  const fail = await refreshFx({ force: true, fetchImpl: fakeFetch({}, false) })
  assert.equal(fail.ok, false)
  assert.equal(FX.usdToKrw, before.usdToKrw)

  const broken = await refreshFx({ force: true, fetchImpl: fakeFetch({ rates: { KRW: 0, VND: 0 } }) })
  assert.equal(broken.ok, false)
  assert.equal(FX.usdToKrw, before.usdToKrw, '깨진 응답도 기존 값을 건드리면 안 됩니다')

  // 오염된 시세(범위 밖)도 거부 후 유지
  const poisoned = await refreshFx({ force: true, fetchImpl: fakeFetch({ rates: { KRW: 99999, VND: 25720 } }) })
  assert.equal(poisoned.ok, false)
  assert.equal(FX.usdToKrw, before.usdToKrw)
})
