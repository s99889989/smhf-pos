// 發票期別（民國年 + 雙月）。台灣時間計算，不受伺服器時區影響。

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 取台灣時間（UTC+8）的年月日時分秒 */
export function twParts(d: Date = new Date()) {
  const t = new Date(d.getTime() + 8 * 3600_000)
  return {
    y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    hh: t.getUTCHours(), mm: t.getUTCMinutes(), ss: t.getUTCSeconds(),
  }
}

export interface Term {
  rocYear: number   // 例 115
  startMonth: number // 1,3,5,7,9,11
  /** Cetustek ApplyInvoiceNumber 的 month 參數、舊系統的期別寫法，例 "05-06" */
  label: string
}

export function termOf(d: Date = new Date()): Term {
  const p = twParts(d)
  const start = p.m % 2 === 1 ? p.m : p.m - 1
  return { rocYear: p.y - 1911, startMonth: start, label: `${pad2(start)}-${pad2(start + 1)}` }
}

export function nextTerm(t: Term): Term {
  const start = t.startMonth === 11 ? 1 : t.startMonth + 2
  const rocYear = t.startMonth === 11 ? t.rocYear + 1 : t.rocYear
  return { rocYear, startMonth: start, label: `${pad2(start)}-${pad2(start + 1)}` }
}

export const termKey = (t: Term) => `${t.rocYear}-${t.label}` // 例 115-05-06

/** 上傳 XML 用：yyyy/MM/dd 與 HH:mm:ss（台灣時間） */
export function xmlDateTime(d: Date) {
  const p = twParts(d)
  return { date: `${p.y}/${pad2(p.m)}/${pad2(p.d)}`, time: `${pad2(p.hh)}:${pad2(p.mm)}:${pad2(p.ss)}` }
}
