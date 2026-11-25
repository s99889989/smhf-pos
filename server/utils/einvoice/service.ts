// 電子發票核心流程：配號（本批 + 預取下一批 + 預取下一期）、開立、上傳佇列、作廢。
// 流程照舊 BK35 InvPost.exe / InvSrv 還原（invoice-research/BK35發票完整規格.md §5、§6）。
// 跑在公司伺服器（單一 Node 程式 + SQLite），斷網時只要還有預取的號碼就能繼續開票，上傳等網路恢復再補。
import { db, tx, nowIso, minutesLater } from './db'
import { einvoiceConfig, type EInvoiceConfig } from './config'
import { termOf, nextTerm, termKey, twParts, type Term } from './period'
import { invoiceQrAes, genRandomCode } from './qrAes'
import { buildInvoiceXml, buildCancelXml, carrierTypeOf, type EInvoiceData, type EInvoiceItem } from './invoiceXml'
import {
  applyInvoiceNumber, takeInvoiceNumber, uploadInvoice, uploadCancelInvoice, CetustekNetworkError,
} from './cetustek'

const BATCH_KEEP = 2         // 本期至少保留 2 批有號碼（用中的 + 預取的下一批）
const NEXT_TERM_FROM_DAY = 20 // 期別第二個月 20 號起預抓下一期
const MAX_BACKOFF_MIN = 60

export class EInvoiceError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

type Row = Record<string, any>

// ---------------- 取號 ----------------

let fetching: Promise<unknown> | null = null // 同一時間只取一批

