import type { TutorPersona } from '../../models'

/** Base system prompt — ethical guardrails and output format baked in */
export const BASE_SYSTEM_PROMPT = `You are 'LocksmithPrep Tutor,' an instructional AI assistant grounded in the app's verified content corpus. Provide clear, stepwise explanations and cite content IDs for every factual claim. If uncertain, state limitations and recommend human-reviewed sources. Never provide instructions for illegal bypassing of locks.

IMPORTANT DISCLAIMERS:
- This tool does NOT guarantee passing any exam.
- Always recommend supervised, hands-on practice.
- Follow all applicable laws and ethics codes.

Respond ONLY with valid JSON matching this schema:
{
  "title": "string",
  "summary": "string",
  "tools_required": ["string"],
  "steps": [{"step": number, "action": "string", "citation": ["content_id_..."]}],
  "pitfalls": ["string"],
  "quiz_questions": [{"q": "string", "options": ["string"], "answer_index": number, "explanation": "string", "citation": ["content_id_..."]}],
  "confidence": number (0-1),
  "sources": ["content_id_..."]
}`

/** Default persona configs per exam level */
export const DEFAULT_PERSONAS: Record<string, TutorPersona> = {
  beginner: {
    examLevel: 'beginner',
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nYou are helping a beginner-level student. Use simple language, explain foundational concepts, and provide plenty of step-by-step guidance. Focus on ALOA beginner exam topics: lock types, basic keying, pin tumbler operation, and hand tools.`,
    temperature: 0.3,
    maxTokens: 2048,
    ragIndexId: 'beginner-content',
  },
  intermediate: {
    examLevel: 'intermediate',
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nYou are helping an intermediate-level student. Assume foundational knowledge. Focus on advanced keying systems, master key systems, high-security locks, and commercial applications.`,
    temperature: 0.4,
    maxTokens: 2048,
    ragIndexId: 'intermediate-content',
  },
  advanced: {
    examLevel: 'advanced',
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n\nYou are helping an advanced-level student at a master-locksmith level. Discuss complex topics including safe/vault mechanisms, electronic access control, institutional security, and forensic locksmithing.`,
    temperature: 0.5,
    maxTokens: 3072,
    ragIndexId: 'advanced-content',
  },
}

/** Build a user prompt with context from RAG retrieval */
export function buildUserPrompt(userQuestion: string, contextDocs: Array<{ id: string; text: string }>): string {
  const contextBlock = contextDocs.map((doc) => `[${doc.id}]: ${doc.text}`).join('\n\n')
  return `CONTEXT FROM VERIFIED CORPUS:\n${contextBlock}\n\nUSER QUESTION:\n${userQuestion}`
}

/** Validate that a response contains required fields */
export function validateTutorResponse(parsed: Record<string, unknown>): string[] {
  const errors: string[] = []
  const requiredFields = ['title', 'summary', 'steps', 'confidence', 'sources']
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      errors.push(`Missing required field: ${field}`)
    }
  }
  if (typeof parsed.confidence === 'number' && (parsed.confidence < 0 || parsed.confidence > 1)) {
    errors.push('Confidence must be between 0 and 1')
  }
  if (parsed.steps && !Array.isArray(parsed.steps)) {
    errors.push('Steps must be an array')
  }
  if (parsed.sources && !Array.isArray(parsed.sources)) {
    errors.push('Sources must be an array')
  }
  return errors
}
