import { URL } from 'node:url'

const baseUrl = process.env.PUBLIC_APP_URL
const secret = process.env.OBSERVATION_CRON_SECRET
if (!baseUrl || !secret) throw new Error('PUBLIC_APP_URL and OBSERVATION_CRON_SECRET are required')
const response = await fetch(new URL('/api/admin/diagnose', baseUrl), { method: 'POST', headers: { Authorization: `Bearer ${secret}` } })
const payload = await response.json()
const safe = {
  workflowHttpStatus: response.status,
  ok: payload?.ok === true,
  requestedCount: payload?.requestedCount,
  braveWebResultsCount: payload?.braveWebResultsCount,
  validResultCount: payload?.validResultCount,
  top10Count: payload?.top10Count,
  top20Availability: payload?.top20Availability,
  paginationRequested: payload?.paginationRequested,
  responseBodyLogged: payload?.responseBodyLogged === false,
  apiKeyLogged: payload?.apiKeyLogged === false,
  cronSecretLogged: payload?.cronSecretLogged === false,
}
console.log(JSON.stringify(safe, null, 2))
if (!response.ok || !safe.ok) process.exit(1)
