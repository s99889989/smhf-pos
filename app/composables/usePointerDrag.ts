import type { Ref } from 'vue'
// 編輯排列用的拖動：用 pointer events 自己做（滑鼠、觸控螢幕都能拖；HTML5 drag 在觸控上不會觸發）。
// 用法：可拖的元素 @pointerdown="drag.down($event, 項目, 顯示文字)"，可放的位置加 data-drop="代號"，
// 放開時呼叫 onDrop(項目, 代號)。移動不到 8px 算「點一下」，照常觸發 click；真的拖過了就把接下來那次 click 吃掉。
// 拖的時候畫面上跟著手指 / 滑鼠的小標籤用 ghost 畫（pointer-events: none，才找得到底下的放置位置）。
export function usePointerDrag<T>(onDrop: (item: T, target: string) => void) {
  const dragging = ref<T | null>(null) as Ref<T | null>
  const ghost = ref<{ x: number; y: number; label: string } | null>(null)
  const over = ref<string | null>(null)
  let start: { x: number; y: number; item: T; label: string } | null = null
  let eatClick = false

  function targetAt(e: PointerEvent) {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const t = el && el.closest ? el.closest('[data-drop]') : null
    return t ? t.getAttribute('data-drop') : null
  }
  function move(e: PointerEvent) {
    if (!start) return
    if (dragging.value == null) {
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 8) return
      dragging.value = start.item
    }
    e.preventDefault()
    ghost.value = { x: e.clientX, y: e.clientY, label: start.label }
    over.value = targetAt(e)
  }
  function up(e: PointerEvent) {
    const item = dragging.value
    const target = item != null ? targetAt(e) : null
    stop()
    if (item != null) {
      eatClick = true
      setTimeout(() => { eatClick = false }, 300)
      if (target != null) onDrop(item, target)
    }
  }
  function stop() {
    start = null
    dragging.value = null
    ghost.value = null
    over.value = null
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', stop)
  }
  function down(e: PointerEvent, item: T, label: string) {
    if (e.button !== 0) return
    stop()
    start = { x: e.clientX, y: e.clientY, item, label }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', stop)
  }
  /** click 處理前先問：剛剛是拖動結束的話回 true（這次 click 不要處理） */
  function justDragged() {
    if (!eatClick) return false
    eatClick = false
    return true
  }
  onBeforeUnmount(stop)

  return { dragging, ghost, over, down, justDragged }
}
