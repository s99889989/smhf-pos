<template>
  <div>
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <span class="text-sm text-gray-600">
        {{ category }}：收銀台大螢幕一排 {{ COLS }} 格，照這裡的位置放，空的格子收銀台也會空著（小螢幕只照順序排）。
      </span>
    </div>
    <div class="flex flex-wrap items-center gap-2 mb-3 text-xs">
      <span class="text-gray-500">{{ selected ? `已選「${selectedName}」：點一個格子放過去（有品項就互換）` : '點品項選起來，再點要放的格子；電腦也可以直接拖' }}</span>
      <button v-if="selected" @click="selected = null" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">取消選取</button>
      <button v-if="selected && cellOf(selected)" @click="place(selected, 0)" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">移出格子</button>
      <span class="flex-1"></span>
      <button @click="compact" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">照目前順序排滿（去掉空格）</button>
      <button v-if="placedCount" @click="clearAll" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">全部清掉（改回自動排）</button>
    </div>
    <!-- 固定留一行高，訊息出現 / 消失時格子不會跳 -->
    <p class="text-xs mb-2 min-h-[1rem]" :class="msgErr ? 'text-red-600' : 'text-blue-600'">{{ msg }}</p>

    <!-- 格子：固定 COLS 欄 -->
    <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }">
      <div v-for="n in rows * COLS" :key="n"
           class="relative h-20 rounded-lg border transition-colors"
           :class="cellClass(n)"
           @click="clickCell(n)"
           @dragover.prevent
           @drop.prevent="dropCell(n)">
        <span class="absolute top-0.5 left-1 text-[10px] text-gray-300 pointer-events-none">{{ n }}</span>
        <div v-if="grid[n]"
             draggable="true"
             @dragstart="dragId = grid[n]!.id"
             class="absolute inset-0 flex flex-col items-center justify-center px-1 text-center cursor-pointer select-none">
          <span class="text-xl leading-none">{{ grid[n]!.emoji || grid[n]!.name.slice(0, 1) }}</span>
          <span class="mt-1 text-xs leading-tight line-clamp-2 text-gray-800">{{ grid[n]!.name }}</span>
        </div>
      </div>
    </div>

    <!-- 還沒排的：收銀台接在排好的後面 -->
    <div class="mt-5">
      <div class="text-sm font-semibold text-gray-600 mb-2">還沒排位置（{{ unplaced.length }}）<span class="font-normal text-xs text-gray-400 ml-1">收銀台會接在排好的後面</span></div>
      <div v-if="unplaced.length" class="flex flex-wrap gap-1.5"
           @dragover.prevent @drop.prevent="dragId && place(dragId, 0)">
        <button v-for="p in unplaced" :key="p.id"
                draggable="true" @dragstart="dragId = p.id"
                @click="selected = selected === p.id ? null : p.id"
                class="px-2.5 py-1.5 rounded-lg border text-xs"
                :class="selected === p.id ? 'border-green-600 ring-1 ring-green-600 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'">
          {{ p.emoji ? p.emoji + ' ' : '' }}{{ p.name }} <span class="text-gray-400">ID {{ p.id }}</span>
        </button>
      </div>
      <p v-else class="text-xs text-gray-400">都排好了</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/composables/usePosStore'

const props = defineProps<{ category: string }>()
const COLS = 6

const { products } = usePosStore()
const cat = useCatalog()

const selected = ref<number | null>(null)
const dragId = ref<number | null>(null)
const busy = ref(false)
const msg = ref('')
const msgErr = ref(false)

const bySort = (a: Product, b: Product) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id
const list = computed(() => products.value.filter(p => !p.inactive && (p.category || '') === props.category).sort(bySort))
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
const rows = computed(() => Math.max(2, Math.ceil(Math.max(maxCell.value, list.value.length) / COLS) + 1))
const selectedName = computed(() => list.value.find(p => p.id === selected.value)?.name || '')

function cellClass(n: number) {
  const p = grid.value[n]
  if (p && p.id === selected.value) return 'border-green-600 ring-1 ring-green-600 bg-green-50'
  if (p) return 'border-gray-200 bg-white hover:border-green-500'
  return selected.value ? 'border-dashed border-green-400 bg-green-50/30 hover:bg-green-50 cursor-pointer' : 'border-dashed border-gray-200'
}

function clickCell(n: number) {
  const p = grid.value[n]
  if (selected.value && (!p || p.id !== selected.value)) { place(selected.value, n); return }
  selected.value = p ? (selected.value === p.id ? null : p.id) : null
}
function dropCell(n: number) {
  if (dragId.value) place(dragId.value, n)
  dragId.value = null
}

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
  dragId.value = null
  const from = grid.value[cellOf(id)]?.id === id ? cellOf(id) : 0
  if (from === n) { selected.value = null; return }
  const other = n ? grid.value[n] : undefined
  const changes = [{ id, cell: n }]
  if (other && other.id !== id) changes.push({ id: other.id, cell: from })
  selected.value = null
  save(changes, '已儲存')
}

// 排好的照格子順序、沒排的照原本順序，依序填 1、2、3…（去掉中間的空格）
function compact() {
  const ordered = [...Object.keys(grid.value).map(Number).sort((a, b) => a - b).map(k => grid.value[k]!), ...unplaced.value]
  save(ordered.map((p, i) => ({ id: p.id, cell: i + 1 })), '已排滿')
}
function clearAll() {
  if (!confirm(`把「${props.category}」的格子位置全部清掉？收銀台會改回自動一個接一個排。`)) return
  save(list.value.filter(p => (p.cell || 0) > 0).map(p => ({ id: p.id, cell: 0 })), '已清掉')
}
</script>
