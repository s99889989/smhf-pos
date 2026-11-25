// API 保護：收銀機在「系統設定 → 電子發票」填入的收銀機密碼，要等於環境變數 EINVOICE_API_TOKEN。
// 沒有這道檢查的話，任何人知道網址就能開發票、耗掉號碼。
import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { EInvoiceError } from './service'

export function requirePosToken(event: H3Event) {
  const expected = process.env.EINVOICE_API_TOKEN || ''
  if (!expected) throw createError({ statusCode: 503, statusMessage: 'not_configured', data: { message: '電子發票後端尚未設定（EINVOICE_API_TOKEN）' } })
  const got = getHeader(event, 'x-pos-token') || ''
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, statusMessage: 'unauthorized', data: { message: '收銀機密碼不對，請到系統設定填寫' } })
  }
}

/** 把服務層錯誤轉成前端看得懂的 { message } */
export async function handle<T>(fn: () => T | Promise<T>) {
  try { return await fn() } catch (e) {
    if (e instanceof EInvoiceError) throw createError({ statusCode: e.status, statusMessage: 'einvoice_error', data: { message: e.message } })
    const msg = (e as Error).message || String(e)
    const notConfigured = /環境變數未設定/.test(msg)
    console.error('[einvoice]', msg)
    throw createError({ statusCode: notConfigured ? 503 : 500, statusMessage: notConfigured ? 'not_configured' : 'einvoice_error', data: { message: msg } })
  }
}
