import { recordLiveUsage } from '../../lib/budget'
import type { PagesContext } from '../../lib/types'
import { json } from '../../lib/validation'

export const onRequestPost = async ({ request, env }: PagesContext) => {
  if (!env.ENTROPY_DB) return json({ ok: true }, 200)
  const body = await request.json().catch(() => ({})) as { event?: string; lang?: string }
  if (body.event !== 'share') return json({ error: 'unsupported event' }, 400)
  await recordLiveUsage(env.ENTROPY_DB, { started: 0, completed: 0, failed: 0, cacheHits: 0, apiRequests: 0, shared: 1, language: body.lang ?? 'en' })
  return json({ ok: true }, 200, { 'Cache-Control': 'no-store' })
}
