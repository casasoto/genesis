import { describe, it, expect } from 'vitest'
import {
  isQuietHours,
  getDueNotifications,
  snoozeNotification,
  dismissNotification,
  rescheduleRecurring,
  createStudyReminders,
  getDefaultPreferences,
} from '../scheduler'
import type { ScheduledNotification, NotificationPreferences } from '../scheduler'

const MS_PER_HOUR = 3_600_000

function makeNotification(overrides: Partial<ScheduledNotification> = {}): ScheduledNotification {
  return {
    id: 'n-1',
    type: 'study_reminder',
    title: 'Study Time',
    body: 'Time to study!',
    scheduledAt: 1000000,
    dismissed: false,
    recurring: false,
    ...overrides,
  }
}

function makePrefs(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return {
    ...getDefaultPreferences(),
    ...overrides,
  }
}

// ─── isQuietHours ───────────────────────────────────────

describe('isQuietHours', () => {
  it('returns false when quiet hours not set', () => {
    const prefs = makePrefs()
    expect(isQuietHours(prefs)).toBe(false)
  })

  it('detects quiet hours during normal range', () => {
    const prefs = makePrefs({ quietHoursStart: 22, quietHoursEnd: 7 })
    const lateNight = new Date('2025-01-15T23:30:00')
    expect(isQuietHours(prefs, lateNight)).toBe(true)
  })

  it('detects quiet hours wrapping midnight', () => {
    const prefs = makePrefs({ quietHoursStart: 22, quietHoursEnd: 7 })
    const earlyMorning = new Date('2025-01-15T03:00:00')
    expect(isQuietHours(prefs, earlyMorning)).toBe(true)
  })

  it('returns false outside quiet hours (wrap)', () => {
    const prefs = makePrefs({ quietHoursStart: 22, quietHoursEnd: 7 })
    const afternoon = new Date('2025-01-15T14:00:00')
    expect(isQuietHours(prefs, afternoon)).toBe(false)
  })

  it('detects non-wrapping quiet hours', () => {
    const prefs = makePrefs({ quietHoursStart: 9, quietHoursEnd: 17 })
    const noon = new Date('2025-01-15T12:00:00')
    expect(isQuietHours(prefs, noon)).toBe(true)
  })

  it('returns false outside non-wrapping quiet hours', () => {
    const prefs = makePrefs({ quietHoursStart: 9, quietHoursEnd: 17 })
    const evening = new Date('2025-01-15T20:00:00')
    expect(isQuietHours(prefs, evening)).toBe(false)
  })
})

// ─── getDueNotifications ────────────────────────────────

describe('getDueNotifications', () => {
  it('returns notifications that are due', () => {
    const notifications = [
      makeNotification({ id: 'n1', scheduledAt: 500 }),
      makeNotification({ id: 'n2', scheduledAt: 2000 }),
    ]
    const due = getDueNotifications(notifications, makePrefs(), 1000)
    expect(due).toHaveLength(1)
    expect(due[0].id).toBe('n1')
  })

  it('excludes dismissed notifications', () => {
    const notifications = [
      makeNotification({ id: 'n1', scheduledAt: 500, dismissed: true }),
    ]
    expect(getDueNotifications(notifications, makePrefs(), 1000)).toHaveLength(0)
  })

  it('excludes disabled notification types', () => {
    const prefs = makePrefs({ types: { ...getDefaultPreferences().types, study_reminder: false } })
    const notifications = [makeNotification({ scheduledAt: 500, type: 'study_reminder' })]
    expect(getDueNotifications(notifications, prefs, 1000)).toHaveLength(0)
  })

  it('returns empty when notifications disabled globally', () => {
    const prefs = makePrefs({ enabled: false })
    const notifications = [makeNotification({ scheduledAt: 500 })]
    expect(getDueNotifications(notifications, prefs, 1000)).toHaveLength(0)
  })

  it('respects snoozedUntil', () => {
    const notifications = [
      makeNotification({ id: 'n1', scheduledAt: 500, snoozedUntil: 2000 }),
    ]
    expect(getDueNotifications(notifications, makePrefs(), 1500)).toHaveLength(0)
    expect(getDueNotifications(notifications, makePrefs(), 2500)).toHaveLength(1)
  })
})

