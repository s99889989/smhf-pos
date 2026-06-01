<template>
  <div class="flex h-full">

    <!-- 品項區 -->
    <div class="flex flex-col flex-1 overflow-hidden">

      <!-- 地點切換 -->
      <div class="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3">
        <button
          v-for="loc in locations" :key="loc.value"
          @click="curLoc = loc.value"
          class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors border"
          :class="curLoc === loc.value
            ? 'bg-green-700 text-white border-green-700'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'"
        >{{ loc.label }}</button>
      </div>

      <!-- 分類 -->
      <div class="bg-white border-b border-gray-200 px-5 py-2.5 flex gap-2 overflow-x-auto">
        <button
          v-for="c in categories" :key="c"
          @click="curCat = c"
          class="px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border"
          :class="curCat === c
            ? 'bg-gray-100 text-gray-900 border-gray-400 font-medium'
            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
        >{{ c }}</button>
      </div>

      <!-- 品項卡片 -->
      <div class="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 content-start">
        <button
          v-for="prod in filteredProducts" :key="prod.id"
          @click="addItem(prod)"
          class="relative text-left bg-white border rounded-xl p-3.5 active:scale-95 transition-all"
          :class="prod.cashOnly && curPay !== 'cash'
            ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
            : 'border-gray-200 hover:border-green-500 hover:bg-green-50'"
        >
          <span v-if="cartQty(prod.id)" class="absolute top-2 right-2 bg-green-700 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {{ cartQty(prod.id) }}
          </span>
          <div class="text-sm font-medium text-gray-900 leading-snug mb-1.5">{{ prod.name }}</div>
          <div class="flex items-baseline gap-1.5">
            <div class="text-base font-bold text-green-700">${{ discountedPrice(prod.price) }}</div>
            <div v-if="curDiscount && curDiscount.rate < 1" class="text-xs text-gray-400 line-through">${{ prod.price }}</div>
          </div>
          <div v-if="prod.note" class="text-xs text-gray-400 mt-0.5">{{ prod.note }}</div>
          <div v-if="prod.cashOnly" class="text-xs text-amber-600 mt-1 font-medium">💵 限現金</div>
        </button>
        <div v-if="!filteredProducts.length" class="col-span-full flex items-center justify-center py-20 text-gray-400 text-sm">
          此地點沒有此分類的品項
        </div>
      </div>
    </div>

    <!-- 訂單區 -->
    <div class="w-80 border-l border-gray-200 bg-white flex flex-col shrink-0">

      <div class="px-4 py-3.5 border-b border-gray-200 flex justify-between items-center">
        <span class="font-semibold text-gray-900">訂單明細</span>
        <button @click="clearCart" class="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">✕ 清空</button>
      </div>

      <!-- 折扣選擇（動態從設定讀取） -->
      <div class="px-3 pt-3 pb-2 border-b border-gray-100">
        <div class="text-xs text-gray-400 mb-1.5">折扣類型</div>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="d in enabledDiscounts" :key="d.id"
            @click="setDiscount(d)"
            class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
            :class="curDiscount?.id === d.id
              ? 'bg-purple-50 text-purple-700 border-purple-400'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
          >
            {{ d.label }}
            <span v-if="d.rate < 1" class="ml-1 opacity-70">{{ rateLabel(d.rate) }}</span>
          </button>
        </div>
      </div>

      <!-- 訂單列表 -->
      <div class="flex-1 overflow-y-auto px-3 py-2">
        <div v-if="!cart.length" class="h-full flex flex-col items-center justify-center gap-2 text-gray-300">
          <span class="text-4xl">🛒</span>
          <span class="text-sm">尚未選擇品項</span>
        </div>
        <div v-for="(item, i) in cart" :key="item.productId" class="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-gray-900 font-medium truncate">{{ item.name }}</div>
            <div class="flex items-baseline gap-1 text-xs text-gray-400">
              <span v-if="curDiscount && curDiscount.rate < 1" class="line-through">${{ item.price }}</span>
              <span class="text-green-600 font-medium">${{ item.finalPrice }}</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button @click="changeQty(i, -1)" class="w-6 h-6 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-100 text-sm leading-none">−</button>
            <span class="w-6 text-center text-sm font-semibold">{{ item.qty }}</span>
            <button @click="changeQty(i, 1)"  class="w-6 h-6 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-100 text-sm leading-none">+</button>
          </div>
          <div class="text-sm font-medium text-gray-900 w-14 text-right">${{ item.finalPrice * item.qty }}</div>
        </div>
      </div>

      <!-- 結帳區 -->
      <div class="border-t border-gray-200 p-4">
        <div v-if="curDiscount && curDiscount.rate < 1" class="space-y-1 mb-2">
          <div class="flex justify-between text-xs text-gray-400">
            <span>小計</span><span>${{ subtotal }}</span>
          </div>
          <div class="flex justify-between text-xs text-purple-600 font-medium">
            <span>{{ curDiscount.label }} {{ rateLabel(curDiscount.rate) }}</span>
            <span>- ${{ subtotal - total }}</span>
          </div>
        </div>
        <div class="flex justify-between items-baseline mb-4">
          <span class="text-sm text-gray-500">合計金額</span>
          <span class="text-2xl font-bold text-gray-900">${{ total }}</span>
        </div>

        <!-- 付款方式 -->
        <div class="grid grid-cols-4 gap-1.5 mb-2">
          <button
            v-for="p in payMethods" :key="p.value"
            @click="setPay(p.value)"
            :disabled="hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher'"
            class="py-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-0.5 transition-colors"
            :class="[
              curPay === p.value ? 'bg-green-50 text-green-700 border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50',
              hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher' ? 'opacity-40 cursor-not-allowed' : ''
            ]"
          >
            <span class="text-base">{{ p.icon }}</span>{{ p.label }}
          </button>
        </div>

        <!-- 消費券金額輸入 -->
        <div v-if="curPay === 'voucher'" class="mb-2 bg-amber-50 rounded-xl p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-amber-700 font-medium whitespace-nowrap">🎟 消費券</span>
            <input v-model.number="voucherAmount" type="number" min="0"
              style="flex:1; border:1px solid #f59e0b; border-radius:8px; padding:5px 10px; font-size:14px; font-weight:600; outline:none; background:#fff; color:#92400e; text-align:right;"
              placeholder="0">
            <span class="text-xs text-amber-700">元</span>
          </div>
          <!-- 消費券超過總價警示 -->
          <div v-if="voucherExceeds" class="text-xs text-red-600 font-medium flex items-center gap-1">
            ⚠️ 消費券面額 ${{ voucherAmount }} 超過應付 ${{ total }}，請調整
          </div>
          <!-- 需補差額提示 -->
          <div v-else-if="voucherAmount > 0 && cashNeeded > 0" class="border-t border-amber-200 pt-2 flex justify-between text-xs text-amber-700">
            <span>需補差額（現金）</span>
            <span class="font-bold">${{ cashNeeded }}</span>
          </div>
          <div v-else-if="voucherAmount > 0 && cashNeeded === 0" class="border-t border-amber-200 pt-2 text-xs text-green-700 font-medium">
            ✓ 消費券足額支付
          </div>
        </div>

        <!-- 現金找零（現金，或消費券需補差額時） -->
        <div v-if="showCashInput" class="mb-2 bg-gray-50 rounded-xl p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-600 font-medium whitespace-nowrap">💵 收到現金</span>
            <input v-model.number="receivedCash" type="number" min="0"
              style="flex:1; border:1px solid #d1d5db; border-radius:8px; padding:5px 10px; font-size:14px; font-weight:600; outline:none; background:#fff; color:#111; text-align:right;"
              placeholder="0">
            <span class="text-xs text-gray-500">元</span>
          </div>
          <!-- 快速金額 -->
          <div class="flex gap-1.5 flex-wrap">
            <button v-for="q in quickCash" :key="q"
              @click="receivedCash = q"
              class="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors">
              ${{ q }}
            </button>
          </div>
          <!-- 找零 -->
          <div v-if="receivedCash > 0" class="flex justify-between items-center pt-1 border-t border-gray-200">
            <span class="text-sm font-medium text-gray-600">找零</span>
            <span class="text-xl font-bold" :class="change >= 0 ? 'text-green-700' : 'text-red-500'">
              {{ change >= 0 ? '$' + change : '不足 $' + Math.abs(change) }}
            </span>
          </div>
        </div>

        <div v-if="hasCashOnlyItem" class="text-xs text-amber-600 mb-2 text-center">⚠️ 訂單含限現金品項</div>

        <button
          @click="startCheckout"
          :disabled="!cart.length || voucherExceeds"
          class="w-full py-3 rounded-xl font-bold text-base transition-colors"
          :class="cart.length && !voucherExceeds ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
        >結帳</button>
      </div>
    </div>

    <!-- 員工選擇 Modal -->
    <div v-if="showStaffModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showStaffModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">選擇員工</h3>
        <p class="text-sm text-gray-500 mb-4">請選擇此次消費的員工</p>
        <div class="space-y-2 mb-5 max-h-52 overflow-y-auto">
          <button v-for="emp in activeEmployees" :key="emp.id"
            @click="selectedStaffId = emp.id"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
            :class="selectedStaffId === emp.id ? 'bg-green-50 border-green-500' : 'border-gray-200 hover:bg-gray-50'">
            <span class="font-mono text-xs text-gray-400">{{ emp.id }}</span>
            <span class="font-medium text-gray-900">{{ emp.name }}</span>
            <span v-if="selectedStaffId === emp.id" class="ml-auto text-green-600">✓</span>
          </button>
        </div>
        <div class="flex gap-2">
          <button @click="showStaffModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmStaff" :disabled="!selectedStaffId"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            :class="selectedStaffId ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            確認
          </button>
        </div>
      </div>
    </div>

    <!-- VIP 驗證 Modal -->
    <div v-if="showVipModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showVipModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">VIP 驗證</h3>
        <p class="text-sm text-gray-500 mb-4">請輸入 VIP 號碼</p>
        <input v-model="vipInput" ref="vipInputRef" type="text" placeholder="例：155375"
          class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-2 focus:outline-none focus:border-purple-500">
        <div v-if="vipInput && !vipFound" class="text-xs text-red-500 mb-3">找不到此 VIP 號碼</div>
        <div v-if="vipFound" class="bg-purple-50 rounded-xl px-4 py-2.5 text-sm text-purple-700 mb-3 font-medium">
          ✓ {{ vipFound.name }}
        </div>
        <div class="flex gap-2">
          <button @click="showVipModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmVip" :disabled="!vipFound"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            :class="vipFound ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            確認
          </button>
        </div>
      </div>
    </div>

    <!-- 載具 Modal -->
    <div v-if="showCarrierModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showCarrierModal = false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">統一發票</h3>
        <p class="text-sm text-gray-500 mb-5 leading-relaxed">
          請輸入載具條碼（手機條碼 / 自然人憑證），<br>若無載具將印出紙本二聯式發票。
        </p>
        <input
          v-model="carrier" ref="carrierInput" type="text"
          placeholder="/ 開頭的手機條碼，或留空" maxlength="20"
          class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-green-500"
        >
        <div class="flex gap-2">
          <button @click="showCarrierModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmCheckout" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">確認結帳</button>
        </div>
      </div>
    </div>

    <!-- 收據 Modal -->
    <div v-if="showReceipt && lastOrder" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-2xl w-80 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="p-7">
          <div class="text-center mb-4">
            <div class="text-green-700 font-bold text-lg">聖母健康農莊</div>
            <div class="text-gray-400 text-xs mt-0.5">St. Mary's Health Farm, Taitung</div>
          </div>
          <hr class="border-dashed border-gray-200 my-4">
          <div class="text-xs text-gray-500 space-y-1 mb-3">
            <div class="flex justify-between"><span>單號</span><span class="text-gray-800 font-medium">{{ lastOrder.no }}</span></div>
            <div class="flex justify-between"><span>日期</span><span class="text-gray-800">{{ formatDate(lastOrder.createdAt) }}</span></div>
            <div class="flex justify-between"><span>地點</span><span class="text-gray-800">{{ LOC_LABEL[lastOrder.location] }}</span></div>
            <div v-if="lastOrder.discountLabel" class="flex justify-between">
              <span>折扣</span><span class="text-purple-600 font-medium">{{ lastOrder.discountLabel }}</span>
            </div>
          </div>
          <hr class="border-dashed border-gray-200 my-3">
          <table class="w-full text-xs mb-2">
            <thead>
              <tr class="text-gray-400 border-b border-gray-200">
                <th class="text-left pb-1.5 font-medium">品項</th>
                <th class="text-center pb-1.5 font-medium">數量</th>
                <th class="text-right pb-1.5 font-medium">小計</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in lastOrder.items" :key="item.productId" class="border-b border-gray-100">
                <td class="py-1.5 text-gray-800">{{ item.name }}</td>
                <td class="text-center text-gray-600">{{ item.qty }}</td>
                <td class="text-right text-gray-800">${{ item.finalPrice * item.qty }}</td>
              </tr>
            </tbody>
          </table>
          <hr class="border-dashed border-gray-200 my-3">
          <div v-if="lastOrder.subtotal !== lastOrder.total">
            <div class="flex justify-between text-xs text-gray-400 mb-1"><span>小計</span><span>${{ lastOrder.subtotal }}</span></div>
            <div class="flex justify-between text-xs text-purple-600 mb-1"><span>折扣</span><span>- ${{ lastOrder.subtotal - lastOrder.total }}</span></div>
          </div>
          <div class="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
            <span>合計</span><span>${{ lastOrder.total }}</span>
          </div>
          <div class="flex justify-between text-xs text-gray-400 mt-1">
            <span>付款方式</span>
            <span>{{ lastOrder.payDetail || PAY_LABEL[lastOrder.payMethod] }}</span>
          </div>
          <div v-if="lastOrder.receivedCash > 0" class="flex justify-between text-xs text-gray-400 mt-1">
            <span>收到現金</span><span>${{ lastOrder.receivedCash }}</span>
          </div>
          <div v-if="lastOrder.receivedCash > 0" class="flex justify-between text-sm font-bold text-green-700 mt-1">
            <span>找零</span><span>${{ lastOrder.change }}</span>
          </div>
          <div class="mt-4 rounded-xl p-3" :class="lastOrder.carrier ? 'bg-green-50' : 'bg-amber-50'">
            <div class="text-xs font-semibold mb-1" :class="lastOrder.carrier ? 'text-green-700' : 'text-amber-700'">
              {{ lastOrder.carrier ? '📱 載具歸戶' : '🧾 紙本二聯式發票' }}
            </div>
            <div class="text-sm font-medium" :class="lastOrder.carrier ? 'text-green-800' : 'text-amber-800'">
              {{ lastOrder.carrier || '請至發票機取件' }}
            </div>
          </div>
          <div class="text-center text-xs text-gray-400 mt-5 leading-6">感謝您的惠顧<br>歡迎再次蒞臨</div>
        </div>
        <div class="flex gap-2 px-5 pb-5">
          <button @click="printReceipt" class="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 font-medium transition-colors">🖨 列印收據</button>
          <button @click="finishOrder" class="flex-1 py-2.5 rounded-xl bg-green-700 hover:bg-green-800 text-white text-sm font-semibold transition-colors">完成</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { LOC_LABEL, PAY_LABEL } from '~/composables/usePosStore'
