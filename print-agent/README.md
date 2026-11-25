# smhf-pos 列印小程式（print-agent）

讓 smhf-pos 網頁印出來的發票和舊 BK35 POS **一模一樣**：網頁按「列印收據」時，把照舊系統座標排好的 ESC/POS 指令送到收銀電腦上的這支小程式，由它用 Windows 印表機名稱以 RAW 方式直接送印表機（和舊系統 `InvPrintPort=NIP` 同一種送法）。

連不到這支小程式時，網頁會自動改用瀏覽器列印（版面相同，只是字型是電腦字型）。

## 需求

- Windows XP SP3 ～ Windows 11
- .NET Framework 4.0 以上（Win10/11 內建；XP 需另外安裝 .NET Framework 4.0）
- 發票機可以是 Windows 裡的印表機（USB 驅動），也可以接在序列埠（COM1、COM2…，含 USB 轉序列）

## 安裝

1. 把整個 `print-agent` 資料夾複製到收銀電腦，例如 `C:\smhf-print-agent\`
2. 雙擊 `install-startup.bat`：加到開機自動啟動並立刻執行
3. 瀏覽器開 <http://127.0.0.1:17890/>，這頁會列出這台電腦所有 Windows 印表機和 COM 埠：
   - 每一台按「測試」，看發票機有沒有吐出「測試列印」
   - COM 埠要選鮑率（印表機底部 DIP 開關 SW-7/SW-8 決定，常見 38400 或 9600），不確定就四個都按
   - 發票機印出來了，就按同一列的「設為發票機」，會自動寫進 `print-agent.ini`
4. 回 smhf-pos 按「測試列印」，發票應該就從發票機出來

`smhf-print-agent.exe` 已經編好；若要自己重編，雙擊 `build.bat`（用 Windows 內建的 .NET 4.0 編譯器）。執行紀錄寫在 `print-agent.log`。

## 不知道發票機接在哪

- 「控制台 → 系統 → 硬體 → 裝置管理員 → 連接埠 (COM 和 LPT)」看有哪些 COM 埠；拔插發票機的線，多出來 / 消失的那個就是它
- 也可以直接用上面的設定頁一台一台按「測試」
- 舊 BK35 程式若還在這台電腦，它的設定（登錄 `BK3\IP\InvPrintPort`）就是它送印的地方

## Windows XP + Mypal 要多設定一次

smhf-pos 網站是 https，Mypal（Firefox 68 核心）預設會擋 https 網頁呼叫 `http://127.0.0.1`。在 Mypal 網址列輸入 `about:config`，把
`security.mixed_content.block_active_content` 改成 `false`。
（Win10 的 Chrome / Edge 不用設定，它們允許網頁呼叫本機。）

## 其他設定

- 換埠號：改 `print-agent.ini` 的 `Port=`，網頁那邊在瀏覽器主控台執行 `localStorage.setItem('pos-print-agent','http://127.0.0.1:新埠號')`
- 這台電腦只想用瀏覽器列印：`localStorage.setItem('pos-print-agent','off')`
- 序列埠流量控制：`print-agent.ini` 的 `Handshake=None`（可改 `XOnXOff` 或 `RequestToSend`），若長發票印到一半亂掉再改
- 測試不出紙：`Printer=file:C:\out.bin` 會把要送的位元組存成檔案

## 注意

- 版面用 416 dots（52mm）寬的頁模式，和舊系統一樣。若印表機的列印寬度只有 48mm（例如 EPSON TM-P20II 是 384 dots），右邊會被切掉，要再調。
- 條碼 / QR 目前用模擬發票號碼，AES 驗證碼還是佔位值，手機 App 掃了會驗證失敗；串正式電子發票後就會正確。
