<template>
  <!-- 表格放得下就用表格；超過畫面寬度（會出現橫向捲軸）就改用 #cards 插槽的卡片 -->
  <div ref="box">
    <div v-if="!cards" ref="inner" class="overflow-auto" :style="maxHeight ? { maxHeight } : undefined">
      <slot />
    </div>
    <div v-else class="overflow-auto" :style="maxHeight ? { maxHeight } : undefined">
      <slot name="cards" />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** 資料一變（換日期、換來源）就重新量一次寬度 */
  watchKey?: unknown
  maxHeight?: string
}>()

const box = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const cards = ref(false)
let needWidth = 0 // 表格實際需要的寬度：畫面拉寬到這麼寬時再換回表格

async function measure() {
  await nextTick()
  const table = inner.value?.querySelector('table')
  if (!box.value || !table) return
  const need = table.scrollWidth
  if (need > box.value.clientWidth + 1) { needWidth = need; cards.value = true }
}

function onResize() {
  if (!box.value) return
  if (cards.value) {
    if (box.value.clientWidth >= needWidth) { cards.value = false; void measure() }
  } else void measure()
}
// 側欄收合也會改變寬度，所以用 ResizeObserver；舊瀏覽器（XP 的 Mypal）沒有就退回視窗 resize
let ro: ResizeObserver | null = null
onMounted(() => {
  void measure()
  if (typeof ResizeObserver !== 'undefined' && box.value) { ro = new ResizeObserver(onResize); ro.observe(box.value) }
  else window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => { ro?.disconnect(); window.removeEventListener('resize', onResize) })

watch(() => props.watchKey, () => { cards.value = false; void measure() })
</script>
