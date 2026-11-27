<template>
  <div class="flex flex-col h-full overflow-hidden">

    <!-- 頁頭 -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 shrink-0">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div>
          <h1 class="text-lg font-bold text-gray-900">品項管理</h1>
          <p class="text-xs text-gray-400 mt-0.5">管理收銀品項、定價與物料消耗</p>
        </div>
        <!-- 篩選：搜尋、分類（站別改在分類管理設定） -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <input v-model="search" type="search" class="ifield" style="width:12rem; padding-left:2rem" placeholder="搜尋品項、備註、分類" @keyup.esc="search = ''">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          </div>
          <label class="flex items-center gap-1.5 text-xs text-gray-500">
            分類
            <select v-model="filterCat" class="ifield" style="width:auto; min-width:7rem">
              <option value="">全部</option>
              <option v-for="c in categoryList" :key="c.name" :value="c.name">{{ c.emoji ? c.emoji + ' ' : '' }}{{ c.name }}</option>
              <option :value="NO_CAT">（未分類）</option>
            </select>
          </label>
          <span class="text-xs text-gray-400">共 {{ filteredProducts.length }} 項<template v-if="inactiveProducts.length">（另有 {{ inactiveProducts.length }} 項已下架）</template></span>
          <span v-if="orderMsg" class="text-xs text-blue-600">{{ orderMsg }}</span>
        </div>
        <span v-if="catState.mode === 'demo'" class="text-xs text-amber-600">範例模式：連不到資料機，修改不會保存</span>
        <span v-else-if="catState.offline" class="text-xs text-amber-600">平板離線中，不能修改品項</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="openImport" class="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          匯入 CSV
        </button>
        <button @click="openCats" class="border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          分類管理
        </button>
        <button @click="openAdd" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          ＋ 新增品項
        </button>
      </div>
    </div>

    <!-- 品項卡片：手機一欄，越寬欄數越多 -->
    <div class="flex-1 overflow-auto px-4 md:px-6 py-4">

      <div ref="prodCards" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2.5">
        <!-- 上架的在前面（可拖動排序），下架的接在後面另起一區、顏色淡一點 -->
        <template v-for="(prod, i) in cardList" :key="prod.id">
        <div v-if="i === prodView.length && inactiveProducts.length" class="col-span-full flex items-center gap-3 mt-4 mb-1">
          <span class="text-sm font-semibold text-gray-500 whitespace-nowrap">已下架（{{ inactiveProducts.length }}）</span>
          <span class="text-xs text-gray-400 whitespace-nowrap">收銀台不會顯示</span>
          <div class="flex-1 border-t border-gray-200"></div>
        </div>
        <div
          :data-drag-row="prod.inactive ? null : ''"
          class="border border-gray-200 rounded-xl overflow-hidden flex flex-col"
          :class="prod.inactive ? 'bg-white opacity-60 hover:opacity-100 transition-opacity' : prodDragging === i ? 'bg-green-50 shadow-lg relative z-10' : 'bg-white'"
        >
          <!-- 圖片區 4:3（跟收銀卡片一樣）；沒圖放 emoji，再沒有放品名第一個字。padding-top 撐比例，Mypal 沒有 aspect-ratio -->
          <div class="relative bg-gray-100" style="padding-top:75%">
            <CatalogImg v-if="prod.image" :file="prod.image" :alt="prod.name" class="absolute inset-0 w-full h-full object-cover" />
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <span v-if="prod.emoji" class="text-5xl leading-none">{{ prod.emoji }}</span>
              <span v-else class="text-4xl font-bold text-gray-300 leading-none">{{ prod.name.slice(0, 1) }}</span>
            </div>
            <!-- 拖動把手：疊在圖片左上角 -->
            <span v-if="prod.inactive" class="absolute top-1.5 left-1.5 bg-gray-700 text-white text-xs rounded-md px-1.5 py-0.5">已下架</span>
            <span
              v-else
              class="drag-handle absolute top-1.5 left-1.5 bg-white/90 rounded-md shadow-sm px-1.5 py-1 mr-0" :class="orderBusy || catState.offline ? 'opacity-30' : ''"
              title="按住拖動改順序"
              @pointerdown="prodGrab($event, i)"
            >⠿</span>
            <span class="absolute top-1.5 right-1.5 bg-black/50 text-white text-xs rounded-md px-1.5 py-0.5">#{{ prod.sortOrder }}</span>
          </div>
          <div class="p-2.5 flex-1 flex flex-col">
            <div class="font-medium text-gray-900 text-sm leading-snug">{{ prod.name }}</div>
            <div v-if="prod.note" class="text-xs text-gray-400">{{ prod.note }}</div>
            <div class="font-semibold text-sm mt-0.5">
              <template v-if="prod.openPrice">
                <span class="text-orange-600">時價</span>
                <span v-if="prod.price" class="text-xs font-normal text-gray-400 ml-1">參考 ${{ prod.price }}</span>
              </template>
              <span v-else class="text-green-700">${{ prod.price }}</span>
            </div>
            <!-- 分類（與限現金）；站別跟著分類，在分類管理設定 -->
            <div class="flex flex-wrap items-center gap-1 mt-1.5">
              <span v-if="prod.category" class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full whitespace-nowrap">{{ categoryEmoji(prod.category) ? categoryEmoji(prod.category) + ' ' : '' }}{{ prod.category }}</span>
              <span v-else class="text-xs text-gray-300">未分類</span>
              <span v-if="prod.cashOnly" class="text-xs text-amber-600 whitespace-nowrap">💵 限現金</span>
            </div>
            <div v-if="prod.materials.length" class="text-xs text-gray-500 mt-1">
              <span v-for="pm in prod.materials" :key="pm.materialId" class="mr-2">{{ getMaterialName(pm.materialId) }} ×{{ pm.quantity }}</span>
            </div>
            <div class="flex gap-1.5 mt-auto pt-2.5">
              <button @click="openEdit(prod)" class="flex-1 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold hover:bg-blue-100 transition-colors whitespace-nowrap">編輯</button>
              <button @click="toggleInactive(prod)" :disabled="toggling === prod.id"
                class="flex-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
                :class="prod.inactive ? 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'"
              >{{ prod.inactive ? '上架' : '下架' }}</button>
              <button @click="deleteProduct(prod.id)" class="flex-1 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors whitespace-nowrap">刪除</button>
            </div>
          </div>
        </div>
        </template>
        <p v-if="!prodView.length && !inactiveProducts.length" class="text-sm text-gray-400 text-center py-10">沒有品項</p>
      </div>
    </div>

    <!-- 匯入 CSV Modal -->
    <div v-if="imp.show" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="closeImport">
      <div class="bg-white rounded-2xl p-5 sm:p-7 w-[680px] lg:w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">匯入品項（CSV）</h3>
        <p class="text-xs text-gray-400 mb-4">讀「分類」、「品項名稱」、「售價」三欄，「時價」欄有填東西就設成時價品項，其他欄位不管。第一列要是欄位名稱；Big5 或 UTF-8 編碼都可以，也可以直接選 Excel .xlsx（XP 那台請用 CSV）。檔案裡的分類如果還沒有，會自動新增到分類管理。</p>
        <p v-if="catState.mode === 'demo'" class="text-xs text-amber-600 mb-3">範例模式：連不到資料機，匯入的品項不會保存</p>
        <p v-else-if="catState.offline" class="text-xs text-amber-600 mb-3">平板離線中，不能匯入品項</p>

        <div class="flex flex-wrap items-center gap-3 mb-3">
          <label class="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap" :class="imp.busy ? 'opacity-50 pointer-events-none' : ''">
            選擇檔案
            <input type="file" accept=".csv,.txt,.xlsx" class="hidden" @change="pickImport">
          </label>
          <span class="text-sm text-gray-600 truncate" style="min-width:0; flex:1">{{ imp.fileName || '還沒選檔案' }}</span>
        </div>
        <p v-if="imp.error" class="text-xs text-red-600 mb-3">{{ imp.error }}</p>

        <template v-if="imp.rows.length">
          <div class="space-y-3 mb-3">
            <div>
              <div class="text-xs text-gray-500 mb-1.5">新分類的上架站別（已設定站別的分類，品項跟著分類）</div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label v-for="loc in locationOptions" :key="loc.value" class="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" :value="loc.value" v-model="imp.locations" :disabled="imp.busy || imp.done" class="w-4 h-4 accent-green-600">
                  <span class="text-sm text-gray-700">{{ loc.label }}</span>
                </label>
                <span v-if="!locationOptions.length" class="text-xs text-gray-400">還沒有站別</span>
              </div>
              <p v-if="!imp.locations.length && !imp.done" class="text-xs text-amber-600 mt-1">沒選站別的話，新分類的品項不會出現在任何收銀台（之後可以在分類管理再勾）</p>
            </div>
            <div v-if="dupCount && !imp.done">
              <div class="text-xs text-gray-500 mb-1.5">已經有同名品項（{{ dupCount }} 項）時</div>
              <div class="flex flex-wrap gap-x-4 gap-y-2">
                <label v-for="o in DUP_OPTIONS" :key="o.value" class="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" :value="o.value" v-model="imp.dup" :disabled="imp.busy || imp.done" class="w-4 h-4 accent-green-600">
                  <span class="text-sm text-gray-700">{{ o.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-600 mb-2">
            <template v-if="imp.done">{{ imp.progress }}</template>
            <template v-else>
              將新增 <b class="text-green-700">{{ summary.add }}</b> 項、更新 <b class="text-blue-600">{{ summary.update }}</b> 項、略過 {{ summary.skip }} 項<span v-if="summary.bad">（其中 <b class="text-red-600">{{ summary.bad }}</b> 項有問題）</span><span v-if="newCats.length">；會新增分類：{{ newCats.join('、') }}</span>
            </template>
          </div>

          <div class="flex-1 overflow-auto border border-gray-100 rounded-lg" style="min-height:8rem">
            <table class="w-full text-sm" style="min-width:32rem">
              <thead class="sticky top-0 bg-gray-50">
                <tr class="text-xs text-gray-400">
                  <th class="text-center py-2 font-medium w-12">
                    <input type="checkbox" :checked="allOn" @change="toggleAll(($event.target as HTMLInputElement).checked)" :disabled="imp.busy || imp.done" class="w-4 h-4 accent-green-600" title="全選">
                  </th>
                  <th class="text-left py-2 font-medium">分類</th>
                  <th class="text-left py-2 font-medium">品項名稱</th>
                  <th class="text-right py-2 font-medium">售價</th>
                  <th class="text-left py-2 font-medium pl-4">結果</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in imp.rows" :key="r.line" class="border-t border-gray-100" :class="rowAction(r) === 'skip' && !imp.done ? 'text-gray-400' : 'text-gray-800'">
                  <td class="text-center py-1.5">
                    <input type="checkbox" v-model="r.on" :disabled="!!r.error || imp.busy || imp.done" class="w-4 h-4 accent-green-600">
                  </td>
                  <td class="py-1.5 whitespace-nowrap">
                    {{ r.category || '（未分類）' }}
                    <span v-if="r.category && newCats.includes(r.category) && !imp.done" class="text-xs text-green-600">新</span>
                  </td>
                  <td class="py-1.5">{{ r.name }}</td>
                  <td class="py-1.5 text-right whitespace-nowrap">
                    <span v-if="r.openPrice" class="text-orange-600">時價 </span><template v-if="r.price || !r.openPrice">${{ r.price }}</template>
                  </td>
                  <td class="py-1.5 pl-4 text-xs" :class="rowNoteClass(r)">{{ rowNote(r) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <p v-if="imp.busy" class="text-xs text-gray-500 mt-3">{{ imp.progress }}</p>
        <div class="flex gap-2 mt-4 shrink-0">
          <template v-if="imp.done">
            <button @click="closeImport" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800">完成</button>
          </template>
          <template v-else>
            <button @click="closeImport" :disabled="imp.busy" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60">取消</button>
            <button @click="runImport" :disabled="imp.busy || !(summary.add + summary.update) || catState.offline" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60">
              {{ imp.busy ? '匯入中…' : `開始匯入（${summary.add + summary.update} 項）` }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- 分類管理 Modal -->
    <div v-if="showCats" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="closeCats">
      <div class="bg-white rounded-2xl p-7 w-[480px] lg:w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-1">分類管理</h3>
        <p class="text-xs text-gray-400 mb-4">收銀台的分類頁籤依這裡的順序排列（按住左邊 ⠿ 拖動）；改名時，用這個分類的品項會一起改。左邊的按鈕可以選 emoji，會顯示在收銀台的分類頁籤上。下面的站別點一下切換，這個分類的品項都會上架在亮起來的站。</p>
        <p v-if="catError" class="text-xs text-red-600 mb-3">{{ catError }}</p>

        <div ref="catListEl" class="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div v-for="(c, i) in catView" :key="c.key" data-drag-row class="rounded-lg border border-gray-100 p-2" :class="catDragging === i ? 'bg-green-50 shadow-md' : 'bg-white'">
            <div class="flex gap-2 items-center">
              <span class="drag-handle" :class="catBusy ? 'opacity-30' : ''" title="按住上下拖動改順序" @pointerdown="catGrab($event, i)">⠿</span>
              <EmojiPicker v-model="c.emoji" />
              <input v-model="c.name" type="text" class="ifield" style="flex:1; min-width:0" @keyup.enter="saveAllCats">
              <span class="text-xs text-gray-400 whitespace-nowrap w-14 text-right">{{ productCount(c.orig) }} 個品項</span>
              <span v-if="catChanged(c)" class="text-xs text-blue-500 whitespace-nowrap">已修改</span>
              <button v-else @click="removeCat(c)" :disabled="catBusy" class="text-xs text-red-400 hover:underline whitespace-nowrap">刪除</button>
            </div>
            <!-- 這個分類上架在哪幾站（點一下切換） -->
            <div class="flex flex-wrap items-center gap-1 mt-1.5" style="padding-left:1.75rem">
              <span class="text-xs text-gray-400 mr-0.5">站別</span>
              <button
                v-for="loc in locationOptions" :key="loc.value" type="button" :disabled="catBusy"
                class="text-xs px-2 py-0.5 rounded-full whitespace-nowrap border transition-colors"
                :class="c.locs.includes(loc.value) ? locColor(loc.value) + ' border-transparent' : 'border-gray-200 text-gray-400 line-through'"
                @click="toggleCatLoc(c, loc.value)"
              >{{ loc.label }}</button>
              <span v-if="!locationOptions.length" class="text-xs text-gray-400">還沒有站別</span>
              <span v-else-if="c.mixed" class="text-xs text-amber-600">各品項不同，點一下統一</span>
            </div>
          </div>
          <p v-if="!catRows.length" class="text-sm text-gray-400 col-span-full">還沒有分類</p>
        </div>

        <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100">
          <EmojiPicker v-model="newCatEmoji" />
          <input v-model="newCatName" type="text" class="ifield" style="flex:1; min-width:0" placeholder="新分類名稱，例：飲品" @keyup.enter="addCat">
          <button @click="addCat" :disabled="catBusy" class="bg-green-700 hover:bg-green-800 text-white text-sm font-semibold px-4 rounded-lg whitespace-nowrap disabled:opacity-60">＋ 新增分類</button>
        </div>

        <div class="flex gap-2 mt-5">
          <button @click="saveAllCats" :disabled="catBusy" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50">{{ catBusy ? '儲存中…' : catDirty ? `儲存（${catDirty} 項）` : '儲存' }}</button>
          <button @click="closeCats" :disabled="catBusy" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60">關閉</button>
        </div>
      </div>
    </div>

    <!-- 新增/編輯 Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" @click.self="showModal = false">
      <div class="bg-white rounded-2xl p-5 sm:p-7 w-[480px] lg:w-[900px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-2xl">
        <h3 class="text-base font-bold text-gray-900 mb-5">{{ editId ? '編輯品項' : '新增品項' }}</h3>

        <p v-if="formError" class="text-xs text-red-600 mb-3">{{ formError }}</p>
        <!-- 夠寬（lg 以上）時分左右兩欄：左邊基本資料與售價設定，右邊圖片、站別、物料；窄螢幕和手機維持單欄 -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">品項名稱 *</label>
                <input v-model="form.name" type="text" class="ifield" placeholder="例：巧克力餅乾一盒">
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">{{ form.openPrice ? '參考售價（選填）' : '售價 *' }}</label>
                <input v-model.number="form.price" type="number" class="ifield" :placeholder="form.openPrice ? '結帳時再輸入' : '0'">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">分類</label>
                <div v-if="!quickCat.open" class="flex gap-1.5 items-center">
                  <select v-model="form.category" class="ifield" style="flex:1; min-width:0">
                    <option value="">（未分類）</option>
                    <option v-for="c in categoryList" :key="c.name" :value="c.name">{{ c.emoji ? c.emoji + ' ' : '' }}{{ c.name }}</option>
                  </select>
                  <button @click="quickCat.open = true; quickCat.name = ''; quickCat.error = ''" class="text-xs text-green-600 hover:underline whitespace-nowrap" title="新增分類">＋新增</button>
                </div>
                <div v-else class="flex gap-1.5 items-center">
                  <input v-model="quickCat.name" type="text" class="ifield" style="min-width:0" placeholder="新分類名稱" @keyup.enter="addQuickCat">
                  <button @click="addQuickCat" :disabled="quickCat.saving" class="text-xs text-green-600 hover:underline whitespace-nowrap">確定</button>
                  <button @click="quickCat.open = false" class="text-xs text-gray-400 hover:underline whitespace-nowrap">取消</button>
                </div>
                <p v-if="quickCat.error" class="text-xs text-red-600 mt-1">{{ quickCat.error }}</p>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">備註</label>
                <input v-model="form.note" type="text" class="ifield" placeholder="例：30入">
              </div>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-2 block">上架狀態</label>
              <label class="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" v-model="form.inactive" class="w-4 h-4 accent-gray-500">
                <span class="text-sm text-gray-700">🚫 下架（收銀台暫時不顯示）</span>
              </label>
              <p class="text-xs text-gray-400 mt-1 ml-6">上架站別會保留，之後取消勾選就恢復</p>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-2 block">售價方式</label>
              <label class="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" v-model="form.openPrice" class="w-4 h-4 accent-orange-500">
                <span class="text-sm text-gray-700">✏️ 時價／自訂價錢（結帳時輸入售價）</span>
              </label>
              <p class="text-xs text-gray-400 mt-1 ml-6">勾選後收銀點這個品項會跳出輸入金額；上面的售價只當預設值，可留 0</p>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-2 block">付款限制</label>
              <label class="flex items-center gap-2 cursor-pointer w-fit">
                <input type="checkbox" v-model="form.cashOnly" class="w-4 h-4 accent-amber-500">
                <span class="text-sm text-gray-700">💵 限制只能使用現金付款</span>
              </label>
              <p class="text-xs text-gray-400 mt-1 ml-6">勾選後結帳時將鎖定付款方式為現金（例：午餐餐券）</p>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-1 block">排列順序</label>
              <input v-model.number="form.sortOrder" type="number" min="1" class="ifield w-24">
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs text-gray-500 mb-1 block">圖片（存在資料機，收銀台卡片會顯示）</label>
              <p class="text-xs text-gray-400 mb-2">建議比例 <b class="text-gray-600">4:3 橫式</b>，建議尺寸 <b class="text-gray-600">1200×900 px</b>（最小 800×600）。其他比例會在收銀卡片上自動裁掉上下或左右，主體請放中間。</p>
              <div class="flex items-center gap-3">
                <img v-if="imageFile && imagePreview" :src="imagePreview" alt="品項圖片" class="w-20 h-15 object-cover rounded-lg bg-gray-100">
                <CatalogImg v-else-if="imagePreview" :file="imagePreview" alt="品項圖片" class="w-20 h-15 object-cover rounded-lg bg-gray-100" />
                <div v-else class="w-20 h-15 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-300">無圖片</div>
                <label class="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer">
                  選擇圖片
                  <input type="file" accept="image/*" class="hidden" @change="pickImage">
                </label>
                <button v-if="imagePreview" @click="removeImage" class="text-xs text-red-400 hover:underline">移除</button>
              </div>
              <p v-if="imageInfo" class="text-xs mt-1.5" :class="imageInfo.warn ? 'text-amber-600' : 'text-green-600'">{{ imageInfo.text }}</p>
            </div>

            <div>
              <label class="text-xs text-gray-500 mb-1 block">Emoji 圖示（選填）</label>
              <div class="flex items-center gap-2">
                <EmojiPicker v-model="form.emoji" />
                <span class="text-xs text-gray-400">沒放圖片時，收銀卡片顯示這個；品項管理列表也會看到</span>
              </div>
            </div>

            <div v-if="!formCatLocs">
              <!-- 分類有設站別就跟著分類，不顯示；未分類或舊分類才在這裡勾 -->
              <label class="text-xs text-gray-500 mb-2 block">上架站別</label>
                <div class="flex flex-wrap gap-x-4 gap-y-2">
                  <label v-for="loc in locationOptions" :key="loc.value" class="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" :value="loc.value" v-model="form.locations" class="w-4 h-4 accent-green-600">
                    <span class="text-sm text-gray-700">{{ loc.label }}</span>
                  </label>
                </div>
                <p class="text-xs text-gray-400 mt-1">{{ form.category.trim() ? `分類「${form.category.trim()}」還沒設定站別，可以到「分類管理」統一設定` : '未分類的品項在這裡個別設定' }}</p>

            </div>

            <div>
              <label class="text-xs text-gray-500 mb-2 block">消耗物料（選填）</label>
              <div class="space-y-2">
                <div v-for="(pm, i) in form.materials" :key="i" class="flex gap-2 items-center">
                  <select
                    v-model.number="pm.materialId"
                    style="flex:1; min-width:0; border:1px solid #e5e7eb; border-radius:8px; padding:7px 10px; font-size:13px; background:#fff; color:#111; outline:none;"
                  >
                    <option :value="0" disabled>請選擇物料</option>
                    <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}（{{ m.unit }}）</option>
                  </select>
                  <input
                    v-model.number="pm.quantity"
                    type="number" min="1"
                    placeholder="數量"
                    style="width:72px; border:1px solid #e5e7eb; border-radius:8px; padding:7px 10px; font-size:13px; outline:none;"
                  >
                  <button @click="form.materials.splice(i, 1)" class="text-red-400 hover:text-red-600 text-xl leading-none px-1">×</button>
                </div>
                <button @click="form.materials.push({ materialId: 0, quantity: 1 })" class="text-xs text-green-600 hover:underline mt-1">＋ 新增物料</button>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-6">
          <button @click="showModal = false" class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">取消</button>
          <button @click="saveProduct" :disabled="saving" class="flex-1 py-2.5 rounded-xl bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-60">{{ saving ? '儲存中…' : '儲存' }}</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { Product, CategoryDef } from '~/composables/usePosStore'
import { readSheet } from '~/utils/sheetRead'

const { products, materials, stations, stationLabel, categoryList, categoryEmoji } = usePosStore()
const cat = useCatalog()
const catState = cat.state

const filterCat = ref('')   // '' = 全部，NO_CAT = 未分類，其他 = 分類名稱
const search    = ref('')   // 關鍵字：比對品名、備註、分類（不分大小寫，空白隔開＝每個字都要有）
const NO_CAT = '\u0000none'

// 篩選要記住（只存在這台瀏覽器）：重新整理或下次進來維持上次選的
const FILTER_KEY = 'pos-products-filter'
onMounted(() => {
  try {
    const f = JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')
    if (typeof f.cat === 'string') filterCat.value = f.cat
  } catch {}
  checkFilters()
})
watch(filterCat, cat => {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify({ cat })) } catch {}
})
// 記住的分類後來被刪掉了：資料載入後改回「全部」
function checkFilters() {
  if (catState.value.mode === 'loading') return
  if (filterCat.value && filterCat.value !== NO_CAT && !categoryList.value.some(c => c.name === filterCat.value)) filterCat.value = ''
}
watch([() => catState.value.mode, categoryList], checkFilters, { deep: true })
const showModal = ref(false)
const editId    = ref<number | null>(null)
const saving    = ref(false)
const formError = ref('')

const locationOptions = computed(() => stations.value.map(s => ({ value: s.id, label: stationLabel(s.id) })))
// 編輯視窗：分類有設站別就跟著分類（null＝分類還沒設定或未分類，品項自己勾）
const formCatLocs = computed(() => {
  const l = categoryList.value.find(c => c.name === form.value.category.trim())?.locations
  return l ? stations.value.map(s => s.id).filter(id => l.includes(id)) : null
})

const COLORS = ['bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700', 'bg-gray-100 text-gray-600']
function locColor(id: string) {
  const i = stations.value.findIndex(s => s.id === id)
  return COLORS[(i < 0 ? COLORS.length - 1 : i) % COLORS.length]
}

const defaultForm = () => ({
  name: '', emoji: '', price: 0, category: '', note: '',
  cashOnly: false,
  openPrice: false,
  inactive: false,
  locations: [] as string[],
  sortOrder: products.value.length + 1,
  materials: [] as { materialId: number; quantity: number }[],
})
const form = ref(defaultForm())
watch(formCatLocs, l => { if (l) form.value.locations = [...l] })

// 圖片：選了新圖先預覽，按儲存時才上傳
const imageFile    = ref<File | null>(null)
const imageRemoved = ref(false)
const imagePreview = ref('')
function pickImage(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  ;(e.target as HTMLInputElement).value = ''
  if (!f) return
  if (imagePreview.value.startsWith('blob:') && imageFile.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = f
  imageRemoved.value = false
  imagePreview.value = URL.createObjectURL(f)
  checkImageSize(imagePreview.value)
}

// 選圖後檢查比例和大小（收銀卡片是 4:3），提醒會被裁切或太小
const imageInfo = ref<{ text: string; warn: boolean } | null>(null)
function checkImageSize(url: string) {
  imageInfo.value = null
  const img = new Image()
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight
    if (!w || !h) return
    const r = w / h
    const size = `這張 ${w}×${h} px`
    if (w < 800 || h < 600) imageInfo.value = { text: `${size}，有點小，收銀卡片可能會模糊（建議至少 800×600）`, warn: true }
    else if (r > 4 / 3 * 1.1) imageInfo.value = { text: `${size}，比 4:3 寬，卡片會裁掉左右兩邊`, warn: true }
    else if (r < 4 / 3 / 1.1) imageInfo.value = { text: `${size}，比 4:3 高，卡片會裁掉上下`, warn: true }
    else imageInfo.value = { text: `${size}，比例 OK`, warn: false }
  }
  img.src = url
}
function removeImage() {
  imageInfo.value = null
  imageFile.value = null
  imageRemoved.value = true
  imagePreview.value = ''
}

const bySort = (a: Product, b: Product) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id
// 篩選後全部（含下架）；上架的給拖動排序，下架的另外列在下面
const filteredAll = computed(() => {
  const list = products.value
    .filter(p => !filterCat.value || (filterCat.value === NO_CAT ? !(p.category || '').trim() : p.category === filterCat.value))
    .filter(p => {
      const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
      if (!words.length) return true
      const text = `${p.name} ${p.note || ''} ${p.category || ''}`.toLowerCase()
      return words.every(w => text.includes(w))
    })
  // 排序存檔中：照拖好的順序顯示，不要跟著一筆一筆存回來的資料跳動
  const o = orderOverride.value
  return o ? list.sort((a, b) => o.indexOf(a.id) - o.indexOf(b.id)) : list.sort(bySort)
})
const filteredProducts = computed(() => filteredAll.value.filter(p => !p.inactive))
const inactiveProducts = computed(() => filteredAll.value.filter(p => p.inactive))
const cardList = computed(() => [...prodView.value, ...inactiveProducts.value])

// 卡片上的「下架／上架」
const toggling = ref<number | null>(null)
async function toggleInactive(prod: Product) {
  toggling.value = prod.id
  try {
    const { image: _img, ...rest } = prod
    await cat.saveProduct({ ...rest, inactive: !prod.inactive, locations: [...rest.locations], materials: rest.materials.map(m => ({ ...m })) })
  } catch (e) {
    alert((e as Error).message)
  } finally {
    toggling.value = null
  }
}

// ---- 拖動排序（品項）----
// 有篩選時只拖得到看得到的品項：它們在完整清單裡原本佔的位置不變，只在這些位置之間重排，
// 沒顯示的品項維持原位。之後整份清單重新編號 1、2、3…，只把有變的存回資料機。
const prodCards = ref<HTMLElement | null>(null)
const orderOverride = ref<number[] | null>(null)
const orderBusy = ref(false)
const orderMsg = ref('')
const { view: prodView, dragging: prodDragging, start: prodDragStart } = useDragSort(prodCards, () => filteredProducts.value, saveProductOrder)
function prodGrab(e: PointerEvent, i: number) {
  if (orderBusy.value || catState.value.offline) return
  prodDragStart(e, i)
}
async function saveProductOrder(visible: Product[]) {
  const all = products.value.slice().sort(bySort)
  const shown = new Set(visible.map(p => p.id))
  const slots = all.map((p, i) => (shown.has(p.id) ? i : -1)).filter(i => i >= 0)
  const merged = all.slice()
  slots.forEach((s, k) => { merged[s] = visible[k]! })
  const changes = merged.map((p, i) => ({ id: p.id, sortOrder: i + 1 })).filter((x, i) => merged[i]!.sortOrder !== x.sortOrder)
  if (!changes.length) return
  orderOverride.value = merged.map(p => p.id)
  orderBusy.value = true
  try {
    let n = 0
    for (const c of changes) {
      orderMsg.value = `儲存排序 ${++n}/${changes.length}…`
      const cur = products.value.find(x => x.id === c.id)
      if (!cur) continue
      const { image: _img, ...rest } = cur
      try {
        await cat.saveProduct({ ...rest, sortOrder: c.sortOrder, locations: [...rest.locations], materials: rest.materials.map(m => ({ ...m })) })
      } catch (e) {
        if (!/要更新到 1\.1[456]/.test((e as Error).message)) throw e // 舊版存不了 emoji 的提醒：排序已存好
      }
    }
    orderMsg.value = ''
  } catch (e) {
    orderMsg.value = ''
    alert('排序儲存失敗：' + (e as Error).message)
  } finally {
    orderOverride.value = null
    orderBusy.value = false
  }
}

function getMaterialName(id: number) {
  return materials.value.find(m => m.id === id)?.name ?? '?'
}

function resetImage(prod?: Product) {
  imageInfo.value = null
  imageFile.value = null
  imageRemoved.value = false
  imagePreview.value = prod?.image ?? ''  // 檔名；<CatalogImg> 負責取圖
}

function openAdd() {
  editId.value = null
  form.value = defaultForm()
  if (filterCat.value && filterCat.value !== NO_CAT) form.value.category = filterCat.value
  resetImage()
  formError.value = ''
  quickCat.open = false
  quickCat.error = ''
  showModal.value = true
}

function openEdit(prod: Product) {
  editId.value = prod.id
  form.value = {
    name: prod.name, emoji: prod.emoji || '', price: prod.price, category: prod.category,
    note: prod.note, cashOnly: prod.cashOnly, openPrice: !!prod.openPrice, inactive: !!prod.inactive,
    locations: [...prod.locations],
    sortOrder: prod.sortOrder,
    materials: prod.materials.map(m => ({ ...m })),
  }
  resetImage(prod)
  formError.value = ''
  quickCat.open = false
  quickCat.error = ''
  showModal.value = true
}

async function saveProduct() {
  if (!form.value.name || (!form.value.price && !form.value.openPrice)) { formError.value = '請填品項名稱和售價（時價品項可不填售價）'; return }
  if (form.value.price < 0) { formError.value = '售價不能是負數'; return }
  saving.value = true
  formError.value = ''
  try {
    const name = form.value.name.trim()
    // 舊版 print-agent 存不了 emoji：品項其他內容已存好，圖片照樣上傳，最後再顯示提醒
    let warn = ''
    let savedId: number | undefined
    try {
      savedId = await cat.saveProduct({ ...form.value, name, id: editId.value, materials: form.value.materials.filter(m => m.materialId) })
    } catch (e) {
      if (/要更新到 1\.1[456]/.test((e as Error).message)) warn = (e as Error).message
      else throw e
    }
    // 可以有同名品項，不能用名稱找 id；只有舊版提醒走 catch 拿不到 savedId 時，才退回找最新那個同名的
    const id = editId.value ?? savedId ?? [...products.value].reverse().find(p => p.name === name)?.id
    if (id && imageFile.value) await cat.setProductImage(id, imageFile.value)
    else if (id && imageRemoved.value) await cat.clearProductImage(id)
    if (warn) { formError.value = warn; editId.value = id ?? editId.value; imageFile.value = null; imageRemoved.value = false; return }
    showModal.value = false
  } catch (e) {
    formError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

// ---- 分類 ----
// 舊版 print-agent 沒有分類 API 時，給看得懂的訊息
function catMsg(e: unknown) {
  const m = (e as Error)?.message ?? String(e)
  return /沒有這個功能/.test(m) ? '資料機的 print-agent 還是舊版，要更新到 1.8 才能管理分類（' + m + '）' : m
}
function productCount(name: string) {
  return name ? products.value.filter(p => p.category === name).length : 0
}

// 品項編輯視窗裡的「＋新增」：新增後直接選它
const quickCat = reactive({ open: false, name: '', error: '', saving: false })
async function addQuickCat() {
  const name = quickCat.name.trim()
  if (!name) { quickCat.error = '請輸入分類名稱'; return }
  quickCat.saving = true
  quickCat.error = ''
  try {
    if (!categoryList.value.some(c => c.name === name)) {
      try { await cat.saveCategory({ name, locations: [...form.value.locations] }) } catch (e) { if (!/要更新到 1\.16/.test((e as Error).message)) throw e }
    }
    form.value.category = name
    quickCat.open = false
  } catch (e) {
    quickCat.error = catMsg(e)
  } finally {
    quickCat.saving = false
  }
}

// 分類管理視窗
const showCats   = ref(false)
const catBusy    = ref(false)
const catError   = ref('')
const newCatName = ref('')
const newCatEmoji = ref('')
type CatRow = { key: string; id: string; name: string; orig: string; emoji: string; origEmoji: string; sortOrder: number; locs: string[]; origLocs: string[]; mixed: boolean; unset: boolean }
const catRows    = ref<CatRow[]>([])
// 重新載入清單時保留還沒按儲存的修改（例如先改名、再拖動排序）
function refreshCatRows() {
  const edited = new Map(catRows.value.filter(catChanged).map(r => [r.orig, r]))
  catRows.value = categoryList.value.map((c, i) => {
    const e = edited.get(c.name)
    const cur = catCurrentLocs(c)
    return {
      key: c.id || 'n:' + c.name, id: c.id, name: e ? e.name : c.name, orig: c.name, emoji: e ? e.emoji : (c.emoji || ''), origEmoji: c.emoji || '', sortOrder: i + 1,
      locs: e ? e.locs : cur.locs, origLocs: cur.locs, mixed: e ? e.mixed : cur.mixed, unset: !c.locations,
    }
  })
}
// 分類目前的站別：有設定用設定的；還沒設定（舊資料）就看這個分類的品項，全部一樣就用那個，不一樣就取聯集並提示
function catCurrentLocs(c: CategoryDef) {
  const order = (l: string[]) => stations.value.map(s => s.id).filter(id => l.includes(id))
  if (c.locations) return { locs: order(c.locations), mixed: false }
  const prods = products.value.filter(p => p.category === c.name)
  const keys = new Set(prods.map(p => order(p.locations).join(',')))
  const all = new Set(prods.flatMap(p => p.locations))
  return { locs: order([...all]), mixed: keys.size > 1 }
}
function toggleCatLoc(c: CatRow, id: string) {
  const ids = stations.value.map(s => s.id)
  c.locs = ids.filter(x => x === id ? !c.locs.includes(id) : c.locs.includes(x))
  c.mixed = false
}
const sameLocs = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))
const catDirty = computed(() => catRows.value.filter(catChanged).length)
function catChanged(c: CatRow) {
  return c.name.trim() !== c.orig || c.emoji !== c.origEmoji || !sameLocs(c.locs, c.origLocs) || (c.unset && c.mixed === false && catMixedBefore(c))
}
// 還沒設定、品項站別不一樣的分類：點過站別（統一）就算有修改
function catMixedBefore(c: CatRow) {
  const d = categoryList.value.find(x => x.name === c.orig)
  return !!d && catCurrentLocs(d).mixed
}
function openCats() {
  catRows.value = []
  refreshCatRows()
  catError.value = ''
  newCatName.value = ''
  newCatEmoji.value = ''
  showCats.value = true
}
async function runCat(job: () => Promise<void>) {
  catBusy.value = true
  catError.value = ''
  try { await job() } catch (e) { catError.value = catMsg(e) } finally { catBusy.value = false; refreshCatRows() }
}
function addCat() {
  const name = newCatName.value.trim()
  if (!name) { catError.value = '請輸入分類名稱'; return }
  runCat(async () => { await cat.saveCategory({ name, emoji: newCatEmoji.value || undefined }); newCatName.value = ''; newCatEmoji.value = '' })
}
// 下面的「儲存」：一次存所有改過名稱、emoji 或站別的分類，存好就關閉視窗（沒改東西就直接關）
// 還沒設定站別、品項又都一樣的分類（舊資料），順便把站別存到分類上（品項不會變）
async function saveAllCats() {
  const rows = catRows.value.filter(c => catChanged(c) || (c.unset && !c.mixed && productCount(c.orig) > 0))
  if (!rows.length) { showCats.value = false; return }
  if (rows.some(c => !c.name.trim())) { catError.value = '分類名稱不能空白'; return }
  const names = catRows.value.map(c => c.name.trim())
  const dup = names.find((n, i) => names.indexOf(n) !== i)
  if (dup) { catError.value = `有兩個分類都叫「${dup}」`; return }
  await runCat(async () => {
    for (const c of rows) {
      // 清單裡還沒有的（舊資料只寫在品項上）：用舊名建一筆再改名，品項才會一起改
      let id = c.id
      if (!id) {
        try { await cat.saveCategory({ name: c.orig }) } catch (e) { if (!/已經有分類/.test((e as Error).message)) throw e }
        id = categoryList.value.find(x => x.name === c.orig)?.id || ''
      }
      await cat.saveCategory({ id, name: c.name.trim(), emoji: c.emoji, sortOrder: catRows.value.indexOf(c) + 1, locations: [...c.locs] })
    }
  })
  if (!catError.value) showCats.value = false // 有錯誤就留著讓你看
}
function closeCats() {
  if (catBusy.value) return
  if (catDirty.value && !confirm(`有 ${catDirty.value} 個分類改了還沒儲存，確定不存直接關閉？`)) return
  showCats.value = false
}
function removeCat(c: { id: string; orig: string }) {
  const n = productCount(c.orig)
  if (n) { catError.value = `還有 ${n} 個品項是「${c.orig}」，請先把它們改到別的分類再刪`; return }
  if (!c.id) return
  if (!confirm(`確定刪除分類「${c.orig}」？`)) return
  runCat(() => cat.deleteCategory(c.id))
}
// 分類拖動排序
const catListEl = ref<HTMLElement | null>(null)
const { view: catView, dragging: catDragging, start: catDragStart } = useDragSort(catListEl, () => catRows.value, saveCatOrder)
function catGrab(e: PointerEvent, i: number) {
  if (!catBusy.value) catDragStart(e, i)
}
function saveCatOrder(rows: CatRow[]) {
  catRows.value = rows
  // 重新編號，只送有變的
  runCat(async () => {
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k]!
      const cur = categoryList.value.find(x => x.name === r.orig)
      if (cur && cur.id && cur.sortOrder === k + 1) continue
      await cat.saveCategory({ id: cur?.id || undefined, name: r.orig, sortOrder: k + 1 })
    }
  })
}

