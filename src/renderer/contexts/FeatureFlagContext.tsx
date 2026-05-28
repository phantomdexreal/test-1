/**
 * cQikly — FeatureFlagContext
 * Built in: Phase 1a-ii-B
 *
 * Responsibilities:
 *   - Exposes all boolean-gated module toggles to the entire tree
 *   - All flags registered from Day One (including future modules) — never added ad hoc
 *   - Reads initial flag state from ConfigContext (config.featureFlags)
 *   - Toggling a flag is instant; persisted back via ConfigContext.updateConfig()
 *   - Emits eventBus 'featureFlagChange' on every toggle
 *   - Listens to eventBus 'configChange' — if key === 'featureFlags', syncs all flags
 *   - Components NEVER import directly from a gated module — they check the flag first
 *
 * Core pages (always on — not toggleable):
 *   newQuote, history, customerDetails, inventory, looseInventoryHistory, settings
 *
 * Boolean-gated future modules (all off by default):
 *   reports, expenseTracker, multiUser, paymentLedger, branchSync,
 *   whatsappShare, branchActivityMonitor, customerDbSync, priceListSync
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
import type { AppConfig } from './ConfigContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeatureFlagName =
  | 'reports'
  | 'expenseTracker'
  | 'multiUser'
  | 'paymentLedger'
  | 'branchSync'
  | 'whatsappShare'
  | 'branchActivityMonitor'
  | 'customerDbSync'
  | 'priceListSync'

export type FeatureFlagsMap = Record<FeatureFlagName, boolean>

export const DEFAULT_FEATURE_FLAGS: FeatureFlagsMap = {
  reports:                false,
  expenseTracker:         false,
  multiUser:              false,
  paymentLedger:          false,
  branchSync:             false,
  whatsappShare:          false,
  branchActivityMonitor:  false,
  customerDbSync:         false,
  priceListSync:          false,
}

export interface FeatureFlagContextValue {
  flags: FeatureFlagsMap
  /** Check a single flag */
  isEnabled: (flag: FeatureFlagName) => boolean
  /**
   * Toggle a single flag. Also calls updateConfig so the flag persists.
   * updateConfig must be provided by the FeatureFlagProvider (injected from ConfigContext).
   */
  setFlag: (flag: FeatureFlagName, enabled: boolean) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface FeatureFlagProviderProps {
  children: React.ReactNode
  /** Initial flags — merged from ConfigContext (config.featureFlags) */
  initialFlags?: Partial<FeatureFlagsMap>
  /** Injected so flag changes persist back to config without importing ConfigContext */
  updateConfig?: (patch: Partial<AppConfig>) => void
}

export function FeatureFlagProvider({
  children,
  initialFlags,
  updateConfig,
}: FeatureFlagProviderProps): React.ReactElement {
  const [flags, setFlags] = useState<FeatureFlagsMap>({
    ...DEFAULT_FEATURE_FLAGS,
    ...(initialFlags ?? {}),
  })

  // ── Sync from configChange events ──────────────────────────────────────────
  useEffect(() => {
    return eventBus.on('configChange', ({ key, value }) => {
      if (key === 'featureFlags' && value && typeof value === 'object') {
        setFlags(prev => ({
          ...prev,
          ...(value as Partial<FeatureFlagsMap>),
        }))
      }
    })
  }, [])

  const isEnabled = useCallback(
    (flag: FeatureFlagName): boolean => flags[flag] ?? false,
    [flags]
  )

  const setFlag = useCallback(
    (flag: FeatureFlagName, enabled: boolean) => {
      setFlags(prev => {
        const next = { ...prev, [flag]: enabled }
        // Persist back to ConfigContext (which then persists to disk)
        updateConfig?.({ featureFlags: next } as Partial<AppConfig>)
        // Notify subscribers (e.g. nav, sidebar)
        eventBus.emit('featureFlagChange', { flag, enabled })
        return next
      })
    },
    [updateConfig]
  )

  const value = useMemo<FeatureFlagContextValue>(
    () => ({ flags, isEnabled, setFlag }),
    [flags, isEnabled, setFlag]
  )

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFeatureFlag(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext)
  if (!ctx) throw new Error('useFeatureFlag() must be used inside <FeatureFlagProvider>')
  return ctx
}

/** Convenience: check a single flag without destructuring */
export function useFlag(flag: FeatureFlagName): boolean {
  const { isEnabled } = useFeatureFlag()
  return isEnabled(flag)
}
