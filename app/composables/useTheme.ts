/**
 * 深淺模式切換
 * - 使用者選擇存在 localStorage（key: pos-theme），值為 'light' | 'dark'
 * - 沒選過就跟隨作業系統設定
 * - 頁面載入前由 nuxt.config.ts 的 inline script 先套用，避免閃白
 */
export const THEME_STORAGE_KEY = 'pos-theme'

export function applyThemeClass(dark: boolean) {
  const el = document.documentElement
  el.classList.toggle('dark', dark)
  el.style.colorScheme = dark ? 'dark' : 'light'
}

export function useTheme() {
  const isDark = useState<boolean>('pos-theme-dark', () => false)

  function setDark(dark: boolean) {
    isDark.value = dark
    if (import.meta.client) {
      applyThemeClass(dark)
      try { localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light') } catch {}
    }
  }

  function toggleTheme() {
    setDark(!isDark.value)
  }

  function syncFromDom() {
    if (import.meta.client) isDark.value = document.documentElement.classList.contains('dark')
  }

  return { isDark: readonly(isDark), setDark, toggleTheme, syncFromDom }
}
