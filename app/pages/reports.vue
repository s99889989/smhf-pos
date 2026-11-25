<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">營業報表</h1>
        <p class="text-xs text-gray-400 mt-0.5">收銀紀錄與統計</p>
      </div>
      <!-- 每日 / 月 切換 -->
      <div class="flex items-center gap-3">
        <div class="flex border border-gray-200 rounded-xl overflow-hidden">
          <button
            @click="mode = 'daily'"
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="mode === 'daily' ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
          >每日</button>
          <button
            @click="mode = 'monthly'"
            class="px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200"
            :class="mode === 'monthly' ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
          >月報</button>
        </div>
        <!-- 日期選擇 -->
        <input
          v-if="mode === 'daily'"
          v-model="selectedDate"
          type="date"
          style="border:1px solid #e5e7eb; border-radius:10px; padding:7px 12px; font-size:13px; outline:none; color:#111;"
        >
        <select
          v-else
          v-model="selectedMonth"
          style="border:1px solid #e5e7eb; border-radius:10px; padding:7px 12px; font-size:13px; outline:none; color:#111; background:#fff;"
        >
          <option v-for="m in monthOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-5">

      <!-- 統計卡 -->
      <div class="grid grid-cols-4 gap-4">
        <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="text-xs text-gray-400 mb-1">{{ stat.label }}</div>
          <div class="text-2xl font-bold" :class="stat.color">{{ stat.value }}</div>
        </div>
      </div>

      <!-- 各地點 + 付款方式 -->
      <div class="grid grid-cols-2 gap-4">
        <!-- 地點 -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">各地點營業額</h2>
          <div class="space-y-3">
            <div v-for="loc in locStats" :key="loc.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ loc.label }}</span>
                <span class="font-semibold text-gray-900">${{ loc.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ loc.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-green-500 transition-all" :style="{ width: loc.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 付款 -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">付款方式</h2>
          <div class="space-y-3">
            <div v-for="p in payStats" :key="p.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ p.icon }} {{ p.label }}</span>
                <span class="font-semibold text-gray-900">${{ p.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ p.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-blue-400 transition-all" :style="{ width: p.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 交易紀錄 -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">交易紀錄</h2>
          <span class="text-xs text-gray-400">{{ filteredOrders.length }} 筆</span>
        </div>
        <div v-if="!filteredOrders.length" class="py-16 text-center text-gray-300 text-sm">
          {{ mode === 'daily' ? '此日' : '此月' }}尚無交易紀錄
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-400 border-b border-gray-200 bg-gray-50">
              <th class="text-left px-5 py-2.5 font-medium">單號</th>
              <th class="text-left px-3 py-2.5 font-medium">時間</th>
              <th class="text-left px-3 py-2.5 font-medium">地點</th>
              <th class="text-left px-3 py-2.5 font-medium">品項</th>
              <th class="text-left px-3 py-2.5 font-medium">付款</th>
              <th class="text-right px-5 py-2.5 font-medium">金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.id" class="border-b border-gray-100 hover:bg-gray-50">
              <td class="px-5 py-3 font-medium text-gray-900">{{ order.no }}</td>
              <td class="px-3 py-3 text-gray-500 text-xs">{{ formatTime(order.createdAt) }}</td>
              <td class="px-3 py-3">
                <span class="text-xs px-2 py-0.5 rounded-full"
                  :class="{
                    'bg-green-100 text-green-700': order.location === 'restaurant',
                    'bg-blue-100 text-blue-700':   order.location === 'shop',
                    'bg-amber-100 text-amber-700':  order.location === 'stall',
                  }">{{ stationName(order.location) }}</span>
              </td>
              <td class="px-3 py-3 text-gray-600 text-xs max-w-[160px] truncate">
                {{ order.items.map(i => i.name).join('、') }}
              </td>
              <td class="px-3 py-3 text-gray-500 text-xs">{{ PAY_LABEL[order.payMethod] }}</td>
              <td class="px-5 py-3 text-right font-bold text-gray-900">${{ order.total.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { LOC_LABEL, PAY_LABEL } from '~/composables/usePosStore'

const { orders, stations, stationName } = usePosStore()

const mode = ref<'daily' | 'monthly'>('daily')

// 預設今天
const todayStr = new Date().toISOString().slice(0, 10)
const selectedDate = ref(todayStr)

// 月選項：近 12 個月
const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  const val = d.toISOString().slice(0, 7)
  return { value: val, label: val.replace('-', ' 年 ') + ' 月' }
})
const selectedMonth = ref(monthOptions[0].value)

const filteredOrders = computed(() => {
  return orders.value.filter(o => {
    const d = new Date(o.createdAt)
    if (mode.value === 'daily') {
      return d.toISOString().slice(0, 10) === selectedDate.value
    } else {
      return d.toISOString().slice(0, 7) === selectedMonth.value
    }
  })
})

const totalRevenue = computed(() => filteredOrders.value.reduce((s, o) => s + o.total, 0))
const totalCount   = computed(() => filteredOrders.value.length)
const avgOrder     = computed(() => totalCount.value ? Math.round(totalRevenue.value / totalCount.value) : 0)
const cashTotal    = computed(() => filteredOrders.value.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.total, 0))

const stats = computed(() => [
  { label: mode.value === 'daily' ? '當日營業額' : '當月營業額', value: '$' + totalRevenue.value.toLocaleString(), color: 'text-green-700' },
  { label: '交易筆數',   value: totalCount.value + ' 筆',   color: 'text-gray-900' },
  { label: '平均客單價', value: '$' + avgOrder.value,        color: 'text-blue-600' },
  { label: '現金收入',   value: '$' + cashTotal.value.toLocaleString(), color: 'text-amber-600' },
])

// 站別由資料機設定（可自訂）
const locDefs = computed(() => stations.value.map(s => ({ key: s.id, label: s.name })))

const locStats = computed(() => {
  const maxTotal = Math.max(1, ...locDefs.value.map(l =>
    filteredOrders.value.filter(o => o.location === l.key).reduce((s, o) => s + o.total, 0)
  ))
  return locDefs.value.map(l => {
    const list = filteredOrders.value.filter(o => o.location === l.key)
    const total = list.reduce((s, o) => s + o.total, 0)
    return { ...l, total, count: list.length, pct: Math.round(total / maxTotal * 100) }
  })
})

const payDefs = [
  { key: 'cash', icon: '💵', label: '現金' },
  { key: 'card', icon: '💳', label: '信用卡' },
  { key: 'hua',  icon: '📱', label: '華南Q' },
]

const payStats = computed(() => {
  const maxTotal = Math.max(1, ...payDefs.map(p =>
    filteredOrders.value.filter(o => o.payMethod === p.key).reduce((s, o) => s + o.total, 0)
  ))
  return payDefs.map(p => {
    const list = filteredOrders.value.filter(o => o.payMethod === p.key)
    const total = list.reduce((s, o) => s + o.total, 0)
    return { ...p, total, count: list.length, pct: Math.round(total / maxTotal * 100) }
  })
})

function formatTime(d: Date) {
  return new Date(d).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>