// ---- 匯入 CSV ----
// 讀「分類、品項名稱、售價、時價」，其他欄（分類編號、品項編號、品項代碼…）不管。
// 新分類先建好；新品項依選的站別上架、排在最後面；同名品項依選擇略過或更新。全部走現有的 category/save、product/save。
type ImpRow = { line: number; category: string; name: string; price: number; openPrice: boolean; on: boolean; error: string; result: string }
type DupMode = 'skip' | 'price' | 'all'
const DUP_OPTIONS: { value: DupMode; label: string }[] = [
  { value: 'skip',  label: '略過，不動原本的' },
  { value: 'price', label: '只更新售價（和時價設定）' },
  { value: 'all',   label: '更新售價、分類，並加上選的站別' },
]
const imp = reactive({
  show: false, fileName: '', error: '', busy: false, done: false, progress: '',
  rows: [] as ImpRow[], locations: [] as string[], dup: 'skip' as DupMode,
})

function openImport() {
  Object.assign(imp, { show: true, fileName: '', error: '', busy: false, done: false, progress: '', rows: [], dup: 'skip' })
  imp.locations = stations.value.map(s => s.id)
}
function closeImport() {
  if (!imp.busy) imp.show = false
}

const HEAD = {
  name:     ['品項名稱', '商品名稱', '品名', '名稱', '品項', '商品'],
  category: ['分類', '分類名稱', '類別', '類別名稱'],
  price:    ['售價', '價格', '單價', '定價', '價錢'],
  open:     ['時價', '自訂價'],
}
const norm = (s: string) => (s || '').replace(/[\s\u3000\uFEFF]/g, '')

