<template>
  <!-- 收銀頁：目前結帳人 + 換人。沒有任何員工設定 PIN 時整條不顯示。 -->
  <div v-if="required || cashier" class="px-4 py-2 border-b border-gray-200 flex items-center justify-between text-sm">
    <span v-if="cashier" class="text-gray-600">結帳人：<b class="text-gray-900">{{ cashier.name }}</b></span>
    <span v-else class="text-amber-600">尚未選擇結帳人</span>
    <div class="flex items-center gap-1">
      <button v-if="cashier" @click="logout" class="text-xs text-gray-400 hover:bg-gray-50 px-2 py-1 rounded">登出</button>
      <button @click="open" class="text-xs text-green-700 font-medium hover:bg-green-50 px-2 py-1 rounded">{{ cashier ? '換人' : '登入' }}</button>
    </div>
  </div>

  <!-- 換人視窗 -->
  <div v-if="pickerOpen" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="close">
    <div class="bg-white rounded-2xl p-6 shadow-2xl flex flex-col" :style="picked ? 'width:384px; max-width:95vw;' : 'width:960px; max-width:95vw; max-height:92vh;'">
      <h3 class="text-base font-bold text-gray-900 mb-4">{{ picked ? `${picked.name}，請輸入 PIN` : '誰要結帳？' }}</h3>

      <div v-if="!picked" class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 overflow-y-auto content-start" style="flex:1 1 auto; min-height:0;">
        <button v-for="e in candidates" :key="e.id" @click="pick(e)"
          class="py-3 px-2 rounded-xl border text-sm font-medium transition-colors"
          :class="cashier?.id === e.id ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'">
          {{ e.name }}<span class="block text-xs text-gray-400 font-mono font-normal">{{ e.id }}</span>
        </button>
        <p v-if="!candidates.length" class="col-span-full text-sm text-gray-400 py-6 text-center">還沒有員工設定 PIN（員工管理 → 編輯）</p>
      </div>

      <div v-else>
        <input ref="pinInput" v-model="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"
          class="w-full border border-gray-200 rounded-xl px-4 py-3 text-2xl tracking-[0.5em] text-center font-mono focus:outline-none focus:border-green-500"
          @keydown.enter="submit">
        <!-- 觸控螢幕用的數字鍵 -->
        <div class="grid grid-cols-3 gap-2 mt-3">
          <button v-for="k in keys" :key="k" @click="press(k)"
            class="py-3 rounded-xl border border-gray-200 text-lg font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100">{{ k }}</button>
        </div>
        <p v-if="error" class="text-sm text-red-600 mt-3 text-center">{{ error }}</p>
      </div>

      <div class="flex gap-2 mt-5">
        <button @click="picked ? back() : close()" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">{{ picked ? '換別人' : '取消' }}</button>
        <button v-if="picked" @click="submit" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">確定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Employee } from '~/composables/usePosStore'

const { cashier, pickerOpen, candidates, required, login, logout } = useCashier()

const picked = ref<Employee | null>(null)
const pin = ref('')
const error = ref('')
const pinInput = ref<HTMLInputElement | null>(null)
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清除', '0', '⌫']

function open() { pickerOpen.value = true }
function close() { pickerOpen.value = false }
watch(pickerOpen, v => { if (v) { picked.value = null; pin.value = ''; error.value = '' } })

function pick(e: Employee) {
  picked.value = e
  pin.value = ''
  error.value = ''
  nextTick(() => pinInput.value?.focus())
}
function back() { picked.value = null; pin.value = ''; error.value = '' }

function press(k: string) {
  error.value = ''
  if (k === '清除') pin.value = ''
  else if (k === '⌫') pin.value = pin.value.slice(0, -1)
  else if (pin.value.length < 6) pin.value += k
}

function submit() {
  if (!picked.value) return
  if (login(picked.value, pin.value)) { close(); return }
  error.value = 'PIN 不對，請再試一次'
  pin.value = ''
  pinInput.value?.focus()
}
</script>
