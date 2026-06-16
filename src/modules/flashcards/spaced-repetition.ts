import type { Flashcard } from '../../models'
import { v4 as uuidv4 } from 'uuid'
import type { ExamLevel, Difficulty } from '../../models'

/** SM-2 quality ratings */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5

const MIN_EASE_FACTOR = 1.3
const MS_PER_DAY = 86_400_000

/** Create a new flashcard with default spaced-repetition params */
export function createFlashcard(params: {
  contentId: string
  examLevel: ExamLevel
  front: string
  back: string
  skillTags: string[]
  difficulty: Difficulty
}): Flashcard {
  return {
    id: uuidv4(),
    contentId: params.contentId,
    examLevel: params.examLevel,
    front: params.front,
    back: params.back,
    skillTags: params.skillTags,
    difficulty: params.difficulty,
    nextReviewAt: Date.now(),
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
  }
}

/** SM-2 algorithm: calculate next review interval and ease factor */
export function calculateNextReview(
  card: Flashcard,
  quality: Quality,
  now?: number,
): { interval: number; easeFactor: number; repetitions: number; nextReviewAt: number } {
  const current = now ?? Date.now()
  let { interval, easeFactor, repetitions } = card

  if (quality < 3) {
    // Reset on failure
    repetitions = 0
    interval = 0
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetitions += 1
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < MIN_EASE_FACTOR) easeFactor = MIN_EASE_FACTOR

  const nextReviewAt = current + interval * MS_PER_DAY

  return { interval, easeFactor, repetitions, nextReviewAt }
}

/** Apply review result to a flashcard, returning updated card */
export function reviewFlashcard(card: Flashcard, quality: Quality, now?: number): Flashcard {
  const { interval, easeFactor, repetitions, nextReviewAt } = calculateNextReview(card, quality, now)
  return { ...card, interval, easeFactor, repetitions, nextReviewAt }
}

/** Get cards due for review */
export function getDueCards(cards: Flashcard[], now?: number): Flashcard[] {
  const current = now ?? Date.now()
  return cards.filter((c) => c.nextReviewAt <= current)
}

/** Sort cards by priority: overdue first, then by ease factor (harder first) */
export function prioritizeCards(cards: Flashcard[]): Flashcard[] {
  return [...cards].sort((a, b) => {
    const overdueDiff = a.nextReviewAt - b.nextReviewAt
    if (overdueDiff !== 0) return overdueDiff
    return a.easeFactor - b.easeFactor
  })
}

/** Calculate retention stats */
export function calculateRetentionStats(cards: Flashcard[]): {
  totalCards: number
  mature: number
  learning: number
  new: number
  averageEase: number
} {
  let mature = 0
  let learning = 0
  let newCards = 0
  let totalEase = 0

  for (const card of cards) {
    totalEase += card.easeFactor
    if (card.repetitions === 0) newCards++
    else if (card.interval >= 21) mature++
    else learning++
  }

  return {
    totalCards: cards.length,
    mature,
    learning,
    new: newCards,
    averageEase: cards.length > 0 ? totalEase / cards.length : 0,
  }
}
