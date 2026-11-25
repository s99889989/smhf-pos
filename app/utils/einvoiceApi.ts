// 前端呼叫電子發票後端。
// 收銀網站在 Netlify，發票後端在公司內部；瀏覽器只跟收銀機本機的 print-agent 講話
// （http://127.0.0.1:17890/einvoice/*），由 print-agent 轉給公司內的發票後端並附上收銀機密碼。
// 這台收銀機要在「系統設定 → 電子發票」打開「啟用」，沒打開時一律用測試號碼（印「測試號碼」）。
import { detailRows, type PrintOrder } from './invoicePrint'
import { printAgentUrl } from './printAgent'

const ENABLED_KEY = 'pos-einvoice-enabled'

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
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; notConfigured: boolean; message: string }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, timeoutMs = 25000): Promise<ApiResult<T>> {
  if (!einvoiceEnabled()) return { ok: false, notConfigured: true, message: '這台收銀機沒有啟用電子發票' }
  const base = printAgentUrl()
  if (base === 'off') return { ok: false, notConfigured: false, message: 'print-agent 已關閉（pos-print-agent=off），無法開立電子發票' }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    // text/plain 是「簡單請求」，舊瀏覽器（Mypal）不會先送 OPTIONS
    const res = await fetch(`${base}/einvoice/${path}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'text/plain' } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl?.signal,
    })
    const json = await res.json().catch(() => null)
    if (res.ok) return { ok: true, data: json as T }
    const message = json?.data?.message || json?.error || json?.message || `HTTP ${res.status}`
    return { ok: false, notConfigured: false, message }
  } catch (e) {
    return { ok: false, notConfigured: false, message: `連不到 print-agent 或發票伺服器：${(e as Error).message}` }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 開立電子發票。品項與 QR Code 用同一份 detailRows（原價列出 + 應稅折扣一列）。 */
export function issueEInvoice(o: Pick<PrintOrder, 'items' | 'subtotal' | 'total'> & { no?: string; carrier?: string; buyerId?: string }) {
  const items = detailRows(o as PrintOrder).map(r => ({ name: r.name, qty: r.qty, unitPrice: r.qty ? r.amount / r.qty : r.amount }))
  return call<IssuedInvoice>('POST', 'issue', {
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
export const runEInvoiceQueue = () => call<any>('POST', 'run', {}, 120000)

/** BM92177850 → BM-92177850（列印用） */
export const formatInvoiceNo = (no: string) => `${no.slice(0, 2)}-${no.slice(2)}`