import type { Product, DiscountType } from '~/composables/usePosStore'

const { products, discountTypes, employees, vipMembers, addOrder } = usePosStore()

const locations = [
  { value: 'restaurant', label: '餐廳' },
  { value: 'shop',       label: '小舖' },
  { value: 'stall',      label: '擺攤' },
] as const

const payMethods = [
  { value: 'cash',    icon: '💵', label: '現金' },
  { value: 'card',    icon: '💳', label: '信用卡' },
  { value: 'hua',     icon: '📱', label: '華南Q' },
  { value: 'voucher', icon: '🎟', label: '消費券' },
] as const

const enabledDiscounts = computed(() => discountTypes.value.filter(d => d.enabled))

const curLoc      = ref<'restaurant' | 'shop' | 'stall'>('restaurant')
const curCat      = ref('全部')
const curPay      = ref<'cash' | 'card' | 'hua' | 'voucher'>('cash')
const voucherAmount = ref(0)
const receivedCash  = ref(0)

// 消費券補差額：消費券不足時需要現金補足
const cashNeeded = computed(() =>
  curPay.value === 'voucher' ? Math.max(0, total.value - voucherAmount.value) : 0
)
// 消費券超過總價
const voucherExceeds = computed(() =>
  curPay.value === 'voucher' && voucherAmount.value > total.value
)
// 顯示現金輸入：純現金，或消費券需補差額
const showCashInput = computed(() =>
  curPay.value === 'cash' ||
  (curPay.value === 'voucher' && !voucherExceeds.value)
)
// 找零基準：純現金用 total，消費券用 cashNeeded
const change = computed(() => {
  if (curPay.value === 'cash') return receivedCash.value - total.value
  if (curPay.value === 'voucher') return receivedCash.value - cashNeeded.value
  return 0
})
// 快速現金按鈕
const quickCash = computed(() => {
  const need = curPay.value === 'voucher' ? cashNeeded.value : total.value
  return [50, 100, 200, 500, 1000].filter(v => v >= need).slice(0, 4)
})
const curDiscount = ref<DiscountType | null>(null)
const cart        = ref<any[]>([])

