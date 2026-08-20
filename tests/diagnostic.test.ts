import { describe, expect, it } from 'vitest'
import { isCronAuthorized } from '../functions/api/admin/diagnose'

describe('diagnostic API authentication', () => {
  it('requires the Pages cron secret and does not accept an absent secret', () => {
    const request = new Request('https://example.test/api/admin/diagnose', { method: 'POST', headers: { Authorization: 'Bearer cron-secret' } })
    expect(isCronAuthorized(request, 'cron-secret')).toBe(true)
    expect(isCronAuthorized(request, undefined)).toBe(false)
    expect(isCronAuthorized(new Request(request.url, { method: 'POST' }), 'cron-secret')).toBe(false)
  })
})
