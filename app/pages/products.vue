<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <h1 class="text-lg font-bold text-gray-900">品項管理</h1>
          <p class="text-xs text-gray-400 mt-0.5">管理收銀品項、定價與物料消耗</p>
        </div>
        <!-- 篩選：地點、分類（下拉選單） -->
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-1.5 text-xs text-gray-500">
            地點
            <select v-model="filterLoc" class="ifield" style="width:auto; min-width:7rem">
              <option v-for="loc in filterOptions" :key="loc.value" :value="loc.value">{{ loc.label }}</option>
            </select>
          </label>
          <label class="flex items-center gap-1.5 text-xs text-gray-500">
            分類
            <select v-model="filterCat" class="ifield" style="width:auto; min-width:7rem">
              <option value="">全部</option>
              <option v-for="c in categoryList" :key="c.name" :value="c.name">{{ c.name }}</option>
              <option :value="NO_CAT">（未分類）</option>
            </select>
          </label>
          <span class="text-xs text-gray-400">共 {{ filteredProducts.length }} 項</span>
        </div>
        <span v-if="catState.mode === 'demo'" class="text-xs text-amber-600">範例模式：連不到資料機，修改不會保存</span>
        <span v-else-if="catState.offline" class="text-xs text-amber-600">平板離線中，不能修改品項</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="openCats" class="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          分類管理
        </button>
        <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增品項
        </button>
      </div>
    </div>

    <!-- 表格 -->
    <div class="flex-1 overflow-auto px-4 md:px-6 py-4">
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
              <CatalogImg v-if="prod.image" :file="prod.image" :alt="prod.name" class="w-12 h-9 object-cover rounded-md bg-gray-100" />
              <div v-else class="w-12 h-9 rounded-md bg-gray-50 border border-dashed border-gray-200"></div>
            </td>
            <td class="py-3">
              <div class="font-medium text-gray-900">{{ prod.name }}</div>
              <div v-if="prod.note" class="text-xs text-gray-400">{{ prod.note }}</div>
            </td>
            <td class="py-3">
              <span v-if="prod.category" class="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">{{ prod.category }}</span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="py-3 text-right font-semibold text-green-700 whitespace-nowrap">
              <template v-if="prod.openPrice">
                <span class="text-orange-600">時價</span>
                <div v-if="prod.price" class="text-xs font-normal text-gray-400">參考 ${{ prod.price }}</div>
              </template>
              <template v-else>${{ prod.price }}</template>
            </td>
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

    <!-- 分類管理 Modal -->
    <div v-if="showCats" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showCats = false">
      <div class="bg-white rounded-2xl p-7 w-[440px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">分類管理</h3>
        <p class="text-xs text-gray-400 mb-4">收銀台的分類頁籤依這裡的順序排列；改名時，用這個分類的品項會一起改。</p>
        <p v-if="catError" class="text-xs text-red-600 mb-3">{{ catError }}</p>

        <div class="space-y-2">
          <div v-for="(c, i) in catRows" :key="c.key" class="flex gap-2 items-center">
            <div class="flex flex-col leading-none">
              <button @click="moveCat(i, -1)" :disabled="i === 0 || catBusy" class="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1" title="往上">▲</button>
              <button @click="moveCat(i, 1)" :disabled="i === catRows.length - 1 || catBusy" class="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-1" title="往下">▼</button>
            </div>
            <input v-model="c.name" type="text" class="ifield" style="flex:1; min-width:0" @keyup.enter="renameCat(c)">
            <span class="text-xs text-gray-400 whitespace-nowrap w-14 text-right">{{ productCount(c.orig) }} 個品項</span>
            <button v-if="c.name.trim() !== c.orig" @click="renameCat(c)" :disabled="catBusy" class="text-xs text-blue-500 hover:underline whitespace-nowrap">儲存</button>
            <button v-else @click="removeCat(c)" :disabled="catBusy" class="text-xs text-red-400 hover:underline whitespace-nowrap">刪除</button>
          </div>
          <p v-if="!catRows.length" class="text-sm text-gray-400">還沒有分類</p>
        </div>

        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <input v-model="newCatName" type="text" class="ifield" style="flex:1; min-width:0" placeholder="新分類名稱，例：飲品" @keyup.enter="addCat">
          <button @click="addCat" :disabled="catBusy" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 rounded-lg whitespace-nowrap disabled:opacity-60">＋ 新增分類</button>
        </div>

        <button @click="showCats = false" class="w-full mt-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">關閉</button>
      </div>
    </div>

    <!-- 新增/編輯 Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal = false">
      <div class="bg-white rounded-2xl p-5 sm:p-7 w-[480px] lg:w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯品項' : '新增品項' }}</h3>

        <p v-if="formError" class="text-xs text-red-600 mb-3">{{ formError }}</p>
        <!-- 夠寬（lg 以上）時分左右兩欄：左邊基本資料與售價設定，右邊圖片、站別、物料；窄螢幕和手機維持單欄 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">品項名稱 *</label>
                <input v-model="form.name" type="text" class="ifield" placeholder="例：巧克力餅乾一盒">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">{{ form.openPrice ? '參考售價（選填）' : '售價 *' }}</label>
                <input v-model.number="form.price" type="number" class="ifield" :placeholder="form.openPrice ? '結帳時再輸入' : '0'">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">分類</label>
                <div v-if="!quickCat.open" class="flex gap-1.5 items-center">
                  <select v-model="form.category" class="ifield" style="flex:1; min-width:0">
                    <option value="">（未分類）</option>
                    <option v-for="c in categoryList" :key="c.name" :value="c.name">{{ c.name }}</option>
                  </select>
                  <button @click="quickCat.open = true; quickCat.name = ''; quickCat.error = ''" class="text-xs text-green-600 hover:underline whitespace-nowrap" title="新增分類">＋新增</button>
                </div>
                <div v-else class="flex gap-1.5 items-center">
                  <input v-model="quickCat.name" type="text" class="ifield" style="min-width:0" placeholder="新分類名稱" @keyup.enter="addQuickCat">
                  <button @click="addQuickCat" :disabled="quickCat.saving" class="text-xs text-green-600 hover:underline whitespace-nowrap">確定</button>
                  <button @click="quickCat.open = false" class="text-xs text-gray-400 hover:underline whitespace-nowrap">取消</button>
                </div>
                <p v-if="quickCat.error" class="text-xs text-red-600 mt-1">{{ quickCat.error }}</p>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">備註</label>
                <input v-model="form.note" type="text" class="ifield" placeholder="例：30入">
              </div>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-2 block">售價方式</label>
              <label class="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" v-model="form.openPrice" class="w-4 h-4 accent-orange-500">
                <span class="text-sm text-gray-700">✏️ 時價／自訂價錢（結帳時輸入售價）</span>
              </label>
              <p class="text-xs text-gray-400 mt-1 ml-6">勾選後收銀點這個品項會跳出輸入金額；上面的售價只當預設值，可留 0</p>
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
              <label class="text-xs text-gray-500 mb-1 block">排列順序</label>
              <input v-model.number="form.sortOrder" type="number" min="1" class="ifield w-24">
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">圖片（存在資料機，收銀台卡片會顯示）</label>
              <p class="text-xs text-gray-400 mb-2">建議比例 <b class="text-gray-600">4:3 橫式</b>，建議尺寸 <b class="text-gray-600">1200×900 px</b>（最小 800×600）。其他比例會在收銀卡片上自動裁掉上下或左右，主體請放中間。</p>
              <div class="flex items-center gap-3">
                <img v-if="imageFile && imagePreview" :src="imagePreview" alt="品項圖片" class="w-20 h-15 object-cover rounded-lg bg-gray-100">
                <CatalogImg v-else-if="imagePreview" :file="imagePreview" alt="品項圖片" class="w-20 h-15 object-cover rounded-lg bg-gray-100" />
                <div v-else class="w-20 h-15 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">無圖片</div>
                <label class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer">
                  選擇圖片
                  <input type="file" accept="image/*" class="hidden" @change="pickImage">
                </label>
                <button v-if="imagePreview" @click="removeImage" class="text-xs text-red-400 hover:underline">移除</button>
              </div>
              <p v-if="imageInfo" class="text-xs mt-1.5" :class="imageInfo.warn ? 'text-amber-600' : 'text-green-600'">{{ imageInfo.text }}</p>
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
              <label class="text-xs text-gray-500 mb-2 block">消耗物料（選填）</label>
              <div class="space-y-2">
                <div v-for="(pm, i) in form.materials" :key="i" class="flex gap-2 items-center">
                  <select
                    v-model.number="pm.materialId"
                    style="flex:1; min-width:0; border:1px solid #e5e7eb; border-radius:8px; padding:7px 10px; font-size:13px; background:#fff; color:#111; outline:none;"
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

