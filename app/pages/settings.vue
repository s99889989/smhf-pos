<template>
  <div class="flex flex-col h-full overflow-hidden">

    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-4 shrink-0">
      <h1 class="text-lg font-bold text-gray-900">系統設定</h1>
      <p class="text-xs text-gray-400 mt-0.5">折扣類型與其他設定</p>
    </div>

    <!-- 依視窗寬度排成 1～3 欄（CSS columns，卡片高度不同也不會留大洞；XP 的 Mypal 也支援） -->
    <div class="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5">
     <div class="columns-1 lg:columns-2 2xl:columns-3 gap-6">

      <!-- 本機收銀站 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-800">本機收銀站</h2>
          <p class="text-xs text-gray-400 mt-0.5">這台機器是哪一站；設定後收銀台只顯示該站商品、不能切換。只存在這台機器。</p>
        </div>
        <div class="px-5 py-4 space-y-2 text-sm">
          <label class="flex items-center gap-2 text-gray-700">
            <input type="radio" name="pos-station" value="" :checked="station === ''" @change="writeStation('')">
            不指定（收銀台顯示全部品項，資料機用）
          </label>
          <label v-for="s in stations" :key="s.id" class="flex items-center gap-2 text-gray-700">
            <input type="radio" name="pos-station" :value="s.id" :checked="station === s.id" @change="writeStation(s.id)">
            {{ s.emoji ? s.emoji + ' ' : '' }}{{ s.name }}
          </label>
        </div>
      </div>

      <!-- 本機機台號（單號用） -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-800">本機機台號</h2>
          <p class="text-xs text-gray-400 mt-0.5">單號照舊系統規則：日期 + P + 機台號 + 當日流水號，例 261125P10001。每台（含離線平板）要設不同號碼才不會撞號。只存在這台機器。</p>
        </div>
        <div class="px-5 py-4 space-y-2 text-sm">
          <div class="flex flex-wrap gap-2">
            <button v-for="n in ['1','2','3','4','5','6','7','8','9']" :key="n" @click="writeMachineNo(n)"
              class="w-10 h-10 rounded-xl border text-base font-semibold"
              :class="machineNo === n ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">{{ n }}</button>
          </div>
          <p v-if="!machineNo" class="text-xs text-amber-600">尚未指定：單號暫用機台號 0（例 {{ sampleNo('0') }}），請選一個號碼。</p>
          <p v-else class="text-xs text-gray-500">下一筆單號像 {{ sampleNo(machineNo) }}（每天從 0001 開始）</p>
        </div>
      </div>

      <!-- 引導式結帳 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">引導式結帳（防呆）</h2>
            <p class="text-xs text-gray-400 mt-0.5">像點餐機一步一步：選商品 → 確認明細 → 發票載具 → 付款找零 → 最後確認，每步都對了才能下一步。只存在這台機器。</p>
          </div>
          <button @click="writeGuidedCheckout(!guided)"
            class="shrink-0 w-10 h-6 rounded-full transition-colors relative"
            :class="guided ? 'bg-green-500' : 'bg-gray-200'" :title="guided ? '已開啟' : '已關閉'">
            <span class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
              :class="guided ? 'left-5' : 'left-1'"></span>
          </button>
        </div>
        <div class="px-5 py-3 text-xs" :class="guided ? 'text-green-700' : 'text-gray-500'">
          {{ guided ? '已開啟：收銀頁按「下一步」進入引導結帳' : '已關閉：收銀頁維持原本一頁結帳' }}
        </div>
      </div>

      <!-- 站別與資料機 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">收銀站別</h2>
            <p class="text-xs text-gray-400 mt-0.5">各站共用同一份品項與庫存；品項在「品項管理」勾選上架哪幾站</p>
          </div>
          <button @click="cat.load()" class="shrink-0 whitespace-nowrap text-sm px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">重新整理</button>
        </div>
        <div class="px-5 py-4 space-y-3 text-sm">
          <p class="text-xs" :class="catState.mode === 'demo' || catState.offline ? 'text-amber-600' : 'text-gray-500'">
            <template v-if="catState.mode === 'online'">
              已連線資料機{{ catState.route === 'hub' ? '（區網連不到，目前經家裡 Hub）' : '（區網）' }}：品項、站別、庫存都存在資料機。
            </template>
            <template v-else-if="catState.mode === 'tablet'">
              行動平板：{{ catState.offline ? '離線中，用平板上的資料' : '已連線資料機' }}（上次同步 {{ catState.syncedAt || '—' }}）
              <span v-if="catState.pending">・待補送庫存 {{ catState.pending }} 筆</span>
            </template>
            <template v-else-if="catState.mode === 'demo'">範例模式：連不到本機 print-agent / 資料機，畫面上的品項是範例，修改不會保存。（{{ catState.error }}）</template>
            <template v-else>載入中…</template>
          </p>
          <p v-if="catState.error && catState.mode !== 'demo'" class="text-xs text-red-600">{{ catState.error }}</p>
          <div v-for="s in stations" :key="s.id" class="flex items-center gap-2">
            <EmojiPicker v-model="stationEmojis[s.id]" />
            <input v-model="stationNames[s.id]" type="text" class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900">
            <button @click="renameStation(s.id)" :disabled="!stationNames[s.id] || (stationNames[s.id] === s.name && (stationEmojis[s.id] || '') === (s.emoji || ''))"
                    class="shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">儲存</button>
            <button @click="removeStation(s.id, s.name)" class="shrink-0 whitespace-nowrap text-xs text-red-400 hover:underline">刪除</button>
          </div>
          <div class="flex items-center gap-2">
            <EmojiPicker v-model="newStationEmoji" />
            <input v-model="newStation" type="text" placeholder="新增站別，例：市集" class="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white text-gray-900">
            <button @click="addStation" :disabled="!newStation.trim()" class="shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-40">新增</button>
          </div>
        </div>
      </div>

      <!-- 電子發票 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">電子發票</h2>
            <p class="text-xs text-gray-400 mt-0.5">加值中心 Cetustek：號碼批次、上傳狀態</p>
          </div>
          <div class="flex gap-2">
            <button @click="loadInv" class="text-sm px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50">重新整理</button>
            <button @click="runInv" :disabled="invBusy" class="text-sm px-3 py-1.5 rounded-xl bg-green-700 text-white hover:bg-green-800 disabled:opacity-60">立即補傳</button>
          </div>
        </div>
        <div class="px-5 py-4 space-y-3 text-sm">
          <label class="flex items-center gap-2 text-gray-700">
            <input type="checkbox" v-model="invEnabled" @change="toggleInvEnabled">
            這台收銀機啟用電子發票（經本機 print-agent 連公司發票伺服器；沒勾時用測試號碼）
          </label>
          <div class="flex items-center gap-2 text-gray-700">
            <span class="shrink-0">收銀機密碼</span>
            <input v-model="stationPw" type="password" autocomplete="off" placeholder="區網連不到資料機時，改走家裡 Hub 用"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-sm">
            <button @click="saveStationPw" class="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50">儲存</button>
          </div>
          <p class="text-xs text-gray-400 -mt-1">{{ stationPwSaved ? '已設定（只存在這台瀏覽器）' : '還沒設定：區網不通時這台就無法開票、存交易紀錄' }}</p>
          <p v-if="invMsg" class="text-xs" :class="invErr ? 'text-red-600' : 'text-gray-500'">{{ invMsg }}</p>
          <template v-if="inv">
            <div>
              <div class="text-xs text-gray-400 mb-1">號碼批次（本期 {{ inv.term }} 與下一期）</div>
              <div v-if="!inv.batches.length" class="text-xs text-amber-600">還沒有號碼，第一次開票或補傳時會自動向加值中心取號</div>
              <div v-for="b in inv.batches" :key="b.track + b.start_no" class="flex justify-between font-mono text-xs py-0.5">
                <span>{{ b.roc_year }}年{{ b.term }}月 {{ b.track }}{{ b.start_no }}–{{ b.end_no }}</span>
                <span :class="b.next_no > b.end_no ? 'text-gray-400' : 'text-green-700'">
                  {{ b.next_no > b.end_no ? '已用完' : `剩 ${b.end_no - b.next_no + 1} 張` }}
                </span>
              </div>
            </div>
            <div class="text-xs text-gray-600">
              待上傳 {{ inv.counts.pending_upload }} 張<span v-if="inv.counts.failing_upload" class="text-red-600">（連續失敗 {{ inv.counts.failing_upload }} 張）</span>
              ・待作廢 {{ inv.counts.pending_cancel }} 張
              <span v-if="inv.counts.cancel_need_approval" class="text-red-600">・需核准文號 {{ inv.counts.cancel_need_approval }} 張</span>
            </div>
            <div v-for="p in inv.problems" :key="p.invoice_no" class="text-xs text-red-600 font-mono">
              {{ p.invoice_no }} {{ p.upload_status === 'pending' ? `上傳失敗×${p.upload_attempts}：${p.upload_msg}` : `作廢：${p.cancel_msg ?? p.cancel_status}` }}
            </div>
          </template>
        </div>
      </div>

      <!-- 折扣類型管理 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden break-inside-avoid mb-6 w-full inline-block">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
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
            class="px-4 md:px-5 py-4 flex flex-wrap md:flex-nowrap items-center gap-x-3 md:gap-x-4 gap-y-2"
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

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
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

            <div class="flex gap-3 shrink-0 whitespace-nowrap">
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

