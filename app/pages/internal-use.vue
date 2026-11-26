<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">內部領用</h1>
        <p class="text-xs text-gray-400 mt-0.5">直接扣庫存，不走收銀流程（例：餐廳內用麵包）</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
          class="text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
          :class="activeTab === tab.value ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'">
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ── 領用作業：左日曆 + 右表單 ── -->
    <div v-if="activeTab === 'form'" class="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">

      <!-- 左：日曆 -->
      <div class="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col shrink-0 p-4 md:overflow-y-auto">
        <div class="flex items-center justify-between mb-3">
          <button @click="prevMonth" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-sm">‹</button>
          <span class="text-sm font-semibold text-gray-800">{{ calTitle }}</span>
          <button @click="nextMonth" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-sm">›</button>
        </div>
        <div class="grid grid-cols-7 mb-1">
          <div v-for="d in ['日','一','二','三','四','五','六']" :key="d"
            class="text-center text-xs text-gray-400 py-1 font-medium">{{ d }}</div>
        </div>
        <div class="grid grid-cols-7 gap-y-0.5">
          <div v-for="(cell, i) in calCells" :key="i"
            class="aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors relative text-sm"
            :class="[
              !cell.inMonth ? 'text-gray-300' : 'text-gray-700',
              cell.dateStr === selectedDateStr ? 'bg-green-700 text-white font-bold' : cell.inMonth ? 'hover:bg-green-50' : '',
              cell.isToday && cell.dateStr !== selectedDateStr ? 'ring-2 ring-green-400 ring-inset' : '',
            ]"
            @click="selectDate(cell.dateStr)"
          >
            {{ cell.day }}
            <span v-if="cell.inMonth && useDates.has(cell.dateStr) && cell.dateStr !== selectedDateStr"
              class="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500"></span>
          </div>
        </div>
        <button @click="selectDate(todayStr)" class="mt-3 text-xs text-green-600 hover:underline text-center">回到今天</button>
      </div>

      <!-- 右：表單 + 當日紀錄 -->
      <div class="flex-1 md:overflow-y-auto flex flex-col">
        <div class="px-4 md:px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <div class="text-base font-semibold text-gray-800">{{ selectedDateLabel }}</div>
          <div class="text-xs text-gray-400 mt-0.5">{{ dayLogs.length ? `已有 ${dayLogs.length} 筆領用` : '尚無領用紀錄' }}</div>
        </div>

        <div class="flex-1 p-3 md:p-6 space-y-5">

          <!-- 新增領用表單 -->
          <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">新增領用</h3>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">時間</label>
                  <input v-model="siTime" type="time"
                    style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111;">
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">物料 *</label>
                  <select v-model.number="form.materialId"
                    style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
                    <option :value="0" disabled>請選擇</option>
                    <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}（{{ m.stock }}{{ m.unit }}）</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="text-xs text-gray-500 mb-1 block">領用數量 *</label>
                <div class="flex items-center gap-3">
                  <button @click="form.quantity = Math.max(1, form.quantity - 1)"
                    class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-100 shrink-0">−</button>
                  <input v-model.number="form.quantity" type="number" min="1"
                    style="flex:1; text-align:center; border:1px solid #e5e7eb; border-radius:10px; padding:8px; font-size:20px; font-weight:700; outline:none;">
                  <button @click="form.quantity++"
                    class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-100 shrink-0">＋</button>
                </div>
              </div>

              <div>
                <label class="text-xs text-gray-500 mb-2 block">用途 *</label>
                <div class="flex gap-2 flex-wrap mb-2">
                  <button v-for="p in purposePresets" :key="p"
                    @click="form.purpose = p"
                    class="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                    :class="form.purpose === p ? 'bg-amber-50 border-amber-400 text-amber-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'">
                    {{ p }}
                  </button>
                </div>
                <input v-model="form.purpose" type="text" placeholder="或自行輸入用途"
                  style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111;">
              </div>

              <div>
                <label class="text-xs text-gray-500 mb-1 block">領用人</label>
                <input v-model="form.operator" type="text" placeholder="輸入姓名或員工ID"
                  style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111;">
              </div>

              <div v-if="form.materialId" class="bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
                領用後庫存：<span class="font-bold">{{ Math.max(0, (materials.find(m=>m.id===form.materialId)?.stock ?? 0) - form.quantity) }}</span>
                {{ materials.find(m=>m.id===form.materialId)?.unit }}
              </div>

              <button @click="submit" :disabled="!form.materialId || !form.purpose"
                class="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors"
                :class="form.materialId && form.purpose ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
                確認領用
              </button>
            </div>
          </div>

          <!-- 當日已領用 -->
          <div v-if="dayLogs.length" class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100">
              <h3 class="text-sm font-semibold text-gray-700">{{ selectedDateLabel }} 領用紀錄</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    <th class="text-left px-5 py-2.5 font-medium">時間</th>
                    <th class="text-left px-3 py-2.5 font-medium">物料</th>
                    <th class="text-right px-3 py-2.5 font-medium">數量</th>
                    <th class="text-left px-5 py-2.5 font-medium">用途</th>
                    <th class="text-left px-5 py-2.5 font-medium">領用人</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in dayLogs" :key="log.id" class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td class="px-5 py-3 text-gray-500 text-xs">{{ formatTime(log.createdAt) }}</td>
                    <td class="px-3 py-3 font-medium text-gray-900">{{ log.materialName }}</td>
                    <td class="px-3 py-3 text-right font-bold text-amber-600">-{{ log.quantity }}</td>
                    <td class="px-5 py-3 text-gray-600 text-xs">{{ log.purpose }}</td>
                    <td class="px-5 py-3 text-gray-400 text-xs">{{ log.operator || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ── 領用紀錄 ── -->
    <div v-if="activeTab === 'log'" class="flex-1 overflow-auto px-4 md:px-6 py-4">
      <div class="flex gap-3 mb-4 items-center">
        <span class="text-xs text-gray-400">篩選物料：</span>
        <select v-model.number="logFilter"
          style="border:1px solid #e5e7eb; border-radius:8px; padding:5px 10px; font-size:13px; outline:none; color:#111; background:#fff;">
          <option :value="0">全部</option>
          <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <span class="text-xs text-gray-400 ml-auto">共 {{ filteredLogs.length }} 筆</span>
      </div>
      <div v-if="!filteredLogs.length" class="py-20 text-center text-gray-300 text-sm">尚無領用紀錄</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium">時間</th>
            <th class="text-left pb-3 font-medium">物料</th>
            <th class="text-right pb-3 font-medium">數量</th>
            <th class="text-left pb-3 font-medium pl-4">用途</th>
            <th class="text-left pb-3 font-medium pl-4">領用人</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredLogs" :key="u.id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 text-gray-500 text-xs">{{ formatDatetime(u.createdAt) }}</td>
            <td class="py-3 font-medium text-gray-900">{{ u.materialName }}</td>
            <td class="py-3 text-right font-bold text-amber-600">-{{ u.quantity }}</td>
            <td class="py-3 pl-4 text-gray-600 text-xs">{{ u.purpose }}</td>
            <td class="py-3 pl-4 text-gray-400 text-xs">{{ u.operator || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup lang="ts">
const { materials, internalUses, addInternalUse } = usePosStore()

const tabs = [
  { value: 'form', label: '領用作業' },
  { value: 'log',  label: '領用紀錄' },
]
const activeTab = ref<'form' | 'log'>('form')
const logFilter = ref(0)
const purposePresets = ['餐廳內用麵包', '員工餐食', '試吃樣品', '損耗報廢', '活動使用']

// ── 日曆 ──
const today    = new Date()
const todayStr = today.toISOString().slice(0, 10)
const calYear  = ref(today.getFullYear())
const calMonth = ref(today.getMonth())
const selectedDateStr = ref(todayStr)

const calTitle = computed(() => `${calYear.value} 年 ${calMonth.value + 1} 月`)
function prevMonth() { if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 } else calMonth.value-- }
function nextMonth() { if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 } else calMonth.value++ }
function selectDate(d: string) { selectedDateStr.value = d }

const calCells = computed(() => {
  const year = calYear.value, month = calMonth.value
  const first = new Date(year, month, 1).getDay()
  const days  = new Date(year, month + 1, 0).getDate()
  const cells: { day: number; dateStr: string; inMonth: boolean; isToday: boolean }[] = []
  for (let i = 0; i < first; i++) {
    const d = new Date(year, month, -first + i + 1)
    cells.push({ day: d.getDate(), dateStr: d.toISOString().slice(0, 10), inMonth: false, isToday: false })
  }
  for (let d = 1; d <= days; d++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, dateStr: ds, inMonth: true, isToday: ds === todayStr })
  }
  const rem = 42 - cells.length
  for (let i = 1; i <= rem; i++) {
    const d = new Date(year, month + 1, i)
    cells.push({ day: d.getDate(), dateStr: d.toISOString().slice(0, 10), inMonth: false, isToday: false })
  }
  return cells
})

