import type { LLMProviderConfig, TokenUsageRecord } from '../models'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCompletionResult {
  text: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
  provider: string
  cached: boolean
}

/** Rate limiter state */
interface RateLimiterState {
  tokens: number
  requests: number
  windowStart: number
}

/** Simple in-memory LRU cache */
export class LLMCache {
  private cache = new Map<string, { response: LLMCompletionResult; expiresAt: number }>()
  private ttlMs: number

  constructor(ttlSeconds: number) {
    this.ttlMs = ttlSeconds * 1000
  }

  get(key: string): LLMCompletionResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return { ...entry.response, cached: true }
  }

  set(key: string, response: LLMCompletionResult): void {
    this.cache.set(key, { response, expiresAt: Date.now() + this.ttlMs })
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/** Hashes a prompt for cache keying */
export function hashPrompt(messages: LLMMessage[]): string {
  const str = JSON.stringify(messages)
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return `prompt_${hash.toString(36)}`
}

/** Provider-agnostic LLM adapter with rate limiting, caching, token tracking */
export class LLMAdapter {
  private config: LLMProviderConfig
  private cache: LLMCache
  private rateLimiter: RateLimiterState
  private usageLog: TokenUsageRecord[] = []
  private fetchFn: typeof fetch

  constructor(config: LLMProviderConfig, fetchImpl?: typeof fetch) {
    this.config = config
    this.cache = new LLMCache(config.cacheTTLSeconds)
    this.rateLimiter = { tokens: 0, requests: 0, windowStart: Date.now() }
    this.fetchFn = fetchImpl ?? fetch
  }

  /** Check and update rate limits. Returns true if request is allowed. */
  checkRateLimit(): boolean {
    const now = Date.now()
    if (now - this.rateLimiter.windowStart > 60_000) {
      this.rateLimiter = { tokens: 0, requests: 0, windowStart: now }
    }
    if (this.rateLimiter.requests >= this.config.maxRequestsPerMinute) {
      return false
    }
    return true
  }

  /** Record token usage after a request */
  private recordUsage(promptTokens: number, completionTokens: number): void {
    this.rateLimiter.tokens += promptTokens + completionTokens
    this.rateLimiter.requests += 1
    this.usageLog.push({
      id: `usage_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      provider: this.config.provider,
      model: this.config.model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      timestamp: Date.now(),
    })
  }

  /** Get total tokens used in the current window */
  getTokenUsage(): { totalTokens: number; totalRequests: number; log: TokenUsageRecord[] } {
    return {
      totalTokens: this.rateLimiter.tokens,
      totalRequests: this.rateLimiter.requests,
      log: [...this.usageLog],
    }
  }

  /** Build the request body based on provider */
  buildRequestBody(messages: LLMMessage[], maxTokens?: number): Record<string, unknown> {
    const mt = maxTokens ?? 1024
    switch (this.config.provider) {
      case 'openai':
        return { model: this.config.model, messages, max_tokens: mt }
      case 'anthropic':
        return {
          model: this.config.model,
          messages: messages.filter((m) => m.role !== 'system'),
          system: messages.find((m) => m.role === 'system')?.content ?? '',
          max_tokens: mt,
        }
      case 'local':
      case 'custom':
        return { model: this.config.model, messages, max_tokens: mt }
      default:
        return { model: this.config.model, messages, max_tokens: mt }
    }
  }

  /** Build headers based on provider */
  buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) {
      switch (this.config.provider) {
        case 'openai':
          headers['Authorization'] = `Bearer ${this.config.apiKey}`
          break
        case 'anthropic':
          headers['x-api-key'] = this.config.apiKey
          headers['anthropic-version'] = '2023-06-01'
          break
        default:
          headers['Authorization'] = `Bearer ${this.config.apiKey}`
      }
    }
    return headers
  }

  /** Parse the response based on provider format */
  parseResponse(data: Record<string, unknown>): LLMCompletionResult {
    switch (this.config.provider) {
      case 'openai': {
        const choices = data.choices as Array<{ message: { content: string } }>
        const usage = data.usage as { prompt_tokens: number; completion_tokens: number; total_tokens: number }
        return {
          text: choices[0]?.message?.content ?? '',
          promptTokens: usage?.prompt_tokens ?? 0,
          completionTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          model: this.config.model,
          provider: this.config.provider,
          cached: false,
        }
      }
      case 'anthropic': {
        const content = data.content as Array<{ text: string }>
        const usage = data.usage as { input_tokens: number; output_tokens: number }
        return {
          text: content[0]?.text ?? '',
          promptTokens: usage?.input_tokens ?? 0,
          completionTokens: usage?.output_tokens ?? 0,
          totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
          model: this.config.model,
          provider: this.config.provider,
          cached: false,
        }
      }
      default: {
        const text = (data.text as string) ?? (data.response as string) ?? JSON.stringify(data)
        return {
          text,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          model: this.config.model,
          provider: this.config.provider,
          cached: false,
        }
      }
    }
  }

  /** Main completion method */
  async complete(messages: LLMMessage[], maxTokens?: number): Promise<LLMCompletionResult> {
    const cacheKey = hashPrompt(messages)
    const cached = this.cache.get(cacheKey)
    if (cached) return cached

    if (!this.checkRateLimit()) {
      throw new Error('Rate limit exceeded. Please wait before making another request.')
    }

    const body = this.buildRequestBody(messages, maxTokens)
    const headers = this.buildHeaders()

    const res = await this.fetchFn(this.config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`LLM API error: ${res.status} ${res.statusText}`)
    }

    const data = (await res.json()) as Record<string, unknown>
    const result = this.parseResponse(data)

    this.recordUsage(result.promptTokens, result.completionTokens)
    this.cache.set(cacheKey, result)

    return result
  }

  /** Get the underlying config (read-only) */
  getConfig(): Readonly<LLMProviderConfig> {
    return { ...this.config }
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear()
  }
}
