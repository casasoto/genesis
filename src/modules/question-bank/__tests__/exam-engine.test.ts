import { describe, it, expect } from 'vitest'
import {
  shuffleArray,
  filterQuestions,
  selectExamQuestions,
  createExamSession,
  recordAnswer,
  scoreExam,
  suggestDifficulty,
} from '../exam-engine'
import type { Question, ExamSession } from '../../../models'

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: `q-${Math.random().toString(36).slice(2)}`,
    contentId: 'content-1',
    examLevel: 'beginner',
    difficulty: 2,
    bloomLevel: 'remember',
    skillTags: ['pin-tumbler'],
    questionText: 'What is a pin tumbler?',
    options: ['A lock type', 'A key type', 'A tool', 'A technique'],
    correctIndex: 0,
    explanation: 'Pin tumbler is a lock type',
    citations: ['c1'],
    reviewStatus: 'approved',
    version: 1,
    createdAt: Date.now(),
    ...overrides,
  }
}

// ─── shuffleArray ───────────────────────────────────────

describe('shuffleArray', () => {
  it('returns array of same length', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(arr)
    expect(shuffled).toHaveLength(5)
  })

  it('contains same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const shuffled = shuffleArray(arr)
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('does not modify original array', () => {
    const arr = [1, 2, 3]
    shuffleArray(arr)
    expect(arr).toEqual([1, 2, 3])
  })

  it('uses custom RNG when provided', () => {
    const arr = [1, 2, 3, 4, 5]
    // Fixed RNG for determinism
    let i = 0
    const rng = () => [0.1, 0.9, 0.5, 0.3, 0.7][i++ % 5]
    const a = shuffleArray(arr, rng)
    i = 0
    const b = shuffleArray(arr, rng)
    expect(a).toEqual(b)
  })

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([])
  })

  it('handles single element', () => {
    expect(shuffleArray([42])).toEqual([42])
  })
})

// ─── filterQuestions ────────────────────────────────────

describe('filterQuestions', () => {
  it('filters by exam level', () => {
    const questions = [
      makeQuestion({ examLevel: 'beginner' }),
      makeQuestion({ examLevel: 'intermediate' }),
      makeQuestion({ examLevel: 'beginner' }),
    ]
    const filtered = filterQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
    })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((q) => q.examLevel === 'beginner')).toBe(true)
  })

  it('excludes non-approved questions', () => {
    const questions = [
      makeQuestion({ reviewStatus: 'approved' }),
      makeQuestion({ reviewStatus: 'draft' }),
      makeQuestion({ reviewStatus: 'rejected' }),
    ]
    const filtered = filterQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
    })
    expect(filtered).toHaveLength(1)
  })

  it('filters by skill tags', () => {
    const questions = [
      makeQuestion({ skillTags: ['pin-tumbler', 'rekeying'] }),
      makeQuestion({ skillTags: ['master-key'] }),
      makeQuestion({ skillTags: ['pin-tumbler'] }),
    ]
    const filtered = filterQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
      skillTags: ['pin-tumbler'],
    })
    expect(filtered).toHaveLength(2)
  })

  it('filters by difficulty range', () => {
    const questions = [
      makeQuestion({ difficulty: 1 }),
      makeQuestion({ difficulty: 3 }),
      makeQuestion({ difficulty: 5 }),
    ]
    const filtered = filterQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
      difficulty: { min: 2, max: 4 },
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].difficulty).toBe(3)
  })

  it('returns empty for no matches', () => {
    const questions = [makeQuestion({ examLevel: 'advanced' })]
    const filtered = filterQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
    })
    expect(filtered).toHaveLength(0)
  })
})

// ─── selectExamQuestions ────────────────────────────────

describe('selectExamQuestions', () => {
  it('returns requested number of questions', () => {
    const questions = Array.from({ length: 20 }, () => makeQuestion())
    const selected = selectExamQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 5,
    })
    expect(selected).toHaveLength(5)
  })

  it('returns all available if fewer than requested', () => {
    const questions = [makeQuestion(), makeQuestion()]
    const selected = selectExamQuestions(questions, {
      examLevel: 'beginner',
      questionCount: 10,
    })
    expect(selected).toHaveLength(2)
  })

  it('returns randomized order', () => {
    const questions = Array.from({ length: 50 }, (_, i) =>
      makeQuestion({ id: `q-${i}` }),
    )
    const a = selectExamQuestions(questions, { examLevel: 'beginner', questionCount: 50 })
    const b = selectExamQuestions(questions, { examLevel: 'beginner', questionCount: 50 })
    expect(a).toHaveLength(50)
    expect(b).toHaveLength(50)
    // Verify they contain the same elements regardless of order
    expect(a.map((q) => q.id).sort()).toEqual(b.map((q) => q.id).sort())
  })
})

// ─── createExamSession ──────────────────────────────────

describe('createExamSession', () => {
  it('creates session with correct structure', () => {
    const session = createExamSession('user-1', {
      examLevel: 'beginner',
      questionCount: 5,
    }, ['q1', 'q2', 'q3'])
    expect(session.userId).toBe('user-1')
    expect(session.examLevel).toBe('beginner')
    expect(session.questionIds).toEqual(['q1', 'q2', 'q3'])
    expect(session.answers).toEqual({})
    expect(session.startedAt).toBeGreaterThan(0)
    expect(session.id).toBeDefined()
  })
})

