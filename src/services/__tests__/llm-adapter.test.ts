import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMAdapter, LLMCache, hashPrompt } from '../llm-adapter'
import type { LLMMessage } from '../llm-adapter'
import type { LLMProviderConfig } from '../../models'

function makeConfig(overrides: Partial<LLMProviderConfig> = {}): LLMProviderConfig {
  return {
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: 'test-key',
    model: 'gpt-4',
    maxTokensPerMinute: 10000,
    maxRequestsPerMinute: 60,
    cacheTTLSeconds: 300,
    ...overrides,
  }
}

function mockFetch(data: Record<string, unknown>, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  }) as unknown as typeof fetch
}

// ─── LLMCache ───────────────────────────────────────────

describe('LLMCache', () => {
  it('stores and retrieves entries', () => {
    const cache = new LLMCache(60)
    const result = { text: 'hello', promptTokens: 10, completionTokens: 5, totalTokens: 15, model: 'gpt-4', provider: 'openai', cached: false }
    cache.set('key1', result)
    const retrieved = cache.get('key1')
    expect(retrieved).not.toBeNull()
    expect(retrieved!.text).toBe('hello')
    expect(retrieved!.cached).toBe(true)
  })

  it('returns null for missing keys', () => {
    const cache = new LLMCache(60)
    expect(cache.get('nonexistent')).toBeNull()
  })

  it('expires entries after TTL', async () => {
    const cache = new LLMCache(0) // 0 second TTL → 0ms
    const result = { text: 'hello', promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'gpt-4', provider: 'openai', cached: false }
    cache.set('key1', result)
    // Wait 1ms to guarantee expiration
    await new Promise((r) => setTimeout(r, 1))
    expect(cache.get('key1')).toBeNull()
  })

  it('clears all entries', () => {
    const cache = new LLMCache(300)
    const result = { text: 'hello', promptTokens: 0, completionTokens: 0, totalTokens: 0, model: 'gpt-4', provider: 'openai', cached: false }
    cache.set('key1', result)
    cache.set('key2', result)
    expect(cache.size).toBe(2)
    cache.clear()
    expect(cache.size).toBe(0)
  })
})

// ─── hashPrompt ─────────────────────────────────────────

describe('hashPrompt', () => {
  it('returns consistent hashes for same input', () => {
    const msgs: LLMMessage[] = [{ role: 'user', content: 'hello' }]
    expect(hashPrompt(msgs)).toBe(hashPrompt(msgs))
  })

  it('returns different hashes for different input', () => {
    const a: LLMMessage[] = [{ role: 'user', content: 'hello' }]
    const b: LLMMessage[] = [{ role: 'user', content: 'world' }]
    expect(hashPrompt(a)).not.toBe(hashPrompt(b))
  })

  it('returns a string starting with prompt_', () => {
    const msgs: LLMMessage[] = [{ role: 'user', content: 'test' }]
    expect(hashPrompt(msgs)).toMatch(/^prompt_/)
  })
})

// ─── LLMAdapter ─────────────────────────────────────────

