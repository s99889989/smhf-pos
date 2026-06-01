<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">品項管理</h1>
        <p class="text-xs text-gray-400 mt-0.5">管理收銀品項、定價與物料消耗</p>
      </div>
      <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
        ＋ 新增品項
      </button>
    </div>

    <!-- 篩選 -->
    <div class="bg-white border-b border-gray-200 px-6 py-2.5 flex gap-2 overflow-x-auto shrink-0">
      <button
        v-for="loc in ['全部', '餐廳', '小舖', '擺攤']" :key="loc"
        @click="filterLoc = loc"
        class="px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors"
        :class="filterLoc === loc
          ? 'bg-gray-100 text-gray-900 border-gray-400 font-medium'
          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
      >
        {{ loc }}
      </button>
    </div>

    <!-- 表格 -->
    <div class="flex-1 overflow-auto px-6 py-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium w-8">排序</th>
            <th class="text-left pb-3 font-medium">品項名稱</th>
            <th class="text-left pb-3 font-medium">分類</th>
            <th class="text-right pb-3 font-medium">售價</th>
            <th class="text-center pb-3 font-medium">限現金</th>
            <th class="text-left pb-3 font-medium pl-4">適用地點</th>
            <th class="text-left pb-3 font-medium pl-4">消耗物料</th>
            <th class="text-right pb-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="prod in filteredProducts" :key="prod.id"
            class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td class="py-3 text-gray-400 text-xs">{{ prod.sortOrder }}</td>
            <td class="py-3">
              <div class="font-medium text-gray-900">{{ prod.name }}</div>
              <div v-if="prod.note" class="text-xs text-gray-400">{{ prod.note }}</div>
            </td>
            <td class="py-3">
              <span class="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">{{ prod.category }}</span>
            </td>
            <td class="py-3 text-right font-semibold text-green-700">${{ prod.price }}</td>
            <td class="py-3 text-center">
              <span v-if="prod.cashOnly" class="text-amber-500 text-base" title="限現金">💵</span>
              <span v-else class="text-gray-200">—</span>
            </td>
            <td class="py-3 pl-4">
              <div class="flex gap-1 flex-wrap">
                <span
                  v-for="loc in prod.locations" :key="loc"
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-green-100 text-green-700': loc === 'restaurant',
                    'bg-blue-100 text-blue-700':   loc === 'shop',
                    'bg-amber-100 text-amber-700':  loc === 'stall',
                  }"
                >{{ LOC_LABEL[loc] }}</span>
              </div>
            </td>
            <td class="py-3 pl-4 text-xs text-gray-500">
              <span v-if="!prod.materials.length" class="text-gray-300">—</span>
              <span v-for="pm in prod.materials" :key="pm.materialId" class="mr-2">
                {{ getMaterialName(pm.materialId) }} ×{{ pm.quantity }}
              </span>
            </td>
            <td class="py-3 text-right">
              <button @click="openEdit(prod)" class="text-xs text-blue-500 hover:underline mr-3">編輯</button>
              <button @click="deleteProduct(prod.id)" class="text-xs text-red-400 hover:underline">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal = false">
      <div class="bg-white rounded-2xl p-7 w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯品項' : '新增品項' }}</h3>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">品項名稱 *</label>
              <input v-model="form.name" type="text" class="ifield" placeholder="例：巧克力餅乾一盒">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">售價 *</label>
              <input v-model.number="form.price" type="number" class="ifield" placeholder="0">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">分類</label>
              <input v-model="form.category" type="text" class="ifield" placeholder="例：餅乾麵包">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">備註</label>
              <input v-model="form.note" type="text" class="ifield" placeholder="例：30入">
            </div>
          </div>

          <div>
            <label class="text-xs text-gray-500 mb-2 block">適用地點</label>
            <div class="flex gap-4">
              <label v-for="loc in locationOptions" :key="loc.value" class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" :value="loc.value" v-model="form.locations" class="w-4 h-4 accent-green-600">
                <span class="text-sm text-gray-700">{{ loc.label }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="text-xs text-gray-500 mb-2 block">付款限制</label>
            <label class="flex items-center gap-2 cursor-pointer w-fit">
              <input type="checkbox" v-model="form.cashOnly" class="w-4 h-4 accent-amber-500">
              <span class="text-sm text-gray-700">💵 限制只能使用現金付款</span>
            </label>
            <p class="text-xs text-gray-400 mt-1 ml-6">勾選後結帳時將鎖定付款方式為現金（例：午餐餐券）</p>
          </div>

          <div>
            <label class="text-xs text-gray-500 mb-2 block">消耗物料（選填）</label>
            <div class="space-y-2">
              <div v-for="(pm, i) in form.materials" :key="i" class="flex gap-2 items-center">
                <select
                  v-model.number="pm.materialId"
                  style="flex:1; border:1px solid #e5e7eb; border-radius:8px; padding:7px 10px; font-size:13px; background:#fff; color:#111; outline:none;"
                >
                  <option :value="0" disabled>請選擇物料</option>
                  <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}（{{ m.unit }}）</option>
                </select>
                <input
                  v-model.number="pm.quantity"
                  type="number" min="1"
                  placeholder="數量"
                  style="width:72px; border:1px solid #e5e7eb; border-radius:8px; padding:7px 10px; font-size:13px; outline:none;"
                >
                <button @click="form.materials.splice(i, 1)" class="text-red-400 hover:text-red-600 text-xl leading-none px-1">×</button>
              </div>
              <button @click="form.materials.push({ materialId: 0, quantity: 1 })" class="text-xs text-green-600 hover:underline mt-1">＋ 新增物料</button>
            </div>
          </div>

          <div>
            <label class="text-xs text-gray-500 mb-1 block">排列順序</label>
            <input v-model.number="form.sortOrder" type="number" min="1" class="ifield w-24">
          </div>
        </div>

        <div class="flex gap-2 mt-6">
          <button @click="showModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveProduct" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">儲存</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { LOC_LABEL } from '~/composables/usePosStore'
