// 前端呼叫電子發票後端（號碼與資料在公司資料機的 print-agent）。
// 區網優先：瀏覽器先打本機 print-agent（http://127.0.0.1:17890/einvoice/*），收銀機的 print-agent 轉給資料機；
// 本機 print-agent 沒開、或它連不到資料機時，改走家裡 Hub（/api/station/einvoice/*，見 stationApi.ts）。
// 開立帶 requestId：區網逾時後改走 Hub 重送，資料機會回同一張，不會開兩張。
// 這台收銀機要在「系統設定 → 電子發票」打開「啟用」，沒打開時一律用測試號碼（印「測試號碼」）。
import { detailRows, type PrintOrder } from './invoicePrint'
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable, errorText, lanSkipped, markLanDown } from './stationApi'

const ENABLED_KEY = 'pos-einvoice-enabled'
// 只有「開立 / 作廢」要這台有啟用；查看（清單、狀態、查詢）任何連得到資料機的電腦都可以（例如家裡經 Hub）
// 匯入舊系統發票只存紀錄、不開票不上傳，也不用啟用（例如在家裡或資料機上匯入）
const READ_ONLY = new Set(['status', 'list', 'query', 'legacy-import'])

export function einvoiceEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) === '1' } catch { return false }
}
export function setEInvoiceEnabled(v: boolean) {
  try { v ? localStorage.setItem(ENABLED_KEY, '1') : localStorage.removeItem(ENABLED_KEY) } catch { /* 無痕模式 */ }
}