const useDates = computed(() => {
  const set = new Set<string>()
  internalUses.value.forEach(u => set.add(new Date(u.createdAt).toISOString().slice(0, 10)))
  return set
})

const selectedDateLabel = computed(() => {
  const d = new Date(selectedDateStr.value + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
})

const dayLogs = computed(() =>
  internalUses.value.filter(u => new Date(u.createdAt).toISOString().slice(0, 10) === selectedDateStr.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
)

// ── 表單 ──
const nowTime = () => new Date().toTimeString().slice(0, 5)
const siTime = ref(nowTime())
const defaultForm = () => ({ materialId: 0, quantity: 1, purpose: '', operator: '' })
const form = ref(defaultForm())

watch(activeTab, v => { if (v === 'form') siTime.value = nowTime() })

function submit() {
  if (!form.value.materialId || !form.value.purpose) return
  const dt = new Date(`${selectedDateStr.value}T${siTime.value}:00`)
  addInternalUse(form.value.materialId, form.value.quantity, form.value.purpose, form.value.operator, dt)
  form.value = defaultForm()
}

const filteredLogs = computed(() =>
  logFilter.value === 0 ? internalUses.value : internalUses.value.filter(u => u.materialId === logFilter.value)
)

function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
function formatDatetime(d: Date) {
  return new Date(d).toLocaleString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
}
</script>
