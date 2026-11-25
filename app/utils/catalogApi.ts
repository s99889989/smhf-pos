// 商品主檔、站別、原料庫存、商品圖片：存在公司資料機的 print-agent（Catalog.cs）。
// 瀏覽器只跟本機 print-agent 講話（http://127.0.0.1:17890/catalog/*）：
//   收銀機的 print-agent 轉給資料機；行動平板的 print-agent 留一份鏡像，離線也能賣、回來再補送庫存。
import { printAgentUrl } from './printAgent'

export interface CatalogAll {
  ok: true
  stations: { id: string; name: string; sortOrder: number }[]
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

async function call(method: 'GET' | 'POST', sub: string, body?: BodyInit, contentType = 'text/plain', timeoutMs = 20000): Promise<CatalogAll> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  let res: Response
  try {
    // text/plain 是「簡單請求」，Mypal 不會先送 OPTIONS
    res = await fetch(`${base()}/catalog/${sub}`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': contentType } : undefined,
      body,
      signal: ctrl?.signal,
    })
  } catch (e) {
    throw new CatalogError('連不到本機 print-agent', true)
  } finally {
    if (timer) clearTimeout(timer)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) {
    // 503 = 收銀機連不到資料機 / 平板離線不能改
    throw new CatalogError(data?.error || `資料機回應 ${res.status}`, res.status === 503 && !data?.error)
  }
  return data as CatalogAll
}

export const catalogAll = () => call('GET', 'all', undefined, 'text/plain', 8000)
export const catalogPost = (sub: string, body: unknown) => call('POST', sub, JSON.stringify(body))
export const catalogUploadImage = (productId: number, jpg: Blob) =>
  call('POST', `product/image?id=${productId}`, jpg, 'image/jpeg', 60000)

export function catalogImageUrl(file: string | undefined, thumb = true) {
  if (!file) return ''
  try { return `${base()}/catalog/${thumb ? 'thumb' : 'image'}/${encodeURIComponent(file)}` } catch { return '' }
}
