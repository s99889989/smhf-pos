<template>
  <!-- app-shell：高度 100vh，支援的瀏覽器改用 100dvh（手機網址列收合時不會被切掉）；寫在 input.css -->
  <div class="app-shell flex flex-col md:flex-row bg-gray-50 overflow-hidden">

    <!-- 手機（寬 < 768px）：上方標題列 + 漢堡選單；平板、電腦維持左側選單 -->
    <header class="md:hidden shrink-0 h-12 bg-white border-b border-gray-200 flex items-center gap-1 px-1.5">
      <button @click="mobileNavOpen = true" aria-label="開啟選單"
        class="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 active:bg-gray-100">
        <svg width="20" height="20" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
          <line x1="2" y1="4" x2="12" y2="4"/>
          <line x1="2" y1="7" x2="12" y2="7"/>
          <line x1="2" y1="10" x2="12" y2="10"/>
        </svg>
      </button>
      <span class="text-lg leading-none">{{ currentItem?.icon || '🌿' }}</span>
      <span class="flex-1 min-w-0 truncate font-semibold text-gray-900 text-base ml-1">{{ currentItem?.label || '聖母健康農莊' }}</span>
      <span class="text-xs text-gray-400 tabular-nums mr-1">{{ shortTime }}</span>
    </header>

    <!-- 手機選單（從左邊滑出）；點遮罩或換頁就關 -->
    <div v-if="mobileNavOpen" class="md:hidden fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="mobileNavOpen = false"></div>
      <div class="absolute top-0 bottom-0 left-0 w-72 bg-white shadow-2xl flex flex-col" style="max-width:85vw">
        <div class="flex items-center border-b border-gray-200 h-12 px-3 gap-2 shrink-0">
          <span class="text-green-700 text-lg shrink-0">🌿</span>
          <div class="flex-1 min-w-0">
            <div class="text-green-700 font-bold text-sm leading-tight truncate">聖母健康農莊</div>
            <div class="text-gray-400 text-xs">POS 收銀系統</div>
          </div>
          <button @click="mobileNavOpen = false" aria-label="關閉選單"
            class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-gray-400 text-xl active:bg-gray-100">✕</button>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 pb-3">
          <template v-for="section in navSections" :key="section.label">
            <div class="text-xs text-gray-400 font-semibold tracking-wide px-1 mt-3">{{ section.label }}</div>
            <div class="grid grid-cols-3 gap-x-1 gap-y-3 pt-2 pb-1">
              <NuxtLink v-for="item in section.items" :key="item.to" :to="item.to"
                class="nav-tile flex flex-col items-center min-w-0 text-center"
                :class="isActive(item.to) ? 'nav-tile-active text-green-700' : 'text-gray-600'">
                <span class="nav-tile-icon flex items-center justify-center rounded-2xl bg-gray-100 leading-none w-14 h-14 text-2xl">{{ item.icon }}</span>
                <span class="mt-1.5 w-full text-xs font-medium leading-tight break-words">{{ item.label }}</span>
              </NuxtLink>
            </div>
          </template>
        </nav>
        <div class="py-2.5 px-3 border-t border-gray-200 flex items-center gap-2 shrink-0">
          <div class="text-xs text-gray-400 flex-1 min-w-0 truncate">{{ clock }}</div>
          <ThemeToggle />
        </div>
      </div>
    </div>

    <aside class="bg-white border-r border-gray-200 hidden md:flex flex-col shrink-0 transition-all duration-200" :class="sidebarCollapsed ? 'w-14' : 'w-56'">

      <!-- Logo -->
      <!-- 收合時：只留一個置中的按鈕，平常顯示葉子，滑過時換成選單圖示，點了展開 -->
      <div v-if="sidebarCollapsed" class="flex items-center justify-center border-b border-gray-200 h-14 shrink-0">
        <button @click="sidebarCollapsed = false" title="展開選單" aria-label="展開選單"
          class="group w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
          <span class="text-green-700 text-lg leading-none group-hover:hidden">🌿</span>
          <svg class="hidden group-hover:block" width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <line x1="2" y1="4" x2="12" y2="4"/>
            <line x1="2" y1="7" x2="12" y2="7"/>
            <line x1="2" y1="10" x2="12" y2="10"/>
          </svg>
        </button>
      </div>
      <div v-else class="flex items-center border-b border-gray-200 h-14 px-3 gap-2 overflow-hidden shrink-0">
        <span class="text-green-700 text-lg shrink-0">🌿</span>
        <div class="flex-1 min-w-0">
          <div class="text-green-700 font-bold text-sm leading-tight truncate">聖母健康農莊</div>
          <div class="text-gray-400 text-xs">POS 收銀系統</div>
        </div>
        <button @click="sidebarCollapsed = true" title="收合選單" aria-label="收合選單"
          class="shrink-0 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <line x1="2" y1="4" x2="12" y2="4"/>
            <line x1="2" y1="7" x2="12" y2="7"/>
            <line x1="2" y1="10" x2="12" y2="10"/>
          </svg>
        </button>
      </div>

      <!-- Nav：參考農莊系統的圖示格狀導覽（emoji 放在圓角方塊裡、下方文字） -->
      <!-- overflow-x-hidden：避免出現橫向捲軸；收合時的名稱提示改用下面的 fixed 浮層 -->
      <!-- 不用 aspect-ratio / container query：XP 的 Mypal（FF68）不支援，方塊改用固定寬高 -->
      <nav class="flex-1 py-2 overflow-y-auto overflow-x-hidden"
        :class="sidebarCollapsed ? 'px-1.5' : 'px-3'"
        @mousemove="onNavHover" @mouseleave="hideTip" @scroll="hideTip">
        <template v-for="(section, si) in navSections" :key="section.label">

          <!-- sidebar 收合：分隔線 -->
          <div v-if="sidebarCollapsed" class="border-t border-gray-100 my-2" :class="si === 0 ? 'hidden' : ''"></div>

          <!-- 群組標題 -->
          <button v-else @click="toggleSection(section.label)"
            class="w-full flex items-center justify-between px-1 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
            :class="si === 0 ? 'mt-0.5' : 'mt-3'">
            <span class="text-xs text-gray-400 font-semibold tracking-wide">{{ section.label }}</span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="text-gray-300 group-hover:text-gray-400 transition-transform duration-150 shrink-0"
              :class="collapsedSections.has(section.label) ? '-rotate-90' : ''">
              <polyline points="1.5,3.5 5.5,7.5 9.5,3.5"/>
            </svg>
          </button>

          <!-- 群組內容：展開時 3 欄圖示格，收合時一排一個 -->
          <div v-if="sidebarCollapsed || !collapsedSections.has(section.label)"
            :class="sidebarCollapsed ? 'flex flex-col items-center gap-1.5' : 'grid grid-cols-3 gap-x-1 gap-y-3 pt-2 pb-1'">
            <NuxtLink v-for="item in section.items" :key="item.to" :to="item.to"
              class="nav-tile flex flex-col items-center min-w-0 text-center"
              :class="isActive(item.to) ? 'nav-tile-active text-green-700' : 'text-gray-600'">
              <span class="nav-tile-icon flex items-center justify-center rounded-2xl bg-gray-100 leading-none"
                :class="sidebarCollapsed ? 'w-10 h-10 text-xl' : 'w-12 h-12 text-2xl'"
                :data-tip="item.label">{{ item.icon }}</span>
              <span v-if="!sidebarCollapsed" class="mt-1.5 w-full text-xs font-medium leading-tight break-words">{{ item.label }}</span>
            </NuxtLink>
          </div>

        </template>
      </nav>

      <!-- Clock + 深淺模式切換 -->
      <div class="py-2.5 border-t border-gray-200 overflow-hidden flex items-center gap-2"
        :class="sidebarCollapsed ? 'flex-col px-1' : 'px-3'">
        <div v-if="!sidebarCollapsed" class="text-xs text-gray-400 flex-1 min-w-0 truncate">{{ clock }}</div>
        <!-- 收合時只放得下時:分，完整日期時間放在 title（滑過顯示） -->
        <div v-else class="text-xs font-medium text-gray-500 text-center tabular-nums leading-none" :title="clock">{{ shortTime }}</div>
        <ThemeToggle />
      </div>
    </aside>

    <!-- 收合時滑過圖示顯示名稱（跟著滑鼠）：fixed 定位，不會被選單區的 overflow 切掉，也不會撐出捲軸 -->
    <div v-if="sidebarCollapsed && tip"
      class="fixed z-50 px-3 py-1.5 bg-gray-800 text-white text-sm font-medium rounded-lg whitespace-nowrap pointer-events-none shadow-lg -translate-y-full"
      :style="{ top: tip.y + 'px', left: tip.x + 'px' }">
      {{ tip.label }}
    </div>

    <main class="flex-1 min-h-0 min-w-0 overflow-hidden">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
