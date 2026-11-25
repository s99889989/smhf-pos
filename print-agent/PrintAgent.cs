// smhf-pos 列印小程式（print-agent）
//
// 跑在收銀電腦上，聽 http://127.0.0.1:17890，收到網頁送來的 ESC/POS 工作就用
// Windows 印表機名稱以 RAW 方式直接送印表機（和舊 BK35 POS 的做法一樣）。
//
// - 只用 .NET Framework 4.0 的功能、C# 5 語法：Windows XP（裝 .NET 4.0）到 Win10/11 都能跑
// - 用 TcpListener 自己處理 HTTP，不用 HttpListener，Win10 不必設定 urlacl 或用系統管理員執行
// - 設定檔 print-agent.ini 放在 exe 旁邊：Printer=印表機名稱或 COM1（空白 = 預設印表機）、Baud、Port=17890
// - 印表機可以是 Windows 印表機（RAW 送出），也可以是序列埠 COMx（直接寫序列埠）
//
// 找發票機：瀏覽器開 http://127.0.0.1:17890/ ，每台印表機 / COM 埠都有「測試」按鈕，
// 印出來的那台按「設為發票機」就會寫進 print-agent.ini。
//
// API
//   GET  /          → 找發票機的設定頁
//   GET  /test?printer=X&baud=N  → 印一張測試條
//   GET  /use?printer=X&baud=N   → 設為發票機（寫入 print-agent.ini）
//   GET  /status    → {"ok":true,"printer":"NIP","version":"1.0"}
//   GET  /printers  → {"ok":true,"printers":["NIP","..."]}
//   POST /print     → body: {"ops":[{"raw":"base64"},{"text":"中文"}], "printer":"(可省略)"}
//                     text 以 Big5（cp950）編碼，raw 原樣送出
using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing.Printing;
using System.IO;
using System.IO.Ports;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace SmhfPrintAgent
{
    static class Program
    {
        const string Version = "1.0";
        static string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        static string printerName = "";
        static int port = 17890;
        static int baud = 38400;
        static string handshake = "None";
        static readonly object printLock = new object();

        [STAThread]
        static void Main(string[] args)
        {
            bool created;
            using (var mutex = new Mutex(true, "Global\\smhf-print-agent", out created))
            {
                if (!created) return; // 已經在跑了
                LoadConfig();
                Log("啟動，埠 " + port + "，印表機 " + (printerName == "" ? "(預設)" : printerName));
                var listener = new TcpListener(IPAddress.Loopback, port);
                try { listener.Start(); }
                catch (Exception ex) { Log("無法監聽埠 " + port + "：" + ex.Message); return; }
                while (true)
                {
                    TcpClient client = listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(Handle, client);
                }
            }
        }

        static void LoadConfig()
        {
            string ini = Path.Combine(baseDir, "print-agent.ini");
            if (!File.Exists(ini))
            {
                SaveConfig();
            }
            foreach (string line in File.ReadAllLines(ini, Encoding.UTF8))
            {
                string l = line.Trim();
                if (l.StartsWith(";") || l.IndexOf('=') < 0) continue;
                string k = l.Substring(0, l.IndexOf('=')).Trim().ToLowerInvariant();
                string v = l.Substring(l.IndexOf('=') + 1).Trim();
                if (k == "printer") printerName = v;
                else if (k == "port") int.TryParse(v, out port);
                else if (k == "baud") int.TryParse(v, out baud);
                else if (k == "handshake") handshake = v;
            }
        }

        static void SaveConfig()
        {
            string ini = Path.Combine(baseDir, "print-agent.ini");
            File.WriteAllText(ini,
                "; 發票機：Windows 印表機名稱，或序列埠 COM1、COM2…（空白 = 預設印表機）\r\n" +
                "Printer=" + printerName + "\r\n" +
                "; 序列埠才用得到：鮑率（看印表機底部 DIP 開關）、流量控制 None / XOnXOff / RequestToSend\r\n" +
                "Baud=" + baud + "\r\n" +
                "Handshake=" + handshake + "\r\n" +
                "Port=" + port + "\r\n", Encoding.UTF8);
        }

        static bool IsCom(string printer)
        {
            return printer.StartsWith("COM", StringComparison.OrdinalIgnoreCase) && printer.Length > 3 && char.IsDigit(printer[3]);
        }

        static void SendTo(string printer, byte[] data, int bd)
        {
            lock (printLock)
            {
                // 測試用：Printer=file:C:\out.bin 會把送出的位元組存成檔案
                if (printer.StartsWith("file:")) File.WriteAllBytes(printer.Substring(5), data);
                else if (IsCom(printer))
                {
                    using (var sp = new SerialPort(printer, bd, Parity.None, 8, StopBits.One))
                    {
                        Handshake hs = Handshake.None;
                        try { hs = (Handshake)Enum.Parse(typeof(Handshake), handshake, true); } catch { }
                        sp.Handshake = hs;
                        sp.DtrEnable = true;
                        sp.RtsEnable = hs != Handshake.RequestToSend;
                        sp.WriteTimeout = 15000;
                        sp.Open();
                        for (int i = 0; i < data.Length; i += 256)
                            sp.Write(data, i, Math.Min(256, data.Length - i));
                        // 等資料送完再關閉
                        DateTime until = DateTime.Now.AddSeconds(10);
                        while (sp.BytesToWrite > 0 && DateTime.Now < until) Thread.Sleep(20);
                        Thread.Sleep(200);
                    }
                }
                else RawPrinter.Send(printer, data, "smhf-pos 發票");
            }
        }

        static void Handle(object state)
        {
            var client = (TcpClient)state;
            try
            {
                client.ReceiveTimeout = 10000;
                NetworkStream ns = client.GetStream();
                string method, path;
                Dictionary<string, string> headers;
                byte[] body = ReadRequest(ns, out method, out path, out headers);
                if (method == null) return;

                if (method == "OPTIONS") { Respond(ns, 204, null); return; }
                string rawPath = path;
                int q = path.IndexOf('?');
                if (q >= 0) path = path.Substring(0, q);

                var js = new JavaScriptSerializer();
                js.MaxJsonLength = 16 * 1024 * 1024;
                var res = new Dictionary<string, object>();

                var qs = ParseQuery(rawPath);
                if (method == "GET" && (path == "/" || path == "/index.html"))
                {
                    RespondHtml(ns, SetupPage(null));
                }
                else if (method == "GET" && path == "/test")
                {
                    string p = Q(qs, "printer");
                    int bd = baud; int.TryParse(Q(qs, "baud"), out bd); if (bd <= 0) bd = baud;
                    string msg;
                    try { SendTo(p, TestBytes(p, bd), bd); msg = "已送出測試列印到「" + p + "」" + (IsCom(p) ? "（鮑率 " + bd + "）" : "") + "。哪一台印出來，就按那一台的「設為發票機」。"; }
                    catch (Exception ex) { msg = "「" + p + "」送印失敗：" + ex.Message; }
                    Log(msg);
                    RespondHtml(ns, SetupPage(msg));
                }
                else if (method == "GET" && path == "/use")
                {
                    printerName = Q(qs, "printer");
                    int bd; if (int.TryParse(Q(qs, "baud"), out bd) && bd > 0) baud = bd;
                    SaveConfig();
                    Log("設定發票機：" + printerName + (IsCom(printerName) ? " 鮑率 " + baud : ""));
                    RespondHtml(ns, SetupPage("已把發票機設為「" + printerName + "」" + (IsCom(printerName) ? "（鮑率 " + baud + "）" : "") + "。"));
                }
                else if (method == "GET" && path == "/status")
                {
                    res["ok"] = true; res["printer"] = CurrentPrinter(null); res["version"] = Version;
                    Respond(ns, 200, js.Serialize(res));
                }
                else if (method == "GET" && path == "/printers")
                {
                    var list = new List<string>();
                    foreach (string p in PrinterSettings.InstalledPrinters) list.Add(p);
                    res["ok"] = true; res["printers"] = list; res["comPorts"] = SerialPort.GetPortNames();
                    Respond(ns, 200, js.Serialize(res));
                }
                else if (method == "POST" && path == "/print")
                {
                    string json = Encoding.UTF8.GetString(body);
                    var job = js.Deserialize<Dictionary<string, object>>(json);
                    string printer = CurrentPrinter(job.ContainsKey("printer") ? job["printer"] as string : null);
                    byte[] data = BuildBytes((ArrayList)job["ops"]);
                    SendTo(printer, data, baud);
                    Log("已送印 " + data.Length + " bytes → " + printer);
                    res["ok"] = true; res["printer"] = printer; res["bytes"] = data.Length;
                    Respond(ns, 200, js.Serialize(res));
                }
                else
                {
                    res["ok"] = false; res["error"] = "not found";
                    Respond(ns, 404, js.Serialize(res));
                }
            }
            catch (Exception ex)
            {
                Log("錯誤：" + ex.Message);
                try
                {
                    var res = new Dictionary<string, object>();
                    res["ok"] = false; res["error"] = ex.Message;
                    Respond(client.GetStream(), 500, new JavaScriptSerializer().Serialize(res));
                }
                catch { }
            }
            finally { client.Close(); }
        }

        static string CurrentPrinter(string requested)
        {
            if (!string.IsNullOrEmpty(requested)) return requested;
            if (printerName != "") return printerName;
            return new PrinterSettings().PrinterName; // 預設印表機
        }

        static byte[] BuildBytes(ArrayList ops)
        {
            Encoding big5 = Encoding.GetEncoding(950);
            var ms = new MemoryStream();
            foreach (object o in ops)
            {
                var op = (Dictionary<string, object>)o;
                byte[] b;
                if (op.ContainsKey("raw")) b = Convert.FromBase64String((string)op["raw"]);
                else b = big5.GetBytes((string)op["text"]);
                ms.Write(b, 0, b.Length);
            }
            return ms.ToArray();
        }

        static byte[] TestBytes(string printer, int bd)
        {
            var ms = new MemoryStream();
            Encoding big5 = Encoding.GetEncoding(950);
            byte[] init = { 0x1b, 0x40, 0x1c, 0x26, 0x1d, 0x21, 0x11 };
            ms.Write(init, 0, init.Length);
            byte[] t = big5.GetBytes("測試列印\n");
            ms.Write(t, 0, t.Length);
            byte[] normal = { 0x1d, 0x21, 0x00 };
            ms.Write(normal, 0, normal.Length);
            t = big5.GetBytes("smhf-pos 列印小程式\n印表機: " + printer + (IsCom(printer) ? "  鮑率: " + bd : "") + "\n" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "\n\n\n\n");
            ms.Write(t, 0, t.Length);
            byte[] cut = { 0x1d, 0x56, 66, 0 };
            ms.Write(cut, 0, cut.Length);
            return ms.ToArray();
        }

        static string H(string s) { return WebUtility.HtmlEncode(s ?? ""); }
        static string U(string s) { return Uri.EscapeDataString(s ?? ""); }

        static string SetupPage(string msg)
        {
            var sb = new StringBuilder();
            sb.Append("<!doctype html><html><head><meta charset='utf-8'><title>smhf-pos 列印小程式</title>");
            sb.Append("<style>body{font-family:sans-serif;margin:24px;max-width:760px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;text-align:left}a.b{display:inline-block;padding:4px 10px;margin:2px;border:1px solid #888;border-radius:4px;text-decoration:none;color:#000;background:#f4f4f4}.msg{background:#fff6d6;padding:10px;border:1px solid #e0c060;margin:12px 0}.cur{background:#e6f6e6}</style></head><body>");
            sb.Append("<h2>smhf-pos 列印小程式 " + Version + "</h2>");
            sb.Append("<p>目前的發票機：<b>" + H(CurrentPrinter(null)) + "</b>" + (IsCom(CurrentPrinter(null)) ? "（鮑率 " + baud + "）" : "") + "</p>");
            if (msg != null) sb.Append("<div class='msg'>" + H(msg) + "</div>");
            sb.Append("<h3>Windows 印表機</h3><table><tr><th>名稱</th><th></th></tr>");
            foreach (string p in PrinterSettings.InstalledPrinters)
            {
                sb.Append("<tr" + (p == printerName ? " class='cur'" : "") + "><td>" + H(p) + "</td><td>");
                sb.Append("<a class='b' href='/test?printer=" + U(p) + "'>測試</a> <a class='b' href='/use?printer=" + U(p) + "'>設為發票機</a></td></tr>");
            }
            sb.Append("</table><h3>序列埠（COM）</h3>");
            string[] ports = SerialPort.GetPortNames();
            Array.Sort(ports);
            if (ports.Length == 0) sb.Append("<p>這台電腦沒有 COM 埠。</p>");
            else
            {
                sb.Append("<p>鮑率要和印表機底部 DIP 開關一致；不確定就每個都試。</p><table><tr><th>埠</th><th>測試（鮑率）</th><th></th></tr>");
                int[] bauds = { 9600, 19200, 38400, 115200 };
                foreach (string p in ports)
                {
                    sb.Append("<tr" + (string.Equals(p, printerName, StringComparison.OrdinalIgnoreCase) ? " class='cur'" : "") + "><td>" + H(p) + "</td><td>");
                    foreach (int b in bauds) sb.Append("<a class='b' href='/test?printer=" + U(p) + "&baud=" + b + "'>" + b + "</a>");
                    sb.Append("</td><td>");
                    foreach (int b in bauds) sb.Append("<a class='b' href='/use?printer=" + U(p) + "&baud=" + b + "'>設為發票機 " + b + "</a>");
                    sb.Append("</td></tr>");
                }
                sb.Append("</table>");
            }
            sb.Append("</body></html>");
            return sb.ToString();
        }

        static Dictionary<string, string> ParseQuery(string rawPath)
        {
            var d = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            int q = rawPath.IndexOf('?');
            if (q < 0) return d;
            foreach (string kv in rawPath.Substring(q + 1).Split('&'))
            {
                int e = kv.IndexOf('=');
                string k = e < 0 ? kv : kv.Substring(0, e);
                string v = e < 0 ? "" : kv.Substring(e + 1);
                d[Uri.UnescapeDataString(k.Replace('+', ' '))] = Uri.UnescapeDataString(v.Replace('+', ' '));
            }
            return d;
        }

        static string Q(Dictionary<string, string> qs, string k)
        {
            string v;
            return qs.TryGetValue(k, out v) ? v : "";
        }

        static void RespondHtml(Stream s, string html)
        {
            byte[] body = Encoding.UTF8.GetBytes(html);
            byte[] h = Encoding.ASCII.GetBytes("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + body.Length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n");
            s.Write(h, 0, h.Length);
            s.Write(body, 0, body.Length);
            s.Flush();
        }

        // ---- 最小的 HTTP/1.1 處理 ----
        static byte[] ReadRequest(Stream s, out string method, out string path, out Dictionary<string, string> headers)
        {
            method = null; path = null;
            headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var head = new MemoryStream();
            int state = 0, c;
            while (state < 4 && (c = s.ReadByte()) >= 0)
            {
                head.WriteByte((byte)c);
                if ((state % 2 == 0 && c == '\r') || (state % 2 == 1 && c == '\n')) state++;
                else state = c == '\r' ? 1 : 0;
                if (head.Length > 65536) return null;
            }
            string[] lines = Encoding.ASCII.GetString(head.ToArray()).Split(new[] { "\r\n" }, StringSplitOptions.None);
            string[] first = lines[0].Split(' ');
            if (first.Length < 2) return null;
            for (int i = 1; i < lines.Length; i++)
            {
                int p = lines[i].IndexOf(':');
                if (p > 0) headers[lines[i].Substring(0, p).Trim()] = lines[i].Substring(p + 1).Trim();
            }
            int len = 0;
            string cl;
            if (headers.TryGetValue("Content-Length", out cl)) int.TryParse(cl, out len);
            if (len < 0 || len > 16 * 1024 * 1024) return null;
            var body = new byte[len];
            int read = 0;
            while (read < len)
            {
                int n = s.Read(body, read, len - read);
                if (n <= 0) break;
                read += n;
            }
            method = first[0].ToUpperInvariant();
            path = first[1];
            return body;
        }

        static void Respond(Stream s, int status, string json)
        {
            byte[] body = json == null ? new byte[0] : Encoding.UTF8.GetBytes(json);
            string reason = status == 200 ? "OK" : status == 204 ? "No Content" : status == 404 ? "Not Found" : "Error";
            string head = "HTTP/1.1 " + status + " " + reason + "\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + body.Length + "\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
                "Access-Control-Allow-Headers: Content-Type\r\n" +
                "Access-Control-Allow-Private-Network: true\r\n" +
                "Connection: close\r\n\r\n";
            byte[] h = Encoding.ASCII.GetBytes(head);
            s.Write(h, 0, h.Length);
            s.Write(body, 0, body.Length);
            s.Flush();
        }

        static void Log(string msg)
        {
            try
            {
                string f = Path.Combine(baseDir, "print-agent.log");
                if (File.Exists(f) && new FileInfo(f).Length > 1024 * 1024) File.Delete(f);
                File.AppendAllText(f, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + msg + "\r\n", Encoding.UTF8);
            }
            catch { }
        }
    }

    // winspool RAW 列印（同舊系統 InvPrintPort=NIP 的送法）
    static class RawPrinter
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        class DOCINFO
        {
            [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
        }

        [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern bool OpenPrinter(string name, out IntPtr h, IntPtr defaults);
        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool ClosePrinter(IntPtr h);
        [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
        static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);
        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool EndDocPrinter(IntPtr h);
        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool StartPagePrinter(IntPtr h);
        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool EndPagePrinter(IntPtr h);
        [DllImport("winspool.drv", SetLastError = true)]
        static extern bool WritePrinter(IntPtr h, IntPtr buf, int count, out int written);

        public static void Send(string printer, byte[] data, string docName)
        {
            IntPtr h;
            if (!OpenPrinter(printer, out h, IntPtr.Zero))
                throw new Exception("找不到印表機「" + printer + "」(錯誤 " + Marshal.GetLastWin32Error() + ")");
            IntPtr buf = Marshal.AllocCoTaskMem(data.Length);
            try
            {
                var di = new DOCINFO { pDocName = docName, pDataType = "RAW" };
                if (StartDocPrinter(h, 1, di) == 0) throw new Exception("StartDocPrinter 失敗 (" + Marshal.GetLastWin32Error() + ")");
                StartPagePrinter(h);
                Marshal.Copy(data, 0, buf, data.Length);
                int written;
                bool ok = WritePrinter(h, buf, data.Length, out written);
                EndPagePrinter(h);
                EndDocPrinter(h);
                if (!ok || written != data.Length) throw new Exception("WritePrinter 失敗 (" + Marshal.GetLastWin32Error() + ")");
            }
            finally
            {
                Marshal.FreeCoTaskMem(buf);
                ClosePrinter(h);
            }
        }
    }
}