// ─── snoozeNotification ─────────────────────────────────

describe('snoozeNotification', () => {
  it('sets snoozedUntil', () => {
    const n = makeNotification()
    const snoozed = snoozeNotification(n, MS_PER_HOUR, 5000)
    expect(snoozed.snoozedUntil).toBe(5000 + MS_PER_HOUR)
  })

  it('is immutable', () => {
    const n = makeNotification()
    snoozeNotification(n, MS_PER_HOUR, 5000)
    expect(n.snoozedUntil).toBeUndefined()
  })
})

// ─── dismissNotification ────────────────────────────────

describe('dismissNotification', () => {
  it('marks notification as dismissed', () => {
    const n = makeNotification({ dismissed: false })
    const dismissed = dismissNotification(n)
    expect(dismissed.dismissed).toBe(true)
  })

  it('is immutable', () => {
    const n = makeNotification({ dismissed: false })
    dismissNotification(n)
    expect(n.dismissed).toBe(false)
  })
})

// ─── rescheduleRecurring ────────────────────────────────

describe('rescheduleRecurring', () => {
  it('reschedules by interval', () => {
    const n = makeNotification({
      recurring: true,
      intervalMs: MS_PER_HOUR * 24,
      scheduledAt: 1000,
    })
    const next = rescheduleRecurring(n)
    expect(next).not.toBeNull()
    expect(next!.scheduledAt).toBe(1000 + MS_PER_HOUR * 24)
    expect(next!.dismissed).toBe(false)
    expect(next!.snoozedUntil).toBeUndefined()
  })

  it('returns null for non-recurring', () => {
    const n = makeNotification({ recurring: false })
    expect(rescheduleRecurring(n)).toBeNull()
  })

  it('returns null if no interval set', () => {
    const n = makeNotification({ recurring: true, intervalMs: undefined })
    expect(rescheduleRecurring(n)).toBeNull()
  })
})

// ─── createStudyReminders ───────────────────────────────

describe('createStudyReminders', () => {
  it('creates correct number of reminders', () => {
    const reminders = createStudyReminders({
      studyTimeHour: 9,
      intervalMs: MS_PER_HOUR * 24,
      startDate: 0,
      count: 7,
    })
    expect(reminders).toHaveLength(7)
  })

  it('spaces reminders by interval', () => {
    const interval = MS_PER_HOUR * 24
    const reminders = createStudyReminders({
      studyTimeHour: 9,
      intervalMs: interval,
      startDate: 0,
      count: 3,
    })
    expect(reminders[0].scheduledAt).toBe(0)
    expect(reminders[1].scheduledAt).toBe(interval)
    expect(reminders[2].scheduledAt).toBe(interval * 2)
  })

  it('marks all as recurring', () => {
    const reminders = createStudyReminders({
      studyTimeHour: 9,
      intervalMs: MS_PER_HOUR * 24,
      startDate: 0,
      count: 2,
    })
    expect(reminders.every((r) => r.recurring)).toBe(true)
  })

  it('sets correct type and default text', () => {
    const reminders = createStudyReminders({
      studyTimeHour: 9,
      intervalMs: MS_PER_HOUR * 24,
      startDate: 0,
      count: 1,
    })
    expect(reminders[0].type).toBe('study_reminder')
    expect(reminders[0].title).toBe('Time to Study!')
  })
})

// ─── getDefaultPreferences ──────────────────────────────

describe('getDefaultPreferences', () => {
  it('returns enabled by default', () => {
    const prefs = getDefaultPreferences()
    expect(prefs.enabled).toBe(true)
  })

  it('enables all notification types by default', () => {
    const prefs = getDefaultPreferences()
    expect(Object.values(prefs.types).every((v) => v === true)).toBe(true)
  })

  it('returns a new object each call', () => {
    const a = getDefaultPreferences()
    const b = getDefaultPreferences()
    expect(a).not.toBe(b)
    a.enabled = false
    expect(b.enabled).toBe(true)
  })
})
