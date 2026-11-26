// 向資料機報到（連線狀況頁用）：網頁開著就約每分鐘報到一次；只能走家裡 Hub 時改成每 3 分鐘，少打一點網站伺服器。
// 線上商店（/shop）是給客人用的，不報到。
import { sendPing } from '~/utils/presenceApi'

export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null

  async function tick() {
    timer = null
    const path = router.currentRoute.value.path
    let via: string = ''
    if (!path.startsWith('/shop')) {
      try { via = await sendPing(path, readStation()) } catch { via = '' }
    }
    timer = setTimeout(tick, via === 'lan' ? 60 * 1000 : 3 * 60 * 1000)
  }

  nuxtApp.hook('app:mounted', () => {
    timer = setTimeout(tick, 3000) // 等商品、員工先載完
  })
})