const { products, materials, stations, stationName, categoryList } = usePosStore()
const cat = useCatalog()
const catState = cat.state

const filterLoc = ref('')   // '' = 全部，其他 = 站別 id
const filterCat = ref('')   // '' = 全部，NO_CAT = 未分類，其他 = 分類名稱
const NO_CAT = '\u0000none'
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

const defaultForm = () => ({
  name: '', price: 0, category: '', note: '',
  cashOnly: false,
  openPrice: false,
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
  checkImageSize(imagePreview.value)
}

// 選圖後檢查比例和大小（收銀卡片是 4:3），提醒會被裁切或太小
const imageInfo = ref<{ text: string; warn: boolean } | null>(null)
function checkImageSize(url: string) {
  imageInfo.value = null
  const img = new Image()
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return
    const r = w / h
    const size = `這張 ${w}×${h} px`
    if (w < 800 || h < 600) imageInfo.value = { text: `${size}，有點小，收銀卡片可能會模糊（建議至少 800×600）`, warn: true }
    else if (r > 4 / 3 * 1.1) imageInfo.value = { text: `${size}，比 4:3 寬，卡片會裁掉左右兩邊`, warn: true }
    else if (r < 4 / 3 / 1.1) imageInfo.value = { text: `${size}，比 4:3 高，卡片會裁掉上下`, warn: true }
    else imageInfo.value = { text: `${size}，比例 OK`, warn: false }
  }
  img.src = url
}
function removeImage() {
  imageInfo.value = null
  imageFile.value = null
  imageRemoved.value = true
  imagePreview.value = ''
}

