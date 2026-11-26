// 連線狀況：每台開著 smhf-pos 的瀏覽器定時向資料機報到（print-agent 1.6 的 Presence.cs），
// 「系統 → 連線狀況」頁讀回各台最後出現的時間，並分段測試這台電腦到資料機的兩條路：
//   區網：瀏覽器 → 本機 print-agent（127.0.0.1:17890）→ 資料機 print-agent（:17891）
//   Hub ：瀏覽器 → Netlify /api/station → 家裡 Hub → 資料機上的 pos-agent → 資料機 print-agent（127.0.0.1:17891）
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable, errorText, stationToken } from './stationApi'

const ID_KEY = 'pos-device-id'
const NAME_KEY = 'pos-device-name'

/** 這個瀏覽器的代號（第一次用時隨機產生，存在 localStorage） */
export function deviceId() {
  try {
    let v = localStorage.getItem(ID_KEY)
    if (!v) {
      v = 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      localStorage.setItem(ID_KEY, v)
    }
    return v
  } catch { return '' }
}
/** 這台的名稱（連線狀況頁可改，例如「餐廳收銀 1」「卡爾手機」） */
export function deviceName() {
  try { return localStorage.getItem(NAME_KEY) || '' } catch { return '' }
}
export function setDeviceName(v: string) {
  try { v.trim() ? localStorage.setItem(NAME_KEY, v.trim()) : localStorage.removeItem(NAME_KEY) } catch { /* 無痕模式 */ }
}

/** 瀏覽器 / 系統簡稱，例如「Mypal · XP」「Chrome · Android」 */
export function shortUa(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const b = /Mypal/.test(ua) ? 'Mypal' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '瀏覽器'
  const os = /Windows NT 5\./.test(ua) ? 'XP' : /Windows NT 6\.1/.test(ua) ? 'Win7' : /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'Mac' : ''
  return os ? `${b} · ${os}` : b
}

export interface PresenceDevice {
  deviceId: string
  name: string
  station: string
  via: 'lan' | 'hub' | string
  page: string
  ua: string
  agent: string // 本機 print-agent 版本，沒開是空的
  from: string // 轉送的電腦名稱（走 Hub 時是網頁的站別標籤）
  firstSeen: string
  lastSeen: string
}
export interface PresenceList {
  ok: true
  server: string // 資料機電腦名稱
  version: string
  now: string
  startedAt: string
  devices: PresenceDevice[]
}

async function withTimeout(run: (signal?: AbortSignal) => Promise<Response>, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
  try { return await run(ctrl?.signal) } finally { if (timer) clearTimeout(timer) }
}

/** 本機 print-agent 的 /status；沒開回 null */
export async function localAgentStatus(timeoutMs = 2500): Promise<{ version: string; printer: string; billPrinter: string } | null> {
  const base = printAgentUrl()
  if (base === 'off') return null
  try {
    const res = await withTimeout(signal => fetch(`${base}/status`, { signal }), timeoutMs)
    const j = await res.json().catch(() => null)
    return res.ok && j?.ok ? { version: String(j.version || ''), printer: String(j.printer || ''), billPrinter: String(j.billPrinter || '') } : null
  } catch { return null }
}

// ---------------- 報到 ----------------

let lastAgentVersion = ''

/** 向資料機報到一次，回傳走哪條路（'lan' | 'hub'），都失敗回 '' */
export async function sendPing(page: string, station: string): Promise<'lan' | 'hub' | ''> {
  const st = await localAgentStatus()
  lastAgentVersion = st?.version ?? ''
  const body = (via: string) => JSON.stringify({
    deviceId: deviceId(), name: deviceName(), station, via, page, ua: shortUa(), agent: lastAgentVersion,
  })
  const base = printAgentUrl()
  if (st && base !== 'off') {
    try {
      const res = await withTimeout(signal => fetch(`${base}/presence/ping`, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body('lan'), signal,
      }), 6000)
      if (res.ok) return 'lan'
      // 503 連不到資料機 / 404 舊版 print-agent：改走 Hub
    } catch { /* 改走 Hub */ }
  }
  if (!stationToken()) return ''
  try {
    const res = await withTimeout(signal => hubFetch('presence/ping', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body('hub'), signal,
    }), 25000)
    return res.ok ? 'hub' : ''
  } catch { return '' }
}

// ---------------- 分段測試 ----------------

export type HopState = 'ok' | 'fail' | 'unknown' | 'old'

export interface LanCheck {
  agent: HopState // 本機 print-agent
  agentVersion: string
  dataMachine: HopState // 資料機 print-agent（經區網）
  notCashier: boolean // 這台 print-agent 沒設定 Server=（不是收銀機，區網這條本來就不通）
  message: string
  ms: number
  list: PresenceList | null
}

