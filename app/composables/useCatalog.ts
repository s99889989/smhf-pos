// composables/useCatalog.ts
// 站別、商品主檔、原料庫存與商品圖片統一存在公司資料機（print-agent Catalog.cs）。
// 這裡負責：開網頁時載入、各頁面修改時寫回資料機、結帳後扣資料機庫存。
// 連不到 print-agent（例如開發電腦）時是「範例模式」：用 usePosStore 內建的範例資料，改了只在這個分頁有效。
import type { Product, Material, StockIn, InternalUse, StationDef, CategoryDef } from './usePosStore'
import { catalogAll, catalogPost, catalogUploadImage, catalogRoute, CatalogError, type CatalogAll } from '~/utils/catalogApi'
import { prepareImage } from '~/utils/imageUpload'

export interface CatalogState {
  mode: 'loading' | 'demo' | 'online' | 'tablet'
  offline: boolean          // 平板：目前連不到資料機（用鏡像）
  pending: number           // 平板：還沒補送到資料機的庫存異動筆數
  syncedAt: string
  error: string             // 最近一次載入 / 儲存失敗原因
  route: 'lan' | 'hub'      // 區網直連，或區網不通改走家裡 Hub
}

const PENDING_KEY = 'pos-stock-pending' // 收銀機：結帳扣庫存送不出去時先存這裡，下次載入再補送

function readPending(): { sub: string; body: any }[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') } catch { return [] }
}
function writePending(list: { sub: string; body: any }[]) {
  try { list.length ? localStorage.setItem(PENDING_KEY, JSON.stringify(list)) : localStorage.removeItem(PENDING_KEY) } catch { /* 無痕 */ }
}
function newClientId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

