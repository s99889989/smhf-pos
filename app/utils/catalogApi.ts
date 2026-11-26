// 商品主檔、站別、原料庫存、商品圖片：存在公司資料機的 print-agent（Catalog.cs）。
// 區網優先：先打本機 print-agent（http://127.0.0.1:17890/catalog/*）：
//   收銀機的 print-agent 轉給資料機；行動平板的 print-agent 留一份鏡像，離線也能賣、回來再補送庫存。
// 本機 print-agent 沒開或區網連不到資料機時，改走家裡 Hub（/api/station/catalog/**，見 stationApi.ts）。
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable, errorText } from './stationApi'

export interface CatalogAll {
  ok: true
  stations: { id: string; name: string; emoji?: string; sortOrder: number }[]
  categories?: { id: string; name: string; emoji?: string; sortOrder: number }[] // print-agent 1.8 起；emoji 1.14 起
  products: any[]
  materials: any[]
  logs: any[]
  mode?: 'tablet'
  offline?: boolean
  offlineReason?: string
  pending?: number
  syncedAt?: string
}

export class CatalogError extends Error {
  constructor(message: string, public unreachable = false) { super(message) }
}

function base() {
  const b = printAgentUrl()
  if (b === 'off') throw new CatalogError('print-agent 已關閉（pos-print-agent=off）', true)
  return b
}

// 目前走哪條路：'lan' = 本機 print-agent（收銀機再轉區網資料機）；'hub' = 經家裡 Hub（區網不通時）
let route: 'lan' | 'hub' = 'lan'
export const catalogRoute = () => route

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, hub: boolean) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    return hub ? await hubFetch(url, { ...init, signal: ctrl?.signal }) : await fetch(url, { ...init, signal: ctrl?.signal })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function call(method: 'GET' | 'POST', sub: string, body?: BodyInit, contentType = 'text/plain', timeoutMs = 20000): Promise<CatalogAll> {
  // text/plain 是「簡單請求」，Mypal 不會先送 OPTIONS
  const init: RequestInit = { method, headers: method === 'POST' ? { 'Content-Type': contentType } : undefined, body }
  let res: Response | null = null
  let lanError = ''
  try {
    res = await fetchWithTimeout(`${base()}/catalog/${sub}`, init, timeoutMs, false)
    if (await lanUnreachable(res)) { lanError = '區網連不到資料機'; res = null }
  } catch (e) {
    lanError = e instanceof CatalogError ? e.message : '連不到本機 print-agent'
  }
  if (res) route = 'lan'
  else {
    // 區網不通：改走家裡 Hub
    try {
      res = await fetchWithTimeout(`catalog/${sub}`, init, Math.max(timeoutMs, 30000), true)
      route = 'hub'
    } catch (e) {
      throw new CatalogError(`${lanError}，也無法經家裡 Hub 連線（${(e as Error).message}）`, true)
    }
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    throw new CatalogError(errorText(data, res.status), false)
  }
  return data as CatalogAll
}

export const catalogAll = () => call('GET', 'all', undefined, 'text/plain', 8000)
export const catalogPost = (sub: string, body: unknown) => call('POST', sub, JSON.stringify(body))
export const catalogUploadImage = (productId: number, jpg: Blob) =>
  call('POST', `product/image?id=${productId}`, jpg, 'image/jpeg', 60000)

// 圖片網址：區網時直接用本機 print-agent 的網址；走 Hub 時 <img> 帶不了密碼 header，
// 要用 hubFetch 拿回來轉成 blob: 網址（同一張只抓一次）。<CatalogImg> 元件會處理。
export function catalogImageUrl(file: string | undefined, thumb = true) {
  if (!file) return ''
  // ?v=640：print-agent 1.11 縮圖改成 640 寬，換網址讓瀏覽器不要用快取裡的舊糊圖
  try { return `${base()}/catalog/${thumb ? 'thumb' : 'image'}/${encodeURIComponent(file)}${thumb ? '?v=640' : ''}` } catch { return '' }
}

const blobCache = new Map<string, Promise<string>>()
export function catalogImageSrc(file: string | undefined, thumb = true): Promise<string> {
  if (!file) return Promise.resolve('')
  if (file.startsWith('blob:')) return Promise.resolve(file) // 範例模式剛選的圖
  if (route === 'lan') return Promise.resolve(catalogImageUrl(file, thumb))
  const key = (thumb ? 'thumb/' : 'image/') + file
  let p = blobCache.get(key)
  if (!p) {
    p = hubFetch(`catalog/${key.split('/')[0]}/${encodeURIComponent(file)}${thumb ? '?v=640' : ''}`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob() })
      .then(b => URL.createObjectURL(b))
    p.catch(() => blobCache.delete(key))
    blobCache.set(key, p)
  }
  return p
}
