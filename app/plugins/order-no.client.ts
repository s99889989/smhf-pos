// 開網頁時讀本機機台號，並向資料機對齊今天的單號流水號（見 utils/orderNo.ts）
import { loadMachineNo, syncOrderSeq } from '~/utils/orderNo'

export default defineNuxtPlugin(() => {
  loadMachineNo()
  setTimeout(() => { void syncOrderSeq() }, 3000)
})
