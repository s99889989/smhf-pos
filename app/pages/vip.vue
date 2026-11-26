<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">VIP 管理</h1>
        <p class="text-xs text-gray-400 mt-0.5">結帳 VIP 折扣時會要求輸入 VIP 號碼驗證</p>
      </div>
      <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
        ＋ 新增 VIP
      </button>
    </div>

    <!-- 搜尋 -->
    <div class="bg-white border-b border-gray-100 px-4 md:px-6 py-3 shrink-0">
      <input v-model="search" type="text" placeholder="搜尋 VIP 號碼或姓名..."
        style="width:280px; border:1px solid #e5e7eb; border-radius:10px; padding:7px 12px; font-size:13px; outline:none; color:#111;">
    </div>

    <div class="flex-1 overflow-auto px-4 md:px-6 py-4">
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
          <tr v-for="v in filtered" :key="v.id" class="border-b border-gray-100 hover:bg-gray-50"
            :class="!v.enabled ? 'opacity-50' : ''">
            <td class="py-3 font-mono font-bold text-purple-700">{{ v.id }}</td>
            <td class="py-3 font-medium text-gray-900">{{ v.name }}</td>
            <td class="py-3 text-gray-500 text-xs">{{ v.phone || '—' }}</td>
            <td class="py-3 text-gray-500 text-xs max-w-[160px] truncate">{{ v.address || '—' }}</td>
            <td class="py-3">
              <span class="text-xs px-2.5 py-1 rounded-full font-medium"
                :class="v.enabled ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'">
                {{ v.enabled ? '有效' : '停用' }}
              </span>
            </td>
            <td class="py-3 text-right">
              <button @click="toggleEnabled(v)" class="text-xs mr-3"
                :class="v.enabled ? 'text-amber-500 hover:underline' : 'text-green-500 hover:underline'">
                {{ v.enabled ? '停用' : '啟用' }}
              </button>
              <button @click="openEdit(v)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
              <button @click="deleteVip(v.id)" class="text-xs text-red-400 hover:underline">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal=false">
      <div class="bg-white rounded-2xl p-7 w-[440px] shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯 VIP' : '新增 VIP' }}</h3>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">VIP 號碼 *</label>
              <input v-model="form.id" type="text" class="ifield" placeholder="例：155375" :disabled="!!editId">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
              <input v-model="form.name" type="text" class="ifield" placeholder="例：楊鄉咪">
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">電話</label>
            <input v-model="form.phone" type="text" class="ifield" placeholder="0912-345-678">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">地址</label>
            <input v-model="form.address" type="text" class="ifield" placeholder="台東縣...">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">備註</label>
            <input v-model="form.note" type="text" class="ifield" placeholder="">
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
import type { VipMember } from '~/composables/usePosStore'
const { vipMembers } = usePosStore()

const showModal = ref(false)
const editId    = ref<string | null>(null)
const search    = ref('')
const form      = ref({ id: '', name: '', phone: '', address: '', note: '' })

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return vipMembers.value.filter(v => !q || v.id.includes(q) || v.name.includes(q))
})

function openAdd() { editId.value = null; form.value = { id:'', name:'', phone:'', address:'', note:'' }; showModal.value = true }
function openEdit(v: VipMember) {
  editId.value = v.id
  form.value = { id: v.id, name: v.name, phone: v.phone, address: v.address, note: v.note }
  showModal.value = true
}
function save() {
  if (!form.value.id || !form.value.name) return
  if (editId.value) {
    const v = vipMembers.value.find(v => v.id === editId.value)
    if (v) Object.assign(v, form.value)
  } else {
    if (vipMembers.value.find(v => v.id === form.value.id)) { alert('VIP 號碼已存在'); return }
    vipMembers.value.push({ ...form.value, enabled: true })
  }
  showModal.value = false
}
function toggleEnabled(v: VipMember) { v.enabled = !v.enabled }
function deleteVip(id: string) {
  if (!confirm('確定刪除此 VIP？')) return
  const idx = vipMembers.value.findIndex(v => v.id === id)
  if (idx >= 0) vipMembers.value.splice(idx, 1)
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