import type { Product } from '~/composables/usePosStore'

const { products, materials } = usePosStore()

const filterLoc = ref('全部')
const showModal = ref(false)
const editId    = ref<number | null>(null)

const locationOptions = [
  { value: 'restaurant', label: '餐廳' },
  { value: 'shop',       label: '小舖' },
  { value: 'stall',      label: '擺攤' },
]

const defaultForm = () => ({
  name: '', price: 0, category: '', note: '',
  cashOnly: false,
  locations: [] as ('restaurant' | 'shop' | 'stall')[],
  sortOrder: products.value.length + 1,
  materials: [] as { materialId: number; quantity: number }[],
})
const form = ref(defaultForm())

const filteredProducts = computed(() => {
  const locMap: Record<string, string> = { '餐廳': 'restaurant', '小舖': 'shop', '擺攤': 'stall' }
  return products.value
    .filter(p => filterLoc.value === '全部' || p.locations.includes(locMap[filterLoc.value] as any))
    .sort((a, b) => a.sortOrder - b.sortOrder)
})

function getMaterialName(id: number) {
  return materials.value.find(m => m.id === id)?.name ?? '?'
}

function openAdd() {
  editId.value = null
  form.value = defaultForm()
  showModal.value = true
}

function openEdit(prod: Product) {
  editId.value = prod.id
  form.value = {
    name: prod.name, price: prod.price, category: prod.category,
    note: prod.note, cashOnly: prod.cashOnly,
    locations: [...prod.locations],
    sortOrder: prod.sortOrder,
    materials: prod.materials.map(m => ({ ...m })),
  }
  showModal.value = true
}

function saveProduct() {
  if (!form.value.name || !form.value.price) return
  if (editId.value) {
    const idx = products.value.findIndex(p => p.id === editId.value)
    if (idx >= 0) products.value[idx] = { ...products.value[idx], ...form.value }
  } else {
    const newId = Math.max(0, ...products.value.map(p => p.id)) + 1
    products.value.push({ id: newId, ...form.value })
  }
  showModal.value = false
}

function deleteProduct(id: number) {
  if (!confirm('確定刪除此品項？')) return
  const idx = products.value.findIndex(p => p.id === id)
  if (idx >= 0) products.value.splice(idx, 1)
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield {
  @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-900;
}
</style>
