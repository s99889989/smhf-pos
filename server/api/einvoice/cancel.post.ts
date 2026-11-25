// 作廢：{ invoiceNo, reason }
import { cancelInvoice } from '../../utils/einvoice/service'
import { requirePosToken, handle } from '../../utils/einvoice/auth'

export default defineEventHandler(async (event) => {
  requirePosToken(event)
  const body = await readBody<{ invoiceNo: string; reason?: string }>(event)
  if (!body?.invoiceNo) throw createError({ statusCode: 400, data: { message: '缺少發票號碼' } })
  return handle(() => cancelInvoice(body.invoiceNo, body.reason ?? '退貨'))
})
