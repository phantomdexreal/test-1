/**
 * cQikly — PerformanceContext
 * Built in: Phase 1a-ii-B
 *
 * Responsibilities:
 *   - Exposes performanceMode (lite | balanced | ultra) to the entire tree
 *   - Derives boolean flags consumed by animation components and API pollers:
 *       animationsEnabled      — false in Lite
 *       heavyAnimationsEnabled — false in Lite and Balanced
 *       apiPollingEnabled      — false in Lite
 *       apiPollingInterval     — ms between refreshes (0 = stopped)
 *   - Switching mode is live — zero reload, instant derived-flag update
 *   - Billing operations are NEVER degraded (Governance Rule / Hard Spec #12)
 *   - Emits eventBus 'performanceModeChange' on every mode change
 *   - Listens to eventBus 'configChange' — if key === 'performanceMode', syncs
 *
 * Modes (Hard Spec #12):
 *   Lite     — No Three.js / Framer Motion AND no background API polling
 *   Balanced — Moderate animations; 2-min polling interval (default)
 *   Ultra    — Full animations; 30-sec polling interval
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PerformanceMode = 'lite' | 'balanced' | 'ultra'

export interface PerformanceContextValue {
  mode: PerformanceMode
  setMode: (mode: PerformanceMode) => void
  /** true in Balanced and Ultra; false in Lite */
  animationsEnabled: boolean
  /** true only in Ultra — heavy Three.js scenes, particle systems */
  heavyAnimationsEnabled: boolean
  /** false in Lite — all background polling (weather, crypto, forex) stopped */
  apiPollingEnabled: boolean
  /** ms between API refreshes; 0 = stopped (Lite) */
  apiPollingInterval: number
}

export const POLLING_INTERVALS: Record<PerformanceMode, number> = {
  lite:     0,       // polling stopped entirely
  balanced: 120_000, // 2 minutes
  ultra:    30_000,  // 30 seconds
}

// ─── Derived flags helper ─────────────────────────────────────────────────────

function deriveFlags(mode: PerformanceMode): Omit<PerformanceContextValue, 'mode' | 'setMode'> {
  return {
    animationsEnabled:      mode !== 'lite',
    heavyAnimationsEnabled: mode === 'ultra',
    apiPollingEnabled:      mode !== 'lite',
    apiPollingInterval:     POLLING_INTERVALS[mode],
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PerformanceContext = createContext<PerformanceContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PerformanceProviderProps {
  children: React.ReactNode
  /** Initial mode — passed from ConfigContext (config.performanceMode) */
  initialMode?: PerformanceMode
}

export function PerformanceProvider({
  children,
  initialMode = 'balanced',
}: PerformanceProviderProps): React.ReactElement {
  const [mode, setModeState] = useState<PerformanceMode>(initialMode)

  // Set CSS var on mount
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--cq-anim-enabled',
      initialMode === 'lite' ? '0' : '1'
    )
  }, [])

  // ── Keep in sync if ConfigContext changes performanceMode via Settings ──────
  useEffect(() => {
    return eventBus.on('configChange', ({ key, value }) => {
      if (key === 'performanceMode' && (value === 'lite' || value === 'balanced' || value === 'ultra')) {
        setModeState(value as PerformanceMode)
      }
    })
  }, [])

  const setMode = useCallback((newMode: PerformanceMode) => {
    setModeState(newMode)
    eventBus.emit('performanceModeChange', { mode: newMode })
    // Update CSS var so theme animations can react without JS overhead
    document.documentElement.style.setProperty(
      '--cq-anim-enabled',
      newMode === 'lite' ? '0' : '1'
    )
  }, [])

  const value = useMemo<PerformanceContextValue>(
    () => ({ mode, setMode, ...deriveFlags(mode) }),
    [mode, setMode]
  )

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePerformance(): PerformanceContextValue {
  const ctx = useContext(PerformanceContext)
  if (!ctx) throw new Error('usePerformance() must be used inside <PerformanceProvider>')
  return ctx
}
