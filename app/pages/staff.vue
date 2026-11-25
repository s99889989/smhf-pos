<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">員工管理</h1>
        <p class="text-xs text-gray-400 mt-0.5">結帳員工折扣時會要求選擇員工</p>
      </div>
      <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
        ＋ 新增員工
      </button>
    </div>

    <div class="flex-1 overflow-auto px-6 py-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium">員工 ID</th>
            <th class="text-left pb-3 font-medium">姓名</th>
            <th class="text-left pb-3 font-medium pl-4">狀態</th>
            <th class="text-left pb-3 font-medium pl-4">結帳 PIN</th>
            <th class="text-right pb-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in employees" :key="emp.id" class="border-b border-gray-100 hover:bg-gray-50"
            :class="!emp.enabled ? 'opacity-50' : ''">
            <td class="py-3 font-mono font-medium text-gray-900">{{ emp.id }}</td>
            <td class="py-3 text-gray-800">{{ emp.name }}</td>
            <td class="py-3 pl-4">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                :class="emp.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
                {{ emp.enabled ? '在職' : '停用' }}
              </span>
            </td>
            <td class="py-3 pl-4 text-xs" :class="emp.pinHash ? 'text-green-700' : 'text-gray-400'">{{ emp.pinHash ? '已設定' : '未設定' }}</td>
            <td class="py-3 text-right">
              <button @click="toggleEnabled(emp)" class="text-xs mr-3"
                :class="emp.enabled ? 'text-amber-500 hover:underline' : 'text-green-500 hover:underline'">
                {{ emp.enabled ? '停用' : '啟用' }}
              </button>
              <button @click="openEdit(emp)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
              <button @click="deleteEmp(emp.id)" class="text-xs text-red-400 hover:underline">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯員工' : '新增員工' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">員工 ID *</label>
            <input v-model="form.id" type="text" class="ifield" placeholder="例：F00228" :disabled="!!editId">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
            <input v-model="form.name" type="text" class="ifield" placeholder="例：吳宣澔">
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
  </div>
</template>

<script setup lang="ts">
import type { Employee } from '~/composables/usePosStore'
import { pinHash, validPin } from '~/composables/useCashier'
const { employees } = usePosStore()

const showModal = ref(false)
const editId    = ref<string | null>(null)
const form      = ref({ id: '', name: '', pin: '', clearPin: false })
const hasPin    = computed(() => !!employees.value.find(e => e.id === editId.value)?.pinHash)

function openAdd() { editId.value = null; form.value = { id: '', name: '', pin: '', clearPin: false }; showModal.value = true }
function openEdit(e: Employee) { editId.value = e.id; form.value = { id: e.id, name: e.name, pin: '', clearPin: false }; showModal.value = true }
function save() {
  if (!form.value.id || !form.value.name) return
  const pin = form.value.pin.trim()
  if (pin && !validPin(pin)) { alert('PIN 要是 4–6 位數字'); return }
  if (editId.value) {
    const e = employees.value.find(e => e.id === editId.value)
    if (e) {
      e.name = form.value.name
      if (pin) e.pinHash = pinHash(e.id, pin)
      else if (form.value.clearPin) delete e.pinHash
    }
  } else {
    if (employees.value.find(e => e.id === form.value.id)) { alert('ID 已存在'); return }
    employees.value.push({ id: form.value.id, name: form.value.name, enabled: true, ...(pin ? { pinHash: pinHash(form.value.id, pin) } : {}) })
  }
  showModal.value = false
}
function toggleEnabled(e: Employee) { e.enabled = !e.enabled }
function deleteEmp(id: string) {
  if (!confirm('確定刪除此員工？')) return
  const idx = employees.value.findIndex(e => e.id === id)
  if (idx >= 0) employees.value.splice(idx, 1)
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
