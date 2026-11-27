<template>
  <div class="flex h-full" @contextmenu="blockMenu">

    <!-- 品項區（手機：和訂單區二選一切換，見 mobileView） -->
    <div class="flex-col flex-1 min-w-0 overflow-hidden" :class="mobileView === 'cart' ? 'hidden md:flex' : 'flex'">

      <!-- 分類 -->
      <!-- 分類：圓角方塊，上面淡色底圖示（分類 emoji，沒設就放第一個字），下面名稱；選中的綠框綠底 -->
      <div class="bg-white border-b border-gray-200 px-3 md:px-5 py-2.5 flex gap-2 overflow-x-auto shrink-0">
        <button
                v-for="(c, ci) in categories" :key="c"
                @click="pickCat(c)"
                class="shrink-0 w-[4.5rem] md:w-24 flex flex-col items-center gap-1 px-1 pt-2 pb-1.5 rounded-xl border transition-colors"
                :class="activeCat === c
            ? 'bg-green-50 border-green-600 ring-1 ring-green-600'
            : 'bg-white border-gray-200 hover:bg-gray-50'"
        >
          <span class="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center text-xl md:text-2xl leading-none font-bold"
                :class="CAT_TINTS[ci % CAT_TINTS.length]">{{ catEmoji(c) || c.slice(0, 1) }}</span>
          <span class="w-full text-xs md:text-sm text-center truncate leading-tight"
                :class="activeCat === c ? 'text-green-800 font-semibold' : 'text-gray-700'">{{ c }}</span>
        </button>
      </div>

      <!-- 品項卡片 -->
      <div class="flex-1 overflow-y-auto p-3 md:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2 md:gap-2.5 content-start">
        <button
                v-for="prod in filteredProducts" :key="prod.id"
                @click="addItem(prod)"
                @pointerdown="lastPointer = $event.pointerType"
                @contextmenu.prevent="removeOne(prod)"
                @wheel="wheelCard($event, prod)"
                class="relative flex flex-col justify-start text-left bg-white border rounded-xl p-2.5 md:p-3 active:scale-95 transition-all"
                :class="prod.cashOnly && curPay !== 'cash'
            ? 'border-amber-300 bg-amber-50/50 hover:border-amber-400'
            : 'border-gray-200 hover:border-green-500 hover:bg-green-50'"
        >
          <span v-if="cartQty(prod.id)" class="absolute top-2 right-2 z-10 bg-green-700 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {{ cartQty(prod.id) }}
          </span>
          <!-- 圖片區：每張卡片都有，大小一致（4:3）。有圖放圖（資料機縮圖），沒圖或載不到就放 emoji，再沒有就放品名第一個字。
               用 padding-top 撐出 4:3，XP 的 Mypal 不支援 aspect-ratio -->
          <div class="-mx-2.5 -mt-2.5 md:-mx-3 md:-mt-3 mb-2 relative overflow-hidden rounded-t-xl bg-gray-100" style="padding-top:75%">
            <CatalogImg v-if="prod.image && !imgErrors.has(prod.image)" :file="prod.image" :alt="prod.name"
                        class="absolute inset-0 w-full h-full object-cover" @error="imgErrors.add(prod.image!)" />
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <span v-if="prod.emoji" class="text-5xl leading-none">{{ prod.emoji }}</span>
              <span v-else class="text-4xl font-bold text-gray-300 leading-none">{{ prod.name.slice(0, 1) }}</span>
            </div>
          </div>
          <div class="text-sm font-medium text-gray-900 leading-snug mb-1.5">{{ prod.name }}</div>
          <div v-if="prod.openPrice" class="text-base font-bold text-orange-600">✏️ 時價</div>
          <div v-else class="flex items-baseline gap-1.5">
            <div class="text-base font-bold text-green-700">${{ discountedPrice(prod.price) }}</div>
            <div v-if="curDiscount && curDiscount.rate < 1" class="text-xs text-gray-400 line-through">${{ prod.price }}</div>
          </div>
          <div v-if="prod.note" class="text-xs text-gray-400 mt-0.5">{{ prod.note }}</div>
          <div v-if="prod.cashOnly" class="text-xs text-amber-600 mt-1 font-medium">💵 限現金</div>
        </button>
        <div v-if="!filteredProducts.length" class="col-span-full flex items-center justify-center py-20 text-gray-400 text-sm">
          此地點沒有此分類的品項
        </div>
      </div>

      <!-- 手機底部列：件數、合計，點了切到訂單區結帳 -->
      <div class="md:hidden shrink-0 bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="text-xs text-gray-400">{{ cart.length ? `共 ${cartCount} 件` : '尚未選擇品項' }}</div>
          <div class="text-xl font-bold text-gray-900 leading-tight">${{ total }}</div>
        </div>
        <button @click="mobileView = 'cart'"
                class="shrink-0 px-5 py-3 rounded-xl font-bold text-base transition-colors"
                :class="cart.length ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-500'"
        >{{ guided ? '訂單 ▶' : '訂單／結帳 ▶' }}</button>
      </div>
    </div>

    <!-- 訂單區 -->
    <!-- 手機：佔滿整個寬度，內容太高時整欄捲動；平板、電腦：右側固定寬度 -->
    <div class="w-full md:w-80 lg:w-96 md:border-l border-gray-200 bg-white flex-col shrink-0 overflow-y-auto md:overflow-hidden"
         :class="mobileView === 'cart' ? 'flex' : 'hidden md:flex'">

      <div class="px-3 md:px-4 py-2.5 md:py-3.5 border-b border-gray-200 flex justify-between items-center shrink-0">
        <button @click="mobileView = 'products'" class="md:hidden whitespace-nowrap text-sm font-medium text-green-700 px-2 py-1.5 -ml-1 rounded-lg active:bg-green-50">◀ 選商品</button>
        <span class="hidden md:inline font-semibold text-gray-900 whitespace-nowrap">訂單明細</span>
        <div class="flex items-center gap-1">
          <button @click="testPrint" class="whitespace-nowrap text-xs text-blue-500 hover:bg-blue-50 px-2 py-1 rounded transition-colors">🖨 測試列印</button>
          <button @click="printCartBill" :disabled="!cart.length" class="whitespace-nowrap text-xs text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed">🧾 帳單</button>
          <button @click="clearCart" class="whitespace-nowrap text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">✕ 清空</button>
        </div>
      </div>

      <!-- 結帳人（換人） -->
      <CashierBar />

      <!-- 引導式結帳：第 1 步提示 -->
      <div v-if="guided" class="px-4 py-2.5 border-b border-gray-100 bg-green-50">
        <div class="text-xs text-green-700 font-semibold">引導式結帳　步驟 1 / {{ guidedSteps.length }}：選商品</div>
        <div class="text-xs text-gray-500 mt-0.5">點左邊商品加入，選好後按下方「下一步」</div>
      </div>

      <!-- 折扣選擇（動態從設定讀取）；引導模式在第 2 步選 -->
      <div v-if="!guided" class="px-3 pt-3 pb-2 border-b border-gray-100">
        <div class="text-xs text-gray-400 mb-1.5">折扣類型</div>
        <div class="flex flex-wrap gap-1.5">
          <button
                  v-for="d in enabledDiscounts" :key="d.id"
                  @click="setDiscount(d)"
                  class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
                  :class="curDiscount?.id === d.id
              ? 'bg-purple-50 text-purple-700 border-purple-400'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'"
          >
            {{ d.label }}
            <span v-if="d.rate < 1" class="ml-1 opacity-70">{{ rateLabel(d.rate) }}</span>
          </button>
        </div>
      </div>

      <!-- 訂單列表 -->
      <div class="flex-1 overflow-y-auto px-3 py-2" style="min-height:7rem">
        <div v-if="!cart.length" class="h-full flex flex-col items-center justify-center gap-2 text-gray-300">
          <span class="text-4xl">🛒</span>
          <span class="text-sm">尚未選擇品項</span>
        </div>
        <div v-for="(item, i) in cart" :key="item.productId + '@' + item.price" class="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-gray-900 font-medium truncate">{{ item.name }}</div>
            <div class="flex items-baseline gap-1 text-xs text-gray-400">
              <span v-if="curDiscount && curDiscount.rate < 1" class="line-through">${{ item.price }}</span>
              <span class="text-green-600 font-medium">${{ item.finalPrice }}</span>
              <button v-if="item.openPrice" @click="editItemPrice(i)" class="ml-1 text-orange-600 hover:underline py-1">改價</button>
            </div>
          </div>
          <div class="flex items-center gap-1 rounded-full hover:bg-gray-50 px-0.5" title="滑鼠滾輪：往上加、往下減" @wheel.prevent="wheelQty($event, i)">
            <button @click="changeQty(i, -1)" class="w-8 h-8 md:w-6 md:h-6 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-100 text-sm leading-none">−</button>
            <span class="w-6 text-center text-sm font-semibold">{{ item.qty }}</span>
            <button @click="changeQty(i, 1)"  class="w-8 h-8 md:w-6 md:h-6 rounded-full border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-100 text-sm leading-none">+</button>
          </div>
          <div class="text-sm font-medium text-gray-900 w-14 text-right">${{ item.finalPrice * item.qty }}</div>
        </div>
      </div>

      <!-- 結帳區 -->
      <div class="border-t border-gray-200 p-4 shrink-0">
        <div v-if="curDiscount && curDiscount.rate < 1" class="space-y-1 mb-2">
          <div class="flex justify-between text-xs text-gray-400">
            <span>小計</span><span>${{ subtotal }}</span>
          </div>
          <div class="flex justify-between text-xs text-purple-600 font-medium">
            <span>{{ curDiscount.label }} {{ rateLabel(curDiscount.rate) }}</span>
            <span>- ${{ subtotal - total }}</span>
          </div>
        </div>
        <div class="flex justify-between items-baseline mb-4">
          <span class="text-sm text-gray-500">合計金額</span>
          <span class="text-2xl font-bold text-gray-900">${{ total }}</span>
        </div>

        <!-- 引導模式：付款在第 4 步 -->
        <template v-if="!guided">
        <!-- 付款方式 -->
        <div class="grid grid-cols-4 gap-1.5 mb-2">
          <button
                  v-for="p in payMethods" :key="p.value"
                  @click="setPay(p.value)"
                  :disabled="hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher'"
                  class="py-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-0.5 transition-colors"
                  :class="[
              curPay === p.value ? 'bg-green-50 text-green-700 border-green-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50',
              hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher' ? 'opacity-40 cursor-not-allowed' : ''
            ]"
          >
            <span class="text-base">{{ p.icon }}</span>{{ p.label }}
          </button>
        </div>

        <!-- 消費券金額輸入 -->
        <div v-if="curPay === 'voucher'" class="mb-2 bg-amber-50 rounded-xl p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-amber-700 font-medium whitespace-nowrap">🎟 消費券</span>
            <input v-model.number="voucherAmount" type="number" min="0"
                   style="flex:1; min-width:0; border:1px solid #f59e0b; border-radius:8px; padding:5px 10px; font-size:14px; font-weight:600; outline:none; background:#fff; color:#92400e; text-align:right;"
                   placeholder="0">
            <span class="text-xs text-amber-700">元</span>
          </div>
          <!-- 消費券超過總價警示 -->
          <div v-if="voucherExceeds" class="text-xs text-red-600 font-medium flex items-center gap-1">
            ⚠️ 消費券面額 ${{ voucherAmount }} 超過應付 ${{ total }}，請調整
          </div>
          <!-- 需補差額提示 -->
          <div v-else-if="voucherAmount > 0 && cashNeeded > 0" class="border-t border-amber-200 pt-2 flex justify-between text-xs text-amber-700">
            <span>需補差額（現金）</span>
            <span class="font-bold">${{ cashNeeded }}</span>
          </div>
          <div v-else-if="voucherAmount > 0 && cashNeeded === 0" class="border-t border-amber-200 pt-2 text-xs text-green-700 font-medium">
            ✓ 消費券足額支付
          </div>
        </div>

        <!-- 現金找零（現金，或消費券需補差額時） -->
        <div v-if="showCashInput" class="mb-2 bg-gray-50 rounded-xl p-3 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-600 font-medium whitespace-nowrap">💵 收到現金</span>
            <input v-model.number="receivedCash" type="number" min="0"
                   style="flex:1; min-width:0; border:1px solid #d1d5db; border-radius:8px; padding:5px 10px; font-size:14px; font-weight:600; outline:none; background:#fff; color:#111; text-align:right;"
                   placeholder="0">
            <span class="text-xs text-gray-500">元</span>
          </div>
          <!-- 快速金額 -->
          <div class="flex gap-1.5 flex-wrap">
            <button v-for="q in quickCash" :key="q"
                    @click="receivedCash = q"
                    class="text-xs px-2.5 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-600 transition-colors">
              ${{ q }}
            </button>
          </div>
          <!-- 找零 -->
          <div v-if="receivedCash > 0" class="flex justify-between items-center pt-1 border-t border-gray-200">
            <span class="text-sm font-medium text-gray-600">找零</span>
            <span class="text-xl font-bold" :class="change >= 0 ? 'text-green-700' : 'text-red-500'">
              {{ change >= 0 ? '$' + change : '不足 $' + Math.abs(change) }}
            </span>
          </div>
        </div>

        </template>

        <div v-if="hasCashOnlyItem" class="text-xs text-amber-600 mb-2 text-center">⚠️ 訂單含限現金品項</div>

        <button v-if="guided"
                @click="startGuided"
                :disabled="!cart.length"
                class="w-full py-3 rounded-xl font-bold text-base transition-colors"
                :class="cart.length ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
        >下一步：確認明細 ▶</button>
        <button v-else
                @click="startCheckout"
                :disabled="!cart.length || voucherExceeds"
                class="w-full py-3 rounded-xl font-bold text-base transition-colors"
                :class="cart.length && !voucherExceeds ? 'bg-green-700 hover:bg-green-800 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'"
        >結帳</button>
      </div>
    </div>

    <!-- 引導式結帳（系統設定可開關）：一步一步確認，每步都對了才能按下一步 -->
    <div v-if="guidedOpen" class="fixed inset-0 bg-gray-100 z-40 flex flex-col">

      <!-- 步驟列 -->
      <div class="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2 overflow-x-auto shrink-0">
        <template v-for="(label, i) in guidedSteps" :key="label">
          <div class="flex items-center gap-1.5 whitespace-nowrap">
            <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border"
                  :class="i + 1 < guidedStep ? 'bg-green-700 text-white border-green-700'
                        : i + 1 === guidedStep ? 'bg-white text-green-700 border-green-600'
                        : 'bg-white text-gray-400 border-gray-200'">
              {{ i + 1 < guidedStep ? '✓' : i + 1 }}
            </span>
            <span class="text-sm" :class="i + 1 === guidedStep ? 'text-gray-900 font-semibold' : 'text-gray-400'">{{ label }}</span>
          </div>
          <span v-if="i < guidedSteps.length - 1" class="text-gray-300">›</span>
        </template>
        <button @click="cancelGuided" class="ml-auto shrink-0 text-sm text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg">✕ 回到選商品</button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="max-w-2xl mx-auto p-5">

          <!-- 步驟 2：確認明細與折扣 -->
          <template v-if="guidedStep === 2">
            <h2 class="text-xl font-bold text-gray-900 mb-1">請和客人確認品項與數量</h2>
            <p class="text-sm text-gray-500 mb-4">數量可在這裡改；要加別的商品請按「上一步」。</p>
            <div class="bg-white rounded-2xl border border-gray-200 px-4 mb-4">
              <div v-for="(item, i) in cart" :key="item.productId + '@' + item.price" class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                <div class="flex-1 min-w-0">
                  <div class="text-base text-gray-900 font-medium">{{ item.name }}</div>
                  <div class="text-sm text-gray-400">單價 ${{ item.finalPrice }}
                    <button v-if="item.openPrice" @click="editItemPrice(i)" class="ml-2 text-orange-600 hover:underline">改價</button>
                  </div>
                </div>
                <button @click="guidedQty(i, -1)" class="w-10 h-10 rounded-full border border-gray-200 text-gray-600 text-xl hover:bg-gray-100">−</button>
                <span class="w-8 text-center text-lg font-bold">{{ item.qty }}</span>
                <button @click="guidedQty(i, 1)" class="w-10 h-10 rounded-full border border-gray-200 text-gray-600 text-xl hover:bg-gray-100">+</button>
                <div class="w-20 text-right text-base font-semibold text-gray-900">${{ item.finalPrice * item.qty }}</div>
              </div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
              <div class="text-sm text-gray-500 mb-2">折扣類型</div>
              <div class="flex flex-wrap gap-2">
                <button v-for="d in enabledDiscounts" :key="d.id" @click="guidedSetDiscount(d)"
                        class="px-4 py-2.5 rounded-xl border text-sm font-medium"
                        :class="curDiscount?.id === d.id ? 'bg-purple-50 text-purple-700 border-purple-400' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'">
                  {{ d.label }}<span v-if="d.rate < 1" class="ml-1 opacity-70">{{ rateLabel(d.rate) }}</span>
                </button>
              </div>
              <div v-if="curDiscount?.requireStaff" class="mt-3 flex items-center gap-3">
                <span class="text-sm" :class="selectedStaffId ? 'text-gray-800' : 'text-red-600'">
                  員工：{{ guidedStaffName || '尚未選擇（必選）' }}
                </span>
                <button @click="guidedPickStaff" class="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">選擇員工</button>
              </div>
              <div v-if="curDiscount?.requireVip" class="mt-3 flex items-center gap-3">
                <span class="text-sm" :class="vipFound ? 'text-gray-800' : 'text-red-600'">
                  VIP：{{ vipFound ? vipFound.id + ' ' + vipFound.name : '尚未選擇（必選）' }}
                </span>
                <button @click="guidedPickVip" class="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">選擇 VIP</button>
              </div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 p-4">
              <div v-if="subtotal !== total" class="flex justify-between text-sm text-gray-400 mb-1"><span>小計</span><span>${{ subtotal }}</span></div>
              <div v-if="subtotal !== total" class="flex justify-between text-sm text-purple-600 mb-1"><span>折扣</span><span>- ${{ subtotal - total }}</span></div>
              <div class="flex justify-between items-baseline">
                <span class="text-base text-gray-600">共 {{ cartCount }} 件，應收</span>
                <span class="text-3xl font-bold text-gray-900">${{ total }}</span>
              </div>
            </div>
          </template>

          <!-- 步驟 3：發票載具 -->
          <template v-else-if="guidedStep === 3">
            <h2 class="text-xl font-bold text-gray-900 mb-1">請問客人發票要存載具嗎？</h2>
            <p class="text-sm text-gray-500 mb-4">一定要選一個才能繼續。</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <button v-for="c in carrierChoices" :key="c.value" @click="pickCarrierChoice(c.value)"
                      class="rounded-2xl border-2 p-4 text-left bg-white"
                      :class="carrierChoice === c.value ? 'border-green-600 bg-green-50' : 'border-gray-200 hover:border-gray-300'">
                <div class="text-2xl mb-1">{{ c.icon }}</div>
                <div class="text-base font-semibold text-gray-900">{{ c.label }}</div>
                <div class="text-xs text-gray-500 mt-0.5">{{ c.hint }}</div>
              </button>
            </div>
            <div v-if="carrierChoice === 'mobile' || carrierChoice === 'cert'" class="bg-white rounded-2xl border border-gray-200 p-4">
              <div class="text-sm text-gray-600 mb-2">{{ carrierChoice === 'mobile' ? '掃描或輸入手機條碼（/ 開頭共 8 碼）' : '輸入自然人憑證條碼（2 個英文字 + 14 個數字）' }}</div>
              <input v-model="carrierCode" ref="guidedCarrierInput" type="text" maxlength="16"
                     @keydown.enter="guidedNext"
                     :placeholder="carrierChoice === 'mobile' ? '/ABC1234' : 'AB12345678901234'"
                     style="width:100%; border:2px solid #d1d5db; border-radius:12px; padding:10px 14px; font-size:22px; font-family:monospace; letter-spacing:2px; outline:none; background:#fff; color:#111;">
              <div v-if="carrierCode && !carrierValid" class="text-sm text-red-600 mt-2">⚠️ 條碼格式不對，請重新掃描或檢查</div>
              <div v-else-if="carrierValid" class="text-sm text-green-700 mt-2">✓ 條碼格式正確：{{ carrierNormalized }}</div>
            </div>
          </template>

          <!-- 步驟 4：付款 -->
          <template v-else-if="guidedStep === 4">
            <h2 class="text-xl font-bold text-gray-900 mb-1">收款　應收 <span class="text-green-700">${{ total }}</span></h2>
            <p class="text-sm text-gray-500 mb-4">選付款方式，收到錢後再按下一步。</p>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <button v-for="p in payMethods" :key="p.value" @click="guidedSetPay(p.value)"
                      :disabled="hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher'"
                      class="rounded-2xl border-2 py-4 flex flex-col items-center gap-1 bg-white"
                      :class="[
                        curPay === p.value ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
                        hasCashOnlyItem && p.value !== 'cash' && p.value !== 'voucher' ? 'opacity-40 cursor-not-allowed' : ''
                      ]">
                <span class="text-2xl">{{ p.icon }}</span><span class="text-base font-semibold">{{ p.label }}</span>
              </button>
            </div>
            <div v-if="hasCashOnlyItem" class="text-sm text-amber-600 mb-3">⚠️ 訂單含限現金品項，只能收現金或消費券</div>

            <div v-if="curPay === 'voucher'" class="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div class="flex items-center gap-3">
                <span class="text-base text-amber-700 font-medium whitespace-nowrap">🎟 消費券面額</span>
                <input v-model.number="voucherAmount" type="number" min="0" placeholder="0"
                       style="flex:1; min-width:0; border:2px solid #f59e0b; border-radius:12px; padding:8px 12px; font-size:22px; font-weight:700; outline:none; background:#fff; color:#92400e; text-align:right;">
                <span class="text-base text-amber-700">元</span>
              </div>
              <div v-if="voucherExceeds" class="text-sm text-red-600 mt-2">⚠️ 消費券 ${{ voucherAmount }} 超過應收 ${{ total }}，請調整</div>
              <div v-else-if="voucherAmount > 0 && cashNeeded > 0" class="text-sm text-amber-700 mt-2">需再收現金 <b>${{ cashNeeded }}</b></div>
              <div v-else-if="voucherAmount > 0" class="text-sm text-green-700 mt-2">✓ 消費券足額支付</div>
            </div>

            <div v-if="guidedNeedCash" class="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-base text-gray-700 font-medium whitespace-nowrap">💵 收到現金</span>
                <input v-model.number="receivedCash" type="number" min="0" placeholder="0"
                       style="flex:1; min-width:0; border:2px solid #d1d5db; border-radius:12px; padding:8px 12px; font-size:22px; font-weight:700; outline:none; background:#fff; color:#111; text-align:right;">
                <span class="text-base text-gray-500">元</span>
              </div>
              <div class="flex gap-2 flex-wrap mb-3">
                <button @click="receivedCash = guidedCashDue" class="text-base px-4 py-2 rounded-xl border border-green-500 bg-green-50 text-green-700 font-medium">剛好 ${{ guidedCashDue }}</button>
                <button v-for="q in quickCash" :key="q" @click="receivedCash = q"
                        class="text-base px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-gray-700">${{ q }}</button>
              </div>
              <div v-if="receivedCash > 0" class="flex justify-between items-center pt-3 border-t border-gray-200">
                <span class="text-lg font-medium text-gray-600">找零</span>
                <span class="text-3xl font-bold" :class="change >= 0 ? 'text-green-700' : 'text-red-500'">
                  {{ change >= 0 ? '$' + change : '還差 $' + Math.abs(change) }}
                </span>
              </div>
            </div>

            <label v-if="curPay === 'card' || curPay === 'hua'" class="flex items-center gap-3 bg-white rounded-2xl border-2 p-4 cursor-pointer"
                   :class="paidConfirmed ? 'border-green-600 bg-green-50' : 'border-amber-300'">
              <input type="checkbox" v-model="paidConfirmed" style="width:24px; height:24px;">
              <span class="text-base text-gray-800">
                {{ curPay === 'card' ? '刷卡機已顯示授權成功' : '華南 Q 已顯示付款成功' }}，金額 ${{ total }} 正確
              </span>
            </label>
          </template>

          <!-- 步驟 5：最後確認 -->
          <template v-else-if="guidedStep === 5">
            <h2 class="text-xl font-bold text-gray-900 mb-1">最後確認</h2>
            <p class="text-sm text-gray-500 mb-4">按下「確認結帳」就會開立發票，開了就不能改，請再看一次。</p>
            <div class="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              <div class="flex justify-between px-4 py-3 text-base"><span class="text-gray-500">品項</span><span class="text-gray-900 text-right">{{ cart.map(i => i.name + '×' + i.qty).join('、') }}</span></div>
              <div v-if="curDiscount && curDiscount.rate < 1" class="flex justify-between px-4 py-3 text-base">
                <span class="text-gray-500">折扣</span>
                <span class="text-purple-600">{{ curDiscount.label }} {{ rateLabel(curDiscount.rate) }}<span v-if="guidedStaffName">（{{ guidedStaffName }}）</span><span v-if="curDiscount.requireVip && vipFound">（{{ vipFound.name }}）</span></span>
              </div>
              <div class="flex justify-between px-4 py-3 text-base"><span class="text-gray-500">應收</span><span class="text-2xl font-bold text-gray-900">${{ total }}</span></div>
              <div class="flex justify-between px-4 py-3 text-base"><span class="text-gray-500">付款</span><span class="text-gray-900">{{ guidedPayText }}</span></div>
              <div v-if="guidedNeedCash" class="flex justify-between px-4 py-3 text-base">
                <span class="text-gray-500">收現金 / 找零</span>
                <span><span class="text-gray-900">${{ receivedCash }}</span>　<span class="text-2xl font-bold text-green-700">找 ${{ change }}</span></span>
              </div>
              <div class="flex justify-between px-4 py-3 text-base">
                <span class="text-gray-500">發票</span>
                <span class="text-gray-900">{{ carrierChoice === 'paper' ? '紙本（印證明聯給客人）' : '載具 ' + carrierNormalized }}</span>
              </div>
            </div>
          </template>

        </div>
      </div>

      <!-- 上一步 / 下一步 -->
      <div class="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div class="max-w-2xl mx-auto">
          <div v-if="guidedBlockReason" class="text-sm text-amber-600 mb-2 text-center">{{ guidedBlockReason }}</div>
          <div class="flex gap-3">
            <button @click="guidedBack" class="flex-1 py-4 rounded-2xl border border-gray-200 text-base text-gray-700 hover:bg-gray-50">◀ 上一步</button>
            <button v-if="guidedStep < guidedSteps.length" @click="guidedNext" :disabled="!!guidedBlockReason"
                    class="py-4 rounded-2xl text-lg font-bold"
                    style="flex:2"
                    :class="guidedBlockReason ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-700 hover:bg-green-800 text-white'">
              下一步：{{ guidedSteps[guidedStep] }} ▶
            </button>
            <button v-else @click="guidedConfirm" :disabled="issuing"
                    class="py-4 rounded-2xl text-lg font-bold bg-green-700 hover:bg-green-800 text-white disabled:opacity-60"
                    style="flex:2">
              {{ issuing ? '開立發票中…' : '✓ 確認結帳・開立發票' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 員工選擇 Modal -->
    <div v-if="showStaffModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showStaffModal=false">
      <div class="bg-white rounded-2xl p-7 shadow-2xl flex flex-col" style="width:960px; max-width:95vw; max-height:92vh;">
        <h3 class="text-base font-bold text-gray-900 mb-1">選擇員工</h3>
        <p class="text-sm text-gray-500 mb-4">請選擇此次消費的員工</p>
        <template v-if="activeEmployees.length > 6">
          <input v-model="staffSearch" type="text" placeholder="篩選編號、姓名或部門"
                 class="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-2 focus:outline-none focus:border-green-500">
          <select v-if="staffDepts.length > 1" v-model="staffDept"
                  class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3 focus:outline-none focus:border-green-500 bg-white text-gray-900">
            <option value="">全部部門</option>
            <option v-for="d in staffDepts" :key="d" :value="d">{{ d }}</option>
          </select>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5 overflow-y-auto content-start" style="flex:1 1 auto; min-height:0;">
          <button v-for="emp in filteredStaff" :key="emp.id"
                  @click="selectedStaffId = emp.id"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
                  :class="selectedStaffId === emp.id ? 'bg-green-50 border-green-500' : 'border-gray-200 hover:bg-gray-50'">
            <span class="font-mono text-xs text-gray-400">{{ emp.id }}</span>
            <span class="font-medium text-gray-900">{{ emp.name }}</span>
            <span v-if="emp.dept" class="text-xs text-gray-400 truncate">{{ emp.dept }}</span>
            <span v-if="selectedStaffId === emp.id" class="ml-auto text-green-600">✓</span>
          </button>
          <div v-if="!filteredStaff.length" class="col-span-full text-sm text-gray-400 text-center py-4">找不到符合的員工</div>
        </div>
        <div class="flex gap-2">
          <button @click="showStaffModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmStaff" :disabled="!selectedStaffId"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  :class="selectedStaffId ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            確認
          </button>
        </div>
      </div>
    </div>

    <!-- VIP 選擇 Modal -->
    <div v-if="showVipModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showVipModal=false">
      <div class="bg-white rounded-2xl p-7 shadow-2xl flex flex-col" style="width:960px; max-width:95vw; max-height:92vh;">
        <h3 class="text-base font-bold text-gray-900 mb-1">選擇 VIP</h3>
        <p class="text-sm text-gray-500 mb-4">請選擇此次消費的 VIP</p>
        <input v-if="activeVips.length > 6" v-model="vipSearch" type="text" placeholder="篩選號碼、姓名或電話"
               class="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm mb-3 focus:outline-none focus:border-purple-500">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5 overflow-y-auto content-start" style="flex:1 1 auto; min-height:0;">
          <button v-for="v in filteredVips" :key="v.id"
                  @click="vipInput = v.id"
                  class="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
                  :class="vipInput === v.id ? 'bg-purple-50 border-purple-500' : 'border-gray-200 hover:bg-gray-50'">
            <span class="font-mono text-xs text-gray-400">{{ v.id }}</span>
            <span class="font-medium text-gray-900">{{ v.name }}</span>
            <span v-if="vipInput === v.id" class="ml-auto text-purple-600">✓</span>
          </button>
          <div v-if="!activeVips.length" class="col-span-full text-sm text-gray-400 text-center py-4">尚無啟用中的 VIP，請至會員管理新增</div>
          <div v-else-if="!filteredVips.length" class="col-span-full text-sm text-gray-400 text-center py-4">找不到符合的 VIP</div>
        </div>
        <div class="flex gap-2">
          <button @click="showVipModal=false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmVip" :disabled="!vipFound"
                  class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  :class="vipFound ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'">
            確認
          </button>
        </div>
      </div>
    </div>

    <!-- 載具 Modal -->
    <!-- 時價品項：輸入當次售價（手機用下面的數字鍵，電腦可直接打數字按 Enter） -->
    <div v-if="priceModal.open" class="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" @click.self="closePriceModal">
      <div class="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full sm:w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900">{{ priceModal.name }}</h3>
        <p class="text-xs text-gray-500 mb-3">時價品項，請輸入這次的售價{{ priceModal.editIdx >= 0 ? '（修改）' : '' }}</p>
        <div class="flex items-center border-2 rounded-xl px-4 py-2 mb-1" :class="priceModal.error ? 'border-red-400' : 'border-orange-400'">
          <span class="text-2xl text-gray-400 mr-1">$</span>
          <input ref="priceInput" v-model="priceModal.value" type="text" inputmode="numeric" maxlength="7"
                 class="flex-1 min-w-0 text-3xl font-bold text-gray-900 text-right outline-none bg-transparent"
                 placeholder="0" @input="priceModal.error = ''" @keydown.enter.prevent="confirmPrice" @keydown.esc="closePriceModal">
        </div>
        <p class="text-xs h-4 mb-2" :class="priceModal.error ? 'text-red-600' : 'text-gray-400'">
          {{ priceModal.error || (curDiscount && curDiscount.rate < 1 ? `${curDiscount.label} 折扣後 $${discountedPrice(Number(priceModal.value) || 0)}` : '') }}
        </p>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <button v-for="k in PRICE_KEYS" :key="k" @click="pricePad(k)"
                  class="py-3 rounded-xl border border-gray-200 text-xl font-semibold hover:bg-gray-50 active:bg-gray-100"
                  :class="k === 'C' ? 'text-red-500' : 'text-gray-800'">{{ k }}</button>
        </div>
        <div class="flex gap-2">
          <button @click="closePriceModal" class="flex-1 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmPrice" class="flex-1 py-3 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600">
            {{ priceModal.editIdx >= 0 ? '確定改價' : '加入訂單' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showCarrierModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showCarrierModal = false">
      <div class="bg-white rounded-2xl p-7 w-80 shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">統一發票</h3>
        <p class="text-sm text-gray-500 mb-5 leading-relaxed">
          請輸入載具條碼（手機條碼 / 自然人憑證），<br>若無載具將印出紙本二聯式發票。
        </p>
        <input
                v-model="carrier" ref="carrierInput" type="text"
                placeholder="/ 開頭的手機條碼，或留空" maxlength="20"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:border-green-500"
        >
        <div class="flex gap-2">
          <button @click="showCarrierModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="confirmCheckout" :disabled="issuing"
                  class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60">
            {{ issuing ? '開立發票中…' : '確認結帳' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 收據 Modal -->
    <div v-if="showReceipt && lastOrder" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div class="bg-white rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl" style="width:760px; max-width:95vw;">
        <div class="p-7">
          <div class="text-center mb-4">
            <div class="text-green-700 font-bold text-xl">聖母健康農莊</div>
            <div class="text-gray-400 text-sm mt-0.5">St. Mary's Health Farm, Taitung</div>
          </div>
          <hr class="border-dashed border-gray-200 my-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
          <div class="text-sm text-gray-500 space-y-1 mb-3">
            <div class="flex justify-between"><span>單號</span><span class="text-gray-800 font-medium">{{ lastOrder.no }}</span></div>
            <div v-if="lastOrder.invoiceNo" class="flex justify-between">
              <span>發票號碼<span v-if="lastOrder.invoiceIsMock" class="text-amber-500 ml-1">(測試)</span></span>
              <span class="text-gray-800 font-mono font-medium">{{ lastOrder.invoiceNo }}</span>
            </div>
            <div class="flex justify-between"><span>日期</span><span class="text-gray-800">{{ formatDate(lastOrder.createdAt) }}</span></div>
            <div class="flex justify-between"><span>地點</span><span class="text-gray-800">{{ stationLabel(lastOrder.location) }}</span></div>
            <div v-if="lastOrder.cashierName" class="flex justify-between"><span>結帳人</span><span class="text-gray-800">{{ lastOrder.cashierName }}</span></div>
            <div v-if="lastOrder.discountLabel" class="flex justify-between">
              <span>折扣</span><span class="text-purple-600 font-medium">{{ lastOrder.discountLabel }}</span>
            </div>
          </div>
          <hr class="border-dashed border-gray-200 my-3">
          <table class="w-full text-sm mb-2">
            <thead>
            <tr class="text-gray-400 border-b border-gray-200">
              <th class="text-left pb-1.5 font-medium">品項</th>
              <th class="text-center pb-1.5 font-medium">數量</th>
              <th class="text-right pb-1.5 font-medium">小計</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="item in lastOrder.items" :key="item.productId + '@' + item.price" class="border-b border-gray-100">
              <td class="py-1.5 text-gray-800">{{ item.name }}</td>
              <td class="text-center text-gray-600">{{ item.qty }}</td>
              <td class="text-right text-gray-800">${{ item.finalPrice * item.qty }}</td>
            </tr>
            </tbody>
          </table>
          </div>
          <div>
          <hr class="border-dashed border-gray-200 my-3 md:hidden">
          <div v-if="lastOrder.subtotal !== lastOrder.total">
            <div class="flex justify-between text-sm text-gray-400 mb-1"><span>小計</span><span>${{ lastOrder.subtotal }}</span></div>
            <div class="flex justify-between text-sm text-purple-600 mb-1"><span>折扣</span><span>- ${{ lastOrder.subtotal - lastOrder.total }}</span></div>
          </div>
          <div class="flex justify-between text-2xl font-bold text-gray-900 border-t border-gray-200 pt-2">
            <span>合計</span><span>${{ lastOrder.total }}</span>
          </div>
          <div class="flex justify-between text-sm text-gray-400 mt-1">
            <span>付款方式</span>
            <span>{{ lastOrder.payDetail || PAY_LABEL[lastOrder.payMethod] }}</span>
          </div>
          <div v-if="lastOrder.receivedCash > 0" class="flex justify-between text-sm text-gray-400 mt-1">
            <span>收到現金</span><span>${{ lastOrder.receivedCash }}</span>
          </div>
          <div v-if="lastOrder.receivedCash > 0" class="flex justify-between text-2xl font-bold text-green-700 mt-1">
            <span>找零</span><span>${{ lastOrder.change }}</span>
          </div>
          <div class="mt-4 rounded-xl p-3" :class="lastOrder.carrier ? 'bg-green-50' : 'bg-amber-50'">
            <div class="text-sm font-semibold mb-1" :class="lastOrder.carrier ? 'text-green-700' : 'text-amber-700'">
              {{ lastOrder.carrier ? '📱 載具歸戶' : '🧾 紙本二聯式發票' }}
            </div>
            <div class="text-base font-medium" :class="lastOrder.carrier ? 'text-green-800' : 'text-amber-800'">
              {{ lastOrder.carrier || '請至發票機取件' }}
            </div>
          </div>
          </div>
          </div>
          <div class="text-center text-sm text-gray-400 mt-5 leading-6">感謝您的惠顧<br>歡迎再次蒞臨</div>
        </div>
        <div class="flex gap-2 px-7 pb-6 no-print">
          <button @click="printReceipt" class="flex-1 whitespace-nowrap py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-base text-gray-700 font-medium transition-colors">🖨 列印發票</button>
          <button @click="printOrderBill" class="flex-1 whitespace-nowrap py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-base text-gray-700 font-medium transition-colors">🧾 列印帳單</button>
          <button @click="finishOrder" class="flex-1 whitespace-nowrap py-3 rounded-xl bg-green-700 hover:bg-green-800 text-white text-base font-semibold transition-colors">完成</button>
        </div>
      </div>
    </div>

    <!-- 列印專用：照舊 BK35 POS 紙本版面（版面在 utils/invoicePrint.ts），畫面上隱藏 -->
    <div v-if="printLayout" id="receipt-print">
      <InvoicePrint ref="invoicePrintRef" :layout="printLayout" />
    </div>

    <!-- 帳單網頁列印版（print-agent 連不到帳單機時用；版面在 utils/billPrint.ts），畫面上隱藏 -->
    <div v-if="billLines" id="bill-print">
      <BillPrint :lines="billLines" />
    </div>

  </div>
</template>

<script setup lang="ts">
  import { LOC_LABEL, PAY_LABEL } from '~/composables/usePosStore'
  import { loadStation } from '~/composables/useStation'
  import type { Product, DiscountType } from '~/composables/usePosStore'
  import { buildInvoiceLayout, buildEscPosJob } from '~/utils/invoicePrint'
  import { printViaAgent, printBillViaAgent } from '~/utils/printAgent'
  import { issueEInvoice, formatInvoiceNo } from '~/utils/einvoiceApi'
  import { buildBillLines, type BillLine, type BillOrder } from '~/utils/billPrint'
  import { useGuidedCheckout, loadGuidedCheckout } from '~/composables/useGuidedCheckout'

  const { products, discountTypes, employees, vipMembers, addOrder, stationLabel, categoryList, categoryEmoji } = usePosStore()
  const catEmoji = (c: string) => categoryEmoji(c)
  // 分類圖示的淡色底（依序輪流）
  const CAT_TINTS = ['bg-blue-100 text-blue-600', 'bg-purple-100 text-purple-600', 'bg-emerald-100 text-emerald-600', 'bg-pink-100 text-pink-600', 'bg-amber-100 text-amber-600', 'bg-orange-100 text-orange-600', 'bg-red-100 text-red-600', 'bg-green-100 text-green-600']


  // 商品圖片（資料機上的縮圖，<CatalogImg> 會依區網 / Hub 取圖）；載不到的就只顯示文字
  const imgErrors = reactive(new Set<string>())


  const payMethods = [
    { value: 'cash',    icon: '💵', label: '現金' },
    { value: 'card',    icon: '💳', label: '信用卡' },
    { value: 'hua',     icon: '📱', label: '華南Q' },
    { value: 'voucher', icon: '🎟', label: '消費券' },
  ] as const

  const enabledDiscounts = computed(() => discountTypes.value.filter(d => d.enabled))

  const curLoc      = ref<string>('')   // = 本機收銀站；沒設定時是空的（顯示全部品項）
  // 目前分類：沒有「全部」，記住這台上次選的（localStorage），找不到就用第一個分類
  const CAT_KEY = 'pos-cashier-cat'
  const curCat      = ref('')
  onMounted(() => { try { curCat.value = localStorage.getItem(CAT_KEY) || '' } catch {} })
  function pickCat(c: string) {
    curCat.value = c
    try { localStorage.setItem(CAT_KEY, c) } catch {}
  }
  // 手機（寬 < 768px）一次只顯示一區：選商品 / 訂單結帳；平板、電腦兩區並排，這個值沒作用
  const mobileView  = ref<'products' | 'cart'>('products')
  const curPay      = ref<'cash' | 'card' | 'hua' | 'voucher'>('cash')
  const voucherAmount = ref(0)
  const receivedCash  = ref(0)

  // 消費券補差額：消費券不足時需要現金補足
  const cashNeeded = computed(() =>
          curPay.value === 'voucher' ? Math.max(0, total.value - voucherAmount.value) : 0
  )
  // 消費券超過總價
  const voucherExceeds = computed(() =>
          curPay.value === 'voucher' && voucherAmount.value > total.value
  )
  // 顯示現金輸入：純現金，或消費券需補差額
  const showCashInput = computed(() =>
          curPay.value === 'cash' ||
          (curPay.value === 'voucher' && !voucherExceeds.value)
  )
  // 找零基準：純現金用 total，消費券用 cashNeeded
  const change = computed(() => {
    if (curPay.value === 'cash') return receivedCash.value - total.value
    if (curPay.value === 'voucher') return receivedCash.value - cashNeeded.value
    return 0
  })
  // 快速現金按鈕
  const quickCash = computed(() => {
    const need = curPay.value === 'voucher' ? cashNeeded.value : total.value
    return [50, 100, 200, 500, 1000].filter(v => v >= need).slice(0, 4)
  })
  const curDiscount = ref<DiscountType | null>(null)
  const cart        = ref<any[]>([])

  const showCarrierModal = ref(false)
  const showReceipt      = ref(false)
  const showStaffModal   = ref(false)
  const showVipModal     = ref(false)
  const carrier          = ref('')
  const carrierInput     = ref<HTMLInputElement | null>(null)
  const lastOrder        = ref<any>(null)
  const invoicePrintRef  = ref<{ ready: () => Promise<void> } | null>(null)
  // 發票版面（證明聯 + 交易明細）。條碼 / QR 的內容也在 utils/invoicePrint.ts 產生。
  // 號碼、隨機碼、AES 驗證碼由後端（server/api/einvoice/issue）產生；證明聯依規定只能印一次。
  const printLayout = computed(() => lastOrder.value ? buildInvoiceLayout(lastOrder.value, lastOrder.value.invoiceAes) : null)

  const selectedStaffId  = ref('')
  const vipInput         = ref('')   // 已選取的 VIP 號碼
  const vipSearch        = ref('')

  const activeEmployees = computed(() => employees.value.filter(e => e.enabled))
  // 員工多（Excel 匯入幾百人）時可依姓名、編號、部門篩選
  const staffSearch = ref('')
  const staffDept   = ref('')
  const staffDepts  = computed(() => [...new Set(activeEmployees.value.map(e => (e.dept || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
  const filteredStaff = computed(() => {
    const q = staffSearch.value.trim().toLowerCase()
    return activeEmployees.value.filter(e =>
      (!staffDept.value || (e.dept || '').trim() === staffDept.value) &&
      (!q || e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || (e.dept || '').toLowerCase().includes(q)))
  })
  const activeVips = computed(() => vipMembers.value.filter(v => v.enabled))
  const filteredVips = computed(() => {
    const q = vipSearch.value.trim().toLowerCase()
    if (!q) return activeVips.value
    return activeVips.value.filter(v => v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || (v.phone ?? '').includes(q))
  })
  const vipFound = computed(() => {
    if (!vipInput.value) return null
    return vipMembers.value.find(v => v.id === vipInput.value && v.enabled) ?? null
  })

  // 結帳流程：先判斷折扣類型是否需要員工/VIP驗證
  const { cashier, ensure: ensureCashier } = useCashier()

  function startCheckout() {
    if (!cart.value.length) return
    if (!ensureCashier()) return // 要先選結帳人
    if (curDiscount.value?.requireStaff) {
      selectedStaffId.value = ''
      staffSearch.value = ''
      staffDept.value = ''
      showStaffModal.value = true
    } else if (curDiscount.value?.requireVip) {
      vipSearch.value = ''
      vipInput.value = ''
      showVipModal.value = true
    } else {
      openCarrierModal()
    }
  }

  function confirmStaff() {
    if (!selectedStaffId.value) return
    showStaffModal.value = false
    if (!guidedOpen.value) openCarrierModal() // 引導模式：選完回到第 2 步
  }

  function confirmVip() {
    if (!vipFound.value) return
    showVipModal.value = false
    if (!guidedOpen.value) openCarrierModal()
  }

  // 本機收銀站：設了就鎖定（地點切換鈕隱藏），只顯示該站商品
  const station = useStation()
  watch(station, (v) => { curLoc.value = v }, { immediate: true })
  onMounted(loadStation)

  // 預設選第一個折扣
  onMounted(() => {
    if (enabledDiscounts.value.length) curDiscount.value = enabledDiscounts.value[0]
  })
  watch(enabledDiscounts, (list) => {
    if (!curDiscount.value && list.length) curDiscount.value = list[0]
  })

  // 0.95 → "9.5折", 0.9 → "9折"
  function rateLabel(rate: number) {
    const n = rate * 10
    return (Number.isInteger(n) ? n : parseFloat(n.toFixed(1))) + '折'
  }

  function discountedPrice(price: number) {
    const rate = curDiscount.value?.rate ?? 1
    return Math.round(price * rate)
  }

  const hasCashOnlyItem = computed(() =>
          cart.value.some(i => products.value.find(p => p.id === i.productId)?.cashOnly)
  )

  function setDiscount(d: DiscountType) {
    curDiscount.value = d
    cart.value.forEach(item => { item.finalPrice = Math.round(item.price * d.rate) })
  }

  function setPay(p: 'cash' | 'card' | 'hua' | 'voucher') {
    if (hasCashOnlyItem.value && p !== 'cash' && p !== 'voucher') return
    curPay.value = p
    if (p !== 'voucher') voucherAmount.value = 0
    receivedCash.value = 0
  }

  function addItem(prod: Product) {
    if (prod.cashOnly && curPay.value !== 'cash') curPay.value = 'cash'
    if (prod.openPrice) { openPriceModal(prod.id, prod.name, prod.price, -1); return }
    pushItem(prod, prod.price)
  }
  // 商品卡按右鍵：數量減 1（減到 0 就從訂單拿掉）。時價品項有好幾行不同價錢時，減最後加入的那一行。
  // 觸控長按也會觸發右鍵事件：只擋掉選單、不減數量，免得平板上按久一點就被扣掉。
  const lastPointer = ref('')
  function removeOne(prod: Product) {
    if (lastPointer.value === 'touch') return
    for (let i = cart.value.length - 1; i >= 0; i--) {
      if (cart.value[i]!.productId === prod.id) { changeQty(i, -1); return }
    }
  }
  // 收銀頁不跳瀏覽器右鍵選單（輸入框除外，才能貼上）
  function blockMenu(e: MouseEvent) {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    e.preventDefault()
  }
  // 訂單明細的數量（− 數字 +）上滾滑鼠滾輪：往上加 1、往下減 1。只在數量那一小塊有效，明細清單其他地方照常捲動。
  // 觸控板一次會送很多小事件：累積到一格（約 50）才算一次。
  let wheelAcc = 0
  let wheelAt = 0
  /** 累積滾輪量，滿一格回傳 +1（往上）或 -1（往下），不滿回傳 0 */
  function wheelStep(e: WheelEvent) {
    const now = Date.now()
    if (now - wheelAt > 300) wheelAcc = 0
    wheelAt = now
    wheelAcc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY // deltaMode 1 = 以「行」為單位（Firefox / Mypal）
    if (Math.abs(wheelAcc) < 50) return 0
    const d = wheelAcc < 0 ? 1 : -1
    wheelAcc = 0
    return d
  }
  function wheelQty(e: WheelEvent, i: number) {
    const d = wheelStep(e)
    if (d && cart.value[i]) changeQty(i, d)
  }
  // 商品卡上的滾輪：只有已經在訂單裡（右上角有數量）的商品才調數量、擋住捲動；
  // 還沒加入的卡片照常捲動商品格。時價品項有好幾行時，加減的都是最後加入的那一行（跟右鍵一樣）。
  function wheelCard(e: WheelEvent, prod: Product) {
    let idx = -1
    for (let i = cart.value.length - 1; i >= 0; i--) if (cart.value[i]!.productId === prod.id) { idx = i; break }
    if (idx < 0) return
    e.preventDefault()
    const d = wheelStep(e)
    if (d) changeQty(idx, d)
  }
  // 同品項同價錢就加數量；時價品項不同價錢分開列
  function pushItem(prod: { id: number; name: string; openPrice?: boolean }, price: number, qty = 1) {
    const ex = cart.value.find(i => i.productId === prod.id && i.price === price)
    if (ex) { ex.qty += qty; return }
    cart.value.push({
      productId: prod.id,
      name: prod.name,
      price,
      finalPrice: discountedPrice(price),
      qty,
      ...(prod.openPrice ? { openPrice: true } : {}),
    })
  }

  // 時價：輸入當次售價
  const PRICE_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']
  const priceInput = ref<HTMLInputElement | null>(null)
  const priceModal = reactive({ open: false, productId: 0, name: '', value: '', editIdx: -1, error: '' })
  function openPriceModal(productId: number, name: string, price: number, editIdx: number) {
    Object.assign(priceModal, { open: true, productId, name, value: price > 0 ? String(price) : '', editIdx, error: '' })
    nextTick(() => { priceInput.value?.focus(); priceInput.value?.select() })
  }
  function closePriceModal() { priceModal.open = false }
  function pricePad(k: string) {
    priceModal.error = ''
    if (k === 'C') priceModal.value = ''
    else if (k === '⌫') priceModal.value = priceModal.value.slice(0, -1)
    else if (priceModal.value.length < 7) priceModal.value = (priceModal.value === '0' ? '' : priceModal.value) + k
  }
  function confirmPrice() {
    const txt = String(priceModal.value).trim()
    const price = Number(txt)
    if (!/^\d+$/.test(txt) || price <= 0) { priceModal.error = '請輸入大於 0 的整數金額'; return }
    if (priceModal.editIdx >= 0) {
      const item = cart.value[priceModal.editIdx]
      if (item) {
        cart.value.splice(priceModal.editIdx, 1)
        pushItem({ id: item.productId, name: item.name, openPrice: true }, price, item.qty) // 改成跟別行同價錢時合併
      }
    } else {
      pushItem({ id: priceModal.productId, name: priceModal.name, openPrice: true }, price)
    }
    priceModal.open = false
  }
  function editItemPrice(idx: number) {
    const item = cart.value[idx]
    if (item?.openPrice) openPriceModal(item.productId, item.name, item.price, idx)
  }

  const locProducts = computed(() =>
          products.value.filter(p => !p.inactive && (!curLoc.value || p.locations.includes(curLoc.value))).sort((a, b) => a.sortOrder - b.sortOrder)
  )
  // 分類頁籤：依品項管理裡排的分類順序，只列這站有品項的分類
  const categories = computed(() => {
    const used = new Set(locProducts.value.map(p => p.category || '其他'))
    const ordered = categoryList.value.map(c => c.name).filter(n => used.has(n))
    return [...ordered, ...[...used].filter(n => !ordered.includes(n))]
  })
  const activeCat = computed(() => (categories.value.includes(curCat.value) ? curCat.value : categories.value[0] || ''))
  const filteredProducts = computed(() =>
          locProducts.value.filter(p => (p.category || '其他') === activeCat.value)
  )
  const subtotal = computed(() => cart.value.reduce((s, i) => s + i.price * i.qty, 0))
  const total    = computed(() => cart.value.reduce((s, i) => s + i.finalPrice * i.qty, 0))

  function cartQty(id: number) { return cart.value.filter(i => i.productId === id).reduce((s, i) => s + i.qty, 0) }
  function changeQty(idx: number, d: number) {
    cart.value[idx].qty += d
    if (cart.value[idx].qty <= 0) cart.value.splice(idx, 1)
  }
  function clearCart() { cart.value = [] }

  function openCarrierModal() {
    if (!cart.value.length) return
    carrier.value = ''
    showCarrierModal.value = true
    nextTick(() => carrierInput.value?.focus())
  }

  // 模擬發票號碼：這台收銀機沒在系統設定啟用電子發票時使用，紙本會印「測試號碼」。
  function genMockInvoiceNo() {
    const letters = 'AB'[Math.floor(Math.random() * 2)] + 'CDEFGHJKLMNPQRSTUVXYZ'[Math.floor(Math.random() * 21)]
    const digits = String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
    return `${letters}-${digits}`
  }
  function genMockRandomCode() {
    return String(Math.floor(Math.random() * 1e4)).padStart(4, '0')
  }

  const issuing = ref(false)

  async function confirmCheckout() {
    if (issuing.value) return
    const va = Math.min(voucherAmount.value, total.value)
    const payDetail = curPay.value === 'mixed' && va > 0
            ? `消費券 $${va} + 現金 $${total.value - va}`
            : curPay.value === 'voucher' ? `消費券 $${va}` : ''

    const order = {
      location: curLoc.value,
      items: cart.value.map(i => ({ ...i })),
      subtotal: subtotal.value,
      discount: String(curDiscount.value?.id ?? ''),
      discountLabel: curDiscount.value && curDiscount.value.rate < 1
              ? `${curDiscount.value.label} ${rateLabel(curDiscount.value.rate)}` : '',
      staffId: curDiscount.value?.requireStaff ? selectedStaffId.value : '',
      vipId:   curDiscount.value?.requireVip   ? vipInput.value : '',
      total: total.value,
      voucherAmount: va,
      receivedCash: receivedCash.value,
      change: change.value >= 0 ? change.value : 0,
      payMethod: curPay.value,
      payDetail,
      carrier: carrier.value.trim().toUpperCase(),
      invoiceNo: '',
      invoiceRandomCode: '',
      invoiceAes: '',
      invoiceIsMock: false,
      cashierId: cashier.value?.id ?? '',
      cashierName: cashier.value?.name ?? '',
    }

    // 向後端開立電子發票（配號 + 隨機碼 + QR 驗證碼）；上傳由後端處理
    issuing.value = true
    const r = await issueEInvoice({ items: order.items, subtotal: order.subtotal, total: order.total, carrier: order.carrier })
    issuing.value = false
    let issuedAt: Date | null = null
    if (r.ok) {
      order.invoiceNo = formatInvoiceNo(r.data.invoiceNo)
      order.invoiceRandomCode = r.data.randomCode
      order.invoiceAes = r.data.aes
      order.invoiceIsMock = !!r.data.mock // 模擬加值中心開的：紙本印「測試號碼」
      issuedAt = new Date(r.data.issuedAt)
    } else if (r.notConfigured) {
      console.warn('未啟用電子發票，改用測試號碼：', r.message)
      order.invoiceNo = genMockInvoiceNo()
      order.invoiceRandomCode = genMockRandomCode()
      order.invoiceIsMock = true
    } else {
      alert(`發票開立失敗，這筆還沒結帳：\n${r.message}`)
      return
    }
    showCarrierModal.value = false

    // 發票日期以伺服器開立時間為準（收銀電腦時鐘可能不準）
    addOrder(order, issuedAt ?? undefined)
    const { orders } = usePosStore()
    lastOrder.value = orders.value[0]
    showReceipt.value = true
    cart.value = []
    mobileView.value = 'products'
    curDiscount.value = enabledDiscounts.value[0] ?? null
    voucherAmount.value = 0
    receivedCash.value = 0
  }


  // 先交給收銀電腦上的 print-agent 直接送 ESC/POS（和舊系統印出來一模一樣）；
  // 連不到 print-agent 時改用瀏覽器列印（版面相同，字型略有差異）。
  async function printReceipt() {
    if (!printLayout.value) return
    await nextTick()
    if (await printViaAgent(buildEscPosJob(printLayout.value))) return
    await invoicePrintRef.value?.ready()
    await nextTick()
    window.print()
  }

  // 測試列印：用假資料直接測印表機/排版，不會寫入真實訂單紀錄
  async function testPrint() {
    lastOrder.value = {
      no: 'TEST-' + Date.now().toString().slice(-6),
      createdAt: new Date(),
      location: curLoc.value,
      items: [
        { productId: -1, name: '測試品項A', price: 50, finalPrice: 50, qty: 2 },
        { productId: -2, name: '測試品項B', price: 30, finalPrice: 30, qty: 1 },
      ],
      subtotal: 130,
      discount: '',
      discountLabel: '',
      total: 130,
      voucherAmount: 0,
      receivedCash: 130,
      change: 0,
      payMethod: 'cash',
      payDetail: '',
      carrier: '',
      invoiceNo: 'AA-88880000',
      invoiceRandomCode: genMockRandomCode(),
      invoiceIsMock: true,
    }
    showReceipt.value = true
    await printReceipt()
  }

  // ---- 帳單（送帳單機 CPrinter，和發票機分開）----
  // 先交給 print-agent 送帳單機（ESC/POS 行模式，同舊 BK35 帳單）；連不到就改用瀏覽器列印。
  const billLines = ref<BillLine[] | null>(null)
  async function printBill(order: BillOrder) {
    const lines = buildBillLines(order)
    if (await printBillViaAgent(lines)) return
    billLines.value = lines
    await nextTick()
    document.body.classList.add('print-bill')
    const done = () => { document.body.classList.remove('print-bill'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
    setTimeout(done, 1000) // 舊瀏覽器沒有 afterprint 時也會還原（window.print 會等對話框關掉才往下走）
  }
  // 結帳前：印目前購物車的帳單給客人看（標示尚未結帳）
  function printCartBill() {
    if (!cart.value.length) return
    printBill({
      createdAt: new Date(),
      location: curLoc.value,
      items: cart.value.map(i => ({ ...i })),
      subtotal: subtotal.value,
      total: total.value,
      discountLabel: curDiscount.value && curDiscount.value.rate < 1
              ? `${curDiscount.value.label} ${rateLabel(curDiscount.value.rate)}` : '',
      paid: false,
    })
  }
  // 結帳後：收據視窗裡印這筆訂單的帳單（含付款方式、找零、發票號碼）
  function printOrderBill() {
    if (lastOrder.value) printBill({ ...lastOrder.value, paid: true })
  }

  // ---- 引導式結帳（系統設定開關，每台機器自己記）----
  // 1 選商品（就是原本的收銀畫面）→ 2 確認明細/折扣 → 3 發票載具 → 4 付款 → 5 最後確認 → 開票後跳出收據 = 完成
  // 每一步都要符合條件才能按下一步；開票仍走原本的 confirmCheckout()，資料格式和一般模式完全相同。
  const guided = useGuidedCheckout()
  onMounted(loadGuidedCheckout)
  const guidedSteps = ['選商品', '確認明細', '發票載具', '付款', '確認結帳']
  const guidedStep  = ref(1)
  const guidedOpen  = computed(() => guided.value && guidedStep.value >= 2)

  const carrierChoices = [
    { value: 'paper',  icon: '🧾', label: '不用載具', hint: '印紙本證明聯給客人' },
    { value: 'mobile', icon: '📱', label: '手機條碼', hint: '/ 開頭 8 碼' },
    { value: 'cert',   icon: '🪪', label: '自然人憑證', hint: '2 英文 + 14 數字' },
  ] as const
  const carrierChoice = ref<'' | 'paper' | 'mobile' | 'cert'>('')
  const carrierCode   = ref('')
  const guidedCarrierInput = ref<HTMLInputElement | null>(null)
  const carrierNormalized = computed(() => carrierCode.value.replace(/\s/g, '').toUpperCase())
  const carrierValid = computed(() => {
    if (carrierChoice.value === 'mobile') return /^\/[0-9A-Z.+-]{7}$/.test(carrierNormalized.value)
    if (carrierChoice.value === 'cert')   return /^[A-Z]{2}[0-9]{14}$/.test(carrierNormalized.value)
    return carrierChoice.value === 'paper'
  })
  function pickCarrierChoice(v: '' | 'paper' | 'mobile' | 'cert') {
    if (carrierChoice.value !== v) carrierCode.value = ''
    carrierChoice.value = v
    if (v !== 'paper') nextTick(() => { if (guidedCarrierInput.value) guidedCarrierInput.value.focus() })
  }

  const paidConfirmed = ref(false)
  watch([total, curPay], () => { paidConfirmed.value = false })

  const cartCount = computed(() => cart.value.reduce((s, i) => s + i.qty, 0))
  const guidedStaffName = computed(() => {
    if (!curDiscount.value || !curDiscount.value.requireStaff || !selectedStaffId.value) return ''
    const e = employees.value.find(x => x.id === selectedStaffId.value)
    return e ? e.id + ' ' + e.name : selectedStaffId.value
  })
  // 要收的現金：純現金 = 應收；消費券 = 差額
  const guidedNeedCash = computed(() =>
          curPay.value === 'cash' || (curPay.value === 'voucher' && voucherAmount.value > 0 && !voucherExceeds.value && cashNeeded.value > 0)
  )
  const guidedCashDue = computed(() => curPay.value === 'voucher' ? cashNeeded.value : total.value)
  const guidedPayText = computed(() => {
    if (curPay.value === 'voucher') {
      return cashNeeded.value > 0 ? `消費券 $${voucherAmount.value} + 現金 $${cashNeeded.value}` : `消費券 $${voucherAmount.value}`
    }
    return PAY_LABEL[curPay.value] || curPay.value
  })

  // 這一步還不能往下走的原因（空字串 = 可以下一步）
  const guidedBlockReason = computed(() => {
    const s = guidedStep.value
    if (s >= 2) {
      if (!cart.value.length) return '還沒有任何品項'
      if (curDiscount.value && curDiscount.value.requireStaff && !selectedStaffId.value) return '這個折扣要先選擇員工'
      if (curDiscount.value && curDiscount.value.requireVip && !vipFound.value) return '這個折扣要先選擇 VIP'
    }
    if (s === 2) return ''
    if (s >= 3) {
      if (!carrierChoice.value) return '請選擇發票要不要存載具'
      if (!carrierValid.value) return carrierCode.value ? '載具條碼格式不對' : '請掃描或輸入載具條碼'
    }
    if (s === 3) return ''
    if (hasCashOnlyItem.value && curPay.value !== 'cash' && curPay.value !== 'voucher') return '含限現金品項，請改收現金'
    if (curPay.value === 'voucher') {
      if (!(voucherAmount.value > 0)) return '請輸入消費券面額'
      if (voucherExceeds.value) return '消費券面額超過應收金額'
    }
    if (guidedNeedCash.value) {
      if (!(receivedCash.value > 0)) return '請輸入收到的現金'
      if (change.value < 0) return `現金還差 $${Math.abs(change.value)}`
    }
    if ((curPay.value === 'card' || curPay.value === 'hua') && !paidConfirmed.value) return '請確認付款成功後打勾'
    return ''
  })

  function startGuided() {
    if (!cart.value.length) return
    if (!ensureCashier()) return // 要先選結帳人
    selectedStaffId.value = ''
    staffSearch.value = ''
    staffDept.value = ''
    vipInput.value = ''
    vipSearch.value = ''
    carrierChoice.value = ''
    carrierCode.value = ''
    paidConfirmed.value = false
    voucherAmount.value = 0
    receivedCash.value = 0
    if (hasCashOnlyItem.value && curPay.value !== 'cash' && curPay.value !== 'voucher') curPay.value = 'cash'
    guidedStep.value = 2
  }
  function cancelGuided() { guidedStep.value = 1 } // 購物車保留，回去加減商品
  function guidedBack() { guidedStep.value = guidedStep.value - 1 }
  function guidedNext() {
    if (guidedBlockReason.value || guidedStep.value >= guidedSteps.length) return
    guidedStep.value = guidedStep.value + 1
  }
  function guidedQty(i: number, d: number) {
    changeQty(i, d)
    if (!cart.value.length) guidedStep.value = 1
  }
  function guidedSetDiscount(d: DiscountType) {
    if (curDiscount.value && curDiscount.value.id === d.id) return
    setDiscount(d)
    selectedStaffId.value = ''
    vipInput.value = ''
    if (d.requireStaff) guidedPickStaff()
    else if (d.requireVip) guidedPickVip()
  }
  function guidedPickStaff() {
    staffSearch.value = ''
    staffDept.value = ''
    showStaffModal.value = true
  }
  function guidedPickVip() {
    vipSearch.value = ''
    showVipModal.value = true
  }
  function guidedSetPay(p: 'cash' | 'card' | 'hua' | 'voucher') {
    setPay(p)
    paidConfirmed.value = false
  }
  async function guidedConfirm() {
    if (guidedBlockReason.value || issuing.value) return
    carrier.value = carrierChoice.value === 'paper' ? '' : carrierNormalized.value
    await confirmCheckout()
    // 成功會清空購物車並跳出收據；失敗（已 alert）就停在這一步
    if (!cart.value.length) guidedStep.value = 1
  }
  // 關掉引導模式時順便收起畫面
  watch(guided, (v) => { if (!v) guidedStep.value = 1 })

  function finishOrder()  { showReceipt.value = false }
  function formatDate(d: Date) {
    return new Date(d).toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

</script>

<style>
  /* 開源中文字體 Noto Sans TC（SIL Open Font License），內嵌下載後不論電腦有沒有裝都會長一樣 */
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&display=swap');

  /* 螢幕上完全隱藏列印用收據 */
  #receipt-print { display: none; }

  @media print {
    /* 只顯示收據，其餘畫面（含 modal）全部隱藏 */
    body * { visibility: hidden; }
    #receipt-print, #receipt-print * { visibility: visible; }
    #receipt-print {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      /* 57.5mm 紙捲，印字區 52mm 置中（同舊系統 ESC W 設定的 416 dots） */
      width: 57.5mm;
      padding: 2mm 2.75mm 6mm;
      box-sizing: border-box;
      background: #fff;
    }
    @page { size: 57.5mm auto; margin: 0; }

    /* 印帳單時改成只顯示帳單 */
    body.print-bill #receipt-print { display: none; }
    body.print-bill #bill-print, body.print-bill #bill-print * { visibility: visible; }
    body.print-bill #bill-print {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 57.5mm;
      padding: 2mm 4.75mm 6mm;
      box-sizing: border-box;
      background: #fff;
    }
  }
  #bill-print { display: none; }
</style>
