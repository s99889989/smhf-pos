<template>
  <div class="flex h-screen bg-gray-50 overflow-hidden">
    <aside class="bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-200" :class="sidebarCollapsed ? 'w-14' : 'w-56'">

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

      <!-- Nav -->
      <!-- overflow-x-hidden：避免出現橫向捲軸；收合時的名稱提示改用下面的 fixed 浮層 -->
      <nav class="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5"
        @mousemove="onNavHover" @mouseleave="hideTip" @scroll="hideTip">
        <template v-for="section in navSections" :key="section.label">

          <!-- sidebar 收合：分隔線 -->
          <div v-if="sidebarCollapsed" class="border-t border-gray-100 my-1.5"></div>

          <!-- 群組標題 -->
          <button v-else @click="toggleSection(section.label)"
            class="w-full flex items-center justify-between px-2 py-1 mt-2 rounded-lg hover:bg-gray-50 transition-colors group first:mt-0.5">
            <span class="text-xs text-gray-400 font-semibold tracking-wide">{{ section.label }}</span>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              class="text-gray-300 group-hover:text-gray-400 transition-transform duration-150 shrink-0"
              :class="collapsedSections.has(section.label) ? '-rotate-90' : ''">
              <polyline points="1.5,3.5 5.5,7.5 9.5,3.5"/>
            </svg>
          </button>

          <!-- 群組內容 -->
          <template v-if="sidebarCollapsed || !collapsedSections.has(section.label)">
            <template v-for="item in section.items" :key="item.to ?? item.subLabel">

              <!-- 一般連結 -->
              <NuxtLink v-if="!item.children" :to="item.to"
                class="flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors group relative"
                :class="[
                  isActive(item.to) ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100',
                  sidebarCollapsed ? 'px-2.5 py-2 justify-center' : 'pl-7 pr-2.5 py-1.5',
                ]">
                <span class="text-sm shrink-0" :data-tip="item.label">{{ item.icon }}</span>
                <span v-if="!sidebarCollapsed" class="truncate text-sm">{{ item.label }}</span>
              </NuxtLink>

              <!-- 子群組 -->
              <template v-else>
                <!-- 子群組標題 -->
                <button v-if="!sidebarCollapsed"
                  @click="toggleSection(item.subLabel)"
                  class="w-full flex items-center justify-between pl-7 pr-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div class="flex items-center gap-2.5">
                    <span class="text-sm shrink-0">{{ item.icon }}</span>
                    <span class="text-sm font-medium text-gray-600">{{ item.subLabel }}</span>
                  </div>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="text-gray-300 group-hover:text-gray-400 transition-transform duration-150 shrink-0"
                    :class="collapsedSections.has(item.subLabel) ? '-rotate-90' : ''">
                    <polyline points="1.5,3 5,6.5 8.5,3"/>
                  </svg>
                </button>

                <!-- 子群組項目 -->
                <template v-if="sidebarCollapsed || !collapsedSections.has(item.subLabel)">
                  <NuxtLink v-for="child in item.children" :key="child.to" :to="child.to"
                    class="flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors group relative"
                    :class="[
                      isActive(child.to) ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100',
                      sidebarCollapsed ? 'px-2.5 py-2 justify-center' : 'pl-12 pr-2.5 py-1.5',
                    ]">
                    <span class="text-xs shrink-0" :data-tip="child.label">{{ child.icon }}</span>
                    <span v-if="!sidebarCollapsed" class="truncate text-xs">{{ child.label }}</span>
                  </NuxtLink>
                </template>
              </template>

            </template>
          </template>

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

    <main class="flex-1 overflow-hidden">
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
    ],
  },
  {
    label: '管理',
    items: [
      { to: '/products',  icon: '📦', label: '品項管理' },
      { to: '/materials', icon: '🌾', label: '物料庫存' },
      {
        subLabel: '帳號',
        icon: '👥',
        children: [
          { to: '/accounts', icon: '🔑', label: '帳號管理' },
          { to: '/staff',    icon: '👤', label: '員工管理' },
          { to: '/vip',      icon: '⭐', label: 'VIP 管理' },
        ],
      },
    ],
  },
  {
    label: '報表與設定',
    items: [
      { to: '/reports',     icon: '📊', label: '營業報表' },
      { to: '/shop-orders', icon: '🛒', label: '線上訂單' },
      { to: '/settings',    icon: '⚙️', label: '系統設定' },
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
