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
      <div class="grid gap-4" :class="cashierStats.length ? 'grid-cols-3' : 'grid-cols-2'">
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

        <!-- 結帳人 -->
        <div v-if="cashierStats.length" class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">結帳人</h2>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="c in cashierStats" :key="c.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ c.label }}</span>
                <span class="font-semibold text-gray-900">${{ c.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ c.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-purple-400 transition-all" :style="{ width: c.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 電子發票（資料來自資料機，含平板同步來的） -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">電子發票</h2>
          <div class="flex items-center gap-3 text-xs">
            <label v-if="invoices.length" class="flex items-center gap-1 text-gray-500 cursor-pointer">
              <input v-model="invProblemsOnly" type="checkbox"> 只看還沒上傳 / 有問題的
            </label>
            <button class="text-green-700 hover:underline" :disabled="invLoading" @click="refreshAll">
              {{ invLoading ? '讀取中…' : '重新整理' }}
            </button>
            <button v-if="invoices.length" class="text-blue-600 hover:underline" :disabled="querying" @click="queryRange"
              title="向加值中心查這段期間已上傳發票的狀態（資料機每天也會自動查前一天的）">
              {{ querying ? '查詢中…' : '向加值中心查詢' }}
            </button>
          </div>
        </div>
        <div v-if="invError" class="px-5 py-4 text-sm text-amber-600">{{ invError }}</div>
        <template v-else>
          <div class="grid grid-cols-5 gap-3 px-5 py-4 border-b border-gray-100">
            <div v-for="s in invStats" :key="s.label">
              <div class="text-xs text-gray-400 mb-0.5">{{ s.label }}</div>
              <div class="text-lg font-bold" :class="s.color">{{ s.value }}</div>
            </div>
          </div>
          <div v-if="invTruncated" class="px-5 py-2 text-xs text-amber-600">期間內發票太多，只列出前 5000 張</div>
          <div v-if="!shownInvoices.length" class="py-10 text-center text-gray-300 text-sm">
            {{ invLoading ? '讀取中…' : invProblemsOnly ? '沒有待處理的發票' : (mode === 'daily' ? '此日' : '此月') + '沒有開立發票' }}
          </div>
          <div v-else class="overflow-y-auto" style="max-height:70vh;">
            <table class="w-full text-sm">
              <thead class="sticky top-0">
                <tr class="text-xs text-gray-400 border-b border-gray-200 bg-gray-50">
                  <th class="text-left px-5 py-2.5 font-medium">發票號碼</th>
                  <th class="text-left px-3 py-2.5 font-medium">開立時間</th>
                  <th class="text-left px-3 py-2.5 font-medium">收銀機</th>
                  <th class="text-left px-3 py-2.5 font-medium">狀態</th>
                  <th class="text-left px-3 py-2.5 font-medium">訊息</th>
                  <th class="text-left px-3 py-2.5 font-medium">加值中心查詢</th>
                  <th class="text-right px-5 py-2.5 font-medium">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in shownInvoices" :key="inv.invoiceNo" class="border-b border-gray-100 hover:bg-gray-50">
                  <td class="px-5 py-2.5 font-mono text-gray-900">{{ formatInvoiceNo(inv.invoiceNo) }}</td>
                  <td class="px-3 py-2.5 text-gray-500 text-xs">{{ inv.issuedAt.slice(5, 16) }}</td>
                  <td class="px-3 py-2.5 text-gray-500 text-xs">{{ inv.station }}<span v-if="inv.fromTablet" class="ml-1 text-gray-400">(平板)</span></td>
                  <td class="px-3 py-2.5 text-xs">
                    <span class="px-1.5 py-0.5 rounded" :class="invState(inv).cls">{{ invState(inv).label }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-gray-400 text-xs max-w-[220px] truncate" :title="invState(inv).msg">{{ invState(inv).msg }}</td>
                  <td class="px-3 py-2.5 text-xs max-w-[200px]">
                    <div v-if="inv.queryResult" class="truncate text-gray-600" :title="`${inv.queryResult}（${inv.queryAt}）`">{{ inv.queryResult }}</div>
                    <button v-if="inv.uploadStatus === 'done' && !inv.fromTablet" class="text-blue-600 hover:underline" :disabled="queryingNo === inv.invoiceNo" @click="queryOne(inv)">
                      {{ queryingNo === inv.invoiceNo ? '查詢中…' : inv.queryResult ? '重查' : '查詢' }}
                    </button>
                  </td>
                  <td class="px-5 py-2.5 text-right font-medium" :class="inv.cancelStatus === 'done' ? 'text-gray-300 line-through' : 'text-gray-900'">${{ Number(inv.total).toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- 交易紀錄 -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">交易紀錄</h2>
          <div class="flex items-center gap-3 text-xs">
            <span v-if="ordersLoading" class="text-gray-400">讀取資料機中…</span>
            <span v-else-if="remoteOrders" class="text-gray-400">資料機</span>
            <span class="text-gray-400">{{ filteredOrders.length }} 筆</span>
            <button class="text-green-700 hover:underline" :disabled="ordersLoading" @click="refreshAll">重新整理</button>
          </div>
        </div>
        <div v-if="ordersError" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
          讀不到資料機的交易紀錄，只顯示這台這次開網頁後的交易（{{ ordersError }}）
        </div>
        <div v-if="ordersOffline" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">{{ ordersOffline }}</div>
        <div v-if="pendingCount" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
          這台還有 {{ pendingCount }} 筆交易還沒送到資料機，連上後會自動補送
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
              <th class="text-left px-3 py-2.5 font-medium">結帳人</th>
              <th class="text-left px-3 py-2.5 font-medium">發票</th>
              <th class="text-right px-5 py-2.5 font-medium">金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in filteredOrders" :key="order.clientId || order.id" class="border-b border-gray-100 hover:bg-gray-50">
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
              <td class="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{{ order.cashierName || '—' }}</td>
              <td class="px-3 py-3 text-xs whitespace-nowrap">
                <template v-if="orderInv(order)">
                  <span class="font-mono text-gray-700">{{ orderInv(order)!.no }}</span>
                  <span class="ml-1 px-1.5 py-0.5 rounded" :class="orderInv(order)!.cls">{{ orderInv(order)!.label }}</span>
                </template>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3 text-right font-bold text-gray-900">${{ order.total.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { LOC_LABEL, PAY_LABEL, type Order } from '~/composables/usePosStore'
import { listEInvoices, formatInvoiceNo, queryEInvoice, queryEInvoiceRange, type InvoiceRecord } from '~/utils/einvoiceApi'
import { listOrders, pendingOrders } from '~/utils/ordersApi'

const { orders, stations, stationName } = usePosStore()

const mode = ref<'daily' | 'monthly'>('daily')

// 一律用本機（台灣）日期；toISOString 是 UTC，早上 8 點前的單會算到前一天
const pad2 = (n: number) => String(n).padStart(2, '0')
const localYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// 預設今天
const todayStr = localYmd(new Date())
const selectedDate = ref(todayStr)

// 月選項：近 12 個月
const monthOptions = Array.from({ length: 12 }, (_, i) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - i)
  const val = localYmd(d).slice(0, 7)
  return { value: val, label: val.replace('-', ' 年 ') + ' 月' }
})
const selectedMonth = ref(monthOptions[0].value)

// ── 交易紀錄：以資料機為準（各收銀機、平板同步來的都在）；這台還沒送出的也一起列；讀不到資料機才只看這台 ──
const remoteOrders = ref<Order[] | null>(null)
const ordersError = ref('')
const ordersOffline = ref('')
const ordersLoading = ref(false)
let ordersSeq = 0
async function loadOrders() {
  const seq = ++ordersSeq
  const { from, to } = invRange.value
  ordersLoading.value = true
  const r = await listOrders(from, to)
  if (seq !== ordersSeq) return
  ordersLoading.value = false
  if (r.ok) {
    remoteOrders.value = r.orders.map((o, i) => ({ ...o, id: -(i + 1), createdAt: new Date(o.createdAt) }) as unknown as Order)
    ordersError.value = ''
    ordersOffline.value = r.offline ? `平板目前連不到資料機，先顯示這台平板上的紀錄（${r.offlineReason ?? ''}）` : ''
  } else {
    remoteOrders.value = null
    ordersError.value = r.message
    ordersOffline.value = ''
  }
}
const pendingCount = ref(0)
function refreshAll() {
  pendingCount.value = pendingOrders()
  void loadOrders()
  void loadInvoices()
}

const filteredOrders = computed(() => {
  const remote = remoteOrders.value
  const known = new Set((remote ?? []).map(o => o.clientId))
  const local = orders.value.filter(o => !remote || !o.clientId || !known.has(o.clientId))
  const all = [...(remote ?? []), ...local].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return all.filter(o => {
    const d = localYmd(new Date(o.createdAt))
    if (mode.value === 'daily') {
      return d === selectedDate.value
    } else {
      return d.slice(0, 7) === selectedMonth.value
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

// 依結帳人統計（有記錄結帳人的交易才列；舊交易歸到「未記錄」）
const cashierStats = computed(() => {
  if (!filteredOrders.value.some(o => o.cashierId)) return []
  const map = new Map<string, { key: string; label: string; total: number; count: number }>()
  for (const o of filteredOrders.value) {
    const key = o.cashierId || ''
    const row = map.get(key) ?? { key, label: o.cashierName || (key ? key : '未記錄'), total: 0, count: 0 }
    row.total += o.total; row.count++
    map.set(key, row)
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...list.map(r => r.total))
  return list.map(r => ({ ...r, pct: Math.round(r.total / max * 100) }))
})

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

// ── 電子發票：向資料機查期間內的發票（含上傳 / 作廢狀態） ──
const invoices = ref<InvoiceRecord[]>([])
const invLoading = ref(false)
const invError = ref('')
const invTruncated = ref(false)
const invProblemsOnly = ref(false)

const invRange = computed(() => {
  if (mode.value === 'daily') return { from: selectedDate.value, to: selectedDate.value }
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return { from: `${selectedMonth.value}-01`, to: localYmd(new Date(y!, m!, 0)) }
})

let invSeq = 0
async function loadInvoices() {
  const seq = ++invSeq
  const { from, to } = invRange.value
  if (!from || !to) return
  invLoading.value = true
  invError.value = ''
  const r = await listEInvoices(from, to)
  if (seq !== invSeq) return // 已經切到別的日期
  invLoading.value = false
  if (r.ok) {
    invoices.value = [...r.data.invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.invoiceNo.localeCompare(a.invoiceNo))
    invTruncated.value = r.data.truncated
  } else {
    invoices.value = []
    invTruncated.value = false
    invError.value = r.notConfigured
      ? '這台沒有啟用電子發票（系統設定 → 電子發票），看不到資料機上的發票'
      : `讀不到資料機的發票：${r.message}`
  }
}
watch(invRange, refreshAll, { immediate: true })

// 向加值中心查詢狀態（QueryInvoiceStatus）：回覆格式沒有公開文件，先直接顯示原文
const querying = ref(false)
const queryingNo = ref('')
async function queryOne(inv: InvoiceRecord) {
  queryingNo.value = inv.invoiceNo
  const r = await queryEInvoice(inv.invoiceNo)
  queryingNo.value = ''
  if (r.ok) { inv.queryResult = r.data.queryResult; inv.queryAt = r.data.queryAt }
  else alert('查詢失敗：' + r.message)
}
async function queryRange() {
  querying.value = true
  const { from, to } = invRange.value
  const r = await queryEInvoiceRange(from, to)
  querying.value = false
  if (!r.ok) { alert('查詢失敗：' + r.message); return }
  if (r.data.failed) alert(`查了 ${r.data.queried} 張，失敗 ${r.data.failed} 張：${r.data.lastError}`)
  else if (r.data.total > r.data.queried) alert(`這次查了 ${r.data.queried} 張（共 ${r.data.total} 張），再按一次查剩下的`)
  void loadInvoices()
}

function invState(inv: InvoiceRecord) {
  if (inv.cancelStatus === 'done') return { label: '已作廢', cls: 'bg-gray-100 text-gray-500', msg: inv.cancelMsg }
  if (inv.cancelStatus === 'needApproval') return { label: '作廢待核准', cls: 'bg-red-100 text-red-700', msg: inv.cancelMsg || '跨期作廢要先向國稅局申請核准文號' }
  if (inv.cancelStatus === 'pending') return { label: '作廢中', cls: 'bg-amber-100 text-amber-700', msg: inv.cancelMsg || '排程會再試' }
  if (inv.uploadStatus === 'done') return { label: '已上傳', cls: 'bg-green-100 text-green-700', msg: inv.uploadedAt ? `上傳於 ${inv.uploadedAt.slice(5, 16)}` : '' }
  if (inv.uploadAttempts >= 3) return { label: '上傳失敗', cls: 'bg-red-100 text-red-700', msg: inv.uploadMsg || `已試 ${inv.uploadAttempts} 次` }
  return { label: '待上傳', cls: 'bg-amber-100 text-amber-700', msg: inv.uploadMsg || '排程每 10 分鐘補傳' }
}

const invByNo = computed(() => new Map(invoices.value.map(i => [i.invoiceNo, i])))

// 收銀時寫在訂單上的發票號碼（BM-92177850），狀態以資料機為準
function orderInv(order: Order) {
  const o = order as Order & { invoiceNo?: string; invoiceIsMock?: boolean }
  if (!o.invoiceNo) return null
  if (o.invoiceIsMock) return { no: o.invoiceNo, label: '測試', cls: 'bg-gray-100 text-gray-500' }
  const inv = invByNo.value.get(o.invoiceNo.replace('-', ''))
  if (!inv) return { no: o.invoiceNo, label: invLoading.value ? '…' : '查無', cls: 'bg-gray-100 text-gray-400' }
  return { no: o.invoiceNo, ...invState(inv) }
}

const shownInvoices = computed(() =>
  invProblemsOnly.value ? invoices.value.filter(i => invState(i).label !== '已上傳' && invState(i).label !== '已作廢') : invoices.value)

const invStats = computed(() => {
  const list = invoices.value
  const live = list.filter(i => i.cancelStatus !== 'done')
  const count = (label: string) => list.filter(i => invState(i).label === label).length
  const waiting = count('待上傳') + count('作廢中')
  const bad = count('上傳失敗') + count('作廢待核准')
  return [
    { label: '開立張數', value: `${list.length} 張`, color: 'text-gray-900' },
    { label: '發票金額（不含作廢）', value: '$' + live.reduce((s, i) => s + Number(i.total), 0).toLocaleString(), color: 'text-green-700' },
    { label: '已上傳', value: `${count('已上傳')} 張`, color: 'text-green-700' },
    { label: '待上傳 / 有問題', value: `${waiting} / ${bad} 張`, color: bad ? 'text-red-600' : waiting ? 'text-amber-600' : 'text-gray-900' },
    { label: '作廢', value: `${count('已作廢')} 張`, color: 'text-gray-500' },
  ]
})
</script>
