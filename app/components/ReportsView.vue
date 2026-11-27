<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div>
        <h1 class="text-lg font-bold text-gray-900">{{ TITLES[props.section].title }}</h1>
        <p class="text-xs text-gray-400 mt-0.5">{{ TITLES[props.section].sub }}</p>
      </div>
      <!-- 每日 / 月 切換 -->
      <div class="flex flex-wrap items-center gap-3">
        <!-- 來源：葆光舊系統 / 本系統（電子發票、帳單瀏覽） -->
        <div v-if="props.section === 'invoices' || props.section === 'orders'" class="flex border border-gray-200 rounded-xl overflow-hidden">
          <button
            v-for="(o, i) in INV_SOURCES" :key="o.value"
            @click="invSource = o.value"
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="[invSource === o.value ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50', i ? 'border-l border-gray-200' : '']"
          >{{ o.label }}</button>
        </div>
        <div class="flex border border-gray-200 rounded-xl overflow-hidden">
          <button
            @click="mode = 'daily'"
            class="px-4 py-2 text-sm font-medium transition-colors"
            :class="mode === 'daily' ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
          >每日</button>
          <button
            @click="mode = 'monthly'"
            class="px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200"
            :class="mode === 'monthly' ? 'bg-green-700 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'"
          >月報</button>
        </div>
        <!-- 日期選擇 -->
        <PeriodPicker v-model:date="selectedDate" v-model:month="selectedMonth" :mode="mode" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5 space-y-4 md:space-y-5" :class="props.section !== 'summary' ? 'text-up' : ''">

      <template v-if="props.section === 'summary'">
      <!-- 統計卡 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div v-for="stat in stats" :key="stat.label" class="bg-white rounded-xl border border-gray-200 p-4">
          <div class="text-xs text-gray-400 mb-1">{{ stat.label }}</div>
          <div class="text-2xl font-bold" :class="stat.color">{{ stat.value }}</div>
        </div>
      </div>

      <!-- 各地點 + 付款方式 -->
      <div class="grid grid-cols-1 gap-4" :class="cashierStats.length ? 'md:grid-cols-3' : 'md:grid-cols-2'">
        <!-- 地點 -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">各地點營業額</h2>
          <div class="space-y-3">
            <div v-for="loc in locStats" :key="loc.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ loc.label }}</span>
                <span class="font-semibold text-gray-900">${{ loc.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ loc.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-green-500 transition-all" :style="{ width: loc.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 付款 -->
        <div class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">付款方式</h2>
          <div class="space-y-3">
            <div v-for="p in payStats" :key="p.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ p.icon }} {{ p.label }}</span>
                <span class="font-semibold text-gray-900">${{ p.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ p.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-blue-400 transition-all" :style="{ width: p.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 結帳人 -->
        <div v-if="cashierStats.length" class="bg-white rounded-xl border border-gray-200 p-5">
          <h2 class="text-sm font-semibold text-gray-700 mb-4">結帳人</h2>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <div v-for="c in cashierStats" :key="c.key">
              <div class="flex justify-between text-sm mb-1">
                <span class="text-gray-600">{{ c.label }}</span>
                <span class="font-semibold text-gray-900">${{ c.total.toLocaleString() }} <span class="text-xs text-gray-400 font-normal">{{ c.count }}筆</span></span>
              </div>
              <div class="bg-gray-100 rounded-full h-2">
                <div class="h-2 rounded-full bg-purple-400 transition-all" :style="{ width: c.pct + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      </template>
      <template v-if="props.section === 'invoices'">
      <!-- 電子發票（資料來自資料機，含平板同步來的） -->
      <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">電子發票</h2>
          <div class="flex items-center gap-3 text-xs">
            <label v-if="invoices.length" class="flex items-center gap-1 text-gray-500 cursor-pointer">
              <input v-model="invProblemsOnly" type="checkbox"> 只看還沒上傳 / 有問題的
            </label>
            <button class="text-green-700 hover:underline" :disabled="invLoading" @click="refreshAll">
              {{ invLoading ? '讀取中…' : '重新整理' }}
            </button>
            <button v-if="invoices.length" class="text-blue-600 hover:underline" :disabled="querying" @click="queryRange"
              title="向加值中心查這段期間已上傳發票的狀態（資料機每天也會自動查前一天的）">
              {{ querying ? '查詢中…' : '向加值中心查詢' }}
            </button>
          </div>
        </div>
        <div v-if="invError" class="px-5 py-4 text-sm text-amber-600">{{ invError }}</div>
        <template v-else>
          <div class="grid grid-cols-3 md:grid-cols-6 gap-3 px-5 py-4 border-b border-gray-100">
            <div v-for="s in invStats" :key="s.label">
              <div class="text-xs text-gray-400 mb-0.5">{{ s.label }}</div>
              <div class="text-lg font-bold" :class="s.color">{{ s.value }}</div>
            </div>
          </div>
          <div v-if="legacyCount" class="px-5 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
            其中 {{ legacyCount }} 張是葆光舊系統的發票（金額 ${{ legacyAmount.toLocaleString() }}，不含作廢），由舊系統上傳加值中心，這裡只供查詢。
          </div>
          <div v-if="legacyError && invSource !== 'new'" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
            資料機查不到葆光舊系統的資料庫（{{ legacyError }}），下面只列出新系統的發票和用 CSV 匯入過的。
          </div>
          <div v-if="legacyInvCachedAt && invSource === 'legacy'" class="px-5 py-1.5 text-xs text-gray-400 border-b border-gray-100">
            ⚡ 葆光發票是資料機 {{ legacyInvCachedAt.slice(11, 16) }} 暫存的結果，按「重新整理」會重查
          </div>
          <div v-if="!legacyError && legacyNote && invSource !== 'new'" class="px-5 py-2 text-xs text-gray-500 border-b border-gray-100">
            {{ legacyNote }}
          </div>
          <div v-if="invTruncated" class="px-5 py-2 text-xs text-amber-600">期間內發票太多，只列出前 5000 張</div>
          <div v-if="mockInvCount && invSource !== 'legacy'" class="px-5 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
            交易紀錄裡有 {{ mockInvCount }} 筆是「測試」號碼：結帳那台收銀機沒在系統設定啟用電子發票，號碼是網頁自己編的，
            沒有向資料機開立、不會上傳，所以不算在上面的開立張數。要開正式發票請到那台的系統設定 → 電子發票打開。
          </div>
          <div v-if="!shownInvoices.length" class="py-10 text-center text-gray-300 text-sm">
            {{ invLoading ? '讀取中…' : invProblemsOnly ? '沒有待處理的發票' : (mode === 'daily' ? '此日' : '此月') + (invSource === 'legacy' ? '沒有匯入的葆光發票' : '沒有開立發票') + (mockInvCount && invSource !== 'legacy' ? '（只有測試號碼）' : '') }}
          </div>
          <!-- 葆光：欄位照原系統 BK0220 帳務查詢 → 發票；用顏色 / emoji 分站別、付款方式，依日期分組 -->
          <div v-else-if="invSource === 'legacy'">
          <FitTable :watch-key="invRange.from + invSource" max-height="70vh">
            <table class="w-full text-xs whitespace-nowrap">
              <thead class="sticky top-0 z-10">
                <tr class="text-gray-400 border-b border-gray-200 bg-gray-50">
                  <th v-for="c in LEGACY_INV_COLS" :key="c.id" class="px-2.5 py-2.5 font-medium" :class="c.num ? 'text-right' : 'text-left'">{{ c.label }}</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="g in legacyInvGroups" :key="g.day">
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <td :colspan="LEGACY_INV_COLS.length" class="px-3 py-1.5 text-xs">
                      <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                      <span class="ml-3 text-gray-500">{{ g.count }} 張</span>
                      <span class="ml-2 font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                      <span v-if="g.voids" class="ml-2 text-red-600">作廢 {{ g.voids }}</span>
                    </td>
                  </tr>
                  <tr v-for="inv in g.rows" :key="inv.invoiceNo" class="border-b border-gray-100 hover:bg-gray-50"
                    :class="inv.cancelStatus === 'done' ? 'opacity-50' : ''">
                    <td v-for="c in LEGACY_INV_COLS" :key="c.id" class="px-2.5 py-2" :class="invCellCls(c, inv)">
                      <span v-if="c.id === 'void'">
                        <span v-if="inv.cancelStatus === 'done'" class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">作廢</span>
                      </span>
                      <span v-else-if="c.id === 'pay' && payTag(inv.payNote)" class="px-1.5 py-0.5 rounded" :class="payTag(inv.payNote)!.cls">{{ payTag(inv.payNote)!.text }}</span>
                      <span v-else-if="c.id === 'pos' && posTag(c.get(inv))" class="font-medium" :class="posTag(c.get(inv))!.cls" :title="c.get(inv)">{{ posTag(c.get(inv))!.text }}</span>
                      <span v-else :class="c.id === 'no' && inv.cancelStatus === 'done' ? 'line-through' : ''">{{ c.get(inv) }}</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
            <template #cards>
              <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <template v-for="g in legacyInvGroups" :key="g.day">
                  <div class="col-span-full flex items-baseline gap-3 pt-1 text-sm">
                    <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                    <span class="text-gray-500 text-xs">{{ g.count }} 張</span>
                    <span class="font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                    <span v-if="g.voids" class="text-xs text-red-600">作廢 {{ g.voids }}</span>
                  </div>
                  <div v-for="inv in g.rows" :key="inv.invoiceNo" class="bg-white border border-gray-200 rounded-xl p-3 text-xs"
                    :class="inv.cancelStatus === 'done' ? 'opacity-50 border-red-200' : ''">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="font-mono font-semibold text-sm text-gray-900" :class="inv.cancelStatus === 'done' ? 'line-through' : ''">{{ inv.invoiceNo }}</div>
                        <div class="text-gray-400 font-mono">🧾 {{ inv.orderNo || '—' }}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-lg font-bold tabular-nums text-gray-900 leading-tight" :class="inv.cancelStatus === 'done' ? 'line-through' : ''">${{ Number(inv.total).toLocaleString() }}</div>
                        <span v-if="inv.cancelStatus === 'done'" class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">作廢</span>
                      </div>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-1.5">
                      <span v-if="posTag(LEGACY_INV_POS(inv))" class="font-medium" :class="posTag(LEGACY_INV_POS(inv))!.cls">{{ posTag(LEGACY_INV_POS(inv))!.text }}</span>
                      <span v-if="payTag(inv.payNote)" class="px-1.5 py-0.5 rounded" :class="payTag(inv.payNote)!.cls">{{ payTag(inv.payNote)!.text }}</span>
                      <span v-if="inv.buyerId" class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">🏢 統編 {{ inv.buyerId }}</span>
                      <span v-if="Number(inv.sCharge)" class="text-gray-500">🛎️ 服務費 {{ Number(inv.sCharge).toLocaleString() }}</span>
                    </div>
                    <div class="mt-2 text-xs text-gray-400">
                      {{ [inv.seq || inv.legacySeq ? `序號 ${inv.seq || inv.legacySeq}` : '', inv.userId, inv.fileDate ? `建檔 ${inv.fileDate.slice(11, 19)}` : ''].filter(Boolean).join(' · ') }}
                    </div>
                  </div>
                </template>
              </div>
            </template>
          </FitTable>
            <div v-if="legacyInvRows.length > showLimit" class="py-3 text-center text-xs">
              <button class="text-green-700 hover:underline" @click="showLimit += PAGE">再顯示 {{ Math.min(PAGE, legacyInvRows.length - showLimit) }} 張（共 {{ legacyInvRows.length }} 張，已顯示 {{ showLimit }}）</button>
            </div>
          </div>
          <FitTable v-else :watch-key="invRange.from + invSource" max-height="70vh">
            <table class="w-full text-sm">
              <thead class="sticky top-0">
                <tr class="text-xs text-gray-400 border-b border-gray-200 bg-gray-50">
                  <th class="text-left px-5 py-2.5 font-medium">發票號碼</th>
                  <th class="text-left px-3 py-2.5 font-medium">開立時間</th>
                  <th class="text-left px-3 py-2.5 font-medium">收銀機</th>
                  <th class="text-left px-3 py-2.5 font-medium">狀態</th>
                  <th class="text-left px-3 py-2.5 font-medium">訊息</th>
                  <th class="text-left px-3 py-2.5 font-medium">加值中心查詢</th>
                  <th class="text-right px-5 py-2.5 font-medium">金額</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="g in newInvGroups" :key="g.day">
                  <tr class="bg-gray-50 border-b border-gray-200">
                    <td colspan="7" class="px-3 py-1.5 text-xs">
                      <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                      <span class="ml-3 text-gray-500">{{ g.count }} 張</span>
                      <span class="ml-2 font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                      <span v-if="g.voids" class="ml-2 text-red-600">作廢 {{ g.voids }}</span>
                    </td>
                  </tr>
                <tr v-for="inv in g.rows" :key="inv.invoiceNo" class="border-b border-gray-100 hover:bg-gray-50" :class="inv.cancelStatus === 'done' ? 'opacity-50' : ''">
                  <td class="px-5 py-2.5 font-mono font-semibold text-gray-900" :class="inv.cancelStatus === 'done' ? 'line-through' : ''">{{ formatInvoiceNo(inv.invoiceNo) }}</td>
                  <td class="px-3 py-2.5 text-gray-500 text-xs tabular-nums">⏰ {{ inv.issuedAt.slice(11, 16) }}</td>
                  <td class="px-3 py-2.5 text-gray-500 text-xs">{{ inv.station }}<span v-if="inv.fromTablet" class="ml-1 text-gray-400">(平板)</span><span v-if="inv.legacy && inv.orderNo" class="ml-1 text-gray-400 font-mono">{{ inv.orderNo }}</span></td>
                  <td class="px-3 py-2.5 text-xs">
                    <span class="px-1.5 py-0.5 rounded" :class="invState(inv).cls">{{ invState(inv).label }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-gray-400 text-xs max-w-[220px] truncate" :title="invState(inv).msg">{{ invState(inv).msg }}</td>
                  <td class="px-3 py-2.5 text-xs max-w-[200px]">
                    <div v-if="inv.queryResult" class="truncate text-gray-600" :title="`${inv.queryResult}（${inv.queryAt}）`">{{ inv.queryResult }}</div>
                    <button v-if="inv.uploadStatus === 'done' && !inv.fromTablet" class="text-blue-600 hover:underline" :disabled="queryingNo === inv.invoiceNo" @click="queryOne(inv)">
                      {{ queryingNo === inv.invoiceNo ? '查詢中…' : inv.queryResult ? '重查' : '查詢' }}
                    </button>
                  </td>
                  <td class="px-5 py-2.5 text-right font-bold tabular-nums" :class="inv.cancelStatus === 'done' ? 'text-gray-300 line-through' : 'text-gray-900'">${{ Number(inv.total).toLocaleString() }}</td>
                </tr>
                </template>
              </tbody>
            </table>
            <template #cards>
              <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <template v-for="g in newInvGroups" :key="g.day">
                  <div class="col-span-full flex items-baseline gap-3 pt-1 text-sm">
                    <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                    <span class="text-gray-500 text-xs">{{ g.count }} 張</span>
                    <span class="font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                    <span v-if="g.voids" class="text-xs text-red-600">作廢 {{ g.voids }}</span>
                  </div>
                <div v-for="inv in g.rows" :key="inv.invoiceNo" class="bg-white border border-gray-200 rounded-xl p-3 text-xs" :class="inv.cancelStatus === 'done' ? 'opacity-50 border-red-200' : ''">
                  <div class="flex items-start justify-between gap-2">
                    <span class="font-mono font-semibold text-sm text-gray-900" :class="inv.cancelStatus === 'done' ? 'line-through' : ''">{{ formatInvoiceNo(inv.invoiceNo) }}</span>
                    <span class="text-lg font-bold tabular-nums leading-tight" :class="inv.cancelStatus === 'done' ? 'text-gray-300 line-through' : 'text-gray-900'">${{ Number(inv.total).toLocaleString() }}</span>
                  </div>
                  <div class="mt-1 text-gray-500">⏰ {{ inv.issuedAt.slice(11, 16) }} · 🖥️ {{ inv.station }}<span v-if="inv.fromTablet" class="text-gray-400">(平板)</span></div>
                  <div class="mt-2 flex items-center gap-2">
                    <span class="px-1.5 py-0.5 rounded" :class="invState(inv).cls">{{ invState(inv).label }}</span>
                    <span class="text-gray-400 truncate" :title="invState(inv).msg">{{ invState(inv).msg }}</span>
                  </div>
                  <div v-if="inv.queryResult || (inv.uploadStatus === 'done' && !inv.fromTablet)" class="mt-1 flex items-center gap-2">
                    <span v-if="inv.queryResult" class="truncate text-gray-600" :title="`${inv.queryResult}（${inv.queryAt}）`">{{ inv.queryResult }}</span>
                    <button v-if="inv.uploadStatus === 'done' && !inv.fromTablet" class="text-blue-600 hover:underline shrink-0" :disabled="queryingNo === inv.invoiceNo" @click="queryOne(inv)">
                      {{ queryingNo === inv.invoiceNo ? '查詢中…' : inv.queryResult ? '重查' : '向加值中心查詢' }}
                    </button>
                  </div>
                </div>
                </template>
              </div>
            </template>
          </FitTable>
        </template>
      </div>

      </template>
      <template v-if="props.section === 'orders'">
      <!-- 帳單瀏覽：本系統 -->
      <div v-if="invSource !== 'legacy'" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">本系統帳單</h2>
          <div class="flex items-center gap-3 text-xs">
            <span v-if="ordersLoading" class="text-gray-400">讀取資料機中…</span>
            <span v-else-if="remoteOrders" class="text-gray-400">資料機</span>
            <span class="text-gray-400">{{ filteredOrders.length }} 筆</span>
            <button class="text-green-700 hover:underline" :disabled="ordersLoading" @click="refreshAll">重新整理</button>
          </div>
        </div>
        <div v-if="ordersError" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
          讀不到資料機的交易紀錄，只顯示這台這次開網頁後的交易（{{ ordersError }}）
        </div>
        <div v-if="ordersOffline" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">{{ ordersOffline }}</div>
        <div v-if="pendingCount" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
          這台還有 {{ pendingCount }} 筆交易還沒送到資料機，連上後會自動補送
        </div>
        <div v-if="!filteredOrders.length" class="py-16 text-center text-gray-300 text-sm">
          {{ mode === 'daily' ? '此日' : '此月' }}尚無交易紀錄
        </div>
        <FitTable v-else :watch-key="invRange.from + invSource">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-xs text-gray-400 border-b border-gray-200 bg-gray-50">
                <th class="text-left px-5 py-2.5 font-medium">單號</th>
                <th class="text-left px-3 py-2.5 font-medium">時間</th>
                <th class="text-left px-3 py-2.5 font-medium">地點</th>
                <th class="text-left px-3 py-2.5 font-medium">品項</th>
                <th class="text-left px-3 py-2.5 font-medium">付款</th>
                <th class="text-left px-3 py-2.5 font-medium">員工／VIP・折扣</th>
                <th class="text-left px-3 py-2.5 font-medium">結帳人</th>
                <th class="text-left px-3 py-2.5 font-medium">發票</th>
                <th class="text-right px-5 py-2.5 font-medium">金額</th>
                <th class="text-right px-5 py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="g in newOrderGroups" :key="g.day">
                <tr class="bg-gray-50 border-b border-gray-200">
                    <td colspan="10" class="px-3 py-1.5 text-xs">
                      <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                      <span class="ml-3 text-gray-500">{{ g.count }} 張</span>
                      <span class="ml-2 font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                      <span v-if="g.voids" class="ml-2 text-red-600">作廢 {{ g.voids }}</span>
                    </td>
                  </tr>
              <tr v-for="order in g.rows" :key="order.clientId || order.id" class="border-b border-gray-100 hover:bg-gray-50"
                :class="order.voided ? 'opacity-50' : ''">
                <td class="px-5 py-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                  <span :class="order.voided ? 'line-through' : ''">{{ order.no }}</span>
                  <span v-if="order.voided" class="ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700" :title="order.voidReason">已刪除</span>
                  <span v-else-if="order.edits?.length" class="ml-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 cursor-help" :title="editHistory(order)">已修改</span>
                  <div v-if="order.note" class="text-xs text-gray-400 font-normal max-w-[180px] truncate" :title="order.note">{{ order.note }}</div>
                </td>
                <td class="px-3 py-3 text-gray-500 text-xs">{{ formatTime(order.createdAt) }}</td>
                <td class="px-3 py-3">
                  <span class="text-xs px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-green-100 text-green-700': order.location === 'restaurant',
                      'bg-blue-100 text-blue-700':   order.location === 'shop',
                      'bg-amber-100 text-amber-700':  order.location === 'stall',
                    }">{{ order.location ? stationLabel(order.location) : '未指定站' }}</span>
                </td>
                <td class="px-3 py-3 text-gray-600 text-xs max-w-[160px] truncate">
                  {{ order.items.map(i => i.name).join('、') }}
                </td>
                <td class="px-3 py-3 text-xs whitespace-nowrap">
                  <span v-if="payTag(PAY_LABEL[order.payMethod])" class="px-1.5 py-0.5 rounded" :class="payTag(PAY_LABEL[order.payMethod])!.cls">{{ payTag(PAY_LABEL[order.payMethod])!.text }}</span>
                </td>
                <td class="px-3 py-3 text-xs whitespace-nowrap">
                  <template v-if="buyerOf(order) || order.discountLabel">
                    <span v-if="buyerOf(order)" class="px-1.5 py-0.5 rounded mr-1"
                      :class="order.staffId ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'">{{ buyerOf(order) }}</span>
                    <span v-if="order.discountLabel" class="text-gray-500">{{ order.discountLabel }}</span>
                  </template>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-3 py-3 text-gray-500 text-xs whitespace-nowrap">{{ order.cashierName || '—' }}</td>
                <td class="px-3 py-3 text-xs whitespace-nowrap">
                  <template v-if="orderInv(order)">
                    <span class="font-mono text-gray-700">{{ orderInv(order)!.no }}</span>
                    <span class="ml-1 px-1.5 py-0.5 rounded" :class="orderInv(order)!.cls">{{ orderInv(order)!.label }}</span>
                  </template>
                  <span v-else class="text-gray-300">—</span>
                </td>
                <td class="px-5 py-3 text-right font-bold text-base tabular-nums text-gray-900" :class="order.voided ? 'line-through' : ''">${{ order.total.toLocaleString() }}</td>
                <td class="px-5 py-3 text-right text-xs whitespace-nowrap">
                  <template v-if="!order.voided">
                    <button class="text-blue-600 hover:underline mr-3" @click="openEdit(order)">編輯</button>
                    <button class="text-red-600 hover:underline" @click="openDelete(order)">刪除</button>
                  </template>
                  <button v-else-if="order.edits?.length" class="text-gray-500 hover:underline" @click="showHistory(order)">紀錄</button>
                </td>
              </tr>
              </template>
            </tbody>
          </table>
          <template #cards>
            <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <template v-for="g in newOrderGroups" :key="g.day">
                <div class="col-span-full flex items-baseline gap-3 pt-1 text-sm">
                    <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                    <span class="text-gray-500 text-xs">{{ g.count }} 張</span>
                    <span class="font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                    <span v-if="g.voids" class="text-xs text-red-600">作廢 {{ g.voids }}</span>
                  </div>
              <div v-for="order in g.rows" :key="order.clientId || order.id" class="bg-white border border-gray-200 rounded-xl p-3 text-xs" :class="order.voided ? 'opacity-50 border-red-200' : ''">
                <div class="flex items-start justify-between gap-2">
                  <span class="font-mono font-semibold text-sm text-gray-900">
                    <span :class="order.voided ? 'line-through' : ''">{{ order.no }}</span>
                    <span v-if="order.voided" class="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-normal" :title="order.voidReason">已刪除</span>
                    <span v-else-if="order.edits?.length" class="ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-normal" :title="editHistory(order)">已修改</span>
                  </span>
                  <span class="text-lg font-bold text-gray-900 tabular-nums leading-tight" :class="order.voided ? 'line-through' : ''">${{ order.total.toLocaleString() }}</span>
                </div>
                <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-500">
                  <span>⏰ {{ formatTime(order.createdAt) }}</span>
                  <span class="px-2 py-0.5 rounded-full"
                    :class="{
                      'bg-green-100 text-green-700': order.location === 'restaurant',
                      'bg-blue-100 text-blue-700':   order.location === 'shop',
                      'bg-amber-100 text-amber-700':  order.location === 'stall',
                    }">{{ order.location ? stationLabel(order.location) : '未指定站' }}</span>
                  <span v-if="payTag(PAY_LABEL[order.payMethod])" class="px-1.5 py-0.5 rounded" :class="payTag(PAY_LABEL[order.payMethod])!.cls">{{ payTag(PAY_LABEL[order.payMethod])!.text }}</span>
                  <span v-if="order.cashierName">🧑‍💼 {{ order.cashierName }}</span>
                </div>
                <div class="mt-1 text-gray-600 line-clamp-2">{{ order.items.map(i => i.name).join('、') }}</div>
                <div v-if="buyerOf(order) || order.discountLabel" class="mt-1">
                  <span v-if="buyerOf(order)" class="px-1.5 py-0.5 rounded mr-1" :class="order.staffId ? 'bg-purple-100 text-purple-700' : 'bg-pink-100 text-pink-700'">{{ buyerOf(order) }}</span>
                  <span v-if="order.discountLabel" class="text-gray-500">{{ order.discountLabel }}</span>
                </div>
                <div v-if="order.note" class="mt-1 text-gray-400">{{ order.note }}</div>
                <div class="mt-2 flex items-center justify-between gap-2">
                  <span v-if="orderInv(order)">
                    <span class="font-mono text-gray-700">{{ orderInv(order)!.no }}</span>
                    <span class="ml-1 px-1.5 py-0.5 rounded" :class="orderInv(order)!.cls">{{ orderInv(order)!.label }}</span>
                  </span>
                  <span v-else class="text-gray-300">沒有發票</span>
                  <span class="whitespace-nowrap">
                    <template v-if="!order.voided">
                      <button class="text-blue-600 hover:underline mr-3" @click="openEdit(order)">編輯</button>
                      <button class="text-red-600 hover:underline" @click="openDelete(order)">刪除</button>
                    </template>
                    <button v-else-if="order.edits?.length" class="text-gray-500 hover:underline" @click="showHistory(order)">紀錄</button>
                  </span>
                </div>
              </div>
              </template>
            </div>
          </template>
        </FitTable>
      </div>

      <!-- 帳單瀏覽：葆光舊系統（BK0220 帳務查詢 → 帳單瀏覽，資料機 print-agent 1.20 直查 OCHECK） -->
      <div v-if="invSource !== 'new'" class="bg-white rounded-xl border border-gray-200 overflow-hidden" :class="invSource === 'all' ? 'mt-4' : ''">
        <div class="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-gray-700">葆光帳單</h2>
          <div class="flex items-center gap-3 text-xs">
            <span v-if="legacyLoading" class="text-gray-400">讀取葆光資料庫中…</span>
            <span class="text-gray-400">{{ legacyLive.length }} 張{{ legacyVoidCount ? `（另 ${legacyVoidCount} 張作廢）` : '' }}</span>
            <span v-if="legacyChecksCachedAt" class="text-gray-400" title="資料機上暫存的結果，按「重新整理」會重查葆光資料庫">⚡ 暫存 {{ legacyChecksCachedAt.slice(11, 16) }}</span>
            <button class="text-green-700 hover:underline" :disabled="legacyLoading" @click="loadLegacyChecks(true)">重新整理</button>
          </div>
        </div>
        <div v-if="legacyChecksError" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">
          讀不到葆光舊系統的帳單（{{ legacyChecksError }}）
        </div>
        <div v-if="legacyTruncated" class="px-5 py-2 text-xs text-amber-600 border-b border-gray-100">帳單太多，只列出前 5000 張</div>
        <div v-if="!legacyChecks.length" class="py-16 text-center text-gray-300 text-sm">
          {{ legacyLoading ? '讀取中…' : (mode === 'daily' ? '此日' : '此月') + '沒有葆光帳單' }}
        </div>
        <div v-else>
        <!-- 合計：每種金額一張小卡，有 emoji 與色條，0 的不顯示 -->
        <div class="px-4 pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
          <div v-for="s in legacySumCards" :key="s.key" class="bg-gray-50 rounded-lg px-3 py-2 border-l-4" :class="s.bar">
            <div class="text-gray-500">{{ s.emoji }} {{ s.label }}</div>
            <div class="font-bold tabular-nums" :class="s.main ? 'text-lg text-green-700' : 'text-sm text-gray-800'">{{ s.value.toLocaleString() }}</div>
          </div>
        </div>
        <FitTable :watch-key="invRange.from + invSource" class="mt-3">
          <table class="w-full text-xs whitespace-nowrap">
            <thead>
              <tr class="text-gray-400 border-b border-gray-200 bg-gray-50">
                <th v-for="c in LEGACY_COLS" :key="c.key" class="px-2.5 py-2.5 font-medium" :class="c.num ? 'text-right' : 'text-left'">{{ c.label }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="g in legacyCheckGroups" :key="g.day">
                <tr class="bg-gray-50 border-b border-gray-200">
                  <td :colspan="LEGACY_COLS.length" class="px-3 py-1.5 text-xs">
                    <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                    <span class="ml-3 text-gray-500">{{ g.count }} 張</span>
                    <span class="ml-2 font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                    <span v-if="g.voids" class="ml-2 text-red-600">作廢 {{ g.voids }}</span>
                  </td>
                </tr>
                <tr v-for="c in g.rows" :key="c.CheckNo + c.opDate" class="border-b border-gray-100 hover:bg-gray-50"
                  :class="c.DelMark ? 'opacity-50' : ''">
                  <td v-for="col in LEGACY_COLS" :key="col.key" class="px-2.5 py-2" :class="chkCellCls(col, c)">
                    <span v-if="col.key === 'CheckNo'">
                      <span :class="c.DelMark ? 'line-through' : ''">{{ c.CheckNo }}</span>
                      <span v-if="c.DelMark" class="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold font-sans">作廢</span>
                    </span>
                    <span v-else-if="col.key === 'POSID' && posTag(c.POSID)" class="font-medium" :class="posTag(c.POSID)!.cls" :title="c.POSID">{{ posTag(c.POSID)!.text }}</span>
                    <span v-else-if="col.key === 'PayType'" class="inline-flex gap-1">
                      <span v-for="p in checkPays(c)" :key="p.text" class="px-1.5 py-0.5 rounded" :class="p.cls">{{ p.text }}</span>
                      <span v-if="!checkPays(c).length" class="text-gray-300">{{ c.PayType || '—' }}</span>
                    </span>
                    <span v-else>{{ legacyCell(c, col) }}</span>
                  </td>
                </tr>
              </template>
              <tr class="bg-gray-50 font-semibold text-gray-800">
                <td v-for="(col, i) in LEGACY_COLS" :key="col.key" class="px-2.5 py-2" :class="col.num ? 'text-right tabular-nums' : ''">
                  {{ i === 0 ? '合計（不含作廢）' : col.num && col.key !== 'RNo' ? legacySum(col.key).toLocaleString() : '' }}
                </td>
              </tr>
            </tbody>
          </table>
          <template #cards>
            <div class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <template v-for="g in legacyCheckGroups" :key="g.day">
                <div class="col-span-full flex items-baseline gap-3 pt-1 text-sm">
                  <span class="font-semibold text-gray-800">📅 {{ dayLabel(g.day) }}</span>
                  <span class="text-gray-500 text-xs">{{ g.count }} 張</span>
                  <span class="font-semibold text-green-700 tabular-nums">${{ g.total.toLocaleString() }}</span>
                  <span v-if="g.voids" class="text-xs text-red-600">作廢 {{ g.voids }}</span>
                </div>
                <div v-for="c in g.rows" :key="c.CheckNo + c.opDate" class="bg-white border border-gray-200 rounded-xl p-3 text-xs"
                  :class="c.DelMark ? 'opacity-50 border-red-200' : ''">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="font-mono font-semibold text-sm text-gray-900" :class="c.DelMark ? 'line-through' : ''">{{ c.CheckNo }}</div>
                      <div class="mt-0.5 flex items-center gap-2 text-gray-500">
                        <span v-if="posTag(c.POSID)" class="font-medium" :class="posTag(c.POSID)!.cls">{{ posTag(c.POSID)!.text }}</span>
                        <span v-if="c.BillTime">⏰ {{ c.BillTime }}</span>
                        <span v-if="Number(c.CustTotal)">👥 {{ c.CustTotal }} 位</span>
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-lg font-bold tabular-nums text-gray-900 leading-tight" :class="c.DelMark ? 'line-through' : ''">${{ Number(c.CheckAmt || 0).toLocaleString() }}</div>
                      <span v-if="c.DelMark" class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">作廢</span>
                    </div>
                  </div>
                  <div v-if="checkPays(c).length" class="mt-2 flex flex-wrap gap-1.5">
                    <span v-for="p in checkPays(c)" :key="p.text" class="px-1.5 py-0.5 rounded" :class="p.cls">{{ p.text }} {{ p.amt.toLocaleString() }}</span>
                  </div>
                  <div v-if="c.VIPNo || c.Remark || c.CustNo" class="mt-2 text-sm text-gray-800">
                    <span v-if="c.VIPNo">👤 {{ c.VIPNo }}</span>
                    <span v-if="c.CustNo" class="ml-2 text-xs text-gray-500">🏢 {{ c.CustNo }}</span>
                    <div v-if="c.Remark" class="text-xs text-gray-500">📝 {{ c.Remark }}</div>
                  </div>
                  <div v-if="checkExtras(c).length" class="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500">
                    <span v-for="x in checkExtras(c)" :key="x.label" :class="x.red ? 'text-red-600' : ''">{{ x.label }} {{ x.value }}</span>
                  </div>
                  <div class="mt-2 text-xs text-gray-400">
                    {{ [c.RNo ? `序號 ${c.RNo}` : '', c.ShiftID ? `班別 ${c.ShiftID}` : '', c.UserID, c.fileDate ? `建檔 ${c.fileDate.slice(11, 19)}` : ''].filter(Boolean).join(' · ') }}
                  </div>
                </div>
              </template>
            </div>
          </template>
        </FitTable>
            <div v-if="legacyChecks.length > showLimit" class="py-3 text-center text-xs">
              <button class="text-green-700 hover:underline" @click="showLimit += PAGE">再顯示 {{ Math.min(PAGE, legacyChecks.length - showLimit) }} 張（共 {{ legacyChecks.length }} 張，已顯示 {{ showLimit }}）</button>
            </div>
        </div>
      </div>

      </template>
    <!-- 編輯交易 -->
    <div v-if="editing" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" @click.self="editing = null">
      <div class="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-base font-bold text-gray-900">編輯交易 {{ editing.no }}</h2>
          <p class="text-xs text-gray-400 mt-0.5">金額、品項、發票不能改；要改請刪除這筆再重新結帳。修改會留下紀錄（誰、何時、改了什麼）。</p>
        </div>
        <div class="px-5 py-4 space-y-3 text-sm">
          <label class="block">
            <span class="text-xs text-gray-500">付款方式</span>
            <select v-model="form.payMethod" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option v-for="(label, key) in PAY_LABEL" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">地點</span>
            <select v-model="form.location" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">未指定站</option>
              <option v-for="st in stations" :key="st.id" :value="st.id">{{ st.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">結帳人</span>
            <select v-model="form.cashierId" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">（無）</option>
              <option v-for="e in employeeOptions(form.cashierId)" :key="e.id" :value="e.id">{{ e.name }}（{{ e.id }}）</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">員工購買（員工價）</span>
            <select v-model="form.staffId" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" @change="form.staffId && (form.vipId = '')">
              <option value="">（不是員工）</option>
              <option v-for="e in employeeOptions(form.staffId)" :key="e.id" :value="e.id">{{ e.name }}（{{ e.id }}）</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">VIP 購買</span>
            <select v-model="form.vipId" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 bg-white" @change="form.vipId && (form.staffId = '')">
              <option value="">（不是 VIP）</option>
              <option v-for="v in vipOptions(form.vipId)" :key="v.id" :value="v.id">{{ v.name }}（{{ v.id }}）</option>
            </select>
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">備註</span>
            <input v-model="form.note" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" placeholder="例：客人改刷卡">
          </label>
          <label class="block">
            <span class="text-xs text-gray-500">修改原因（必填）</span>
            <input v-model="form.reason" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" placeholder="例：結帳時按錯付款方式">
          </label>
          <p class="text-xs text-gray-400">修改人：{{ editorName }}</p>
          <p v-if="editError" class="text-xs text-red-600">{{ editError }}</p>
        </div>
        <div class="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600" @click="editing = null">取消</button>
          <button class="px-4 py-2 rounded-xl bg-green-700 text-white disabled:opacity-50" :disabled="saving" @click="saveEdit">{{ saving ? '儲存中…' : '儲存' }}</button>
        </div>
      </div>
    </div>

    <!-- 刪除交易 -->
    <div v-if="deleting" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3" @click.self="deleting = null">
      <div class="bg-white rounded-2xl w-full max-w-md">
        <div class="px-5 py-4 border-b border-gray-100">
          <h2 class="text-base font-bold text-gray-900">刪除交易 {{ deleting.no }}（${{ deleting.total.toLocaleString() }}）</h2>
          <p class="text-xs text-gray-400 mt-0.5">刪除後不算進營業額，但資料機會保留原始紀錄與刪除紀錄，交易紀錄頁仍看得到（劃線）。</p>
        </div>
        <div class="px-5 py-4 space-y-3 text-sm">
          <div v-if="realInvoice(deleting)" class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            這筆有開正式電子發票 {{ deleting.invoiceNo }}，刪除時會<b>同時作廢這張發票</b>（向加值中心作廢）。作廢失敗就不會刪除。
          </div>
          <label class="block">
            <span class="text-xs text-gray-500">刪除原因（必填）</span>
            <input v-model="form.reason" class="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2" placeholder="例：客人退貨、重複結帳">
          </label>
          <p class="text-xs text-gray-400">刪除人：{{ editorName }}</p>
          <p v-if="editError" class="text-xs text-red-600">{{ editError }}</p>
        </div>
        <div class="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600" @click="deleting = null">取消</button>
          <button class="px-4 py-2 rounded-xl bg-red-600 text-white disabled:opacity-50" :disabled="saving" @click="confirmDelete">{{ saving ? '處理中…' : realInvoice(deleting) ? '作廢發票並刪除' : '刪除' }}</button>
        </div>
      </div>
    </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { LOC_LABEL, PAY_LABEL, type Order } from '~/composables/usePosStore'
// 營業報表 / 電子發票 / 交易紀錄三頁共用這個元件（pages/reports.vue、invoices.vue、transactions.vue），只差顯示哪一塊
const props = withDefaults(defineProps<{ section?: 'summary' | 'invoices' | 'orders' }>(), { section: 'summary' })
const TITLES = {
  summary:  { title: '營業報表', sub: '營業額、各地點、付款方式與結帳人統計' },
  invoices: { title: '電子發票', sub: '資料機上開立的發票與上傳 / 作廢狀態' },
  orders:   { title: '帳單瀏覽', sub: '各收銀機、平板與葆光舊系統的每一張帳單' },
} as const
import PeriodPicker from '~/components/PeriodPicker.vue'
import FitTable from '~/components/FitTable.vue'
import { listEInvoices, cancelEInvoice, formatInvoiceNo, queryEInvoice, queryEInvoiceRange, type InvoiceRecord } from '~/utils/einvoiceApi'
import { listOrders, pendingOrders, editOrder, listLegacyChecks, type LegacyCheck } from '~/utils/ordersApi'

const { orders, stations, stationLabel, employees, vipMembers } = usePosStore()
// 員工價 / VIP 價是誰買的：新訂單有存姓名；舊訂單只有編號，用目前名單補姓名
function buyerOf(o: Order) {
  if (o.staffId) return `員工 ${o.staffName || employees.value.find(e => e.id === o.staffId)?.name || o.staffId}`
  if (o.vipId) return `VIP ${o.vipName || vipMembers.value.find(v => v.id === o.vipId)?.name || o.vipId}`
  return ''
}

const mode = ref<'daily' | 'monthly'>('monthly') // 預設月報（卡爾 11/27）

// 一律用本機（台灣）日期；toISOString 是 UTC，早上 8 點前的單會算到前一天
const pad2 = (n: number) => String(n).padStart(2, '0')
const localYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// 預設今天
const todayStr = localYmd(new Date())
const selectedDate = ref(todayStr)

// 預設本月（選擇器在 components/PeriodPicker.vue）
const selectedMonth = ref(todayStr.slice(0, 7))

// ── 交易紀錄：以資料機為準（各收銀機、平板同步來的都在）；這台還沒送出的也一起列；讀不到資料機才只看這台 ──
const remoteOrders = ref<Order[] | null>(null)
const ordersError = ref('')
const ordersOffline = ref('')
const ordersLoading = ref(false)
let ordersSeq = 0
async function loadOrders() {
  const seq = ++ordersSeq
  const { from, to } = invRange.value
  ordersLoading.value = true
  const r = await listOrders(from, to)
  if (seq !== ordersSeq) return
  ordersLoading.value = false
  if (r.ok) {
    remoteOrders.value = r.orders.map((o, i) => ({ ...o, id: -(i + 1), createdAt: new Date(o.createdAt) }) as unknown as Order)
    ordersError.value = ''
    ordersOffline.value = r.offline ? `平板目前連不到資料機，先顯示這台平板上的紀錄（${r.offlineReason ?? ''}）` : ''
  } else {
    remoteOrders.value = null
    ordersError.value = r.message
    ordersOffline.value = ''
  }
}
const pendingCount = ref(0)
// 只抓目前畫面要用的資料（帳單瀏覽選葆光時不用抓本系統交易和發票；發票頁選葆光時不用抓交易）。
// 同一個期間抓過就不重抓，切換葆光 / 本系統是即時的；按「重新整理」或換日期才重抓。
const loadedKey = { orders: '', invoices: '', legacy: '' }
function ensureLoaded(force = false) {
  const { from, to } = invRange.value
  const key = `${from}|${to}`
  const need = (k: keyof typeof loadedKey) => { if (!force && loadedKey[k] === key) return false; loadedKey[k] = key; return true }
  const sec = props.section
  const wantOrders = sec === 'summary' || invSource.value === 'new'
  const wantInvoices = sec === 'summary' || sec === 'invoices' || (sec === 'orders' && invSource.value === 'new')
  const wantLegacy = sec === 'orders' && invSource.value === 'legacy'
  if (wantOrders && need('orders')) { pendingCount.value = pendingOrders(); void loadOrders() }
  if (wantInvoices && need('invoices')) void loadInvoices(force)
  if (wantLegacy && need('legacy')) void loadLegacyChecks(force)
}
function refreshAll() { ensureLoaded(true) }

// ── 帳單瀏覽：葆光舊系統帳單（資料機 print-agent 1.20 直查 BKSQL.dbo.OCHECK，欄位照 BK0220 帳單瀏覽） ──
const legacyChecks = ref<LegacyCheck[]>([])
const legacyChecksError = ref('')
const legacyTruncated = ref(false)
const legacyLoading = ref(false)
let legacySeq = 0
const legacyChecksCachedAt = ref('') // 資料機回的是暫存結果時，暫存的時間（print-agent 1.23）
async function loadLegacyChecks(refresh = false) {
  const seq = ++legacySeq
  const { from, to } = invRange.value
  if (!from || !to) return
  legacyLoading.value = true
  const r = await listLegacyChecks(from, to, refresh)
  if (seq !== legacySeq) return
  legacyLoading.value = false
  if (r.ok) {
    legacyChecks.value = r.checks
    legacyTruncated.value = r.truncated
    legacyChecksCachedAt.value = r.cached && r.cachedAt ? r.cachedAt : ''
    legacyChecksError.value = ''
  } else {
    legacyChecks.value = []
    legacyTruncated.value = false
    legacyChecksError.value = r.message
  }
}
type LegacyCol = { key: keyof LegacyCheck; label: string; num?: boolean }
const LEGACY_COLS: LegacyCol[] = [
  { key: 'opDate', label: '營業日期' },
  { key: 'ShiftID', label: '班別' },
  { key: 'CheckNo', label: '帳單號碼' },
  { key: 'BillTime', label: '收款' },
  { key: 'CustTotal', label: '客數', num: true },
  { key: 'OrderAmt', label: '小計', num: true },
  { key: 'Service', label: '服務費', num: true },
  { key: 'Tax', label: '加項', num: true },
  { key: 'Discount', label: '折扣額', num: true },
  { key: 'DeductAmt', label: '抵扣額', num: true },
  { key: 'CheckAmt', label: '結帳金額', num: true },
  { key: 'CashAmt', label: '現金', num: true },
  { key: 'PayType', label: '付款別' },
  { key: 'CustNo', label: '客戶編號' },
  { key: 'PayAmt1', label: '信用卡', num: true },
  { key: 'PayAmt2', label: '宅配代收', num: true },
  { key: 'PayAmt3', label: '宅配匯款', num: true },
  { key: 'PayAmt4', label: '機關簽帳', num: true },
  { key: 'UserID', label: '作業人員' },
  { key: 'POSID', label: 'POSID' },
  { key: 'Remark', label: '備註說明' },
  { key: 'VIPNo', label: '會員編號' }, // 原系統這欄常拿來寫客人姓名或備註
  { key: 'fileDate', label: '建檔時間' },
  { key: 'updDate', label: '更修時間' },
  { key: 'RNo', label: '序號', num: true },
]
function legacyCell(c: LegacyCheck, col: LegacyCol) {
  const v = c[col.key]
  if (col.key === 'opDate') return String(v).replace(/-/g, '/')
  if (col.key === 'fileDate' || col.key === 'updDate') return String(v ?? '').replace(/-/g, '/')
  if (col.key === 'RNo') return String(v ?? '')
  if (col.key === 'POSID') return c.posName ? `${c.POSID} ${c.posName}` : c.POSID
  if (col.num) return Number(v || 0).toLocaleString()
  return v === '' || v == null ? '' : String(v)
}
const legacyLive = computed(() => legacyChecks.value.filter(c => !c.DelMark))
const legacyVoidCount = computed(() => legacyChecks.value.length - legacyLive.value.length)
const legacySum = (k: keyof LegacyCheck) => legacyLive.value.reduce((s, c) => s + Number(c[k] || 0), 0)

// ── 辨識度：站別、付款方式固定顏色與 emoji（帳單、發票、表格、卡片都一樣），日期分組 ──
const WEEK_ZH = ['日', '一', '二', '三', '四', '五', '六']
function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  if (!y || !m || !d) return day || '沒有日期'
  return `${m}/${d}（${WEEK_ZH[new Date(y, m - 1, d).getDay()]}）`
}
const POS_STYLE: Record<string, { emoji: string; name: string; cls: string }> = {
  '001': { emoji: '🛍️', name: '小舖', cls: 'text-blue-700' },
  '002': { emoji: '🍽️', name: '餐廳', cls: 'text-green-700' },
  '003': { emoji: '🧺', name: '市集', cls: 'text-amber-700' },
}
function posTag(pos?: string) {
  const p = (pos || '').trim().split(' ')[0] ?? ''
  const s = POS_STYLE[p]
  if (s) return { text: `${s.emoji} ${s.name}`, cls: s.cls }
  return p ? { text: p, cls: 'text-gray-600' } : null
}
const PAY_STYLE: [RegExp, string, string][] = [
  [/現/, '💵', 'bg-green-100 text-green-700'],
  [/信用卡|刷卡/, '💳', 'bg-blue-100 text-blue-700'],
  [/電子|LINE|街口|PAY/i, '📱', 'bg-purple-100 text-purple-700'],
  [/代收/, '📦', 'bg-pink-100 text-pink-700'],
  [/匯款/, '🏦', 'bg-amber-100 text-amber-700'],
  [/簽帳/, '🏛️', 'bg-gray-100 text-gray-700'],
  [/Q收|華南/, '📱', 'bg-purple-100 text-purple-700'],
  [/券/, '🎟️', 'bg-pink-100 text-pink-700'],
]
function payTag(text?: string) {
  const t = (text || '').trim()
  if (!t) return null
  const m = PAY_STYLE.find(([re]) => re.test(t))
  return { text: `${m?.[1] ?? '🧾'} ${t}`, cls: m?.[2] ?? 'bg-gray-100 text-gray-600' }
}
// 葆光帳單的付款別是代碼（1、3、4…），改用各付款欄位有沒有金額來顯示
const CHECK_PAY_FIELDS: [keyof LegacyCheck, string][] = [
  ['CashAmt', '現金'], ['PayAmt1', '信用卡'], ['PayAmt2', '宅配代收'], ['PayAmt3', '宅配匯款'], ['PayAmt4', '機關簽帳'],
]
function checkPays(c: LegacyCheck) {
  return CHECK_PAY_FIELDS.filter(([k]) => Number(c[k])).map(([k, label]) => ({ ...payTag(label)!, amt: Number(c[k]) }))
}
function checkExtras(c: LegacyCheck) {
  const r: { label: string; value: string; red?: boolean }[] = []
  const add = (k: keyof LegacyCheck, label: string, red = false) => { if (Number(c[k])) r.push({ label, value: Number(c[k]).toLocaleString(), red }) }
  add('OrderAmt', '小計'); add('Service', '服務費'); add('Tax', '加項'); add('Discount', '折扣', true); add('DeductAmt', '抵扣', true)
  return r
}
const MUTED_CHECK_COLS = new Set(['opDate', 'ShiftID', 'UserID', 'fileDate', 'updDate', 'RNo'])
function chkCellCls(col: LegacyCol, c: LegacyCheck) {
  if (col.key === 'CheckAmt') return 'text-right tabular-nums font-bold text-sm text-gray-900'
  if (col.key === 'CheckNo') return 'font-mono font-semibold text-gray-900'
  if (col.key === 'VIPNo') return 'text-gray-800'
  if (MUTED_CHECK_COLS.has(col.key as string)) return (col.num ? 'text-right ' : '') + 'text-gray-400'
  if (col.num) {
    const v = Number(c[col.key] || 0)
    if (!v) return 'text-right tabular-nums text-gray-300'
    return 'text-right tabular-nums ' + (col.key === 'Discount' || col.key === 'DeductAmt' ? 'text-red-600' : 'text-gray-700')
  }
  return 'text-gray-600'
}
const LEGACY_SUM_DEFS: { key: keyof LegacyCheck; label: string; emoji: string; bar: string; main?: boolean }[] = [
  { key: 'CheckAmt', label: '結帳金額', emoji: '💰', bar: 'border-green-600', main: true },
  { key: 'OrderAmt', label: '小計', emoji: '🧾', bar: 'border-gray-400' },
  { key: 'CashAmt', label: '現金', emoji: '💵', bar: 'border-green-400' },
  { key: 'PayAmt1', label: '信用卡', emoji: '💳', bar: 'border-blue-400' },
  { key: 'PayAmt2', label: '宅配代收', emoji: '📦', bar: 'border-pink-400' },
  { key: 'PayAmt3', label: '宅配匯款', emoji: '🏦', bar: 'border-amber-400' },
  { key: 'PayAmt4', label: '機關簽帳', emoji: '🏛️', bar: 'border-gray-500' },
  { key: 'Service', label: '服務費', emoji: '🛎️', bar: 'border-purple-400' },
  { key: 'Discount', label: '折扣額', emoji: '✂️', bar: 'border-red-400' },
  { key: 'DeductAmt', label: '抵扣額', emoji: '🎟️', bar: 'border-red-400' },
]
const legacySumCards = computed(() => LEGACY_SUM_DEFS.map(d => ({ ...d, value: legacySum(d.key) })).filter(d => d.value || d.main))
type DayGroup<T> = { day: string; rows: T[]; count: number; total: number; voids: number }
function groupByDay<T>(all: T[], shown: T[], dayOf: (x: T) => string, amtOf: (x: T) => number, voidOf: (x: T) => boolean): DayGroup<T>[] {
  const stats = new Map<string, { count: number; total: number; voids: number }>()
  for (const x of all) {
    const d = dayOf(x); const s = stats.get(d) ?? { count: 0, total: 0, voids: 0 }
    if (voidOf(x)) s.voids++; else { s.count++; s.total += amtOf(x) }
    stats.set(d, s)
  }
  const out: DayGroup<T>[] = []
  for (const x of shown) {
    const d = dayOf(x)
    let g = out[out.length - 1]
    if (!g || g.day !== d) { g = { day: d, rows: [], ...(stats.get(d) ?? { count: 0, total: 0, voids: 0 }) }; out.push(g) }
    g.rows.push(x)
  }
  return out
}
const legacyCheckGroups = computed(() => groupByDay(legacyChecks.value, legacyChecks.value.slice(0, showLimit.value),
  c => c.opDate, c => Number(c.CheckAmt || 0), c => !!c.DelMark))

const filteredOrders = computed(() => {
  const remote = remoteOrders.value
  const known = new Set((remote ?? []).map(o => o.clientId))
  const local = orders.value.filter(o => !remote || !o.clientId || !known.has(o.clientId))
  const all = [...(remote ?? []), ...local].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  return all.filter(o => {
    const d = localYmd(new Date(o.createdAt))
    if (mode.value === 'daily') {
      return d === selectedDate.value
    } else {
      return d.slice(0, 7) === selectedMonth.value
    }
  })
})

// 統計不算已刪除的交易
const liveOrders = computed(() => filteredOrders.value.filter(o => !o.voided))
const totalRevenue = computed(() => liveOrders.value.reduce((s, o) => s + o.total, 0))
const totalCount   = computed(() => liveOrders.value.length)
const avgOrder     = computed(() => totalCount.value ? Math.round(totalRevenue.value / totalCount.value) : 0)
const cashTotal    = computed(() => liveOrders.value.filter(o => o.payMethod === 'cash').reduce((s, o) => s + o.total, 0))

const stats = computed(() => [
  { label: mode.value === 'daily' ? '當日營業額' : '當月營業額', value: '$' + totalRevenue.value.toLocaleString(), color: 'text-green-700' },
  { label: '交易筆數',   value: totalCount.value + ' 筆',   color: 'text-gray-900' },
  { label: '平均客單價', value: '$' + avgOrder.value,        color: 'text-blue-600' },
  { label: '現金收入',   value: '$' + cashTotal.value.toLocaleString(), color: 'text-amber-600' },
])

// 站別由資料機設定（可自訂）
const locDefs = computed(() => stations.value.map(s => ({ key: s.id, label: s.name })))

const locStats = computed(() => {
  const maxTotal = Math.max(1, ...locDefs.value.map(l =>
    liveOrders.value.filter(o => o.location === l.key).reduce((s, o) => s + o.total, 0)
  ))
  return locDefs.value.map(l => {
    const list = liveOrders.value.filter(o => o.location === l.key)
    const total = list.reduce((s, o) => s + o.total, 0)
    return { ...l, total, count: list.length, pct: Math.round(total / maxTotal * 100) }
  })
})

const payDefs = [
  { key: 'cash', icon: '💵', label: '現金' },
  { key: 'card', icon: '💳', label: '信用卡' },
  { key: 'hua',  icon: '📱', label: '華南Q' },
]

// 依結帳人統計（有記錄結帳人的交易才列；舊交易歸到「未記錄」）
const cashierStats = computed(() => {
  if (!liveOrders.value.some(o => o.cashierId)) return []
  const map = new Map<string, { key: string; label: string; total: number; count: number }>()
  for (const o of liveOrders.value) {
    const key = o.cashierId || ''
    const row = map.get(key) ?? { key, label: o.cashierName || (key ? key : '未記錄'), total: 0, count: 0 }
    row.total += o.total; row.count++
    map.set(key, row)
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...list.map(r => r.total))
  return list.map(r => ({ ...r, pct: Math.round(r.total / max * 100) }))
})

const payStats = computed(() => {
  const maxTotal = Math.max(1, ...payDefs.map(p =>
    liveOrders.value.filter(o => o.payMethod === p.key).reduce((s, o) => s + o.total, 0)
  ))
  return payDefs.map(p => {
    const list = liveOrders.value.filter(o => o.payMethod === p.key)
    const total = list.reduce((s, o) => s + o.total, 0)
    return { ...p, total, count: list.length, pct: Math.round(total / maxTotal * 100) }
  })
})

function formatTime(d: Date) {
  return new Date(d).toLocaleString('zh-TW', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── 電子發票：向資料機查期間內的發票（含上傳 / 作廢狀態） ──
const invoices = ref<InvoiceRecord[]>([])
const invLoading = ref(false)
const invError = ref('')
const invTruncated = ref(false)
const invProblemsOnly = ref(false)
const legacyError = ref('') // 資料機直接查葆光 SQL 失敗的原因（print-agent 1.18）
const legacyNote = ref('') // 葆光直查有沒有跑、查到幾張（print-agent 1.19 回 legacyRows）

const invRange = computed(() => {
  if (mode.value === 'daily') return { from: selectedDate.value, to: selectedDate.value }
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return { from: `${selectedMonth.value}-01`, to: localYmd(new Date(y!, m!, 0)) }
})

let invSeq = 0
const legacyInvCachedAt = ref('') // 葆光發票是資料機暫存的結果時的暫存時間（print-agent 1.23）
async function loadInvoices(refresh = false) {
  const seq = ++invSeq
  const { from, to } = invRange.value
  if (!from || !to) return
  invLoading.value = true
  invError.value = ''
  const r = await listEInvoices(from, to, refresh)
  if (seq !== invSeq) return // 已經切到別的日期
  invLoading.value = false
  if (r.ok) {
    invoices.value = [...r.data.invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || b.invoiceNo.localeCompare(a.invoiceNo))
    invTruncated.value = r.data.truncated
    legacyError.value = r.data.legacyError ?? ''
    legacyInvCachedAt.value = r.data.legacyCached && r.data.legacyCachedAt ? r.data.legacyCachedAt : ''
    const d = r.data as typeof r.data & { legacyRows?: number }
    legacyNote.value = d.legacyLive === undefined
      ? '資料機的 print-agent 不是 1.18 以上，沒有直接查葆光'
      : !d.legacyLive
          ? '資料機沒有查葆光資料庫（einvoice.ini 設了 Bk35Sql=off，或期間內發票太多）'
          : d.legacyRows === 0 ? '葆光資料庫有連上，但這段期間沒有葆光發票' : ''
  } else {
    invoices.value = []
    invTruncated.value = false
    invError.value = r.notConfigured
      ? '這台沒有啟用電子發票（系統設定 → 電子發票），看不到資料機上的發票'
      : `讀不到資料機的發票：${r.message}`
  }
}

// 向加值中心查詢狀態（QueryInvoiceStatus）：回覆格式沒有公開文件，先直接顯示原文
const querying = ref(false)
const queryingNo = ref('')
async function queryOne(inv: InvoiceRecord) {
  queryingNo.value = inv.invoiceNo
  const r = await queryEInvoice(inv.invoiceNo)
  queryingNo.value = ''
  if (r.ok) { inv.queryResult = r.data.queryResult; inv.queryAt = r.data.queryAt }
  else alert('查詢失敗：' + r.message)
}
async function queryRange() {
  querying.value = true
  const { from, to } = invRange.value
  const r = await queryEInvoiceRange(from, to)
  querying.value = false
  if (!r.ok) { alert('查詢失敗：' + r.message); return }
  if (r.data.failed) alert(`查了 ${r.data.queried} 張，失敗 ${r.data.failed} 張：${r.data.lastError}`)
  else if (r.data.total > r.data.queried) alert(`這次查了 ${r.data.queried} 張（共 ${r.data.total} 張），再按一次查剩下的`)
  void loadInvoices()
}

function invState(inv: InvoiceRecord) {
  if (inv.legacy) {
    const msg = [inv.payNote, inv.buyerId ? `統編 ${inv.buyerId}` : ''].filter(Boolean).join(' · ')
    return inv.cancelStatus === 'done'
      ? { label: '已作廢', cls: 'bg-gray-100 text-gray-500', msg: ['舊系統作廢', msg].filter(Boolean).join(' · ') }
      : { label: '舊系統', cls: 'bg-blue-50 text-blue-700', msg }
  }
  if (inv.cancelStatus === 'done') return { label: '已作廢', cls: 'bg-gray-100 text-gray-500', msg: inv.cancelMsg }
  if (inv.cancelStatus === 'needApproval') return { label: '作廢待核准', cls: 'bg-red-100 text-red-700', msg: inv.cancelMsg || '跨期作廢要先向國稅局申請核准文號' }
  if (inv.cancelStatus === 'pending') return { label: '作廢中', cls: 'bg-amber-100 text-amber-700', msg: inv.cancelMsg || '排程會再試' }
  if (inv.uploadStatus === 'done') return { label: '已上傳', cls: 'bg-green-100 text-green-700', msg: inv.uploadedAt ? `上傳於 ${inv.uploadedAt.slice(5, 16)}` : '' }
  if (inv.uploadAttempts >= 3) return { label: '上傳失敗', cls: 'bg-red-100 text-red-700', msg: inv.uploadMsg || `已試 ${inv.uploadAttempts} 次` }
  return { label: '待上傳', cls: 'bg-amber-100 text-amber-700', msg: inv.uploadMsg || '排程每 10 分鐘補傳' }
}

const invByNo = computed(() => new Map(invoices.value.map(i => [i.invoiceNo, i])))

// 收銀時寫在訂單上的發票號碼（BM-92177850），狀態以資料機為準
function orderInv(order: Order) {
  const o = order as Order & { invoiceNo?: string; invoiceIsMock?: boolean }
  if (!o.invoiceNo) return null
  if (o.invoiceIsMock) return { no: o.invoiceNo, label: '測試', cls: 'bg-gray-100 text-gray-500' }
  const inv = invByNo.value.get(o.invoiceNo.replace('-', ''))
  if (!inv) return { no: o.invoiceNo, label: invLoading.value ? '…' : '查無', cls: 'bg-gray-100 text-gray-400' }
  return { no: o.invoiceNo, ...invState(inv) }
}

// 來源切換：全部 / 葆光（舊系統匯入）/ 本系統開立；統計、清單都跟著切
const INV_SOURCES = [
  { value: 'legacy', label: '葆光' },
  { value: 'new', label: '本系統' },
] as const
// 「全部」已拿掉（卡爾 11/27）：只分葆光 / 本系統，預設葆光
const invSource = ref<'all' | 'legacy' | 'new'>('legacy')
// 葆光表格一次只畫前 PAGE 列（整月幾千列一起畫會卡），往下按「再顯示」
const PAGE = 300
const showLimit = ref(PAGE)
watch(invRange, () => ensureLoaded(), { immediate: true })
watch(invSource, () => { showLimit.value = PAGE; ensureLoaded() })
watch(invRange, () => { showLimit.value = PAGE })
const sourceInvoices = computed(() =>
  invSource.value === 'all' ? invoices.value : invoices.value.filter(i => !!i.legacy === (invSource.value === 'legacy')))

const shownInvoices = computed(() =>
  invProblemsOnly.value ? sourceInvoices.value.filter(i => !i.legacy && invState(i).label !== '已上傳' && invState(i).label !== '已作廢') : sourceInvoices.value)
// 葆光發票表格（照 BK0220 發票頁的欄位與順序；CSV 匯入的舊資料沒有的欄位留空）
type LegacyInv = InvoiceRecord & { seq?: string; legacySeq?: string; invMonth?: string; invType?: string; opDate?: string; sCharge?: number; userId?: string; cardType?: string; posId?: string; fileDate?: string; updDate?: string }
const slashDay = (d?: string) => (d || '').slice(0, 10).replace(/-/g, '/')
const LEGACY_INV_COLS: { id: string; label: string; num?: boolean; mono?: boolean; get: (i: LegacyInv) => string }[] = [
  { id: 'seq', label: '序號', num: true, get: i => i.seq || i.legacySeq || '' },
  { id: 'void', label: '作廢', get: i => i.cancelStatus === 'done' ? 'X' : '' },
  { id: 'no', label: '發票號碼', mono: true, get: i => i.invoiceNo },
  { id: 'buyer', label: '客戶統編', get: i => i.buyerId || '' },
  { id: 'order', label: '帳單號', mono: true, get: i => i.orderNo || '' },
  { id: 'month', label: '發票月份', get: i => i.invMonth || i.issuedAt.slice(0, 7).replace('-', '') },
  { id: 'date', label: '發票日期', get: i => slashDay(i.issuedAt) },
  { id: 'type', label: '類別', get: i => i.invType || '' },
  { id: 'opDate', label: '營業日期', get: i => slashDay(i.opDate) },
  { id: 'sc', label: '服務費', num: true, get: i => Number(i.sCharge || 0).toLocaleString() },
  { id: 'amt', label: '發票金額', num: true, get: i => Number(i.total).toLocaleString() },
  { id: 'user', label: '作業人員', get: i => i.userId || '' },
  { id: 'pay', label: '備註說明', get: i => i.payNote || '' },
  { id: 'card', label: '卡別', get: i => i.cardType || '' },
  { id: 'pos', label: 'POSID', get: i => i.posId || (i.station || '').replace(/^舊系統\s*/, '') },
  { id: 'file', label: '建檔時間', get: i => i.fileDate ? i.fileDate.replace(/-/g, '/') : i.issuedAt.slice(11, 19) === '00:00:00' ? '' : i.issuedAt.replace(/-/g, '/') },
  { id: 'upd', label: '更修時間', get: i => (i.updDate || '').replace(/-/g, '/') },
]
const legacyInvRows = computed(() => [...(shownInvoices.value as LegacyInv[])].sort((a, b) =>
  (Number(a.seq || a.legacySeq) || 0) - (Number(b.seq || b.legacySeq) || 0) || a.issuedAt.localeCompare(b.issuedAt) || a.invoiceNo.localeCompare(b.invoiceNo)))
const LEGACY_INV_POS = (i: LegacyInv) => i.posId || (i.station || '').replace(/^舊系統\s*/, '')
const MUTED_INV_COLS = new Set(['seq', 'month', 'type', 'opDate', 'user', 'file', 'upd'])
function invCellCls(c: { id: string; num?: boolean; mono?: boolean }, inv: LegacyInv) {
  if (c.id === 'amt') return 'text-right tabular-nums font-bold text-sm text-gray-900'
  if (c.id === 'no') return 'font-mono font-semibold text-gray-900'
  if (c.id === 'sc') return 'text-right tabular-nums ' + (Number(inv.sCharge) ? 'text-gray-700' : 'text-gray-300')
  if (MUTED_INV_COLS.has(c.id)) return (c.num ? 'text-right ' : '') + 'text-gray-400' + (c.mono ? ' font-mono' : '')
  return 'text-gray-600' + (c.mono ? ' font-mono' : '')
}
const newInvGroups = computed(() => groupByDay(shownInvoices.value, shownInvoices.value,
  i => i.issuedAt.slice(0, 10), i => Number(i.total), i => i.cancelStatus === 'done'))
const newOrderGroups = computed(() => groupByDay(filteredOrders.value, filteredOrders.value,
  o => localYmd(new Date(o.createdAt)), o => o.total, o => !!o.voided))
const legacyInvGroups = computed(() => groupByDay(legacyInvRows.value, legacyInvRows.value.slice(0, showLimit.value),
  i => i.issuedAt.slice(0, 10), i => Number(i.total), i => i.cancelStatus === 'done'))
const legacyCount = computed(() => invSource.value === 'all' ? invoices.value.filter(i => i.legacy).length : 0)
const legacyAmount = computed(() => invoices.value.filter(i => i.legacy && i.cancelStatus !== 'done').reduce((s, i) => s + Number(i.total), 0))

const invStats = computed(() => {
  const list = sourceInvoices.value
  const live = list.filter(i => i.cancelStatus !== 'done')
  const count = (label: string) => list.filter(i => invState(i).label === label).length
  const waiting = count('待上傳') + count('作廢中')
  const bad = count('上傳失敗') + count('作廢待核准')
  return [
    { label: '開立張數', value: `${list.length} 張`, color: 'text-gray-900' },
    { label: '發票金額（不含作廢）', value: '$' + live.reduce((s, i) => s + Number(i.total), 0).toLocaleString(), color: 'text-green-700' },
    invSource.value === 'legacy'
      ? { label: '葆光（舊系統）', value: `${count('舊系統')} 張`, color: 'text-blue-700' }
      : { label: '已上傳', value: `${count('已上傳')} 張`, color: 'text-green-700' },
    { label: '待上傳 / 有問題', value: `${waiting} / ${bad} 張`, color: bad ? 'text-red-600' : waiting ? 'text-amber-600' : 'text-gray-900' },
    { label: '作廢', value: `${count('已作廢')} 張`, color: 'text-gray-500' },
    { label: '測試號碼（未開立）', value: `${invSource.value === 'legacy' ? 0 : mockInvCount.value} 張`, color: 'text-gray-400' },
  ]
})

// 收銀機沒啟用電子發票時，結帳用網頁自己編的測試號碼（invoiceIsMock），不在資料機的發票清單裡
const mockInvCount = computed(() => filteredOrders.value.filter(o => o.invoiceNo && o.invoiceIsMock && !invByNo.value.has(o.invoiceNo.replace('-', ''))).length)

// ── 交易紀錄：編輯 / 刪除（資料機 print-agent 1.17 起；只追加修改紀錄，原始資料不刪） ──
const { cashier } = useCashier()
const editorName = computed(() => cashier.value ? `${cashier.value.name}（${cashier.value.id}）` : '未登入結帳人')
const editing = ref<Order | null>(null)
const deleting = ref<Order | null>(null)
const saving = ref(false)
const editError = ref('')
const form = reactive({ payMethod: '', location: '', cashierId: '', staffId: '', vipId: '', note: '', reason: '' })

// 下拉選單：在職的人，加上這筆原本的人（就算已停用也要選得到）
const employeeOptions = (keep: string) => employees.value.filter(e => e.enabled || e.id === keep)
const vipOptions = (keep: string) => vipMembers.value.filter(v => v.enabled || v.id === keep)
const realInvoice = (o: Order) => !!o.invoiceNo && !o.invoiceIsMock

function onDataMachine(o: Order) {
  if (!o.clientId || !remoteOrders.value?.some(r => r.clientId === o.clientId)) {
    alert('這筆還沒送到資料機（或現在連不到資料機），等同步後再修改')
    return false
  }
  return true
}
function openEdit(o: Order) {
  if (!onDataMachine(o)) return
  Object.assign(form, { payMethod: o.payMethod || 'cash', location: o.location || '', cashierId: o.cashierId || '',
    staffId: o.staffId || '', vipId: o.vipId || '', note: o.note || '', reason: '' })
  editError.value = ''
  editing.value = o
}
function openDelete(o: Order) {
  if (!onDataMachine(o)) return
  form.reason = ''
  editError.value = ''
  deleting.value = o
}
async function submitEdit(o: Order, changes: Record<string, any>) {
  const r = await editOrder({
    clientId: o.clientId!, day: localYmd(new Date(o.createdAt)), changes, reason: form.reason.trim(),
    by: cashier.value?.id ?? '', byName: cashier.value?.name ?? '',
  })
  if (!r.ok) { editError.value = r.message; return false }
  Object.assign(o, changes) // 先改畫面，再向資料機重抓
  void loadOrders()
  return true
}
async function saveEdit() {
  const o = editing.value
  if (!o) return
  if (!form.reason.trim()) { editError.value = '請填修改原因'; return }
  const next: Record<string, any> = {
    payMethod: form.payMethod, location: form.location, note: form.note.trim(),
    cashierId: form.cashierId, cashierName: employees.value.find(e => e.id === form.cashierId)?.name ?? (form.cashierId === o.cashierId ? o.cashierName ?? '' : ''),
    staffId: form.staffId, staffName: employees.value.find(e => e.id === form.staffId)?.name ?? '',
    vipId: form.vipId, vipName: vipMembers.value.find(v => v.id === form.vipId)?.name ?? '',
  }
  const changes: Record<string, any> = {}
  for (const [k, v] of Object.entries(next)) if (((o as any)[k] ?? '') !== v) changes[k] = v
  if (next.payMethod !== o.payMethod) changes.payDetail = '' // 混合付款說明跟著原付款方式，改了就清掉
  if (!Object.keys(changes).length) { editing.value = null; return }
  saving.value = true
  const ok = await submitEdit(o, changes)
  saving.value = false
  if (ok) editing.value = null
}
async function confirmDelete() {
  const o = deleting.value
  if (!o) return
  const reason = form.reason.trim()
  if (!reason) { editError.value = '請填刪除原因'; return }
  saving.value = true
  editError.value = ''
  if (realInvoice(o)) {
    const inv = invByNo.value.get(o.invoiceNo!.replace('-', ''))
    if (!inv || inv.cancelStatus !== 'done') {
      const r = await cancelEInvoice(o.invoiceNo!.replace('-', ''), reason.slice(0, 20))
      if (!r.ok) { saving.value = false; editError.value = `發票作廢失敗，這筆沒有刪除：${r.message}`; return }
    }
  }
  const ok = await submitEdit(o, { voided: true, voidReason: reason })
  saving.value = false
  if (ok) { deleting.value = null; void loadInvoices() }
}
function editHistory(o: Order) {
  return (o.edits ?? []).map(h => `${h.at} ${h.byName || '未登入'}：${h.reason || ''}（${Object.keys(h.changes).join('、')}）`).join('\n')
}
function showHistory(o: Order) {
  alert(`${o.no} 修改紀錄\n\n${editHistory(o) || '（無）'}`)
}
</script>
