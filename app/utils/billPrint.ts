// 帳單（結帳單）列印：照舊 BK35 POS 實際印出的帳單（2026-11-25 卡爾提供的原版照片）
//
// 舊系統的帳單是用 Windows 印表機驅動「畫」出來的（細明體、實線分隔），不是 ESC/POS 內建字型，
// 所以字比 ESC/POS 的 12×24 點陣字大約大 1.5 倍。這裡也照這個做法：
// 版面用「mm 座標 + 字級（pt）」描述，交給 print-agent（1.2 起）用 Windows GDI 畫到帳單機（CPrinter），
// 連不到 print-agent 時由 components/BillPrint.vue 用同一份座標做網頁列印。
//
// 座標：x 是從印字區左邊算的 mm（印字區寬約 46mm），align=right 時 x 是右邊界。
// 數值都是從原版照片量的（58mm 紙約 1210px → 20.9px/mm）。

export const BILL_FONT = '細明體'
export const BILL_WIDTH = 46 // 分隔線長度（mm）
export const LINE_FACTOR = 1.3 // 行距 = 字級 × 1.3
const PT = 0.3528 // 1pt = 0.3528mm
const STORE_NAME = '聖母健康農莊'

export interface BillCell { text: string; x: number; align?: 'left' | 'right' | 'center' }
export type BillLine =
  | { kind: 'text'; size: number; bold?: boolean; cells: BillCell[] }
  | { kind: 'rule' }
  | { kind: 'gap'; mm: number }

export const lineHeightMm = (l: BillLine) =>
  l.kind === 'rule' ? 2.4 : l.kind === 'gap' ? l.mm : l.size * PT * LINE_FACTOR

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
  invoiceNo?: string
  paid?: boolean // false = 還沒結帳先印的帳單（給客人看金額）
}

const LOC_NAME: Record<string, string> = { restaurant: '餐廳', shop: '小舖', stall: '擺攤' }
// 單號後面括號：舊系統現金是「現收」，其他付款方式印付款名稱
const PAY_NAME: Record<string, string> = { cash: '現收', card: '信用卡', hua: '華南Q', voucher: '消費券' }

// ---- 字寬（細明體：中文 1 個字寬、ASCII 半個字寬）----
export function billCols(s: string) {
  let n = 0
  for (const ch of s) n += ch.charCodeAt(0) < 0x80 ? 1 : 2
  return n
}
// 依半形格數切行（不切半個中文字）
function wrap(s: string, n: number) {
  const out: string[] = []
  let cur = ''
  for (const ch of s) {
    if (billCols(cur + ch) > n) { out.push(cur); cur = '' }
    cur += ch
  }
  out.push(cur)
  return out
}
const pad2 = (n: number) => String(n).padStart(2, '0')
const hm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`

// 字級（pt）：原版內文約 10pt、桌次 13pt、消費額/結帳額 11pt 粗、結尾 8pt
const BODY = 10
const TITLE = 13
const AMOUNT = 11
const FOOT = 8
const NAME_COLS = 15 // 品名欄寬（半形格，10pt 細明體約 26mm），原版「精緻自助餐(大人」之後換行

export function buildBillLines(o: BillOrder): BillLine[] {
  const L: BillLine[] = []
  const text = (size: number, cells: BillCell[], bold = false) => L.push({ kind: 'text', size, bold, cells })
  const t = (s: string, x = 0, align: BillCell['align'] = 'left'): BillCell => ({ text: s, x, align })
  const rule = () => L.push({ kind: 'rule' })
  const gap = (mm: number) => L.push({ kind: 'gap', mm })

  // 桌次：我們沒有桌號，用地點（餐廳 / 小舖 / 擺攤）
  gap(2)
  text(TITLE, [t(`桌次:${LOC_NAME[o.location ?? ''] ?? ''}`, 2.4)])
  gap(1)
  const pay = o.paid === false ? '' : ` (${PAY_NAME[o.payMethod ?? ''] ?? o.payMethod ?? '現收'})`
  if (o.no) text(BODY, [t(`單號:${o.no}${pay}`)])
  text(BODY, [t(`印單:${hm(new Date())}`)])
  if (o.invoiceNo) text(BODY, [t(`發票號碼: ${o.invoiceNo.replace('-', '')}`)])
  rule()
  text(BODY, [t('品名', 10.8), t('數量', 28), t('金額', 45, 'right')])
  rule()
  for (const it of o.items) {
    const parts = wrap(it.name, NAME_COLS)
    text(BODY, [t(parts[0] ?? '', 1.2), t(String(it.qty), 32, 'right'), t(String(Math.round(it.price * it.qty)), 45, 'right')])
    for (const p of parts.slice(1)) text(BODY, [t(p, 1.2)])
  }
  rule()
  text(AMOUNT, [t('消費額:', 9.4), t(`${o.subtotal}元`, 43, 'right')], true)
  const disc = o.subtotal - o.total
  if (disc !== 0) text(BODY, [t(`折扣額${o.discountLabel ? `(${o.discountLabel})` : ''}:`, 9.4), t(`-${disc}元`, 43, 'right')])
  rule()
  text(AMOUNT, [t('結帳額:', 9.4), t(`${o.total}元`, 43, 'right')], true)
  if (o.paid === false) text(BODY, [t('※ 尚未結帳', 9.4)])
  gap(4)
  text(FOOT, [t(STORE_NAME, 2)])
  gap(2)
  return L
}
