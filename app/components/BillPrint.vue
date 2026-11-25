<template>
  <!-- 帳單網頁列印版（print-agent 連不到時用）：照 utils/billPrint.ts 的 mm 座標與字級，和 print-agent 畫出來的一樣 -->
  <div class="bp-root" :style="{ width: `${BILL_WIDTH}mm` }">
    <div v-for="(l, i) in lines" :key="i" class="bp-line" :style="{ height: `${lineHeightMm(l)}mm` }">
      <div v-if="l.kind === 'rule'" class="bp-rule" />
      <template v-else-if="l.kind === 'text'">
        <span v-for="(c, ci) in l.cells" :key="ci" class="bp-cell"
              :style="cellStyle(c, l.size, !!l.bold)">{{ c.text }}</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { BILL_WIDTH, lineHeightMm, type BillCell, type BillLine } from '~/utils/billPrint'

defineProps<{ lines: BillLine[] }>()

function cellStyle(c: BillCell, size: number, bold: boolean) {
  const s: Record<string, string> = { fontSize: `${size}pt`, fontWeight: bold ? '700' : '400' }
  if (c.align === 'right') { s.right = `${BILL_WIDTH - c.x}mm` }
  else if (c.align === 'center') { s.left = `${c.x}mm`; s.transform = 'translateX(-50%)' }
  else s.left = `${c.x}mm`
  return s
}
</script>

<style>
.bp-root { font-family: '細明體', 'MingLiU', 'PMingLiU', 'Noto Serif TC', serif; color: #000; }
.bp-line { position: relative; }
.bp-cell { position: absolute; top: 0; white-space: pre; line-height: 1; }
.bp-rule { position: absolute; left: 0; right: 0; top: 50%; border-top: 0.2mm solid #000; }
</style>
