// 電子發票設定：全部從環境變數讀（Netlify 後台 Site configuration → Environment variables）。
// 金鑰、posid 不可以寫進程式碼或前端。

export interface EInvoiceConfig {
  endpoint: string
  officeId: string // 賣方統編
  posNo: string    // 收銀機代號（舊系統登錄 BK3\SYS\POSID）
  posId: string    // 舊 InvPost.exe 的 posid（廠商代號 + APIPassword）
  qrAesKey: string // 財政部 QR 加密金鑰，32 碼 hex
}

export function einvoiceConfig(): EInvoiceConfig {
  const env = process.env
  const cfg = {
    endpoint: env.EINVOICE_ENDPOINT || 'http://ve.ei.com.tw/InvoiceEntitySync/InvoiceAPI',
    officeId: env.EINVOICE_OFFICE_ID || '',
    posNo: env.EINVOICE_POS_NO || '',
    posId: env.EINVOICE_POS_ID || '',
    qrAesKey: env.EINVOICE_QR_AES_KEY || '',
  }
  const missing = Object.entries({
    EINVOICE_OFFICE_ID: cfg.officeId, EINVOICE_POS_NO: cfg.posNo,
    EINVOICE_POS_ID: cfg.posId, EINVOICE_QR_AES_KEY: cfg.qrAesKey,
  }).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) throw new Error(`電子發票環境變數未設定：${missing.join(', ')}`)
  return cfg
}
