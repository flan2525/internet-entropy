import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchWeb } from '../functions/lib/provider'

const env = { BRAVE_SEARCH_API_KEY: 'test-secret' }

afterEach(() => vi.restoreAllMocks())

describe('Brave provider request contract', () => {
  it('requests 20, preserves more than 10 valid results, and does not log the payload', async () => {
    const results = Array.from({ length: 15 }, (_, index) => ({ title: `Result ${index + 1}`, url: `https://example.com/${index + 1}`, description: `Description ${index + 1}` }))
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const requestUrl = new URL(String(input))
      expect(requestUrl.searchParams.get('count')).toBe('20')
      expect((init?.headers as Record<string, string>)['X-Subscription-Token']).toBe('test-secret')
      return new Response(JSON.stringify({ web: { results } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    const logSpy = vi.spyOn(console, 'log')
    const response = await searchWeb('how to improve sleep', env)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(response.responseResultCount).toBe(15)
    expect(response.items).toHaveLength(15)
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('preserves a full 20-result provider response for official observation', async () => {
    const results = Array.from({ length: 20 }, (_, index) => ({ title: `Result ${index + 1}`, url: `https://example.com/full/${index + 1}`, description: '' }))
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ web: { results } }), { status: 200 }))
    const response = await searchWeb('official top 20', env, { count: 20 })
    expect(response.responseResultCount).toBe(20)
    expect(response.items).toHaveLength(20)
  })
})
