/**
 * cQikly — ThemeContext
 * Built in: Phase 1a-ii-A
 *
 * Responsibilities:
 *   - Manages active theme (6 themes) + dark/light variant
 *   - Applies CSS custom properties to :root INSTANTLY — zero flicker, zero reload
 *   - All 6 themes × 2 variants (12 CSS variable sets) live in /themes/index.ts
 *   - Reads performance mode flag to disable animations in Lite mode
 *   - Persists theme choice via ConfigContext on every change
 *   - Adds/removes `.light` class on <html> for light variant
 *
 * Export: ThemeProvider, useTheme()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ALL_THEME_IDS,
  THEME_CSS_VARS,
  THEME_META,
  type ThemeId,
  type ThemeVariant,
} from '../themes'

// ─── Types ────────────────────────────────────────────────────────────────────

export type { ThemeId, ThemeVariant }

export interface ThemeContextValue {
  themeId: ThemeId
  variant: ThemeVariant
  /** Available theme list for Settings UI */
  allThemes: typeof ALL_THEME_IDS
  themeMeta: typeof THEME_META
  /** Switch theme and/or variant instantly */
  setTheme: (id: ThemeId, variant?: ThemeVariant) => void
  /** Toggle dark ↔ light */
  toggleVariant: () => void
  /** Whether the current theme supports animations */
  hasAnimation: boolean
  /** Whether animations are currently active (theme supports + perf mode allows) */
  animationsActive: boolean
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Apply a complete CSS variable set to :root and toggle the .light class. */
function applyThemeToDom(id: ThemeId, variant: ThemeVariant): void {
  const vars = THEME_CSS_VARS[id]?.[variant]
  if (!vars) return

  const root = document.documentElement

  // Swap every CSS custom property in one synchronous batch — zero layout thrash
  Object.entries(vars).forEach(([prop, value]) => {
    root.style.setProperty(prop, value)
  })

  // shadcn/ui + Tailwind use the `dark` class on <html> for dark mode.
  // cQikly themes are always dark-ish, but we honour the variant flag.
  if (variant === 'light') {
    root.classList.add('light')
    root.classList.remove('dark')
  } else {
    root.classList.add('dark')
    root.classList.remove('light')
  }
}

// ─── Storage key (read by ConfigContext too, so use the same string) ──────────
const STORAGE_KEY_THEME   = 'cq:themeId'
const STORAGE_KEY_VARIANT = 'cq:themeVariant'

function readStoredTheme(): { id: ThemeId; variant: ThemeVariant } {
  try {
    const id      = localStorage.getItem(STORAGE_KEY_THEME)   as ThemeId | null
    const variant = localStorage.getItem(STORAGE_KEY_VARIANT) as ThemeVariant | null
    return {
      id:      ALL_THEME_IDS.includes(id as ThemeId) ? (id as ThemeId) : 'space-particles',
      variant: variant === 'light' ? 'light' : 'dark',
    }
  } catch {
    return { id: 'space-particles', variant: 'dark' }
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode
  /** Injected by PerformanceContext — undefined = animations allowed */
  animationsEnabled?: boolean
  /** Initial theme from config — overrides localStorage if provided */
  initialThemeId?: ThemeId
  initialVariant?: ThemeVariant
}

export function ThemeProvider({
  children,
  animationsEnabled = true,
  initialThemeId,
  initialVariant,
}: ThemeProviderProps): React.ReactElement {
  const stored = readStoredTheme()

  const [themeId, setThemeId]   = useState<ThemeId>(initialThemeId   ?? stored.id)
  const [variant, setVariant]   = useState<ThemeVariant>(initialVariant ?? stored.variant)

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyThemeToDom(themeId, variant)
  }, [themeId, variant])

  // Apply on mount (handles SSR / cold start before state settles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { applyThemeToDom(themeId, variant) }, [])

  const setTheme = useCallback((id: ThemeId, newVariant?: ThemeVariant) => {
    const v = newVariant ?? variant
    setThemeId(id)
    setVariant(v)
    try {
      localStorage.setItem(STORAGE_KEY_THEME, id)
      localStorage.setItem(STORAGE_KEY_VARIANT, v)
    } catch { /* ignore quota errors */ }
    // Phase 1a-ii-B: emit themeChange event via eventBus
  }, [variant])

  const toggleVariant = useCallback(() => {
    const next: ThemeVariant = variant === 'dark' ? 'light' : 'dark'
    setVariant(next)
    try { localStorage.setItem(STORAGE_KEY_VARIANT, next) } catch { /* ignore */ }
    // Phase 1a-ii-B: emit themeChange event via eventBus
  }, [variant])

  const hasAnimation   = THEME_META[themeId]?.hasAnimation ?? false
  const animationsActive = hasAnimation && animationsEnabled

  const value = useMemo<ThemeContextValue>(() => ({
    themeId,
    variant,
    allThemes: ALL_THEME_IDS,
    themeMeta: THEME_META,
    setTheme,
    toggleVariant,
    hasAnimation,
    animationsActive,
  }), [themeId, variant, setTheme, toggleVariant, hasAnimation, animationsActive])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme() must be used inside <ThemeProvider>')
  return ctx
}
