<template>
  <div class="min-h-screen bg-gray-50">

    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div class="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-green-700 text-xl">🌿</span>
          <div>
            <div class="text-green-700 font-bold text-sm">聖母健康農莊</div>
            <div class="text-xs text-gray-400">線上選購</div>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <ThemeToggle large />
          <!-- 已登入 -->
          <div v-if="user" class="flex items-center gap-2">
            <div class="text-right">
              <div class="text-sm font-medium text-gray-900">{{ user.name }}</div>
              <div class="text-xs" :class="user.memberType === 'vip' ? 'text-purple-600' : user.memberType === 'staff' ? 'text-green-600' : 'text-gray-400'">
                {{ user.memberType === 'vip' ? `⭐ VIP ${user.memberId}` : user.memberType === 'staff' ? `👤 員工 ${user.memberId}` : '一般會員' }}
              </div>
            </div>
            <button @click="logout" class="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg">登出</button>
          </div>
          <!-- 未登入 -->
          <button v-else @click="showLoginModal = true"
            class="flex items-center gap-2 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-sm text-gray-700">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            使用 Google 登入
          </button>
          <!-- 購物車 -->
          <button @click="showCart = true"
            class="relative bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-800 transition-colors">
            🛒
            <span v-if="cartCount" class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {{ cartCount }}
            </span>
          </button>
        </div>
      </div>
    </header>

    <!-- 會員優惠提示 -->
    <div v-if="user && user.memberType !== 'none'" class="max-w-3xl mx-auto px-5 pt-4">
      <div class="rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
        :class="user.memberType === 'vip' ? 'bg-purple-50 text-purple-700' : 'bg-green-50 text-green-700'">
        <span>{{ user.memberType === 'vip' ? '⭐' : '👤' }}</span>
        <span>您好 {{ user.name }}！您享有{{ user.memberType === 'vip' ? ' VIP 9折' : '員工 95折' }}優惠，結帳時將自動套用。</span>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-5 py-5">
      <!-- 分類 -->
      <div class="flex gap-2 overflow-x-auto mb-5 pb-1">
        <button v-for="c in categories" :key="c"
          @click="curCat = c"
          class="px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors shrink-0"
          :class="curCat === c ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-500 border-gray-200 hover:bg-green-50'">
          {{ c }}
        </button>
      </div>

      <!-- 商品列表 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div v-for="prod in filteredProducts" :key="prod.id"
          class="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-sm transition-all">
          <div class="bg-gradient-to-br from-green-50 to-emerald-100 h-32 flex items-center justify-center text-5xl">
            {{ prodEmoji(prod.category) }}
          </div>
          <div class="p-4">
            <div class="font-medium text-gray-900 text-sm mb-0.5">{{ prod.name }}</div>
            <div v-if="prod.note" class="text-xs text-gray-400 mb-2">{{ prod.note }}</div>
            <div class="flex items-center justify-between">
              <div>
                <span class="text-base font-bold text-green-700">${{ discountedPrice(prod.price) }}</span>
                <span v-if="userDiscount < 1" class="text-xs text-gray-400 line-through ml-1">${{ prod.price }}</span>
              </div>
              <button @click="addToCart(prod)"
                class="bg-green-700 hover:bg-green-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors active:scale-95">
                加入
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 購物車側邊 -->
    <div v-if="showCart" class="fixed inset-0 bg-black/40 z-50 flex justify-end" @click.self="showCart=false">
      <div class="bg-white w-80 h-full flex flex-col shadow-2xl">
        <div class="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
          <span class="font-bold text-gray-900">購物車</span>
          <button @click="showCart=false" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div class="flex-1 overflow-y-auto p-4">
          <div v-if="!cart.length" class="h-full flex items-center justify-center text-gray-300 text-sm">購物車是空的</div>
          <div v-for="(item, i) in cart" :key="item.productId" class="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">{{ item.name }}</div>
              <div class="text-xs text-green-600">${{ item.finalPrice }}</div>
            </div>
            <div class="flex items-center gap-1">
              <button @click="changeQty(i,-1)" class="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-100">−</button>
              <span class="w-6 text-center text-sm font-semibold">{{ item.qty }}</span>
              <button @click="changeQty(i,1)" class="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-sm hover:bg-gray-100">+</button>
            </div>
            <div class="text-sm font-medium w-14 text-right">${{ item.finalPrice * item.qty }}</div>
          </div>
        </div>
        <div class="border-t border-gray-200 p-4">
          <div class="flex justify-between font-bold text-gray-900 mb-4">
            <span>合計</span><span>${{ cartTotal }}</span>
          </div>
          <button @click="showCart=false; showOrderForm=true"
            :disabled="!cart.length"
            class="w-full py-3 rounded-xl font-bold text-sm transition-colors"
            :class="cart.length ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            前往結帳
          </button>
        </div>
      </div>
    </div>

    <!-- 訂購資料 Modal -->
    <div v-if="showOrderForm" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div class="p-6">
          <h3 class="text-base font-bold text-gray-900 mb-5">填寫訂購資料</h3>
          <div class="space-y-3">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">姓名 *</label>
              <input v-model="orderForm.customerName" type="text" class="ifield" placeholder="收件人姓名">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">電話 *</label>
              <input v-model="orderForm.customerPhone" type="text" class="ifield" placeholder="0912-345-678">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">收件地址 *</label>
              <input v-model="orderForm.customerAddress" type="text" class="ifield" placeholder="縣市 鄉鎮市區 詳細地址">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">付款方式</label>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="p in payOptions" :key="p.value" @click="orderForm.payMethod = p.value"
                  class="py-2.5 rounded-xl border text-sm font-medium transition-colors"
                  :class="orderForm.payMethod === p.value ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'">
                  {{ p.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">物流方式</label>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="s in shippingOptions" :key="s.value" @click="orderForm.shippingCompany = s.value"
                  class="py-2.5 rounded-xl border text-sm font-medium transition-colors"
                  :class="orderForm.shippingCompany === s.value ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'">
                  {{ s.label }}
                </button>
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">載具（選填）</label>
              <input v-model="orderForm.carrier" type="text" class="ifield" placeholder="手機條碼或留空">
            </div>
            <div>
              <label class="text-xs text-gray-500 mb-1 block">備註</label>
              <input v-model="orderForm.note" type="text" class="ifield" placeholder="">
            </div>
          </div>
          <!-- 訂單摘要 -->
          <div class="bg-gray-50 rounded-xl p-3 mt-4 text-sm space-y-1">
            <div v-for="item in cart" :key="item.productId" class="flex justify-between text-gray-600">
              <span>{{ item.name }} × {{ item.qty }}</span><span>${{ item.finalPrice * item.qty }}</span>
            </div>
            <div v-if="userDiscount < 1" class="flex justify-between text-xs text-purple-600">
              <span>{{ user?.memberType === 'vip' ? 'VIP 折扣' : '員工折扣' }}</span>
              <span>已套用</span>
            </div>
            <div class="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
              <span>合計</span><span>${{ cartTotal }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 px-6 pb-6">
          <button @click="showOrderForm=false; showCart=true" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">返回</button>
          <button @click="submitOrder"
            :disabled="!orderForm.customerName || !orderForm.customerPhone || !orderForm.customerAddress"
            class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            :class="orderForm.customerName && orderForm.customerPhone && orderForm.customerAddress
              ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            送出訂單
          </button>
        </div>
      </div>
    </div>

    <!-- 完成 Modal -->
    <div v-if="showDone" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl p-8 w-80 text-center shadow-2xl">
        <div class="text-5xl mb-4">✅</div>
        <h3 class="text-lg font-bold text-gray-900 mb-2">訂單送出成功！</h3>
        <p class="text-sm text-gray-500 mb-1">訂單編號：<span class="font-bold text-green-700">{{ lastNo }}</span></p>
        <p class="text-sm text-gray-500 mb-5">我們將盡快與您確認訂單</p>
        <button @click="showDone=false; cart=[]" class="w-full py-2.5 rounded-xl bg-green-700 text-white font-semibold hover:bg-green-800">
          繼續購物
        </button>
      </div>
    </div>

    <!-- Google 登入 Modal（prototype 模擬） -->
    <div v-if="showLoginModal" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" @click.self="showLoginModal=false">
      <div class="bg-white rounded-2xl p-8 w-80 shadow-2xl text-center">
        <div class="text-4xl mb-3">🌿</div>
        <h3 class="text-base font-bold text-gray-900 mb-1">登入會員帳號</h3>
        <p class="text-xs text-gray-400 mb-6">登入後可享 VIP 或員工優惠，並查詢訂單紀錄</p>
        <button @click="mockGoogleLogin"
          class="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 hover:bg-gray-50 transition-colors mb-3">
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span class="text-sm font-medium text-gray-700">使用 Google 帳號登入</span>
        </button>
        <p class="text-xs text-gray-400">（Prototype：點擊模擬登入流程）</p>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Product } from '~/composables/usePosStore'
definePageMeta({ layout: 'shop' })

const { products, discountTypes, vipMembers, employees, addShopOrder } = usePosStore()

// ── 模擬登入狀態（後端串接後換成真實 OAuth）──
interface ShopUser {
  name: string
  email: string
  memberType: 'none' | 'vip' | 'staff'
  memberId: string
}

const user = ref<ShopUser | null>(null)
const showLoginModal = ref(false)

// prototype：模擬 Google 登入後，假設後台已綁定為 VIP
function mockGoogleLogin() {
  // 實際串接時：redirect 到 /api/auth/google，回來後 server 回傳使用者資料
  // 這裡模擬一個已被後台綁定為 VIP 的用戶
  user.value = {
    name: '楊鄉咪',
    email: 'example@gmail.com',
    memberType: 'vip',
    memberId: '155375',
  }
  showLoginModal.value = false
}

function logout() {
  user.value = null
  cart.value = []
}

// 根據登入狀態決定折扣率
const userDiscount = computed(() => {
  if (!user.value || user.value.memberType === 'none') return 1
  if (user.value.memberType === 'vip') {
    return discountTypes.value.find(d => d.requireVip)?.rate ?? 1
  }
  if (user.value.memberType === 'staff') {
    return discountTypes.value.find(d => d.requireStaff)?.rate ?? 1
  }
  return 1
})

function discountedPrice(price: number) {
  return Math.round(price * userDiscount.value)
}

// ── 商品 ──
const curCat = ref('全部')
const shopProducts = computed(() =>
  products.value.filter(p => p.locations.includes('shop') || p.locations.includes('stall'))
    .sort((a, b) => a.sortOrder - b.sortOrder)
)
const categories = computed(() => ['全部', ...new Set(shopProducts.value.map(p => p.category))])
const filteredProducts = computed(() =>
  curCat.value === '全部' ? shopProducts.value : shopProducts.value.filter(p => p.category === curCat.value)
)

// ── 購物車 ──
const showCart = ref(false)
const cart = ref<{ productId: number; name: string; price: number; finalPrice: number; qty: number }[]>([])
const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))
const cartTotal = computed(() => cart.value.reduce((s, i) => s + i.finalPrice * i.qty, 0))

