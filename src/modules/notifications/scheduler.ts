/** Notification types */
export type NotificationType = 'study_reminder' | 'streak_warning' | 'milestone_due' | 'exam_ready' | 'review_due'

export interface ScheduledNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  scheduledAt: number
  snoozedUntil?: number
  dismissed: boolean
  recurring: boolean
  intervalMs?: number
}

export interface NotificationPreferences {
  enabled: boolean
  quietHoursStart?: number // hour 0-23
  quietHoursEnd?: number   // hour 0-23
  types: Record<NotificationType, boolean>
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  types: {
    study_reminder: true,
    streak_warning: true,
    milestone_due: true,
    exam_ready: true,
    review_due: true,
  },
}

/** Check if current time is within quiet hours */
export function isQuietHours(prefs: NotificationPreferences, now?: Date): boolean {
  if (prefs.quietHoursStart === undefined || prefs.quietHoursEnd === undefined) return false
  const hour = (now ?? new Date()).getHours()
  const { quietHoursStart, quietHoursEnd } = prefs

  if (quietHoursStart <= quietHoursEnd) {
    return hour >= quietHoursStart && hour < quietHoursEnd
  }
  // Wraps midnight (e.g., 22:00 - 07:00)
  return hour >= quietHoursStart || hour < quietHoursEnd
}

/** Get notifications that are due to fire */
export function getDueNotifications(
  notifications: ScheduledNotification[],
  prefs: NotificationPreferences,
  now?: number,
): ScheduledNotification[] {
  const current = now ?? Date.now()
  if (!prefs.enabled) return []

  return notifications.filter((n) => {
    if (n.dismissed) return false
    if (!prefs.types[n.type]) return false
    const effectiveTime = n.snoozedUntil ?? n.scheduledAt
    return effectiveTime <= current
  })
}

/** Snooze a notification */
export function snoozeNotification(notification: ScheduledNotification, snoozeMs: number, now?: number): ScheduledNotification {
  const current = now ?? Date.now()
  return { ...notification, snoozedUntil: current + snoozeMs }
}

/** Dismiss a notification */
export function dismissNotification(notification: ScheduledNotification): ScheduledNotification {
  return { ...notification, dismissed: true }
}

/** Reschedule a recurring notification for the next occurrence */
export function rescheduleRecurring(notification: ScheduledNotification): ScheduledNotification | null {
  if (!notification.recurring || !notification.intervalMs) return null
  return {
    ...notification,
    scheduledAt: notification.scheduledAt + notification.intervalMs,
    snoozedUntil: undefined,
    dismissed: false,
  }
}

/** Create study reminder notifications for a study plan */
export function createStudyReminders(params: {
  studyTimeHour: number
  intervalMs: number
  startDate: number
  count: number
}): ScheduledNotification[] {
  const reminders: ScheduledNotification[] = []
  for (let i = 0; i < params.count; i++) {
    const scheduledAt = params.startDate + i * params.intervalMs
    reminders.push({
      id: `reminder_${i}_${scheduledAt}`,
      type: 'study_reminder',
      title: 'Time to Study!',
      body: 'Your daily locksmith exam prep session is ready.',
      scheduledAt,
      dismissed: false,
      recurring: true,
      intervalMs: params.intervalMs,
    })
  }
  return reminders
}

export function getDefaultPreferences(): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, types: { ...DEFAULT_PREFERENCES.types } }
}
