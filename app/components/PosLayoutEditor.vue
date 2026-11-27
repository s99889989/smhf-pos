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
      <!-- 跟收銀台一樣的卡片：上面 4:3 圖片（沒圖放 emoji / 第一個字），下面品名、價錢 -->
      <div v-for="n in rows * COLS" :key="n"
           class="relative rounded-xl border transition-colors overflow-hidden min-h-[8rem]"
           :class="cellClass(n)"
           @click="clickCell(n)"
           @dragover.prevent
           @drop.prevent="dropCell(n)">
        <span class="absolute top-1 left-1.5 z-10 text-[10px] text-gray-400 pointer-events-none">{{ n }}</span>
        <div v-if="grid[n]"
             draggable="true"
             @dragstart="dragId = grid[n]!.id"
             class="flex flex-col cursor-pointer select-none">
          <div class="relative bg-gray-100" style="padding-top:75%">
            <CatalogImg v-if="grid[n]!.image" :file="grid[n]!.image" :alt="grid[n]!.name" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <span v-if="grid[n]!.emoji" class="text-4xl leading-none">{{ grid[n]!.emoji }}</span>
              <span v-else class="text-3xl font-bold text-gray-300 leading-none">{{ grid[n]!.name.slice(0, 1) }}</span>
            </div>
          </div>
          <div class="p-2">
            <div class="text-sm font-medium text-gray-900 leading-snug">{{ grid[n]!.name }}</div>
            <div v-if="grid[n]!.openPrice" class="text-sm font-bold text-orange-600">✏️ 時價</div>
            <div v-else class="text-sm font-bold text-green-700">${{ grid[n]!.price }}</div>
          </div>
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
const props = defineProps<{ category: string }>()
const COLS = LAYOUT_COLS

const dragId = ref<number | null>(null)
const { selected, busy, msg, msgErr, grid, unplaced, placedCount, rows, selectedName, cellOf, place: placeRaw, clickCell, compact, clearAll } = useLayoutEdit(() => props.category)

function place(id: number, n: number) { dragId.value = null; placeRaw(id, n) }
function dropCell(n: number) {
  if (dragId.value) place(dragId.value, n)
  dragId.value = null
}
function cellClass(n: number) {
  const p = grid.value[n]
  if (p && p.id === selected.value) return 'border-green-600 ring-1 ring-green-600 bg-green-50'
  if (p) return 'border-gray-200 bg-white hover:border-green-500'
  return selected.value ? 'border-dashed border-green-400 bg-green-50/30 hover:bg-green-50 cursor-pointer' : 'border-dashed border-gray-200'
}
</script>
