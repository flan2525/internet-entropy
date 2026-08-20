import type { PagesContext } from '../lib/types'
import { json } from '../lib/validation'

export const onRequestGet = async ({ env }: PagesContext) => json({ ok: true, database: Boolean(env.ENTROPY_DB), searchProvider: Boolean(env.BRAVE_SEARCH_API_KEY), panelId: 'en-us-core-v1', version: '2026.08.en-core.1' })
