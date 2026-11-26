<template>
  <span>
    <button class="text-gray-400 hover:underline" title="資料機查不到葆光資料庫時的備用方法" @click="open">匯入 CSV</button>

    <div v-if="show" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" @click.self="close">
      <div class="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col text-sm">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-base font-bold text-gray-900">匯入舊系統（BK35）發票</h2>
          <p class="text-xs text-gray-400 mt-0.5">
            資料機（print-agent 1.18）平常會直接查葆光的資料庫，不用匯入；資料庫連不到時才用這裡。
            選舊系統匯出的「發票資料_….csv」。只存成紀錄放在資料機，<b>不會重新上傳加值中心</b>、不佔新系統號碼；
            同一個發票號碼新系統已有、或之前匯入過的會略過（舊系統之後作廢的會更新成作廢）。
          </p>
        </div>

        <div class="px-5 py-4 space-y-3 overflow-y-auto">
          <input ref="fileEl" type="file" accept=".csv,.txt,.xlsx" class="text-xs" @change="pick">
          <p v-if="error" class="text-xs text-red-600 whitespace-pre-line">{{ error }}</p>

          <template v-if="parsed">
            <div class="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 space-y-1 text-xs text-gray-600">
              <div>檔案共 {{ parsed.rows }} 列 → <b class="text-gray-900">{{ parsed.list.length }} 張發票</b>
                <span v-if="parsed.dupRows">（檔案裡重複列 {{ parsed.dupRows }} 列已合併）</span></div>
              <div>發票日期 {{ parsed.from }} ～ {{ parsed.to }}，作廢 {{ parsed.voided }} 張</div>
              <div>金額（不含作廢）${{ parsed.amount.toLocaleString() }}</div>
              <div v-for="p in parsed.byPos" :key="p.name">{{ p.name || '（沒有 POSID）' }}：{{ p.count }} 張</div>
              <div v-if="parsed.skipped" class="text-amber-600">有 {{ parsed.skipped }} 列缺發票號碼或日期，不匯入</div>
            </div>

            <div v-if="checking" class="text-xs text-gray-400">向資料機比對中…</div>
            <div v-else-if="check" class="rounded-lg border px-3 py-2 text-xs space-y-1" :class="done ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-gray-200 text-gray-700'">
              <div v-if="done" class="font-semibold">已匯入</div>
              <div>{{ done ? '新增' : '會新增' }} <b>{{ check.added }}</b> 張，{{ done ? '更新' : '會更新' }} {{ check.updated }} 張</div>
              <div class="text-gray-500">之前匯入過、內容一樣：{{ check.unchanged }} 張（略過）</div>
              <div v-if="check.inNewSystem" class="text-gray-500">
                新系統已有同號：{{ check.inNewSystem }} 張（略過）
                <span class="font-mono">{{ check.inNewSystemNos.slice(0, 5).join('、') }}{{ check.inNewSystem > 5 ? '…' : '' }}</span>
              </div>
              <div v-if="check.invalid" class="text-amber-600">格式不對：{{ check.invalid }} 張 {{ check.invalidNos.slice(0, 5).join('、') }}</div>
            </div>
          </template>
        </div>

        <div class="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600" @click="close">{{ done ? '關閉' : '取消' }}</button>
          <button v-if="!done" class="px-4 py-2 rounded-xl bg-green-700 text-white disabled:opacity-50"
            :disabled="!check || saving || (check.added + check.updated === 0)" @click="save">
            {{ saving ? '匯入中…' : check && check.added + check.updated === 0 ? '沒有要匯入的' : `匯入 ${check ? check.added + check.updated : ''} 張` }}
          </button>
        </div>
      </div>
    </div>
  </span>
</template>

<script setup lang="ts">
// 舊系統（葆光 BK35）「發票資料」匯出 CSV 欄位：
// 序號,作廢,發票號碼,客戶統編,帳單號,發票月份,發票日期,類別,營業日期,服務費,發票金額,作業人員,備註說明,卡別,POSID,建檔時間
import { readSheet } from '~/utils/sheetRead'
import { importLegacyInvoices, type LegacyInvoice, type LegacyImportResult } from '~/utils/einvoiceApi'

const emit = defineEmits<{ imported: [] }>()
const CHUNK = 500 // 資料機一次最多收 2000 張，分批送比較不會逾時

const show = ref(false)
const fileEl = ref<HTMLInputElement | null>(null)
const error = ref('')
const parsed = ref<null | {
  rows: number; list: LegacyInvoice[]; dupRows: number; skipped: number; voided: number; amount: number
  from: string; to: string; byPos: { name: string; count: number }[]
}>(null)
const check = ref<LegacyImportResult | null>(null)
const checking = ref(false)
const saving = ref(false)
const done = ref(false)

