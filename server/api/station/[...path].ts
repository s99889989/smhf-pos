// 收銀機連不到公司資料機時的備援路線：
//   瀏覽器 → 這支 Netlify 路由 → 家裡 Hub（/holy/agent/pos-relay，帶 X-Relay-Token）→ 資料機上的 pos-agent（http_relay）
//   → 資料機本機的 print-agent（http://127.0.0.1:17891/einvoice/*、/catalog/*，帶 LanToken）
//
// 環境變數（Netlify 後台設定，不要寫進程式）：
//   POS_STATION_TOKEN   收銀機密碼：瀏覽器要帶 x-pos-token（系統設定頁填，存在 localStorage）
//   STATION_LAN_TOKEN   資料機 einvoice.ini 的 LanToken（只在伺服器端，不給瀏覽器）
//   HUB_RELAY_TOKEN     家裡 Hub 設定 holy.agent.pos-relay-token 的值
//   HUB_URL             選填，預設家裡 Hub
import { timingSafeEqual } from 'node:crypto'

const ALLOWED = /^(einvoice|catalog|orders|people|presence|update)\/[A-Za-z0-9_\-./%]*$/

// 轉發到家裡 Hub 失敗時，把 Node fetch 的英文錯誤翻成白話（前綴固定「連不到家裡 Hub：」，連線狀況頁靠它判斷是 Hub 這段）
function hubError(e: unknown, _timeoutMs: number) {
  const err = e as Error & { cause?: { code?: string; message?: string } }
  const code = err?.cause?.code || (err as any)?.code || ''
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return '找不到家裡的網址（DDNS 沒更新，或路由器的 DDNS 掛了）'
  if (code === 'ECONNREFUSED') return '家裡網路有通，但 8080 沒有程式在聽（Hub 沒在跑，或路由器埠轉發沒設好）'
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ETIMEDOUT' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH')
    return '連不上家裡（家裡網路斷了、路由器或 Hub 主機沒開機，或對外 IP 換了）'
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') return '家裡 Hub 連線被中斷（Hub 剛好重啟，或家裡網路不穩）'
  if (/CERT|SSL|TLS/i.test(code)) return `家裡 Hub 的 HTTPS 憑證有問題（${code}）`
  return `${err?.cause?.message || err?.message || '不明錯誤'}${code ? `（${code}）` : ''}`
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export default defineEventHandler(async (event) => {
  const posToken = process.env.POS_STATION_TOKEN || ''
  const lanToken = process.env.STATION_LAN_TOKEN || ''
  const relayToken = process.env.HUB_RELAY_TOKEN || ''
  if (!posToken || !lanToken || !relayToken) throw createError({ statusCode: 503, statusMessage: '伺服器還沒設定 POS_STATION_TOKEN / STATION_LAN_TOKEN / HUB_RELAY_TOKEN' })
  if (!sameToken(getHeader(event, 'x-pos-token') || '', posToken)) throw createError({ statusCode: 401, statusMessage: '收銀機密碼不對（系統設定 → 電子發票）' })

  const path = getRouterParam(event, 'path') || ''
  if (!ALLOWED.test(path) || path.includes('..')) throw createError({ statusCode: 404, statusMessage: '沒有這個路徑' })
  const query = getRequestURL(event).search
  const method = event.method
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event, false)
  const station = (getHeader(event, 'x-pos-station') || 'web').replace(/[^\w.\-]/g, '_').slice(0, 40)

  const hub = process.env.HUB_URL || 'https://madustrialtd.asuscomm.com:8080'
  const timeoutMs = path.startsWith('einvoice/run') || path.startsWith('einvoice/query') ? 145000
    : path.startsWith('update/upload') ? 60000
    : path.startsWith('presence/') ? 20000 // 連線狀況頁瀏覽器等 35 秒，這裡要先回答
    : 30000
  let res: Response
  try {
    res = await fetch(`${hub}/holy/agent/pos-relay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Relay-Token': relayToken },
      body: JSON.stringify({
        method,
        url: `http://127.0.0.1:17891/${path}${query}`,
        headers: {
          'Content-Type': getHeader(event, 'content-type') || 'text/plain',
          'X-EInvoice-Token': lanToken,
          'X-EInvoice-Station': station,
        },
        bodyBase64: body ? Buffer.from(body).toString('base64') : undefined,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    const name = (e as Error)?.name
    // 已經連上 Hub（連不上的話 10 秒就會是連線逾時），是 Hub 在等資料機上的 pos-agent 回覆
    if (name === 'TimeoutError' || name === 'AbortError') throw createError({ statusCode: 504, statusMessage: `家裡 Hub 等 pos-agent 逾時：Hub 有收到，但 ${Math.round(timeoutMs / 1000)} 秒內沒等到公司資料機回覆（pos-agent 剛斷線還沒重連，或資料機的 print-agent 卡住）` })
    throw createError({ statusCode: 502, statusMessage: `連不到家裡 Hub：${hubError(e, timeoutMs)}` })
  }
  let r: { success?: boolean; error?: string; status?: number; headers?: Record<string, string[]>; bodyBase64?: string } | null
  try {
    r = await res.json()
  } catch (e) {
    const name = (e as Error)?.name
    if (name === 'TimeoutError' || name === 'AbortError') throw createError({ statusCode: 502, statusMessage: `連不到家裡 Hub：Hub 回到一半就斷了（家裡網路不穩）` })
    r = null
  }
  // Hub 回的不是 JSON（例如路由器 / Spring Boot 的錯誤頁）：是 Hub 本身出錯，不是資料機
  if (!r && !res.ok) throw createError({ statusCode: 502, statusMessage: `連不到家裡 Hub：家裡 Hub 回應錯誤（HTTP ${res.status}），Hub 可能正在重啟或出錯` })
  if (!r || r.success === false || !r.status) throw createError({ statusCode: 502, statusMessage: `資料機沒有回應（${r?.error || 'Hub ' + res.status}）` })

  const ct = Object.entries(r.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1]?.[0]
  setResponseStatus(event, r.status)
  if (ct) setResponseHeader(event, 'content-type', ct)
  setResponseHeader(event, 'cache-control', 'no-store')
  return Buffer.from(r.bodyBase64 || '', 'base64')
})
