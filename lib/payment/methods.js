/**
 * 베트남 수금 수단 어댑터
 *
 * 수단이 확정되지 않았으므로, 외부 연동 없이 즉시 운영 가능한
 * 은행이체(수동 확인)만 실동작시키고 나머지는 자리만 잡아둡니다.
 * 수단이 정해지면 해당 어댑터의 createRequest / verify 만 채우면 됩니다.
 *
 * 어느 수단이든 공통 계약:
 *   createRequest(order) → 고객에게 보여줄 결제 안내
 *   verify(order, evidence) → 입금 사실 확인 (수동이든 웹훅이든)
 */

const env = (key) => process.env[key] || ''

export const METHODS = {
  'manual-bank': {
    id: 'manual-bank',
    label: '베트남 계좌이체 (동화)',
    labelVi: 'Chuyển khoản ngân hàng Việt Nam (VND)',
    currency: 'VND',
    /** 외부 연동이 필요 없어 항상 사용 가능합니다. */
    configured: true,
    automatic: false,
    createRequest(order) {
      return {
        method: 'manual-bank',
        /**
         * 입금자명에 주문번호를 넣게 해야 대조가 됩니다.
         * 베트남 은행 앱은 이체 메모(nội dung) 입력이 표준입니다.
         */
        reference: order.orderNo,
        instructions: [
          `은행: ${env('VN_BANK_NAME') || '(미설정)'}`,
          `계좌번호: ${env('VN_BANK_ACCOUNT') || '(미설정)'}`,
          `예금주: ${env('VN_BANK_HOLDER') || '(미설정)'}`,
          `이체 메모에 주문번호 ${order.orderNo} 를 반드시 입력해 주세요.`,
        ],
        amountVnd: order.invoice.amountVnd,
        amountKrw: order.invoice.amountKrw,
        expiresAt: order.invoice.expiresAt,
      }
    },
    /** 운영자가 입금 내역을 보고 수동 확인합니다. */
    verify(order, evidence) {
      if (!evidence?.confirmedBy) {
        return { ok: false, reason: '입금을 확인한 운영자 정보가 필요합니다.' }
      }
      return {
        ok: true,
        paidAt: evidence.paidAt ?? new Date().toISOString(),
        reference: evidence.reference ?? order.orderNo,
        // memo 는 고객에게 노출되므로 운영자 식별자를 넣지 않습니다.
        memo: '입금 확인',
        confirmedBy: evidence.confirmedBy,
      }
    },
  },

  /**
   * 한국 원화 수금 — 하노이 거주 한국인 상당수가 한국 계좌를 그대로 씁니다.
   * 원화로 받으면 환전 스프레드 없이 청구액(KRW) 그대로 정산됩니다.
   */
  'manual-bank-krw': {
    id: 'manual-bank-krw',
    label: '한국 계좌이체 (원화)',
    labelVi: 'Chuyển khoản ngân hàng Hàn Quốc (KRW)',
    currency: 'KRW',
    configured: true,
    automatic: false,
    createRequest(order) {
      return {
        method: 'manual-bank-krw',
        reference: order.orderNo,
        instructions: [
          `은행: ${env('KR_BANK_NAME') || '(미설정)'}`,
          `계좌번호: ${env('KR_BANK_ACCOUNT') || '(미설정)'}`,
          `예금주: ${env('KR_BANK_HOLDER') || '(미설정)'}`,
          `입금자명(받는 분 통장 표시)에 주문번호 ${order.orderNo} 를 반드시 입력해 주세요.`,
        ],
        amountVnd: order.invoice.amountVnd,
        amountKrw: order.invoice.amountKrw,
        /** 이 수단은 원화가 기준 통화입니다 — 고객 화면에서 KRW 를 앞세워 보여줍니다. */
        chargeCurrency: 'KRW',
        expiresAt: order.invoice.expiresAt,
      }
    },
    verify(order, evidence) {
      if (!evidence?.confirmedBy) {
        return { ok: false, reason: '입금을 확인한 운영자 정보가 필요합니다.' }
      }
      return {
        ok: true,
        paidAt: evidence.paidAt ?? new Date().toISOString(),
        reference: evidence.reference ?? order.orderNo,
        memo: '입금 확인',
        confirmedBy: evidence.confirmedBy,
      }
    },
  },

  momo: {
    id: 'momo',
    label: 'MoMo',
    labelVi: 'Ví MoMo',
    configured: Boolean(env('MOMO_PARTNER_CODE') && env('MOMO_SECRET_KEY')),
    automatic: true,
    createRequest() {
      throw new NotConfiguredError('MoMo')
    },
    verify() {
      throw new NotConfiguredError('MoMo')
    },
  },

  zalopay: {
    id: 'zalopay',
    label: 'ZaloPay',
    labelVi: 'ZaloPay',
    configured: Boolean(env('ZALOPAY_APP_ID') && env('ZALOPAY_KEY1')),
    automatic: true,
    createRequest() {
      throw new NotConfiguredError('ZaloPay')
    },
    verify() {
      throw new NotConfiguredError('ZaloPay')
    },
  },

  vnpay: {
    id: 'vnpay',
    label: 'VNPay',
    labelVi: 'VNPay',
    configured: Boolean(env('VNPAY_TMN_CODE') && env('VNPAY_HASH_SECRET')),
    automatic: true,
    createRequest() {
      throw new NotConfiguredError('VNPay')
    },
    verify() {
      throw new NotConfiguredError('VNPay')
    },
  },
}

export class NotConfiguredError extends Error {
  constructor(name) {
    super(`${name} 결제 연동이 아직 설정되지 않았습니다. 환경변수를 설정하거나 다른 수단을 선택하세요.`)
    this.name = 'NotConfiguredError'
  }
}

export const DEFAULT_METHOD = 'manual-bank'

/** 현재 사용 가능한 수단 목록 */
export function availableMethods() {
  return Object.values(METHODS)
    .filter((m) => m.configured)
    .map(({ id, label, labelVi, automatic, currency }) => ({ id, label, labelVi, automatic, currency }))
}

export function getMethod(id) {
  const method = METHODS[id]
  if (!method) throw new Error(`알 수 없는 결제 수단입니다: ${id}`)
  if (!method.configured) throw new NotConfiguredError(method.label)
  return method
}