const showCarrierModal = ref(false)
const showReceipt      = ref(false)
const showStaffModal   = ref(false)
const showVipModal     = ref(false)
const carrier          = ref('')
const carrierInput     = ref<HTMLInputElement | null>(null)
const lastOrder        = ref<any>(null)
const selectedStaffId  = ref('')
const vipInput         = ref('')
const vipInputRef      = ref<HTMLInputElement | null>(null)

const activeEmployees = computed(() => employees.value.filter(e => e.enabled))
const vipFound = computed(() => {
  if (!vipInput.value) return null
  return vipMembers.value.find(v => v.id === vipInput.value && v.enabled) ?? null
})

// 結帳流程：先判斷折扣類型是否需要員工/VIP驗證
function startCheckout() {
  if (!cart.value.length) return
  if (curDiscount.value?.requireStaff) {
    selectedStaffId.value = ''
    showStaffModal.value = true
  } else if (curDiscount.value?.requireVip) {
    vipInput.value = ''
    showVipModal.value = true
    nextTick(() => vipInputRef.value?.focus())
  } else {
    openCarrierModal()
  }
}

function confirmStaff() {
  if (!selectedStaffId.value) return
  showStaffModal.value = false
  openCarrierModal()
}

function confirmVip() {
  if (!vipFound.value) return
  showVipModal.value = false
  openCarrierModal()
}

