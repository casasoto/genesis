import { describe, it, expect } from 'vitest'
import {
  validateContentDraft,
  createContentItem,
  transitionStatus,
  generateQuestionStubs,
  batchValidate,
} from '../pipeline'
import type { ContentDraft } from '../pipeline'
import type { ContentItem } from '../../../models'

function makeDraft(overrides: Partial<ContentDraft> = {}): ContentDraft {
  return {
    title: 'Pin Tumbler Locks',
    body: 'Pin tumbler locks are the most common lock type in residential use.',
    mediaType: 'text',
    examLevel: 'beginner',
    skillTags: ['pin-tumbler'],
    difficulty: 2,
    bloomLevel: 'understand',
    learningObjective: 'Understand pin tumbler mechanism',
    sourceId: 'aloa-manual-2024',
    citations: ['ref-1'],
    ...overrides,
  }
}

function makeContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'content-1',
    title: 'Pin Tumbler Basics',
    body: 'Pin tumbler locks...',
    mediaType: 'text',
    examLevel: 'beginner',
    skillTags: ['pin-tumbler', 'hardware'],
    difficulty: 2,
    bloomLevel: 'understand',
    learningObjective: 'Understand pin tumbler mechanism',
    sourceId: 'src-1',
    citations: ['ref-1'],
    reviewStatus: 'approved',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

// ─── validateContentDraft ───────────────────────────────

describe('validateContentDraft', () => {
  it('validates a correct draft', () => {
    const result = validateContentDraft(makeDraft())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects empty title', () => {
    const result = validateContentDraft(makeDraft({ title: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Title is required'))).toBe(true)
  })

  it('rejects title over 200 characters', () => {
    const result = validateContentDraft(makeDraft({ title: 'x'.repeat(201) }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('200 characters'))).toBe(true)
  })

  it('rejects body shorter than 10 chars', () => {
    const result = validateContentDraft(makeDraft({ body: 'short' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('at least 10'))).toBe(true)
  })

  it('rejects empty skill tags', () => {
    const result = validateContentDraft(makeDraft({ skillTags: [] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('skill tag'))).toBe(true)
  })

  it('rejects empty learning objective', () => {
    const result = validateContentDraft(makeDraft({ learningObjective: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Learning objective'))).toBe(true)
  })

  it('rejects empty source ID', () => {
    const result = validateContentDraft(makeDraft({ sourceId: '' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Source ID'))).toBe(true)
  })

  it('warns on non-text content without media URL', () => {
    const result = validateContentDraft(makeDraft({ mediaType: 'image', mediaUrl: undefined }))
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('media URL'))).toBe(true)
  })

  it('warns on missing citations', () => {
    const result = validateContentDraft(makeDraft({ citations: [] }))
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('citations'))).toBe(true)
  })

  it('passes text content without media URL', () => {
    const result = validateContentDraft(makeDraft({ mediaType: 'text', mediaUrl: undefined }))
    expect(result.valid).toBe(true)
    expect(result.warnings.every((w) => !w.includes('media URL'))).toBe(true)
  })
})

// ─── createContentItem ──────────────────────────────────

describe('createContentItem', () => {
  it('creates item with draft status and version 1', () => {
    const item = createContentItem(makeDraft())
    expect(item.id).toBeDefined()
    expect(item.reviewStatus).toBe('draft')
    expect(item.version).toBe(1)
    expect(item.createdAt).toBeGreaterThan(0)
    expect(item.updatedAt).toBe(item.createdAt)
  })

  it('preserves all draft fields', () => {
    const draft = makeDraft({ title: 'Custom Title', difficulty: 4 })
    const item = createContentItem(draft)
    expect(item.title).toBe('Custom Title')
    expect(item.difficulty).toBe(4)
    expect(item.examLevel).toBe('beginner')
  })
})

// ─── transitionStatus ───────────────────────────────────

describe('transitionStatus', () => {
  it('draft → submit → pending_review', () => {
    expect(transitionStatus('draft', 'submit')).toBe('pending_review')
  })

  it('pending_review → approve → approved', () => {
    expect(transitionStatus('pending_review', 'approve')).toBe('approved')
  })

  it('pending_review → reject → rejected', () => {
    expect(transitionStatus('pending_review', 'reject')).toBe('rejected')
  })

  it('rejected → revise → draft', () => {
    expect(transitionStatus('rejected', 'revise')).toBe('draft')
  })

  it('rejected → archive → archived', () => {
    expect(transitionStatus('rejected', 'archive')).toBe('archived')
  })

  it('approved → archive → archived', () => {
    expect(transitionStatus('approved', 'archive')).toBe('archived')
  })

  it('approved → revise → draft', () => {
    expect(transitionStatus('approved', 'revise')).toBe('draft')
  })

  it('archived → revise → draft', () => {
    expect(transitionStatus('archived', 'revise')).toBe('draft')
  })

  it('returns null for invalid transitions', () => {
    expect(transitionStatus('draft', 'approve')).toBeNull()
    expect(transitionStatus('approved', 'submit')).toBeNull()
    expect(transitionStatus('archived', 'approve')).toBeNull()
  })
})

// ─── generateQuestionStubs ──────────────────────────────

describe('generateQuestionStubs', () => {
  it('generates stubs for specified Bloom levels', () => {
    const content = makeContentItem({ title: 'Master Keys' })
    const stubs = generateQuestionStubs(content, ['remember', 'apply', 'create'])
    expect(stubs).toHaveLength(3)
    expect(stubs[0].bloomLevel).toBe('remember')
    expect(stubs[0].questionText).toContain('What is')
    expect(stubs[1].bloomLevel).toBe('apply')
    expect(stubs[1].questionText).toContain('How would you use')
    expect(stubs[2].bloomLevel).toBe('create')
    expect(stubs[2].questionText).toContain('Design a solution')
  })

  it('includes content references in stubs', () => {
    const content = makeContentItem({ id: 'c-42' })
    const stubs = generateQuestionStubs(content, ['understand'])
    expect(stubs[0].contentId).toBe('c-42')
    expect(stubs[0].citations).toContain('c-42')
  })

  it('sets review status to draft', () => {
    const content = makeContentItem()
    const stubs = generateQuestionStubs(content, ['remember'])
    expect(stubs[0].reviewStatus).toBe('draft')
  })

  it('handles empty bloom levels', () => {
    const content = makeContentItem()
    const stubs = generateQuestionStubs(content, [])
    expect(stubs).toHaveLength(0)
  })
})

// ─── batchValidate ──────────────────────────────────────

describe('batchValidate', () => {
  it('separates valid and invalid drafts', () => {
    const drafts = [
      makeDraft({ title: 'Good Draft' }),
      makeDraft({ title: '' }), // invalid
      makeDraft({ title: 'Another Good One' }),
    ]
    const { valid, invalid } = batchValidate(drafts)
    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].errors.some((e) => e.includes('Title'))).toBe(true)
  })

  it('handles all valid', () => {
    const drafts = [makeDraft(), makeDraft()]
    const { valid, invalid } = batchValidate(drafts)
    expect(valid).toHaveLength(2)
    expect(invalid).toHaveLength(0)
  })

  it('handles all invalid', () => {
    const drafts = [makeDraft({ title: '' }), makeDraft({ body: 'x' })]
    const { valid, invalid } = batchValidate(drafts)
    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(2)
  })

  it('handles empty batch', () => {
    const { valid, invalid } = batchValidate([])
    expect(valid).toHaveLength(0)
    expect(invalid).toHaveLength(0)
  })
})
