// 電子發票證明聯 + 交易明細的版面（照舊 BK35 POS 實際印出的紙本與 AP03 PrintInv_T70E2 還原的座標）
//
// 單位一律用印表機的 dot（203dpi，8 dots = 1mm）：
//   - x：左邊距離，1 格半形字 = 12 dots
//   - y：文字「底線」的位置（ESC/POS 頁模式 GS $ 的定義）
//   - 字型 Font A：半形 12×24、中文 24×24 dots，w/h 是寬高倍數
// 同一份版面同時給：
//   1. 網頁列印（components/InvoicePrint.vue，dots ÷ 8 換成 mm 絕對定位）
//   2. ESC/POS 直接列印（buildEscPosJob，交給收銀電腦上的 print-agent 送印表機）

export const STORE_NAME = '聖母健康農莊'
export const SELLER_ID = '36726891'
export const STORE_ID = '001'
export const POS_ID = '001'

export const PAGE_WIDTH = 416 // 52mm
export const CERT_HEIGHT = 596 // 74.5mm
export const LINE = 30 // 明細一行 30 dots（3.75mm）
export const DETAIL_COLS = 32
export const GAP_BETWEEN = 120 // 證明聯和明細之間空白 15mm（撕紙處）

export interface PrintItem { name: string; qty: number; price: number; finalPrice?: number }
export interface PrintOrder {
  createdAt: Date | string
  items: PrintItem[]
  subtotal: number
  total: number
  payMethod: string
  voucherAmount?: number
  receivedCash?: number
  change?: number
  carrier?: string
  invoiceNo: string // 例 AB-12345678
  invoiceRandomCode: string
  invoiceIsMock?: boolean
}

export interface TextEl { kind: 'text'; x: number; y: number; w: number; h: number; bold: boolean; text: string }
export interface BarcodeEl { kind: 'barcode'; x: number; y: number; height: number; data: string } // y = 底
export interface QrEl { kind: 'qr'; x: number; y: number; module: number; data: string } // y = 頂
export type PageEl = TextEl | BarcodeEl | QrEl
export interface PrintPage { height: number; els: PageEl[] }
export interface InvoiceLayout { cert: PrintPage; detail: PrintPage }

// ---- 字寬（Big5：中文 2 格、ASCII 1 格）----
export function cols(s: string) {
  let n = 0
  for (const ch of s) n += ch.charCodeAt(0) < 0x80 ? 1 : 2
  return n
}
const sp = (n: number) => ' '.repeat(Math.max(0, n))
const padEnd = (s: string, n: number) => s + sp(n - cols(s))
const padStart = (s: string, n: number) => sp(n - cols(s)) + s

const pad2 = (n: number) => String(n).padStart(2, '0')
function rocPeriodText(d: Date) {
  const m = d.getMonth() + 1
  const start = m % 2 === 1 ? m : m - 1
  return `${d.getFullYear() - 1911}年${pad2(start)}-${pad2(start + 1)}月`
}
function rocPeriodCode(d: Date) {
  const m = d.getMonth() + 1
  return `${String(d.getFullYear() - 1911).padStart(3, '0')}${pad2(m % 2 === 1 ? m + 1 : m)}`
}
const ymdHms = (d: Date, sep: string) =>
  `${d.getFullYear()}${sep}${pad2(d.getMonth() + 1)}${sep}${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`

const PAY_NAME: Record<string, string> = { cash: '現金', card: '信用卡', hua: '華南Q', voucher: '消費券' }

// 明細品項：原價列出，折扣另外做成「應稅折扣」一列（和舊系統一樣）
export function detailRows(o: PrintOrder) {
  const rows = o.items.map(i => ({ name: i.name, qty: i.qty, amount: i.price * i.qty }))
  const disc = o.total - o.subtotal
  if (disc !== 0) rows.push({ name: '應稅折扣', qty: 1, amount: disc })
  return rows
}

function paymentLines(o: PrintOrder) {
  if (o.payMethod === 'voucher') {
    const va = Math.min(o.voucherAmount ?? 0, o.total)
    const lines = [`消費券${va}`]
    if (o.total - va > 0) lines.push(`現金${o.total - va}`)
    return lines
  }
  return [`${PAY_NAME[o.payMethod] ?? o.payMethod}${o.total}`]
}

