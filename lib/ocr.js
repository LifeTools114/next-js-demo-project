/**
 * 캡처 이미지 → 글자 (tesseract 명령줄, apt 패키지 — npm 의존성 없음)
 *
 *   서버: apt install tesseract-ocr tesseract-ocr-kor   (deploy/setup-server.sh · update.sh 가 넣습니다)
 *
 * 이미지는 임시 파일로 잠깐 썼다가 바로 지웁니다 — 저장하지 않습니다 (개인정보 처리방침 §7).
 */
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseShotText } from './ocr-parse.js'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/gif': 'gif' }

export function defaultRunner(file, { timeoutMs = 25_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile('tesseract', [file, 'stdout', '-l', 'kor+eng', '--psm', '4'], { timeout: timeoutMs, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err)
      resolve(String(stdout))
    })
  })
}

/** tesseract 가 설치돼 있나 — 없으면 화면이 「직접 적어 주세요」로 바로 넘어가게 */
export function ocrAvailable() {
  return new Promise((resolve) => execFile('tesseract', ['--version'], { timeout: 5000 }, (err) => resolve(!err)))
}

/**
 * @returns {{ ok:true, productName, productPrice, option, lineCount } | { ok:false, reason }}
 */
export async function ocrImage(buffer, contentType = 'image/png', { runner = defaultRunner } = {}) {
  if (!buffer || buffer.length === 0) return { ok: false, reason: 'empty' }
  if (buffer.length > MAX_IMAGE_BYTES) return { ok: false, reason: 'too-large' }
  const ext = EXT[String(contentType).toLowerCase().split(';')[0]] ?? 'png'
  let dir = null
  try {
    dir = await mkdtemp(join(tmpdir(), 'kb-ocr-'))
    const file = join(dir, `shot.${ext}`)
    await writeFile(file, buffer)
    const text = await runner(file)
    const parsed = parseShotText(text)
    if (!parsed.productName && !parsed.productPrice) return { ok: false, reason: 'nothing-read', lineCount: parsed.lineCount }
    return { ok: true, ...parsed }
  } catch (err) {
    return { ok: false, reason: /ENOENT/.test(err?.message ?? '') ? 'ocr-not-installed' : err?.killed ? 'timeout' : 'ocr-failed' }
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
