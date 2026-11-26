<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">員工管理</h1>
        <p class="text-xs text-gray-400 mt-0.5">結帳員工折扣時會要求選擇員工；共 {{ employees.length }} 人，在職 {{ activeCount }} 人</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="openImport" class="border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          匯入 Excel
        </button>
        <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增員工
        </button>
      </div>
    </div>

    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- 部門 -->
      <aside class="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white flex md:block overflow-x-auto md:overflow-x-hidden md:overflow-y-auto px-2 md:px-0 py-2 gap-1">
        <button v-for="d in deptTabs" :key="d.key" @click="curDept = d.key"
          class="shrink-0 md:w-full flex items-center justify-between px-3 md:px-4 py-2 text-sm text-left transition-colors rounded-lg md:rounded-none whitespace-nowrap"
          :class="curDept === d.key ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-600 hover:bg-gray-50'">
          <span class="truncate">{{ d.label }}</span>
          <span class="text-xs text-gray-400 ml-2 shrink-0">{{ d.count }}</span>
        </button>
      </aside>

      <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div class="px-4 md:px-6 pt-4 pb-2 flex items-center gap-3 flex-wrap">
          <input v-model="search" type="text" placeholder="搜尋員工編號、姓名"
            class="w-full sm:w-64 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900">
          <label class="flex items-center gap-1.5 text-sm text-gray-500">
            <input v-model="showDisabled" type="checkbox"> 顯示停用的員工
          </label>
          <span class="text-xs text-gray-400">{{ filtered.length }} 人</span>
          <button v-if="curDept !== ALL && curDept !== NONE" @click="renameDept"
            class="ml-auto text-xs text-blue-500 hover:underline">部門改名</button>
        </div>

        <div class="flex-1 overflow-auto px-4 md:px-6 pb-4">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-50">
              <tr class="text-xs text-gray-400 border-b border-gray-200">
                <th class="text-left py-3 font-medium">員工編號</th>
                <th class="text-left py-3 font-medium">姓名</th>
                <th class="text-left py-3 font-medium pl-4">部門</th>
                <th class="text-left py-3 font-medium pl-4">狀態</th>
                <th class="text-left py-3 font-medium pl-4">結帳 PIN</th>
                <th class="text-right py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in filtered" :key="emp.id" class="border-b border-gray-100 hover:bg-gray-50"
                :class="!emp.enabled ? 'opacity-50' : ''">
                <td class="py-3 font-mono font-medium text-gray-900">{{ emp.id }}</td>
                <td class="py-3 text-gray-800">{{ emp.name }}</td>
                <td class="py-3 pl-4 text-gray-500">{{ emp.dept || '—' }}</td>
                <td class="py-3 pl-4">
                  <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                    :class="emp.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
                    {{ emp.enabled ? '在職' : '停用' }}
                  </span>
                </td>
                <td class="py-3 pl-4 text-xs" :class="emp.pinHash ? 'text-green-700' : 'text-gray-400'">{{ emp.pinHash ? '已設定' : '未設定' }}</td>
                <td class="py-3 text-right whitespace-nowrap">
                  <button @click="toggleEnabled(emp)" class="text-xs mr-3"
                    :class="emp.enabled ? 'text-amber-500 hover:underline' : 'text-green-500 hover:underline'">
                    {{ emp.enabled ? '停用' : '啟用' }}
                  </button>
                  <button @click="openEdit(emp)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
                  <button @click="deleteEmp(emp.id)" class="text-xs text-red-400 hover:underline">刪除</button>
                </td>
              </tr>
              <tr v-if="!filtered.length">
                <td colspan="6" class="py-10 text-center text-sm text-gray-400">沒有符合的員工</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 新增 / 編輯 -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯員工' : '新增員工' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">員工編號 *</label>
            <input v-model="form.id" type="text" class="ifield" placeholder="例：F00228" :disabled="!!editId">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
            <input v-model="form.name" type="text" class="ifield" placeholder="例：吳宣澔">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">部門</label>
            <input v-model="form.dept" type="text" list="dept-list" class="ifield" placeholder="選擇或輸入新部門">
            <datalist id="dept-list">
              <option v-for="d in deptNames" :key="d" :value="d" />
            </datalist>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">結帳 PIN（4–6 位數字）{{ editId && hasPin ? '：已設定，留空 = 不變' : '' }}</label>
            <input v-model="form.pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" class="ifield" placeholder="收銀台換人時輸入">
            <label v-if="editId && hasPin" class="flex items-center gap-1.5 text-xs text-gray-500 mt-1.5">
              <input v-model="form.clearPin" type="checkbox"> 清除 PIN（這位員工不能當結帳人）
            </label>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="save" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

    <!-- 匯入 -->
    <div v-if="showImport" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="closeImport">
      <div class="bg-white rounded-2xl p-7 w-[32rem] max-w-[95vw] shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">匯入員工</h3>
        <p class="text-xs text-gray-400 mb-4">
          Excel（.xlsx）或 CSV，第一列是標題，要有「員工編號」「姓名」，可以有「部門」。
          用員工編號比對：已有的員工會更新姓名和部門，PIN、在職狀態不變；沒有的新增為在職。
        </p>

        <input ref="fileInput" type="file" accept=".xlsx,.csv,.txt" class="hidden" @change="onFile">
        <button @click="fileInput?.click()" :disabled="importBusy"
          class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
          {{ importBusy ? '讀取中…' : importFileName ? `重新選擇（目前：${importFileName}）` : '選擇檔案' }}
        </button>
        <p v-if="importError" class="text-sm text-red-600 mt-3">{{ importError }}</p>

        <div v-if="plan" class="mt-4 space-y-3 text-sm">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-xl bg-green-50 py-2"><div class="text-lg font-bold text-green-700">{{ plan.added.length }}</div><div class="text-xs text-gray-500">新增</div></div>
            <div class="rounded-xl bg-blue-50 py-2"><div class="text-lg font-bold text-blue-700">{{ plan.updated.length }}</div><div class="text-xs text-gray-500">更新姓名 / 部門</div></div>
            <div class="rounded-xl bg-gray-50 py-2"><div class="text-lg font-bold text-gray-600">{{ plan.same }}</div><div class="text-xs text-gray-500">不變</div></div>
          </div>
          <p class="text-xs text-gray-500">檔案共 {{ plan.rows }} 人、{{ plan.depts }} 個部門<span v-if="plan.skipped">；{{ plan.skipped }} 列沒有編號或姓名，略過</span><span v-if="plan.dupes">；{{ plan.dupes }} 個編號重複，用最後一列</span>。</p>
          <ul v-if="plan.updated.length" class="max-h-60 overflow-y-auto text-xs text-gray-600 border border-gray-100 rounded-lg p-2 space-y-0.5">
            <li v-for="u in plan.updated.slice(0, 50)" :key="u.id">{{ u.id }} {{ u.from }} → {{ u.to }}</li>
            <li v-if="plan.updated.length > 50" class="text-gray-400">…還有 {{ plan.updated.length - 50 }} 筆</li>
          </ul>
          <label v-if="plan.missing.length" class="flex items-start gap-2 text-sm text-gray-700">
            <input v-model="disableMissing" type="checkbox" class="mt-0.5">
            <span>把名單裡沒有的 {{ plan.missing.length }} 位在職員工改成「停用」（離職）
              <span class="block text-xs text-gray-400">{{ plan.missing.slice(0, 8).map(e => e.name).join('、') }}{{ plan.missing.length > 8 ? '…' : '' }}</span>
            </span>
          </label>
        </div>

        <div class="flex gap-2 mt-6">
          <button @click="closeImport" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="applyImport" :disabled="!plan || !(plan.added.length || plan.updated.length || (disableMissing && plan.missing.length))"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            :class="plan && (plan.added.length || plan.updated.length || (disableMissing && plan.missing.length)) ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            匯入
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Employee } from '~/composables/usePosStore'
import { pinHash, validPin } from '~/composables/useCashier'
import { readSheet } from '~/utils/sheetRead'
const { employees } = usePosStore()

