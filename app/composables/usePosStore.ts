// composables/usePosStore.ts

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
  locations: ('restaurant' | 'shop' | 'stall')[]
  sortOrder: number
  materials: ProductMaterial[]
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
  location: 'restaurant' | 'shop' | 'stall'
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
  enabled: boolean
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
export interface GoogleAccount {
  id: string          // Google sub ID
  name: string
  email: string
  avatar: string
  memberType: 'none' | 'staff' | 'vip'
  memberId: string    // 對應的員工ID或VIP號碼
  firstLoginAt: Date
  lastLoginAt: Date
}

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

  function addStockIn(materialId: number, quantity: number, note: string, date: Date) {
    const mat = materials.value.find(m => m.id === materialId)
    if (!mat) return
    mat.stock += quantity
    stockIns.value.push({ id: stockInSeq.value++, materialId, materialName: mat.name, quantity, source: mat.source, note, createdAt: date })
    stockIns.value.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  function addInternalUse(materialId: number, quantity: number, purpose: string, operator: string, date?: Date) {
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
    { id:1,  name:'午餐－大人',     price:250, category:'套餐',    note:'吃到飽', cashOnly:true,  locations:['restaurant'],               sortOrder:1,  materials:[] },
    { id:2,  name:'午餐－小孩',     price:180, category:'套餐',    note:'吃到飽', cashOnly:true,  locations:['restaurant'],               sortOrder:2,  materials:[] },
    { id:3,  name:'巧克力餅乾一盒', price:180, category:'餅乾麵包', note:'30入',  cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:3,  materials:[{materialId:1,quantity:30}] },
    { id:4,  name:'巧克力餅乾一包', price:45,  category:'餅乾麵包', note:'5入',   cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:4,  materials:[{materialId:1,quantity:5}] },
    { id:5,  name:'手工麵包',       price:60,  category:'餅乾麵包', note:'',      cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:5,  materials:[{materialId:2,quantity:1}] },
    { id:6,  name:'鳳梨酥禮盒',     price:320, category:'餅乾麵包', note:'12入',  cashOnly:false, locations:['restaurant','shop','stall'], sortOrder:6,  materials:[{materialId:3,quantity:12}] },
    { id:7,  name:'有機米 1kg',     price:220, category:'農產品',  note:'',      cashOnly:false, locations:['shop','stall'],              sortOrder:7,  materials:[{materialId:4,quantity:1}] },
    { id:8,  name:'洛神花醬',       price:150, category:'農產品',  note:'260g',  cashOnly:false, locations:['shop','stall'],              sortOrder:8,  materials:[{materialId:5,quantity:1}] },
    { id:9,  name:'梅子醋',         price:280, category:'農產品',  note:'500ml', cashOnly:false, locations:['shop','stall'],              sortOrder:9,  materials:[{materialId:6,quantity:1}] },
    { id:10, name:'有機果汁',       price:80,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant','shop'],         sortOrder:10, materials:[{materialId:7,quantity:1}] },
    { id:11, name:'花草茶',         price:60,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant','shop'],         sortOrder:11, materials:[{materialId:8,quantity:1}] },
    { id:12, name:'黑糖薑母茶',     price:70,  category:'飲品',    note:'',      cashOnly:false, locations:['restaurant'],               sortOrder:12, materials:[{materialId:9,quantity:1}] },
  ])

  const orders = useState<Order[]>('orders', () => [])
  const orderSeq = useState<number>('orderSeq', () => 1)

  function addOrder(order: Omit<Order, 'id' | 'no' | 'createdAt'>) {
    const no = 'A' + String(orderSeq.value).padStart(4, '0')
    orders.value.unshift({ ...order, id: orderSeq.value, no, createdAt: new Date() })
    orderSeq.value++
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

  // Google 帳號（登入後自動建立，後台再綁定身分）
  const googleAccounts = useState<GoogleAccount[]>('googleAccounts', () => [
    {
      id: 'google-001', name: '楊鄉咪', email: 'example@gmail.com', avatar: '',
      memberType: 'vip', memberId: '155375',
      firstLoginAt: new Date('2024-01-01'), lastLoginAt: new Date(),
    },
    {
      id: 'google-002', name: '測試用戶', email: 'test@gmail.com', avatar: '',
      memberType: 'none', memberId: '',
      firstLoginAt: new Date('2024-03-15'), lastLoginAt: new Date('2024-03-15'),
    },
  ])

  return {
    discountTypes, employees, vipMembers,
    materials, stockIns, addStockIn,
    internalUses, addInternalUse,
    products, orders, addOrder,
    shopOrders, addShopOrder,
    googleAccounts,
  }
}
