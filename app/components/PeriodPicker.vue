<template>
  <!-- 日期 / 月份選擇：跟頁頭的切換鈕同一種外觀（圓角框、綠色選中），不用瀏覽器原生的日期框 -->
  <div ref="root" class="relative">
    <div class="flex items-stretch border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button class="px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30" :disabled="!canPrev" title="上一個" @click="step(-1)">‹</button>
      <button class="px-3 py-2 text-sm font-medium text-gray-800 border-x border-gray-200 hover:bg-gray-50 min-w-[9.5rem] tabular-nums" @click="toggle">
        {{ label }}
      </button>
      <button class="px-2.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30" :disabled="!canNext" title="下一個" @click="step(1)">›</button>
    </div>

    <div v-if="open" class="absolute right-0 mt-2 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72">
      <!-- 標頭：每日看月份、月報看年份 -->
      <div class="flex items-center justify-between mb-2">
        <button class="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-50" @click="shiftView(-1)">‹</button>
        <span class="text-sm font-semibold text-gray-800">{{ mode === 'daily' ? `${viewY} 年 ${viewM} 月` : `${viewY} 年` }}</span>
        <button class="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30" :disabled="!canViewNext" @click="shiftView(1)">›</button>
      </div>

      <template v-if="mode === 'daily'">
        <div class="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
          <span v-for="w in WEEK" :key="w">{{ w }}</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <span v-for="n in lead" :key="'b' + n" />
          <button
            v-for="d in daysInView" :key="d"
            class="h-8 rounded-lg text-sm tabular-nums transition-colors disabled:opacity-25"
            :class="ymd(viewY, viewM, d) === date ? 'bg-green-700 text-white font-semibold'
              : ymd(viewY, viewM, d) === today ? 'text-green-700 font-semibold hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'"
            :disabled="ymd(viewY, viewM, d) > today"
            @click="pickDay(d)"
          >{{ d }}</button>
        </div>
        <div class="mt-2 flex justify-end">
          <button class="text-xs text-green-700 hover:underline" @click="pickToday">今天</button>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-4 gap-1.5">
          <button
            v-for="m in 12" :key="m"
            class="h-9 rounded-lg text-sm transition-colors disabled:opacity-25"
            :class="ym(viewY, m) === month ? 'bg-green-700 text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'"
            :disabled="ym(viewY, m) > thisMonth"
            @click="pickMonth(m)"
          >{{ m }} 月</button>
        </div>
        <div class="mt-2 flex justify-end">
          <button class="text-xs text-green-700 hover:underline" @click="pickThisMonth">本月</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ mode: 'daily' | 'monthly' }>()
const date = defineModel<string>('date', { required: true }) // yyyy-MM-dd
const month = defineModel<string>('month', { required: true }) // yyyy-MM

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const pad2 = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`
const ym = (y: number, m: number) => `${y}-${pad2(m)}`
const now = new Date()
const today = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate())
const thisMonth = today.slice(0, 7)
const MIN = '2015-01' // 葆光舊資料最早大概到這裡，往前不給選

const label = computed(() => {
  if (props.mode === 'monthly') { const [y, m] = month.value.split('-'); return `${y} 年 ${m} 月` }
  const [y, m, d] = date.value.split('-').map(Number)
  return `${y}/${pad2(m!)}/${pad2(d!)}（${WEEK[new Date(y!, m! - 1, d!).getDay()]}）`
})

// 左右箭頭：每日 ±1 天、月報 ±1 月
function addDays(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number)
  const t = new Date(y!, m! - 1, d! + n)
  return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate())
}
function addMonths(s: string, n: number) {
  const [y, m] = s.split('-').map(Number)
  const t = new Date(y!, m! - 1 + n, 1)
  return ym(t.getFullYear(), t.getMonth() + 1)
}
const canPrev = computed(() => props.mode === 'daily' ? date.value.slice(0, 7) >= MIN : month.value > MIN)
const canNext = computed(() => props.mode === 'daily' ? date.value < today : month.value < thisMonth)
function step(n: number) {
  if (props.mode === 'daily') date.value = addDays(date.value, n)
  else month.value = addMonths(month.value, n)
  open.value = false
}

// 下拉面板
const open = ref(false)
const viewY = ref(now.getFullYear())
const viewM = ref(now.getMonth() + 1)
function toggle() {
  if (!open.value) {
    const [y, m] = (props.mode === 'daily' ? date.value : month.value + '-01').split('-').map(Number)
    viewY.value = y!; viewM.value = m!
  }
  open.value = !open.value
}
const lead = computed(() => new Date(viewY.value, viewM.value - 1, 1).getDay())
const daysInView = computed(() => new Date(viewY.value, viewM.value, 0).getDate())
const canViewNext = computed(() => props.mode === 'daily' ? ym(viewY.value, viewM.value) < thisMonth : viewY.value < now.getFullYear())
function shiftView(n: number) {
  if (props.mode === 'monthly') { viewY.value += n; return }
  const t = new Date(viewY.value, viewM.value - 1 + n, 1)
  viewY.value = t.getFullYear(); viewM.value = t.getMonth() + 1
}
function pickDay(d: number) { date.value = ymd(viewY.value, viewM.value, d); open.value = false }
function pickToday() { date.value = today; open.value = false }
function pickMonth(m: number) { month.value = ym(viewY.value, m); open.value = false }
function pickThisMonth() { month.value = thisMonth; open.value = false }

// 點外面關閉
const root = ref<HTMLElement | null>(null)
function onDoc(e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
onMounted(() => document.addEventListener('mousedown', onDoc))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDoc))
watch(() => props.mode, () => { open.value = false })
</script>
