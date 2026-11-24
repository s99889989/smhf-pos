<template>
  <button type="button" @click="toggleTheme"
    :title="label" :aria-label="label"
    class="shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
    :class="large ? 'w-9 h-9 rounded-xl border border-gray-200' : 'w-7 h-7 rounded-lg'">
    <!-- 深色時顯示太陽（按下回淺色），淺色時顯示月亮 -->
    <svg v-if="isDark" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
    <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{ large?: boolean }>()
const { isDark, toggleTheme, syncFromDom } = useTheme()
// 伺服器端不知道使用者選擇，掛載後再依 <html> 上的 class 同步圖示
onMounted(syncFromDom)
const label = computed(() => isDark.value ? '切換為淺色模式' : '切換為深色模式')
</script>
