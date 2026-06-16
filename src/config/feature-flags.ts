/** Feature flags for progressive rollout and extensibility */
export interface FeatureFlags {
  /** Exam levels currently enabled */
  enabledExamLevels: string[]
  /** AI tutor available */
  aiTutorEnabled: boolean
  /** Interactive labs (disassembly/rekeying) */
  labsEnabled: boolean
  /** Flashcard spaced repetition */
  flashcardsEnabled: boolean
  /** Offline mode */
  offlineEnabled: boolean
  /** Push notifications */
  notificationsEnabled: boolean
  /** Calendar export */
  calendarExportEnabled: boolean
  /** Content admin tools */
  adminToolsEnabled: boolean
  /** Dark mode */
  darkModeEnabled: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  enabledExamLevels: ['beginner'],
  aiTutorEnabled: true,
  labsEnabled: false,
  flashcardsEnabled: true,
  offlineEnabled: true,
  notificationsEnabled: true,
  calendarExportEnabled: true,
  adminToolsEnabled: false,
  darkModeEnabled: true,
}

let currentFlags: FeatureFlags = { ...DEFAULT_FLAGS }

export function getFeatureFlags(): Readonly<FeatureFlags> {
  return { ...currentFlags }
}

export function setFeatureFlags(flags: Partial<FeatureFlags>): void {
  currentFlags = { ...currentFlags, ...flags }
}

export function resetFeatureFlags(): void {
  currentFlags = { ...DEFAULT_FLAGS }
}

export function isExamLevelEnabled(level: string): boolean {
  return currentFlags.enabledExamLevels.includes(level)
}
