/**
 * cQikly — ConfigContext
 * Built in: Phase 1a-ii-A
 *
 * Responsibilities:
 *   - Loads app-wide configuration from AppData config file on startup (via IPC)
 *   - Exposes the full config object + typed patch function to the entire tree
 *   - Persists changes instantly on every update (debounced write to avoid IPC churn)
 *   - On config read failure: recovers to last known valid or DEFAULT_CONFIG (Safety Rule)
 *   - eventBus.emit('configChange') on every update so other contexts react immediately
 *   - Falls back to in-memory state if IPC bridge is unavailable (browser dev mode)
 *
 * Scope: theme, variant, performance mode, language, onboarding status,
 *        company profile reference, and all user preferences.
 *        Business data lives in SQLite, never here.
 *
 * Export: ConfigProvider, useConfig()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { DEFAULT_CONFIG } from '../config/defaults'
import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppConfig {
  // Theme
  themeId: string
  themeVariant: 'dark' | 'light'
  // Performance
  performanceMode: 'lite' | 'balanced' | 'ultra'
  // i18n
  language: string
  // Onboarding
  onboardingComplete: boolean
  // Active company profile (DB file identifier)
  companyProfileId: string | null
  // Billing
  fyStartMonth: number              // 1–12; default 4 = April
  billResetCycle: 'yearly' | 'monthly' | 'never'
  startingBillNumber: number        // one-time migration; Hard Spec #3
  currentBillNumber: number         // tracks counter within current cycle
  billPrefix: string
  // App lock
  appLockEnabled: boolean
  // UI
  clockFormat: '12h' | '24h'
  whatsappMethod: 'desktop' | 'web' | null
  // Dashboard widget visibility
  widgetVisibility: Record<string, boolean>
  // Phase 3b-i: API widget settings
  weatherCity: string
  cryptoCurrency: string  // e.g. "inr", "usd"
  cryptoIds: string[]     // up to 5 CoinGecko IDs
  forexPairs: Array<{ from: string; to: string }>
  // Phase 9a-B: Stock tracking settings
  stockQtyEnabled: boolean        // globally enables Stock Qty + Min Stock + Unit columns on inventory
  stockDeductOnSave: boolean      // when true, reduces stock qty of matched items on bill save
  // Phase 9b-B-ii-A: Inventory mode on quote page
  inventoryModeEnabled: boolean   // when true, typing in Item Name shows fuzzy autocomplete from inventory
  // Phase 11a-i: Company profile + bill number settings
  companyName: string             // firm name — propagated instantly via event bus
  billAutoIncrement: boolean      // when false, bill number is NOT auto-incremented
  // Phase 11a-ii: Appearance + Print + UI
  appZoom: number                 // global UI scale 0.75–1.5; applied to root font-size
  printDefaultPrinter: string     // name of default printer for quick print (empty = OS default)
  printDefaultPageSize: 'A4' | 'A5' | 'Letter' | 'Legal'  // default page size override
  // Phase 11b-i: Quote Page Settings
  f2EditMode: boolean              // strict F2 cell locking (Hard Spec #5)
  discountColumnVisible: boolean   // show/hide per-item discount column
  qtyUnitColumnVisible: boolean    // show/hide unit field alongside Qty
  rateHistoryHintEnabled: boolean  // ghost rate hint in Rate cell
  inventoryRateSourceFree: string  // price field used for Free Format on inventory Insert
  inventoryRateSourceGst: string   // price field used for GST Format on inventory Insert
  // Phase 11b-i: Security
  appLockPin: string               // stored PIN (4–6 digits; empty = none set)
  appLockIdleTimeout: number       // minutes before auto-lock; 0 = never
  // Phase 11b-ii: Backup & Restore
  backupSchedule: 'daily' | 'weekly' | 'off'    // auto backup frequency
  backupDestination: string                       // folder path for backup ZIPs
  // Phase 11b-ii: Saved Lists
  savedTransporters: string[]                     // frequently used transporter names
  savedUnits: string[]                            // quantity units used across app
  // Phase 11b-ii: Customer Settings
  customerCreditLimitDefault: number              // global default credit limit for new customers
  // Phase 11b-ii: Access Key
  cloudAccessKey: string                          // cloud sync access key from developer; unlocks admin features
  // Phase 1a-ii-B: feature flags added here
  [key: string]: unknown            // extensible without breaking changes
}

const DEFAULT_APP_CONFIG: AppConfig = {
  themeId:            DEFAULT_CONFIG.themeId,
  themeVariant:       DEFAULT_CONFIG.themeVariant as 'dark' | 'light',
  performanceMode:    DEFAULT_CONFIG.performanceMode as 'lite' | 'balanced' | 'ultra',
  language:           DEFAULT_CONFIG.language,
  onboardingComplete: DEFAULT_CONFIG.onboardingComplete,
  companyProfileId:   DEFAULT_CONFIG.companyProfileId,
  fyStartMonth:       4,
  billResetCycle:     'yearly',
  startingBillNumber: 1,
  currentBillNumber:  1,
  billPrefix:         '',
  appLockEnabled:     false,
  clockFormat:        '12h',
  whatsappMethod:     null,
  widgetVisibility: {
    clock:                 true,
    todoList:              true,
    todayBillCount:        true,
    totalBills:            true,
    todayRevenue:          true,
    monthComparison:       true,
    topCustomer:           true,
    pendingDraftIndicator: true,
    lowStockAlert:         true,
    weather:               true,
    crypto:                true,
    forex:                 true,
    systemStatus:          true,
    calculator:            true,
    unitConverter:         true,
    currencyConverter:     true,
  },
  // Phase 3b-i API settings
  weatherCity:    'Mumbai',
  cryptoCurrency: 'inr',
  cryptoIds:      ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple'],
  forexPairs:     [
    { from: 'USD', to: 'INR' },
    { from: 'EUR', to: 'INR' },
    { from: 'GBP', to: 'INR' },
    { from: 'USD', to: 'EUR' },
    { from: 'AED', to: 'INR' },
  ],
  // Phase 9a-B: Stock tracking
  stockQtyEnabled:    false,
  stockDeductOnSave:  false,
  // Phase 9b-B-ii-A: Inventory mode
  inventoryModeEnabled: false,
  // Phase 11a-i: Company profile + bill settings
  companyName:          '',
  billAutoIncrement:    true,
  // Phase 11a-ii: Appearance + Print
  appZoom:              1.0,
  printDefaultPrinter:  '',
  printDefaultPageSize: 'A4' as const,
  // Phase 11b-i: Quote Page Settings
  f2EditMode:                false,
  discountColumnVisible:     false,
  qtyUnitColumnVisible:      false,
  rateHistoryHintEnabled:    true,
  inventoryRateSourceFree:   'Price',
  inventoryRateSourceGst:    'GST Price',
  // Phase 11b-i: Security
  appLockPin:                '',
  appLockIdleTimeout:        0,
  // Phase 11b-ii: Backup & Restore
  backupSchedule:            'off',
  backupDestination:         '',
  // Phase 11b-ii: Saved Lists
  savedTransporters:         [],
  savedUnits:                ['pcs', 'kg', 'g', 'litre', 'ml', 'meters', 'cm', 'boxes', 'dozen', 'set'],
  // Phase 11b-ii: Customer Settings
  customerCreditLimitDefault: 0,
  // Phase 11b-ii: Access Key
  cloudAccessKey:            '',
}

export interface ConfigContextValue {
  config: AppConfig
  isLoaded: boolean
  /** Merge a partial config patch and persist immediately */
  updateConfig: (patch: Partial<AppConfig>) => void
  /** Reset config to defaults (destructive — used by factory reset) */
  resetConfig: () => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ConfigContext = createContext<ConfigContextValue | null>(null)

