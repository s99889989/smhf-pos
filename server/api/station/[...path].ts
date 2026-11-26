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
      signal: AbortSignal.timeout(path.startsWith('einvoice/run') || path.startsWith('einvoice/query') ? 145000 : path.startsWith('update/upload') ? 60000 : 30000),
    })
  } catch (e) {
    throw createError({ statusCode: 502, statusMessage: `連不到家裡 Hub：${(e as Error).message}` })
  }
  const r = await res.json().catch(() => null) as { success?: boolean; error?: string; status?: number; headers?: Record<string, string[]>; bodyBase64?: string } | null
  if (!r || r.success === false || !r.status) throw createError({ statusCode: 502, statusMessage: `資料機沒有回應（${r?.error || 'Hub ' + res.status}）` })

  const ct = Object.entries(r.headers || {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1]?.[0]
  setResponseStatus(event, r.status)
  if (ct) setResponseHeader(event, 'content-type', ct)
  setResponseHeader(event, 'cache-control', 'no-store')
  return Buffer.from(r.bodyBase64 || '', 'base64')
})