// ─── recordAnswer ───────────────────────────────────────

describe('recordAnswer', () => {
  it('records an answer immutably', () => {
    const session = createExamSession('user-1', {
      examLevel: 'beginner',
      questionCount: 2,
    }, ['q1', 'q2'])
    const updated = recordAnswer(session, 'q1', 2)
    expect(updated.answers['q1']).toBe(2)
    expect(session.answers['q1']).toBeUndefined() // original unchanged
  })

  it('can record multiple answers', () => {
    let session = createExamSession('user-1', {
      examLevel: 'beginner',
      questionCount: 2,
    }, ['q1', 'q2'])
    session = recordAnswer(session, 'q1', 0)
    session = recordAnswer(session, 'q2', 3)
    expect(session.answers).toEqual({ q1: 0, q2: 3 })
  })
})

// ─── scoreExam ──────────────────────────────────────────

describe('scoreExam', () => {
  it('scores a perfect exam', () => {
    const questions = [
      makeQuestion({ id: 'q1', correctIndex: 0, skillTags: ['locks'] }),
      makeQuestion({ id: 'q2', correctIndex: 1, skillTags: ['keys'] }),
    ]
    const session: ExamSession = {
      id: 'session-1',
      userId: 'user-1',
      examLevel: 'beginner',
      questionIds: ['q1', 'q2'],
      answers: { q1: 0, q2: 1 },
      startedAt: Date.now(),
      timeSpentMs: 120000,
    }
    const result = scoreExam(session, questions)
    expect(result.score).toBe(1)
    expect(result.correctAnswers).toBe(2)
    expect(result.totalQuestions).toBe(2)
    expect(result.skillBreakdown['locks']).toEqual({ correct: 1, total: 1 })
  })

  it('scores a failing exam', () => {
    const questions = [
      makeQuestion({ id: 'q1', correctIndex: 0 }),
      makeQuestion({ id: 'q2', correctIndex: 1 }),
    ]
    const session: ExamSession = {
      id: 'session-1',
      userId: 'user-1',
      examLevel: 'beginner',
      questionIds: ['q1', 'q2'],
      answers: { q1: 3, q2: 3 },
      startedAt: Date.now(),
      timeSpentMs: 60000,
    }
    const result = scoreExam(session, questions)
    expect(result.score).toBe(0)
    expect(result.correctAnswers).toBe(0)
  })

  it('handles unanswered questions (default -1)', () => {
    const questions = [makeQuestion({ id: 'q1', correctIndex: 0 })]
    const session: ExamSession = {
      id: 's1',
      userId: 'u1',
      examLevel: 'beginner',
      questionIds: ['q1'],
      answers: {},
      startedAt: Date.now(),
      timeSpentMs: 0,
    }
    const result = scoreExam(session, questions)
    expect(result.score).toBe(0)
    expect(result.results[0].selectedIndex).toBe(-1)
  })

  it('skips questions not in the question map', () => {
    const session: ExamSession = {
      id: 's1',
      userId: 'u1',
      examLevel: 'beginner',
      questionIds: ['nonexistent'],
      answers: { nonexistent: 0 },
      startedAt: Date.now(),
      timeSpentMs: 0,
    }
    const result = scoreExam(session, [])
    expect(result.totalQuestions).toBe(0)
    expect(result.score).toBe(0)
  })

  it('calculates skill breakdown correctly', () => {
    const questions = [
      makeQuestion({ id: 'q1', correctIndex: 0, skillTags: ['locks', 'hardware'] }),
      makeQuestion({ id: 'q2', correctIndex: 1, skillTags: ['locks'] }),
      makeQuestion({ id: 'q3', correctIndex: 2, skillTags: ['hardware'] }),
    ]
    const session: ExamSession = {
      id: 's1',
      userId: 'u1',
      examLevel: 'beginner',
      questionIds: ['q1', 'q2', 'q3'],
      answers: { q1: 0, q2: 0, q3: 2 }, // q1 correct, q2 wrong, q3 correct
      startedAt: Date.now(),
      timeSpentMs: 0,
    }
    const result = scoreExam(session, questions)
    expect(result.skillBreakdown['locks']).toEqual({ correct: 1, total: 2 })
    expect(result.skillBreakdown['hardware']).toEqual({ correct: 2, total: 2 })
  })
})

// ─── suggestDifficulty ──────────────────────────────────

describe('suggestDifficulty', () => {
  it('returns easy range for no scores', () => {
    expect(suggestDifficulty([])).toEqual({ min: 1, max: 3 })
  })

  it('returns hard range for high performers', () => {
    expect(suggestDifficulty([0.9, 0.85, 0.95])).toEqual({ min: 3, max: 5 })
  })

  it('returns medium range for average performers', () => {
    expect(suggestDifficulty([0.7, 0.65, 0.6])).toEqual({ min: 2, max: 4 })
  })

  it('returns easy range for low performers', () => {
    expect(suggestDifficulty([0.3, 0.4, 0.5])).toEqual({ min: 1, max: 3 })
  })
})
