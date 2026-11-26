// 拖動排序：按住把手（⠿）拖動（單欄清單上下拖，多欄格線也可以左右拖），放開時呼叫 onDrop(新順序)。
// 用 Pointer Events，滑鼠、觸控平板、手機都可以；XP 的 Mypal（Firefox 68 核心）也支援。
// 用法：清單外層 ref 傳 container，每一列加 data-drag-row，把手 @pointerdown="drag.start($event, i)"，
// 畫面用 drag.view（拖動中是暫時的順序）。把手要加 style="touch-action:none"，觸控拖動時頁面才不會跟著捲。
// 動畫：被拖的那列黏著指標走；其他列換位置時用 FLIP（記下舊位置 → 換順序 → 從舊位置滑到新位置）。
import type { Ref } from 'vue'

const SLIDE = 'transform 180ms ease'

export function useDragSort<T>(container: { readonly value: HTMLElement | null }, items: () => T[], onDrop: (list: T[]) => void) {
  const list = ref(null) as Ref<T[] | null>
  const dragging = ref(-1)          // 拖動中的項目目前在第幾個
  const view = computed(() => list.value ?? items())
  let startIndex = -1
  let lastX = 0
  let lastY = 0
  let grabDx = 0                    // 指標到被拖那列左上角的距離
  let grabDy = 0
  let dragEl: HTMLElement | null = null
  let timer: ReturnType<typeof setInterval> | undefined
  let scroller: HTMLElement | null = null
  let busy = false                  // 換順序後等畫面更新完才接受下一次

  const rowsOf = () => (container.value ? Array.from(container.value.querySelectorAll<HTMLElement>('[data-drag-row]')) : [])

  function start(e: PointerEvent, index: number) {
    if (e.button > 0) return        // 只接受左鍵或觸控
    e.preventDefault()
    const rows = rowsOf()
    dragEl = rows[index] || null
    if (!dragEl) return
    // 上一次放開的回彈動畫還沒跑完：先清掉
    rows.forEach(r => { r.style.transition = ''; r.style.transform = '' })
    list.value = items().slice()
    dragging.value = startIndex = index
    lastX = e.clientX
    lastY = e.clientY
    const r0 = dragEl.getBoundingClientRect()
    grabDx = e.clientX - r0.left
    grabDy = e.clientY - r0.top
    scroller = findScroller(container.value)
    // 掛在 window：列被 Vue 搬動位置時也不會漏掉事件
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    document.body.style.userSelect = 'none'
    timer = setInterval(autoScroll, 30)
  }

  function move(e: PointerEvent) {
    lastX = e.clientX
    lastY = e.clientY
    e.preventDefault()
    follow()
    reorder()
  }

  // 被拖的那列跟著指標（不加動畫，才不會延遲）
  function follow() {
    if (!dragEl) return
    dragEl.style.transition = 'none'
    dragEl.style.transform = ''
    const r = dragEl.getBoundingClientRect()
    dragEl.style.transform = `translate(${lastX - grabDx - r.left}px, ${lastY - grabDy - r.top}px)`
  }

  // 拖動中的項目要排第幾：數其他項目有幾個排在它前面（閱讀順序：上面的列，或同一列在左邊的）
  function reorder() {
    const l = list.value
    const from = dragging.value
    if (busy || !l || from < 0 || !dragEl) return
    const rows = rowsOf()
    const r0 = dragEl.getBoundingClientRect()
    const cx = r0.left + r0.width / 2
    const cy = r0.top + r0.height / 2
    let to = 0
    rows.forEach(row => {
      if (row === dragEl) return
      const r = row.getBoundingClientRect()
      const rx = r.left + r.width / 2
      const ry = r.top + r.height / 2
      const sameLine = Math.abs(ry - cy) <= r.height / 2
      if (sameLine ? rx < cx : ry < cy) to++
    })
    if (to === from || to >= l.length) return
    // FLIP：先記下其他列現在畫面上的位置
    const before = new Map<HTMLElement, DOMRect>()
    rows.forEach(row => { if (row !== dragEl) before.set(row, row.getBoundingClientRect()) })
    const next = l.slice()
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x!)
    list.value = next
    dragging.value = to
    busy = true
    nextTick(() => {
      busy = false
      const moved: HTMLElement[] = []
      rowsOf().forEach(row => {
        if (row === dragEl) return
        const old = before.get(row)
        if (old == null) return
        row.style.transition = 'none'
        row.style.transform = ''
        const now = row.getBoundingClientRect()
        const dx = old.left - now.left
        const dy = old.top - now.top
        if (!dx && !dy) return
        row.style.transform = `translate(${dx}px, ${dy}px)`
        moved.push(row)
      })
      void container.value?.offsetHeight // 強制先畫出舊位置，再滑到新位置
      moved.forEach(row => { row.style.transition = SLIDE; row.style.transform = '' })
      follow()
    })
  }

  // 拖到捲動區上下邊緣時自動捲
  function autoScroll() {
    if (!scroller) return
    const r = scroller.getBoundingClientRect()
    const edge = 48
    const d = lastY < r.top + edge ? -14 : lastY > r.bottom - edge ? 14 : 0
    if (d) { scroller.scrollTop += d; follow(); reorder() }
  }

  function end() {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
    document.body.style.userSelect = ''
    if (timer) clearInterval(timer)
    // 放開時瀏覽器會補一個 click，目標可能落在視窗外框（會被當成「點背景關閉」）：吃掉這一下
    window.addEventListener('click', swallowClick, true)
    setTimeout(() => window.removeEventListener('click', swallowClick, true), 0)
    // 被拖的那列從手上的位置滑回它的新位置
    const el = dragEl
    if (el) {
      el.style.transition = SLIDE
      el.style.transform = ''
      setTimeout(() => { if (el !== dragEl) el.style.transition = '' }, 250)
    }
    dragEl = null
    busy = false
    const l = list.value
    const moved = dragging.value !== startIndex
    list.value = null
    dragging.value = -1
    if (l && moved) onDrop(l)
  }

  function swallowClick(e: Event) {
    e.stopPropagation()
    e.preventDefault()
  }

  function findScroller(el: HTMLElement | null) {
    while (el) {
      const s = getComputedStyle(el).overflowY
      if ((s === 'auto' || s === 'scroll') && el.scrollHeight > el.clientHeight) return el
      el = el.parentElement
    }
    return null
  }

  onBeforeUnmount(() => { if (dragging.value >= 0) end() })

  return { view, dragging, start }
}
