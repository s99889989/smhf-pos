// Netlify 排程函式：每 10 分鐘叫網站的 /api/einvoice/run 補傳發票、預取號碼。
// 用到的環境變數：URL（Netlify 自動提供，正式站網址）、EINVOICE_API_TOKEN。

export default async () => {
  const token = process.env.EINVOICE_API_TOKEN
  if (!token) return new Response('EINVOICE_API_TOKEN 未設定', { status: 200 })
  const res = await fetch(`${process.env.URL}/api/einvoice/run`, {
    method: 'POST',
    headers: { 'x-pos-token': token },
  })
  const text = await res.text()
  console.log('[einvoice-cron]', res.status, text.slice(0, 2000))
  return new Response(null, { status: 200 })
}

export const config = { schedule: '*/10 * * * *' }
