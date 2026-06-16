import { describe, it, expect, vi } from 'vitest'
import { TutorService, isBlockedQuery, getPersona, parseTutorResponse } from '../tutor-service'
import { validateTutorResponse, buildUserPrompt, DEFAULT_PERSONAS, BASE_SYSTEM_PROMPT } from '../prompts'
import { LLMAdapter } from '../../../services/llm-adapter'
import type { LLMProviderConfig } from '../../../models'

function makeMockAdapter(responseText: string): LLMAdapter {
  const config: LLMProviderConfig = {
    provider: 'openai',
    apiUrl: 'https://api.test/v1/chat/completions',
    model: 'gpt-4',
    maxTokensPerMinute: 10000,
    maxRequestsPerMinute: 60,
    cacheTTLSeconds: 300,
  }
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({
      choices: [{ message: { content: responseText } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  }) as unknown as typeof fetch
  return new LLMAdapter(config, fetchMock)
}

// ─── isBlockedQuery ─────────────────────────────────────

describe('isBlockedQuery', () => {
  it('blocks bypass queries', () => {
    expect(isBlockedQuery('How to bypass a deadbolt')).toBe(true)
  })

  it('blocks pick lock without permission queries', () => {
    expect(isBlockedQuery('How to pick a lock without permission from the owner')).toBe(true)
  })

  it('blocks break into queries', () => {
    expect(isBlockedQuery('How to break into a car')).toBe(true)
  })

  it('blocks illegal queries', () => {
    expect(isBlockedQuery('illegal entry techniques')).toBe(true)
  })

  it('blocks unauthorized entry', () => {
    expect(isBlockedQuery('unauthorized entry methods')).toBe(true)
  })

  it('allows legitimate locksmith questions', () => {
    expect(isBlockedQuery('How does a pin tumbler lock work?')).toBe(false)
  })

  it('allows rekeying questions', () => {
    expect(isBlockedQuery('Steps to rekey a Schlage lock')).toBe(false)
  })

  it('allows master key system questions', () => {
    expect(isBlockedQuery('Explain master key system design')).toBe(false)
  })
})

// ─── getPersona ─────────────────────────────────────────

describe('getPersona', () => {
  it('returns beginner persona for beginner level', () => {
    const persona = getPersona('beginner')
    expect(persona.examLevel).toBe('beginner')
    expect(persona.temperature).toBe(0.3)
  })

  it('returns intermediate persona', () => {
    const persona = getPersona('intermediate')
    expect(persona.examLevel).toBe('intermediate')
    expect(persona.temperature).toBe(0.4)
  })

  it('returns advanced persona', () => {
    const persona = getPersona('advanced')
    expect(persona.examLevel).toBe('advanced')
    expect(persona.maxTokens).toBe(3072)
  })

  it('falls back to beginner for unknown levels', () => {
    const persona = getPersona('nonexistent')
    expect(persona.examLevel).toBe('beginner')
  })
})

// ─── validateTutorResponse ──────────────────────────────

describe('validateTutorResponse', () => {
  it('returns no errors for valid response', () => {
    const valid = {
      title: 'Test',
      summary: 'Summary',
      steps: [{ step: 1, action: 'Do thing', citation: ['content_1'] }],
      confidence: 0.85,
      sources: ['content_1'],
    }
    expect(validateTutorResponse(valid)).toEqual([])
  })

  it('detects missing required fields', () => {
    const errors = validateTutorResponse({})
    expect(errors.length).toBeGreaterThanOrEqual(5)
    expect(errors.some((e) => e.includes('title'))).toBe(true)
    expect(errors.some((e) => e.includes('summary'))).toBe(true)
    expect(errors.some((e) => e.includes('steps'))).toBe(true)
    expect(errors.some((e) => e.includes('confidence'))).toBe(true)
    expect(errors.some((e) => e.includes('sources'))).toBe(true)
  })

  it('validates confidence range', () => {
    const errors = validateTutorResponse({
      title: 'T', summary: 'S', steps: [], confidence: 1.5, sources: [],
    })
    expect(errors.some((e) => e.includes('Confidence must be between'))).toBe(true)
  })

  it('validates steps is an array', () => {
    const errors = validateTutorResponse({
      title: 'T', summary: 'S', steps: 'not-array', confidence: 0.5, sources: [],
    })
    expect(errors.some((e) => e.includes('Steps must be an array'))).toBe(true)
  })

  it('validates sources is an array', () => {
    const errors = validateTutorResponse({
      title: 'T', summary: 'S', steps: [], confidence: 0.5, sources: 'not-array',
    })
    expect(errors.some((e) => e.includes('Sources must be an array'))).toBe(true)
  })
})

// ─── buildUserPrompt ────────────────────────────────────

describe('buildUserPrompt', () => {
  it('includes context docs and question', () => {
    const prompt = buildUserPrompt('How does a pin tumbler work?', [
      { id: 'content_1', text: 'Pin tumbler locks use spring-loaded pins.' },
    ])
    expect(prompt).toContain('content_1')
    expect(prompt).toContain('Pin tumbler locks use spring-loaded pins.')
    expect(prompt).toContain('How does a pin tumbler work?')
  })

  it('handles empty context', () => {
    const prompt = buildUserPrompt('Question?', [])
    expect(prompt).toContain('Question?')
    expect(prompt).toContain('CONTEXT FROM VERIFIED CORPUS')
  })
})

// ─── parseTutorResponse ─────────────────────────────────

describe('parseTutorResponse', () => {
  it('parses valid JSON response', () => {
    const json = JSON.stringify({
      title: 'Pin Tumbler',
      summary: 'How it works',
      tools_required: ['key gauge'],
      steps: [{ step: 1, action: 'Insert key', citation: ['c1'] }],
      pitfalls: ['Avoid forcing'],
      quiz_questions: [],
      confidence: 0.9,
      sources: ['c1'],
    })
    const { parsed, errors } = parseTutorResponse(json)
    expect(errors).toEqual([])
    expect(parsed).not.toBeNull()
    expect(parsed!.title).toBe('Pin Tumbler')
    expect(parsed!.confidence).toBe(0.9)
  })

  it('extracts JSON from surrounding text', () => {
    const text = 'Here is the answer:\n' + JSON.stringify({
      title: 'T', summary: 'S', steps: [], confidence: 0.7, sources: [],
    }) + '\nEnd.'
    const { parsed, errors } = parseTutorResponse(text)
    expect(errors).toEqual([])
    expect(parsed!.title).toBe('T')
  })

  it('returns errors for invalid JSON', () => {
    const { parsed, errors } = parseTutorResponse('not json at all')
    expect(parsed).toBeNull()
    expect(errors[0]).toContain('No JSON object found')
  })

  it('returns errors for broken JSON', () => {
    const { parsed, errors } = parseTutorResponse('{ broken json }}}')
    expect(parsed).toBeNull()
    expect(errors[0]).toContain('JSON parse error')
  })

  it('returns validation errors for incomplete JSON', () => {
    const { parsed, errors } = parseTutorResponse('{"title": "T"}')
    expect(parsed).toBeNull()
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ─── DEFAULT_PERSONAS / BASE_SYSTEM_PROMPT ──────────────

describe('prompts constants', () => {
  it('BASE_SYSTEM_PROMPT contains ethical guardrails', () => {
    expect(BASE_SYSTEM_PROMPT).toContain('Never provide instructions for illegal bypassing')
    expect(BASE_SYSTEM_PROMPT).toContain('does NOT guarantee passing')
  })

  it('DEFAULT_PERSONAS has beginner, intermediate, advanced', () => {
    expect(DEFAULT_PERSONAS).toHaveProperty('beginner')
    expect(DEFAULT_PERSONAS).toHaveProperty('intermediate')
    expect(DEFAULT_PERSONAS).toHaveProperty('advanced')
  })

  it('all personas include the base system prompt', () => {
    for (const persona of Object.values(DEFAULT_PERSONAS)) {
      expect(persona.systemPrompt).toContain('LocksmithPrep Tutor')
    }
  })
})

// ─── TutorService ───────────────────────────────────────

describe('TutorService', () => {
  it('blocks restricted queries', async () => {
    const adapter = makeMockAdapter('')
    const tutor = new TutorService(adapter)
    const result = await tutor.ask({
      question: 'How to bypass a lock',
      examLevel: 'beginner',
      contextDocs: [],
    })
    expect(result.response).toBeNull()
    expect(result.errors[0]).toContain('restricted content')
    expect(result.needsHumanReview).toBe(false)
  })

  it('returns parsed response for legitimate query', async () => {
    const validResponse = JSON.stringify({
      title: 'Pin Tumbler',
      summary: 'How it works',
      tools_required: [],
      steps: [{ step: 1, action: 'Study', citation: ['c1'] }],
      pitfalls: [],
      quiz_questions: [],
      confidence: 0.85,
      sources: ['c1'],
    })
    const adapter = makeMockAdapter(validResponse)
    const tutor = new TutorService(adapter)
    const result = await tutor.ask({
      question: 'How does a pin tumbler lock work?',
      examLevel: 'beginner',
      contextDocs: [{ id: 'c1', text: 'Pin tumbler info' }],
    })
    expect(result.response).not.toBeNull()
    expect(result.response!.title).toBe('Pin Tumbler')
    expect(result.needsHumanReview).toBe(false)
  })

  it('flags low-confidence responses for human review', async () => {
    const lowConfidence = JSON.stringify({
      title: 'Uncertain',
      summary: 'Not sure',
      steps: [],
      confidence: 0.3,
      sources: [],
    })
    const adapter = makeMockAdapter(lowConfidence)
    const tutor = new TutorService(adapter)
    const result = await tutor.ask({
      question: 'Obscure topic',
      examLevel: 'beginner',
      contextDocs: [],
    })
    expect(result.needsHumanReview).toBe(true)
  })

  it('flags unparseable responses for human review', async () => {
    const adapter = makeMockAdapter('This is not JSON')
    const tutor = new TutorService(adapter)
    const result = await tutor.ask({
      question: 'Valid question',
      examLevel: 'beginner',
      contextDocs: [],
    })
    expect(result.response).toBeNull()
    expect(result.needsHumanReview).toBe(true)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
