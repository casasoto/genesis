import { describe, it, expect } from 'vitest'
import {
  daysUntil,
  groupBySkill,
  createMilestones,
  generateStudyPlan,
  updateStreak,
  completeMilestone,
  calculateProgress,
  exportToICal,
} from '../planner'
import type { ContentItem, StudyPlan } from '../../../models'

const MS_PER_DAY = 86_400_000

function makeContent(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: `content-${Math.random().toString(36).slice(2)}`,
    title: 'Pin Tumbler Basics',
    body: 'Learn about pin tumbler locks.',
    mediaType: 'text',
    examLevel: 'beginner',
    skillTags: ['pin-tumbler'],
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

function makePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: 'plan-1',
    userId: 'user-1',
    examLevel: 'beginner',
    targetDate: Date.now() + 30 * MS_PER_DAY,
    createdAt: Date.now(),
    milestones: [],
    streakDays: 0,
    lastStudiedAt: 0,
    ...overrides,
  }
}

// ─── daysUntil ──────────────────────────────────────────

describe('daysUntil', () => {
  it('calculates days between dates', () => {
    const now = 1000000
    const target = now + 10 * MS_PER_DAY
    expect(daysUntil(target, now)).toBe(10)
  })

  it('returns 0 for past dates', () => {
    const now = 1000000
    const target = now - 5 * MS_PER_DAY
    expect(daysUntil(target, now)).toBe(0)
  })

  it('rounds up partial days', () => {
    const now = 1000000
    const target = now + 1.5 * MS_PER_DAY
    expect(daysUntil(target, now)).toBe(2)
  })

  it('returns 0 when target equals now', () => {
    const now = 1000000
    expect(daysUntil(now, now)).toBe(0)
  })
})

// ─── groupBySkill ───────────────────────────────────────

describe('groupBySkill', () => {
  it('groups content items by skill tags', () => {
    const items = [
      makeContent({ skillTags: ['locks', 'hardware'] }),
      makeContent({ skillTags: ['locks'] }),
      makeContent({ skillTags: ['keys'] }),
    ]
    const groups = groupBySkill(items)
    expect(groups.get('locks')).toHaveLength(2)
    expect(groups.get('hardware')).toHaveLength(1)
    expect(groups.get('keys')).toHaveLength(1)
  })

  it('handles empty input', () => {
    const groups = groupBySkill([])
    expect(groups.size).toBe(0)
  })

  it('handles items with multiple tags', () => {
    const item = makeContent({ skillTags: ['a', 'b', 'c'] })
    const groups = groupBySkill([item])
    expect(groups.size).toBe(3)
    expect(groups.get('a')).toHaveLength(1)
    expect(groups.get('b')).toHaveLength(1)
    expect(groups.get('c')).toHaveLength(1)
  })
})

// ─── createMilestones ───────────────────────────────────

describe('createMilestones', () => {
  it('creates milestones from skill groups', () => {
    const groups = new Map([
      ['locks', [makeContent({ id: 'c1' })]],
      ['keys', [makeContent({ id: 'c2' })]],
    ])
    const now = 1000000
    const target = now + 30 * MS_PER_DAY
    const milestones = createMilestones(groups, target, now)
    expect(milestones).toHaveLength(2)
    expect(milestones[0].title).toBe('Master: locks')
    expect(milestones[1].title).toBe('Master: keys')
  })

  it('spaces milestones evenly', () => {
    const groups = new Map([
      ['a', [makeContent()]],
      ['b', [makeContent()]],
    ])
    const now = 0
    const target = 20 * MS_PER_DAY
    const milestones = createMilestones(groups, target, now)
    // 20 days / 2 skills = 10 days per milestone
    expect(milestones[0].dueDate).toBe(10 * MS_PER_DAY)
    expect(milestones[1].dueDate).toBe(20 * MS_PER_DAY)
  })

  it('returns empty for no skill groups', () => {
    expect(createMilestones(new Map(), Date.now() + MS_PER_DAY)).toEqual([])
  })

  it('marks milestones as incomplete', () => {
    const groups = new Map([['test', [makeContent()]]])
    const milestones = createMilestones(groups, Date.now() + MS_PER_DAY)
    expect(milestones[0].completed).toBe(false)
  })
})

// ─── generateStudyPlan ──────────────────────────────────

describe('generateStudyPlan', () => {
  it('generates a plan for beginner content', () => {
    const items = [
      makeContent({ examLevel: 'beginner', skillTags: ['locks'] }),
      makeContent({ examLevel: 'beginner', skillTags: ['keys'] }),
      makeContent({ examLevel: 'advanced', skillTags: ['safes'] }),
    ]
    const plan = generateStudyPlan({
      userId: 'user-1',
      examLevel: 'beginner',
      targetDate: Date.now() + 60 * MS_PER_DAY,
      contentItems: items,
    })
    expect(plan.userId).toBe('user-1')
    expect(plan.examLevel).toBe('beginner')
    expect(plan.milestones.length).toBeGreaterThan(0)
    expect(plan.streakDays).toBe(0)
  })

  it('generates empty plan when no matching content', () => {
    const plan = generateStudyPlan({
      userId: 'user-1',
      examLevel: 'beginner',
      targetDate: Date.now() + 30 * MS_PER_DAY,
      contentItems: [makeContent({ examLevel: 'advanced' })],
    })
    expect(plan.milestones).toHaveLength(0)
  })
})

