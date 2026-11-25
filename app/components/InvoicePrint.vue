<template>
  <!-- 網頁列印版：照 utils/invoicePrint.ts 的 dot 座標（÷8 = mm）絕對定位，模擬熱感印表機的字格 -->
  <div class="ip-root">
    <div v-for="(p, pi) in pages" :key="pi" class="ip-page" :style="{ height: mm(p.height + 6) }">
      <template v-for="(el, i) in p.els" :key="i">
        <div v-if="el.kind === 'text'" class="ip-text" :class="{ 'ip-bold': el.bold || pi === 0 }"
             :style="{ left: mm(el.x), top: mm(el.y - 24 * el.h) }">
          <span v-for="(c, ci) in cells(el.text)" :key="ci" class="ip-cell"
                :style="{ width: mm(12 * el.w * (c.wide ? 2 : 1)), height: mm(24 * el.h) }">
            <span class="ip-glyph" :style="{ transform: `translateX(-50%) scale(${el.w * (c.wide ? 1 : 0.86)}, ${el.h})` }">{{ c.ch }}</span>
          </span>
        </div>
        <img v-else-if="el.kind === 'barcode' && images[`${pi}-${i}`]" :src="images[`${pi}-${i}`]" class="ip-img" alt=""
             :style="{ left: mm(el.x), top: mm(el.y - el.height), width: mm(code39Width(el.data)), height: mm(el.height) }" />
        <img v-else-if="el.kind === 'qr' && images[`${pi}-${i}`]" :src="images[`${pi}-${i}`]" class="ip-img" alt=""
             :style="{ left: mm(el.x), top: mm(el.y), width: mm(qrSize(el.data) * el.module), height: mm(qrSize(el.data) * el.module) }" />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { code39Width, GAP_BETWEEN, type InvoiceLayout } from '~/utils/invoicePrint'

const props = defineProps<{ layout: InvoiceLayout }>()
const pages = computed(() => [props.layout.cert, props.layout.detail])
const images = ref<Record<string, string>>({})

const mm = (dots: number) => `${dots / 8}mm`
const cells = (s: string) => [...s].map(ch => ({ ch: ch === ' ' ? ' ' : ch, wide: ch.charCodeAt(0) >= 0x80 }))
const qrSize = (data: string) => QRCode.create(data, { errorCorrectionLevel: 'M' }).modules.size

async function render() {
  const out: Record<string, string> = {}
  for (const [pi, p] of pages.value.entries()) {
    for (const [i, el] of p.els.entries()) {
      if (el.kind === 'qr') {
        out[`${pi}-${i}`] = await QRCode.toDataURL(el.data, { errorCorrectionLevel: 'M', margin: 0, scale: 6 })
      } else if (el.kind === 'barcode') {
        const canvas = document.createElement('canvas')
        JsBarcode(canvas, el.data, { format: 'CODE39', displayValue: false, margin: 0, width: 2, height: 100 })
        out[`${pi}-${i}`] = canvas.toDataURL()
      }
    }
  }
  images.value = out
}
// 等圖片產生好再呼叫 window.print()
defineExpose({ ready: () => render() })
watch(() => props.layout, render, { immediate: true })
const gap = mm(GAP_BETWEEN)
</script>

<style>
  .ip-root { width: 52mm; color: #000; background: #fff; font-family: 'Noto Sans TC', 'Microsoft JhengHei', sans-serif; }
  .ip-page { position: relative; width: 52mm; overflow: hidden; }
  .ip-page + .ip-page { margin-top: v-bind(gap); }
  .ip-text { position: absolute; white-space: nowrap; line-height: 1; display: flex; }
  .ip-cell { position: relative; display: inline-block; flex: none; }
  .ip-glyph { position: absolute; left: 50%; bottom: 0; font-size: 3mm; line-height: 3mm; transform-origin: 50% 100%; }
  .ip-bold .ip-glyph { font-weight: 700; }
  .ip-img { position: absolute; image-rendering: pixelated; }
</style>
