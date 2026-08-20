const baseUrl = process.env.PUBLIC_APP_URL
const secret = process.env.OBSERVATION_CRON_SECRET
if (!baseUrl || !secret) {
  console.error('PUBLIC_APP_URL and OBSERVATION_CRON_SECRET are required. Secret values are never printed.')
  process.exit(1)
}
const root = baseUrl.replace(/\/$/, '')
let total = 0
let remaining = 1
const states = {}
for (let attempt = 0; attempt < 20 && remaining > 0; attempt += 1) {
  const response = await fetch(`${root}/api/admin/verify?limit=100`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } })
  const payload = await response.json()
  if (!response.ok) {
    console.error(`url verification: HTTP ${response.status}`)
    console.error(JSON.stringify(payload))
    process.exit(1)
  }
  total += payload.checked ?? 0
  remaining = payload.remaining ?? 0
  for (const [key, value] of Object.entries(payload.states ?? {})) states[key] = (states[key] ?? 0) + value
  if ((payload.checked ?? 0) === 0) break
}
console.log(JSON.stringify({ ok: true, httpChecks: total, remaining, states }))