const filteredProducts = computed(() =>
  products.value
    .filter(p => !filterLoc.value || p.locations.includes(filterLoc.value))
    .filter(p => !filterCat.value || (filterCat.value === NO_CAT ? !(p.category || '').trim() : p.category === filterCat.value))
    .sort((a, b) => a.sortOrder - b.sortOrder)
)

function getMaterialName(id: number) {
  return materials.value.find(m => m.id === id)?.name ?? '?'
}

function resetImage(prod?: Product) {
  imageInfo.value = null
  imageFile.value = null
  imageRemoved.value = false
  imagePreview.value = prod?.image ?? ''  // 檔名；<CatalogImg> 負責取圖
}

function openAdd() {
  editId.value = null
  form.value = defaultForm()
  // 新增時預設勾目前篩選的站
  if (filterLoc.value) form.value.locations = [filterLoc.value]
  if (filterCat.value && filterCat.value !== NO_CAT) form.value.category = filterCat.value
  resetImage()
  formError.value = ''
  quickCat.open = false
  quickCat.error = ''
  showModal.value = true
}

function openEdit(prod: Product) {
  editId.value = prod.id
  form.value = {
    name: prod.name, price: prod.price, category: prod.category,
    note: prod.note, cashOnly: prod.cashOnly, openPrice: !!prod.openPrice,
    locations: [...prod.locations],
    sortOrder: prod.sortOrder,
    materials: prod.materials.map(m => ({ ...m })),
  }
  resetImage(prod)
  formError.value = ''
  quickCat.open = false
  quickCat.error = ''
  showModal.value = true
}