export function useCatalog() {
  const store = usePosStore()
  const state = useState<CatalogState>('catalogState', () => ({ mode: 'loading', offline: false, pending: 0, syncedAt: '', error: '', route: 'lan' }))

  const connected = () => state.value.mode === 'online' || state.value.mode === 'tablet'

  function apply(d: CatalogAll) {
    store.stations.value = d.stations.map(s => ({ id: String(s.id), name: s.name, emoji: s.emoji || '', sortOrder: Number(s.sortOrder) || 0 }))
    store.categories.value = (d.categories || []).map(c => ({ id: String(c.id), name: c.name, emoji: c.emoji || '', sortOrder: Number(c.sortOrder) || 0, locations: Array.isArray(c.locations) ? c.locations.map(String) : undefined }))
    store.products.value = d.products.map((p): Product => ({
      id: p.id, name: p.name, emoji: p.emoji || '', price: Number(p.price) || 0, category: p.category || '', note: p.note || '',
      cashOnly: !!p.cashOnly, openPrice: !!p.openPrice, inactive: !!p.inactive, locations: (p.locations || []).map(String), sortOrder: Number(p.sortOrder) || 0, cell: Number(p.cell) || 0,
      materials: (p.materials || []).map((m: any) => ({ materialId: m.materialId, quantity: Number(m.quantity) || 0 })),
      image: p.image || '',
    }))
    store.materials.value = d.materials.map((m): Material => ({
      id: m.id, name: m.name, unit: m.unit || '', stock: Number(m.stock) || 0, alertStock: Number(m.alertStock) || 0, source: m.source || '',
    }))
    const logs = d.logs || []
    store.stockIns.value = logs.filter(l => l.type === 'in').map((l): StockIn => ({
      id: l.id, materialId: l.materialId, materialName: l.materialName, quantity: Number(l.quantity) || 0,
      source: l.source || '', note: l.note || '', createdAt: new Date(l.createdAt),
    }))
    store.internalUses.value = logs.filter(l => l.type === 'use').map((l): InternalUse => ({
      id: l.id, materialId: l.materialId, materialName: l.materialName, quantity: Number(l.quantity) || 0,
      purpose: l.purpose || '', operator: l.operator || '', createdAt: new Date(l.createdAt),
    }))
    state.value = {
      mode: d.mode === 'tablet' ? 'tablet' : 'online',
      offline: !!d.offline,
      pending: d.pending ?? 0,
      syncedAt: d.syncedAt || '',
      error: d.offline ? `離線中，用平板上的資料（${d.syncedAt || '尚未同步'}）` : '',
      route: catalogRoute(),
    }
  }

  async function load() {
    try {
      const d = await catalogAll()
      apply(d)
      await flushPending()
    } catch (e) {
      // 第一次就連不到：範例模式；之前連過：保留畫面上的資料、顯示錯誤
      if (!connected()) state.value = { ...state.value, mode: 'demo', error: (e as Error).message }
      else state.value = { ...state.value, error: (e as Error).message }
    }
  }

  async function flushPending() {
    const list = readPending()
    if (!list.length) return
    const left: typeof list = []
    for (const job of list) {
      try { apply(await catalogPost(job.sub, job.body)) } catch (e) {
        if (e instanceof CatalogError && !e.unreachable && !/連不到資料機/.test(e.message)) continue // 資料機拒收（例如品項已刪）：丟掉
        left.push(job)
      }
    }
    writePending(left)
  }

  /** 修改類：一定要連得到資料機才做（範例模式則只改畫面） */
  async function mutate(sub: string, body: unknown, demo: () => void) {
    if (!connected()) { demo(); return }
    apply(await catalogPost(sub, body))
  }

  // emoji 要 print-agent 1.14 起才會存；舊版會默默丟掉，存完比對一下，沒存到就提醒
  const OLD_AGENT_EMOJI = '資料機的 print-agent 還是舊版，要更新到 1.14 才能保存 emoji（其他內容已存好）'
  function checkEmoji(want: string | undefined, got: string | undefined) {
    if (connected() && want !== undefined && (want || '') !== (got || '')) throw new Error(OLD_AGENT_EMOJI)
  }

  // ---- 站別 ----
  const saveStation = async (s: Partial<StationDef> & { name: string }) => {
    await mutate('station/save', s, () => {
      const list = store.stations.value
      const cur = s.id ? list.find(x => x.id === s.id) : undefined
      if (cur) { cur.name = s.name; if (s.emoji !== undefined) cur.emoji = s.emoji }
      else list.push({ id: 's' + Date.now(), name: s.name, emoji: s.emoji || '', sortOrder: list.length + 1 })
    })
    const list = store.stations.value
    checkEmoji(s.emoji, (s.id ? list.find(x => x.id === s.id) : [...list].reverse().find(x => x.name === s.name))?.emoji)
  }
  const deleteStation = (id: string) => mutate('station/delete', { id }, () => {
    store.stations.value = store.stations.value.filter(s => s.id !== id)
    store.products.value.forEach(p => { p.locations = p.locations.filter(l => l !== id) })
  })

  // ---- 分類 ----
  // 舊版 print-agent（1.7 以前）沒有分類 API：清單只能從品項推出來，不能另外新增
  const saveCategory = async (c: Partial<CategoryDef> & { name: string }) => {
    await saveCategoryRaw(c)
    const saved = store.categories.value.find(x => x.name === c.name.trim())
    // 分類站別要 print-agent 1.16 起才會存；舊版會默默丟掉
    if (connected() && c.locations && !saved?.locations) throw new Error('資料機的 print-agent 還是舊版，要更新到 1.16 才能保存分類的站別（其他內容已存好）')
    checkEmoji(c.emoji, saved?.emoji)
  }
  const saveCategoryRaw = (c: Partial<CategoryDef> & { name: string }) => mutate('category/save', c, () => {
    const name = c.name.trim()
    const list = store.categories.value
    if (!list.length) store.categories.value = store.categoryList.value.map((x, i) => ({ ...x, id: x.id || 'c' + (i + 1) }))
    const all = store.categories.value
    const cur = c.id ? all.find(x => x.id === c.id) : (c.sortOrder != null ? all.find(x => x.name === name) : undefined)
    if (all.some(x => x.name === name && x !== cur)) throw new Error(`已經有分類「${name}」`)
    if (cur) {
      if (cur.name !== name) store.products.value.forEach(p => { if (p.category === cur.name) p.category = name })
      cur.name = name
      if (c.emoji !== undefined) cur.emoji = c.emoji
      if (c.sortOrder != null) cur.sortOrder = c.sortOrder
      if (c.locations) cur.locations = [...c.locations]
    } else all.push({ id: 'c' + Date.now(), name, emoji: c.emoji || '', sortOrder: all.length + 1, locations: c.locations ? [...c.locations] : undefined })
    // 分類決定站別：這個分類的品項一起套用（和 print-agent 1.16 一樣）
    const locs = all.find(x => x.name === name)?.locations
    if (locs) store.products.value.forEach(p => { if (p.category === name) p.locations = [...locs] })
  })
  const deleteCategory = (id: string) => mutate('category/delete', { id }, () => {
    if (!store.categories.value.length) store.categories.value = store.categoryList.value.map((x, i) => ({ ...x, id: x.id || 'c' + (i + 1) }))
    const c = store.categories.value.find(x => x.id === id)
    if (!c) return
    const n = store.products.value.filter(p => p.category === c.name).length
    if (n) throw new Error(`還有 ${n} 個品項是「${c.name}」，請先把它們改到別的分類再刪`)
    store.categories.value = store.categories.value.filter(x => x.id !== id)
  })

  // ---- 商品 ----
  const saveProduct = async (p: Omit<Product, 'id' | 'image'> & { id?: number | null }) => {
    // 分類有設站別：品項跟著分類（print-agent 1.16 也會這樣做）
    const catLocs = store.categories.value.find(c => c.name === (p.category || '').trim())?.locations
    if (catLocs) p = { ...p, locations: [...catLocs] }
    const before = new Set(store.products.value.map(x => x.id))
    await mutate('product/save', p, () => {
      const list = store.products.value
      const idx = p.id ? list.findIndex(x => x.id === p.id) : -1
      if (idx >= 0) list[idx] = { ...list[idx]!, ...p, id: list[idx]!.id }
      else list.push({ ...p, id: Math.max(0, ...list.map(x => x.id)) + 1, image: '' })
    })
    // 可以有同名品項（print-agent 1.24 起），用 id 找：編輯找原本的 id，新增找剛多出來的那個
    const list = store.products.value
    const saved = p.id ? list.find(x => x.id === p.id)
      : (list.find(x => !before.has(x.id) && x.name === p.name.trim()) ?? [...list].reverse().find(x => x.name === p.name.trim()))
    // 下架要 print-agent 1.15 起才會存；舊版會默默丟掉（等於又上架）
    if (connected() && p.inactive && !saved?.inactive) throw new Error('資料機的 print-agent 還是舊版，要更新到 1.15 才能保存「下架」（其他內容已存好）')
    checkEmoji(p.emoji, saved?.emoji)
    return saved?.id
  }
  const deleteProduct = (id: number) => mutate('product/delete', { id }, () => {
    store.products.value = store.products.value.filter(p => p.id !== id)
  })
  // 收銀排列：只改格子位置，其他欄位照目前的原樣送回（print-agent 1.24 起才存得住 cell）
  async function saveCells(changes: { id: number; cell: number }[], progress?: (n: number, total: number) => void) {
    let n = 0
    for (const c of changes) {
      progress?.(++n, changes.length)
      const cur = store.products.value.find(x => x.id === c.id)
      if (!cur || (cur.cell || 0) === c.cell) continue
      const { image: _img, ...rest } = cur
      await mutate('product/save', { ...rest, cell: c.cell, locations: [...rest.locations], materials: rest.materials.map(m => ({ ...m })) }, () => { cur.cell = c.cell })
      if (connected() && (store.products.value.find(x => x.id === c.id)?.cell || 0) !== c.cell)
        throw new Error('資料機的 print-agent 還是舊版，要更新到 1.24 才能保存收銀排列')
    }
  }
  async function setProductImage(id: number, file: File) {
    const jpg = await prepareImage(file)
    if (!connected()) {
      const p = store.products.value.find(x => x.id === id)
      if (p) p.image = URL.createObjectURL(jpg) // 範例模式：只在這個分頁看得到
      return
    }
    apply(await catalogUploadImage(id, jpg))
  }
  const clearProductImage = (id: number) => mutate('product/image-clear', { id }, () => {
    const p = store.products.value.find(x => x.id === id)
    if (p) p.image = ''
  })

  // ---- 原料 ----
  async function saveMaterial(m: Omit<Material, 'id'> & { id?: number | null }) {
    const old = m.id ? store.materials.value.find(x => x.id === m.id) : undefined
    await mutate('material/save', m, () => {
      const list = store.materials.value
      if (old) Object.assign(old, m, { id: old.id })
      else list.push({ ...m, id: Math.max(0, ...list.map(x => x.id)) + 1 })
    })
    // 編輯時直接改了庫存數字 = 盤點調整（資料機會記一筆 adjust）
    if (connected() && old && m.stock !== old.stock)
      apply(await catalogPost('stock/adjust', { materialId: old.id, stock: m.stock, note: '物料編輯直接修改庫存', clientId: newClientId() }))
  }
  const deleteMaterial = (id: number) => mutate('material/delete', { id }, () => {
    store.materials.value = store.materials.value.filter(m => m.id !== id)
  })

  // ---- 庫存異動（usePosStore 的 addStockIn / addInternalUse / addOrder 呼叫）----
  async function stockOp(sub: string, body: Record<string, unknown>) {
    const job = { sub, body: { ...body, clientId: newClientId() } }
    try {
      apply(await catalogPost(job.sub, job.body))
    } catch (e) {
      // 結帳不能因為扣庫存失敗卡住：先記在這台，下次載入補送（資料機用 clientId 去重）
      if (sub === 'stock/sale' && (!(e instanceof CatalogError) || e.unreachable || /連不到資料機/.test(e.message))) {
        writePending([...readPending(), job])
        state.value = { ...state.value, error: '扣庫存暫時送不到資料機，稍後自動補送' }
        return
      }
      throw e
    }
  }

  return {
    state, connected, load,
    saveStation, deleteStation,
    saveCategory, deleteCategory,
    saveProduct, deleteProduct, setProductImage, clearProductImage, saveCells,
    saveMaterial, deleteMaterial,
    stockOp,
  }
}
