// 單號：照舊 BK35 系統的規則 yyMMdd + P + 機台號(1 碼) + 當日 4 碼流水號，例 261125P10110。
// 舊系統（xxNO 表 NoCode+NoBy=日期）每台機器每天從 0001 重新編號；這裡一樣每台自己編，
// 離線平板也不會和別台撞號（前提：每台機台號不同，系統設定 →「本機機台號」）。
// 流水號記在這台的 localStorage（pos-order-seq）；開網頁時再向資料機查今天這台用到幾號，
// 取比較大的那個接著編，瀏覽器資料被清掉也不會重號。
import { listOrders } from './ordersApi'

const MACHINE_KEY = 'pos-machine-no'
const SEQ_KEY = 'pos-order-seq'

function ls(k: string, v?: string | null) {
  try {
    if (v === undefined) return localStorage.getItem(k)
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch { /* 無痕模式 */ }
  return null
}

/** 本機機台號（1～9）；還沒指定回傳空字串 */
export function readMachineNo(): string {
  const v = ls(MACHINE_KEY) || ''
  return /^[1-9]$/.test(v) ? v : ''
}

export function useMachineNo() {
  return useState<string>('posMachineNo', () => '')
}

export function loadMachineNo() {
  useMachineNo().value = readMachineNo()
}

export function writeMachineNo(v: string) {
  v = /^[1-9]$/.test(v) ? v : ''
  ls(MACHINE_KEY, v || null)
  useMachineNo().value = v
  void syncOrderSeq()
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const yymmdd = (d: Date) => pad2(d.getFullYear() % 100) + pad2(d.getMonth() + 1) + pad2(d.getDate())
const isoDay = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// 沒指定機台號時用 0（舊系統用 1、2、3，至少不會和舊機器撞號）
const machineOrZero = () => readMachineNo() || '0'

interface Seq { day: string; m: string; n: number }
function readSeq(): Seq {
  try {
    const s = JSON.parse(ls(SEQ_KEY) || '')
    if (s && typeof s.n === 'number' && typeof s.day === 'string') return { day: s.day, m: String(s.m ?? ''), n: s.n }
  } catch { /* 第一次 / 舊格式 */ }
  return { day: '', m: '', n: 0 }
}

/** 取下一個單號（會把流水號 +1 存起來） */
export function nextOrderNo(at: Date) {
  const day = yymmdd(at)
  const m = machineOrZero()
  const seq = readSeq()
  const n = seq.day === day && seq.m === m ? seq.n + 1 : 1
  ls(SEQ_KEY, JSON.stringify({ day, m, n }))
  return `${day}P${m}${String(n).padStart(4, '0')}`
}

/** 向資料機查今天這台機台號已用到的最大流水號，比本機記的大就接上去 */
export async function syncOrderSeq() {
  if (typeof window === 'undefined') return
  const now = new Date()
  const day = yymmdd(now)
  const m = machineOrZero()
  const prefix = `${day}P${m}`
  const r = await listOrders(isoDay(now), isoDay(now)).catch(() => null)
  if (!r || !r.ok) return
  let max = 0
  for (const o of r.orders) {
    const no = String(o.no || '')
    if (no.length === 12 && no.startsWith(prefix)) {
      const n = Number(no.slice(8))
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  const seq = readSeq() // 查詢期間可能剛結了一筆，重讀
  if (yymmdd(new Date()) !== day || machineOrZero() !== m) return
  const cur = seq.day === day && seq.m === m ? seq.n : 0
  if (max > cur) ls(SEQ_KEY, JSON.stringify({ day, m, n: max }))
}