function addToCart(prod: Product) {
  const ex = cart.value.find(i => i.productId === prod.id)
  const fp = discountedPrice(prod.price)
  if (ex) { ex.qty++; ex.finalPrice = fp }
  else cart.value.push({ productId: prod.id, name: prod.name, price: prod.price, finalPrice: fp, qty: 1 })
}
function changeQty(idx: number, d: number) {
  cart.value[idx].qty += d
  if (cart.value[idx].qty <= 0) cart.value.splice(idx, 1)
}

// ── 訂單 ──
const showOrderForm = ref(false)
const showDone = ref(false)
const lastNo = ref('')

const payOptions = [
  { value: 'transfer', label: '銀行匯款' },
  { value: 'cod',      label: '貨到付款' },
]
const shippingOptions = [
  { value: 'blackcat', label: '🐱 黑貓宅急便' },
  { value: 'hsinchu',  label: '🚚 新竹貨運' },
]

const defaultOrderForm = () => ({
  customerName: user.value?.memberType === 'vip' ? (vipMembers.value.find(v => v.id === user.value?.memberId)?.name ?? '') : '',
  customerPhone: user.value?.memberType === 'vip' ? (vipMembers.value.find(v => v.id === user.value?.memberId)?.phone ?? '') : '',
  customerAddress: user.value?.memberType === 'vip' ? (vipMembers.value.find(v => v.id === user.value?.memberId)?.address ?? '') : '',
  payMethod: 'transfer' as 'transfer' | 'cod',
  shippingCompany: 'blackcat' as 'blackcat' | 'hsinchu' | '',
  carrier: '', note: '',
})
const orderForm = ref(defaultOrderForm())

// 開啟訂單表單時自動帶入 VIP 資料
watch(showOrderForm, v => { if (v) orderForm.value = defaultOrderForm() })

function submitOrder() {
  if (!orderForm.value.customerName || !orderForm.value.customerPhone || !orderForm.value.customerAddress) return
  addShopOrder({
    customerName: orderForm.value.customerName,
    customerPhone: orderForm.value.customerPhone,
    customerAddress: orderForm.value.customerAddress,
    items: cart.value.map(i => ({ productId: i.productId, name: i.name, price: i.finalPrice, qty: i.qty })),
    total: cartTotal.value,
    payMethod: orderForm.value.payMethod,
    carrier: orderForm.value.carrier,
    shippingCompany: orderForm.value.shippingCompany,
    note: orderForm.value.note,
  })
  const { shopOrders } = usePosStore()
  lastNo.value = shopOrders.value[0].no
  showOrderForm.value = false
  showDone.value = true
  orderForm.value = defaultOrderForm()
}

function prodEmoji(cat: string) {
  const map: Record<string, string> = { '套餐': '🍱', '餅乾麵包': '🍪', '農產品': '🌾', '飲品': '🧃' }
  return map[cat] ?? '🛍️'
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
