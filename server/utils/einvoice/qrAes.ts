// QR Code 的 AES 驗證碼與隨機碼（財政部規格，見 invoice-research/BK35發票完整規格.md §4.2）
import { createCipheriv, randomInt } from 'node:crypto'

// 財政部公開的固定 IV（QREncrypter.dll 內同值）
const IV = Buffer.from('Dt8lyToo17X/XkXaQvihuA==', 'base64')

/** 發票號碼(10，不含 -) + 隨機碼(4) → 24 碼 Base64。金鑰是 32 碼 hex，只放後端環境變數。 */
export function invoiceQrAes(invNo: string, random4: string, hexKey: string) {
  if (!/^[0-9a-fA-F]{32}$/.test(hexKey)) throw new Error('QR AES 金鑰格式不對（需要 32 碼 hex）')
  const c = createCipheriv('aes-128-cbc', Buffer.from(hexKey, 'hex'), IV)
  return Buffer.concat([c.update(invNo.replace('-', '') + random4, 'utf8'), c.final()]).toString('base64')
}

/** 0000–9999 */
export const genRandomCode = () => String(randomInt(0, 10000)).padStart(4, '0')
