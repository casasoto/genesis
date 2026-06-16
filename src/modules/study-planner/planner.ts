import type { StudyPlan, StudyMilestone, ExamLevel, ContentItem } from '../../models'
import { v4 as uuidv4 } from 'uuid'

export interface PlanConfig {
  userId: string
  examLevel: ExamLevel
  targetDate: number
  contentItems: ContentItem[]
  hoursPerDay?: number
}

const MS_PER_DAY = 86_400_000

/** Calculate the number of days between now and a target date */
export function daysUntil(targetDate: number, now?: number): number {
  const current = now ?? Date.now()
  return Math.max(0, Math.ceil((targetDate - current) / MS_PER_DAY))
}

/** Group content items by skill tags for milestone creation */
export function groupBySkill(items: ContentItem[]): Map<string, ContentItem[]> {
  const groups = new Map<string, ContentItem[]>()
  for (const item of items) {
    for (const tag of item.skillTags) {
      const group = groups.get(tag) ?? []
      group.push(item)
      groups.set(tag, group)
    }
  }
  return groups
}

/** Create evenly-spaced milestones from skill groups */
export function createMilestones(
  skillGroups: Map<string, ContentItem[]>,
  targetDate: number,
  now?: number,
): StudyMilestone[] {
  const current = now ?? Date.now()
  const totalDays = daysUntil(targetDate, current)
  const skills = Array.from(skillGroups.entries())
  if (skills.length === 0) return []

  const daysPerMilestone = Math.max(1, Math.floor(totalDays / skills.length))
  return skills.map(([skillTag, items], index) => ({
    id: uuidv4(),
    title: `Master: ${skillTag}`,
    contentIds: items.map((i) => i.id),
    dueDate: current + daysPerMilestone * (index + 1) * MS_PER_DAY,
    completed: false,
  }))
}

/** Generate a complete study plan */
export function generateStudyPlan(config: PlanConfig, now?: number): StudyPlan {
  const current = now ?? Date.now()
  const relevantContent = config.contentItems.filter((c) => c.examLevel === config.examLevel)
  const skillGroups = groupBySkill(relevantContent)
  const milestones = createMilestones(skillGroups, config.targetDate, current)

  return {
    id: uuidv4(),
    userId: config.userId,
    examLevel: config.examLevel,
    targetDate: config.targetDate,
    createdAt: current,
    milestones,
    streakDays: 0,
    lastStudiedAt: 0,
  }
}

/** Update streak tracking */
export function updateStreak(plan: StudyPlan, studiedAt?: number): StudyPlan {
  const now = studiedAt ?? Date.now()
  const lastStudied = plan.lastStudiedAt
  const daysSinceLast = lastStudied === 0 ? 0 : Math.floor((now - lastStudied) / MS_PER_DAY)

  let streakDays: number
  if (daysSinceLast <= 1) {
    streakDays = daysSinceLast === 0 ? plan.streakDays : plan.streakDays + 1
  } else {
    streakDays = 1
  }

  return { ...plan, streakDays, lastStudiedAt: now }
}

/** Mark a milestone as completed */
export function completeMilestone(plan: StudyPlan, milestoneId: string, completedAt?: number): StudyPlan {
  const now = completedAt ?? Date.now()
  return {
    ...plan,
    milestones: plan.milestones.map((m) => (m.id === milestoneId ? { ...m, completed: true, completedAt: now } : m)),
  }
}

/** Calculate overall progress percentage */
export function calculateProgress(plan: StudyPlan): number {
  if (plan.milestones.length === 0) return 0
  const completed = plan.milestones.filter((m) => m.completed).length
  return completed / plan.milestones.length
}

/** Export plan as iCalendar format string */
export function exportToICal(plan: StudyPlan): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LocksmithPrep//StudyPlan//EN',
  ]

  for (const milestone of plan.milestones) {
    const dueDate = new Date(milestone.dueDate)
    const dateStr = dueDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    lines.push(
      'BEGIN:VEVENT',
      `DTSTART:${dateStr}`,
      `SUMMARY:${milestone.title}`,
      `DESCRIPTION:Study ${milestone.contentIds.length} items`,
      `UID:${milestone.id}@locksmithprep`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
