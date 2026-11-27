<template>
  <!-- 頁首左邊的 ☰：平板、電腦不顯示左側選單欄，點這個從左邊滑出覆蓋式選單（layouts/default.vue）。
       手機上面已經有標題列的 ☰，這裡不顯示 -->
  <button type="button" @click="open = true" title="選單" aria-label="開啟選單"
          class="hidden md:inline-flex shrink-0 w-8 h-8 rounded-lg border border-gray-300 items-center justify-center text-gray-500 hover:bg-gray-50 align-middle">
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
      <line x1="2" y1="4" x2="12" y2="4"/>
      <line x1="2" y1="7" x2="12" y2="7"/>
      <line x1="2" y1="10" x2="12" y2="10"/>
    </svg>
  </button>
</template>

<script setup lang="ts">
const open = useState('navDrawerOpen', () => false)
</script>
