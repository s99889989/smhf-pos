// composables/usePosStore.ts
import { saveOrder, newClientId } from '~/utils/ordersApi'

export interface Material {
  id: number
  name: string
  unit: string
  stock: number
  alertStock: number
  source: string   // 固定來源：農莊烘焙 / 合作商 / 廠商採購 等
}

export interface StockIn {
  id: number
  materialId: number
  materialName: string
  quantity: number
  source: string    // 來源：農莊烘焙 / 合作商 / 廠商 等
  note: string
  createdAt: Date
}

export interface InternalUse {
  id: number
  materialId: number
  materialName: string
  quantity: number
  purpose: string   // 用途，例：餐廳內用麵包
  operator: string  // 誰領用
  createdAt: Date
}

export interface ProductMaterial {
  materialId: number
  quantity: number
}

export interface Product {
  id: number
  name: string
  price: number
  category: string
  note: string
  cashOnly: boolean
  locations: string[]   // 上架在哪幾個收銀站（站別 id，見 stations；後台可自訂）
  sortOrder: number
  materials: ProductMaterial[]
  image?: string        // 資料機上的圖片檔名（catalogImageUrl 轉網址）
}

// 收銀站（1 號餐廳、2 號小舖、行動平板…），存在資料機，可在系統設定新增、改名
export interface StationDef {
  id: string
  name: string
  sortOrder: number
}

// 品項分類（午餐、飲品…），存在資料機，可在品項管理新增、改名、刪除；品項上存的是分類名稱
export interface CategoryDef {
  id: string
  name: string
  sortOrder: number
}

export interface OrderItem {
  productId: number
  name: string
  price: number
  finalPrice: number
  qty: number
}

export interface Order {
  id: number
  no: string
  location: string      // 站別 id
  items: OrderItem[]
  subtotal: number
  discount: string
  discountLabel: string
  staffId: string
  vipId: string
  total: number
  voucherAmount: number
  receivedCash: number    // 客人給的現金
  change: number          // 找零
  payMethod: 'cash' | 'card' | 'hua' | 'voucher'
  payDetail: string       // 混合付款說明，例：消費券$200 + 現金$50
  carrier: string
  createdAt: Date
  clientId?: string       // 存到資料機用的唯一代號（重送不會存兩次）
  invoiceNo?: string      // BM-92177850
  invoiceRandomCode?: string
  invoiceAes?: string
  invoiceIsMock?: boolean
  cashierId?: string      // 結帳人（員工 ID）
  cashierName?: string
}

// 單號：這台機器代號-月日-當日流水號，例 KQ-1125-003（機器代號第一次用時隨機產生，存在 localStorage）
function nextOrderNo(at: Date) {
  const ls = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v) } catch { /* 無痕模式 */ } return null }
  let code = ls('pos-device-code')
  if (!code) {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    code = A[Math.floor(Math.random() * A.length)]! + A[Math.floor(Math.random() * A.length)]!
    ls('pos-device-code', code)
  }
  const md = String(at.getMonth() + 1).padStart(2, '0') + String(at.getDate()).padStart(2, '0')
  let seq: { day: string; n: number } = { day: '', n: 0 }
  try { seq = JSON.parse(ls('pos-order-seq') || '') } catch { /* 第一次 */ }
  const n = seq.day === md ? seq.n + 1 : 1
  ls('pos-order-seq', JSON.stringify({ day: md, n }))
  return `${code}-${md}-${String(n).padStart(3, '0')}`
}

export interface DiscountType {
  id: number
  label: string
  rate: number
  enabled: boolean
  requireStaff: boolean
  requireVip: boolean
  builtIn: boolean   // true = 系統內建，不可刪除、不可停用
}

export interface Employee {
  id: string    // F00228
  name: string  // 吳宣澔
  dept?: string  // 部門（員工管理可分部門、Excel 匯入）
  enabled: boolean
  pinHash?: string  // 結帳人 PIN 的雜湊（useCashier.pinHash），沒設定 = 不能當結帳人
}

export interface VipMember {
  id: string    // 155375
  name: string  // 楊鄉咪
  phone: string
  address: string
  note: string
  enabled: boolean
}

// 線上商店訂單
export interface ShopOrderItem {
  productId: number
  name: string
  price: number
  qty: number
}

export interface ShopOrder {
  id: number
  no: string
  customerName: string
  customerPhone: string
  customerAddress: string
  items: ShopOrderItem[]
  total: number
  payMethod: 'transfer' | 'cod'  // 匯款 / 貨到付款
  carrier: string
  shippingCompany: 'blackcat' | 'hsinchu' | ''
  trackingNo: string
  status: 'pending' | 'confirmed' | 'shipped' | 'done'
  note: string
  createdAt: Date
}

// 預設三站的名稱（連不到資料機時用）；畫面請用 usePosStore().stationName(id)，站名可在後台改
export const LOC_LABEL: Record<string, string> = {
  restaurant: '餐廳',
  shop: '小舖',
  stall: '擺攤',
}

