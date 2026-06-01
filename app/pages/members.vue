<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <h1 class="text-lg font-bold text-gray-900">會員管理</h1>
      <p class="text-xs text-gray-400 mt-0.5">管理員工、VIP 及 Google 登入帳號</p>
    </div>

    <!-- Tab -->
    <div class="bg-white border-b border-gray-200 px-6 flex gap-1 shrink-0">
      <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.value ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-800'">
        {{ tab.label }}
      </button>
    </div>

    <!-- ── 員工 ── -->
    <div v-if="activeTab === 'staff'" class="flex flex-col flex-1 overflow-hidden">
      <div class="px-6 py-3 flex justify-end shrink-0">
        <button @click="openAddStaff" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增員工
        </button>
      </div>
      <div class="flex-1 overflow-auto px-6 pb-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-400 border-b border-gray-200">
              <th class="text-left pb-3 font-medium">員工 ID</th>
              <th class="text-left pb-3 font-medium">姓名</th>
              <th class="text-left pb-3 font-medium pl-4">狀態</th>
              <th class="text-right pb-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in employees" :key="emp.id" class="border-b border-gray-100 hover:bg-gray-50" :class="!emp.enabled ? 'opacity-50' : ''">
              <td class="py-3 font-mono font-medium text-gray-900">{{ emp.id }}</td>
              <td class="py-3 text-gray-800">{{ emp.name }}</td>
              <td class="py-3 pl-4">
                <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="emp.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'">
                  {{ emp.enabled ? '在職' : '停用' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button @click="toggleStaff(emp)" class="text-xs mr-3" :class="emp.enabled ? 'text-amber-500 hover:underline' : 'text-green-500 hover:underline'">{{ emp.enabled ? '停用' : '啟用' }}</button>
                <button @click="openEditStaff(emp)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
                <button @click="deleteStaff(emp.id)" class="text-xs text-red-400 hover:underline">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── VIP ── -->
    <div v-if="activeTab === 'vip'" class="flex flex-col flex-1 overflow-hidden">
      <div class="px-6 py-3 flex items-center gap-3 shrink-0">
        <input v-model="vipSearch" type="text" placeholder="搜尋號碼或姓名..."
          style="width:240px; border:1px solid #e5e7eb; border-radius:10px; padding:6px 12px; font-size:13px; outline:none; color:#111;">
        <button @click="openAddVip" class="ml-auto bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增 VIP
        </button>
      </div>
      <div class="flex-1 overflow-auto px-6 pb-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-400 border-b border-gray-200">
              <th class="text-left pb-3 font-medium">VIP 號碼</th>
              <th class="text-left pb-3 font-medium">姓名</th>
              <th class="text-left pb-3 font-medium">電話</th>
              <th class="text-left pb-3 font-medium">地址</th>
              <th class="text-left pb-3 font-medium">狀態</th>
              <th class="text-right pb-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in filteredVip" :key="v.id" class="border-b border-gray-100 hover:bg-gray-50" :class="!v.enabled ? 'opacity-50' : ''">
              <td class="py-3 font-mono font-bold text-purple-700">{{ v.id }}</td>
              <td class="py-3 font-medium text-gray-900">{{ v.name }}</td>
              <td class="py-3 text-gray-500 text-xs">{{ v.phone || '—' }}</td>
              <td class="py-3 text-gray-500 text-xs max-w-[150px] truncate">{{ v.address || '—' }}</td>
              <td class="py-3">
                <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="v.enabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'">
                  {{ v.enabled ? '有效' : '停用' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button @click="toggleVip(v)" class="text-xs mr-3" :class="v.enabled ? 'text-amber-500 hover:underline' : 'text-green-500 hover:underline'">{{ v.enabled ? '停用' : '啟用' }}</button>
                <button @click="openEditVip(v)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
                <button @click="deleteVip(v.id)" class="text-xs text-red-400 hover:underline">刪除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Google 帳號 ── -->
    <div v-if="activeTab === 'accounts'" class="flex flex-col flex-1 overflow-hidden">
      <div class="px-6 py-3 flex items-center gap-3 shrink-0">
        <input v-model="accSearch" type="text" placeholder="搜尋姓名或 Email..."
          style="width:240px; border:1px solid #e5e7eb; border-radius:10px; padding:6px 12px; font-size:13px; outline:none; color:#111;">
        <div class="flex gap-1.5">
          <button v-for="f in accFilters" :key="f.value" @click="accFilter = f.value"
            class="px-3 py-1.5 rounded-full text-xs border transition-colors"
            :class="accFilter === f.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'">
            {{ f.label }}
          </button>
        </div>
        <span class="text-xs text-gray-400 ml-auto">{{ filteredAccounts.length }} 個帳號</span>
      </div>
      <div class="flex-1 overflow-auto px-6 pb-4">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-400 border-b border-gray-200">
              <th class="text-left pb-3 font-medium">Google 帳號</th>
              <th class="text-left pb-3 font-medium pl-4">身分</th>
              <th class="text-left pb-3 font-medium pl-4">綁定ID</th>
              <th class="text-left pb-3 font-medium pl-4">最後登入</th>
              <th class="text-right pb-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="acc in filteredAccounts" :key="acc.id" class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-3">
                <div class="flex items-center gap-3">
                  <div class="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">{{ acc.name.slice(0,1) }}</div>
                  <div>
                    <div class="font-medium text-gray-900 text-sm">{{ acc.name }}</div>
                    <div class="text-xs text-gray-400">{{ acc.email }}</div>
                  </div>
                </div>
              </td>
              <td class="py-3 pl-4">
                <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                  :class="{ 'bg-gray-100 text-gray-500': acc.memberType==='none', 'bg-green-100 text-green-700': acc.memberType==='staff', 'bg-purple-100 text-purple-700': acc.memberType==='vip' }">
                  {{ acc.memberType === 'none' ? '一般' : acc.memberType === 'staff' ? '👤 員工' : '⭐ VIP' }}
                </span>
              </td>
              <td class="py-3 pl-4 font-mono text-xs text-gray-600">{{ acc.memberId || '—' }}</td>
              <td class="py-3 pl-4 text-xs text-gray-400">{{ fmtDate(acc.lastLoginAt) }}</td>
              <td class="py-3 text-right">
                <button @click="openBind(acc)" class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                  {{ acc.memberType === 'none' ? '綁定身分' : '變更' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 員工 Modal -->
    <div v-if="showStaffModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showStaffModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ staffEditId ? '編輯員工' : '新增員工' }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">員工 ID *</label>
            <input v-model="staffForm.id" type="text" class="ifield" placeholder="例：F00228" :disabled="!!staffEditId">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
            <input v-model="staffForm.name" type="text" class="ifield" placeholder="例：吳宣澔">
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showStaffModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveStaff" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

    <!-- VIP Modal -->
    <div v-if="showVipModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showVipModal=false">
      <div class="bg-white rounded-2xl p-7 w-[440px] shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ vipEditId ? '編輯 VIP' : '新增 VIP' }}</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">VIP 號碼 *</label>
              <input v-model="vipForm.id" type="text" class="ifield" :disabled="!!vipEditId">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
              <input v-model="vipForm.name" type="text" class="ifield">
            </div>
          </div>
          <div><label class="text-xs text-gray-500 mb-1 block">電話</label><input v-model="vipForm.phone" type="text" class="ifield"></div>
          <div><label class="text-xs text-gray-500 mb-1 block">地址</label><input v-model="vipForm.address" type="text" class="ifield"></div>
          <div><label class="text-xs text-gray-500 mb-1 block">備註</label><input v-model="vipForm.note" type="text" class="ifield"></div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showVipModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveVip" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

    <!-- 帳號綁定 Modal -->
    <div v-if="showBindModal && bindTarget" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showBindModal=false">
      <div class="bg-white rounded-2xl p-7 w-96 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">綁定身分</h3>
        <p class="text-sm text-gray-500 mb-5">{{ bindTarget.name }} <span class="text-xs text-gray-400">{{ bindTarget.email }}</span></p>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-2 block">身分類型</label>
            <div class="grid grid-cols-3 gap-2">
              <button v-for="t in memberTypes" :key="t.value" @click="bindForm.memberType = t.value"
                class="py-2.5 rounded-xl border text-sm font-medium transition-colors"
                :class="bindForm.memberType === t.value ? t.activeClass : 'border-gray-200 text-gray-500 hover:bg-gray-50'">
                {{ t.label }}
              </button>
            </div>
          </div>
          <div v-if="bindForm.memberType === 'staff'">
            <label class="text-xs text-gray-500 mb-1 block">選擇員工</label>
            <select v-model="bindForm.memberId" style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
              <option value="" disabled>請選擇</option>
              <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.id }} — {{ e.name }}</option>
            </select>
          </div>
          <div v-if="bindForm.memberType === 'vip'">
            <label class="text-xs text-gray-500 mb-1 block">選擇 VIP</label>
            <select v-model="bindForm.memberId" style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
              <option value="" disabled>請選擇</option>
              <option v-for="v in vipMembers" :key="v.id" :value="v.id">{{ v.id }} — {{ v.name }}</option>
            </select>
          </div>
          <div v-if="bindForm.memberType !== 'none'" class="rounded-xl p-3 text-sm" :class="bindForm.memberType === 'staff' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'">
            登入後自動套用<span class="font-bold">{{ bindForm.memberType === 'staff' ? '員工 95折' : 'VIP 9折' }}</span>優惠
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showBindModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveBind" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Employee, VipMember, GoogleAccount } from '~/composables/usePosStore'

const { employees, vipMembers, googleAccounts } = usePosStore()

const tabs = [
  { value: 'staff',    label: '👤 員工' },
  { value: 'vip',      label: '⭐ VIP' },
  { value: 'accounts', label: '🔑 Google 帳號' },
]
const activeTab = ref<'staff' | 'vip' | 'accounts'>('staff')

// ── 員工 ──
const showStaffModal = ref(false)
const staffEditId    = ref<string | null>(null)
const staffForm      = ref({ id: '', name: '' })

function openAddStaff() { staffEditId.value = null; staffForm.value = { id:'', name:'' }; showStaffModal.value = true }
function openEditStaff(e: Employee) { staffEditId.value = e.id; staffForm.value = { id: e.id, name: e.name }; showStaffModal.value = true }
function saveStaff() {
  if (!staffForm.value.id || !staffForm.value.name) return
  if (staffEditId.value) {
    const e = employees.value.find(e => e.id === staffEditId.value)
    if (e) e.name = staffForm.value.name
  } else {
    if (employees.value.find(e => e.id === staffForm.value.id)) { alert('ID 已存在'); return }
    employees.value.push({ id: staffForm.value.id, name: staffForm.value.name, enabled: true })
  }
  showStaffModal.value = false
}
function toggleStaff(e: Employee) { e.enabled = !e.enabled }
function deleteStaff(id: string) {
  if (!confirm('確定刪除？')) return
  const i = employees.value.findIndex(e => e.id === id)
  if (i >= 0) employees.value.splice(i, 1)
}

// ── VIP ──
const showVipModal = ref(false)
const vipEditId    = ref<string | null>(null)
const vipSearch    = ref('')
const vipForm      = ref({ id:'', name:'', phone:'', address:'', note:'' })

const filteredVip = computed(() => {
  const q = vipSearch.value.toLowerCase()
  return vipMembers.value.filter(v => !q || v.id.includes(q) || v.name.includes(q))
})
function openAddVip() { vipEditId.value = null; vipForm.value = { id:'', name:'', phone:'', address:'', note:'' }; showVipModal.value = true }
function openEditVip(v: VipMember) { vipEditId.value = v.id; vipForm.value = { id:v.id, name:v.name, phone:v.phone, address:v.address, note:v.note }; showVipModal.value = true }
function saveVip() {
  if (!vipForm.value.id || !vipForm.value.name) return
  if (vipEditId.value) {
    const v = vipMembers.value.find(v => v.id === vipEditId.value)
    if (v) Object.assign(v, vipForm.value)
  } else {
    if (vipMembers.value.find(v => v.id === vipForm.value.id)) { alert('VIP 號碼已存在'); return }
    vipMembers.value.push({ ...vipForm.value, enabled: true })
  }
  showVipModal.value = false
}
function toggleVip(v: VipMember) { v.enabled = !v.enabled }
function deleteVip(id: string) {
  if (!confirm('確定刪除？')) return
  const i = vipMembers.value.findIndex(v => v.id === id)
  if (i >= 0) vipMembers.value.splice(i, 1)
}

// ── Google 帳號 ──
const showBindModal = ref(false)
const accSearch     = ref('')
const accFilter     = ref('all')
const bindTarget    = ref<GoogleAccount | null>(null)
const bindForm      = ref({ memberType: 'none' as 'none' | 'staff' | 'vip', memberId: '' })

const accFilters = [
  { value: 'all',   label: '全部' },
  { value: 'none',  label: '未綁定' },
  { value: 'staff', label: '員工' },
  { value: 'vip',   label: 'VIP' },
]
const memberTypes = [
  { value: 'none',  label: '一般',    activeClass: 'bg-gray-100 border-gray-400 text-gray-700' },
  { value: 'staff', label: '👤 員工', activeClass: 'bg-green-50 border-green-500 text-green-700' },
  { value: 'vip',   label: '⭐ VIP', activeClass: 'bg-purple-50 border-purple-500 text-purple-700' },
]
const filteredAccounts = computed(() =>
  googleAccounts.value.filter(a => {
    const q = accSearch.value.toLowerCase()
    return (!q || a.name.includes(q) || a.email.includes(q)) &&
      (accFilter.value === 'all' || a.memberType === accFilter.value)
  })
)
function openBind(acc: GoogleAccount) {
  bindTarget.value = acc
  bindForm.value = { memberType: acc.memberType, memberId: acc.memberId }
  showBindModal.value = true
}
function saveBind() {
  if (!bindTarget.value) return
  const acc = googleAccounts.value.find(a => a.id === bindTarget.value!.id)
  if (acc) { acc.memberType = bindForm.value.memberType; acc.memberId = bindForm.value.memberType === 'none' ? '' : bindForm.value.memberId }
  showBindModal.value = false
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' })
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
