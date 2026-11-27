<template>
  <div>
    <div class="flex flex-wrap items-center gap-2 mb-2 text-xs">
      <span class="text-gray-500">{{ selected ? `已選「${selectedName}」：點一個格子放過去（有品項就互換）` : `大螢幕一排 ${COLS} 格，空格收銀台也會空著。點品項選起來，再點要放的格子；也可以直接拖（滑鼠、觸控都可以）` }}</span>
      <button v-if="selected" @click="selected = null" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">取消選取</button>
      <span class="flex-1"></span>
      <button @click="compact" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">去掉空格</button>
      <button v-if="placedCount" @click="clearAll" :disabled="busy" class="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">還原自動排</button>
    </div>
    <!-- 固定留一行高，訊息出現 / 消失時格子不會跳 -->
    <p class="text-xs mb-2 min-h-[1rem]" :class="msgErr ? 'text-red-600' : 'text-blue-600'">{{ msg }}</p>

    <!-- 格子：固定 COLS 欄；卡片跟收銀台的一模一樣（圖片當底圖、品名價錢疊在下面，寬:高 = 5:4），空格子一樣大 -->
    <div class="grid gap-2 md:gap-2.5" :style="{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }">
      <div v-for="n in rows * COLS" :key="n"
           class="relative overflow-hidden text-left border rounded-xl transition-colors select-none"
           :class="[cellClass(n), grid[n] ? 'bg-gray-100' : '']"
           :data-drop="n"
           :style="grid[n] ? 'touch-action:none' : ''"
           @pointerdown="grid[n] && drag.down($event, grid[n]!.id, grid[n]!.name)"
           @click="!drag.justDragged() && clickCell(n)">
        <div style="padding-top:80%"></div>
        <template v-if="grid[n]">
          <CatalogImg v-if="grid[n]!.image" :file="grid[n]!.image" :alt="grid[n]!.name" class="absolute inset-0 w-full h-full object-cover pointer-events-none" />
          <div v-else class="absolute inset-x-0 top-0 bottom-8 flex items-center justify-center pointer-events-none">
            <span v-if="grid[n]!.emoji" class="text-4xl xl:text-5xl leading-none">{{ grid[n]!.emoji }}</span>
            <span v-else class="text-3xl xl:text-4xl font-bold text-gray-300 leading-none">{{ grid[n]!.name.slice(0, 1) }}</span>
          </div>
          <div class="absolute inset-x-0 bottom-0 px-2 xl:px-2.5 pt-5 pb-1.5 xl:pb-2 pointer-events-none" style="background:linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.55) 65%, rgba(0,0,0,0)); color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.7)">
            <div class="text-xs xl:text-sm font-semibold leading-tight line-clamp-2">{{ grid[n]!.name }}</div>
            <div v-if="grid[n]!.openPrice" class="text-sm xl:text-base font-bold mt-0.5" style="color:#fdba74">✏️ 時價</div>
            <div v-else class="text-sm xl:text-base font-bold mt-0.5" style="color:#86efac">${{ grid[n]!.price }}</div>
          </div>
        </template>
        <span class="absolute top-1 left-1.5 text-[10px] pointer-events-none" :class="grid[n] ? 'text-white' : 'text-gray-400'" :style="grid[n] ? 'text-shadow:0 1px 2px rgba(0,0,0,.8)' : ''">{{ n }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ category: string }>()
const COLS = LAYOUT_COLS

const { selected, busy, msg, msgErr, grid, placedCount, rows, selectedName, place: placeRaw, clickCell, compact, clearAll } = useLayoutEdit(() => props.category)

// 拖到第 n 格放開：放過去（有品項就互換）
const drag = usePointerDrag<number>((id, target) => placeRaw(id, Number(target)))
const dragId = drag.dragging
// 拖動或已選品項時：可以放的格子（空格、可以互換的品項）都顯示綠色虛線框
function cellClass(n: number) {
  const p = grid.value[n]
  const moving = dragId.value || selected.value
  if (p && p.id === moving) return dragId.value ? 'opacity-40 border-gray-200' : 'border-green-600 ring-1 ring-green-600 bg-green-50'
  if (p) return moving ? 'border-dashed border-green-400 cursor-pointer' : 'border-gray-200 hover:border-green-500 cursor-pointer'
  return moving ? 'border-dashed border-green-400 bg-green-50/30 hover:bg-green-50 cursor-pointer' : 'border-dashed border-gray-200'
}
</script>
