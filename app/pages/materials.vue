<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">物料庫存</h1>
        <p class="text-xs text-gray-400 mt-0.5">管理原料庫存與入庫紀錄</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
          class="text-sm font-medium px-4 py-2 rounded-xl border transition-colors"
          :class="activeTab === tab.value ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'">
          {{ tab.label }}
        </button>
        <button v-if="activeTab === 'stock'" @click="openAdd"
          class="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增物料
        </button>
      </div>
    </div>

    <!-- 庫存警示 -->
    <div v-if="lowStockItems.length" class="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-3 flex items-center gap-2 shrink-0">
      <span class="text-amber-600">⚠️</span>
      <span class="text-sm text-amber-700 font-medium">庫存不足：</span>
      <span class="text-sm text-amber-700">{{ lowStockItems.map(m => m.name).join('、') }}</span>
    </div>

    <!-- ── 庫存列表 ── -->
    <div v-if="activeTab === 'stock'" class="flex-1 overflow-auto px-4 md:px-6 py-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium">物料名稱</th>
            <th class="text-left pb-3 font-medium">單位</th>
            <th class="text-left pb-3 font-medium">來源</th>
            <th class="text-right pb-3 font-medium">目前庫存</th>
            <th class="text-right pb-3 font-medium">警示數量</th>
            <th class="text-left pb-3 font-medium pl-4">狀態</th>
            <th class="text-right pb-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mat in materials" :key="mat.id"
            class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            :class="mat.stock <= mat.alertStock ? 'bg-amber-50/40' : ''">
            <td class="py-3 font-medium text-gray-900">{{ mat.name }}</td>
            <td class="py-3 text-gray-500">{{ mat.unit }}</td>
            <td class="py-3">
              <span v-if="mat.source" class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="mat.source === '農莊烘焙' ? 'bg-green-100 text-green-700' : mat.source === '合作商' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                {{ mat.source }}
              </span>
              <span v-else class="text-gray-300 text-xs">—</span>
            </td>
            <td class="py-3 text-right font-bold" :class="mat.stock <= mat.alertStock ? 'text-amber-600' : 'text-gray-900'">{{ mat.stock }}</td>
            <td class="py-3 text-right text-gray-400">{{ mat.alertStock }}</td>
            <td class="py-3 pl-4">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                :class="mat.stock <= 0 ? 'bg-red-100 text-red-600' : mat.stock <= mat.alertStock ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">
                {{ mat.stock <= 0 ? '缺貨' : mat.stock <= mat.alertStock ? '庫存不足' : '正常' }}
              </span>
            </td>
            <td class="py-3 text-right">
              <button @click="openEdit(mat)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
              <button @click="deleteMaterial(mat.id)" class="text-xs text-red-400 hover:underline">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── 入庫作業：左日曆 + 右表單 ── -->
    <div v-if="activeTab === 'stockin'" class="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row gap-0">

      <!-- 左：日曆 -->
      <div class="w-full md:w-72 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex flex-col shrink-0 p-4 md:overflow-y-auto">
        <!-- 月份導航 -->
        <div class="flex items-center justify-between mb-3">
          <button @click="prevMonth" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-sm">‹</button>
          <span class="text-sm font-semibold text-gray-800">{{ calTitle }}</span>
          <button @click="nextMonth" class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 text-sm">›</button>
        </div>
        <!-- 星期標頭 -->
        <div class="grid grid-cols-7 mb-1">
          <div v-for="d in ['日','一','二','三','四','五','六']" :key="d"
            class="text-center text-xs text-gray-400 py-1 font-medium">{{ d }}</div>
        </div>
        <!-- 日期格 -->
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
            <!-- 有入庫紀錄的點 -->
            <span v-if="cell.inMonth && stockInDates.has(cell.dateStr) && cell.dateStr !== selectedDateStr"
              class="absolute bottom-1 w-1 h-1 rounded-full bg-green-500"></span>
          </div>
        </div>
        <!-- 今天按鈕 -->
        <button @click="selectDate(todayStr)" class="mt-3 text-xs text-green-600 hover:underline text-center">回到今天</button>
      </div>

      <!-- 右：表單 + 當日紀錄 -->
      <div class="flex-1 md:overflow-y-auto flex flex-col">

        <!-- 選定日期標題 -->
        <div class="px-4 md:px-6 py-4 border-b border-gray-100 bg-white shrink-0">
          <div class="text-base font-semibold text-gray-800">{{ selectedDateLabel }}</div>
          <div class="text-xs text-gray-400 mt-0.5">{{ dayLogs.length ? `已有 ${dayLogs.length} 筆入庫` : '尚無入庫紀錄' }}</div>
        </div>

        <div class="flex-1 p-6 space-y-6">

          <!-- 新增入庫表單 -->
          <div class="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">新增入庫</h3>
            <div class="space-y-3">
              <!-- 時間（只有時分，日期已從日曆決定） -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">時間</label>
                  <input v-model="siTime" type="time"
                    style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111;">
                </div>
                <div>
                  <label class="text-xs text-gray-500 mb-1 block">物料 *</label>
                  <select v-model.number="siMaterialId"
                    style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
                    <option :value="0" disabled>請選擇</option>
                    <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}（{{ m.stock }}{{ m.unit }}）</option>
                  </select>
                </div>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">入庫數量 *</label>
                <div class="flex items-center gap-3">
                  <button @click="siQty = Math.max(1, siQty - 1)"
                    class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-100 shrink-0">−</button>
                  <input v-model.number="siQty" type="number" min="1"
                    style="flex:1; text-align:center; border:1px solid #e5e7eb; border-radius:10px; padding:8px; font-size:20px; font-weight:700; outline:none;">
                  <button @click="siQty++"
                    class="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-lg hover:bg-gray-100 shrink-0">＋</button>
                </div>
              </div>
              <!-- 自動帶入物料來源 -->
              <div v-if="siMaterialId && selectedMaterial?.source" class="flex items-center gap-2">
                <span class="text-xs text-gray-500">來源：</span>
                <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                  :class="selectedMaterial.source === '農莊烘焙' ? 'bg-green-100 text-green-700' : selectedMaterial.source === '合作商' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                  {{ selectedMaterial.source }}
                </span>
                <span class="text-xs text-gray-400">（依物料設定自動帶入）</span>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">備註</label>
                <input v-model="siNote" type="text" placeholder="例：本週烘焙量"
                  style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111;">
              </div>
              <div v-if="siMaterialId" class="bg-green-50 rounded-xl p-3 text-sm text-green-700">
                入庫後庫存：<span class="font-bold">{{ (materials.find(m=>m.id===siMaterialId)?.stock ?? 0) + siQty }}</span>
                {{ materials.find(m=>m.id===siMaterialId)?.unit }}
              </div>
              <button @click="submitStockIn"
                :disabled="!siMaterialId || siQty < 1"
                class="w-full py-2.5 rounded-xl font-semibold text-sm transition-colors"
                :class="siMaterialId && siQty >= 1 ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
                確認入庫
              </button>
            </div>
          </div>

          <!-- 當日已入庫 -->
          <div v-if="dayLogs.length" class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-100">
              <h3 class="text-sm font-semibold text-gray-700">{{ selectedDateLabel }} 入庫紀錄</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
                    <th class="text-left px-5 py-2.5 font-medium">時間</th>
                    <th class="text-left px-3 py-2.5 font-medium">物料</th>
                    <th class="text-right px-3 py-2.5 font-medium">數量</th>
                    <th class="text-left px-3 py-2.5 font-medium">來源</th>
                    <th class="text-left px-5 py-2.5 font-medium">備註</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in dayLogs" :key="log.id" class="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td class="px-5 py-3 text-gray-500 text-xs">{{ formatTime(log.createdAt) }}</td>
                    <td class="px-3 py-3 font-medium text-gray-900">{{ log.materialName }}</td>
                    <td class="px-3 py-3 text-right font-bold text-green-700">+{{ log.quantity }}</td>
                    <td class="px-3 py-3 text-xs">
                      <span v-if="log.source" class="px-2 py-0.5 rounded-full text-xs font-medium"
                        :class="log.source === '農莊烘焙' ? 'bg-green-100 text-green-700' : log.source === '合作商' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                        {{ log.source }}
                      </span>
                      <span v-else class="text-gray-300">—</span>
                    </td>
                    <td class="px-5 py-3 text-gray-400 text-xs">{{ log.note || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- ── 入庫紀錄 ── -->
    <div v-if="activeTab === 'log'" class="flex-1 overflow-auto px-4 md:px-6 py-4">
      <div class="flex gap-3 mb-4 items-center flex-wrap">
        <span class="text-xs text-gray-400">物料：</span>
        <select v-model.number="logFilter"
          style="border:1px solid #e5e7eb; border-radius:8px; padding:5px 10px; font-size:13px; outline:none; color:#111; background:#fff;">
          <option :value="0">全部</option>
          <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
        <span class="text-xs text-gray-400 ml-2">來源：</span>
        <select v-model="logSourceFilter"
          style="border:1px solid #e5e7eb; border-radius:8px; padding:5px 10px; font-size:13px; outline:none; color:#111; background:#fff;">
          <option value="">全部</option>
          <option v-for="s in allSources" :key="s" :value="s">{{ s }}</option>
        </select>
        <span class="text-xs text-gray-400 ml-auto">共 {{ filteredLogs.length }} 筆</span>
      </div>
      <div v-if="!filteredLogs.length" class="py-20 text-center text-gray-300 text-sm">尚無入庫紀錄</div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium">入庫時間</th>
            <th class="text-left pb-3 font-medium">物料名稱</th>
            <th class="text-right pb-3 font-medium">入庫數量</th>
            <th class="text-left pb-3 font-medium pl-4">來源</th>
            <th class="text-left pb-3 font-medium pl-4">備註</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="si in filteredLogs" :key="si.id" class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-3 text-gray-500 text-xs">{{ formatDatetime(si.createdAt) }}</td>
            <td class="py-3 font-medium text-gray-900">{{ si.materialName }}</td>
            <td class="py-3 text-right font-bold text-green-700">+{{ si.quantity }}</td>
            <td class="py-3 pl-4">
              <span v-if="si.source" class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="si.source === '農莊烘焙' ? 'bg-green-100 text-green-700' : si.source === '合作商' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'">
                {{ si.source }}
              </span>
              <span v-else class="text-gray-300 text-xs">—</span>
            </td>
            <td class="py-3 pl-4 text-gray-400 text-xs">{{ si.note || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯物料 Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal = false">
      <div class="bg-white rounded-2xl p-7 w-96 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯物料' : '新增物料' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">物料名稱 *</label>
            <input v-model="form.name" type="text" class="ifield" placeholder="例：巧克力餅乾">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">單位 *</label>
              <input v-model="form.unit" type="text" class="ifield" placeholder="例：個、kg、瓶">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">目前庫存</label>
              <input v-model.number="form.stock" type="number" class="ifield" min="0">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-2 block">來源</label>
            <div class="flex gap-2 flex-wrap mb-2">
              <button v-for="s in sourceOptions" :key="s"
                @click="form.source = s"
                class="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                :class="form.source === s ? 'bg-green-50 border-green-500 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'">
                {{ s }}
              </button>
            </div>
            <input v-model="form.source" type="text" class="ifield" placeholder="或自行輸入來源">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">低庫存警示數量</label>
            <input v-model.number="form.alertStock" type="number" class="ifield w-32" min="0">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveMaterial" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Material } from '~/composables/usePosStore'

const { materials, stockIns, addStockIn } = usePosStore()
const cat = useCatalog()

const tabs = [
  { value: 'stock',   label: '庫存列表' },
  { value: 'stockin', label: '入庫作業' },
  { value: 'log',     label: '入庫紀錄' },
]
const activeTab  = ref<'stock' | 'stockin' | 'log'>('stock')
const showModal  = ref(false)
const editId     = ref<number | null>(null)
const logFilter  = ref(0)

// ── 日曆 ──
const today       = new Date()
const todayStr    = today.toISOString().slice(0, 10)
const calYear     = ref(today.getFullYear())
const calMonth    = ref(today.getMonth())          // 0-indexed
const selectedDateStr = ref(todayStr)

const calTitle = computed(() => `${calYear.value} 年 ${calMonth.value + 1} 月`)

function prevMonth() {
  if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 }
  else calMonth.value--
}
function nextMonth() {
  if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 }
  else calMonth.value++
}
function selectDate(d: string) { selectedDateStr.value = d }

// 日曆格子
const calCells = computed(() => {
  const year = calYear.value, month = calMonth.value
  const first = new Date(year, month, 1).getDay()   // 0=Sun
  const days  = new Date(year, month + 1, 0).getDate()
  const cells: { day: number; dateStr: string; inMonth: boolean; isToday: boolean }[] = []
  // 前補
  for (let i = 0; i < first; i++) {
    const d = new Date(year, month, -first + i + 1)
    cells.push({ day: d.getDate(), dateStr: d.toISOString().slice(0, 10), inMonth: false, isToday: false })
  }
  for (let d = 1; d <= days; d++) {
    const ds = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ day: d, dateStr: ds, inMonth: true, isToday: ds === todayStr })
  }
  // 後補到 42 格
  const rem = 42 - cells.length
  for (let i = 1; i <= rem; i++) {
    const d = new Date(year, month + 1, i)
    cells.push({ day: d.getDate(), dateStr: d.toISOString().slice(0, 10), inMonth: false, isToday: false })
  }
  return cells
})

