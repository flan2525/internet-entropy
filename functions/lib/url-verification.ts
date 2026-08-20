export type VerificationInput = {
  url: string
  previousStatus: string
  previousFailures: number
  previousTitleHash?: string | null
  previousBodyHash?: string | null
}

export type VerificationResult = {
  requestedMethod: string
  finalUrl: string | null
  httpStatus: number | null
  redirectCount: number
  contentType: string | null
  title: string | null
  titleHash: string | null
  bodyHash: string | null
  state: 'alive' | 'redirected' | 'moved' | 'temporarily_unavailable' | 'persistent_unavailable' | 'disappeared' | 'replaced_candidate' | 'blocked' | 'unverifiable'
  errorReason: string | null
  robotsStatus: string
  retryCount: number
}

export const classifyVerificationFailure = (result: VerificationResult) => {
  if (result.robotsStatus === 'blocked') return 'robots.txt'
  if (result.errorReason?.includes('SSRF')) return 'SSRF protection rejection'
  if (result.errorReason?.includes('redirect loop') || result.errorReason?.includes('too many redirects')) return 'redirect loop'
  if (result.errorReason?.includes('timeout') || result.errorReason?.includes('aborted')) return 'timeout'
  if (result.httpStatus === 403) return '403'
  if (result.httpStatus === 429) return '429'
  if (result.contentType && !/html|text\//i.test(result.contentType)) return 'unsupported Content-Type'
  if (result.errorReason?.toLowerCase().includes('parse')) return 'parse failure'
  if (result.errorReason?.toLowerCase().includes('javascript')) return 'JavaScript-dependent page'
  return result.errorReason ? 'other' : 'other'
}

const TIMEOUT_MS = 7000
const MAX_REDIRECTS = 5
const MAX_BODY_BYTES = 65536

const sha256 = async (value: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((item) => item.toString(16).padStart(2, '0')).join('')
}

export const isSafePublicUrl = (raw: string) => {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase()
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') return false
    if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host)) return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false
    return Boolean(url.hostname)
  } catch { return false }
}

const readLimitedText = async (response: Response) => {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  while (length < MAX_BODY_BYTES) {
    const part = await reader.read()
    if (part.done) break
    const value = part.value
    const remaining = MAX_BODY_BYTES - length
    chunks.push(value.slice(0, remaining))
    length += Math.min(value.length, remaining)
    if (value.length > remaining) { await reader.cancel(); break }
  }
  const total = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) { total.set(chunk, offset); offset += chunk.length }
  return new TextDecoder().decode(total)
}

