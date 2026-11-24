import { THEME_STORAGE_KEY, applyThemeClass } from '~/composables/useTheme'

export default defineNuxtPlugin(() => {
  const isDark = useState<boolean>('pos-theme-dark', () => false)

  // 使用者沒手動選過時，跟著系統深淺色變化
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', (e) => {
    let saved: string | null = null
    try { saved = localStorage.getItem(THEME_STORAGE_KEY) } catch {}
    if (saved) return
    isDark.value = e.matches
    applyThemeClass(e.matches)
  })
})
