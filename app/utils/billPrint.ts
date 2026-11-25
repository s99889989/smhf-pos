// 帳單（結帳單）列印：照舊 BK35 POS（AP03 frmTM88.PrintCheck58mm）的 58mm 帳單
//
// - 一行 30 個半形字（中文佔 2 格），和舊系統一樣
// - 只用 ESC/POS「行模式」指令：帳單機（收銀電腦的 Windows 印表機 CPrinter）不支援頁模式，
//   之前把頁模式的發票送過去會印顛倒、缺字、疊字；舊系統送帳單也只用下面這幾個指令：
//     ESC @ 初始化、ESC a 對齊、ESC ! 0x30 + FS ! 0x0C 放大（倍寬倍高）、ESC ! 0 + FS ! 0 還原、
//     FS S 0 0 中文字距 0、GS V 66 0 進紙後切紙
// - 同一份「行」資料也給網頁列印（components/BillPrint.vue）用，print-agent 連不到時改用瀏覽器列印
import type { EscOp } from './invoicePrint'

export const BILL_COLS = 30
const STORE_NAME = '聖母健康農莊'
const POS_ID = '001'

export interface BillLine { text: string; big?: boolean; center?: boolean }

export interface BillItem { name: string; qty: number; price: number; finalPrice?: number }
export interface BillOrder {
  no?: string
  createdAt?: Date | string
  location?: string
  items: BillItem[]
  subtotal: number
  total: number
  discountLabel?: string
  payMethod?: string
  voucherAmount?: number
  receivedCash?: number
  change?: number
  invoiceNo?: string
  carrier?: string
  paid?: boolean // false = 還沒結帳先印的帳單（給客人看金額）
}

const LOC_NAME: Record<string, string> = { restaurant: '餐廳', shop: '小舖', stall: '擺攤' }
const PAY_NAME: Record<string, string> = { cash: '現金', card: '信用卡', hua: '華南Q', voucher: '消費券' }

// ---- 字寬（Big5：中文 2 格、ASCII 1 格）----
export function billCols(s: string) {
  let n = 0
  for (const ch of s) n += ch.charCodeAt(0) < 0x80 ? 1 : 2
  return n
}
const sp = (n: number) => ' '.repeat(Math.max(0, n))
// 舊系統 FixLenLeft：補空白到固定寬度，太長就截掉（不切半個中文字）
function fixLeft(s: string, n: number) {
  let out = ''
  for (const ch of s) {
    if (billCols(out + ch) > n) break
    out += ch
  }
  return out + sp(n - billCols(out))
}
const fixRight = (s: string, n: number) => sp(n - billCols(s)) + s
// 左邊標題、右邊數值，中間補空白
const lr = (left: string, right: string, width = BILL_COLS) => left + sp(width - billCols(left) - billCols(right)) + right

const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
const money = (n: number) => Math.round(n).toLocaleString('en-US')

function paymentText(o: BillOrder) {
  const parts: string[] = []
  const total = o.total
  if (o.payMethod === 'voucher') {
    const va = Math.min(o.voucherAmount ?? 0, total)
    parts.push(`消費券:${money(va)}`)
    if (total - va > 0) parts.push(`現金:${money(total - va)}`)
  } else {
    parts.push(`${PAY_NAME[o.payMethod ?? ''] ?? o.payMethod ?? '現金'}:${money(total)}`)
  }
  if ((o.receivedCash ?? 0) > 0) {
    parts.push(`收:${money(o.receivedCash!)}`)
    parts.push(`找:${money(o.change ?? 0)}`)
  }
  return parts
}

export function buildBillLines(o: BillOrder): BillLine[] {
  const d = o.createdAt ? new Date(o.createdAt) : new Date()
  const now = new Date()
  const L: BillLine[] = []
  const line = (text: string, opt: Omit<BillLine, 'text'> = {}) => L.push({ text, ...opt })
  const dash = () => line('-'.repeat(BILL_COLS))

  // 抬頭：[帳單] 地點（舊系統是 [帳單] 桌名），放大字
  line(`[帳單] ${LOC_NAME[o.location ?? ''] ?? ''}`.trimEnd(), { big: true })
  line(STORE_NAME, { center: true })
  if (o.no) line(`單號: ${o.no}`)
  line(`機台: ${POS_ID}`)
  line(`日期: ${ymd(d)}  ${hm(d)}`)
  line(`印單: ${ymd(now)}  ${hm(now)}`)
  if (o.invoiceNo) line(`發票號碼: ${o.invoiceNo}`)
  dash()
  line(' 品名 x 數量' + sp(13) + '金額')
  dash()

  // 品項：「品名 x數量」固定 24 格 + 空白 + 金額靠右 5 格（同舊系統）；太長就品名一行、金額下一行靠右
  let count = 0
  for (const it of o.items) {
    const amt = money(it.price * it.qty)
    const left = `${it.name} x${it.qty}`
    if (billCols(left) > 24) {
      line(it.name)
      line(sp(BILL_COLS - 5 - 1 - billCols(` x${it.qty}`)) + ` x${it.qty} ` + fixRight(amt, 5))
    } else {
      line(fixLeft(left, 24) + ' ' + fixRight(amt, 5))
    }
    count += it.qty
  }
  dash()
  line(lr(`消費額:`, `${money(o.subtotal)}元`))
  const disc = o.subtotal - o.total
  if (disc !== 0) line(lr(`折扣額${o.discountLabel ? `(${o.discountLabel})` : ''}:`, `-${money(disc)}元`))
  line(lr('', `<合計: ${count}份>`))
  // 總計：放大字（倍寬，一行只剩 15 格）
  line(`總計:${money(o.total)}元`, { big: true })

  if (o.paid !== false) {
    line(`  (${paymentText(o).join(' ')})`)
    if (o.carrier) line(`載具: ${o.carrier}`)
  } else {
    line('※ 尚未結帳')
  }
  line('')
  line('感謝您的惠顧 歡迎再次蒞臨', { center: true })
  return L
}

// ---- ESC/POS（行模式）----
function b64(bytes: number[]) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

export function buildBillEscPos(lines: BillLine[], opts: { cut?: boolean } = {}): EscOp[] {
  const ops: EscOp[] = []
  const raw = (...bytes: number[]) => ops.push({ raw: b64(bytes) })
  raw(0x1b, 0x40) // ESC @
  raw(0x1b, 0x61, 0) // ESC a 0 靠左
  for (const l of lines) {
    if (l.center) raw(0x1b, 0x61, 1)
    if (l.big) raw(0x1b, 0x21, 0x30, 0x1c, 0x21, 0x0c) // ESC ! 0x30 + FS ! 0x0C：倍寬倍高
    if (l.text) ops.push({ text: l.text })
    raw(0x0d, 0x0a)
    if (l.big) raw(0x1b, 0x21, 0, 0x1c, 0x21, 0)
    if (l.center) raw(0x1b, 0x61, 0)
  }
  raw(0x1c, 0x53, 0, 0) // FS S 0 0
  if (opts.cut !== false) raw(0x1d, 0x56, 66, 0) // GS V 66 0：進紙到裁刀再切（沒裁刀的機型會忽略）
  else raw(0x1b, 0x64, 5) // ESC d 5
  return ops
}
