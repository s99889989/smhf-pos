<template>
  <img v-if="src" :src="src" :alt="alt" loading="lazy" decoding="async" @error="$emit('error')">
</template>

<script setup lang="ts">
// 品項圖片：區網時直接載本機 print-agent 的網址；經家裡 Hub 時用 hubFetch 拿回來轉 blob: 網址
import { catalogImageSrc } from '~/utils/catalogApi'

const props = withDefaults(defineProps<{ file?: string; alt?: string; thumb?: boolean }>(), { file: '', alt: '', thumb: true })
const emit = defineEmits<{ error: [] }>()
const src = ref('')

watch(() => [props.file, props.thumb] as const, async ([file, thumb]) => {
  src.value = ''
  if (!file) return
  try { src.value = await catalogImageSrc(file, thumb) } catch { emit('error') }
}, { immediate: true })
</script>