function open() { reset(); show.value = true }
function close() { if (saving.value) return; show.value = false; if (done.value) emit('imported') }
function reset() {
  error.value = ''; parsed.value = null; check.value = null; done.value = false
  if (fileEl.value) fileEl.value.value = ''
}

const ymd = (s: string) => {
  const m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(s.trim())
  return m ? `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}` : ''
}
const hms = (s: string) => {
  const m = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(s.trim())
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}` : ''
}

async function pick() {
  const f = fileEl.value?.files?.[0]
  error.value = ''; parsed.value = null; check.value = null; done.value = false
  if (!f) return
  let rows: string[][]
  try { rows = await readSheet(f) } catch (e) { error.value = '讀不到檔案：' + (e as Error).message; return }
  const head = (rows[0] ?? []).map(h => h.trim())
  const col = (name: string) => head.indexOf(name)
  const need = ['發票號碼', '發票日期', '發票金額']
  const miss = need.filter(n => col(n) < 0)
  if (miss.length) { error.value = `這不像舊系統的發票資料匯出檔：找不到「${miss.join('、')}」欄。\n第一列是：${head.join(', ')}`; return }
  const c = {
    seq: col('序號'), void: col('作廢'), no: col('發票號碼'), buyer: col('客戶統編'), order: col('帳單號'),
    date: col('發票日期'), total: col('發票金額'), note: col('備註說明'), pos: col('POSID'), created: col('建檔時間'),
  }
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')

  const byNo = new Map<string, LegacyInvoice>()
  let dupRows = 0, skipped = 0, dataRows = 0
  for (const r of rows.slice(1)) {
    if (!r.some(x => x.trim())) continue
    dataRows++
    const no = get(r, c.no).toUpperCase().replace('-', '')
    const date = ymd(get(r, c.date))
    if (!/^[A-Z]{2}\d{8}$/.test(no) || !date) { skipped++; continue }
    const created = get(r, c.created)
    const inv: LegacyInvoice = {
      invoiceNo: no,
      date,
      time: ymd(created) === date ? hms(created) : '',
      total: Math.round(Number(get(r, c.total).replace(/,/g, '')) || 0),
      buyerId: get(r, c.buyer),
      orderNo: get(r, c.order),
      posId: get(r, c.pos),
      payNote: get(r, c.note),
      voided: /^(x|y|v|1|是|作廢)$/i.test(get(r, c.void)),
      seq: get(r, c.seq),
      createdAt: created,
    }
    const prev = byNo.get(no)
    if (prev) { dupRows++; if (inv.voided) prev.voided = true; continue } // 舊系統同一張偶爾匯出兩列（內容相同）
    byNo.set(no, inv)
  }
  const list = [...byNo.values()].sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo))
  if (!list.length) { error.value = '檔案裡沒有可匯入的發票'; return }
  const pos = new Map<string, number>()
  list.forEach(i => pos.set(i.posId, (pos.get(i.posId) ?? 0) + 1))
  const dates = list.map(i => i.date).sort()
  parsed.value = {
    rows: dataRows, list, dupRows, skipped,
    voided: list.filter(i => i.voided).length,
    amount: list.filter(i => !i.voided).reduce((s, i) => s + i.total, 0),
    from: dates[0]!, to: dates[dates.length - 1]!,
    byPos: [...pos].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
  }
  await run(true)
}

// 分批送資料機；dryRun 只比對不寫入
async function run(dryRun: boolean) {
  const list = parsed.value?.list ?? []
  const sum: LegacyImportResult = { dryRun, added: 0, updated: 0, unchanged: 0, invalid: 0, inNewSystem: 0, inNewSystemNos: [], invalidNos: [] }
  dryRun ? (checking.value = true) : (saving.value = true)
  try {
    for (let i = 0; i < list.length; i += CHUNK) {
      const r = await importLegacyInvoices(list.slice(i, i + CHUNK), dryRun)
      if (!r.ok) {
        error.value = (r.message.includes('沒有這個功能') ? '資料機的 print-agent 太舊，要 1.18 以上才能匯入舊系統發票。\n' : '') +
          `${dryRun ? '比對' : '匯入'}失敗${i ? `（前 ${i} 張已${dryRun ? '比對' : '匯入'}）` : ''}：${r.message}`
        if (!dryRun && i) done.value = true
        return
      }
      const d = r.data
      sum.added += d.added; sum.updated += d.updated; sum.unchanged += d.unchanged; sum.invalid += d.invalid
      sum.inNewSystem += d.inNewSystem
      sum.inNewSystemNos.push(...(d.inNewSystemNos ?? [])); sum.invalidNos.push(...(d.invalidNos ?? []))
    }
    check.value = sum
    if (!dryRun) done.value = true
  } finally {
    checking.value = false; saving.value = false
  }
}

async function save() {
  if (!check.value) return
  error.value = ''
  await run(false)
}
</script>