/** 向加值中心申請並取回一批號碼（申請號先存起來，取號失敗下次用同一個申請號重試） */
async function fetchBatch(cfg: EInvoiceConfig, term: Term) {
  const d = db()
  const key = `apply:${termKey(term)}`
  let applyNo = (d.prepare('SELECT value FROM einvoice_state WHERE key = ?').get(key) as Row | undefined)?.value as string | undefined
  if (!applyNo) {
    applyNo = await applyInvoiceNumber(cfg, term.rocYear, term.label)
    d.prepare(`INSERT INTO einvoice_state (key, value, updated_at) VALUES (?, ?, ?)
               ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(key, applyNo, nowIso())
  }
  const b = await takeInvoiceNumber(cfg, applyNo)
  tx((t) => {
    t.prepare(`INSERT INTO einvoice_batches (roc_year, term, track, start_no, end_no, next_no, apply_no, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (track, start_no) DO NOTHING`)
      .run(term.rocYear, term.label, b.track, b.start, b.end, b.start, applyNo!, nowIso())
    t.prepare('DELETE FROM einvoice_state WHERE key = ?').run(key)
  })
  return b
}

function availableBatches(term: Term) {
  return db().prepare(`
    SELECT count(*) AS batches, coalesce(sum(end_no - next_no + 1), 0) AS remaining
    FROM einvoice_batches WHERE roc_year = ? AND term = ? AND next_no <= end_no`).get(term.rocYear, term.label) as { batches: number; remaining: number }
}

/** 確保本期有「用中 + 預取」兩批，期末前預抓下一期。一次最多取一批；正在取號時回傳 null。 */
export async function ensureBatches(cfg: EInvoiceConfig, now = new Date()) {
  const cur = termOf(now)
  const nt = nextTerm(cur)
  const p = twParts(now)
  let want: Term | null = null
  if (availableBatches(cur).batches < BATCH_KEEP) want = cur
  else if (p.m === cur.startMonth + 1 && p.d >= NEXT_TERM_FROM_DAY && availableBatches(nt).batches < 1) want = nt
  if (!want) return null
  if (fetching) { await fetching.catch(() => {}); return null }
  const job = fetchBatch(cfg, want)
  fetching = job
  try { return await job } finally { fetching = null }
}

// ---------------- 開立 ----------------

export interface IssueInput {
  orderNo?: string
  items: EInvoiceItem[]
  total: number
  freeTaxAmount?: number
  buyerId?: string
  carrier?: string
  npoban?: string
  payWay?: string
}

function validate(input: IssueInput) {
  if (!input || !Array.isArray(input.items) || !input.items.length) throw new EInvoiceError('沒有品項')
  if (!Number.isInteger(input.total) || input.total <= 0) throw new EInvoiceError('總計金額不對')
  const sum = input.items.reduce((s, i) => s + i.unitPrice * i.qty, 0)
  if (Math.abs(sum - input.total) > 0.01) throw new EInvoiceError(`品項加總 ${sum} 與總計 ${input.total} 不符`)
  if (input.buyerId && !/^\d{8}$/.test(input.buyerId)) throw new EInvoiceError('買方統編要 8 碼數字')
  if (input.carrier) {
    try { carrierTypeOf(input.carrier) } catch { throw new EInvoiceError('載具格式不對（手機條碼 / 開頭 8 碼）') }
  }
  if (input.npoban && !/^\d{3,7}$/.test(input.npoban)) throw new EInvoiceError('愛心碼要 3–7 碼數字')
}

/** 配號 + 寫入發票，同一個交易（不會重號、也不會跳號） */
function allocate(term: Term, issuedAt: Date, input: IssueInput, randomCode: string) {
  const p = twParts(issuedAt)
  const yymmdd = `${String(p.y).slice(2)}${String(p.m).padStart(2, '0')}${String(p.d).padStart(2, '0')}`
  return tx((t) => {
    const b = t.prepare(`SELECT id, track, next_no FROM einvoice_batches
                         WHERE roc_year = ? AND term = ? AND next_no <= end_no ORDER BY id LIMIT 1`).get(term.rocYear, term.label) as Row | undefined
    if (!b) return null
    const num = String(b.next_no).padStart(8, '0')
    const invoiceNo = `${b.track}${num}`
    t.prepare('UPDATE einvoice_batches SET next_no = next_no + 1 WHERE id = ?').run(b.id)
    t.prepare(`INSERT INTO einvoices (invoice_no, batch_id, roc_year, term, order_no, order_id, issued_at, random_code,
                 total, free_tax, buyer_id, carrier, npoban, pay_way, items, upload_next_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(invoiceNo, b.id, term.rocYear, term.label, input.orderNo ?? '', `${yymmdd}P${num.slice(-5)}`,
        issuedAt.toISOString(), randomCode, input.total, input.freeTaxAmount ?? 0, input.buyerId ?? '',
        input.carrier ?? '', input.npoban ?? '', input.payWay ?? '1', JSON.stringify(input.items), nowIso())
    return invoiceNo
  })
}

export async function issueInvoice(input: IssueInput) {
  validate(input)
  const cfg = einvoiceConfig()
  const issuedAt = new Date()
  const term = termOf(issuedAt)
  const randomCode = genRandomCode()

  let invoiceNo = allocate(term, issuedAt, input, randomCode)
  for (let i = 0; !invoiceNo && i < 2; i++) {
    // 本期沒號碼了：當場取一批（需要網路）
    await ensureBatches(cfg, issuedAt).catch((e) => {
      throw new EInvoiceError(`沒有可用的發票號碼，向加值中心取號失敗：${(e as Error).message}`, 503)
    })
    invoiceNo = allocate(term, issuedAt, input, randomCode)
  }
  if (!invoiceNo) throw new EInvoiceError('沒有可用的發票號碼（取號中，請稍後再試）', 503)

  return {
    invoiceNo,
    issuedAt: issuedAt.toISOString(),
    randomCode,
    aes: invoiceQrAes(invoiceNo, randomCode, cfg.qrAesKey),
    term: `${term.rocYear}年${term.label}月`,
  }
}

// ---------------- 上傳佇列 ----------------

const backoff = (attempts: number) => Math.min(MAX_BACKOFF_MIN, 2 ** attempts)
const inFlight = new Set<string>()

function rowToData(r: Row): EInvoiceData {
  return {
    invoiceNo: r.invoice_no, issuedAt: new Date(r.issued_at), orderId: r.order_id,
    buyerId: r.buyer_id, carrier: r.carrier, npoban: r.npoban, randomCode: r.random_code,
    total: r.total, freeTaxAmount: r.free_tax, payWay: r.pay_way, items: JSON.parse(r.items),
  }
}

export async function uploadOne(cfg: EInvoiceConfig, invoiceNo: string) {
  if (inFlight.has(invoiceNo)) return null
  const d = db()
  const r = d.prepare(`SELECT * FROM einvoices WHERE invoice_no = ? AND upload_status = 'pending'`).get(invoiceNo) as Row | undefined
  if (!r) return null
  inFlight.add(invoiceNo)
  let ok = false
  let msg: string
  try {
    try {
      const res = await uploadInvoice(cfg, buildInvoiceXml(rowToData(r)))
      ok = res.kind === 'ok'
      msg = `${res.code} ${res.message}`
    } catch (e) {
      msg = e instanceof CetustekNetworkError ? `網路：${e.message}` : (e as Error).message
    }
    if (ok) {
      d.prepare(`UPDATE einvoices SET upload_status = 'done', uploaded_at = ?, upload_msg = ?, upload_attempts = upload_attempts + 1
                 WHERE invoice_no = ?`).run(nowIso(), msg, invoiceNo)
    } else {
      d.prepare(`UPDATE einvoices SET upload_attempts = upload_attempts + 1, upload_msg = ?, upload_next_at = ?
                 WHERE invoice_no = ?`).run(msg, minutesLater(backoff(r.upload_attempts + 1)), invoiceNo)
    }
  } finally { inFlight.delete(invoiceNo) }
  return { invoiceNo, ok, msg }
}

export async function cancelOne(cfg: EInvoiceConfig, invoiceNo: string) {
  const key = 'cancel:' + invoiceNo
  if (inFlight.has(key)) return null
  const d = db()
  // 作廢要在開立上傳成功之後才送
  const r = d.prepare(`SELECT * FROM einvoices WHERE invoice_no = ? AND cancel_status = 'pending' AND upload_status = 'done'`).get(invoiceNo) as Row | undefined
  if (!r) return null
  inFlight.add(key)
  let status: 'done' | 'pending' | 'needApproval' = 'pending'
  let msg: string
  try {
    try {
      const res = await uploadCancelInvoice(cfg, buildCancelXml({
        invoiceNo, issuedAt: new Date(r.issued_at), buyerId: r.buyer_id, cancelAt: new Date(r.cancel_at), reason: r.cancel_reason,
      }))
      status = res.kind === 'ok' ? 'done' : res.kind === 'needApproval' ? 'needApproval' : 'pending'
      msg = `${res.code} ${res.message}`
    } catch (e) {
      msg = e instanceof CetustekNetworkError ? `網路：${e.message}` : (e as Error).message
    }
    d.prepare(`UPDATE einvoices SET cancel_status = ?, cancel_msg = ?, cancel_attempts = cancel_attempts + 1,
               cancel_next_at = ?, cancelled_at = CASE WHEN ? = 'done' THEN ? ELSE cancelled_at END
               WHERE invoice_no = ?`).run(status, msg, minutesLater(backoff(r.cancel_attempts + 1)), status, nowIso(), invoiceNo)
  } finally { inFlight.delete(key) }
  return { invoiceNo, status, msg }
}

/** 排程用：補傳到期的發票與作廢，順便補號碼 */
export async function runQueue(limit = 30) {
  const cfg = einvoiceConfig()
  const d = db()
  const now = nowIso()
  const ups = d.prepare(`SELECT invoice_no FROM einvoices WHERE upload_status = 'pending' AND upload_next_at <= ?
                         ORDER BY issued_at LIMIT ?`).all(now, limit) as Row[]
  const uploads = []
  for (const u of ups) uploads.push(await uploadOne(cfg, u.invoice_no))
  const cs = d.prepare(`SELECT invoice_no FROM einvoices WHERE cancel_status = 'pending' AND upload_status = 'done'
                        AND cancel_next_at <= ? ORDER BY cancel_at LIMIT ?`).all(now, limit) as Row[]
  const cancels = []
  for (const c of cs) cancels.push(await cancelOne(cfg, c.invoice_no))
  let batch: string | null = null
  try {
    const b = await ensureBatches(cfg)
    if (b) batch = `${b.track}${b.start}-${b.end}`
  } catch (e) { batch = `取號失敗：${(e as Error).message}` }
  return { uploads: uploads.filter(Boolean), cancels: cancels.filter(Boolean), batch }
}

// ---------------- 作廢 ----------------

export async function cancelInvoice(invoiceNo: string, reason: string) {
  const cfg = einvoiceConfig()
  const d = db()
  const no = invoiceNo.replace('-', '').toUpperCase()
  const r = d.prepare('SELECT cancel_status, upload_status FROM einvoices WHERE invoice_no = ?').get(no) as Row | undefined
  if (!r) throw new EInvoiceError('查無此發票', 404)
  if (r.cancel_status) throw new EInvoiceError('這張發票已經作廢過', 409)
  const now = nowIso()
  d.prepare(`UPDATE einvoices SET cancel_status = 'pending', cancel_reason = ?, cancel_at = ?, cancel_next_at = ?
             WHERE invoice_no = ?`).run(reason || '退貨', now, now, no)
  // 還沒上傳成功的先傳，再送作廢
  if (r.upload_status !== 'done') await uploadOne(cfg, no)
  return (await cancelOne(cfg, no)) ?? { invoiceNo: no, status: 'pending', msg: '開立尚未上傳成功，排程會先補傳再作廢' }
}

// ---------------- 狀態 ----------------

export function einvoiceStatus() {
  const d = db()
  const cur = termOf()
  const nt = nextTerm(cur)
  const batches = d.prepare(`
    SELECT roc_year, term, track, start_no, end_no, next_no, created_at FROM einvoice_batches
    WHERE (roc_year = ? AND term = ?) OR (roc_year = ? AND term = ?) ORDER BY id`).all(cur.rocYear, cur.label, nt.rocYear, nt.label)
  const counts = d.prepare(`
    SELECT count(*) FILTER (WHERE upload_status = 'pending') AS pending_upload,
           count(*) FILTER (WHERE upload_status = 'pending' AND upload_attempts >= 3) AS failing_upload,
           count(*) FILTER (WHERE cancel_status = 'pending') AS pending_cancel,
           count(*) FILTER (WHERE cancel_status = 'needApproval') AS cancel_need_approval,
           min(issued_at) FILTER (WHERE upload_status = 'pending') AS oldest_pending
    FROM einvoices`).get()
  const problems = d.prepare(`
    SELECT invoice_no, issued_at, upload_status, upload_attempts, upload_msg, cancel_status, cancel_msg
    FROM einvoices WHERE (upload_status = 'pending' AND upload_attempts > 0) OR cancel_status IN ('pending', 'needApproval')
    ORDER BY issued_at LIMIT 50`).all()
  return { term: termKey(cur), batches, counts, problems }
}
