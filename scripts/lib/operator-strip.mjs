/**
 * 스토어 배포본에서 운영자 전용 코드를 걷어냅니다.
 *   /* kb-operator-only *​/ … /* /kb-operator-only *​/     (JS)
 *   <!-- kb-operator-only --> … <!-- /kb-operator-only -->  (HTML)
 * 「대신 읽기」(운영자 브라우저가 고객 링크를 대신 여는 기능)는 고객 배포본에 들어갈 이유가 없고,
 * 심사관에게 자동화로 비칠 수 있어 통째로 뺍니다. 폴더 src/worker 도 함께 지웁니다 (pack-store.mjs).
 */
export function stripOperatorBlocks(text) {
  return String(text)
    .replace(/[ \t]*\/\* kb-operator-only \*\/[\s\S]*?\/\* \/kb-operator-only \*\/[ \t]*\n?/g, '')
    .replace(/[ \t]*<!-- kb-operator-only -->[\s\S]*?<!-- \/kb-operator-only -->[ \t]*\n?/g, '')
}

/** 걷어낸 뒤에도 남아 있으면 안 되는 흔적 */
export const OPERATOR_MARKS = ['kb-operator-only', 'src/worker/', 'workerResult', 'openWorker', 'reportWorker(', 'ops-worker']
