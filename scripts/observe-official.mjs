const baseUrl = process.env.PUBLIC_APP_URL
const secret = process.env.OBSERVATION_CRON_SECRET
if (!baseUrl || !secret) {
  console.error('PUBLIC_APP_URL and OBSERVATION_CRON_SECRET are required. Secret values are never printed.')
  process.exit(1)
}
const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/observe`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' } })
console.log(`official observation: HTTP ${response.status}`)
console.log(await response.text())
if (!response.ok) process.exit(1)
