<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
      <h1 class="text-lg font-bold text-gray-900">線上訂單管理</h1>
      <p class="text-xs text-gray-400 mt-0.5">管理客人線上購物訂單與出貨</p>
    </div>

    <!-- 狀態篩選 -->
    <div class="bg-white border-b border-gray-100 px-6 py-2.5 flex gap-2 shrink-0">
      <button v-for="s in statusFilters" :key="s.value"
        @click="filterStatus = s.value"
        class="px-4 py-1.5 rounded-full text-sm border transition-colors whitespace-nowrap"
        :class="filterStatus === s.value ? 'bg-gray-100 text-gray-900 border-gray-400 font-medium' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'">
        {{ s.label }}
        <span v-if="s.value !== 'all'" class="ml-1 text-xs opacity-60">{{ countByStatus(s.value) }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-auto px-6 py-4">
      <div v-if="!filteredOrders.length" class="py-20 text-center text-gray-300 text-sm">尚無訂單</div>

      <div v-for="order in filteredOrders" :key="order.id"
        class="bg-white border border-gray-200 rounded-2xl p-5 mb-3 hover:border-gray-300 transition-colors">
        <div class="flex items-start justify-between mb-3">
          <div>
            <span class="font-bold text-gray-900 text-base mr-2">{{ order.no }}</span>
            <span class="text-xs px-2.5 py-1 rounded-full font-medium"
              :class="{
                'bg-amber-100 text-amber-700':  order.status === 'pending',
                'bg-blue-100 text-blue-700':    order.status === 'confirmed',
                'bg-purple-100 text-purple-700':order.status === 'shipped',
                'bg-green-100 text-green-700':  order.status === 'done',
              }">{{ SHOP_ORDER_STATUS[order.status] }}</span>
          </div>
          <span class="text-xs text-gray-400">{{ fmt(order.createdAt) }}</span>
        </div>

        <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
          <div><span class="text-gray-400 text-xs">姓名</span><span class="ml-2 text-gray-900">{{ order.customerName }}</span></div>
          <div><span class="text-gray-400 text-xs">電話</span><span class="ml-2 text-gray-900">{{ order.customerPhone }}</span></div>
          <div class="col-span-2"><span class="text-gray-400 text-xs">地址</span><span class="ml-2 text-gray-900">{{ order.customerAddress }}</span></div>
          <div><span class="text-gray-400 text-xs">付款</span><span class="ml-2 text-gray-900">{{ order.payMethod === 'transfer' ? '銀行匯款' : '貨到付款' }}</span></div>
          <div><span class="text-gray-400 text-xs">物流</span><span class="ml-2 text-gray-900">{{ order.shippingCompany === 'blackcat' ? '黑貓宅急便' : '新竹貨運' }}</span></div>
          <div v-if="order.trackingNo"><span class="text-gray-400 text-xs">追蹤號</span><span class="ml-2 font-mono text-blue-700">{{ order.trackingNo }}</span></div>
        </div>

        <div class="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 mb-3 space-y-1">
          <div v-for="item in order.items" :key="item.productId" class="flex justify-between">
            <span>{{ item.name }} × {{ item.qty }}</span><span>${{ item.price * item.qty }}</span>
          </div>
          <div class="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
            <span>合計</span><span>${{ order.total }}</span>
          </div>
        </div>

        <!-- 動作按鈕 -->
        <div class="flex gap-2 flex-wrap">
          <button v-if="order.status === 'pending'" @click="updateStatus(order, 'confirmed')"
            class="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
            確認訂單
          </button>
          <button v-if="order.status === 'confirmed'" @click="openShip(order)"
            class="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
            登錄出貨
          </button>
          <button v-if="order.status === 'shipped'" @click="updateStatus(order, 'done')"
            class="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
            完成
          </button>
          <button @click="openShippingLabel(order)"
            class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors font-medium">
            📦 列印物流單
          </button>
        </div>
      </div>
    </div>

    <!-- 出貨 Modal -->
    <div v-if="showShipModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showShipModal=false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">登錄出貨</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-500 mb-1 block">物流追蹤號碼</label>
            <input v-model="trackingInput" type="text" class="ifield" placeholder="輸入貨運單號">
          </div>
        </div>
        <div class="flex gap-2 mt-5">
          <button @click="showShipModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmShip" class="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700">確認出貨</button>
        </div>
      </div>
    </div>

    <!-- 物流單預覽 Modal -->
    <div v-if="showLabelModal && labelOrder" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl w-96 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-gray-900">物流出貨單</h3>
            <span class="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
              {{ labelOrder.shippingCompany === 'blackcat' ? '🐱 黑貓宅急便' : '🚚 新竹貨運' }}
            </span>
          </div>
          <hr class="border-dashed border-gray-300 my-3">
          <div class="space-y-2 text-sm">
            <div class="text-xs text-gray-400 font-medium mb-2">寄件人</div>
            <div class="text-gray-900 font-medium">聖母健康農莊</div>
            <div class="text-gray-600 text-xs">台東縣（請填寫完整地址）</div>
          </div>
          <hr class="border-dashed border-gray-300 my-3">
          <div class="space-y-1 text-sm">
            <div class="text-xs text-gray-400 font-medium mb-2">收件人</div>
            <div class="text-gray-900 font-bold text-base">{{ labelOrder.customerName }}</div>
            <div class="text-gray-700">{{ labelOrder.customerPhone }}</div>
            <div class="text-gray-700 text-xs leading-relaxed">{{ labelOrder.customerAddress }}</div>
          </div>
          <hr class="border-dashed border-gray-300 my-3">
          <div class="text-xs space-y-1">
            <div class="flex justify-between"><span class="text-gray-400">訂單編號</span><span class="font-mono font-bold">{{ labelOrder.no }}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">付款方式</span><span>{{ labelOrder.payMethod === 'transfer' ? '已付款' : '貨到付款 $' + labelOrder.total }}</span></div>
            <div class="flex justify-between"><span class="text-gray-400">追蹤號碼</span><span class="font-mono">{{ labelOrder.trackingNo || '（未填寫）' }}</span></div>
          </div>
          <hr class="border-dashed border-gray-300 my-3">
          <div class="text-xs text-gray-500">
            <div class="font-medium mb-1">品項：</div>
            <div v-for="item in labelOrder.items" :key="item.productId">{{ item.name }} × {{ item.qty }}</div>
          </div>
          <div v-if="labelOrder.note" class="mt-3 bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
            備註：{{ labelOrder.note }}
          </div>
        </div>
        <div class="flex gap-2 px-6 pb-6">
          <button @click="showLabelModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">關閉</button>
          <button @click="printLabel" class="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900">🖨 列印</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SHOP_ORDER_STATUS } from '~/composables/usePosStore'