describe('LLMAdapter', () => {
  let config: LLMProviderConfig

  beforeEach(() => {
    config = makeConfig()
  })

  describe('buildHeaders', () => {
    it('sets Authorization Bearer for openai', () => {
      const adapter = new LLMAdapter(config)
      const headers = adapter.buildHeaders()
      expect(headers['Authorization']).toBe('Bearer test-key')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('sets x-api-key for anthropic', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'anthropic', apiKey: 'ant-key' }))
      const headers = adapter.buildHeaders()
      expect(headers['x-api-key']).toBe('ant-key')
      expect(headers['anthropic-version']).toBe('2023-06-01')
    })

    it('uses Bearer for custom/local providers', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'local', apiKey: 'local-key' }))
      const headers = adapter.buildHeaders()
      expect(headers['Authorization']).toBe('Bearer local-key')
    })

    it('omits auth headers when no apiKey', () => {
      const adapter = new LLMAdapter(makeConfig({ apiKey: undefined }))
      const headers = adapter.buildHeaders()
      expect(headers['Authorization']).toBeUndefined()
    })
  })

  describe('buildRequestBody', () => {
    it('builds openai format', () => {
      const adapter = new LLMAdapter(config)
      const msgs: LLMMessage[] = [{ role: 'user', content: 'hello' }]
      const body = adapter.buildRequestBody(msgs, 512)
      expect(body).toEqual({ model: 'gpt-4', messages: msgs, max_tokens: 512 })
    })

    it('builds anthropic format with system extraction', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'anthropic' }))
      const msgs: LLMMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hello' },
      ]
      const body = adapter.buildRequestBody(msgs, 256)
      expect(body.system).toBe('You are helpful')
      expect(body.messages).toEqual([{ role: 'user', content: 'hello' }])
    })

    it('defaults max_tokens to 1024', () => {
      const adapter = new LLMAdapter(config)
      const body = adapter.buildRequestBody([{ role: 'user', content: 'test' }])
      expect(body.max_tokens).toBe(1024)
    })
  })

  describe('parseResponse', () => {
    it('parses openai response format', () => {
      const adapter = new LLMAdapter(config)
      const data = {
        choices: [{ message: { content: 'Hello!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }
      const result = adapter.parseResponse(data)
      expect(result.text).toBe('Hello!')
      expect(result.promptTokens).toBe(10)
      expect(result.completionTokens).toBe(5)
      expect(result.totalTokens).toBe(15)
    })

    it('parses anthropic response format', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'anthropic' }))
      const data = {
        content: [{ text: 'Bonjour!' }],
        usage: { input_tokens: 8, output_tokens: 3 },
      }
      const result = adapter.parseResponse(data)
      expect(result.text).toBe('Bonjour!')
      expect(result.promptTokens).toBe(8)
      expect(result.completionTokens).toBe(3)
      expect(result.totalTokens).toBe(11)
    })

    it('handles custom/local response with text field', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'local' }))
      const data = { text: 'Local response' }
      const result = adapter.parseResponse(data)
      expect(result.text).toBe('Local response')
    })

    it('falls back to JSON.stringify for unknown format', () => {
      const adapter = new LLMAdapter(makeConfig({ provider: 'custom' }))
      const data = { foo: 'bar' }
      const result = adapter.parseResponse(data)
      expect(result.text).toBe('{"foo":"bar"}')
    })
  })

  describe('checkRateLimit', () => {
    it('allows requests within limit', () => {
      const adapter = new LLMAdapter(makeConfig({ maxRequestsPerMinute: 10 }))
      expect(adapter.checkRateLimit()).toBe(true)
    })

    it('rejects when rate limit exceeded', async () => {
      const fetchMock = mockFetch({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
      const adapter = new LLMAdapter(makeConfig({ maxRequestsPerMinute: 1 }), fetchMock)

      // First request should succeed
      await adapter.complete([{ role: 'user', content: 'first' }])
      // Second should fail rate limit
      expect(adapter.checkRateLimit()).toBe(false)
    })
  })

  describe('complete', () => {
    it('makes API call and returns parsed result', async () => {
      const responseData = {
        choices: [{ message: { content: 'Response text' } }],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      }
      const fetchMock = mockFetch(responseData)
      const adapter = new LLMAdapter(config, fetchMock)

      const result = await adapter.complete([{ role: 'user', content: 'hello' }])
      expect(result.text).toBe('Response text')
      expect(result.cached).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('returns cached result on second call with same messages', async () => {
      const responseData = {
        choices: [{ message: { content: 'Cached!' } }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }
      const fetchMock = mockFetch(responseData)
      const adapter = new LLMAdapter(config, fetchMock)

      const msgs: LLMMessage[] = [{ role: 'user', content: 'hello' }]
      await adapter.complete(msgs)
      const second = await adapter.complete(msgs)
      expect(second.cached).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('throws on API error', async () => {
      const fetchMock = mockFetch({}, 500)
      const adapter = new LLMAdapter(config, fetchMock)

      await expect(adapter.complete([{ role: 'user', content: 'fail' }])).rejects.toThrow('LLM API error')
    })

    it('throws when rate limited', async () => {
      const responseData = {
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }
      const fetchMock = mockFetch(responseData)
      const adapter = new LLMAdapter(makeConfig({ maxRequestsPerMinute: 1 }), fetchMock)

      await adapter.complete([{ role: 'user', content: 'first' }])
      await expect(adapter.complete([{ role: 'user', content: 'second' }])).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('getTokenUsage', () => {
    it('tracks token usage across requests', async () => {
      const fetchMock = mockFetch({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      })
      const adapter = new LLMAdapter(config, fetchMock)

      await adapter.complete([{ role: 'user', content: 'hello' }])
      const usage = adapter.getTokenUsage()
      expect(usage.totalTokens).toBe(30)
      expect(usage.totalRequests).toBe(1)
      expect(usage.log).toHaveLength(1)
    })
  })

  describe('getConfig', () => {
    it('returns a copy of the config', () => {
      const adapter = new LLMAdapter(config)
      const returned = adapter.getConfig()
      expect(returned.provider).toBe('openai')
      expect(returned).not.toBe(config) // different object
    })
  })
})