async function pickImport(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  Object.assign(imp, { fileName: f.name, error: '', done: false, progress: '', rows: [] })
  try {
    const rows = await readSheet(f)
    // 找欄位名稱那一列（前 10 列內有「品項名稱」）
    const hi = rows.findIndex((r, i) => i < 10 && r.some(c => HEAD.name.includes(norm(c))))
    if (hi < 0) throw new Error('找不到「品項名稱」欄；第一列要是欄位名稱，例如：分類,品項名稱,售價')
    const head = rows[hi]!.map(norm)
    const col = (names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i } return -1 }
    const ni = col(HEAD.name), ci = col(HEAD.category), pi = col(HEAD.price), oi = col(HEAD.open)
    if (pi < 0) throw new Error('找不到「售價」欄')
    const seen = new Map<string, number>()
    const out: ImpRow[] = []
    rows.slice(hi + 1).forEach((r, k) => {
      const line = k + 1
      const name = (r[ni] || '').trim()
      if (!name) return
      const category = ci >= 0 ? (r[ci] || '').trim() : ''
      const rawPrice = (r[pi] || '').replace(/[$＄,，\s元]/g, '')
      const rawOpen = oi >= 0 ? (r[oi] || '').trim() : ''
      const openPrice = !!rawOpen && !/^(0|n|no|否|無|false)$/i.test(rawOpen)
      let price = rawPrice === '' ? 0 : Number(rawPrice)
      // 售價空白、時價欄填的是數字：當參考價
      if (rawPrice === '' && openPrice && /^\d+(\.\d+)?$/.test(rawOpen)) price = Number(rawOpen)
      let error = ''
      if (!isFinite(price) || price < 0) { error = `售價「${r[pi]}」看不懂`; price = 0 }
      else if (!price && !openPrice) error = '沒有售價'
      if (!error && seen.has(name)) error = `檔案裡第 ${seen.get(name)} 筆已經有同名的，只匯入那一筆`
      if (!seen.has(name)) seen.set(name, line)
      out.push({ line, category, name, price, openPrice, on: !error, error, result: '' })
    })
    if (!out.length) throw new Error('檔案裡沒有品項資料')
    imp.rows = out
  } catch (err) {
    imp.error = '讀檔失敗：' + (err as Error).message
  }
}