// 預設選第一個折扣
onMounted(() => {
  if (enabledDiscounts.value.length) curDiscount.value = enabledDiscounts.value[0]
})
watch(enabledDiscounts, (list) => {
  if (!curDiscount.value && list.length) curDiscount.value = list[0]
})

// 0.95 → "9.5折", 0.9 → "9折"
function rateLabel(rate: number) {
  const n = rate * 10
  return (Number.isInteger(n) ? n : parseFloat(n.toFixed(1))) + '折'
}

function discountedPrice(price: number) {
  const rate = curDiscount.value?.rate ?? 1
  return Math.round(price * rate)
}

const hasCashOnlyItem = computed(() =>
  cart.value.some(i => products.value.find(p => p.id === i.productId)?.cashOnly)
)

function setDiscount(d: DiscountType) {
  curDiscount.value = d
  cart.value.forEach(item => { item.finalPrice = Math.round(item.price * d.rate) })
}

function setPay(p: 'cash' | 'card' | 'hua' | 'voucher') {
  if (hasCashOnlyItem.value && p !== 'cash' && p !== 'voucher') return
  curPay.value = p
  if (p !== 'voucher') voucherAmount.value = 0
  receivedCash.value = 0
}

function addItem(prod: Product) {
  if (prod.cashOnly && curPay.value !== 'cash') curPay.value = 'cash'
  const ex = cart.value.find(i => i.productId === prod.id)
  if (ex) { ex.qty++; return }
  cart.value.push({
    productId: prod.id,
    name: prod.name,
    price: prod.price,
    finalPrice: discountedPrice(prod.price),
    qty: 1,
  })
}

