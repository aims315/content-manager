// キャプションCSVの共通パーサ（caption-block と caption-bulk-dialog で共用）

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// カンマ・改行・ダブルクォート対応のCSVパース
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += c
    }
  }
  row.push(field)
  rows.push(row)
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// 説明文などから最初のURLを抽出
export function extractUrl(text?: string | null): string | null {
  if (!text) return null
  const m = text.match(/https?:\/\/[^\s　）)」』】、。]+/)
  return m ? m[0] : null
}

// テキスト貼り付け（--- 区切り）を候補配列に
export function parseTextCandidates(raw: string): { text: string; memo: string }[] {
  return raw.split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean).map((t) => ({ text: t, memo: '' }))
}

export interface CaptionGroup { title: string; cands: { text: string; memo: string }[] }

// キャプションアプリ形式(投稿名,キャプション,…) / タスクアプリ形式(タイトル,…,備考) 両対応。
// 投稿名(タイトル)ごとにグルーピングして返す。
export function parseCaptionCsv(raw: string): CaptionGroup[] {
  const rows = parseCsv(raw)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  const find = (re: RegExp) => header.findIndex((h) => re.test(h))
  const ti = find(/投稿名|タイトル|title/i)
  let ci = find(/備考|キャプション|本文|caption|text/i)
  const mi = find(/メモ|ステップ名|memo|note|label/i)
  const hasHeader = ti >= 0 || ci >= 0
  const data = hasHeader ? rows.slice(1) : rows
  if (ci < 0) ci = hasHeader ? -1 : 1 // ヘッダ無しは2列目を本文とみなす
  if (ci < 0) return []

  const map = new Map<string, { text: string; memo: string }[]>()
  for (const r of data) {
    const text = (r[ci] ?? '').trim()
    if (!text) continue
    const title = ti >= 0 ? ((r[ti] ?? '').trim() || '（無題）') : '（無題）'
    const memo = mi >= 0 ? (r[mi] ?? '').trim() : ''
    if (!map.has(title)) map.set(title, [])
    map.get(title)!.push({ text, memo })
  }
  return [...map.entries()].map(([title, cands]) => ({ title, cands }))
}