// ---- QR Code 內容（財政部規格，見 BK35發票完整規格.md §4）----
// aes：AES 驗證碼 24 碼。目前發票號碼是模擬的、也還沒有金鑰，先用 0 佔位（掃描 App 會判定驗證失敗）。
const utf8Len = (s: string) => new TextEncoder().encode(s).length
const QR_BYTES = 170
export function qrContents(o: PrintOrder, aes = '0'.repeat(24)) {
  const d = new Date(o.createdAt)
  const inv = o.invoiceNo.replace('-', '')
  const date = `${String(d.getFullYear() - 1911).padStart(3, '0')}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const hex = (n: number) => Math.max(0, n).toString(16).padStart(8, '0')
  const rows = detailRows(o)
  const itemStr = rows.map(r => `:${r.name.replace(/:/g, '')}:${r.qty}:${r.qty ? Math.round(r.amount / r.qty) : r.amount}`)
  const base = `${inv}${date}${o.invoiceRandomCode}${hex(o.total)}${hex(o.total)}00000000${SELLER_ID}${aes}:**********:${rows.length}:${rows.length}:1`
  let left = base
  let right = '**'
  let i = 0
  for (; i < itemStr.length && utf8Len(left + itemStr[i]) <= 150; i++) left += itemStr[i]
  for (; i < itemStr.length && utf8Len(right + itemStr[i]) <= 110; i++) right += itemStr[i]
  const padTo = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - utf8Len(s)))
  // 左右兩個 QR 都補空白到 170 bytes（內容最多左 150、右 110）→ 位元組模式 + 糾錯 M 一律是 Version 9
  // 53 模組 × 3 dots = 159 dots：左 36–195、右 228–387 不互撞，頂 376 → 底 535，不會壓到 row 18.7（561）的備註行
  left = padTo(left, QR_BYTES)
  right = padTo(right, QR_BYTES)
  return { left, right, barcode: `${rocPeriodCode(d)}${inv}${o.invoiceRandomCode}` }
}

// ---- 版面 ----
export function buildInvoiceLayout(o: PrintOrder, aes?: string): InvoiceLayout {
  const d = new Date(o.createdAt)
  const t = (x: number, y: number, text: string, w = 1, h = 1, bold = false): TextEl => ({ kind: 'text', x, y, w, h, bold, text })
  const q = qrContents(o, aes)

  // 證明聯（頁模式 52mm × 74.5mm）
  const cert: PageEl[] = [
    t(Math.floor((34 - cols(STORE_NAME)) / 2) * 12, 54, STORE_NAME, 1, 2, true),
    t(24, 105, '電子發票證明聯', 2, 2, true),
    t(48, 159, rocPeriodText(d), 2, 2, true),
    t(0, 210, o.invoiceNo, 3, 2, true),
    t(0, 240, ymdHms(d, '-')),
    t(0, 270, `隨機碼:${o.invoiceRandomCode}` + padStart(`總計:${o.total}`, 22)),
    t(0, 300, `賣方:${SELLER_ID}`),
    { kind: 'barcode', x: 36, y: 364, height: 50, data: q.barcode },
    { kind: 'qr', x: 36, y: 376, module: 3, data: q.left },
    { kind: 'qr', x: 228, y: 376, module: 3, data: q.right },
    // 模擬號碼時在備註行（row 18.7）標明，避免被當成正式發票
    ...(o.invoiceIsMock ? [t(0, 561, '** 測試號碼，非正式發票 **')] : []),
    t(0, 588, `櫃:${padEnd(STORE_ID, 12)} 機:${POS_ID} 序:`),
  ]

  // 交易明細（一行 32 格；半行位移照紙本）
  const els: PageEl[] = []
  let y = LINE
  const line = (text: string, dy = LINE) => { els.push(t(0, y, text)); y += dy }
  const at = (row: number, text: string, right = false) =>
    els.push(t(right ? (DETAIL_COLS - cols(text)) * 12 : 0, y + Math.round(row * LINE), text))

  line(padStart(STORE_NAME, Math.floor((DETAIL_COLS - cols(STORE_NAME)) / 2) + cols(STORE_NAME)))
  line('='.repeat(DETAIL_COLS))
  line(`交易明細(${ymdHms(d, '/')})`)
  line('='.repeat(DETAIL_COLS))
  const rows = detailRows(o)
  for (const r of rows) {
    const rightPart = `x${r.qty}`.padEnd(2) + `$${r.amount}TX`.padStart(10)
    if (cols(r.name) + cols(rightPart) + 1 > DETAIL_COLS) {
      line(r.name)
      line(padStart(rightPart, DETAIL_COLS))
    } else {
      line(padEnd(r.name, DETAIL_COLS - cols(rightPart)) + rightPart)
    }
  }
  line('-'.repeat(DETAIL_COLS))
  at(0, '小計'); at(0.25, `共${rows.length}項,$${o.total}`, true); y += LINE
  line('-'.repeat(DETAIL_COLS))
  // 發票金額 / 付款方式 / 收找零 / 備註：左欄標題、右欄數值錯開半行（同紙本）
  at(0, '發票金額'); at(0.25, `$${o.total}`, true)
  at(1, '付款方式')
  const pays = paymentLines(o)
  pays.forEach((p, i) => at(1.25 + i, p, true))
  const r = 1.5 + pays.length
  if ((o.receivedCash ?? 0) > 0) at(r - 0.45, `收:${o.receivedCash}, 找零:${o.change ?? 0}`, true)
  at(r, `備註:${o.carrier ?? ''}`)
  y += Math.round((r + 1) * LINE)
  if (o.invoiceIsMock) line('※測試號碼,未上傳財政部')

  return {
    cert: { height: CERT_HEIGHT, els: cert },
    detail: { height: y, els },
  }
}

// ---- ESC/POS（給 print-agent）----
// 工作格式：[{ raw: base64 }, { text: '中文字' }]，text 由 print-agent 用 Big5 編碼後送出。
export type EscOp = { raw: string } | { text: string }

function b64(bytes: number[]) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
const lh = (n: number) => [n & 0xff, (n >> 8) & 0xff]

export function code39Width(data: string) { return (data.length + 2) * 16 - 1 } // GS w 1：窄 1、寬 3 dots

export function buildEscPosJob(layout: InvoiceLayout, opts: { cut?: boolean } = {}): EscOp[] {
  const ops: EscOp[] = []
  const raw = (...bytes: number[]) => ops.push({ raw: b64(bytes) })

  raw(0x1b, 0x40) // ESC @
  raw(0x1c, 0x26) // FS &：中文字模式

  const page = (p: PrintPage) => {
    raw(0x1b, 0x4c) // ESC L 頁模式
    raw(0x1d, 0x50, 0, 203) // GS P 0 203
    raw(0x1b, 0x57, 0, 0, 0, 0, ...lh(PAGE_WIDTH), ...lh(p.height + 8)) // ESC W
    raw(0x1b, 0x54, 0) // ESC T 0
    for (const el of p.els) {
      if (el.kind === 'text') {
        raw(0x1d, 0x24, ...lh(el.y)) // GS $
        raw(0x1b, 0x24, ...lh(el.x)) // ESC $
        raw(0x1b, 0x21, 0, 0x1c, 0x21, 0) // 重設 ESC ! / FS !
        raw(0x1d, 0x21, ((el.w - 1) << 4) | (el.h - 1)) // GS ! 倍數
        raw(0x1b, 0x45, el.bold ? 1 : 0) // ESC E
        ops.push({ text: el.text })
      } else if (el.kind === 'barcode') {
        raw(0x1d, 0x24, ...lh(el.y), 0x1b, 0x24, ...lh(el.x))
        raw(0x1d, 0x48, 0, 0x1d, 0x66, 0, 0x1d, 0x68, el.height, 0x1d, 0x77, 1)
        const data = [...el.data].map(c => c.charCodeAt(0))
        raw(0x1d, 0x6b, 69, data.length, ...data)
      } else {
        raw(0x1d, 0x24, ...lh(el.y), 0x1b, 0x24, ...lh(el.x))
        const data = [...new TextEncoder().encode(el.data)]
        raw(0x1d, 0x28, 0x6b, 4, 0, 49, 65, 50, 0) // model 2
        raw(0x1d, 0x28, 0x6b, 3, 0, 49, 67, el.module) // module size
        raw(0x1d, 0x28, 0x6b, 3, 0, 49, 69, 49) // ECC M
        raw(0x1d, 0x28, 0x6b, ...lh(data.length + 3), 49, 80, 48, ...data)
        raw(0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48)
      }
    }
    raw(0x0c) // FF：印出頁面並回標準模式
  }

  page(layout.cert)
  // 證明聯和明細之間切開（同舊紙本）：GS V 66 0 進紙到裁刀位置後部分裁切；不切就只進紙留撕紙空白
  if (opts.cut !== false) raw(0x1d, 0x56, 66, 0)
  else raw(0x1b, 0x4a, GAP_BETWEEN) // ESC J 進紙
  page(layout.detail)
  raw(0x1d, 0x21, 0, 0x1b, 0x45, 0)
  if (opts.cut !== false) raw(0x1d, 0x56, 66, 0) // GS V 66 0：進紙後裁切（沒裁刀的機型會忽略）
  return ops
}
