// 網頁開起來後向資料機（經本機 print-agent）載入站別、商品、原料庫存。
// 等 app:mounted 才載，避免和伺服器端渲染的畫面不一致；連不到就維持內建範例資料。
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => { useCatalog().load() })
})
