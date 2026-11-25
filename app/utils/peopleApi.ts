// 員工、VIP 會員、折扣類型：存在公司資料機的 print-agent（People.cs，people-data\people.json）。
// 區網優先：先打本機 print-agent（http://127.0.0.1:17890/people/*），收銀機的 print-agent 轉給資料機；
//   行動平板的 print-agent 留一份鏡像，離線也能選員工 / VIP（修改要連得到資料機）。
// 本機 print-agent 沒開或區網連不到資料機時，改走家裡 Hub（/api/station/people/**，見 stationApi.ts）。
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable } from './stationApi'

export type PeopleList = 'employees' | 'vipMembers' | 'discountTypes'

export interface PeopleAll {
  ok: true
  employees: any[] | null // null = 資料機還沒存過這個清單
  vipMembers: any[] | null
  discountTypes: any[] | null
  updatedAt: Partial<Record<PeopleList, string>>
  offline?: boolean
  offlineReason?: string
}

async function withTimeout(run: (signal?: AbortSignal) => Promise<Response>, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
  try { return await run(ctrl?.signal) } finally { if (timer) clearTimeout(timer) }
}

async function call(method: 'GET' | 'POST', sub: string, body?: unknown, timeoutMs = 15000): Promise<PeopleAll> {
  // text/plain 是「簡單請求」，Mypal 不會先送 OPTIONS
  const init: RequestInit = {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'text/plain' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  }
  let res: Response | null = null
  let lanError = ''
  const base = printAgentUrl()
  if (base !== 'off') {
    try {
      res = await withTimeout(signal => fetch(`${base}/people/${sub}`, { ...init, signal }), timeoutMs)
      if (await lanUnreachable(res)) { lanError = '區網連不到資料機'; res = null }
    } catch {
      lanError = '連不到本機 print-agent'
    }
  }
  if (!res) {
    try {
      res = await withTimeout(signal => hubFetch(`people/${sub}`, { ...init, signal }), timeoutMs + 20000)
    } catch (e) {
      throw new Error(`${lanError || 'print-agent 已關閉'}，也無法經家裡 Hub 連線（${(e as Error).message}）`)
    }
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || `資料機回應 ${res.status}`)
  return data as PeopleAll
}

export const peopleAll = () => call('GET', 'all', undefined, 8000)
export const peopleSave = (list: PeopleList, items: unknown[]) => call('POST', 'save', { list, items })
