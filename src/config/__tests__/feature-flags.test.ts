import { describe, it, expect, beforeEach } from 'vitest'
import { getFeatureFlags, setFeatureFlags, resetFeatureFlags, isExamLevelEnabled } from '../feature-flags'

describe('feature flags', () => {
  beforeEach(() => {
    resetFeatureFlags()
  })

  it('returns default flags', () => {
    const flags = getFeatureFlags()
    expect(flags.enabledExamLevels).toEqual(['beginner'])
    expect(flags.aiTutorEnabled).toBe(true)
    expect(flags.darkModeEnabled).toBe(true)
    expect(flags.labsEnabled).toBe(false)
    expect(flags.adminToolsEnabled).toBe(false)
  })

  it('updates flags partially', () => {
    setFeatureFlags({ labsEnabled: true })
    const flags = getFeatureFlags()
    expect(flags.labsEnabled).toBe(true)
    expect(flags.aiTutorEnabled).toBe(true) // unchanged
  })

  it('resets to defaults', () => {
    setFeatureFlags({ aiTutorEnabled: false })
    resetFeatureFlags()
    expect(getFeatureFlags().aiTutorEnabled).toBe(true)
  })

  it('returns a copy (not mutable reference)', () => {
    const flags = getFeatureFlags()
    const mutableFlags = flags as Record<string, unknown>
    mutableFlags['aiTutorEnabled'] = false
    expect(getFeatureFlags().aiTutorEnabled).toBe(true)
  })
})

describe('isExamLevelEnabled', () => {
  beforeEach(() => {
    resetFeatureFlags()
  })

  it('returns true for beginner by default', () => {
    expect(isExamLevelEnabled('beginner')).toBe(true)
  })

  it('returns false for intermediate by default', () => {
    expect(isExamLevelEnabled('intermediate')).toBe(false)
  })

  it('returns true after enabling a level', () => {
    setFeatureFlags({ enabledExamLevels: ['beginner', 'intermediate'] })
    expect(isExamLevelEnabled('intermediate')).toBe(true)
  })
})