export async function checkLan(): Promise<LanCheck> {
  const r: LanCheck = { agent: 'unknown', agentVersion: '', dataMachine: 'unknown', notCashier: false, message: '', ms: 0, list: null }
  const base = printAgentUrl()
  if (base === 'off') { r.message = '這台設定成不用 print-agent（pos-print-agent = off）'; return r }
  const st = await localAgentStatus(3000)
  if (!st) { r.agent = 'fail'; r.message = '本機 print-agent 沒開（127.0.0.1:17890 連不到）'; return r }
  r.agent = 'ok'; r.agentVersion = st.version
  const t0 = Date.now()
  try {
    const res = await withTimeout(signal => fetch(`${base}/presence/list`, { signal }), 8000)
    r.ms = Date.now() - t0
    const j = await res.clone().json().catch(() => null)
    if (res.ok && j?.ok) { r.dataMachine = 'ok'; r.list = j as PresenceList; return r }
    if (await lanUnreachable(res)) {
      const msg = errorText(j, res.status)
      if (msg.includes('einvoice.ini')) { r.notCashier = true; r.message = '這台的 print-agent 沒有設定資料機位址（einvoice.ini 的 Server=），不是收銀機' }
      else { r.dataMachine = 'fail'; r.message = msg }
      return r
    }
    if (res.status === 404) {
      if (verLess(st.version, '1.6')) { r.agent = 'old'; r.message = `本機 print-agent 是 ${st.version || '舊'} 版，要更新到 1.6 才看得到連線狀況` }
      else { r.dataMachine = 'old'; r.message = '資料機連得到，但資料機的 print-agent 要更新到 1.6' }
      return r
    }
    r.dataMachine = 'fail'; r.message = errorText(j, res.status)
  } catch (e) {
    r.ms = Date.now() - t0
    r.dataMachine = 'fail'; r.message = `本機 print-agent 沒回應（${(e as Error).message}）`
  }
  return r
}

export interface HubCheck {
  netlify: HopState // 網站伺服器（/api/station）
  hub: HopState // 家裡 Hub
  posAgent: HopState // 資料機上的 pos-agent
  dataMachine: HopState // 資料機 print-agent（127.0.0.1:17891）
  noToken: boolean
  message: string
  ms: number
  list: PresenceList | null
}

export async function checkHub(): Promise<HubCheck> {
  const r: HubCheck = { netlify: 'unknown', hub: 'unknown', posAgent: 'unknown', dataMachine: 'unknown', noToken: false, message: '', ms: 0, list: null }
  if (!stationToken()) { r.noToken = true; r.message = '這台沒有設定收銀機密碼（系統設定 → 電子發票），不能走家裡 Hub'; return r }
  const t0 = Date.now()
  let res: Response
  try {
    res = await withTimeout(signal => hubFetch('presence/list', { signal }), 35000)
  } catch (e) {
    r.ms = Date.now() - t0
    r.netlify = 'fail'; r.message = `連不到網站伺服器（${(e as Error).message}）`
    return r
  }
  r.ms = Date.now() - t0
  const j = await res.json().catch(() => null)
  const msg = errorText(j, res.status)
  const fromNetlify = j && typeof j.statusCode === 'number' // Nuxt 伺服器自己丟的錯誤
  if (res.ok && j?.ok) {
    r.netlify = r.hub = r.posAgent = r.dataMachine = 'ok'; r.list = j as PresenceList; return r
  }
  r.message = msg
  if (!j) { r.netlify = 'fail'; return r }
  r.netlify = 'ok'
  if (res.status === 401 || msg.includes('還沒設定')) { r.netlify = 'fail'; return r }
  if (msg.includes('連不到家裡 Hub')) { r.hub = 'fail'; return r }
  r.hub = 'ok'
  if (msg.includes('pos-relay 未設定') || msg.includes('token 錯誤')) { r.hub = 'fail'; return r }
  if (msg.includes('pos-agent 不在線') || msg.includes('pos-agent 超過')) { r.posAgent = 'fail'; return r }
  if (res.status === 404 && fromNetlify) { r.netlify = 'old'; r.hub = 'unknown'; r.message = '網站還是舊版（還沒部署連線狀況功能）'; return r }
  r.posAgent = 'ok'
  if (res.status === 404) { r.dataMachine = 'old'; r.message = '資料機連得到，但資料機的 print-agent 要更新到 1.6'; return r }
  // 轉發失敗: Connection refused 等：pos-agent 在，但資料機本機 17891 沒開
  r.dataMachine = 'fail'
  return r
}

function verLess(a: string, b: string) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] || 0, q = y[i] || 0
    if (p !== q) return p < q
  }
  return false
}
