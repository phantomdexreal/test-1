/**
 * cQikly — Bill Number Engine
 * Built in: Phase 4b-ii
 *
 * Hard Spec #3 (MUST NOT DEVIATE):
 *   - On financial year reset (April 1st by default, configurable), bill number
 *     ALWAYS restarts from 1 — never from the user-configured starting number.
 *   - The user-configured starting number is a ONE-TIME-ONLY migration setting
 *     used only for the very first run of the app.
 *   - Deleted bill numbers are skipped and NEVER reused.
 *   - New year prefix is applied on each financial year reset.
 *   - Prefix is configurable in Settings.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BillNumberConfig {
  prefix: string            // e.g. "INV/" — configurable from Settings
  fyStartMonth: number      // 1–12; default 4 (April)
  resetCycle: 'yearly' | 'monthly' | 'never'
}

export interface BillNumberState {
  currentNumber: number      // the last used bill number (incremented on each save)
  currentFYPrefix: string    // e.g. "25-26/" — changes on FY reset
  lastResetDate: string      // ISO date string of last reset
  migrationStartNumber: number | null  // one-time-only, null after first use
  migrationConsumed: boolean // true after migration starting number has been used once
  deletedNumbers: string[]   // full bill numbers that were deleted (never reused)
}

// ─── Financial year helpers ────────────────────────────────────────────────────

/**
 * Computes the FY prefix string for a given date and FY start month.
 * Example: date = May 2025, fyStartMonth = 4 (April) → "25-26/"
 * Example: date = Feb 2025, fyStartMonth = 4 (April) → "24-25/"
 */
export function getFYPrefix(date: Date, fyStartMonth: number): string {
  const month = date.getMonth() + 1 // 1-indexed
  const year = date.getFullYear()
  // If current month is before FY start, we're still in the previous FY year
  const fyStartYear = month >= fyStartMonth ? year : year - 1
  const fyEndYear = fyStartYear + 1
  return `${String(fyStartYear).slice(2)}-${String(fyEndYear).slice(2)}/`
}

/**
 * Returns true if a reset is due based on cycle + current date vs last reset date.
 */
export function isResetDue(
  state: BillNumberState,
  config: BillNumberConfig,
  now: Date = new Date()
): boolean {
  if (config.resetCycle === 'never') return false

  const lastReset = new Date(state.lastResetDate)
  const currentFYPrefix = getFYPrefix(now, config.fyStartMonth)

  if (config.resetCycle === 'yearly') {
    // Reset if the current FY prefix differs from stored one
    return currentFYPrefix !== state.currentFYPrefix
  }

  if (config.resetCycle === 'monthly') {
    // Reset if month or year changed since last reset
    return (
      now.getFullYear() !== lastReset.getFullYear() ||
      now.getMonth() !== lastReset.getMonth()
    )
  }

  return false
}

/**
 * Formats a bill number string from config + state + number.
 * Format: {prefix}{fyPrefix}{number}
 * Example: "INV/25-26/42"
 */
export function formatBillNumber(
  config: BillNumberConfig,
  state: BillNumberState,
  number: number
): string {
  if (config.resetCycle === 'never') {
    // No year prefix for "never" reset cycle
    return `${config.prefix}${number}`
  }
  return `${config.prefix}${state.currentFYPrefix}${number}`
}

// ─── Bill Number Engine ─────────────────────────────────────────────────────────

/**
 * BillNumberEngine: stateful engine managing bill number generation.
 * One instance per active DB / company profile.
 * All state is persisted to settings DB via the persist callback.
 */
export class BillNumberEngine {
  private config: BillNumberConfig
  private state: BillNumberState
  private persist: (state: BillNumberState) => Promise<void>

  constructor(
    config: BillNumberConfig,
    state: BillNumberState,
    persist: (state: BillNumberState) => Promise<void>
  ) {
    this.config = config
    this.state = state
    this.persist = persist
  }

  /**
   * Check for FY/monthly reset and apply if due.
   * Called before generating any new bill number.
   */
  private async applyResetIfDue(now: Date = new Date()): Promise<void> {
    if (!isResetDue(this.state, this.config, now)) return

    const newFYPrefix = getFYPrefix(now, this.config.fyStartMonth)
    // Hard Spec #3: Always restart from 1 on reset — NEVER from migration number
    this.state = {
      ...this.state,
      currentNumber: 0,          // will be incremented to 1 on next getNext()
      currentFYPrefix: newFYPrefix,
      lastResetDate: now.toISOString(),
      // deletedNumbers remains — they're from the old year anyway, different prefix
    }
    await this.persist(this.state)
  }

  /**
   * Peek at what the next bill number will be (without incrementing).
   * Used to display the upcoming bill number in the UI.
   */
  async peek(now: Date = new Date()): Promise<string> {
    const tempState = { ...this.state }
    let nextNum: number

    if (isResetDue(tempState, this.config, now)) {
      // After reset, number will be 1
      nextNum = 1
      const newFYPrefix = getFYPrefix(now, this.config.fyStartMonth)
      tempState.currentFYPrefix = newFYPrefix
      tempState.currentNumber = 0
    } else {
      nextNum = tempState.currentNumber + 1
    }

    // Handle one-time migration starting number (only if not yet consumed)
    if (!tempState.migrationConsumed && tempState.migrationStartNumber !== null && tempState.currentNumber === 0) {
      nextNum = tempState.migrationStartNumber
    }

    return formatBillNumber(this.config, tempState, nextNum)
  }

