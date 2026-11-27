<template>
  <div>
    <div class="flex flex-wrap items-center gap-2 mb-2 text-xs">
      <span class="text-gray-500">{{ selected ? `已選「${selectedName}」：點一個格子放過去（有品項就互換）` : `大螢幕一排 ${COLS} 格，空格收銀台也會空著。點品項選起來，再點要放的格子；電腦也可以直接拖` }}</span>
      <button v-if="selected" @click="selected = null" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">取消選取</button>
      <span class="flex-1"></span>
      <button @click="compact" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">去掉空格</button>
      <button v-if="placedCount" @click="clearAll" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">還原自動排</button>
    </div>
    <!-- 固定留一行高，訊息出現 / 消失時格子不會跳 -->
    <p class="text-xs mb-2 min-h-[1rem]" :class="msgErr ? 'text-red-600' : 'text-blue-600'">{{ msg }}</p>

    <!-- 格子：固定 COLS 欄；卡片跟收銀台的一模一樣（大小、圖片 4:3、品名、價錢），空格子用同樣的骨架撐出一樣大小 -->
    <div class="grid gap-2 md:gap-2.5" :style="{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }">
      <div v-for="n in rows * COLS" :key="n"
           class="relative flex flex-col justify-start text-left border rounded-xl p-2.5 md:p-3 transition-colors select-none"
           :class="cellClass(n)"
           :draggable="!!grid[n]"
           @dragstart="grid[n] && (dragId = grid[n]!.id)"
           @dragend="dragId = null"
           @click="clickCell(n)"
           @dragover.prevent
           @drop.prevent="dropCell(n)">
        <div class="-mx-2.5 -mt-2.5 md:-mx-3 md:-mt-3 mb-2 relative overflow-hidden rounded-t-xl" :class="grid[n] ? 'bg-gray-100' : ''" style="padding-top:75%">
          <template v-if="grid[n]">
            <CatalogImg v-if="grid[n]!.image" :file="grid[n]!.image" :alt="grid[n]!.name" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <span v-if="grid[n]!.emoji" class="text-5xl leading-none">{{ grid[n]!.emoji }}</span>
              <span v-else class="text-4xl font-bold text-gray-300 leading-none">{{ grid[n]!.name.slice(0, 1) }}</span>
            </div>
          </template>
          <span class="absolute top-1 left-1.5 text-[10px] text-gray-400">{{ n }}</span>
        </div>
        <template v-if="grid[n]">
          <div class="text-sm font-medium text-gray-900 leading-snug mb-1.5">{{ grid[n]!.name }}</div>
          <div v-if="grid[n]!.openPrice" class="text-base font-bold text-orange-600">✏️ 時價</div>
          <div v-else class="text-base font-bold text-green-700">${{ grid[n]!.price }}</div>
        </template>
        <template v-else>
          <div class="text-sm leading-snug mb-1.5 invisible">空</div>
          <div class="text-base invisible">空</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ category: string }>()
const COLS = LAYOUT_COLS

const dragId = ref<number | null>(null)
const { selected, busy, msg, msgErr, grid, placedCount, rows, selectedName, place: placeRaw, clickCell, compact, clearAll } = useLayoutEdit(() => props.category)

function place(id: number, n: number) { dragId.value = null; placeRaw(id, n) }
function dropCell(n: number) {
  if (dragId.value) place(dragId.value, n)
  dragId.value = null
}
// 拖動或已選品項時：可以放的格子（空格、可以互換的品項）都顯示綠色虛線框
function cellClass(n: number) {
  const p = grid.value[n]
  const moving = dragId.value || selected.value
  if (p && p.id === moving) return dragId.value ? 'opacity-40 border-gray-200 bg-white' : 'border-green-600 ring-1 ring-green-600 bg-green-50'
  if (p) return moving ? 'border-dashed border-green-400 bg-white cursor-pointer' : 'border-gray-200 bg-white hover:border-green-500 cursor-pointer'
  return moving ? 'border-dashed border-green-400 bg-green-50/30 hover:bg-green-50 cursor-pointer' : 'border-dashed border-gray-200'
}
</script>
