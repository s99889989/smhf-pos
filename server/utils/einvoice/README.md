# 電子發票後端（Cetustek 加值中心）

照舊 BK35 POS（InvPost.exe）還原的取號＋上傳流程，跑在 Nuxt server routes（Netlify Functions），資料存 Netlify DB（Neon Postgres）。

## 檔案

| 檔案 | 內容 |
|---|---|
| `cetustek.ts` | SOAP 用戶端（ApplyInvoiceNumber / TakeInvoiceNumber / UploadInvoice / UploadCancelInvoice …）與回傳代碼 |
| `invoiceXml.ts` | 上傳 XML（XSDVersion 2.8）、作廢、註銷 |
| `qrAes.ts` | QR 驗證碼 AES-128-CBC、隨機碼 |
| `period.ts` | 期別（民國年 + 雙月，台灣時間） |
| `db.ts` | 資料表（第一次用到自動建立）：`einvoice_batches`、`einvoices`、`einvoice_state` |
| `service.ts` | 配號、開立、上傳佇列、作廢、狀態 |
| `auth.ts` | API 要帶 `x-pos-token` = `EINVOICE_API_TOKEN` |

API：`POST /api/einvoice/issue`、`POST /api/einvoice/cancel`、`GET /api/einvoice/status`、`POST /api/einvoice/run`。
排程：`netlify/functions/einvoice-cron.mts` 每 10 分鐘呼叫 `/api/einvoice/run`（補傳、補號碼）。

## 流程

- 號碼：本期保持兩批（用中 + 預取，一批 500 張）；期別第二個月 20 號起預抓下一期。申請號會先存，取號失敗下次用同一個申請號重試。
- 開立：單一 SQL 原子配號並寫入發票，多台收銀機同時開也不會重號。回傳號碼、隨機碼、AES 給前端列印。
- 上傳：開立後馬上試傳（最多等 3 秒），失敗由排程重試，間隔 2、4、8… 分鐘，最長 1 小時。S2（已上傳過）視同成功。
- 作廢：開立上傳成功後才送；C5 視同成功，C3（已過申報期）標成「需核准文號」。

## 環境變數（Netlify → Site configuration → Environment variables）

| 變數 | 內容 |
|---|---|
| `NETLIFY_DATABASE_URL` | 加 Netlify DB 時自動產生，不用手填 |
| `EINVOICE_API_TOKEN` | 自己訂一組長的隨機字串；每台收銀機在「系統設定 → 電子發票」填同一組 |
| `EINVOICE_OFFICE_ID` | 賣方統編 |
| `EINVOICE_POS_NO` | 收銀機代號（舊系統登錄 `BK3\SYS\POSID`） |
| `EINVOICE_POS_ID` | 舊 InvPost.exe 用的 posid（廠商代號 + APIPassword） |
| `EINVOICE_QR_AES_KEY` | 財政部 QR 加密金鑰（32 碼 hex，舊系統登錄 `BK3\IP\QRCode`） |
| `EINVOICE_ENDPOINT` | 選填，預設 `http://ve.ei.com.tw/InvoiceEntitySync/InvoiceAPI` |

金鑰與 posid 只放環境變數，不要寫進程式碼、文件或前端。

後端未設定（缺環境變數或資料庫）時，收銀頁會改用模擬號碼並在紙本印「測試號碼」，方便先測列印。