export interface IssuedInvoice {
  invoiceNo: string // BM92177850
  issuedAt: string
  randomCode: string
  aes: string
  term: string
  mock?: boolean // 資料機設 Endpoint=mock（模擬加值中心）開的測試發票
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; notConfigured: boolean; message: string }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = 25000): Promise<ApiResult<T>> {
  if (!einvoiceEnabled() && !READ_ONLY.has(path)) return { ok: false, notConfigured: true, message: '這台收銀機沒有啟用電子發票' }
  const base = printAgentUrl()
  const init = (): RequestInit => ({
    method,
    // text/plain 是「簡單請求」，舊瀏覽器（Mypal）不會先送 OPTIONS
    headers: method === 'POST' ? { 'Content-Type': 'text/plain' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let lanError = ''
  if (base !== 'off' && !lanSkipped()) {
    try {
      const res = await withTimeout(signal => fetch(`${base}/einvoice/${path}`, { ...init(), signal }), timeoutMs)
      if (!(await lanUnreachable(res))) return toResult<T>(res)
      lanError = '區網連不到資料機'
      markLanDown()
    } catch (e) {
      lanError = `連不到本機 print-agent（${(e as Error).message}）`
      markLanDown()
    }
  }
  // 備援：走家裡 Hub
  try {
    const res = await withTimeout(signal => hubFetch(`einvoice/${path}`, { ...init(), signal }), timeoutMs + 20000)
    return toResult<T>(res)
  } catch (e) {
    return { ok: false, notConfigured: false, message: `${lanError || 'print-agent 已關閉'}，改走家裡 Hub 也失敗：${(e as Error).message}` }
  }
}

async function withTimeout(run: (signal?: AbortSignal) => Promise<Response>, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
  try { return await run(ctrl?.signal) } finally { if (timer) clearTimeout(timer) }
}

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const json = await res.json().catch(() => null)
  if (res.ok) return { ok: true, data: json as T }
  const message = errorText(json, res.status)
  return { ok: false, notConfigured: false, message }
}

function newRequestId() {
  const r = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${r()}${r()}`
}

/** 開立電子發票。品項與 QR Code 用同一份 detailRows（原價列出 + 應稅折扣一列）。 */
export function issueEInvoice(o: Pick<PrintOrder, 'items' | 'subtotal' | 'total'> & { no?: string; carrier?: string; buyerId?: string }) {
  const items = detailRows(o as PrintOrder).map(r => ({ name: r.name, qty: r.qty, unitPrice: r.qty ? r.amount / r.qty : r.amount }))
  return call<IssuedInvoice>('POST', 'issue', {
    requestId: newRequestId(),
    orderNo: o.no ?? '',
    items,
    total: o.total,
    carrier: (o.carrier ?? '').trim().toUpperCase(),
    buyerId: o.buyerId ?? '',
  })
}

export const cancelEInvoice = (invoiceNo: string, reason = '退貨') =>
  call<{ invoiceNo: string; status: string; msg: string }>('POST', 'cancel', { invoiceNo, reason })
export const einvoiceStatus = () => call<any>('GET', 'status')

export interface InvoiceRecord {
  invoiceNo: string // BM92177850
  issuedAt: string // 2026-11-25 14:03:11（資料機時間）
  total: number
  orderNo: string
  station: string
  fromTablet: boolean
  carrier: string
  uploadStatus: 'pending' | 'done' | string
  uploadAttempts: number
  uploadMsg: string
  uploadedAt: string
  queryResult?: string // 向加值中心查詢狀態（QueryInvoiceStatus）的回覆原文；沒查過是空的
  queryAt?: string
  cancelStatus: 'pending' | 'done' | 'needApproval' | null
  cancelMsg: string
  buyerId?: string
  legacy?: boolean // 舊系統（BK35 / 葆光）的發票，uploadStatus = 'legacy'（print-agent 1.18 起）
  live?: boolean // true = 資料機直接查舊系統 SQL 來的；false/沒有 = 從 CSV 匯入的
  payNote?: string // 舊系統「備註說明」：現收、信用卡、宅配匯款…
}
/** 營業報表用：資料機上 from～to（yyyy-MM-dd，含）開立的發票和上傳 / 作廢狀態，含平板同步來的。一次最多兩個月。 */
// refresh = true：資料機不用暫存的葆光資料，重查一次（print-agent 1.23 起有暫存）
export const listEInvoices = (from: string, to: string, refresh = false) =>
  call<{ from: string; to: string; invoices: InvoiceRecord[]; truncated: boolean; legacyLive?: boolean; legacyError?: string | null; legacyCachedAt?: string; legacyCached?: boolean }>('POST', 'list', { from, to, refresh }, 40000)
export const runEInvoiceQueue = () => call<any>('POST', 'run', {}, 120000)
/** 向加值中心查一張發票的狀態 */
export const queryEInvoice = (invoiceNo: string) =>
  call<{ invoiceNo: string; queryResult: string; queryAt: string }>('POST', 'query', { invoiceNo: invoiceNo.replace('-', '') }, 40000)
/** 向加值中心查 from～to 已上傳的發票（一次最多 100 張，資料機每天也會自動查前一天的） */
export const queryEInvoiceRange = (from: string, to: string) =>
  call<{ queried: number; failed: number; total: number; lastError: string }>('POST', 'query', { from, to }, 120000)

/** BM92177850 → BM-92177850（列印用） */
export const formatInvoiceNo = (no: string) => `${no.slice(0, 2)}-${no.slice(2)}`

/** 舊系統匯出 CSV 的一張發票（網頁解析後送資料機） */
export interface LegacyInvoice {
  invoiceNo: string
  date: string // yyyy-MM-dd
  time: string // HH:mm:ss（建檔時間跟發票同一天才有，否則 00:00:00）
  total: number
  buyerId: string
  orderNo: string
  posId: string // 001 小舖
  payNote: string
  voided: boolean
  seq: string
  createdAt: string
}
export interface LegacyImportResult {
  dryRun: boolean
  added: number
  updated: number
  unchanged: number
  invalid: number
  inNewSystem: number
  inNewSystemNos: string[]
  invalidNos: string[]
}
/** 匯入舊系統發票到資料機（print-agent 1.18 起）：只存紀錄，不上傳加值中心；dryRun 只算會新增幾張 */
export const importLegacyInvoices = (invoices: LegacyInvoice[], dryRun: boolean) =>
  call<LegacyImportResult>('POST', 'legacy-import', { invoices, dryRun }, 60000)
