/** Exam levels supported by the platform. Extensible for future certifications. */
export type ExamLevel = 'beginner' | 'intermediate' | 'advanced' | 'electronics' | 'safe-vault' | 'institutional'

/** Bloom's taxonomy levels for learning objectives */
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'

/** Media types supported in lessons */
export type MediaType = 'text' | 'image' | 'video' | 'diagram' | 'animation'

/** Content review status in editorial workflow */
export type ReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived'

/** Difficulty rating 1-5 */
export type Difficulty = 1 | 2 | 3 | 4 | 5

/** A content item in the corpus — lessons, media, references */
export interface ContentItem {
  id: string
  title: string
  body: string
  mediaType: MediaType
  mediaUrl?: string
  examLevel: ExamLevel
  skillTags: string[]
  difficulty: Difficulty
  bloomLevel: BloomLevel
  learningObjective: string
  sourceId: string
  citations: string[]
  reviewStatus: ReviewStatus
  reviewedBy?: string
  version: number
  createdAt: number
  updatedAt: number
}

/** A practice question with multiple-choice options */
export interface Question {
  id: string
  contentId: string
  examLevel: ExamLevel
  difficulty: Difficulty
  bloomLevel: BloomLevel
  skillTags: string[]
  questionText: string
  options: string[]
  correctIndex: number
  explanation: string
  citations: string[]
  reviewStatus: ReviewStatus
  version: number
  createdAt: number
}

/** A flashcard for spaced repetition */
export interface Flashcard {
  id: string
  contentId: string
  examLevel: ExamLevel
  front: string
  back: string
  skillTags: string[]
  difficulty: Difficulty
  nextReviewAt: number
  interval: number
  easeFactor: number
  repetitions: number
}

/** User progress tracking for a specific content item */
export interface UserProgress {
  id: string
  userId: string
  contentId: string
  completed: boolean
  score?: number
  attempts: number
  lastAttemptAt: number
  timeSpentMs: number
}

/** A study plan with milestones and deadlines */
export interface StudyPlan {
  id: string
  userId: string
  examLevel: ExamLevel
  targetDate: number
  createdAt: number
  milestones: StudyMilestone[]
  streakDays: number
  lastStudiedAt: number
}

export interface StudyMilestone {
  id: string
  title: string
  contentIds: string[]
  dueDate: number
  completed: boolean
  completedAt?: number
}

/** Exam session — a randomized set of questions with timing */
export interface ExamSession {
  id: string
  userId: string
  examLevel: ExamLevel
  questionIds: string[]
  answers: Record<string, number>
  startedAt: number
  completedAt?: number
  score?: number
  timeSpentMs: number
}
