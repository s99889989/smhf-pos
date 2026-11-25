// 補傳 + 補號碼。伺服器每 10 分鐘自動跑一次（server/plugins/einvoice.ts），設定頁也可以手動按。
import { runQueue } from '../../utils/einvoice/service'
import { requirePosToken, handle } from '../../utils/einvoice/auth'

export default defineEventHandler(async (event) => {
  requirePosToken(event)
  return handle(() => runQueue())
})
