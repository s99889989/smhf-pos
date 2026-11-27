// 「區網優先，不通才走家裡 Hub」的共用工具（電子發票、商品都用）。
// 平常：瀏覽器 → 本機 print-agent（127.0.0.1:17890）→ 區網資料機。
// 本機 print-agent 連不到資料機（503「連不到資料機」）或本機 print-agent 沒開時：
//   瀏覽器 → 家裡 Hub（/holy/agent/pos-direct/**，直連）→ 資料機上的 pos-agent → 資料機 print-agent。
//   直連不通時才繞 /api/station/**（Netlify）→ 家裡 Hub。
const TOKEN_KEY = 'pos-station-token'

export function stationToken() {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}
export function setStationToken(v: string) {
  try { v ? localStorage.setItem(TOKEN_KEY, v.trim()) : localStorage.removeItem(TOKEN_KEY) } catch { /* 無痕模式 */ }
}
function stationLabel() {
  try { return localStorage.getItem('pos-station') || 'web' } catch { return 'web' }
}

/** 從錯誤回應取出文字訊息。Nuxt 伺服器的錯誤是 {error: true, statusMessage, message}，error 不是文字，不能直接拿來顯示 */
export function errorText(data: any, status: number) {
  for (const v of [data?.data?.message, data?.statusMessage, data?.message, data?.error]) {
    if (typeof v === 'string' && v.trim()) return v
  }
  return `資料機回應 ${status}`
}

// 本機 print-agent 不通（家裡電腦、沒開 print-agent、區網斷線）時記住 1 分鐘，期間直接走 Hub，
// 不要每個請求都先撞一次 127.0.0.1（console 一直噴 ERR_CONNECTION_REFUSED，也比較慢）。1 分鐘後再試區網。
const LAN_RETRY_MS = 60000
let lanDownUntil = 0
export function lanSkipped() { return Date.now() < lanDownUntil }
export function markLanDown() { lanDownUntil = Date.now() + LAN_RETRY_MS }

/** 本機回應是否代表「區網連不到資料機」，該改走 Hub */
export async function lanUnreachable(res: Response) {
  if (res.status !== 503) return false
  const j = await res.clone().json().catch(() => null)
  const msg = String(j?.message || j?.error || '')
  // 「einvoice.ini 還沒設定」：這台的 print-agent 不是收銀機也不是資料機（例如家裡、舊版 print-agent），一樣改走 Hub
  return msg.startsWith('連不到資料機') || msg.includes('einvoice.ini 還沒設定')
}

// 外網直連家裡 Hub（不經 Netlify）：Netlify 函式的機房在美國，經它要跨太平洋兩趟，外網存檔要好幾秒；
// 直接打 Hub 的 /holy/agent/pos-direct/** 只要零點幾秒。Hub 沒開直連（沒設定密碼）、密碼不對、
// pos-agent 不在線或這個網域沒被 Hub 允許時，自動退回原本的 /api/station（Netlify）。
// localStorage「pos-hub-direct」：填 off 關閉直連；填網址可改用別的 Hub。
// presence/*（連線狀況頁的分段測試）照舊走 Netlify，才測得出「網站伺服器」那段。
const HUB_DIRECT_URL = 'https://madustrialtd.asuscomm.com:8080'
const DIRECT_RECHECK_MS = 5 * 60000
let directOk = false
let directUntil = 0
let directProbe: Promise<boolean> | null = null

function hubDirectBase() {
  let v = ''
  try { v = (localStorage.getItem('pos-hub-direct') || '').trim() } catch { /* 無痕模式 */ }
  if (v === 'off') return ''
  return (v || HUB_DIRECT_URL).replace(/\/+$/, '')
}

function markDirectDown() { directOk = false; directUntil = Date.now() + DIRECT_RECHECK_MS }

function directUsable(base: string, token: string): Promise<boolean> {
  if (Date.now() < directUntil) return Promise.resolve(directOk)
  if (!directProbe) {
    directProbe = (async () => {
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 4000) : null
      let ok = false
      try {
        const res = await fetch(`${base}/holy/agent/pos-direct-check`, { headers: { 'x-pos-token': token }, signal: ctrl?.signal })
        const j = await res.json().catch(() => null)
        ok = res.ok && !!j?.ok && !!j?.agent
      } catch { ok = false } finally { if (timer) clearTimeout(timer) }
      directOk = ok
      directUntil = Date.now() + DIRECT_RECHECK_MS
      return ok
    })().finally(() => { directProbe = null })
  }
  return directProbe
}

/** 經家裡 Hub 打資料機。sub 例如 'einvoice/issue'、'catalog/all' */
export async function hubFetch(sub: string, init: RequestInit = {}) {
  const token = stationToken()
  if (!token) throw new Error('沒有設定收銀機密碼，無法改走 Hub（系統設定 → 電子發票）')
  const headers = new Headers(init.headers)
  headers.set('x-pos-token', token)
  headers.set('x-pos-station', stationLabel())
  const base = hubDirectBase()
  if (base && !sub.startsWith('presence/') && await directUsable(base, token)) {
    try {
      return await fetch(`${base}/holy/agent/pos-direct/${sub}`, { ...init, headers })
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e
      markDirectDown()
      // 送出去才斷的 POST 不能再送一次（例如開發票會開兩張）：直接報錯；GET 可以安全改走 Netlify 重試
      const method = (init.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') throw new Error('直連家裡 Hub 時連線中斷，請確認剛剛的動作有沒有成功再重試')
    }
  }
  return fetch(`/api/station/${sub}`, { ...init, headers })
}

/** 目前外網是不是直連家裡 Hub（給畫面顯示用） */
export const hubDirectActive = () => directOk && Date.now() < directUntil
