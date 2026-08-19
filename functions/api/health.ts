import type { PagesContext } from '../lib/types'
import { json } from '../lib/validation'

export const onRequestGet = async ({ env }: PagesContext) => json({ ok: true, database: Boolean(env.ENTROPY_DB), searchProvider: Boolean(env.BRAVE_SEARCH_API_KEY), version: '2026.08.mvp.1' })
