/**
 * cQikly — DBContext
 * Built in: Phase 1a-ii-A
 *
 * Responsibilities:
 *   - Manages the active SQLite connection reference from the renderer side
 *   - Tracks which DB file path is currently open (queried from main via IPC)
 *   - Exposes atomic hot-swap: drain writes → swap via IPC → broadcast 'db-ready'
 *   - Broadcasts 'db-ready' via eventBus so services re-initialize on swap
 *   - Separate SQLite file per company profile / branch (Hard Spec #9)
 *   - All DB calls go through db.service.ts — this context only manages the
 *     connection lifecycle, never SQL directly
 *
 * Hot-swap sequence (Hard Spec #9 + Architecture Section 5):
 *   1. Set swapping = true (blocks new write initiation from components)
 *   2. Call window.cqikly.db.swap(newPath) — main process drains + swaps
 *   3. Read back the new activePath to confirm
 *   4. Emit eventBus 'dbSwap' event so dependent services rebuild their caches
 *   5. Set swapping = false, isReady = true
 *
 * Export: DBProvider, useDB()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { loadBillsFromDb } from '../services/bill.service'
import { loadCustomers } from '../services/customer.service'
import { loadInventoryFromDb } from '../services/inventory.service'
import { loadAllPaymentsFromDb } from '../services/payment.service'
import { eventBus } from '../utils/eventBus'
import { resetBillNumberEngine } from '../utils/billNumber'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DBContextValue {
  /** True once the initial DB connection has been confirmed */
  isReady: boolean
  /** Absolute path of the currently open SQLite file */
  activeDbPath: string | null
  /** True while a swap is in progress — guards against concurrent operations */
  isSwapping: boolean
  /**
   * Atomically swap to a different SQLite file.
   * Resolves when the new connection is confirmed ready.
   * Throws if the swap fails — caller handles recovery.
   */
  swapDatabase: (newDbPath: string) => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DBContext = createContext<DBContextValue | null>(null)

// ─── IPC helper ───────────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface DBProviderProps {
  children: React.ReactNode
}

export function DBProvider({ children }: DBProviderProps): React.ReactElement {
  const [isReady,      setReady]      = useState(false)
  const [activeDbPath, setActiveDbPath] = useState<string | null>(null)
  const [isSwapping,   setSwapping]   = useState(false)

  // ── 1. Read initial active DB path from main process ─────────────────────
  useEffect(() => {
    const ipc = getIpc()

    if (!ipc) {
      // Browser / dev-without-Electron: mark ready with null path
      setReady(true)
      return
    }

    ipc.db.getActivePath()
      .then(async (p: string) => {
        setActiveDbPath(p || null)
        await loadCustomers()   // must complete first — payments need the customer cache
        await Promise.all([
          loadBillsFromDb(),
          loadInventoryFromDb(),
          loadAllPaymentsFromDb(),
        ])
        setReady(true)
      })
      .catch((err: unknown) => {
        console.error('[DBContext] Failed to read active DB path:', err)
        // Still mark ready so the app doesn't hang — DB may not be needed immediately
        setReady(true)
      })
  }, [])

  // ── 2. Hot-swap implementation ────────────────────────────────────────────
  const swapDatabase = useCallback(async (newDbPath: string) => {
    const ipc = getIpc()
    if (!ipc) {
      console.warn('[DBContext] swapDatabase called but IPC bridge not available')
      setActiveDbPath(newDbPath)
      return
    }

    if (isSwapping) {
      throw new Error('[DBContext] A DB swap is already in progress')
    }

    setSwapping(true)
    setReady(false)

    try {
      // ── Step 1-3: Main process drains writes, closes old, opens new ───────
      await ipc.db.swap(newDbPath)

      // ── Step 4: Confirm new path from main process ────────────────────────
      const confirmedPath = await ipc.db.getActivePath()
      setActiveDbPath(confirmedPath || newDbPath)

      // ── Step 5: Emit dbSwap event and reload all service caches ──────────
      eventBus.emit('dbSwap', { newDbPath: confirmedPath ?? newDbPath })
      resetBillNumberEngine()   // FIX-20: force re-init from storage on next bill save; prevents old company's sequence carrying over
      await loadCustomers()   // must complete first — payments need the customer cache
      await Promise.all([
        loadBillsFromDb(),
        loadInventoryFromDb(),
        loadAllPaymentsFromDb(),
      ])
      setReady(true)
    } catch (err) {
      console.error('[DBContext] DB swap failed:', err)
      // Keep isReady = false so dependent components know DB is in bad state
      setSwapping(false)
      throw err
    } finally {
      setSwapping(false)
    }
  }, [isSwapping])

  const value = useMemo<DBContextValue>(
    () => ({ isReady, activeDbPath, isSwapping, swapDatabase }),
    [isReady, activeDbPath, isSwapping, swapDatabase]
  )

  return (
    <DBContext.Provider value={value}>
      {children}
    </DBContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDB(): DBContextValue {
  const ctx = useContext(DBContext)
  if (!ctx) throw new Error('useDB() must be used inside <DBProvider>')
  return ctx
}