// ---- 本機收銀站 ----
import { writeStation, loadStation } from '~/composables/useStation'
import { useMachineNo, loadMachineNo, writeMachineNo } from '~/utils/orderNo'
const machineNo = useMachineNo()
function sampleNo(m: string) {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getFullYear() % 100)}${p(d.getMonth() + 1)}${p(d.getDate())}P${m}0001`
}
const station = useStation()
onMounted(loadStation)
onMounted(loadMachineNo)

// ---- 引導式結帳（每台機器自己記）----
import { useGuidedCheckout, loadGuidedCheckout, writeGuidedCheckout } from '~/composables/useGuidedCheckout'
const guided = useGuidedCheckout()
onMounted(loadGuidedCheckout)

// ---- 站別（存資料機）----
const { stations } = usePosStore()
const cat = useCatalog()
const catState = cat.state
const stationNames = reactive<Record<string, string>>({})
const stationEmojis = reactive<Record<string, string>>({})
watch(stations, (list) => { for (const s of list) { stationNames[s.id] = s.name; stationEmojis[s.id] = s.emoji || '' } }, { immediate: true, deep: true })
const newStation = ref('')
const newStationEmoji = ref('')
async function run(fn: () => Promise<unknown>) {
  try { await fn() } catch (e) { alert((e as Error).message) }
}
const addStation = () => run(async () => {
  const name = newStation.value.trim()
  newStation.value = ''
  const emoji = newStationEmoji.value || undefined
  newStationEmoji.value = ''
  await cat.saveStation({ name, emoji })
})
const renameStation = (id: string) => run(() => cat.saveStation({ id, name: (stationNames[id] ?? '').trim(), emoji: stationEmojis[id] || '' }))
function removeStation(id: string, name: string) {
  if (!confirm(`刪除站別「${name}」？品項上的這個站會一起拿掉。`)) return
  run(async () => { await cat.deleteStation(id); if (station.value === id) writeStation('') })
}

// ---- 電子發票 ----
import { einvoiceEnabled, setEInvoiceEnabled, einvoiceStatus, runEInvoiceQueue } from '~/utils/einvoiceApi'
const invEnabled = ref(false)
const inv      = ref<any>(null)
const invMsg   = ref('')
const invErr   = ref(false)
const invBusy  = ref(false)
// 收銀機密碼（= Netlify 的 POS_STATION_TOKEN）：只存在這台瀏覽器，畫面不顯示已存的值
import { stationToken, setStationToken } from '~/utils/stationApi'
const stationPw = ref('')
const stationPwSaved = ref(false)
onMounted(() => { stationPwSaved.value = !!stationToken() })
function saveStationPw() {
  if (!stationPw.value.trim()) return
  setStationToken(stationPw.value)
  stationPw.value = ''
  stationPwSaved.value = !!stationToken()
}
onMounted(() => { invEnabled.value = einvoiceEnabled(); if (invEnabled.value) loadInv() })
function toggleInvEnabled() { setEInvoiceEnabled(invEnabled.value); if (invEnabled.value) loadInv(); else { inv.value = null; invMsg.value = '' } }
async function loadInv() {
  const r = await einvoiceStatus()
  invErr.value = !r.ok
  if (r.ok) { inv.value = r.data; invMsg.value = '' } else invMsg.value = r.message
}
async function runInv() {
  invBusy.value = true
  const r = await runEInvoiceQueue()
  invBusy.value = false
  invErr.value = !r.ok
  invMsg.value = r.ok ? `補傳 ${r.data.uploads.length} 張、作廢 ${r.data.cancels.length} 張${r.data.batch ? `，取號：${r.data.batch}` : ''}` : r.message
  if (r.ok) loadInv()
}

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