const locProducts = computed(() =>
  products.value.filter(p => p.locations.includes(curLoc.value)).sort((a, b) => a.sortOrder - b.sortOrder)
)
const categories = computed(() => ['全部', ...new Set(locProducts.value.map(p => p.category))])
const filteredProducts = computed(() =>
  curCat.value === '全部' ? locProducts.value : locProducts.value.filter(p => p.category === curCat.value)
)
const subtotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0))
const total    = computed(() => cart.value.reduce((s, i) => s + i.finalPrice * i.qty, 0))

function cartQty(id: number) { return cart.value.find(i => i.productId === id)?.qty ?? 0 }
function changeQty(idx: number, d: number) {
  cart.value[idx].qty += d
  if (cart.value[idx].qty <= 0) cart.value.splice(idx, 1)
}
function clearCart() { cart.value = [] }

function openCarrierModal() {
  if (!cart.value.length) return
  carrier.value = ''
  showCarrierModal.value = true
  nextTick(() => carrierInput.value?.focus())
}

function confirmCheckout() {
  showCarrierModal.value = false
  const va = Math.min(voucherAmount.value, total.value)
  const payDetail = curPay.value === 'mixed' && va > 0
    ? `消費券 $${va} + 現金 $${total.value - va}`
    : curPay.value === 'voucher' ? `消費券 $${va}` : ''

  const order = {
    location: curLoc.value,
    items: cart.value.map(i => ({ ...i })),
    subtotal: subtotal.value,
    discount: String(curDiscount.value?.id ?? ''),
    discountLabel: curDiscount.value && curDiscount.value.rate < 1
      ? `${curDiscount.value.label} ${rateLabel(curDiscount.value.rate)}` : '',
    staffId: curDiscount.value?.requireStaff ? selectedStaffId.value : '',
    vipId:   curDiscount.value?.requireVip   ? vipInput.value : '',
    total: total.value,
    voucherAmount: va,
    receivedCash: receivedCash.value,
    change: change.value >= 0 ? change.value : 0,
    payMethod: curPay.value,
    payDetail,
    carrier: carrier.value,
  }
  addOrder(order)
  const { orders } = usePosStore()
  lastOrder.value = orders.value[0]
  showReceipt.value = true
  cart.value = []
  curDiscount.value = enabledDiscounts.value[0] ?? null
  voucherAmount.value = 0
  receivedCash.value = 0
}

function printReceipt() { alert('已送出列印指令（收據機）') }
function finishOrder()  { showReceipt.value = false }
function formatDate(d: Date) {
  return new Date(d).toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

watch(curLoc, () => { curCat.value = '全部' })
</script>
