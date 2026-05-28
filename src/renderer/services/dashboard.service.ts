/**
 * cQikly — Dashboard Data Service
 * Phase: 3a-B
 *
 * Provides all DB-reading queries needed by dashboard widgets.
 * ALL SQL calls go through window.cqikly.db — never direct SQLite from renderer.
 *
 * Methods:
 *  - getTodayBillCount()         → number of bills created today
 *  - getTotalBillCount()         → total bills ever created
 *  - getTodayRevenue()           → sum of grand_total for today's bills
 *  - getThisMonthRevenue()       → sum of grand_total for current calendar month
 *  - getLastMonthRevenue()       → sum of grand_total for previous calendar month
 *  - getTopCustomerThisMonth()   → { partyName, totalAmount } top customer by billed value this month
 *  - hasPendingDraft()           → boolean — checks crash_draft via IPC
 *  - getLowStockItems()          → inventory items where stock_qty < min_stock (and min_stock IS NOT NULL)
 *
 * All methods return sensible defaults on error (0, null, [], false).
 * Never throws — dashboard widgets must degrade gracefully.
 */

// ─── IPC bridge ────────────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

async function dbQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const ipc = getIpc()
  if (!ipc) return []
  try {
    const rows = await ipc.db.query(sql, params)
    return (rows as T[]) ?? []
  } catch (err) {
    console.warn('[dashboard.service] db query error:', err)
    return []
  }
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as ISO string "YYYY-MM-DD" */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns first day of current month "YYYY-MM-01" */
function thisMonthStart(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

/** Returns first day of next month (exclusive upper bound for this month) */
function nextMonthStart(): string {
  const d = new Date()
  const month = d.getMonth() + 2 // 1-indexed next month
  if (month > 12) {
    return `${d.getFullYear() + 1}-01-01`
  }
  return `${d.getFullYear()}-${String(month).padStart(2, '0')}-01`
}

/** Returns first day of last month */
function lastMonthStart(): string {
  const d = new Date()
  const month = d.getMonth() // 0-indexed, so this is last month as 1-indexed
  if (month === 0) {
    return `${d.getFullYear() - 1}-12-01`
  }
  return `${d.getFullYear()}-${String(month).padStart(2, '0')}-01`
}

// ─── Service methods ───────────────────────────────────────────────────────────

/** Number of bills created today (non-deleted, non-draft) */
export async function getTodayBillCount(): Promise<number> {
  const today = todayStr()
  const rows = await dbQuery<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM bills WHERE bill_date = ? AND deleted_at IS NULL AND draft = 0`,
    [today]
  )
  return rows[0]?.cnt ?? 0
}

/** Total number of bills ever (non-deleted, non-draft) */
export async function getTotalBillCount(): Promise<number> {
  const rows = await dbQuery<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM bills WHERE deleted_at IS NULL AND draft = 0`
  )
  return rows[0]?.cnt ?? 0
}

/** Sum of grand_total for today's bills */
export async function getTodayRevenue(): Promise<number> {
  const today = todayStr()
  const rows = await dbQuery<{ total: number | null }>(
    `SELECT SUM(grand_total) as total FROM bills WHERE bill_date = ? AND deleted_at IS NULL AND draft = 0`,
    [today]
  )
  return rows[0]?.total ?? 0
}

/** Sum of grand_total for current calendar month */
export async function getThisMonthRevenue(): Promise<number> {
  const rows = await dbQuery<{ total: number | null }>(
    `SELECT SUM(grand_total) as total FROM bills
     WHERE bill_date >= ? AND bill_date < ? AND deleted_at IS NULL AND draft = 0`,
    [thisMonthStart(), nextMonthStart()]
  )
  return rows[0]?.total ?? 0
}

/** Sum of grand_total for last calendar month */
export async function getLastMonthRevenue(): Promise<number> {
  const rows = await dbQuery<{ total: number | null }>(
    `SELECT SUM(grand_total) as total FROM bills
     WHERE bill_date >= ? AND bill_date < ? AND deleted_at IS NULL AND draft = 0`,
    [lastMonthStart(), thisMonthStart()]
  )
  return rows[0]?.total ?? 0
}

export interface TopCustomerResult {
  partyName: string
  totalAmount: number
  billCount: number
}

/** Customer with highest billed grand_total this calendar month */
export async function getTopCustomerThisMonth(): Promise<TopCustomerResult | null> {
  const rows = await dbQuery<TopCustomerResult>(
    `SELECT party_name as partyName, SUM(grand_total) as totalAmount, COUNT(*) as billCount
     FROM bills
     WHERE bill_date >= ? AND bill_date < ? AND deleted_at IS NULL AND draft = 0
     GROUP BY party_name
     ORDER BY totalAmount DESC
     LIMIT 1`,
    [thisMonthStart(), nextMonthStart()]
  )
  return rows[0] ?? null
}

/** Check for a pending crash draft via IPC crash recovery channel */
export async function hasPendingDraft(): Promise<boolean> {
  const ipc = getIpc()
  if (!ipc) return false
  try {
    return await ipc.crashRecovery.hasDraft()
  } catch {
    return false
  }
}

export interface LowStockItem {
  itemName: string
  stockQty: number
  minStock: number
}

/** Inventory items where stock_qty < min_stock (and min_stock is set) */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  // In Electron mode: query SQLite directly for accuracy
  // In browser/dev mode: read from inventoryService in-memory store
  const ipc = getIpc()
  if (ipc) {
    const rows = await dbQuery<{ item_name: string; stock_qty: number; min_stock: number }>(
      `SELECT item_name, stock_qty, min_stock FROM inventory_items
       WHERE min_stock IS NOT NULL AND stock_qty < min_stock AND deleted_at IS NULL
       ORDER BY (stock_qty - min_stock) ASC
       LIMIT 20`
    )
    return rows.map(r => ({
      itemName: r.item_name,
      stockQty: r.stock_qty,
      minStock: r.min_stock,
    }))
  }

  // Browser/dev mode — read from inventoryService
  try {
    const { inventoryService } = await import('./inventory.service')
    const items = inventoryService.getItems()
    const lowItems: LowStockItem[] = []
    for (const item of items) {
      const qty = parseFloat(item.stockQty)
      const min = parseFloat(item.lowStockThreshold)
      if (!Number.isFinite(min) || item.lowStockThreshold === '') continue
      const effectiveQty = Number.isFinite(qty) ? qty : 0
      if (effectiveQty < min) {
        lowItems.push({ itemName: item.itemName, stockQty: effectiveQty, minStock: min })
      }
    }
    // Sort by most urgent (furthest below threshold first)
    lowItems.sort((a, b) => (a.stockQty - a.minStock) - (b.stockQty - b.minStock))
    return lowItems.slice(0, 20)
  } catch {
    return []
  }
}

/** Format a currency amount as Indian Rupees (compact for widget display) */
export function formatINR(amount: number): string {
  if (amount >= 10_00_000) {
    return `₹${(amount / 10_00_000).toFixed(2)}L`
  }
  if (amount >= 1_000) {
    return `₹${(amount / 1_000).toFixed(1)}K`
  }
  return `₹${amount.toFixed(0)}`
}

/** Full Indian Rupee format for tooltips */
export function formatINRFull(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}
