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

    <!-- 選單（從左邊滑出、蓋在畫面上）；點遮罩或換頁就關。
         手機從上面標題列的 ☰ 打開；平板、電腦不顯示左側選單欄，從各頁頁首左邊的 ☰（NavMenuButton）打開 -->
    <div v-if="mobileNavOpen" class="fixed inset-0 z-50">
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

    <main class="flex-1 min-h-0 min-w-0 overflow-hidden">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
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

// 抽屜選單（左側選單欄已拿掉，手機、平板、電腦都用這個）：各頁頁首的 ☰（NavMenuButton）會打開它，換頁就收起來
const mobileNavOpen = useState('navDrawerOpen', () => false)
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
