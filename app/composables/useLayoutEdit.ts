// 收銀排列（格子位置 cell，1 起算、一排 LAYOUT_COLS 格）的編輯邏輯：
// 品項管理的「收銀排列」頁、收銀點餐頁的「編輯排列」共用。
// 格子算的是這個分類「全部上架品項」（不分站別），所以在某一站排的時候，別站品項佔的格子也會避開。
import type { Product } from '~/composables/usePosStore'

export const LAYOUT_COLS = 6

export function useLayoutEdit(category: () => string) {
  const { products } = usePosStore()
  const cat = useCatalog()

  const selected = ref<number | null>(null)
  const busy = ref(false)
  const msg = ref('')
  const msgErr = ref(false)

  const bySort = (a: Product, b: Product) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id
  const list = computed(() => products.value.filter(p => !p.inactive && (p.category || '') === category()).sort(bySort))

  // 格子編號 → 品項。沒排過的品項不另外列：照原本順序接在排好的最後面（跟收銀台顯示的一樣），
  // 一動到這個分類就把它們的位置一起存起來，之後都是實際位置。同一格有兩個（不該發生）的話，後面那個也當沒排
  const real = computed(() => {
    const g: Record<number, Product> = {}
    for (const p of list.value) if ((p.cell || 0) > 0 && !g[p.cell!]) g[p.cell!] = p
    return g
  })
  const unplaced = computed(() => list.value.filter(p => !((p.cell || 0) > 0) || real.value[p.cell!] !== p))
  const placedCount = computed(() => Object.keys(real.value).length)
  const grid = computed(() => {
    const g: Record<number, Product> = { ...real.value }
    let n = Math.max(0, ...Object.keys(real.value).map(Number))
    for (const p of unplaced.value) g[++n] = p
    return g
  })
  const maxCell = computed(() => Math.max(0, ...Object.keys(grid.value).map(Number)))
  // 多留一排空的，可以往下放
  const rows = computed(() => Math.max(2, Math.ceil(maxCell.value / LAYOUT_COLS) + 1))
  const selectedName = computed(() => list.value.find(p => p.id === selected.value)?.name || '')
  const cellIn = (id: number) => Number(Object.keys(grid.value).find(k => grid.value[Number(k)]!.id === id) || 0)
  // 還沒存過的位置（沒排過的品項）一起存
  const pending = () => unplaced.value.map(p => ({ id: p.id, cell: cellIn(p.id) }))

  async function save(changes: { id: number; cell: number }[], done: string) {
    if (!changes.length || busy.value) return
    busy.value = true
    msgErr.value = false
    try {
      await cat.saveCells(changes, (i, t) => { msg.value = t > 2 ? `儲存中 ${i}/${t}…` : '儲存中…' })
      msg.value = done
      setTimeout(() => { if (msg.value === done) msg.value = '' }, 2000)
    } catch (e) {
      msg.value = '儲存失敗：' + (e as Error).message
      msgErr.value = true
    } finally {
      busy.value = false
    }
  }

  // 把品項放到第 n 格；那格原本有品項就換到這個品項原本的位置
  function place(id: number, n: number) {
    const from = cellIn(id)
    selected.value = null
    if (!n || from === n) return
    const other = grid.value[n]
    const map = new Map(pending().map(c => [c.id, c.cell]))
    map.set(id, n)
    if (other && other.id !== id) map.set(other.id, from)
    save([...map].map(([id, cell]) => ({ id, cell })), '已儲存')
  }

  // 點格子：已選品項 → 放過去（有東西就互換）；沒選 → 選起來 / 取消
  function clickCell(n: number) {
    const p = grid.value[n]
    if (selected.value && (!p || p.id !== selected.value)) { place(selected.value, n); return }
    selected.value = p ? (selected.value === p.id ? null : p.id) : null
  }

  // 照目前格子順序依序填 1、2、3…（去掉中間的空格）
  function compact() {
    const ordered = Object.keys(grid.value).map(Number).sort((a, b) => a - b).map(k => grid.value[k]!)
    save(ordered.map((p, i) => ({ id: p.id, cell: i + 1 })), '已排滿')
  }
  function clearAll() {
    if (!confirm(`把「${category()}」的格子位置全部清掉？收銀台會改回自動一個接一個排。`)) return
    save(list.value.filter(p => (p.cell || 0) > 0).map(p => ({ id: p.id, cell: 0 })), '已清掉')
  }

  return { selected, busy, msg, msgErr, list, grid, placedCount, rows, selectedName, place, clickCell, compact, clearAll }
}
