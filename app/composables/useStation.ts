// composables/useStation.ts
// 本機收銀站：每台機器自己記（localStorage pos-station），設了就鎖定收銀台只賣該站商品。
// 站別清單（1 號餐廳、2 號小舖、行動平板…）存在資料機，可在系統設定新增、改名（usePosStore().stations）。
// 資料機等不收銀的機器留空 = 各站都能切換。

export type Station = string

const KEY = 'pos-station'

export function readStation(): Station {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function writeStation(v: Station) {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch { /* 無痕模式等存不了就算了 */ }
  useStation().value = v
}

// 跨頁共用的目前本機站。頁面在 onMounted 呼叫 loadStation() 從 localStorage 讀
// （不在 setup 讀，避免和伺服器端渲染的畫面不一致）
export function useStation() {
  return useState<Station>('posStation', () => '')
}

export function loadStation() {
  useStation().value = readStation()
}