const existingOf = (r: ImpRow) => products.value.find(p => p.name.trim() === r.name)
function rowAction(r: ImpRow): 'add' | 'update' | 'skip' {
  if (r.error || !r.on) return 'skip'
  const o = existingOf(r)
  if (!o) return 'add'
  if (imp.dup === 'skip' || sameAs(r, o)) return 'skip'
  return 'update'
}
// 同名品項沒有東西要改：不用送
function sameAs(r: ImpRow, o: Product) {
  if (o.price !== r.price || !!o.openPrice !== r.openPrice) return false
  if (imp.dup !== 'all') return true
  return o.category === r.category && imp.locations.every(l => o.locations.includes(l))
}
const dupCount = computed(() => imp.rows.filter(r => !r.error && existingOf(r)).length)
const summary = computed(() => {
  const s = { add: 0, update: 0, skip: 0, bad: 0 }
  for (const r of imp.rows) { s[rowAction(r)]++; if (r.error) s.bad++ }
  return s
})
// 會用到、但分類管理裡還沒有的分類
const newCats = computed(() => {
  const have = new Set(categoryList.value.map(c => c.name))
  const list: string[] = []
  for (const r of imp.rows) {
    const a = rowAction(r)
    if (!r.category || a === 'skip' || (a === 'update' && imp.dup !== 'all')) continue
    if (!have.has(r.category) && !list.includes(r.category)) list.push(r.category)
  }
  return list
})
const allOn = computed(() => imp.rows.some(r => !r.error) && imp.rows.every(r => r.error || r.on))
function toggleAll(v: boolean) {
  imp.rows.forEach(r => { if (!r.error) r.on = v })
}
const priceText = (price: number, open?: boolean) => open ? (price ? `時價(參考 $${price})` : '時價') : `$${price}`
function rowNote(r: ImpRow) {
  if (imp.done) return r.result || '略過'
  if (r.error) return r.error
  if (!r.on) return '不匯入'
  const o = existingOf(r)
  if (!o) return '新增'
  if (imp.dup === 'skip') return '已有同名，略過'
  if (sameAs(r, o)) return '已有同名，沒有要改的，略過'
  const before = priceText(o.price, o.openPrice), after = priceText(r.price, r.openPrice)
  const parts = before === after ? [] : [`售價 ${before} → ${after}`]
  if (imp.dup === 'all' && o.category !== r.category) parts.push(`分類 ${o.category || '未分類'} → ${r.category || '未分類'}`)
  if (imp.dup === 'all' && !imp.locations.every(l => o.locations.includes(l))) parts.push('加站別')
  return '更新' + (parts.length ? '：' + parts.join('、') : '')
}
function rowNoteClass(r: ImpRow) {
  if (imp.done) return r.result.startsWith('✗') ? 'text-red-600' : r.result ? 'text-green-700' : 'text-gray-400'
  if (r.error) return 'text-red-600'
  const a = rowAction(r)
  return a === 'add' ? 'text-green-700' : a === 'update' ? 'text-blue-600' : 'text-gray-400'
}