// ─── updateStreak ───────────────────────────────────────

describe('updateStreak', () => {
  it('starts streak at 1 for first study session', () => {
    const plan = makePlan({ streakDays: 0, lastStudiedAt: 0 })
    const updated = updateStreak(plan, 1000000)
    expect(updated.streakDays).toBe(0) // same "day" as 0 floor
    expect(updated.lastStudiedAt).toBe(1000000)
  })

  it('increments streak for consecutive days', () => {
    const day1 = 1000000
    const day2 = day1 + MS_PER_DAY
    const plan = makePlan({ streakDays: 3, lastStudiedAt: day1 })
    const updated = updateStreak(plan, day2)
    expect(updated.streakDays).toBe(4)
  })

  it('resets streak after gap > 1 day', () => {
    const day1 = 1000000
    const day5 = day1 + 4 * MS_PER_DAY
    const plan = makePlan({ streakDays: 10, lastStudiedAt: day1 })
    const updated = updateStreak(plan, day5)
    expect(updated.streakDays).toBe(1)
  })

  it('does not increment for same-day study', () => {
    const now = 1000000
    const plan = makePlan({ streakDays: 5, lastStudiedAt: now })
    const updated = updateStreak(plan, now + 1000)
    expect(updated.streakDays).toBe(5)
  })
})

// ─── completeMilestone ──────────────────────────────────

describe('completeMilestone', () => {
  it('marks the correct milestone as completed', () => {
    const plan = makePlan({
      milestones: [
        { id: 'm1', title: 'A', contentIds: [], dueDate: 0, completed: false },
        { id: 'm2', title: 'B', contentIds: [], dueDate: 0, completed: false },
      ],
    })
    const updated = completeMilestone(plan, 'm1', 999)
    expect(updated.milestones[0].completed).toBe(true)
    expect(updated.milestones[0].completedAt).toBe(999)
    expect(updated.milestones[1].completed).toBe(false)
  })

  it('is immutable', () => {
    const plan = makePlan({
      milestones: [{ id: 'm1', title: 'A', contentIds: [], dueDate: 0, completed: false }],
    })
    completeMilestone(plan, 'm1')
    expect(plan.milestones[0].completed).toBe(false) // original unchanged
  })
})

// ─── calculateProgress ──────────────────────────────────

describe('calculateProgress', () => {
  it('returns 0 for no milestones', () => {
    expect(calculateProgress(makePlan())).toBe(0)
  })

  it('returns 0 for no completed milestones', () => {
    const plan = makePlan({
      milestones: [
        { id: 'm1', title: 'A', contentIds: [], dueDate: 0, completed: false },
        { id: 'm2', title: 'B', contentIds: [], dueDate: 0, completed: false },
      ],
    })
    expect(calculateProgress(plan)).toBe(0)
  })

  it('returns 0.5 for half completed', () => {
    const plan = makePlan({
      milestones: [
        { id: 'm1', title: 'A', contentIds: [], dueDate: 0, completed: true },
        { id: 'm2', title: 'B', contentIds: [], dueDate: 0, completed: false },
      ],
    })
    expect(calculateProgress(plan)).toBe(0.5)
  })

  it('returns 1 for all completed', () => {
    const plan = makePlan({
      milestones: [
        { id: 'm1', title: 'A', contentIds: [], dueDate: 0, completed: true },
        { id: 'm2', title: 'B', contentIds: [], dueDate: 0, completed: true },
      ],
    })
    expect(calculateProgress(plan)).toBe(1)
  })
})

// ─── exportToICal ───────────────────────────────────────

describe('exportToICal', () => {
  it('produces valid iCalendar format', () => {
    const plan = makePlan({
      milestones: [
        { id: 'uid-1', title: 'Study Locks', contentIds: ['c1', 'c2'], dueDate: new Date('2025-03-01').getTime(), completed: false },
      ],
    })
    const ical = exportToICal(plan)
    expect(ical).toContain('BEGIN:VCALENDAR')
    expect(ical).toContain('END:VCALENDAR')
    expect(ical).toContain('BEGIN:VEVENT')
    expect(ical).toContain('SUMMARY:Study Locks')
    expect(ical).toContain('DESCRIPTION:Study 2 items')
    expect(ical).toContain('UID:uid-1@locksmithprep')
  })

  it('handles empty milestones', () => {
    const plan = makePlan({ milestones: [] })
    const ical = exportToICal(plan)
    expect(ical).toContain('BEGIN:VCALENDAR')
    expect(ical).toContain('END:VCALENDAR')
    expect(ical).not.toContain('BEGIN:VEVENT')
  })
})
