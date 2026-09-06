/** /api/admin/backup — 운영자만, 저장 폴더의 json·jsonl 을 한 번에 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import handler, { collectBackup } from '../pages/api/admin/backup.js'

test('저장 폴더의 json·jsonl 만 모으고 임시·손상 파일은 뺀다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-backup-'))
  writeFileSync(join(dir, 'orders.json'), '{"orders":[]}')
  writeFileSync(join(dir, 'customers.json'), '{"customers":[]}')
  writeFileSync(join(dir, 'coupang-health.jsonl'), '{"a":1}\n')
  writeFileSync(join(dir, 'orders.json.tmp-123'), 'x')
  writeFileSync(join(dir, 'orders.json.corrupt-1'), 'x')
  writeFileSync(join(dir, 'note.txt'), 'x')
  const { files } = collectBackup(dir)
  assert.deepEqual(Object.keys(files).sort(), ['coupang-health.jsonl', 'customers.json', 'orders.json'])
  assert.ok('note' in collectBackup('/no/such/dir'))
})

test('토큰 없이는 못 받고, 받으면 파일 이름에 날짜가 붙는다', () => {
  const mk = () => ({ statusCode: 0, headers: {}, body: null, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(o) { this.body = o; return this }, send(o) { this.body = o; return this } })
  process.env.ADMIN_TOKEN = 'secret-for-test'
  let res = mk(); handler({ method: 'GET', headers: {}, query: {} }, res)
  assert.equal(res.statusCode, 401)
  res = mk(); handler({ method: 'GET', headers: { 'x-admin-token': 'secret-for-test' }, query: {} }, res)
  assert.equal(res.statusCode, 200)
  assert.match(res.headers['Content-Disposition'], /backup-\d{8}-\d{4}\.json/)
  assert.ok(JSON.parse(res.body).version === 1)
  delete process.env.ADMIN_TOKEN
})