// ---------- 部門 ----------
const ALL = '__all__'
const NONE = '__none__'
const curDept = ref(ALL)
const search = ref('')
const showDisabled = ref(true)

const activeCount = computed(() => employees.value.filter(e => e.enabled).length)
const deptNames = computed(() =>
  [...new Set(employees.value.map(e => (e.dept || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const deptTabs = computed(() => {
  const count = (pred: (e: Employee) => boolean) => employees.value.filter(e => (showDisabled.value || e.enabled) && pred(e)).length
  const tabs = [{ key: ALL, label: '全部部門', count: count(() => true) }]
  for (const d of deptNames.value) tabs.push({ key: d, label: d, count: count(e => (e.dept || '').trim() === d) })
  const none = count(e => !(e.dept || '').trim())
  if (none) tabs.push({ key: NONE, label: '未分部門', count: none })
  return tabs
})
// 選的部門被改名或刪光了：回到全部
watch(deptTabs, tabs => { if (!tabs.some(t => t.key === curDept.value)) curDept.value = ALL })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return employees.value.filter(e => {
    if (!showDisabled.value && !e.enabled) return false
    const d = (e.dept || '').trim()
    if (curDept.value === NONE ? d : curDept.value !== ALL && d !== curDept.value) return false
    return !q || e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
  })
})

function renameDept() {
  const from = curDept.value
  const to = prompt(`「${from}」改名為：`, from)?.trim()
  if (!to || to === from) return
  employees.value = employees.value.map(e => (e.dept || '').trim() === from ? { ...e, dept: to } : e)
  curDept.value = to
}

// ---------- 新增 / 編輯 ----------
const showModal = ref(false)
const editId    = ref<string | null>(null)
const form      = ref({ id: '', name: '', dept: '', pin: '', clearPin: false })
const hasPin    = computed(() => !!employees.value.find(e => e.id === editId.value)?.pinHash)

function openAdd() {
  editId.value = null
  form.value = { id: '', name: '', dept: curDept.value === ALL || curDept.value === NONE ? '' : curDept.value, pin: '', clearPin: false }
  showModal.value = true
}
function openEdit(e: Employee) { editId.value = e.id; form.value = { id: e.id, name: e.name, dept: e.dept || '', pin: '', clearPin: false }; showModal.value = true }
function save() {
  form.value.id = form.value.id.trim()
  if (!form.value.id || !form.value.name.trim()) return
  const pin = form.value.pin.trim()
  const dept = form.value.dept.trim()
  if (pin && !validPin(pin)) { alert('PIN 要是 4–6 位數字'); return }
  if (editId.value) {
    const e = employees.value.find(e => e.id === editId.value)
    if (e) {
      e.name = form.value.name.trim()
      if (dept) e.dept = dept; else delete e.dept
      if (pin) e.pinHash = pinHash(e.id, pin)
      else if (form.value.clearPin) delete e.pinHash
    }
  } else {
    if (employees.value.find(e => e.id === form.value.id)) { alert('編號已存在'); return }
    employees.value.push({
      id: form.value.id, name: form.value.name.trim(), enabled: true,
      ...(dept ? { dept } : {}),
      ...(pin ? { pinHash: pinHash(form.value.id, pin) } : {}),
    })
  }
  showModal.value = false
}
function toggleEnabled(e: Employee) { e.enabled = !e.enabled }
function deleteEmp(id: string) {
  if (!confirm('確定刪除此員工？（離職建議用「停用」，舊交易紀錄才對得上）')) return
  const idx = employees.value.findIndex(e => e.id === id)
  if (idx >= 0) employees.value.splice(idx, 1)
}

// ---------- 匯入 ----------
interface ImportPlan {
  rows: number; depts: number; skipped: number; dupes: number; same: number
  added: Employee[]
  updated: { id: string; from: string; to: string }[]
  incoming: Map<string, { name: string; dept: string }>
  missing: Employee[]
}
const showImport = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importBusy = ref(false)
const importError = ref('')
const importFileName = ref('')
const plan = ref<ImportPlan | null>(null)
const disableMissing = ref(false)

function openImport() { showImport.value = true; plan.value = null; importError.value = ''; importFileName.value = ''; disableMissing.value = false }
function closeImport() { showImport.value = false }

const HEAD_ID = /^(員工)?(編號|代號|工號|ID)$|^員工ID$/i
const HEAD_NAME = /^(員工)?(姓名|名字|名稱)$/
const HEAD_DEPT = /^(部門|單位|組別|所屬部門)$/

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  importBusy.value = true; importError.value = ''; plan.value = null; importFileName.value = file.name
  try {
    const rows = await readSheet(file)
    const headIdx = rows.findIndex(r => r.some(c => HEAD_ID.test(c.trim())) && r.some(c => HEAD_NAME.test(c.trim())))
    if (headIdx < 0) throw new Error('找不到標題列：要有「員工編號」和「姓名」兩欄')
    const head = rows[headIdx]!.map(c => c.trim())
    const ci = head.findIndex(c => HEAD_ID.test(c)), cn = head.findIndex(c => HEAD_NAME.test(c)), cd = head.findIndex(c => HEAD_DEPT.test(c))
    const incoming = new Map<string, { name: string; dept: string }>()
    let skipped = 0, dupes = 0
    for (const r of rows.slice(headIdx + 1)) {
      const id = (r[ci] ?? '').trim(), name = (r[cn] ?? '').trim()
      if (!id || !name) { skipped++; continue }
      if (incoming.has(id)) dupes++
      incoming.set(id, { name, dept: cd >= 0 ? (r[cd] ?? '').trim() : '' })
    }
    if (!incoming.size) throw new Error('檔案裡沒有員工資料')
    const byId = new Map(employees.value.map(e => [e.id, e]))
    const added: Employee[] = [], updated: ImportPlan['updated'] = []
    let same = 0
    for (const [id, v] of incoming) {
      const e = byId.get(id)
      if (!e) { added.push({ id, name: v.name, enabled: true, ...(v.dept ? { dept: v.dept } : {}) }); continue }
      // 檔案沒有部門欄時保留原本的部門
      const newDept = cd >= 0 ? v.dept : (e.dept || '')
      if (e.name === v.name && (e.dept || '') === newDept) { same++; continue }
      const from = [e.name !== v.name ? e.name : '', (e.dept || '') !== newDept ? (e.dept || '未分部門') : ''].filter(Boolean).join(' / ')
      const to = [e.name !== v.name ? v.name : '', (e.dept || '') !== newDept ? (newDept || '未分部門') : ''].filter(Boolean).join(' / ')
      updated.push({ id, from, to })
    }
    if (cd < 0) for (const [id, v] of incoming) v.dept = byId.get(id)?.dept || ''
    plan.value = {
      rows: incoming.size,
      depts: new Set([...incoming.values()].map(v => v.dept).filter(Boolean)).size,
      skipped, dupes, same, added, updated, incoming,
      missing: employees.value.filter(e => e.enabled && !incoming.has(e.id)),
    }
  } catch (e) {
    importError.value = (e as Error).message
  } finally {
    importBusy.value = false
  }
}

function applyImport() {
  const p = plan.value
  if (!p) return
  // 一次換掉整份清單，只會寫回資料機一次
  const next = employees.value.map(e => {
    const v = p.incoming.get(e.id)
    if (v) {
      const n: Employee = { ...e, name: v.name }
      if (v.dept) n.dept = v.dept; else delete n.dept
      return n
    }
    return disableMissing.value && e.enabled ? { ...e, enabled: false } : e
  })
  employees.value = [...next, ...p.added]
  alert(`匯入完成：新增 ${p.added.length} 人、更新 ${p.updated.length} 人${disableMissing.value && p.missing.length ? `、停用 ${p.missing.length} 人` : ''}`)
  showImport.value = false
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
