import type { LLMMessage } from '../../services/llm-adapter'
import type { LLMAdapter } from '../../services/llm-adapter'
import type { TutorResponse, TutorPersona } from '../../models'
import { DEFAULT_PERSONAS, buildUserPrompt, validateTutorResponse } from './prompts'

export interface TutorQuery {
  question: string
  examLevel: string
  contextDocs: Array<{ id: string; text: string }>
}

export interface TutorResult {
  response: TutorResponse | null
  errors: string[]
  rawText: string
  needsHumanReview: boolean
}

/** Blocked topics — never generate content about these */
const BLOCKED_PATTERNS = [
  /bypass/i,
  /pick.*lock.*without.*permission/i,
  /break.*into/i,
  /illegal/i,
  /unauthorized.*entry/i,
]

export function isBlockedQuery(question: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(question))
}

export function getPersona(examLevel: string): TutorPersona {
  return DEFAULT_PERSONAS[examLevel] ?? DEFAULT_PERSONAS['beginner']
}

/** Parse LLM text response into structured TutorResponse */
export function parseTutorResponse(text: string): { parsed: TutorResponse | null; errors: string[] } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { parsed: null, errors: ['No JSON object found in response'] }
    }
    const obj = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const validationErrors = validateTutorResponse(obj)
    if (validationErrors.length > 0) {
      return { parsed: null, errors: validationErrors }
    }
    return { parsed: obj as unknown as TutorResponse, errors: [] }
  } catch (e) {
    return { parsed: null, errors: [`JSON parse error: ${(e as Error).message}`] }
  }
}

/** Main tutor service */
export class TutorService {
  private adapter: LLMAdapter

  constructor(adapter: LLMAdapter) {
    this.adapter = adapter
  }

  async ask(query: TutorQuery): Promise<TutorResult> {
    if (isBlockedQuery(query.question)) {
      return {
        response: null,
        errors: ['This question involves restricted content. Please rephrase your question about legitimate locksmith techniques.'],
        rawText: '',
        needsHumanReview: false,
      }
    }

    const persona = getPersona(query.examLevel)
    const userPrompt = buildUserPrompt(query.question, query.contextDocs)
    const messages: LLMMessage[] = [
      { role: 'system', content: persona.systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const result = await this.adapter.complete(messages, persona.maxTokens)
    const { parsed, errors } = parseTutorResponse(result.text)

    const needsHumanReview = !parsed || (parsed.confidence !== undefined && parsed.confidence < 0.6)

    return {
      response: parsed,
      errors,
      rawText: result.text,
      needsHumanReview,
    }
  }
}
