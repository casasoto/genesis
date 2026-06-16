import type { Question, ExamSession, ExamLevel } from '../../models'
import { v4 as uuidv4 } from 'uuid'

export interface ExamConfig {
  examLevel: ExamLevel
  questionCount: number
  timeLimitMs?: number
  skillTags?: string[]
  difficulty?: { min: number; max: number }
}

export interface AnswerResult {
  questionId: string
  selectedIndex: number
  correctIndex: number
  isCorrect: boolean
}

export interface ExamResult {
  sessionId: string
  totalQuestions: number
  correctAnswers: number
  score: number
  timeSpentMs: number
  results: AnswerResult[]
  skillBreakdown: Record<string, { correct: number; total: number }>
}

/** Shuffle array using Fisher-Yates */
export function shuffleArray<T>(array: T[], rng?: () => number): T[] {
  const result = [...array]
  const random = rng ?? Math.random
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Filter questions by exam config criteria */
export function filterQuestions(questions: Question[], config: ExamConfig): Question[] {
  return questions.filter((q) => {
    if (q.examLevel !== config.examLevel) return false
    if (q.reviewStatus !== 'approved') return false
    if (config.skillTags && config.skillTags.length > 0) {
      if (!config.skillTags.some((tag) => q.skillTags.includes(tag))) return false
    }
    if (config.difficulty) {
      if (q.difficulty < config.difficulty.min || q.difficulty > config.difficulty.max) return false
    }
    return true
  })
}

/** Select and randomize questions for an exam */
export function selectExamQuestions(questions: Question[], config: ExamConfig): Question[] {
  const eligible = filterQuestions(questions, config)
  const shuffled = shuffleArray(eligible)
  return shuffled.slice(0, config.questionCount)
}

/** Create a new exam session */
export function createExamSession(userId: string, config: ExamConfig, selectedQuestionIds: string[]): ExamSession {
  return {
    id: uuidv4(),
    userId,
    examLevel: config.examLevel,
    questionIds: selectedQuestionIds,
    answers: {},
    startedAt: Date.now(),
    timeSpentMs: 0,
  }
}

/** Record an answer in the session */
export function recordAnswer(session: ExamSession, questionId: string, selectedIndex: number): ExamSession {
  return {
    ...session,
    answers: { ...session.answers, [questionId]: selectedIndex },
  }
}

/** Score a completed exam */
export function scoreExam(session: ExamSession, questions: Question[]): ExamResult {
  const questionMap = new Map(questions.map((q) => [q.id, q]))
  const results: AnswerResult[] = []
  const skillBreakdown: Record<string, { correct: number; total: number }> = {}

  for (const qId of session.questionIds) {
    const question = questionMap.get(qId)
    if (!question) continue

    const selectedIndex = session.answers[qId] ?? -1
    const isCorrect = selectedIndex === question.correctIndex

    results.push({
      questionId: qId,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
    })

    for (const tag of question.skillTags) {
      if (!skillBreakdown[tag]) skillBreakdown[tag] = { correct: 0, total: 0 }
      skillBreakdown[tag].total += 1
      if (isCorrect) skillBreakdown[tag].correct += 1
    }
  }

  const correctAnswers = results.filter((r) => r.isCorrect).length
  const totalQuestions = results.length

  return {
    sessionId: session.id,
    totalQuestions,
    correctAnswers,
    score: totalQuestions > 0 ? correctAnswers / totalQuestions : 0,
    timeSpentMs: session.timeSpentMs,
    results,
    skillBreakdown,
  }
}

/** Adaptive difficulty: suggest next difficulty based on recent scores */
export function suggestDifficulty(recentScores: number[]): { min: number; max: number } {
  if (recentScores.length === 0) return { min: 1, max: 3 }
  const avg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
  if (avg >= 0.8) return { min: 3, max: 5 }
  if (avg >= 0.6) return { min: 2, max: 4 }
  return { min: 1, max: 3 }
}
