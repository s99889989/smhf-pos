// 公司伺服器的背景工作：
//   - 每 10 分鐘補傳失敗的發票 / 作廢、預取號碼（舊系統 InvSrv 的角色）
//   - 每天凌晨 3 點（台灣時間）把資料庫備份到 EINVOICE_BACKUP_DIR，保留最近 EINVOICE_BACKUP_KEEP 份（預設 60）
// 只在公司伺服器上跑；Netlify（雲端函式）不跑。
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { runQueue } from '../utils/einvoice/service'
import { backupTo, dbPath } from '../utils/einvoice/db'
import { twParts } from '../utils/einvoice/period'

const EVERY_MS = 10 * 60_000

function backupIfDue() {
  const p = twParts()
  if (p.hh < 3) return
  const dir = resolve(process.env.EINVOICE_BACKUP_DIR || join(dbPath(), '..', 'backup'))
  mkdirSync(dir, { recursive: true })
  const name = `einvoice-${p.y}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}.sqlite`
  const file = join(dir, name)
  if (existsSync(file)) return
  backupTo(file)
  console.log('[einvoice] 已備份資料庫', file)
  const keep = Number(process.env.EINVOICE_BACKUP_KEEP || 60)
  const old = readdirSync(dir).filter((f) => /^einvoice-\d{8}\.sqlite$/.test(f)).sort().slice(0, -keep)
  for (const f of old) unlinkSync(join(dir, f))
}

export default defineNitroPlugin(() => {
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) return
  if (!process.env.EINVOICE_API_TOKEN) return // 沒設定電子發票就不啟動

  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const r = await runQueue()
      if (r.uploads.length || r.cancels.length || r.batch) console.log('[einvoice] 排程', JSON.stringify(r))
    } catch (e) {
      console.error('[einvoice] 排程失敗', (e as Error).message)
    }
    try { backupIfDue() } catch (e) { console.error('[einvoice] 備份失敗', (e as Error).message) }
    running = false
  }
  setTimeout(tick, 30_000)
  setInterval(tick, EVERY_MS)
})
