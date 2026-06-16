import { describe, it, expect } from 'vitest'
import {
  createFlashcard,
  calculateNextReview,
  reviewFlashcard,
  getDueCards,
  prioritizeCards,
  calculateRetentionStats,
} from '../spaced-repetition'
import type { Flashcard } from '../../../models'

const MS_PER_DAY = 86_400_000

function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'card-1',
    contentId: 'content-1',
    examLevel: 'beginner',
    front: 'What is a pin tumbler?',
    back: 'A lock mechanism using spring-loaded pins.',
    skillTags: ['pin-tumbler'],
    difficulty: 2,
    nextReviewAt: Date.now(),
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  }
}

// ─── createFlashcard ────────────────────────────────────

describe('createFlashcard', () => {
  it('creates card with default spaced-repetition params', () => {
    const card = createFlashcard({
      contentId: 'c1',
      examLevel: 'beginner',
      front: 'Q?',
      back: 'A.',
      skillTags: ['locks'],
      difficulty: 3,
    })
    expect(card.id).toBeDefined()
    expect(card.front).toBe('Q?')
    expect(card.back).toBe('A.')
    expect(card.easeFactor).toBe(2.5)
    expect(card.repetitions).toBe(0)
    expect(card.interval).toBe(0)
  })
})

// ─── calculateNextReview (SM-2 algorithm) ───────────────

describe('calculateNextReview', () => {
  it('sets interval to 1 day on first successful review', () => {
    const card = makeCard({ repetitions: 0, interval: 0 })
    const result = calculateNextReview(card, 4)
    expect(result.interval).toBe(1)
    expect(result.repetitions).toBe(1)
  })

  it('sets interval to 6 days on second successful review', () => {
    const card = makeCard({ repetitions: 1, interval: 1 })
    const result = calculateNextReview(card, 4)
    expect(result.interval).toBe(6)
    expect(result.repetitions).toBe(2)
  })

  it('multiplies interval by ease factor on subsequent reviews', () => {
    const card = makeCard({ repetitions: 2, interval: 6, easeFactor: 2.5 })
    const result = calculateNextReview(card, 4)
    expect(result.interval).toBe(15) // round(6 * 2.5)
    expect(result.repetitions).toBe(3)
  })

  it('resets on failure (quality < 3)', () => {
    const card = makeCard({ repetitions: 5, interval: 30, easeFactor: 2.5 })
    const result = calculateNextReview(card, 2)
    expect(result.interval).toBe(0)
    expect(result.repetitions).toBe(0)
  })

  it('decreases ease factor on difficulty', () => {
    const card = makeCard({ easeFactor: 2.5 })
    const result = calculateNextReview(card, 3)
    expect(result.easeFactor).toBeLessThan(2.5)
  })

  it('increases ease factor on easy response', () => {
    const card = makeCard({ easeFactor: 2.5 })
    const result = calculateNextReview(card, 5)
    expect(result.easeFactor).toBeGreaterThan(2.5)
  })

  it('never drops ease factor below 1.3', () => {
    const card = makeCard({ easeFactor: 1.3 })
    const result = calculateNextReview(card, 0)
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('calculates nextReviewAt based on interval', () => {
    const now = 1000000
    const card = makeCard({ repetitions: 0 })
    const result = calculateNextReview(card, 4, now)
    expect(result.nextReviewAt).toBe(now + 1 * MS_PER_DAY)
  })
})

// ─── reviewFlashcard ────────────────────────────────────

describe('reviewFlashcard', () => {
  it('returns updated card immutably', () => {
    const card = makeCard()
    const updated = reviewFlashcard(card, 4)
    expect(updated).not.toBe(card)
    expect(updated.repetitions).toBe(1)
    expect(card.repetitions).toBe(0) // original unchanged
  })

  it('preserves non-SR fields', () => {
    const card = makeCard({ front: 'Q?', back: 'A.', contentId: 'c1' })
    const updated = reviewFlashcard(card, 5)
    expect(updated.front).toBe('Q?')
    expect(updated.back).toBe('A.')
    expect(updated.contentId).toBe('c1')
  })
})

// ─── getDueCards ────────────────────────────────────────

describe('getDueCards', () => {
  it('returns cards that are due', () => {
    const now = 1000000
    const cards = [
      makeCard({ id: '1', nextReviewAt: now - 1000 }),
      makeCard({ id: '2', nextReviewAt: now + 1000 }),
      makeCard({ id: '3', nextReviewAt: now }),
    ]
    const due = getDueCards(cards, now)
    expect(due).toHaveLength(2)
    expect(due.map((c) => c.id)).toContain('1')
    expect(due.map((c) => c.id)).toContain('3')
  })

  it('returns empty when nothing is due', () => {
    const now = 1000000
    const cards = [makeCard({ nextReviewAt: now + MS_PER_DAY })]
    expect(getDueCards(cards, now)).toHaveLength(0)
  })

  it('returns all cards when all overdue', () => {
    const now = 1000000
    const cards = [
      makeCard({ id: '1', nextReviewAt: 0 }),
      makeCard({ id: '2', nextReviewAt: 500000 }),
    ]
    expect(getDueCards(cards, now)).toHaveLength(2)
  })
})

// ─── prioritizeCards ────────────────────────────────────

describe('prioritizeCards', () => {
  it('sorts overdue cards first', () => {
    const cards = [
      makeCard({ id: 'future', nextReviewAt: 2000 }),
      makeCard({ id: 'past', nextReviewAt: 500 }),
      makeCard({ id: 'now', nextReviewAt: 1000 }),
    ]
    const sorted = prioritizeCards(cards)
    expect(sorted[0].id).toBe('past')
    expect(sorted[1].id).toBe('now')
    expect(sorted[2].id).toBe('future')
  })

  it('sorts by ease factor as tiebreaker (harder first)', () => {
    const cards = [
      makeCard({ id: 'easy', nextReviewAt: 1000, easeFactor: 2.5 }),
      makeCard({ id: 'hard', nextReviewAt: 1000, easeFactor: 1.5 }),
    ]
    const sorted = prioritizeCards(cards)
    expect(sorted[0].id).toBe('hard')
    expect(sorted[1].id).toBe('easy')
  })

  it('does not modify original array', () => {
    const cards = [
      makeCard({ id: 'b', nextReviewAt: 2000 }),
      makeCard({ id: 'a', nextReviewAt: 1000 }),
    ]
    prioritizeCards(cards)
    expect(cards[0].id).toBe('b') // unchanged
  })
})

// ─── calculateRetentionStats ────────────────────────────

describe('calculateRetentionStats', () => {
  it('categorizes cards correctly', () => {
    const cards = [
      makeCard({ repetitions: 0 }),                      // new
      makeCard({ repetitions: 3, interval: 10 }),         // learning
      makeCard({ repetitions: 10, interval: 30 }),        // mature
      makeCard({ repetitions: 8, interval: 25 }),         // mature
    ]
    const stats = calculateRetentionStats(cards)
    expect(stats.totalCards).toBe(4)
    expect(stats.new).toBe(1)
    expect(stats.learning).toBe(1)
    expect(stats.mature).toBe(2)
  })

  it('calculates average ease factor', () => {
    const cards = [
      makeCard({ easeFactor: 2.0 }),
      makeCard({ easeFactor: 3.0 }),
    ]
    const stats = calculateRetentionStats(cards)
    expect(stats.averageEase).toBe(2.5)
  })

  it('handles empty deck', () => {
    const stats = calculateRetentionStats([])
    expect(stats.totalCards).toBe(0)
    expect(stats.averageEase).toBe(0)
  })
})
