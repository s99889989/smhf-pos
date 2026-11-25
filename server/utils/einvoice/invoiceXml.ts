// Cetustek 上傳用的發票 XML（XSDVersion 2.8），規則照舊 BK35 InvPost.exe / InvSrv 還原：
// invoice-research/BK35發票完整規格.md §6、InvSrv發票調查.md「欄位規則」。
import { xmlDateTime } from './period'

export interface EInvoiceItem {
  name: string
  qty: number
  /** 含稅單價（B2C 的寫法）；B2B 會在這裡自動換算成未稅 */
  unitPrice: number
  /** 免稅品項（DType=TN） */
  taxFree?: boolean
}

export interface EInvoiceData {
  invoiceNo: string      // 10 碼，不含 -，例 BM92177850
  issuedAt: Date
  orderId: string        // 對帳用帳單號
  buyerId?: string       // 買方統編，B2C 空白
  carrier?: string       // 手機條碼 /XXXXXXX 或自然人憑證
  npoban?: string        // 愛心碼
  randomCode: string     // 4 碼
  total: number          // 含稅總計
  freeTaxAmount?: number // 免稅銷售額
  payWay?: string        // Cetustek PayWay，預設 1
  items: EInvoiceItem[]
  remark?: string
}

/** 舊 BK35 送 03；InvSrv（較舊）送 07。沿用目前門市在用的 BK35。 */
const INVOICE_TYPE = '03'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(4))
const tag = (name: string, v: string | number = '') => `<${name}>${typeof v === 'number' ? num(v) : esc(v)}</${name}>`

export function carrierTypeOf(carrier: string) {
  if (/^\/[0-9A-Z.+\-]{7}$/.test(carrier)) return '3J0002' // 手機條碼
  if (/^[A-Z]{2}\d{14}$/.test(carrier)) return 'CQ0001'     // 自然人憑證
  throw new Error(`看不出載具類別：${carrier}`)
}

export function amountsOf(inv: EInvoiceData) {
  const free = inv.freeTaxAmount ?? 0
  const taxable = inv.total - free
  const taxType = free > 0 ? (free === inv.total ? '3' : '9') : '1'
  if (inv.buyerId) {
    // B2B：銷售額未稅、另列稅額
    const sale = Math.round(taxable / 1.05)
    return { taxType, free, sale, tax: taxable - sale }
  }
  // B2C：銷售額 = 含稅金額、稅額 0（舊系統與 Cetustek 範例皆如此）
  return { taxType, free, sale: taxType === '3' ? inv.total : taxable, tax: 0 }
}

export function buildInvoiceXml(inv: EInvoiceData) {
  if (!/^[A-Z]{2}\d{8}$/.test(inv.invoiceNo)) throw new Error(`發票號碼格式不對：${inv.invoiceNo}`)
  const { date, time } = xmlDateTime(inv.issuedAt)
  const carrier = inv.carrier?.trim() ?? ''
  const npoban = inv.npoban?.trim() ?? ''
  const donate = carrier ? '0' : npoban ? '1' : '2' // Cetustek 慣例：2 = 無載具、印紙本
  const a = amountsOf(inv)
  const b2b = !!inv.buyerId

  const details = inv.items.map((it) => {
    const unit = b2b && !it.taxFree ? Math.round((it.unitPrice / 1.05) * 1e4) / 1e4 : it.unitPrice
    const amount = Math.round(unit * it.qty * 1e4) / 1e4
    return '<ProductItem>'
      + tag('ProductionCode', '0000') + tag('Description', it.name) + tag('Quantity', it.qty)
      + tag('Unit') + tag('UnitPrice', unit) + tag('Amount', amount)
      + (a.taxType === '9' && it.taxFree ? tag('DType', 'TN') : '')
      + '</ProductItem>'
  }).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice XSDVersion="2.8">',
    tag('InvoiceNumber', inv.invoiceNo),
    tag('InvoiceDate', date),
    tag('InvoiceTime', time),
    tag('OrderId', inv.orderId),
    tag('OrderDate', date),
    tag('BuyerIdentifier', inv.buyerId ?? ''),
    tag('BuyerName'), tag('BuyerAddress'), tag('BuyerPersonInCharge'),
    tag('BuyerTelephoneNumber'), tag('BuyerFacsimileNumber'), tag('BuyerEmailAddress'),
    tag('CheckNumber', inv.invoiceNo.slice(-3)),
    tag('Remark', inv.remark ?? ''),
    tag('InvoiceType', INVOICE_TYPE),
    tag('TaxType', a.taxType),
    tag('DonateMark', donate),
    tag('CarrierType', carrier ? carrierTypeOf(carrier) : ''),
    tag('CarrierId1', carrier),
    tag('CarrierId2', carrier),
    tag('NPOBAN', carrier ? '' : npoban),
    tag('RandomNumber', inv.randomCode),
    tag('SaleAmount', a.sale),
    ...(a.taxType === '9' ? [tag('FreeTaxSalesAmount', a.free), tag('ZeroTaxSalesAmount', 0)] : []),
    tag('TaxAmount', a.tax),
    tag('TotalAmount', inv.total),
    tag('PayWay', inv.payWay ?? '1'),
    '<Details>', details, '</Details>',
    '</Invoice>',
  ].join('\n')
}

/** 作廢（UploadCancelInvoice） */
export function buildCancelXml(p: { invoiceNo: string; issuedAt: Date; buyerId?: string; cancelAt: Date; reason?: string }) {
  const c = xmlDateTime(p.cancelAt)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice XSDVersion="2.8">',
    tag('InvoiceNumber', p.invoiceNo),
    tag('InvoiceDate', xmlDateTime(p.issuedAt).date),
    tag('BuyerId', p.buyerId ?? ''),
    tag('CancelDate', c.date),
    tag('CancelTime', c.time),
    tag('Reason', p.reason || '退貨'),
    tag('ReturnTaxDocumentNumber'),
    tag('Remark'),
    '</Invoice>',
  ].join('\n')
}

/** 註銷 / 取消作廢（UploadVoidInvoice） */
export function buildVoidXml(p: { invoiceNo: string; issuedAt: Date; buyerId?: string; voidAt: Date; reason: string }) {
  const v = xmlDateTime(p.voidAt)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Invoice XSDVersion="2.8">',
    tag('InvoiceNumber', p.invoiceNo),
    tag('InvoiceDate', xmlDateTime(p.issuedAt).date),
    tag('BuyerId', p.buyerId ?? ''),
    tag('VoidDate', v.date),
    tag('VoidTime', v.time),
    tag('Reason', p.reason),
    tag('Remark'),
    '</Invoice>',
  ].join('\n')
}
