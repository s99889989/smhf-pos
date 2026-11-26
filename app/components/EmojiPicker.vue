<template>
  <span class="inline-flex shrink-0">
    <button ref="btn" type="button" @click="toggle" :title="modelValue ? '換 emoji' : '選 emoji'"
            class="w-10 h-9 flex items-center justify-center border border-gray-200 rounded-lg bg-white hover:bg-gray-50 leading-none whitespace-nowrap"
            :class="modelValue ? 'text-xl' : 'text-xs text-gray-400'">
      {{ modelValue || '☺＋' }}
    </button>
    <Teleport to="body">
      <!-- 放在 body 最上層、z-index 用 inline style 壓過品項/分類對話框（z-50） -->
      <div v-if="open" style="position:fixed; top:0; right:0; bottom:0; left:0; z-index:9998" @click="open = false"></div>
      <div v-if="open" ref="panel" class="bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col overflow-hidden"
           :style="panelStyle" @click.stop>
        <!-- 分類頁籤（參考 piliapp emoji 列表的分法） -->
        <div class="flex gap-1 px-2 pt-2 pb-1.5 border-b border-gray-100 flex-wrap shrink-0">
          <button v-for="g in EMOJI_GROUPS" :key="g.key" type="button" @click="tab = g.key"
                  class="shrink-0 whitespace-nowrap px-2 py-1 rounded-lg text-xs"
                  :class="tab === g.key ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'"
                  :title="g.name">
            <span class="text-base leading-none">{{ g.icon }}</span> {{ g.name }}
          </button>
        </div>
        <div ref="grid" class="overflow-y-auto p-2" style="flex:1 1 auto; min-height:0">
          <div class="flex flex-wrap gap-0.5">
            <button v-for="e in curList" :key="e" type="button" @click="pick(e)"
                    class="emoji-cell" :class="e === modelValue ? 'bg-green-100' : 'hover:bg-gray-100'">{{ e }}</button>
          </div>
        </div>
        <div class="flex gap-1.5 items-center px-3 py-2 border-t border-gray-100 shrink-0">
          <span v-if="modelValue" class="text-2xl leading-none" title="目前的 emoji">{{ modelValue }}</span>
          <input v-model="custom" type="text" maxlength="16" placeholder="或貼上其他 emoji"
                 class="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white text-gray-900"
                 style="min-width:0" @keyup.enter="pick(custom.trim())">
          <button type="button" @click="pick(custom.trim())" :disabled="!custom.trim()"
                  class="text-xs text-green-600 hover:underline whitespace-nowrap disabled:opacity-40">用這個</button>
          <button type="button" @click="pick('')" class="text-xs text-red-400 hover:underline whitespace-nowrap">清除</button>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<script setup lang="ts">
// 分類、站別、品項的小圖示。XP 沒有 emoji 鍵盤，所以給一盤分類好的 emoji 直接點；也可貼上別的。
// 清單在 utils/emojiList.ts（只收 Emoji 11 以前的字，XP 的 Mypal 才顯示得出來）
import { EMOJI_GROUPS } from '~/utils/emojiList'

const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: string] }>()

const open = ref(false)
const custom = ref('')
const tab = ref(EMOJI_GROUPS[0]!.key)
const curList = computed(() => EMOJI_GROUPS.find(g => g.key === tab.value)?.list ?? [])
const btn = ref<HTMLElement | null>(null)
const grid = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})
watch(tab, () => { if (grid.value) grid.value.scrollTop = 0 })

function toggle() {
  if (open.value) { open.value = false; return }
  custom.value = ''
  // 打開時跳到目前 emoji 所在的頁籤
  const cur = props.modelValue
  if (cur) tab.value = (EMOJI_GROUPS.find(g => g.list.includes(cur)) ?? EMOJI_GROUPS.find(g => g.key === tab.value))!.key
  const r = btn.value!.getBoundingClientRect()
  const vw = window.innerWidth, vh = window.innerHeight
  const h = Math.min(540, vh - 16)
  const style: Record<string, string> = { position: 'fixed', zIndex: '9999', height: h + 'px' }
  if (r.left - 16 >= 360) {
    // 左邊夠寬（電腦、平板）：在按鈕左邊展開，蓋住對話框左半，上下置中對齊按鈕
    const w = Math.min(560, r.left - 16)
    style.width = w + 'px'
    style.left = (r.left - 8 - w) + 'px'
    style.top = Math.max(8, Math.min(r.top + r.height / 2 - h / 2, vh - h - 8)) + 'px'
  } else {
    // 手機等窄畫面：用整個寬度，往空間比較大的那邊（上或下）開
    const w = Math.min(560, vw - 16)
    style.width = w + 'px'
    style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px'
    const below = vh - r.bottom - 12, above = r.top - 12
    if (below >= above) { style.top = (r.bottom + 4) + 'px'; style.height = Math.max(240, Math.min(h, below)) + 'px' }
    else { style.bottom = (vh - r.top + 4) + 'px'; style.height = Math.max(240, Math.min(h, above)) + 'px' }
  }
  panelStyle.value = style
  open.value = true
}

// 對話框捲動或視窗大小改變時，選盤位置會跑掉：直接關掉（選盤自己裡面捲動不算）
const panel = ref<HTMLElement | null>(null)
function close(e?: Event) {
  if (e && e.type === 'scroll' && panel.value && e.target instanceof Node && panel.value.contains(e.target)) return
  open.value = false
}
watch(open, (v) => {
  if (v) { window.addEventListener('scroll', close, true); window.addEventListener('resize', close) }
  else { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close) }
})
onBeforeUnmount(() => close())
function pick(e: string) {
  emit('update:modelValue', e)
  open.value = false
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.emoji-cell {
  @apply w-10 h-10 flex items-center justify-center rounded-lg text-2xl leading-none;
}
</style>