  /**
   * Generate the next bill number, increment state, persist.
   * Call this at the moment a bill is actually saved (committed).
   *
   * Hard Spec #3: Migration starting number used ONCE on very first bill,
   * then never again — all subsequent year resets go back to 1.
   */
  async getNext(now: Date = new Date()): Promise<string> {
    await this.applyResetIfDue(now)

    let nextNum: number

    // One-time migration: if this is the very first bill and migration number set
    if (!this.state.migrationConsumed && this.state.migrationStartNumber !== null && this.state.currentNumber === 0) {
      nextNum = this.state.migrationStartNumber
      this.state = {
        ...this.state,
        currentNumber: nextNum,
        migrationConsumed: true,
      }
    } else {
      nextNum = this.state.currentNumber + 1
      this.state = { ...this.state, currentNumber: nextNum }
    }

    await this.persist(this.state)
    return formatBillNumber(this.config, this.state, nextNum)
  }

  /**
   * Mark a bill number as deleted (it will never be reused).
   * Hard Spec #3: Deleted numbers are skipped forever.
   */
  async markDeleted(billNumber: string): Promise<void> {
    if (this.state.deletedNumbers.includes(billNumber)) return
    this.state = {
      ...this.state,
      deletedNumbers: [...this.state.deletedNumbers, billNumber],
    }
    await this.persist(this.state)
  }

  /** Returns a copy of current state (for display/debugging). */
  getState(): BillNumberState {
    return { ...this.state }
  }

  /** Update config (e.g. when user changes prefix in Settings). */
  async updateConfig(config: BillNumberConfig): Promise<void> {
    this.config = config
    // Persist the updated FY prefix if it changed
    const now = new Date()
    const newFYPrefix = getFYPrefix(now, config.fyStartMonth)
    this.state = { ...this.state, currentFYPrefix: newFYPrefix }
    await this.persist(this.state)
  }

  /** Current config (for reading prefix etc). */
  getConfig(): BillNumberConfig {
    return { ...this.config }
  }
}

// ─── Default state factory ─────────────────────────────────────────────────────

export function createDefaultBillNumberState(
  fyStartMonth: number = 4,
  migrationStartNumber: number | null = null
): BillNumberState {
  const now = new Date()
  return {
    currentNumber: 0,
    currentFYPrefix: getFYPrefix(now, fyStartMonth),
    lastResetDate: now.toISOString(),
    migrationStartNumber,
    migrationConsumed: false,
    deletedNumbers: [],
  }
}

// ─── Singleton engine (in-memory for dev/browser; IPC-backed in Electron) ─────

let _engine: BillNumberEngine | null = null

function _loadStateFromStorage(): BillNumberState {
  try {
    const raw = localStorage.getItem('cq:billNumberState')
    if (raw) return JSON.parse(raw) as BillNumberState
  } catch { /* ignore */ }
  return createDefaultBillNumberState(4, null)
}

function _loadConfigFromStorage(): BillNumberConfig {
  try {
    const raw = localStorage.getItem('cq:billNumberConfig')
    if (raw) return JSON.parse(raw) as BillNumberConfig
  } catch { /* ignore */ }
  return { prefix: 'INV/', fyStartMonth: 4, resetCycle: 'yearly' }
}

async function _persistState(state: BillNumberState): Promise<void> {
  try {
    localStorage.setItem('cq:billNumberState', JSON.stringify(state))
  } catch { /* ignore */ }
}

/** Get or create the singleton BillNumberEngine. */
export function getBillNumberEngine(): BillNumberEngine {
  if (!_engine) {
    const config = _loadConfigFromStorage()
    const state = _loadStateFromStorage()
    _engine = new BillNumberEngine(config, state, _persistState)
  }
  return _engine
}

/** Reset singleton (call when switching company profiles / DB). */
export function resetBillNumberEngine(): void {
  _engine = null
}

/** Update engine config (called when Settings change). */
export async function updateBillNumberConfig(config: BillNumberConfig): Promise<void> {
  try {
    localStorage.setItem('cq:billNumberConfig', JSON.stringify(config))
  } catch { /* ignore */ }
  const engine = getBillNumberEngine()
  await engine.updateConfig(config)
}

/** Convenience: set migration starting number (one-time, from onboarding). */
export async function setMigrationStartingNumber(n: number): Promise<void> {
  const engine = getBillNumberEngine()
  const state = engine.getState()
  if (state.migrationConsumed) return // one-time only — do nothing if already consumed
  const newState: BillNumberState = { ...state, migrationStartNumber: n }
  await _persistState(newState)
  // Rebuild engine with updated state
  const config = engine.getConfig()
  _engine = new BillNumberEngine(config, newState, _persistState)
}
