/** Dark-mode palette designed for concentration and accessibility (WCAG AA contrast) */
export const darkTheme = {
  colors: {
    background: '#020617',       // slate-950
    surface: '#0f172a',          // slate-900
    surfaceHover: '#1e293b',     // slate-800
    border: '#334155',           // slate-700
    textPrimary: '#f1f5f9',      // slate-100
    textSecondary: '#94a3b8',    // slate-400
    textMuted: '#64748b',        // slate-500
    accent: '#3b82f6',           // blue-500
    accentHover: '#2563eb',      // blue-600
    success: '#22c55e',          // green-500
    warning: '#f59e0b',          // amber-500
    error: '#ef4444',            // red-500
    info: '#06b6d4',             // cyan-500
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    full: '9999px',
  },
  fontFamily: {
    sans: 'Inter, system-ui, -apple-system, sans-serif',
    mono: 'JetBrains Mono, Fira Code, monospace',
  },
} as const

export type Theme = typeof darkTheme
