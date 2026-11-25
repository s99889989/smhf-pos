// 結帳人：每台收銀機目前是誰在結帳。換人時選自己的名字、輸入 PIN（4–6 位數字）。
// 員工的 PIN 只存雜湊（pinHash），跟員工資料一起放資料機；離線平板用鏡像也能換人。
// 這是用來記錄「這筆是誰結的」，不是高強度的密碼保護。
// 目前結帳人存在這台的 localStorage（pos-cashier），重新整理網頁不用重新輸入。
import { sha256 } from '~/utils/sha256'
import type { Employee } from './usePosStore'

const KEY = 'pos-cashier'

export interface Cashier { id: string; name: string }

export function pinHash(employeeId: string, pin: string) {
  return sha256(`smhf-pos|${employeeId}|${pin}`)
}

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin)

export function useCashier() {
  const { employees } = usePosStore()
  const cashier = useState<Cashier | null>('cashier', () => null)
  const pickerOpen = useState<boolean>('cashierPicker', () => false)
  const restored = useState<boolean>('cashierRestored', () => false)

  // 只在瀏覽器讀一次這台上次的結帳人
  if (import.meta.client && !restored.value) {
    restored.value = true
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c?.id) cashier.value = c } catch { /* 無痕模式 */ }
  }

  /** 可以當結帳人的員工：在職、已設定 PIN */
  const candidates = computed(() => employees.value.filter(e => e.enabled && e.pinHash))
  /** 有任何人設定了 PIN，才要求先登入結帳人（還沒設定前不擋結帳，避免一上線就鎖住） */
  const required = computed(() => candidates.value.length > 0)

  // 結帳人被停用、刪除或 PIN 被清掉 → 登出
  watch([cashier, candidates], () => {
    const c = cashier.value
    if (c && employees.value.length && !candidates.value.some(e => e.id === c.id)) logout()
  })

  function save() {
    try { cashier.value ? localStorage.setItem(KEY, JSON.stringify(cashier.value)) : localStorage.removeItem(KEY) } catch { /* 無痕模式 */ }
  }

  function login(e: Employee, pin: string) {
    if (!e.pinHash || pinHash(e.id, pin) !== e.pinHash) return false
    cashier.value = { id: e.id, name: e.name }
    save()
    return true
  }

  function logout() {
    cashier.value = null
    save()
  }

  /** 結帳前呼叫：需要結帳人但還沒登入 → 打開換人視窗並回傳 false */
  function ensure() {
    if (!required.value || cashier.value) return true
    pickerOpen.value = true
    return false
  }

  return { cashier, pickerOpen, candidates, required, login, logout, ensure }
}
