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
        v-for="loc in filterOptions" :key="loc.value"
        @click="filterLoc = loc.value"
        class="px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors"
        :class="filterLoc === loc.value
          ? 'bg-gray-100 text-gray-900 border-gray-400 font-medium'
          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
      >
        {{ loc.label }}
      </button>
      <span v-if="catState.mode === 'demo'" class="ml-auto self-center text-xs text-amber-600 whitespace-nowrap">範例模式：連不到資料機，修改不會保存</span>
      <span v-else-if="catState.offline" class="ml-auto self-center text-xs text-amber-600 whitespace-nowrap">平板離線中，不能修改品項</span>
    </div>

    <!-- 表格 -->
    <div class="flex-1 overflow-auto px-6 py-4">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-xs text-gray-400 border-b border-gray-200">
            <th class="text-left pb-3 font-medium w-8">排序</th>
            <th class="text-left pb-3 font-medium w-14">圖片</th>
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
            <td class="py-2">
              <img v-if="prod.image" :src="thumbUrl(prod.image)" :alt="prod.name" loading="lazy" class="w-12 h-9 object-cover rounded-md bg-gray-100">
              <div v-else class="w-12 h-9 rounded-md bg-gray-50 border border-dashed border-gray-200"></div>
            </td>
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
                  :class="locColor(loc)"
                >{{ stationName(loc) }}</span>
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
          <p v-if="formError" class="text-xs text-red-600">{{ formError }}</p>
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
            <label class="text-xs text-gray-500 mb-2 block">圖片（存在資料機，收銀台卡片會顯示）</label>
            <div class="flex items-center gap-3">
              <img v-if="imagePreview" :src="imagePreview" alt="品項圖片" class="w-20 h-15 object-cover rounded-lg bg-gray-100">
              <div v-else class="w-20 h-15 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">無圖片</div>
              <label class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer">
                選擇圖片
                <input type="file" accept="image/*" class="hidden" @change="pickImage">
              </label>
              <button v-if="imagePreview" @click="removeImage" class="text-xs text-red-400 hover:underline">移除</button>
            </div>
          </div>

          <div>
            <label class="text-xs text-gray-500 mb-2 block">上架站別（可多選）</label>
            <div class="flex flex-wrap gap-x-4 gap-y-2">
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
          <button @click="saveProduct" :disabled="saving" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60">{{ saving ? '儲存中…' : '儲存' }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/composables/usePosStore'
import { catalogImageUrl } from '~/utils/catalogApi'

const { products, materials, stations, stationName } = usePosStore()
const cat = useCatalog()
const catState = cat.state

const filterLoc = ref('')   // '' = 全部，其他 = 站別 id
const showModal = ref(false)
const editId    = ref<number | null>(null)
const saving    = ref(false)
const formError = ref('')

const filterOptions = computed(() => [{ value: '', label: '全部' }, ...stations.value.map(s => ({ value: s.id, label: s.name }))])
const locationOptions = computed(() => stations.value.map(s => ({ value: s.id, label: s.name })))

const COLORS = ['bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-gray-100 text-gray-600']
function locColor(id: string) {
  const i = stations.value.findIndex(s => s.id === id)
  return COLORS[(i < 0 ? COLORS.length - 1 : i) % COLORS.length]
}
const thumbUrl = (file: string) => file.startsWith('blob:') ? file : catalogImageUrl(file)

const defaultForm = () => ({
  name: '', price: 0, category: '', note: '',
  cashOnly: false,
  locations: [] as string[],
  sortOrder: products.value.length + 1,
  materials: [] as { materialId: number; quantity: number }[],
})
const form = ref(defaultForm())

// 圖片：選了新圖先預覽，按儲存時才上傳
const imageFile    = ref<File | null>(null)
const imageRemoved = ref(false)
const imagePreview = ref('')
function pickImage(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (imagePreview.value.startsWith('blob:') && imageFile.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = f
  imageRemoved.value = false
  imagePreview.value = URL.createObjectURL(f)
}
function removeImage() {
  imageFile.value = null
  imageRemoved.value = true
  imagePreview.value = ''
}

const filteredProducts = computed(() =>
  products.value
    .filter(p => !filterLoc.value || p.locations.includes(filterLoc.value))
    .sort((a, b) => a.sortOrder - b.sortOrder)
)

function getMaterialName(id: number) {
  return materials.value.find(m => m.id === id)?.name ?? '?'
}

function resetImage(prod?: Product) {
  imageFile.value = null
  imageRemoved.value = false
  imagePreview.value = prod?.image ? thumbUrl(prod.image) : ''
}

function openAdd() {
  editId.value = null
  form.value = defaultForm()
  // 新增時預設勾目前篩選的站
  if (filterLoc.value) form.value.locations = [filterLoc.value]
  resetImage()
  formError.value = ''
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
  resetImage(prod)
  formError.value = ''
  showModal.value = true
}

async function saveProduct() {
  if (!form.value.name || !form.value.price) { formError.value = '請填品項名稱和售價'; return }
  saving.value = true
  formError.value = ''
  try {
    const name = form.value.name.trim()
    await cat.saveProduct({ ...form.value, name, id: editId.value, materials: form.value.materials.filter(m => m.materialId) })
    const id = editId.value ?? products.value.find(p => p.name === name)?.id
    if (id && imageFile.value) await cat.setProductImage(id, imageFile.value)
    else if (id && imageRemoved.value) await cat.clearProductImage(id)
    showModal.value = false
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function deleteProduct(id: number) {
  if (!confirm('確定刪除此品項？')) return
  try { await cat.deleteProduct(id) } catch (e) { alert((e as Error).message) }
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield {
  @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-900;
}
</style>
