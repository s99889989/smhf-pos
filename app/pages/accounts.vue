<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <h1 class="text-lg font-bold text-gray-900">帳號管理</h1>
      <p class="text-xs text-gray-400 mt-0.5">管理 Google 登入帳號，綁定員工或 VIP 身分</p>
    </div>

    <!-- 搜尋 -->
    <div class="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
      <input v-model="search" type="text" placeholder="搜尋姓名或 Email..."
        style="width:280px; border:1px solid #e5e7eb; border-radius:10px; padding:7px 12px; font-size:13px; outline:none; color:#111;">
      <div class="flex gap-2 ml-2">
        <button v-for="f in filters" :key="f.value" @click="filterType = f.value"
          class="px-3 py-1.5 rounded-full text-xs border transition-colors"
          :class="filterType === f.value ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'">
          {{ f.label }}
        </button>
      </div>
      <span class="text-xs text-gray-400 ml-auto">共 {{ filteredAccounts.length }} 個帳號</span>
    </div>

    <div class="flex-1 overflow-auto px-6 py-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium">Google 帳號</th>
            <th class="text-left pb-3 font-medium pl-4">身分類型</th>
            <th class="text-left pb-3 font-medium pl-4">綁定ID</th>
            <th class="text-left pb-3 font-medium pl-4">最後登入</th>
            <th class="text-right pb-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="acc in filteredAccounts" :key="acc.id"
            class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="py-3 pl-0">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                  {{ acc.name.slice(0, 1) }}
                </div>
                <div>
                  <div class="font-medium text-gray-900">{{ acc.name }}</div>
                  <div class="text-xs text-gray-400">{{ acc.email }}</div>
                </div>
              </div>
            </td>
            <td class="py-3 pl-4">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                :class="{
                  'bg-gray-100 text-gray-500':    acc.memberType === 'none',
                  'bg-green-100 text-green-700':  acc.memberType === 'staff',
                  'bg-purple-100 text-purple-700': acc.memberType === 'vip',
                }">
                {{ acc.memberType === 'none' ? '一般會員' : acc.memberType === 'staff' ? '👤 員工' : '⭐ VIP' }}
              </span>
            </td>
            <td class="py-3 pl-4">
              <span v-if="acc.memberId" class="font-mono text-xs text-gray-700">{{ acc.memberId }}</span>
              <span v-else class="text-gray-300 text-xs">—</span>
            </td>
            <td class="py-3 pl-4 text-xs text-gray-400">{{ fmt(acc.lastLoginAt) }}</td>
            <td class="py-3 text-right">
              <button @click="openBind(acc)"
                class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                {{ acc.memberType === 'none' ? '綁定身分' : '變更綁定' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 綁定 Modal -->
    <div v-if="showModal && bindTarget" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal=false">
      <div class="bg-white rounded-2xl p-7 w-96 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">綁定身分</h3>
        <p class="text-sm text-gray-500 mb-5">
          {{ bindTarget.name }}
          <span class="text-gray-400 text-xs ml-1">{{ bindTarget.email }}</span>
        </p>

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

          <!-- 員工：選擇員工 -->
          <div v-if="bindForm.memberType === 'staff'">
            <label class="text-xs text-gray-500 mb-1 block">選擇員工帳號</label>
            <select v-model="bindForm.memberId"
              style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
              <option value="" disabled>請選擇員工</option>
              <option v-for="e in employees" :key="e.id" :value="e.id">{{ e.id }} — {{ e.name }}</option>
            </select>
          </div>

          <!-- VIP：選擇 VIP -->
          <div v-if="bindForm.memberType === 'vip'">
            <label class="text-xs text-gray-500 mb-1 block">選擇 VIP 帳號</label>
            <select v-model="bindForm.memberId"
              style="width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 12px; font-size:13px; outline:none; color:#111; background:#fff;">
              <option value="" disabled>請選擇 VIP</option>
              <option v-for="v in vipMembers" :key="v.id" :value="v.id">{{ v.id }} — {{ v.name }}</option>
            </select>
          </div>

          <!-- 預覽折扣 -->
          <div v-if="bindForm.memberType !== 'none'" class="rounded-xl p-3 text-sm"
            :class="bindForm.memberType === 'staff' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'">
            此帳號登入後將自動套用
            <span class="font-bold">{{ bindForm.memberType === 'staff' ? '員工 95折' : 'VIP 9折' }}</span>
            優惠
          </div>
        </div>

        <div class="flex gap-2 mt-6">
          <button @click="showModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveBind" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { GoogleAccount } from '~/composables/usePosStore'

const { googleAccounts, employees, vipMembers } = usePosStore()

const search     = ref('')
const filterType = ref('all')
const showModal  = ref(false)
const bindTarget = ref<GoogleAccount | null>(null)
const bindForm   = ref({ memberType: 'none' as 'none' | 'staff' | 'vip', memberId: '' })

const filters = [
  { value: 'all',   label: '全部' },
  { value: 'none',  label: '未綁定' },
  { value: 'staff', label: '員工' },
  { value: 'vip',   label: 'VIP' },
]

const memberTypes = [
  { value: 'none',  label: '一般',  activeClass: 'bg-gray-100 border-gray-400 text-gray-700' },
  { value: 'staff', label: '👤 員工', activeClass: 'bg-green-50 border-green-500 text-green-700' },
  { value: 'vip',   label: '⭐ VIP', activeClass: 'bg-purple-50 border-purple-500 text-purple-700' },
]

const filteredAccounts = computed(() => {
  return googleAccounts.value.filter(acc => {
    const matchSearch = !search.value ||
      acc.name.includes(search.value) || acc.email.includes(search.value)
    const matchType = filterType.value === 'all' || acc.memberType === filterType.value
    return matchSearch && matchType
  })
})

function openBind(acc: GoogleAccount) {
  bindTarget.value = acc
  bindForm.value = { memberType: acc.memberType, memberId: acc.memberId }
  showModal.value = true
}

function saveBind() {
  if (!bindTarget.value) return
  const acc = googleAccounts.value.find(a => a.id === bindTarget.value!.id)
  if (acc) {
    acc.memberType = bindForm.value.memberType
    acc.memberId   = bindForm.value.memberType === 'none' ? '' : bindForm.value.memberId
  }
  showModal.value = false
}

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>
