// 開立：配號 + 隨機碼 + QR AES，回傳給前端列印；上傳在背景做（失敗由排程補傳）。
import { issueInvoice, uploadOne, ensureBatches, type IssueInput } from '../../utils/einvoice/service'
import { einvoiceConfig } from '../../utils/einvoice/config'
import { requirePosToken, handle } from '../../utils/einvoice/auth'

export default defineEventHandler(async (event) => {
  requirePosToken(event)
  const body = await readBody<IssueInput>(event)
  const result = await handle(() => issueInvoice(body))

  // 公司伺服器是常駐程式，回應後繼續在背景上傳、補號碼，不拖慢出單
  const cfg = einvoiceConfig()
  void (async () => {
    await uploadOne(cfg, result.invoiceNo).catch((e) => console.error('[einvoice] 即時上傳失敗', e))
    await ensureBatches(cfg).catch((e) => console.error('[einvoice] 預取號碼失敗', e))
  })()

  return result
})
