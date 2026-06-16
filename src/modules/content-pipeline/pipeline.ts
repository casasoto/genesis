import type { ContentItem, Question, ReviewStatus, BloomLevel, Difficulty, ExamLevel } from '../../models'
import { v4 as uuidv4 } from 'uuid'

/** Content creation input — what authors submit */
export interface ContentDraft {
  title: string
  body: string
  mediaType: ContentItem['mediaType']
  mediaUrl?: string
  examLevel: ExamLevel
  skillTags: string[]
  difficulty: Difficulty
  bloomLevel: BloomLevel
  learningObjective: string
  sourceId: string
  citations: string[]
}

/** Validation result for content */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** Validate a content draft before submission */
export function validateContentDraft(draft: ContentDraft): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!draft.title || draft.title.trim().length === 0) {
    errors.push('Title is required')
  }
  if (draft.title && draft.title.length > 200) {
    errors.push('Title must be 200 characters or fewer')
  }
  if (!draft.body || draft.body.trim().length < 10) {
    errors.push('Body must be at least 10 characters')
  }
  if (!draft.skillTags || draft.skillTags.length === 0) {
    errors.push('At least one skill tag is required')
  }
  if (!draft.learningObjective || draft.learningObjective.trim().length === 0) {
    errors.push('Learning objective is required')
  }
  if (!draft.sourceId || draft.sourceId.trim().length === 0) {
    errors.push('Source ID is required for provenance tracking')
  }
  if (draft.mediaType !== 'text' && !draft.mediaUrl) {
    warnings.push('Non-text content should have a media URL')
  }
  if (draft.citations.length === 0) {
    warnings.push('Consider adding citations for verifiability')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Create a ContentItem from a validated draft */
export function createContentItem(draft: ContentDraft): ContentItem {
  const now = Date.now()
  return {
    id: uuidv4(),
    title: draft.title,
    body: draft.body,
    mediaType: draft.mediaType,
    mediaUrl: draft.mediaUrl,
    examLevel: draft.examLevel,
    skillTags: draft.skillTags,
    difficulty: draft.difficulty,
    bloomLevel: draft.bloomLevel,
    learningObjective: draft.learningObjective,
    sourceId: draft.sourceId,
    citations: draft.citations,
    reviewStatus: 'draft',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}

/** Transition content through the editorial workflow */
export function transitionStatus(
  current: ReviewStatus,
  action: 'submit' | 'approve' | 'reject' | 'archive' | 'revise',
): ReviewStatus | null {
  const transitions: Record<string, Record<string, ReviewStatus>> = {
    draft: { submit: 'pending_review' },
    pending_review: { approve: 'approved', reject: 'rejected' },
    rejected: { revise: 'draft', archive: 'archived' },
    approved: { archive: 'archived', revise: 'draft' },
    archived: { revise: 'draft' },
  }
  return transitions[current]?.[action] ?? null
}

/** Generate question stubs covering Bloom's taxonomy levels */
export function generateQuestionStubs(
  content: ContentItem,
  bloomLevels: BloomLevel[],
): Array<Omit<Question, 'id' | 'createdAt'>> {
  const bloomPrompts: Record<BloomLevel, string> = {
    remember: 'What is',
    understand: 'Explain how',
    apply: 'How would you use',
    analyze: 'Compare and contrast',
    evaluate: 'Assess the effectiveness of',
    create: 'Design a solution for',
  }

  return bloomLevels.map((level) => ({
    contentId: content.id,
    examLevel: content.examLevel,
    difficulty: content.difficulty,
    bloomLevel: level,
    skillTags: content.skillTags,
    questionText: `${bloomPrompts[level]} ${content.title.toLowerCase()}?`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    explanation: `Refer to: ${content.title}`,
    citations: [content.id],
    reviewStatus: 'draft' as ReviewStatus,
    version: 1,
  }))
}

/** Batch import content items with validation */
export function batchValidate(drafts: ContentDraft[]): {
  valid: ContentDraft[]
  invalid: Array<{ draft: ContentDraft; errors: string[] }>
} {
  const valid: ContentDraft[] = []
  const invalid: Array<{ draft: ContentDraft; errors: string[] }> = []

  for (const draft of drafts) {
    const result = validateContentDraft(draft)
    if (result.valid) {
      valid.push(draft)
    } else {
      invalid.push({ draft, errors: result.errors })
    }
  }

  return { valid, invalid }
}
