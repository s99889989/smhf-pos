// Cetustek 加值中心 InvoiceAPI（SOAP 1.1, basicHttpBinding）。
// 方法與參數名稱是從舊 C:\BK35\AP7\InvPost.EXE 的 WCF 代理類別反組譯出來的，認證只有 officeid / posno / posid。
import type { EInvoiceConfig } from './config'

const NS = 'http://webservice.cetustek.com/'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const unesc = (s: string) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&')

export class CetustekNetworkError extends Error {}

async function call(cfg: EInvoiceConfig, op: string, params: [string, string][]) {
  const all: [string, string][] = [...params, ['officeid', cfg.officeId], ['posno', cfg.posNo], ['posid', cfg.posId]]
  const body = '<?xml version="1.0" encoding="UTF-8"?>'
    + '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>'
    + `<ns:${op} xmlns:ns="${NS}">`
    + all.map(([k, v]) => `<${k}>${esc(v)}</${k}>`).join('')
    + `</ns:${op}></soap:Body></soap:Envelope>`
  let res: Response
  try {
    res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${NS}InvoiceAPI/${op}Request"`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
    })
  } catch (e) {
    throw new CetustekNetworkError(`連不到加值中心（${op}）：${(e as Error).message}`)
  }
  const text = await res.text()
  const fault = text.match(/<faultstring>([\s\S]*?)<\/faultstring>/)
  if (fault) throw new Error(`加值中心回傳錯誤（${op}）：${unesc(fault[1]!)}`)
  if (!res.ok) throw new CetustekNetworkError(`加值中心 HTTP ${res.status}（${op}）`)
  const m = text.match(/<return>([\s\S]*?)<\/return>/)
  return m ? unesc(m[1]!).trim() : ''
}

// ---- 回傳代碼（舊程式 CheckReturnCode）----
export type ResultKind = 'ok' | 'fail' | 'needApproval' | 'notFound' | 'auth' | 'platform' | 'nodata'
const CODE: Record<string, [ResultKind, string]> = {
  s0: ['ok', '上傳成功'], s1: ['fail', '上傳失敗'], s2: ['ok', '已上傳過'],
  c0: ['ok', '作廢成功'], c1: ['fail', '作廢失敗'], c3: ['needApproval', '已過申報期，需核准文號'],
  c4: ['notFound', '查無此發票'], c5: ['ok', '已作廢過'],
  v0: ['ok', '註銷成功'], v1: ['fail', '註銷失敗'], v2: ['fail', '狀態不可取消'], v3: ['needApproval', '已過申報期'],
  v4: ['notFound', '查無此發票'], v5: ['ok', '已取消過'],
  a0: ['ok', '折讓成功'], a1: ['fail', '折讓失敗'], a2: ['fail', '折讓超過原發票'], a3: ['notFound', '查無此發票'],
  a4: ['fail', '發票已作廢'], a5: ['ok', '已上傳過'], a6: ['fail', '銷售額與明細不符'], a7: ['fail', '稅額與明細不符'],
  invalid: ['auth', '認證錯誤（統編 / 機號 / posid）'], error: ['platform', '加值中心系統錯誤'], nodata: ['nodata', '沒有資料'],
}
export function classify(ret: string): { kind: ResultKind; code: string; message: string } {
  const code = ret.trim().toLowerCase()
  const hit = CODE[code]
  return hit ? { kind: hit[0], code, message: hit[1] } : { kind: 'fail', code, message: `未知回傳：${ret}` }
}
const isErrorCode = (ret: string) => ['invalid', 'error', 'nodata'].includes(ret.trim().toLowerCase())

// ---- 取號 ----
/** 申請一批號碼，回傳申請號。year = 民國年，term = "05-06" */
export async function applyInvoiceNumber(cfg: EInvoiceConfig, rocYear: number, term: string) {
  const ret = await call(cfg, 'ApplyInvoiceNumber', [['year', String(rocYear)], ['month', term]])
  if (!ret || isErrorCode(ret)) throw new Error(`申請號碼失敗：${ret ? classify(ret).message : '沒有回傳申請號'}`)
  return ret
}

/** 用申請號取號，回傳 字軌 / 起號 / 迄號（一批 500 張） */
export async function takeInvoiceNumber(cfg: EInvoiceConfig, applyId: string) {
  const ret = await call(cfg, 'TakeInvoiceNumber', [['applyid', applyId]])
  const m = ret.match(/^([A-Z]{2});(\d{8});(\d{8})$/)
  if (!m) throw new Error(`取號失敗：${ret && isErrorCode(ret) ? classify(ret).message : ret || '沒有回傳號碼'}`)
  return { track: m[1]!, start: +m[2]!, end: +m[3]! }
}

// ---- 上傳 ----
export const uploadInvoice = async (cfg: EInvoiceConfig, xml: string) =>
  classify(await call(cfg, 'UploadInvoice', [['invoicexml', xml]]))
export const uploadCancelInvoice = async (cfg: EInvoiceConfig, xml: string) =>
  classify(await call(cfg, 'UploadCancelInvoice', [['invoicexml', xml]]))
export const uploadVoidInvoice = async (cfg: EInvoiceConfig, xml: string) =>
  classify(await call(cfg, 'UploadVoidInvoice', [['invoicexml', xml]]))

/** 查單張狀態（對帳用）。invoicedate = yyyy/MM/dd */
export const queryInvoiceStatus = (cfg: EInvoiceConfig, invoiceNo: string, invoiceDate: string) =>
  call(cfg, 'QueryInvoiceStatus', [['invoicenumber', invoiceNo], ['invoicedate', invoiceDate]])