// 有入庫紀錄的日期 Set
const stockInDates = computed(() => {
  const set = new Set<string>()
  stockIns.value.forEach(s => set.add(new Date(s.createdAt).toISOString().slice(0, 10)))
  return set
})

const selectedDateLabel = computed(() => {
  const d = new Date(selectedDateStr.value + 'T00:00:00')
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })
})

// 當天入庫紀錄
const dayLogs = computed(() =>
  stockIns.value.filter(s => new Date(s.createdAt).toISOString().slice(0, 10) === selectedDateStr.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
)

// ── 入庫表單 ──
const nowTime = () => new Date().toTimeString().slice(0, 5)
const siTime       = ref(nowTime())
const siMaterialId = ref(0)
const siQty        = ref(1)
const siNote       = ref('')

const selectedMaterial = computed(() => materials.value.find(m => m.id === siMaterialId.value) ?? null)

watch(activeTab, (v) => { if (v === 'stockin') siTime.value = nowTime() })

function submitStockIn() {
  if (!siMaterialId.value || siQty.value < 1) return
  const dt = new Date(`${selectedDateStr.value}T${siTime.value}:00`)
  addStockIn(siMaterialId.value, siQty.value, siNote.value, dt)
  siMaterialId.value = 0
  siQty.value = 1
  siNote.value = ''
}

// ── 庫存管理 ──
const defaultForm = () => ({ name: '', unit: '', stock: 0, alertStock: 10, source: '' })
const form = ref(defaultForm())
const sourceOptions = ['農莊烘焙', '合作商', '廠商採購', '其他']

const logSourceFilter = ref('')
const allSources = computed(() => [...new Set(stockIns.value.map(s => s.source).filter(Boolean))])

const lowStockItems = computed(() => materials.value.filter(m => m.stock <= m.alertStock && m.stock > 0))
const filteredLogs  = computed(() =>
  stockIns.value.filter(s =>
    (logFilter.value === 0 || s.materialId === logFilter.value) &&
    (!logSourceFilter.value || s.source === logSourceFilter.value)
  )
)

function openAdd() { editId.value = null; form.value = defaultForm(); showModal.value = true }
function openEdit(mat: Material) {
  editId.value = mat.id
  form.value = { name: mat.name, unit: mat.unit, stock: mat.stock, alertStock: mat.alertStock, source: mat.source }
  showModal.value = true
}
// 物料與庫存存在資料機（useCatalog）；連不到時是範例模式，只改畫面
async function saveMaterial() {
  if (!form.value.name || !form.value.unit) return
  try {
    await cat.saveMaterial({ ...form.value, id: editId.value })
    showModal.value = false
  } catch (e) { alert((e as Error).message) }
}
async function deleteMaterial(id: number) {
  if (!confirm('確定刪除此物料？')) return
  try { await cat.deleteMaterial(id) } catch (e) { alert((e as Error).message) }
}
function formatTime(d: Date) {
  return new Date(d).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
function formatDatetime(d: Date) {
  return new Date(d).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield {
  @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-900;
}
</style>
