// 「區網優先，不通才走家裡 Hub」的共用工具（電子發票、商品都用）。
// 平常：瀏覽器 → 本機 print-agent（127.0.0.1:17890）→ 區網資料機。
// 本機 print-agent 連不到資料機（503「連不到資料機」）或本機 print-agent 沒開時：
//   瀏覽器 → /api/station/**（Netlify）→ 家裡 Hub → 資料機上的 pos-agent → 資料機 print-agent。
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

/** 本機回應是否代表「區網連不到資料機」，該改走 Hub */
export async function lanUnreachable(res: Response) {
  if (res.status !== 503) return false
  const j = await res.clone().json().catch(() => null)
  const msg = String(j?.message || j?.error || '')
  return msg.startsWith('連不到資料機')
}

/** 經家裡 Hub 打資料機。sub 例如 'einvoice/issue'、'catalog/all' */
export function hubFetch(sub: string, init: RequestInit = {}) {
  const token = stationToken()
  if (!token) return Promise.reject(new Error('沒有設定收銀機密碼，無法改走 Hub（系統設定 → 電子發票）'))
  const headers = new Headers(init.headers)
  headers.set('x-pos-token', token)
  headers.set('x-pos-station', stationLabel())
  return fetch(`/api/station/${sub}`, { ...init, headers })
}
