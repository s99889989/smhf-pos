<template>
  <div class="flex flex-col h-full overflow-hidden">

    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div class="min-w-0">
        <h1 class="text-lg font-bold text-gray-900">連線狀況</h1>
        <p class="text-xs text-gray-400 mt-0.5">哪幾台正在用收銀系統、這台連不連得到資料機。每分鐘自動更新。</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <span v-if="checkedAt" class="text-xs text-gray-400">{{ checkedAt }} 更新</span>
        <button @click="refresh" :disabled="loading"
          class="bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          {{ loading ? '檢查中…' : '重新檢查' }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-6">

      <!-- 總覽：資料機、Hub、pos-agent、各站 -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div v-for="c in summaryCards" :key="c.key" class="bg-white rounded-2xl border p-4" :class="c.border">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="c.dot"></span>
            <span class="text-sm font-semibold text-gray-800 truncate">{{ c.title }}</span>
          </div>
          <div class="mt-2 text-base font-bold" :class="c.text">{{ c.status }}</div>
          <div class="mt-0.5 text-xs text-gray-400 truncate" :title="c.sub">{{ c.sub || '　' }}</div>
        </div>
      </div>

      <!-- 這台電腦到資料機的兩條路 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-sm font-semibold text-gray-800">這台到資料機的路線</h2>
          <p class="text-xs text-gray-400 mt-0.5">平常走區網；區網不通（或在家裡、用手機）時改走家裡 Hub。哪一段變紅就是卡在那裡。</p>
        </div>
        <div class="px-5 py-4 space-y-5">
          <div>
            <div class="text-xs font-semibold text-gray-500 mb-2">區網{{ lan && lan.ms ? `（${lan.ms} ms）` : '' }}</div>
            <div class="flex flex-wrap items-center gap-y-2">
              <template v-for="(h, i) in lanHops" :key="h.label">
                <span v-if="i > 0" class="mx-1.5 text-gray-300">→</span>
                <span class="text-xs font-medium px-3 py-1.5 rounded-full border" :class="hopClass(h.state)">
                  {{ hopIcon(h.state) }} {{ h.label }}
                </span>
              </template>
            </div>
            <p v-if="lan && lan.message" class="mt-2 text-xs" :class="lan.notCashier ? 'text-gray-500' : 'text-red-600'">{{ lan.message }}</p>
          </div>
          <div>
            <div class="text-xs font-semibold text-gray-500 mb-2">家裡 Hub{{ hub && hub.ms ? `（${hub.ms} ms）` : '' }}</div>
            <div class="flex flex-wrap items-center gap-y-2">
              <template v-for="(h, i) in hubHops" :key="h.label">
                <span v-if="i > 0" class="mx-1.5 text-gray-300">→</span>
                <span class="text-xs font-medium px-3 py-1.5 rounded-full border" :class="hopClass(h.state)">
                  {{ hopIcon(h.state) }} {{ h.label }}
                </span>
              </template>
            </div>
            <p v-if="hub && hub.message" class="mt-2 text-xs" :class="hub.noToken ? 'text-gray-500' : 'text-red-600'">{{ hub.message }}</p>
            <p v-if="hub && hub.hint" class="mt-1 text-xs text-gray-500">{{ hub.hint }}</p>
          </div>
        </div>
      </div>

      <!-- 各台機器 -->
      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-semibold text-gray-800">各台機器</h2>
            <p class="text-xs text-gray-400 mt-0.5">開著收銀網頁的電腦、平板、手機。3 分鐘內有報到算「使用中」。</p>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-xs text-gray-500">這台的名稱</span>
            <input v-model="myName" @change="saveName" type="text" placeholder="例如：餐廳收銀 1"
              style="width:180px; min-width:0; border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-size:13px; outline:none; color:#111;">
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-400 border-b border-gray-200">
                <th class="text-left px-5 py-3 font-medium">狀態</th>
                <th class="text-left py-3 font-medium">名稱</th>
                <th class="text-left py-3 font-medium">站別</th>
                <th class="text-left py-3 font-medium">路線</th>
                <th class="text-left py-3 font-medium">print-agent</th>
                <th class="text-left py-3 font-medium">瀏覽器</th>
                <th class="text-left py-3 font-medium">畫面</th>
                <th class="text-right px-5 py-3 font-medium">最後連線</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!rows.length">
                <td colspan="8" class="px-5 py-8 text-center text-xs text-gray-400">
                  {{ list ? '還沒有機器報到' : (loading ? '讀取中…' : '連不到資料機，看不到各台機器') }}
                </td>
              </tr>
              <tr v-for="d in rows" :key="d.deviceId" class="border-b border-gray-100" :class="d.mine ? 'bg-green-50' : ''">
                <td class="px-5 py-3 whitespace-nowrap">
                  <span class="text-xs px-2.5 py-1 rounded-full font-medium" :class="d.badge">{{ d.stateLabel }}</span>
                </td>
                <td class="py-3 font-medium text-gray-900">
                  {{ d.label }}<span v-if="d.mine" class="ml-1.5 text-xs text-green-700">（這台）</span>
                </td>
                <td class="py-3 text-gray-600">{{ d.stationLabel }}</td>
                <td class="py-3 text-gray-600 whitespace-nowrap">{{ d.viaLabel }}</td>
                <td class="py-3 text-xs" :class="d.agentOld ? 'text-amber-600' : 'text-gray-500'">{{ d.agent ? 'v' + d.agent : '沒開' }}</td>
                <td class="py-3 text-xs text-gray-500 whitespace-nowrap">{{ d.ua }}</td>
                <td class="py-3 text-xs text-gray-500">{{ pageLabel(d.page) }}</td>
                <td class="px-5 py-3 text-right text-xs text-gray-500 whitespace-nowrap" :title="d.lastSeen">{{ d.ago }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="list" class="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
          資料機：{{ list.server }} · print-agent v{{ list.version }} · {{ list.startedAt }} 啟動
        </div>
      </div>

      <!-- print-agent 自動更新（1.7 起） -->
      <AgentUpdatePanel />

    </div>
  </div>
</template>

<script setup lang="ts">
import { checkLan, checkHub, deviceId, deviceName, setDeviceName, sendPing,
  type LanCheck, type HubCheck, type HopState, type PresenceList } from '~/utils/presenceApi'

const { stations, stationLabel } = usePosStore()

const lan = ref<LanCheck | null>(null)
const hub = ref<HubCheck | null>(null)
const loading = ref(false)
const checkedAt = ref('')
const myId = ref('')
const myName = ref('')

const list = computed<PresenceList | null>(() => lan.value?.list ?? hub.value?.list ?? null)

async function refresh() {
  if (loading.value) return
  loading.value = true
  try {
    // 先報到一次，「這台」馬上出現在清單上
    await sendPing(useRoute().path, readStation()).catch(() => '')
    const [a, b] = await Promise.all([checkLan(), checkHub()])
    lan.value = a
    hub.value = b
    checkedAt.value = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  } finally {
    loading.value = false
  }
}

function saveName() {
  setDeviceName(myName.value)
  void refresh()
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  loadStation()
  myId.value = deviceId()
  myName.value = deviceName()
  void refresh()
  timer = setInterval(() => { void refresh() }, 60 * 1000)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

// ---------------- 路線 ----------------

const lanHops = computed(() => {
  const l = lan.value
  return [
    { label: '這台瀏覽器', state: 'ok' as HopState },
    { label: `本機 print-agent${l?.agentVersion ? ' v' + l.agentVersion : ''}`, state: l?.agent ?? 'unknown' },
    { label: '資料機', state: l ? (l.notCashier ? 'unknown' : l.dataMachine) : 'unknown' },
  ]
})
const hubHops = computed(() => {
  const h = hub.value
  return [
    { label: '這台瀏覽器', state: 'ok' as HopState },
    { label: '網站伺服器', state: h?.netlify ?? 'unknown' },
    { label: '家裡 Hub', state: h?.hub ?? 'unknown' },
    { label: 'pos-agent', state: h?.posAgent ?? 'unknown' },
    { label: '資料機', state: h?.dataMachine ?? 'unknown' },
  ]
})

function hopClass(s: HopState) {
  if (s === 'ok') return 'bg-green-50 border-green-300 text-green-700'
  if (s === 'fail') return 'bg-red-50 border-red-300 text-red-700'
  if (s === 'old') return 'bg-amber-50 border-amber-300 text-amber-700'
  return 'bg-gray-50 border-gray-200 text-gray-400'
}
function hopIcon(s: HopState) {
  return s === 'ok' ? '✓' : s === 'fail' ? '✕' : s === 'old' ? '!' : '?'
}

// ---------------- 各台機器 ----------------

function parseTime(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s || '')
  if (!m) return 0
  const [y = 0, mo = 1, d = 1, h = 0, mi = 0, se = 0] = m.slice(1).map(Number)
  return new Date(y, mo - 1, d, h, mi, se).getTime()
}
// 用資料機的時間算「幾分鐘前」，各台電腦時鐘不準也不影響
function minutesAgo(s: string) {
  const now = parseTime(list.value?.now ?? '')
  const t = parseTime(s)
  return now && t ? Math.max(0, (now - t) / 60000) : Infinity
}
function agoText(min: number, s: string) {
  if (min < 1) return '剛剛'
  if (min < 60) return `${Math.floor(min)} 分鐘前`
  if (min < 24 * 60) return `${Math.floor(min / 60)} 小時前`
  return s.slice(5, 16)
}
const ACTIVE_MIN = 3
const RECENT_MIN = 30

const PAGE_LABEL: Record<string, string> = {
  '/': '收銀點餐', '/internal-use': '內部領用', '/products': '品項管理', '/materials': '物料庫存',
  '/staff': '員工管理', '/vip': 'VIP 管理', '/reports': '營業報表', '/shop-orders': '線上訂單',
  '/settings': '系統設定', '/connections': '連線狀況',
}
function pageLabel(p: string) { return PAGE_LABEL[p] ?? p }

const rows = computed(() => {
  const l = list.value
  if (!l) return []
  return l.devices.map((d) => {
    const min = minutesAgo(d.lastSeen)
    const active = min <= ACTIVE_MIN
    const recent = !active && min <= RECENT_MIN
    const local = d.via === 'lan' && d.from === l.server
    return {
      ...d,
      min,
      mine: d.deviceId === myId.value,
      label: d.name || (d.via === 'lan' ? d.from : '') || d.deviceId.slice(0, 10),
      stationLabel: d.station ? stationLabel(d.station) : (local ? '資料機' : '不指定'),
      viaLabel: local ? '資料機本機' : d.via === 'lan' ? `區網（${d.from}）` : d.via === 'hub' ? '家裡 Hub' : d.via,
      agentOld: !!d.agent && d.agent < '1.6',
      stateLabel: active ? '使用中' : recent ? '剛才有用' : '離線',
      badge: active ? 'bg-green-100 text-green-700' : recent ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400',
      ago: agoText(min, d.lastSeen),
    }
  }).sort((a, b) => a.min - b.min)
})

// ---------------- 總覽卡片 ----------------

interface Card { key: string; title: string; status: string; sub: string; dot: string; text: string; border: string }
const TONE = {
  ok:   { dot: 'bg-green-500', text: 'text-green-700', border: 'border-green-200' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-600', border: 'border-amber-200' },
  bad:  { dot: 'bg-red-500',   text: 'text-red-600',   border: 'border-red-200' },
  idle: { dot: 'bg-gray-300',  text: 'text-gray-400',  border: 'border-gray-200' },
}
function card(key: string, title: string, tone: keyof typeof TONE, status: string, sub = ''): Card {
  return { key, title, status, sub, ...TONE[tone] }
}

const summaryCards = computed<Card[]>(() => {
  const l = lan.value, h = hub.value
  const cards: Card[] = []
  const checked = !!(l || h)

  // 資料機：任一條路通就算在線
  const dm = [l?.dataMachine, h?.dataMachine]
  if (dm.includes('ok')) cards.push(card('data', '資料機', 'ok', '在線', list.value ? `${list.value.server} · v${list.value.version}` : ''))
  else if (dm.includes('old')) cards.push(card('data', '資料機', 'warn', '要更新', 'print-agent 要 1.6'))
  else if (dm.includes('fail')) cards.push(card('data', '資料機', 'bad', '連不到', l?.message || h?.message || ''))
  else cards.push(card('data', '資料機', 'idle', checked ? '無法判斷' : '檢查中…', l?.message || h?.message || ''))

  if (!h || h.noToken) cards.push(card('hub', '家裡 Hub', 'idle', h ? '無法檢查' : '檢查中…', h ? '這台沒設收銀機密碼' : ''))
  else if (h.hub === 'ok') cards.push(card('hub', '家裡 Hub', 'ok', '在線', `${h.ms} ms`))
  else if (h.hub === 'fail') cards.push(card('hub', '家裡 Hub', 'bad', '連不到', h.message))
  else cards.push(card('hub', '家裡 Hub', h.netlify === 'fail' ? 'bad' : 'idle', h.netlify === 'fail' ? '網站伺服器有問題' : '無法判斷', h.message))

  if (!h || h.noToken || h.posAgent === 'unknown') cards.push(card('pos-agent', 'pos-agent', 'idle', h ? '無法判斷' : '檢查中…', h?.noToken ? '要經 Hub 才看得到' : (h?.message || '')))
  else if (h.posAgent === 'ok') cards.push(card('pos-agent', 'pos-agent', 'ok', '在線', '資料機連回 Hub'))
  else cards.push(card('pos-agent', 'pos-agent', 'bad', '不在線', h.message))

  // 各站：有沒有機器正在用
  const devs = rows.value
  for (const s of stations.value) {
    const mine = devs.filter(d => d.station === s.id)
    const act = mine.filter(d => d.min <= ACTIVE_MIN)
    const rec = mine.filter(d => d.min <= RECENT_MIN)
    if (!list.value) cards.push(card('st-' + s.id, s.name, 'idle', '—', '看不到資料機'))
    else if (act.length) cards.push(card('st-' + s.id, s.name, 'ok', `使用中 ${act.length} 台`, act.map(d => d.label).join('、')))
    else if (rec.length) cards.push(card('st-' + s.id, s.name, 'warn', '剛才有用', rec[0]?.ago ?? ''))
    else cards.push(card('st-' + s.id, s.name, 'idle', '沒有在用', mine[0] ? `上次 ${mine[0].ago}` : '還沒有機器設這站'))
  }
  return cards
})
</script>