async function saveProduct() {
  if (!form.value.name || (!form.value.price && !form.value.openPrice)) { formError.value = '請填品項名稱和售價（時價品項可不填售價）'; return }
  if (form.value.price < 0) { formError.value = '售價不能是負數'; return }
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

// ---- 分類 ----
// 舊版 print-agent 沒有分類 API 時，給看得懂的訊息
function catMsg(e: unknown) {
  const m = (e as Error)?.message ?? String(e)
  return /沒有這個功能/.test(m) ? '資料機的 print-agent 還是舊版，要更新到 1.8 才能管理分類（' + m + '）' : m
}
function productCount(name: string) {
  return name ? products.value.filter(p => p.category === name).length : 0
}

// 品項編輯視窗裡的「＋新增」：新增後直接選它
const quickCat = reactive({ open: false, name: '', error: '', saving: false })
async function addQuickCat() {
  const name = quickCat.name.trim()
  if (!name) { quickCat.error = '請輸入分類名稱'; return }
  quickCat.saving = true
  quickCat.error = ''
  try {
    if (!categoryList.value.some(c => c.name === name)) await cat.saveCategory({ name })
    form.value.category = name
    quickCat.open = false
  } catch (e) {
    quickCat.error = catMsg(e)
  } finally {
    quickCat.saving = false
  }
}

// 分類管理視窗
const showCats   = ref(false)
const catBusy    = ref(false)
const catError   = ref('')
const newCatName = ref('')
const catRows    = ref<{ key: string; id: string; name: string; orig: string; sortOrder: number }[]>([])
function refreshCatRows() {
  catRows.value = categoryList.value.map((c, i) => ({ key: c.id || 'n:' + c.name, id: c.id, name: c.name, orig: c.name, sortOrder: i + 1 }))
}
function openCats() {
  refreshCatRows()
  catError.value = ''
  newCatName.value = ''
  showCats.value = true
}
async function runCat(job: () => Promise<void>) {
  catBusy.value = true
  catError.value = ''
  try { await job() } catch (e) { catError.value = catMsg(e) } finally { catBusy.value = false; refreshCatRows() }
}
function addCat() {
  const name = newCatName.value.trim()
  if (!name) { catError.value = '請輸入分類名稱'; return }
  runCat(async () => { await cat.saveCategory({ name }); newCatName.value = '' })
}
function renameCat(c: { id: string; name: string; orig: string; sortOrder: number }) {
  const name = c.name.trim()
  if (!name) { catError.value = '分類名稱不能空白'; return }
  if (name === c.orig) return
  // 清單裡還沒有的（舊資料只寫在品項上）：用舊名建一筆再改名，品項才會一起改
  runCat(async () => {
    let id = c.id
    if (!id) { await cat.saveCategory({ name: c.orig }); id = categoryList.value.find(x => x.name === c.orig)?.id || '' }
    await cat.saveCategory({ id, name, sortOrder: c.sortOrder })
  })
}
function removeCat(c: { id: string; orig: string }) {
  const n = productCount(c.orig)
  if (n) { catError.value = `還有 ${n} 個品項是「${c.orig}」，請先把它們改到別的分類再刪`; return }
  if (!c.id) return
  if (!confirm(`確定刪除分類「${c.orig}」？`)) return
  runCat(() => cat.deleteCategory(c.id))
}
function moveCat(i: number, d: number) {
  const rows = catRows.value.slice()
  const j = i + d
  if (j < 0 || j >= rows.length) return
  const t = rows[i]!; rows[i] = rows[j]!; rows[j] = t
  // 重新編號，只送有變的
  runCat(async () => {
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k]!
      const cur = categoryList.value.find(x => x.name === r.orig)
      if (cur && cur.id && cur.sortOrder === k + 1) continue
      await cat.saveCategory({ id: cur?.id || undefined, name: r.orig, sortOrder: k + 1 })
    }
  })
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