import type { ShopOrder } from '~/composables/usePosStore'

const { shopOrders } = usePosStore()

const filterStatus = ref('all')
const showShipModal  = ref(false)
const showLabelModal = ref(false)
const trackingInput  = ref('')
const shipTarget     = ref<ShopOrder | null>(null)
const labelOrder     = ref<ShopOrder | null>(null)

const statusFilters = [
  { value: 'all',       label: '全部' },
  { value: 'pending',   label: '待確認' },
  { value: 'confirmed', label: '已確認' },
  { value: 'shipped',   label: '已出貨' },
  { value: 'done',      label: '完成' },
]

const filteredOrders = computed(() =>
  filterStatus.value === 'all'
    ? shopOrders.value
    : shopOrders.value.filter(o => o.status === filterStatus.value)
)

function countByStatus(status: string) {
  return shopOrders.value.filter(o => o.status === status).length
}

function updateStatus(order: ShopOrder, status: ShopOrder['status']) {
  const o = shopOrders.value.find(o => o.id === order.id)
  if (o) o.status = status
}

function openShip(order: ShopOrder) {
  shipTarget.value = order
  trackingInput.value = order.trackingNo
  showShipModal.value = true
}

function confirmShip() {
  if (!shipTarget.value) return
  const o = shopOrders.value.find(o => o.id === shipTarget.value!.id)
  if (o) { o.trackingNo = trackingInput.value; o.status = 'shipped' }
  showShipModal.value = false
}

function openShippingLabel(order: ShopOrder) {
  labelOrder.value = order
  showLabelModal.value = true
}

function printLabel() { window.print() }

function fmt(d: Date) {
  return new Date(d).toLocaleString('zh-TW', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.ifield { @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white text-gray-900; }
</style>
