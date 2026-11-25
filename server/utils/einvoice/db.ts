// 本機資料庫：SQLite 單一檔案（Node 22 內建 node:sqlite，不用另外裝資料庫服務）。
// 檔案位置：環境變數 EINVOICE_DB_PATH，預設 ./data/einvoice.sqlite（相對於啟動資料夾）。
// 只有公司伺服器這一個程式會寫它，配號用交易包起來就不會重號。
import type { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let _db: DatabaseSync | null = null

export function dbPath() {
  return resolve(process.env.EINVOICE_DB_PATH || './data/einvoice.sqlite')
}

export function db() {
  if (_db) return _db
  const file = dbPath()
  mkdirSync(dirname(file), { recursive: true })
  // 用到才載入 node:sqlite，讓同一份程式部署到 Netlify（沒用到發票）時不受影響
  const { DatabaseSync: Sqlite } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite')
  const d = new Sqlite(file)
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;      -- 斷電也不掉資料
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    -- 號碼批次：一批 500 張。next_no > end_no 表示用完。依 id 順序使用（先取的先用）。
    CREATE TABLE IF NOT EXISTS einvoice_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roc_year INTEGER NOT NULL,
      term TEXT NOT NULL,              -- 05-06
      track TEXT NOT NULL,             -- 字軌 BM
      start_no INTEGER NOT NULL,
      end_no INTEGER NOT NULL,
      next_no INTEGER NOT NULL,
      apply_no TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (track, start_no)
    );

    -- 發票本身兼上傳佇列（時間一律存 ISO UTC 字串，可以直接比大小）
    CREATE TABLE IF NOT EXISTS einvoices (
      invoice_no TEXT PRIMARY KEY,     -- BM92177850
      batch_id INTEGER NOT NULL REFERENCES einvoice_batches(id),
      roc_year INTEGER NOT NULL,
      term TEXT NOT NULL,
      order_no TEXT NOT NULL DEFAULT '',
      order_id TEXT NOT NULL,          -- 上傳用 OrderId（12 碼）
      issued_at TEXT NOT NULL,
      random_code TEXT NOT NULL,
      total INTEGER NOT NULL,
      free_tax INTEGER NOT NULL DEFAULT 0,
      buyer_id TEXT NOT NULL DEFAULT '',
      carrier TEXT NOT NULL DEFAULT '',
      npoban TEXT NOT NULL DEFAULT '',
      pay_way TEXT NOT NULL DEFAULT '1',
      items TEXT NOT NULL,             -- JSON
      upload_status TEXT NOT NULL DEFAULT 'pending',  -- pending / done
      upload_attempts INTEGER NOT NULL DEFAULT 0,
      upload_next_at TEXT NOT NULL,
      upload_msg TEXT,
      uploaded_at TEXT,
      cancel_status TEXT,                             -- NULL / pending / done / needApproval
      cancel_reason TEXT,
      cancel_at TEXT,
      cancel_attempts INTEGER NOT NULL DEFAULT 0,
      cancel_next_at TEXT,
      cancel_msg TEXT,
      cancelled_at TEXT
    );
    CREATE INDEX IF NOT EXISTS einvoices_upload_idx ON einvoices (upload_status, upload_next_at);
    CREATE INDEX IF NOT EXISTS einvoices_cancel_idx ON einvoices (cancel_status, cancel_next_at);

    -- 待取號的申請號等小設定
    CREATE TABLE IF NOT EXISTS einvoice_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `)
  _db = d
  return d
}

/** 同步交易（中間不能 await） */
export function tx<T>(fn: (d: DatabaseSync) => T): T {
  const d = db()
  d.exec('BEGIN IMMEDIATE')
  try {
    const r = fn(d)
    d.exec('COMMIT')
    return r
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

export const nowIso = () => new Date().toISOString()
export const minutesLater = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

/** 線上備份成一個新檔（VACUUM INTO），用來每晚備份 */
export function backupTo(file: string) {
  db().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`)
}
