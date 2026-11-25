// composables/useGuidedCheckout.ts
// 引導式結帳（像點餐機一步一步：確認明細 → 發票載具 → 付款 → 最後確認）開關。
// 每台機器自己記（localStorage pos-guided-checkout），在「系統設定」切換；關閉時收銀頁維持原本樣子。

const KEY = 'pos-guided-checkout'

export function useGuidedCheckout() {
  return useState<boolean>('posGuidedCheckout', () => false)
}

// 頁面在 onMounted 呼叫（不在 setup 讀，避免和伺服器端渲染的畫面不一致）
export function loadGuidedCheckout() {
  let v = false
  try { v = localStorage.getItem(KEY) === '1' } catch { /* 存不了就當關閉 */ }
  useGuidedCheckout().value = v
}

export function writeGuidedCheckout(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch { /* 無痕模式等存不了就算了 */ }
  useGuidedCheckout().value = v
}
