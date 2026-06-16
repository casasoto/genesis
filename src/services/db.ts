import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  ContentItem,
  Question,
  Flashcard,
  UserProgress,
  StudyPlan,
  ExamSession,
  LLMCacheEntry,
  TokenUsageRecord,
} from '../models'

export class LocksmithPrepDB extends Dexie {
  content!: Table<ContentItem, string>
  questions!: Table<Question, string>
  flashcards!: Table<Flashcard, string>
  progress!: Table<UserProgress, string>
  studyPlans!: Table<StudyPlan, string>
  examSessions!: Table<ExamSession, string>
  llmCache!: Table<LLMCacheEntry, string>
  tokenUsage!: Table<TokenUsageRecord, string>

  constructor(name = 'LocksmithPrepDB') {
    super(name)
    this.version(1).stores({
      content: 'id, examLevel, *skillTags, difficulty, bloomLevel, reviewStatus, updatedAt',
      questions: 'id, contentId, examLevel, difficulty, bloomLevel, *skillTags, reviewStatus',
      flashcards: 'id, contentId, examLevel, *skillTags, nextReviewAt',
      progress: 'id, userId, contentId, [userId+contentId], lastAttemptAt',
      studyPlans: 'id, userId, examLevel, targetDate',
      examSessions: 'id, userId, examLevel, startedAt',
      llmCache: 'id, promptHash, expiresAt',
      tokenUsage: 'id, provider, timestamp',
    })
  }
}

let dbInstance: LocksmithPrepDB | null = null

export function getDB(name?: string): LocksmithPrepDB {
  if (!dbInstance) {
    dbInstance = new LocksmithPrepDB(name)
  }
  return dbInstance
}

export function resetDB(): void {
  dbInstance = null
}