const fetchWithRedirects = async (rawUrl: string, method: 'HEAD' | 'GET') => {
  let currentUrl = rawUrl
  let redirectCount = 0
  while (redirectCount <= MAX_REDIRECTS) {
    if (!isSafePublicUrl(currentUrl)) throw new Error('redirect target rejected by SSRF policy')
    const response = await fetch(currentUrl, { method, redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1', 'User-Agent': 'INTERNET-ENTROPY-Research/1.0' }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (response.status < 300 || response.status >= 400) return { response, finalUrl: currentUrl, redirectCount }
    const location = response.headers.get('location')
    if (!location) return { response, finalUrl: currentUrl, redirectCount }
    const nextUrl = new URL(location, currentUrl).toString()
    if (!isSafePublicUrl(nextUrl)) throw new Error('redirect target rejected by SSRF policy')
    currentUrl = nextUrl
    redirectCount += 1
  }
  throw new Error('redirect loop or too many redirects')
}

const robotsAllows = async (rawUrl: string) => {
  const url = new URL(rawUrl)
  const robotsUrl = `${url.origin}/robots.txt`
  if (!isSafePublicUrl(robotsUrl)) return { allowed: false, status: 'rejected' }
  try {
    const response = await fetch(robotsUrl, { method: 'GET', redirect: 'manual', headers: { Accept: 'text/plain', 'User-Agent': 'INTERNET-ENTROPY-Research/1.0' }, signal: AbortSignal.timeout(4000) })
    if (!response.ok) return { allowed: true, status: `not_available_${response.status}` }
    const text = (await response.text()).slice(0, 32768)
    const lines = text.split(/\r?\n/).map((line) => line.replace(/#.*/, '').trim())
    let applies = false
    const rules: string[] = []
    for (const line of lines) {
      const [rawKey, rawValue] = line.split(':', 2)
      const key = rawKey?.trim().toLowerCase()
      const value = rawValue?.trim() ?? ''
      if (key === 'user-agent') applies = value === '*' || value.toLowerCase() === 'internet-entropy-research'
      if (key === 'disallow' && applies) rules.push(value)
    }
    const blocked = rules.some((rule) => rule === '/' || (rule && url.pathname.startsWith(rule)))
    return { allowed: !blocked, status: blocked ? 'blocked' : 'allowed' }
  } catch { return { allowed: true, status: 'check_failed' } }
}

export const verifyUrl = async (input: VerificationInput): Promise<VerificationResult> => {
  if (!isSafePublicUrl(input.url)) return { requestedMethod: 'none', finalUrl: null, httpStatus: null, redirectCount: 0, contentType: null, title: null, titleHash: null, bodyHash: null, state: 'unverifiable', errorReason: 'URL rejected by SSRF policy', robotsStatus: 'rejected', retryCount: 0 }
  const robots = await robotsAllows(input.url)
  if (!robots.allowed) return { requestedMethod: 'robots', finalUrl: input.url, httpStatus: null, redirectCount: 0, contentType: 'text/html', title: null, titleHash: null, bodyHash: null, state: 'blocked', errorReason: 'robots.txt disallows this path', robotsStatus: robots.status, retryCount: 0 }
  try {
    let head = await fetchWithRedirects(input.url, 'HEAD')
    let method = 'HEAD'
    if ([403, 405, 406, 429, 501].includes(head.response.status)) { head = await fetchWithRedirects(input.url, 'GET'); method = 'GET' }
    const contentType = head.response.headers.get('content-type')
    let body = ''
    let title: string | null = null
    let bodyHash: string | null = null
    if (head.response.status >= 200 && head.response.status < 300 && (!contentType || /html|text\//i.test(contentType))) {
      const page = await fetchWithRedirects(head.finalUrl, 'GET')
      method = 'HEAD+GET'
      body = await readLimitedText(page.response)
      const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      title = match?.[1]?.replace(/\s+/g, ' ').trim().slice(0, 500) ?? null
      bodyHash = body ? await sha256(body) : null
      head = { response: page.response, finalUrl: page.finalUrl, redirectCount: Math.max(head.redirectCount, page.redirectCount) }
    }
    const titleHash = title ? await sha256(title) : null
    const status = head.response.status
    const finalUrl = head.finalUrl
    if (status >= 200 && status < 300) {
      const moved = finalUrl !== input.url
      const replaced = Boolean((input.previousTitleHash && titleHash && input.previousTitleHash !== titleHash) || (input.previousBodyHash && bodyHash && input.previousBodyHash !== bodyHash))
      return { requestedMethod: method, finalUrl, httpStatus: status, redirectCount: head.redirectCount, contentType, title, titleHash, bodyHash, state: replaced ? 'replaced_candidate' : moved ? 'moved' : 'alive', errorReason: null, robotsStatus: robots.status, retryCount: 0 }
    }
    if (status === 404 || status === 410) return { requestedMethod: method, finalUrl, httpStatus: status, redirectCount: head.redirectCount, contentType, title, titleHash, bodyHash, state: input.previousFailures >= 1 ? 'disappeared' : 'temporarily_unavailable', errorReason: `HTTP ${status}`, robotsStatus: robots.status, retryCount: 0 }
    if (status >= 500 || status === 408 || status === 429) return { requestedMethod: method, finalUrl, httpStatus: status, redirectCount: head.redirectCount, contentType, title, titleHash, bodyHash, state: input.previousFailures >= 1 ? 'persistent_unavailable' : 'temporarily_unavailable', errorReason: `HTTP ${status}`, robotsStatus: robots.status, retryCount: 0 }
    return { requestedMethod: method, finalUrl, httpStatus: status, redirectCount: head.redirectCount, contentType, title, titleHash, bodyHash, state: 'unverifiable', errorReason: `HTTP ${status}`, robotsStatus: robots.status, retryCount: 0 }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'request failed'
    return { requestedMethod: 'HEAD', finalUrl: null, httpStatus: null, redirectCount: 0, contentType: null, title: null, titleHash: null, bodyHash: null, state: input.previousFailures >= 1 ? 'persistent_unavailable' : 'temporarily_unavailable', errorReason: reason, robotsStatus: robots.status, retryCount: 1 }
  }
}