// 側欄收合、群組收合狀態存在 cookie，重新整理或下次開啟都會保留
// （用 cookie 而非 localStorage：伺服器端渲染時就讀得到，畫面不會先展開再縮回去）
const cookieOpts = { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' as const }
const sidebarCollapsed = useCookie<boolean>('pos-sidebar-collapsed', { ...cookieOpts, default: () => false })
const collapsedSectionList = useCookie<string[]>('pos-sidebar-sections', { ...cookieOpts, default: () => [] })
const collapsedSections = computed(() => new Set(collapsedSectionList.value))

function toggleSection(label: string) {
  const s = new Set(collapsedSectionList.value)
  s.has(label) ? s.delete(label) : s.add(label)
  collapsedSectionList.value = [...s]
}

const navSections = [
  {
    label: '收銀',
    items: [
      { to: '/',             icon: '🏷️', label: '收銀點餐' },
      { to: '/internal-use', icon: '📋', label: '內部領用' },
      { to: '/shop-orders', icon: '🛒', label: '線上訂單' },
    ],
  },
  {
    label: '品項管理',
    items: [
      { to: '/products',  icon: '📦', label: '品項管理' },
      { to: '/materials', icon: '🌾', label: '物料庫存' },
    ],
  },
  {
    label: '人員管理',
    items: [
      { to: '/staff',     icon: '👤', label: '員工管理' },
      { to: '/vip',       icon: '⭐', label: 'VIP 管理' },
    ],
  },
  {
    label: '報表',
    items: [
      { to: '/reports',     icon: '📊', label: '營業報表' },
      { to: '/transactions', icon: '🧾', label: '帳單瀏覽' },
      { to: '/invoices',    icon: '🧧', label: '電子發票' },
    ],
  },
  {
    label: '系統',
    items: [
      { to: '/settings',    icon: '⚙️', label: '系統設定' },
      { to: '/connections', icon: '📡', label: '連線狀況' },
    ],
  },
]

// 收合時的名稱提示：在 <nav> 上統一監聽，找出滑鼠所在的連結，讀它圖示上的 data-tip
const tip = ref<{ label: string; x: number; y: number } | null>(null)
function onNavHover(e: MouseEvent) {
  if (!sidebarCollapsed.value) return
  const link = (e.target as HTMLElement).closest('a')
  const label = link?.querySelector<HTMLElement>('[data-tip]')?.dataset.tip
  if (!link || !label) { tip.value = null; return }
  // 跟著滑鼠：顯示在游標右上方（浮層用 -translate-y-full 往上移，底邊對齊 y）
  tip.value = { label, x: e.clientX + 22, y: e.clientY - 8 }
}
function hideTip() { tip.value = null }
watch(sidebarCollapsed, hideTip)
watch(() => route.path, hideTip)

// 手機選單：換頁就收起來
const mobileNavOpen = ref(false)
watch(() => route.path, () => { mobileNavOpen.value = false })
const currentItem = computed(() => navSections.flatMap(s => s.items).find(i => isActive(i.to)))

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

const clock = ref('')
const shortTime = ref('')
function updateClock() {
  const now = new Date()
  shortTime.value = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  clock.value = now.toLocaleDateString('zh-TW') + ' ' +
    now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}
onMounted(() => { updateClock(); setInterval(updateClock, 1000) })
// 小螢幕（不到 1280 寬，例如 1024 的 XP 收銀機）：側欄預設收起，讓收銀畫面寬一點。只自動收一次，之後照使用者自己按的
onMounted(() => {
  try {
    if (localStorage.getItem('pos-sidebar-auto')) return
    localStorage.setItem('pos-sidebar-auto', '1')
  } catch { return }
  if (window.innerWidth < 1280) sidebarCollapsed.value = true
})
</script>

<style scoped>
/* 圖示方塊：滑過加淡框、目前頁面加綠框（用 inset box-shadow，FF68 的 outline 不會跟著圓角） */
.nav-tile-icon {
  transition: box-shadow 0.15s, background-color 0.15s;
}
.nav-tile:hover .nav-tile-icon {
  box-shadow: inset 0 0 0 2px var(--color-green-300);
}
.nav-tile-active .nav-tile-icon {
  background-color: var(--color-green-50);
  box-shadow: inset 0 0 0 2px var(--color-green-600);
}
.nav-tile:active .nav-tile-icon {
  opacity: 0.7;
}
</style>
