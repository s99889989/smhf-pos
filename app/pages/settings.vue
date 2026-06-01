<template>
  <div class="flex flex-col h-full overflow-hidden">

    <div class="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <h1 class="text-lg font-bold text-gray-900">系統設定</h1>
      <p class="text-xs text-gray-400 mt-0.5">折扣類型與其他設定</p>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6 max-w-2xl">

      <!-- 折扣類型管理 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">折扣類型</h2>
            <p class="text-xs text-gray-400 mt-0.5">收銀頁面會顯示已啟用的折扣</p>
          </div>
          <button @click="openAdd"
            class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            ＋ 新增
          </button>
        </div>

        <div class="divide-y divide-gray-100">
          <div v-for="d in discountTypes" :key="d.id"
            class="px-5 py-4 flex items-center gap-4"
            :class="!d.enabled ? 'opacity-50' : ''">

            <!-- 啟用開關：內建折扣不可停用 -->
            <div class="shrink-0">
              <button v-if="!d.builtIn" @click="toggleEnabled(d)"
                class="w-10 h-6 rounded-full transition-colors relative"
                :class="d.enabled ? 'bg-green-500' : 'bg-gray-200'">
                <span class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
                  :class="d.enabled ? 'left-5' : 'left-1'"></span>
              </button>
              <div v-else class="w-10 h-6 rounded-full bg-green-500 relative opacity-50 cursor-not-allowed" title="內建折扣無法停用">
                <span class="absolute top-1 left-5 w-4 h-4 bg-white rounded-full shadow"></span>
              </div>
            </div>

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900">{{ d.label }}</span>
                <span v-if="d.builtIn" class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">系統內建</span>
                <span v-if="d.requireStaff" class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">需員工</span>
                <span v-if="d.requireVip"   class="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">需VIP</span>
              </div>
              <div class="text-xs text-gray-400 mt-0.5">
                折扣率 {{ d.rate === 1 ? '不打折（原價）' : rateLabel(d.rate) }}
              </div>
            </div>

            <!-- 折扣視覺 -->
            <div class="text-right shrink-0">
              <span v-if="d.rate === 1" class="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">原價</span>
              <span v-else class="text-sm font-bold text-purple-600">{{ rateLabel(d.rate) }}</span>
            </div>

            <div class="flex gap-2 shrink-0">
              <button @click="openEdit(d)" class="text-xs text-blue-500 hover:underline">編輯</button>
              <button v-if="!d.builtIn" @click="deleteDiscount(d.id)" class="text-xs text-red-400 hover:underline">刪除</button>
              <span v-else class="text-xs text-gray-300 cursor-not-allowed" title="系統內建不可刪除">刪除</span>
            </div>
          </div>
        </div>

        <div class="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <p class="text-xs text-gray-400">🔒 標示「系統內建」的折扣類型不可刪除或停用，折扣率可調整</p>
        </div>
      </div>

    </div>

    <!-- 新增/編輯 Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal = false">
      <div class="bg-white rounded-2xl p-7 w-96 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯折扣' : '新增折扣' }}</h3>
        <div class="space-y-4">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">折扣名稱 *</label>
            <input v-model="form.label" type="text" class="ifield" placeholder="例：員工價、會員價">
          </div>
          <div>
            <label class="text-xs text-gray-500 mb-1 block">折扣方式 *</label>
            <div class="flex gap-3 mb-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="rateMode" value="discount" class="accent-green-600"> 幾折
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="rateMode" value="percent" class="accent-green-600"> 百分比
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" v-model="rateMode" value="full" class="accent-green-600"> 不打折
              </label>
            </div>
            <div v-if="rateMode === 'discount'" class="flex items-center gap-2">
              <input v-model.number="discountInput" type="number" min="1" max="9.9" step="0.1" class="ifield w-28" placeholder="例：9.5">
              <span class="text-sm text-gray-500">折（1~9.9）</span>
            </div>
            <div v-else-if="rateMode === 'percent'" class="flex items-center gap-2">
              <input v-model.number="percentInput" type="number" min="1" max="100" class="ifield w-28" placeholder="例：95">
              <span class="text-sm text-gray-500">% off</span>
            </div>
            <div v-else class="text-sm text-gray-500 py-2">原價，不套用折扣</div>
          </div>
          <!-- 預覽 -->
          <div class="bg-gray-50 rounded-xl p-3 text-sm">
            <span class="text-gray-500">預覽：$100 的商品 → </span>
            <span class="font-bold text-green-700">${{ Math.round(100 * computedRate) }}</span>
          </div>
          <!-- 驗證設定 -->
          <div>
            <label class="text-xs text-gray-500 mb-2 block">結帳驗證</label>
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.requireStaff" class="w-4 h-4 accent-green-600">
                <span class="text-sm text-gray-700">需要選擇員工（員工折扣用）</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.requireVip" class="w-4 h-4 accent-purple-600">
                <span class="text-sm text-gray-700">需要輸入 VIP 號碼驗證</span>
              </label>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button @click="showModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveDiscount" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { DiscountType } from '~/composables/usePosStore'

const { discountTypes } = usePosStore()

function rateLabel(rate: number) {
  const n = rate * 10
  return (Number.isInteger(n) ? n : parseFloat(n.toFixed(1))) + '折'
}

const showModal = ref(false)
const editId    = ref<number | null>(null)

const form = ref({ label: '', enabled: true, requireStaff: false, requireVip: false })
const rateMode      = ref<'discount' | 'percent' | 'full'>('discount')
const discountInput = ref(9.5)
const percentInput  = ref(95)

const computedRate = computed(() => {
  if (rateMode.value === 'full') return 1
  if (rateMode.value === 'discount') return Math.min(1, Math.max(0.01, discountInput.value / 10))
  return Math.min(1, Math.max(0.01, percentInput.value / 100))
})

function openAdd() {
  editId.value = null
  form.value = { label: '', enabled: true, requireStaff: false, requireVip: false }
  rateMode.value = 'discount'
  discountInput.value = 9.5
  percentInput.value = 95
  showModal.value = true
}

function openEdit(d: DiscountType) {
  editId.value = d.id
  form.value = { label: d.label, enabled: d.enabled, requireStaff: d.requireStaff, requireVip: d.requireVip }
  if (d.rate === 1) {
    rateMode.value = 'full'
  } else {
    rateMode.value = 'discount'
    discountInput.value = d.rate * 10
  }
  showModal.value = true
}

function saveDiscount() {
  if (!form.value.label) return
  const rate = computedRate.value
  if (editId.value) {
    const idx = discountTypes.value.findIndex(d => d.id === editId.value)
    if (idx >= 0) discountTypes.value[idx] = {
      ...discountTypes.value[idx],
      label: form.value.label, rate,
      requireStaff: form.value.requireStaff,
      requireVip: form.value.requireVip,
    }
  } else {
    const newId = Math.max(0, ...discountTypes.value.map(d => d.id)) + 1
    discountTypes.value.push({
      id: newId, label: form.value.label, rate, enabled: true,
      requireStaff: form.value.requireStaff,
      requireVip: form.value.requireVip,
      builtIn: false,
    })
  }
  showModal.value = false
}

function toggleEnabled(d: DiscountType) {
  if (d.builtIn) return
  d.enabled = !d.enabled
}

function deleteDiscount(id: number) {
  const d = discountTypes.value.find(d => d.id === id)
  if (d?.builtIn) return
  if (!confirm('確定刪除此折扣類型？')) return
  const idx = discountTypes.value.findIndex(d => d.id === id)
  if (idx >= 0) discountTypes.value.splice(idx, 1)
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield {
  @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-900;
}
</style>
