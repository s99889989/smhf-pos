// 讀 Excel（.xlsx）或 CSV 的第一個工作表，回傳一列一列的文字陣列。
// 不另外裝套件：.xlsx 是 zip 檔，用瀏覽器內建的 DecompressionStream 解壓（Chrome 80+、Edge、Firefox 113+）。
// XP 上的 Mypal 沒有 DecompressionStream，那台請改匯入 CSV（Excel「另存新檔 → CSV UTF-8」）。

export async function readSheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(decodeText(new Uint8Array(await file.arrayBuffer())))
  if (name.endsWith('.xls')) throw new Error('不支援舊版 .xls，請在 Excel 另存成 .xlsx 或 CSV')
  return readXlsx(new Uint8Array(await file.arrayBuffer()))
}

// ---------- CSV ----------
// CSV 的編碼：有 BOM 或是有效的 UTF-8 → UTF-8；UTF-16 BOM（Excel「Unicode 文字」）→ UTF-16；
// 其他當 Big5（中文版 Excel 直接「另存 CSV」、舊系統匯出的檔案大多是 Big5）
export function decodeText(buf: Uint8Array): string {
  if (buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf)
  if (buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) } catch { /* 不是 UTF-8 */ }
  try { return new TextDecoder('big5').decode(buf) } catch { return new TextDecoder().decode(buf) }
}

export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',' || c === '\t') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(v => v.trim()))
}

// ---------- XLSX ----------
async function readXlsx(buf: Uint8Array): Promise<string[][]> {
  const files = unzipIndex(buf)
  const text = async (path: string) => {
    const f = files.get(path)
    return f ? new TextDecoder().decode(await inflate(buf, f)) : ''
  }
  // 第一個工作表的路徑：workbook.xml 的第一個 sheet → rels 對應的檔案
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const wb = parseXml(await text('xl/workbook.xml'))
  const rels = parseXml(await text('xl/_rels/workbook.xml.rels'))
  const firstSheet = wb?.getElementsByTagName('sheet')[0]
  const rid = firstSheet?.getAttribute('r:id') || firstSheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
  if (rid && rels) {
    for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
      if (r.getAttribute('Id') === rid) {
        const t = (r.getAttribute('Target') || '').replace(/^\/?xl\//, '').replace(/^\//, '')
        sheetPath = 'xl/' + t
      }
    }
  }
  const shared: string[] = []
  const ss = parseXml(await text('xl/sharedStrings.xml'))
  if (ss) for (const si of Array.from(ss.getElementsByTagName('si'))) {
    shared.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent || '').join(''))
  }
  const sheet = parseXml(await text(sheetPath))
  if (!sheet) throw new Error('讀不到工作表')
  const rows: string[][] = []
  for (const r of Array.from(sheet.getElementsByTagName('row'))) {
    const row: string[] = []
    for (const c of Array.from(r.getElementsByTagName('c'))) {
      const col = colIndex(c.getAttribute('r') || '')
      const t = c.getAttribute('t')
      let v = ''
      if (t === 'inlineStr') v = Array.from(c.getElementsByTagName('t')).map(x => x.textContent || '').join('')
      else {
        const raw = c.getElementsByTagName('v')[0]?.textContent ?? ''
        v = t === 's' ? (shared[Number(raw)] ?? '') : raw
      }
      row[col >= 0 ? col : row.length] = v
    }
    rows.push(Array.from(row, x => x ?? ''))
  }
  return rows.filter(r => r.some(v => v.trim()))
}

function colIndex(ref: string) {
  const m = /^([A-Z]+)/.exec(ref)
  if (!m) return -1
  let n = 0
  for (const ch of m[1]!) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseXml(s: string) {
  if (!s) return null
  const doc = new DOMParser().parseFromString(s, 'application/xml')
  return doc.getElementsByTagName('parsererror').length ? null : doc
}

interface ZipEntry { method: number; offset: number; size: number }

// 讀 zip 的中央目錄，取得每個檔案的位置
function unzipIndex(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('不是有效的 .xlsx 檔')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const map = new Map<string, ZipEntry>()
  const dec = new TextDecoder()
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const size = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    const lNameLen = dv.getUint16(local + 26, true)
    const lExtraLen = dv.getUint16(local + 28, true)
    map.set(name, { method, offset: local + 30 + lNameLen + lExtraLen, size })
    p += 46 + nameLen + extraLen + commentLen
  }
  return map
}

async function inflate(buf: Uint8Array, f: ZipEntry): Promise<Uint8Array> {
  const data = buf.subarray(f.offset, f.offset + f.size)
  if (f.method === 0) return data
  if (f.method !== 8) throw new Error('不支援的壓縮方式')
  if (typeof DecompressionStream === 'undefined') throw new Error('這個瀏覽器不能讀 .xlsx，請在 Excel 另存成 CSV 再匯入')
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
