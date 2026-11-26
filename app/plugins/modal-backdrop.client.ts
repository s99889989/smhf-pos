// 全站對話框（Modal）：在視窗裡按下滑鼠（例如選取輸入框文字）、拖到外面才放開時，
// 瀏覽器會把 click 送到兩者共同的上層＝灰色遮罩，@click.self 就把視窗關掉了。
// 這裡統一修：遮罩（class 有 fixed + inset-0）收到 click 時，按下的地方如果不是遮罩本身，就把這個 click 擋掉。
// 只有在遮罩上「按下又放開」才會關閉。觸控、滑鼠都適用（pointerdown 在 Mypal / Firefox 68 也有）。
export default defineNuxtPlugin(() => {
  let downTarget: EventTarget | null = null
  window.addEventListener('pointerdown', e => { downTarget = e.target }, true)
  window.addEventListener('mousedown', e => { downTarget = e.target }, true) // 保險：少數環境沒有 pointer 事件
  window.addEventListener('click', e => {
    const t = e.target as HTMLElement | null
    if (!t || !t.classList || !t.classList.contains('fixed') || !t.classList.contains('inset-0')) return
    if (downTarget && downTarget !== t) {
      e.stopPropagation()
      e.preventDefault()
    }
  }, true)
})
