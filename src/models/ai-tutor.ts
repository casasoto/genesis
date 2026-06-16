/** AI Tutor response schema — matches the spec's JSON output format */
export interface TutorResponse {
  title: string
  summary: string
  tools_required: string[]
  steps: TutorStep[]
  pitfalls: string[]
  quiz_questions: TutorQuizQuestion[]
  confidence: number
  sources: string[]
}

export interface TutorStep {
  step: number
  action: string
  citation: string[]
}

export interface TutorQuizQuestion {
  q: string
  options: string[]
  answer_index: number
  explanation: string
  citation: string[]
}

/** Configuration for the AI tutor's behavior per exam level */
export interface TutorPersona {
  examLevel: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  ragIndexId: string
}

/** LLM provider configuration — provider-agnostic */
export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'local' | 'custom'
  apiUrl: string
  apiKey?: string
  model: string
  maxTokensPerMinute: number
  maxRequestsPerMinute: number
  cacheTTLSeconds: number
}

/** A cached LLM response */
export interface LLMCacheEntry {
  id: string
  promptHash: string
  response: string
  provider: string
  model: string
  tokensUsed: number
  createdAt: number
  expiresAt: number
}

/** Token usage tracking */
export interface TokenUsageRecord {
  id: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  timestamp: number
}
