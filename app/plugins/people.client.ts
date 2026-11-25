// 員工、VIP 會員、折扣類型和資料機同步：
// - 網頁開起來後向資料機載入；資料機還沒有的清單，用畫面上的內建資料當第一份存上去。
// - 之後在員工管理、VIP 管理、系統設定改了任何一筆，約 1 秒後整份清單寫回資料機。
// - 每 5 分鐘重抓一次，其他收銀機改的會跟著更新。
// - 資料機和 Hub 都連不到時，用這台上次存的副本（localStorage pos-people-cache），這時的修改不會存到資料機。
import { peopleAll, peopleSave, type PeopleAll, type PeopleList } from '~/utils/peopleApi'

const CACHE_KEY = 'pos-people-cache'
const LISTS: PeopleList[] = ['employees', 'vipMembers', 'discountTypes']

export default defineNuxtPlugin((nuxtApp) => {
  const store = usePosStore()
  const refs: Record<PeopleList, Ref<any[]>> = {
    employees: store.employees, vipMembers: store.vipMembers, discountTypes: store.discountTypes,
  }
  let connected = false
  let applying = false
  let warned = false
  const timers: Partial<Record<PeopleList, ReturnType<typeof setTimeout>>> = {}

  function writeCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(LISTS.map(k => [k, refs[k].value])))) } catch { /* 無痕模式 */ }
  }

  function apply(data: Partial<Record<PeopleList, any[] | null>>) {
    applying = true // watch 用 flush: 'sync'，這裡設回 false 前就已經跑完，不會被當成修改
    try { for (const k of LISTS) if (Array.isArray(data[k])) refs[k].value = data[k]! } finally { applying = false }
  }

  async function load() {
    if (Object.keys(timers).length) return // 還有修改沒寫完，先不蓋掉
    let data: PeopleAll
    try {
      data = await peopleAll()
    } catch (e) {
      connected = false
      try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c) apply(c) } catch { /* 沒有副本 */ }
      console.warn('員工 / VIP：連不到資料機，用這台的副本', e)
      return
    }
    connected = !data.offline
    apply(data)
    // 資料機還沒存過的清單：把目前畫面上的（內建範例或這台的副本）存上去當第一份
    if (connected) {
      for (const k of LISTS) if (data[k] === null) await peopleSave(k, refs[k].value).catch(() => {})
    }
    nextTick(writeCache)
  }

  function changed(k: PeopleList) {
    if (applying) return
    writeCache()
    if (!connected) {
      if (!warned) { warned = true; alert('現在連不到資料機，這次的修改只存在這台，不會同步到其他收銀機。') }
      return
    }
    clearTimeout(timers[k])
    timers[k] = setTimeout(async () => {
      delete timers[k]
      try {
        await peopleSave(k, JSON.parse(JSON.stringify(refs[k].value)))
      } catch (e) {
        alert('寫入資料機失敗：' + (e as Error).message)
        void load() // 換回資料機上的版本，畫面才不會和資料機不一致
      }
    }, 800)
  }

  nuxtApp.hook('app:mounted', () => {
    for (const k of LISTS) watch(refs[k], () => changed(k), { deep: true, flush: 'sync' })
    void load()
    setInterval(() => { void load() }, 5 * 60 * 1000)
  })
})
