/**
 * cQikly — App-Wide Default Configuration Values
 * Single source of truth for all default settings.
 */

/** Financial year start month (1 = Jan, 4 = April = India standard) */
export const DEFAULT_FY_START_MONTH = 4

/** Default bill number prefix (empty = no prefix) */
export const DEFAULT_BILL_PREFIX = ''

/** Default bill reset cycle */
export const DEFAULT_BILL_RESET_CYCLE = 'yearly' as const

/** Default performance mode */
export const DEFAULT_PERFORMANCE_MODE = 'balanced' as const

/** Default theme */
export const DEFAULT_THEME_ID = 'space-particles' as const

/** Default dark/light variant */
export const DEFAULT_THEME_VARIANT = 'dark' as const

/** Default language */
export const DEFAULT_LANGUAGE = 'en' as const

/** Default starting bill number (used once for migration; never repeated on year reset) */
export const DEFAULT_STARTING_BILL_NUMBER = 1

/** Billing grid default row count */
export const DEFAULT_GRID_ROWS = 20

/** Maximum bills recoverable as draft (Hard Spec #7: always 1) */
export const MAX_DRAFT_RECOVERY_SLOTS = 1

/** App lock: off by default */
export const DEFAULT_APP_LOCK_ENABLED = false

/** WhatsApp share method: user-configurable (Hard Spec #11) */
export const DEFAULT_WHATSAPP_METHOD = null as null | 'desktop' | 'web'

/** All dashboard widget visibility defaults (all shown by default) */
export const DEFAULT_WIDGET_VISIBILITY = {
  clock: true,
  todoList: true,
  todayBillCount: true,
  totalBills: true,
  todayRevenue: true,
  monthComparison: true,
  topCustomer: true,
  pendingDraftIndicator: true,
  lowStockAlert: true,
  weather: true,
  crypto: true,
  forex: true,
  systemStatus: true,
  calculator: true,
  unitConverter: true,
  currencyConverter: true,
} as const

/** Clock format default */
export const DEFAULT_CLOCK_FORMAT = '12h' as const

/** Convenience re-export matching ConfigContext.AppConfig shape (subset) */
export const DEFAULT_CONFIG = {
  themeId:            DEFAULT_THEME_ID,
  themeVariant:       DEFAULT_THEME_VARIANT,
  performanceMode:    DEFAULT_PERFORMANCE_MODE,
  language:           DEFAULT_LANGUAGE,
  onboardingComplete: false,
  companyProfileId:   null as string | null,
} as const

// ── Phase 3b-i: API Widget Defaults ──────────────────────────────────────────

/** Default city for weather widget */
export const DEFAULT_WEATHER_CITY = 'Mumbai'

/** Default currency for crypto widget */
export const DEFAULT_CRYPTO_CURRENCY = 'inr'

/** Default crypto coin IDs (CoinGecko) */
export const DEFAULT_CRYPTO_IDS = ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple']

/** Default forex currency pairs */
export const DEFAULT_FOREX_PAIRS = [
  { from: 'USD', to: 'INR' },
  { from: 'EUR', to: 'INR' },
  { from: 'GBP', to: 'INR' },
  { from: 'USD', to: 'EUR' },
  { from: 'AED', to: 'INR' },
]
