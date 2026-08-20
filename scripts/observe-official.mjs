const baseUrl = process.env.PUBLIC_APP_URL
const secret = process.env.OBSERVATION_CRON_SECRET
const runType = process.env.OBSERVATION_RUN_TYPE ?? 'verification'
const panelId = process.env.OBSERVATION_PANEL_ID ?? 'en-us-core-v1'
const runKey = process.env.OBSERVATION_RUN_KEY ?? `manual-${Date.now()}`
if (!baseUrl || !secret) {
  console.error('PUBLIC_APP_URL and OBSERVATION_CRON_SECRET are required. Secret values are never printed.')
  process.exit(1)
}
const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/admin/observe`, { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'X-Observation-Run-Type': runType, 'X-Observation-Panel': panelId, 'X-Observation-Run-Key': runKey, Accept: 'application/json' } })
console.log(`official observation: HTTP ${response.status}`)
console.log(await response.text())
if (!response.ok) process.exit(1)
