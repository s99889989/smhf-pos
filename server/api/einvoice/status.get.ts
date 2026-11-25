// 狀態：本期/下期號碼批次、待上傳數、上傳失敗清單
import { einvoiceStatus } from '../../utils/einvoice/service'
import { requirePosToken, handle } from '../../utils/einvoice/auth'

export default defineEventHandler(async (event) => {
  requirePosToken(event)
  return handle(() => einvoiceStatus())
})
