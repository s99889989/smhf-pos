import type { EscOp } from './invoicePrint'

// 收銀電腦上的 print-agent（smhf-pos/print-agent，C# .NET 4.0，XP / Win10 都能跑）
// 網址可在瀏覽器 localStorage 設 pos-print-agent 覆寫；設成 off 就一律用瀏覽器列印。
const DEFAULT_URL = 'http://127.0.0.1:17890'

export function printAgentUrl() {
  try { return localStorage.getItem('pos-print-agent') || DEFAULT_URL } catch { return DEFAULT_URL }
}

// 成功送到印表機回傳 true；print-agent 沒開、被瀏覽器擋（混合內容）或逾時就回傳 false。
// target：'invoice' 送發票機（預設）、'bill' 送帳單機（print-agent.ini 的 BillPrinter，收銀電腦是 CPrinter）
export async function printViaAgent(ops: EscOp[], timeoutMs = 4000, target: 'invoice' | 'bill' = 'invoice'): Promise<boolean> {
  const url = printAgentUrl()
  if (url === 'off') return false
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    // text/plain 是「簡單請求」，舊瀏覽器（Mypal）也不會先送 OPTIONS
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ops, target }),
      signal: ctrl?.signal,
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.ok) {
      console.warn('print-agent 列印失敗', body?.error ?? res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('連不到 print-agent，改用瀏覽器列印', e)
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// 帳單：版面（mm 座標 + 字級）交給 print-agent 1.2 用 Windows 驅動畫到帳單機（同舊 BK35 帳單的印法）
export async function printBillViaAgent(lines: unknown[], timeoutMs = 6000): Promise<boolean> {
  const url = printAgentUrl()
  if (url === 'off') return false
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null
  try {
    const res = await fetch(`${url}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ target: 'bill', gdi: lines }),
      signal: ctrl?.signal,
    })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body?.ok) {
      console.warn('print-agent 帳單列印失敗（print-agent 要 1.2 以上）', body?.error ?? res.status)
      return false
    }
    return true
  } catch (e) {
    console.warn('連不到 print-agent，帳單改用瀏覽器列印', e)
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}
