import type { PagesContext } from './lib/types'

export const onRequest = async ({ request, next }: PagesContext) => {
  const path = new URL(request.url).pathname
  const isSharedLivePage = /^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?live\/[0-9a-f-]{36}\/?$/i.test(path)
  const response = await next()
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isSharedLivePage) headers.set('X-Robots-Tag', 'noindex, nofollow')
  headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://api.search.brave.com; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}
