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
  const cellOf = (id: number) => products.value.find(p => p.id === id)?.cell || 0

  // 格子編號 → 品項；同一格有兩個（不該發生）的話，後面那個算「還沒排」
  const grid = computed(() => {
    const g: Record<number, Product> = {}
    for (const p of list.value) if ((p.cell || 0) > 0 && !g[p.cell!]) g[p.cell!] = p
    return g
  })
  const unplaced = computed(() => list.value.filter(p => !((p.cell || 0) > 0) || grid.value[p.cell!] !== p))
  const placedCount = computed(() => Object.keys(grid.value).length)
  const maxCell = computed(() => Math.max(0, ...Object.keys(grid.value).map(Number)))
  // 多留一排空的，可以往下放
  const rows = computed(() => Math.max(2, Math.ceil(Math.max(maxCell.value, list.value.length) / LAYOUT_COLS) + 1))
  const selectedName = computed(() => list.value.find(p => p.id === selected.value)?.name || '')

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

  // 把品項放到第 n 格（0 = 移出格子）；那格原本有品項就換到這個品項原本的位置
  function place(id: number, n: number) {
    const from = grid.value[cellOf(id)]?.id === id ? cellOf(id) : 0
    selected.value = null
    if (from === n) return
    const other = n ? grid.value[n] : undefined
    const changes = [{ id, cell: n }]
    if (other && other.id !== id) changes.push({ id: other.id, cell: from })
    save(changes, '已儲存')
  }

  // 點格子：已選品項 → 放過去（有東西就互換）；沒選 → 選起來 / 取消
  function clickCell(n: number) {
    const p = grid.value[n]
    if (selected.value && (!p || p.id !== selected.value)) { place(selected.value, n); return }
    selected.value = p ? (selected.value === p.id ? null : p.id) : null
  }
  function clickUnplaced(id: number) {
    selected.value = selected.value === id ? null : id
  }

  // 排好的照格子順序、沒排的照原本順序，依序填 1、2、3…（去掉中間的空格）
  function compact() {
    const ordered = [...Object.keys(grid.value).map(Number).sort((a, b) => a - b).map(k => grid.value[k]!), ...unplaced.value]
    save(ordered.map((p, i) => ({ id: p.id, cell: i + 1 })), '已排滿')
  }
  function clearAll() {
    if (!confirm(`把「${category()}」的格子位置全部清掉？收銀台會改回自動一個接一個排。`)) return
    save(list.value.filter(p => (p.cell || 0) > 0).map(p => ({ id: p.id, cell: 0 })), '已清掉')
  }

  return { selected, busy, msg, msgErr, list, grid, unplaced, placedCount, rows, selectedName, cellOf, place, clickCell, clickUnplaced, compact, clearAll }
}
