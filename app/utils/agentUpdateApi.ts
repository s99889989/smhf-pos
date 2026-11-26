// print-agent 自動更新（print-agent 1.7 起，Update.cs）：
//   網頁把新的 smhf-print-agent.exe 發佈到資料機，收銀機、平板的 print-agent 每 5 分鐘自己問資料機、下載、換版。
//   和其他資料一樣「區網優先，不通才走家裡 Hub」。
import { printAgentUrl } from './printAgent'
import { hubFetch, lanUnreachable, errorText, stationToken } from './stationApi'
import { hmacSha256Hex } from './sha256'

export interface AgentInfo {
  name: string // 電腦名稱
  version: string
  result: string // 上次檢查 / 更新的結果
  at: string // 最後一次來問的時間（資料機時間）
  server?: boolean
}
export interface ReleaseInfo {
  ok: true
  version?: string // 資料機發佈中的版本（還沒發佈過是空的）
  sha256?: string
  size?: number
  uploadedAt?: string
  uploadedBy?: string
  note?: string
  server: string // 資料機電腦名稱
  serverVersion: string // 資料機自己正在跑的版本
  now: string
  uploadEnabled: boolean // 資料機 einvoice.ini 有沒有設 UpdateKey
  agents: AgentInfo[]
}

async function withTimeout(run: (signal?: AbortSignal) => Promise<Response>, ms: number) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null
  try { return await run(ctrl?.signal) } finally { if (timer) clearTimeout(timer) }
}

/** 先打本機 print-agent（區網），本機沒開、連不到資料機或是舊版（404）就改走 Hub */
async function call(sub: string, init: RequestInit, timeoutMs: number, hubInit: RequestInit = init): Promise<{ res: Response; via: 'lan' | 'hub' }> {
  const base = printAgentUrl()
  if (base !== 'off') {
    try {
      const res = await withTimeout(signal => fetch(`${base}/${sub}`, { ...init, signal }), timeoutMs)
      if (res.status !== 404 && !(await lanUnreachable(res))) return { res, via: 'lan' }
    } catch { /* 改走 Hub */ }
  }
  if (!stationToken()) throw new Error('連不到資料機：本機 print-agent 沒開或不是 1.7 版，這台也沒設收銀機密碼不能走 Hub')
  const res = await withTimeout(signal => hubFetch(sub, { ...hubInit, signal }), timeoutMs + 5000)
  return { res, via: 'hub' }
}

export async function latestRelease(): Promise<ReleaseInfo> {
  const { res } = await call('update/latest', {}, 8000)
  const j = await res.json().catch(() => null)
  if (res.status === 404) throw new Error('資料機的 print-agent 還不是 1.7 版，沒有自動更新功能（第一次要手動換）')
  if (!res.ok || !j?.ok) throw new Error(errorText(j, res.status))
  return j as ReleaseInfo
}

function readFile(file: File): Promise<Uint8Array> {
  // Mypal（Firefox 68）沒有 File.arrayBuffer()，用 FileReader
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(new Uint8Array(r.result as ArrayBuffer))
    r.onerror = () => reject(r.error || new Error('讀不到檔案'))
    r.readAsArrayBuffer(file)
  })
}

/** 發佈新版：用更新密碼算簽章（密碼不送出），exe 送到資料機；資料機檢查通過才發佈 */
export async function publishRelease(file: File, updateKey: string, note: string) {
  const bytes = await readFile(file)
  if (bytes.length < 4096 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) throw new Error('這不是 exe 檔，請選 smhf-print-agent.exe')
  const sig = hmacSha256Hex(updateKey, bytes)
  const q = `sig=${sig}&note=${encodeURIComponent(note.slice(0, 200))}`
  const body = bytes.buffer as ArrayBuffer
  // 打本機用 text/plain：舊瀏覽器不會先送 OPTIONS。
  // 走 Hub 一定要 application/octet-stream：Netlify 會把 text/* 的內容當文字（UTF-8）處理，exe 會被改壞、簽章就對不上
  const { res, via } = await call(`update/upload?${q}`, {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body,
  }, 60000, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body,
  })
  const j = await res.json().catch(() => null)
  if (res.status === 404) throw new Error('資料機的 print-agent 還不是 1.7 版，第一次要手動換')
  if (!res.ok || !j?.ok) throw new Error(errorText(j, res.status))
  return { ...(j as { version: string; sha256: string; size: number }), via }
}

/** 版本比較：'1.10' > '1.9' */
export function verCompare(a: string, b: string) {
  const x = (a || '').split('.').map(Number), y = (b || '').split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] || 0, q = y[i] || 0
    if (p !== q) return p < q ? -1 : 1
  }
  return 0
}
