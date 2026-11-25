<template>
  <!-- 帳單網頁列印版（print-agent 連不到時用）：照 utils/billPrint.ts 的行資料，一行 30 個半形字格 -->
  <div class="bp-root">
    <div v-for="(l, i) in lines" :key="i" class="bp-line" :class="{ 'bp-big': l.big, 'bp-center': l.center }">
      <span v-for="(c, ci) in cells(l.text)" :key="ci" class="bp-cell" :class="{ 'bp-wide': c.wide }">{{ c.ch }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BillLine } from '~/utils/billPrint'

defineProps<{ lines: BillLine[] }>()
const cells = (s: string) => [...(s || ' ')].map(ch => ({ ch: ch === ' ' ? ' ' : ch, wide: ch.charCodeAt(0) >= 0x80 }))
</script>

<style>
/* 印字區 48mm、一行 30 格 → 一格 1.6mm（同 58mm 熱感紙帳單） */
.bp-root { width: 48mm; font-family: 'Noto Sans TC', 'Microsoft JhengHei', monospace; color: #000; }
.bp-line { display: flex; height: 3.75mm; line-height: 3.75mm; font-size: 2.9mm; white-space: pre; }
.bp-center { justify-content: center; }
.bp-cell { display: inline-block; width: 1.6mm; text-align: center; overflow: visible; }
.bp-wide { width: 3.2mm; }
.bp-big { height: 7.5mm; line-height: 7.5mm; font-size: 5.8mm; font-weight: 700; }
.bp-big .bp-cell { width: 3.2mm; }
.bp-big .bp-wide { width: 6.4mm; }
</style>