export const PAY_LABEL: Record<string, string> = {
  cash:    '現金',
  card:    '信用卡',
  hua:     '華南Q收銀台',
  voucher: '消費券',
}

export const SHOP_ORDER_STATUS: Record<string, string> = {
  pending:   '待確認',
  confirmed: '已確認',
  shipped:   '已出貨',
  done:      '完成',
}

export function usePosStore() {

  const discountTypes = useState<DiscountType[]>('discountTypes', () => [
    { id: 1, label: '一般',    rate: 1,    enabled: true, requireStaff: false, requireVip: false, builtIn: true },
    { id: 2, label: '員工價',  rate: 0.95, enabled: true, requireStaff: true,  requireVip: false, builtIn: true },
    { id: 3, label: 'VIP9卡', rate: 0.9,  enabled: true, requireStaff: false, requireVip: true,  builtIn: true },
  ])

  const employees = useState<Employee[]>('employees', () => [
    { id: 'F00001', name: '吳宣澔', enabled: true },
    { id: 'F00002', name: '範例員工', enabled: true },
  ])

  const vipMembers = useState<VipMember[]>('vipMembers', () => [
    { id: '155375', name: '楊鄉咪', phone: '', address: '', note: '', enabled: true },
  ])

  const materials = useState<Material[]>('materials', () => [
    { id: 1, name: '巧克力餅乾',   unit: '個',   stock: 200, alertStock: 30, source: '農莊烘焙' },
    { id: 2, name: '手工麵包',     unit: '個',   stock: 45,  alertStock: 10, source: '農莊烘焙' },
    { id: 3, name: '鳳梨酥',       unit: '個',   stock: 120, alertStock: 24, source: '合作商'   },
    { id: 4, name: '有機米',       unit: 'kg',   stock: 80,  alertStock: 10, source: '廠商採購' },
    { id: 5, name: '洛神花醬',     unit: '瓶',   stock: 30,  alertStock: 5,  source: '農莊烘焙' },
    { id: 6, name: '梅子醋',       unit: '瓶',   stock: 24,  alertStock: 5,  source: '農莊烘焙' },
    { id: 7, name: '有機果汁原料', unit: '杯份', stock: 60,  alertStock: 10, source: '廠商採購' },
    { id: 8, name: '花草茶',       unit: '杯份', stock: 80,  alertStock: 10, source: '廠商採購' },
    { id: 9, name: '黑糖薑母茶',   unit: '杯份', stock: 50,  alertStock: 10, source: '廠商採購' },
  ])

  const stockIns = useState<StockIn[]>('stockIns', () => [])
  const stockInSeq = useState<number>('stockInSeq', () => 1)

  const internalUses = useState<InternalUse[]>('internalUses', () => [])
  const internalUseSeq = useState<number>('internalUseSeq', () => 1)

  // 站別：資料機載入後會換成資料機的清單（useCatalog）
  const stations = useState<StationDef[]>('stations', () => [
    { id: 'restaurant', name: '餐廳', sortOrder: 1 },
    { id: 'shop',       name: '小舖', sortOrder: 2 },
    { id: 'stall',      name: '擺攤', sortOrder: 3 },
  ])
  function stationName(id: string) {
    return stations.value.find(s => s.id === id)?.name ?? LOC_LABEL[id] ?? id
  }

  // 分類清單：資料機載入後換成資料機的清單（useCatalog）。
  // 畫面用 categoryList：清單依順序，再補上品項有用到、清單裡卻沒有的分類（舊版 print-agent / 範例模式）
  const categories = useState<CategoryDef[]>('categories', () => [])
  const categoryList = computed<CategoryDef[]>(() => {
    const list = [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder)
    const names = new Set(list.map(c => c.name))
    for (const p of [...products.value].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const n = (p.category || '').trim()
      if (n && !names.has(n)) { names.add(n); list.push({ id: '', name: n, sortOrder: list.length + 1 }) }
    }
    return list
  })

  // 連得到資料機時，庫存異動寫到資料機（useCatalog）；範例模式才在這裡直接改
  function catalogFailed(e: unknown) {
    alert('寫入資料機失敗：' + ((e as Error)?.message ?? e))
  }

  function addStockIn(materialId: number, quantity: number, note: string, date: Date) {
    const cat = useCatalog()
    if (cat.connected()) {
      cat.stockOp('stock/in', { materialId, quantity, note, date: date.toISOString() }).catch(catalogFailed)
      return
    }
    const mat = materials.value.find(m => m.id === materialId)
    if (!mat) return
    mat.stock += quantity
    stockIns.value.push({ id: stockInSeq.value++, materialId, materialName: mat.name, quantity, source: mat.source, note, createdAt: date })
    stockIns.value.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  function addInternalUse(materialId: number, quantity: number, purpose: string, operator: string, date?: Date) {
    const cat = useCatalog()
    if (cat.connected()) {
      cat.stockOp('stock/use', { materialId, quantity, purpose, operator, date: (date ?? new Date()).toISOString() }).catch(catalogFailed)
      return
    }
    const mat = materials.value.find(m => m.id === materialId)
    if (!mat) return
    mat.stock = Math.max(0, mat.stock - quantity)
    internalUses.value.unshift({
      id: internalUseSeq.value++,
      materialId, materialName: mat.name,
      quantity, purpose, operator,
      createdAt: date ?? new Date(),
    })
    internalUses.value.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const products = useState<Product[]>('products', () => [
    { id:1,  name:'午餐－大人',     price:250, category:'套餐',    note:'吃到飽', cashOnly:true,  locations:['restaurant'],               sortOrder:1,  materials:[], image:'' },
    { id:2,  name:'午餐－小孩',     price:180, category:'套餐',    note:'吃到飽', cashOnly:true,  locations:['restaurant'],               sortOrder:2,  materials:[], image:'' },
    { id:3,  name:'巧克力餅乾一盒', price:180, category:'餅乾麵包', note:'30入',  cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:3,  materials:[{materialId:1,quantity:30}], image:'' },
    { id:4,  name:'巧克力餅乾一包', price:45,  category:'餅乾麵包', note:'5入',   cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:4,  materials:[{materialId:1,quantity:5}], image:'' },
    { id:5,  name:'手工麵包',       price:60,  category:'餅乾麵包', note:'',      cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:5,  materials:[{materialId:2,quantity:1}], image:'' },
    { id:6,  name:'鳳梨酥禮盒',     price:320, category:'餅乾麵包', note:'12入',  cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:6,  materials:[{materialId:3,quantity:12}], image:'' },
    { id:7,  name:'有機米 1kg',     price:220, category:'農產品',  note:'',      cashOnly:false, locations:['shop','stall'],              sortOrder:7,  materials:[{materialId:4,quantity:1}], image:'' },
    { id:8,  name:'洛神花醬',       price:150, category:'農產品',  note:'260g',  cashOnly:false, locations:['shop','stall'],              sortOrder:8,  materials:[{materialId:5,quantity:1}], image:'' },
    { id:9,  name:'梅子醋',         price:280, category:'農產品',  note:'500ml', cashOnly:false, locations:['shop','stall'],              sortOrder:9,  materials:[{materialId:6,quantity:1}], image:'' },
    { id:10, name:'有機果汁',       price:80,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant','shop'],         sortOrder:10, materials:[{materialId:7,quantity:1}], image:'' },
    { id:11, name:'花草茶',         price:60,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant','shop'],         sortOrder:11, materials:[{materialId:8,quantity:1}], image:'' },
    { id:12, name:'黑糖薑母茶',     price:70,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant'],               sortOrder:12, materials:[{materialId:9,quantity:1}], image:'' },
  ])

  const orders = useState<Order[]>('orders', () => [])
  const orderSeq = useState<number>('orderSeq', () => 1)

  // createdAt：有開發票時用資料機的開立時間（收銀電腦時鐘可能不準）
  function addOrder(order: Omit<Order, 'id' | 'no' | 'createdAt' | 'clientId'>, createdAt = new Date()) {
    const no = nextOrderNo(createdAt)
    const clientId = newClientId()
    orders.value.unshift({ ...order, id: orderSeq.value, no, clientId, createdAt })
    orderSeq.value++
    // 交易紀錄存一份到資料機（送不出去會先存在這台、稍後補送）；QR 驗證碼不用存
    const { invoiceAes: _qr, ...record } = order
    void saveOrder(clientId, { ...record, no, createdAt: createdAt.toISOString() })
    const cat = useCatalog()
    if (cat.connected()) {
      // 扣資料機的共用庫存（送不出去會先存在這台、稍後補送）
      cat.stockOp('stock/sale', {
        orderNo: no, station: order.location,
        items: order.items.map(i => ({ productId: i.productId, qty: i.qty })),
      }).catch(catalogFailed)
      return
    }
    for (const item of order.items) {
      const prod = products.value.find(p => p.id === item.productId)
      if (!prod) continue
      for (const pm of prod.materials) {
        const mat = materials.value.find(m => m.id === pm.materialId)
        if (mat) mat.stock = Math.max(0, mat.stock - pm.quantity * item.qty)
      }
    }
  }

  const shopOrders = useState<ShopOrder[]>('shopOrders', () => [])
  const shopOrderSeq = useState<number>('shopOrderSeq', () => 1)

  function addShopOrder(order: Omit<ShopOrder, 'id' | 'no' | 'createdAt' | 'status' | 'trackingNo'>) {
    const no = 'S' + String(shopOrderSeq.value).padStart(4, '0')
    shopOrders.value.unshift({
      ...order, id: shopOrderSeq.value, no,
      status: 'pending', trackingNo: '',
      createdAt: new Date(),
    })
    shopOrderSeq.value++
  }

  return {
    discountTypes, employees, vipMembers,
    materials, stockIns, addStockIn,
    internalUses, addInternalUse,
    products, orders, addOrder,
    stations, stationName,
    categories, categoryList,
    shopOrders, addShopOrder,
  }
}
