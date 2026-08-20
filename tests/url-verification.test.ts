import { describe, expect, it } from 'vitest'
import { isSafePublicUrl } from '../functions/lib/url-verification'

describe('URL verification safety', () => {
  it('rejects local, private, metadata, credentialed, and unsupported URLs', () => {
    expect(isSafePublicUrl('https://example.com/page')).toBe(true)
    expect(isSafePublicUrl('http://localhost:8788/')).toBe(false)
    expect(isSafePublicUrl('http://127.0.0.1/')).toBe(false)
    expect(isSafePublicUrl('http://169.254.169.254/latest/meta-data')).toBe(false)
    expect(isSafePublicUrl('http://192.168.1.1/')).toBe(false)
    expect(isSafePublicUrl('https://user:password@example.com/')).toBe(false)
    expect(isSafePublicUrl('file:///C:/secret.txt')).toBe(false)
  })
})