async function runImport() {
  // 先決定每一筆要做什麼（新增後就會變成「已存在」）
  const plan = imp.rows.map(r => ({ r, act: rowAction(r), old: existingOf(r) })).filter(x => x.act !== 'skip')
  if (!plan.length) { imp.error = '沒有要匯入的品項'; return }
  const cats = newCats.value.slice()
  imp.busy = true
  imp.error = ''
  try {
    for (const name of cats) {
      imp.progress = `新增分類「${name}」…`
      // 舊版 print-agent（1.7 以前）沒有分類 API：略過，品項上照樣存分類名稱
      try { await cat.saveCategory({ name, locations: [...imp.locations] }) } catch (e) { if (!/沒有這個功能|要更新到 1\.16/.test((e as Error).message)) throw e }
    }
  } catch (e) {
    imp.error = '新增分類失敗：' + catMsg(e)
    imp.busy = false
    imp.progress = ''
    return
  }
  let sort = Math.max(0, ...products.value.map(p => p.sortOrder || 0)) + 1
  let added = 0, updated = 0, failed = 0, n = 0
  for (const { r, act, old } of plan) {
    n++
    imp.progress = `匯入中 ${n}/${plan.length}：${r.name}`
    try {
      try {
        if (act === 'add' || !old) {
          await cat.saveProduct({
            id: null, name: r.name, emoji: '', price: r.price, category: r.category, note: '',
            cashOnly: false, openPrice: r.openPrice, locations: [...imp.locations], sortOrder: sort++, materials: [],
          })
        } else {
          const { image: _img, ...cur } = old
          const upd = { ...cur, price: r.price, openPrice: r.openPrice, materials: cur.materials.map(m => ({ ...m })), locations: [...cur.locations] }
          if (imp.dup === 'all') {
            upd.category = r.category
            for (const l of imp.locations) if (!upd.locations.includes(l)) upd.locations.push(l)
          }
          await cat.saveProduct(upd)
        }
      } catch (e) {
        if (!/要更新到 1\.1[456]/.test((e as Error).message)) throw e // 舊版存不了 emoji 的提醒：品項本身已存好
      }
      if (act === 'add') { added++; r.result = '✓ 已新增' } else { updated++; r.result = '✓ 已更新' }
    } catch (e) {
      failed++
      r.result = '✗ ' + (e as Error).message
    }
  }
  imp.busy = false
  imp.done = true
  imp.progress = `匯入完成：新增 ${added} 項、更新 ${updated} 項` + (cats.length ? `、新分類 ${cats.length} 個` : '') + (failed ? `，${failed} 項失敗（看下面紅字）` : '')
}

async function deleteProduct(id: number) {
  if (!confirm('確定刪除此品項？')) return
  try { await cat.deleteProduct(id) } catch (e) { alert((e as Error).message) }
}
</script>

<style scoped>
@reference "~/assets/css/input.css";
.drag-handle {
  @apply inline-block cursor-grab select-none text-base leading-none text-gray-400 hover:text-gray-700 px-1 mr-1 align-middle;
  touch-action: none;
}
.drag-handle:active { cursor: grabbing; }
.ifield {
  @apply w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-colors bg-white text-gray-900;
}
</style>
