// 圖片上傳前處理（照農莊系統 holy-mother-farm app/utils/imageUpload.js 的 prepareImage 精簡）：
// 轉正、縮到寬 1200、壓成 JPEG 0.82；透明底補白；讀不了（HEIC 等）就提示改格式。
// 收銀這邊上傳到資料機的 print-agent，不經雲端，所以不需要大小重試與除錯報告。

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type || '') || /\.(heic|heif)$/i.test(f.name || '')

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() }
    } catch { /* 舊瀏覽器（Mypal）不支援 options：改用 <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode'))
      el.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error(isHeic(file)
      ? '這個瀏覽器無法讀取 HEIC／HEIF 照片，請先轉成 JPG 再上傳（手機：設定 → 相機 → 格式 → 最相容）'
      : '瀏覽器無法讀取這張圖片，請改用 JPG 或 PNG')
  }
}

export async function prepareImage(file: File, maxWidth = 1200, quality = 0.82): Promise<Blob> {
  const d = await decode(file)
  try {
    const scale = Math.min(1, maxWidth / d.width, Math.sqrt(16_600_000 / (d.width * d.height)))
    const w = Math.max(1, Math.floor(d.width * scale))
    const h = Math.max(1, Math.floor(d.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('瀏覽器不支援圖片處理')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(d.source, 0, 0, w, h)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || !blob.size) throw new Error('圖片壓縮失敗，請改用 JPG')
    return blob
  } finally {
    d.close()
  }
}