// ─── IPC bridge helper ────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

// ─── Debounce helper ──────────────────────────────────────────────────────────

function useDebounce<T>(fn: (arg: T) => void, ms: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((arg: T) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fn(arg), ms)
  }, [fn, ms])
}

// ─── Merge helper: deep-merges widgetVisibility, shallow otherwise ─────────────

function mergeConfig(base: AppConfig, patch: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = { ...base, ...patch }
  if (patch.widgetVisibility) {
    merged.widgetVisibility = { ...base.widgetVisibility, ...patch.widgetVisibility }
  }
  return merged
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ConfigProviderProps {
  children: React.ReactNode
}

export function ConfigProvider({ children }: ConfigProviderProps): React.ReactElement {
  const [config, setConfig]   = useState<AppConfig>(DEFAULT_APP_CONFIG)
  const [isLoaded, setLoaded] = useState(false)
  const lastValidRef          = useRef<AppConfig>(DEFAULT_APP_CONFIG)

  // ── 1. Load config from AppData on mount ──────────────────────────────────
  useEffect(() => {
    const ipc = getIpc()

    if (!ipc) {
      // Browser / dev-only: use localStorage as fallback
      try {
        const raw = localStorage.getItem('cq:config')
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppConfig>
          const merged = mergeConfig(DEFAULT_APP_CONFIG, parsed)
          setConfig(merged)
          lastValidRef.current = merged
        }
      } catch { /* ignore — use defaults */ }
      setLoaded(true)
      return
    }

    ipc.settings.read()
      .then((raw: Record<string, unknown>) => {
        // Shallow merge so unknown future keys don't blow up older builds
        const loaded = mergeConfig(DEFAULT_APP_CONFIG, raw as Partial<AppConfig>)
        setConfig(loaded)
        lastValidRef.current = loaded
        setLoaded(true)
      })
      .catch((err: unknown) => {
        console.warn('[ConfigContext] Failed to read config — using defaults:', err)
        // Recovery: use last known valid (from ref) or DEFAULT
        setConfig(lastValidRef.current)
        setLoaded(true)
      })
  }, [])

  // ── 2. Persist to AppData (debounced 300 ms) ──────────────────────────────
  const persistToIpc = useCallback(async (cfg: AppConfig) => {
    const ipc = getIpc()
    if (!ipc) {
      try { localStorage.setItem('cq:config', JSON.stringify(cfg)) } catch { /* ignore */ }
      return
    }
    try {
      await ipc.settings.write(cfg as unknown as Record<string, unknown>)
      lastValidRef.current = cfg   // update last-known-valid on every successful write
    } catch (err) {
      console.error('[ConfigContext] Failed to persist config:', err)
    }
  }, [])

  const debouncedPersist = useDebounce(persistToIpc, 300)

  // ── 3. updateConfig ───────────────────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfig(prev => {
      const next = mergeConfig(prev, patch)
      debouncedPersist(next)
      // Emit typed events for each changed key so other contexts react immediately
      Object.entries(patch).forEach(([k, v]) => {
        eventBus.emit('configChange', { key: k, value: v })
      })
      return next
    })
  }, [debouncedPersist])

  // ── 4. resetConfig ────────────────────────────────────────────────────────
  const resetConfig = useCallback(async () => {
    const ipc = getIpc()
    try {
      if (ipc) await ipc.settings.reset()
      else localStorage.removeItem('cq:config')
    } catch (err) {
      console.error('[ConfigContext] Reset failed:', err)
    }
    setConfig(DEFAULT_APP_CONFIG)
    lastValidRef.current = DEFAULT_APP_CONFIG
  }, [])

  const value = useMemo<ConfigContextValue>(
    () => ({ config, isLoaded, updateConfig, resetConfig }),
    [config, isLoaded, updateConfig, resetConfig]
  )

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig() must be used inside <ConfigProvider>')
  return ctx
}
