const PRIVATE_MARKERS = [/https?:\/\//i, /www\./i, /@/, /\b\d{2,4}[-. ]\d{2,4}[-. ]\d{3,4}\b/]

export const validateQuery = (value: unknown): { ok: true; value: string } | { ok: false; reason: string } => {
  if (typeof value !== 'string') return { ok: false, reason: '検索語を入力して。' }
  const valueTrimmed = value.trim().replace(/\s+/g, ' ')
  if (valueTrimmed.length < 2 || valueTrimmed.length > 60) return { ok: false, reason: '検索語は2〜60文字で入力して。' }
  if (PRIVATE_MARKERS.some((pattern) => pattern.test(valueTrimmed))) return { ok: false, reason: 'URL、個人情報、機密情報ではなく検索語を入力して。' }
  return { ok: true, value: valueTrimmed }
}

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } })
