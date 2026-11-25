// 交易紀錄：每筆結帳存一份到公司資料機的 print-agent（Orders.cs，orders-data\yyyyMM\dd.jsonl）。
// 區網優先：先打本機 print-agent（http://127.0.0.1:17890/orders/*），收銀機的 print-agent 轉給資料機；
//   行動平板的 print-agent 先存本機，連得到資料機再補送。
// 本機 print-agent 沒開或區網連不到資料機時，改走家裡 Hub（/api/station/orders/**，見 stationApi.ts）。
// 兩條都不通時，訂單先放在這台瀏覽器（localStorage pos-order-outbox），之後每分鐘和下次開網頁時補送。
// 每筆帶 clientId，重送不會存兩次。
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable } from './stationApi'

const OUTBOX_KEY = 'pos-order-outbox'

export interface SavedOrder {
  clientId: string
  from: string // 送出的電腦名稱
  no: string
  createdAt: string // ISO
  location: string
  total: number
  [k: string]: any
}

async function withTimeout(run: (signal?: AbortSignal) => Promise<Response>, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
  try { return await run(ctrl?.signal) } finally { if (timer) clearTimeout(timer) }
}

/** 先區網、再 Hub。回傳 null 表示兩條都不通。 */
async function post(sub: string, body: unknown, timeoutMs = 15000): Promise<{ res: Response | null; error: string }> {
  // text/plain 是「簡單請求」，Mypal 不會先送 OPTIONS
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) }
  let lanError = ''
  const base = printAgentUrl()
  if (base !== 'off') {
    try {
      const res = await withTimeout(signal => fetch(`${base}/orders/${sub}`, { ...init, signal }), timeoutMs)
      if (!(await lanUnreachable(res))) return { res, error: '' }
      lanError = '區網連不到資料機'
    } catch {
      lanError = '連不到本機 print-agent'
    }
  }
  try {
    const res = await withTimeout(signal => hubFetch(`orders/${sub}`, { ...init, signal }), timeoutMs + 20000)
    return { res, error: '' }
  } catch (e) {
    return { res: null, error: `${lanError || 'print-agent 已關閉'}，也無法經家裡 Hub 連線（${(e as Error).message}）` }
  }
}

export function newClientId() {
  const r = () => Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}-${r()}${r()}`
}

type Job = { clientId: string; order: Record<string, any> }

function readOutbox(): Job[] {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]') } catch { return [] }
}
function writeOutbox(list: Job[]) {
  try { list.length ? localStorage.setItem(OUTBOX_KEY, JSON.stringify(list)) : localStorage.removeItem(OUTBOX_KEY) } catch { /* 無痕模式 */ }
}
export const pendingOrders = () => readOutbox().length

async function send(job: Job): Promise<'ok' | 'retry' | 'rejected'> {
  const { res } = await post('save', job)
  if (!res) return 'retry'
  if (res.ok) return 'ok'
  return res.status === 400 ? 'rejected' : 'retry'
}

let flushing: Promise<void> | null = null
/** 補送這台瀏覽器裡還沒送出的訂單（依序；遇到連不到就停，下次再來） */
export function flushOrderOutbox() {
  if (flushing) return flushing
  flushing = (async () => {
    try {
      for (const job of readOutbox()) {
        const r = await send(job)
        if (r === 'retry') break
        if (r === 'rejected') console.warn('資料機拒收這筆訂單，已略過：', job)
        writeOutbox(readOutbox().filter(j => j.clientId !== job.clientId))
      }
    } finally { flushing = null }
  })()
  return flushing
}

/** 存一筆訂單到資料機；送不出去就先排在這台，之後自動補送。回傳 true = 已到資料機（或平板的 print-agent）。 */
export async function saveOrder(clientId: string, order: Record<string, any>): Promise<boolean> {
  const job: Job = { clientId, order: JSON.parse(JSON.stringify(order)) }
  if (readOutbox().length === 0) {
    const r = await send(job)
    if (r !== 'retry') return r === 'ok'
  }
  writeOutbox([...readOutbox(), job])
  void flushOrderOutbox()
  return false
}

export type ListResult =
  | { ok: true; orders: SavedOrder[]; truncated: boolean; offline?: boolean; offlineReason?: string; pending?: number }
  | { ok: false; message: string }

/** 查資料機上 from～to（yyyy-MM-dd，含）的訂單，一次最多兩個月 */
export async function listOrders(from: string, to: string): Promise<ListResult> {
  const { res, error } = await post('list', { from, to }, 30000)
  if (!res) return { ok: false, message: error }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) return { ok: false, message: data?.error || data?.message || `資料機回應 ${res.status}` }
  return data
}

// 開網頁後、之後每分鐘補送一次
if (typeof window !== 'undefined') {
  setTimeout(() => { void flushOrderOutbox() }, 5000)
  setInterval(() => { if (pendingOrders()) void flushOrderOutbox() }, 60000)
}
