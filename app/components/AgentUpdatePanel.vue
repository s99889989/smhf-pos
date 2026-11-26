<template>
  <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-gray-800">print-agent 更新</h2>
        <p class="text-xs text-gray-400 mt-0.5">在這裡發佈新的 smhf-print-agent.exe 到資料機，各台 print-agent 每 5 分鐘自己檢查，閒下來就換成新版。</p>
      </div>
      <button @click="load" :disabled="loading"
        class="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
        {{ loading ? '讀取中…' : '重新整理' }}
      </button>
    </div>

    <div class="px-5 py-4 space-y-4">
      <p v-if="error" class="text-xs text-red-600">{{ error }}</p>

      <!-- 目前發佈的版本 -->
      <div v-if="info" class="text-sm text-gray-700 space-y-1">
        <div>
          <span class="text-gray-500">資料機發佈中：</span>
          <span v-if="info.version" class="font-semibold text-gray-900">v{{ info.version }}</span>
          <span v-else class="text-gray-400">還沒發佈過</span>
          <span v-if="info.uploadedAt" class="text-xs text-gray-400">（{{ info.uploadedAt }}，{{ info.uploadedBy }}{{ info.note ? '：' + info.note : '' }}）</span>
        </div>
        <div class="text-xs text-gray-400">資料機 {{ info.server }} 正在跑 v{{ info.serverVersion }}</div>
      </div>

      <!-- 各台 print-agent -->
      <div v-if="info && info.agents.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-gray-400 border-b border-gray-200">
              <th class="text-left py-2 font-medium">電腦</th>
              <th class="text-left py-2 font-medium">版本</th>
              <th class="text-left py-2 font-medium">上次結果</th>
              <th class="text-right py-2 font-medium">最後檢查</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in agentRows" :key="a.name" class="border-b border-gray-100">
              <td class="py-2 font-medium text-gray-900">{{ a.name }}<span v-if="a.server" class="ml-1.5 text-xs text-gray-400">（資料機）</span></td>
              <td class="py-2 text-xs" :class="a.current ? 'text-green-700' : 'text-amber-600'">v{{ a.version }}{{ a.current ? '' : '（待更新）' }}</td>
              <td class="py-2 text-xs text-gray-500">{{ a.result || '—' }}</td>
              <td class="py-2 text-right text-xs text-gray-500 whitespace-nowrap">{{ a.ago }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-gray-400">只列出 1.7 版以後、最近來問過資料機的 print-agent（資料機重開後清單會清空，5 分鐘內補回來）。</p>
      </div>

      <!-- 發佈新版 -->
      <div class="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-3">
        <div class="text-sm font-semibold text-gray-800">發佈新版</div>
        <p v-if="info && !info.uploadEnabled" class="text-xs text-amber-600">
          資料機的 einvoice.ini 還沒設定 UpdateKey=（更新密碼），要先到資料機設定一次才能從這裡發佈。
        </p>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <input ref="fileInput" type="file" accept=".exe" @change="onFile" class="text-xs text-gray-600" style="max-width:260px;">
          <input v-model="updateKey" type="password" placeholder="更新密碼" autocomplete="off"
            style="width:150px; min-width:0; border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-size:13px; outline:none; color:#111; background:#fff;">
          <input v-model="note" type="text" placeholder="說明（選填）" maxlength="200"
            style="width:220px; min-width:0; border:1px solid #e5e7eb; border-radius:10px; padding:6px 10px; font-size:13px; outline:none; color:#111; background:#fff;">
          <button @click="publish" :disabled="publishing || !file || !updateKey"
            class="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            {{ publishing ? '上傳檢查中…' : '發佈到資料機' }}
          </button>
        </div>
        <p class="text-xs text-gray-400">更新密碼只用來在這台算簽章，不會傳出去。資料機會先試跑新版檢查，沒通過就不發佈。要退回舊版，把舊的 exe 再發佈一次。</p>
        <p v-if="publishMsg" class="text-xs" :class="publishOk ? 'text-green-700' : 'text-red-600'">{{ publishMsg }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { latestRelease, publishRelease, verCompare, type ReleaseInfo } from '~/utils/agentUpdateApi'

const info = ref<ReleaseInfo | null>(null)
const loading = ref(false)
const error = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const updateKey = ref('')
const note = ref('')
const publishing = ref(false)
const publishMsg = ref('')
const publishOk = ref(false)

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    info.value = await latestRelease()
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function onFile(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
  publishMsg.value = ''
}

async function publish() {
  if (!file.value || !updateKey.value) return
  publishing.value = true
  publishMsg.value = ''
  try {
    const r = await publishRelease(file.value, updateKey.value, note.value.trim())
    publishOk.value = true
    publishMsg.value = `已發佈 v${r.version}（${Math.round(r.size / 1024)} KB，${r.via === 'lan' ? '經區網' : '經家裡 Hub'}）。資料機約 5 秒後換版，其他台 5 分鐘內陸續更新。`
    updateKey.value = ''
    note.value = ''
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
    setTimeout(() => { void load() }, 15000)
  } catch (e) {
    publishOk.value = false
    publishMsg.value = (e as Error).message
  } finally {
    publishing.value = false
  }
}

function parseTime(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(s || '')
  if (!m) return 0
  const [y = 0, mo = 1, d = 1, h = 0, mi = 0, se = 0] = m.slice(1).map(Number)
  return new Date(y, mo - 1, d, h, mi, se).getTime()
}

const agentRows = computed(() => {
  const i = info.value
  if (!i) return []
  const now = parseTime(i.now)
  const target = i.version || i.serverVersion
  return i.agents.map((a) => {
    const t = parseTime(a.at)
    const min = now && t ? Math.max(0, (now - t) / 60000) : 0
    return {
      ...a,
      current: verCompare(a.version, target) === 0,
      ago: a.server ? '—' : min < 1 ? '剛剛' : min < 60 ? `${Math.floor(min)} 分鐘前` : `${Math.floor(min / 60)} 小時前`,
    }
  }).sort((a, b) => (a.server ? -1 : b.server ? 1 : a.name.localeCompare(b.name)))
})

onMounted(() => { void load() })
</script>
