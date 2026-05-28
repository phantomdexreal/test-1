/**
 * cQikly — Billing Grid Types
 * Phase 5a: Core billing row, adjustments, totals.
 * Phase 5b: Custom columns, Mark system, Undo/Redo stack types.
 */

// ─── Row ───────────────────────────────────────────────────────────────────────

export interface BillingRow {
  id: string
  itemName: string
  qty: string
  qtyUnit: string
  rate: string
  discountValue: string
  discountType: 'pct' | 'flat'
  amount: number
  preTax: number
  gstPct: string
  gstAmt: number
}

export function createEmptyRow(id: string): BillingRow {
  return {
    id,
    itemName: '',
    qty: '',
    qtyUnit: '',
    rate: '',
    discountValue: '',
    discountType: 'pct',
    amount: 0,
    preTax: 0,
    gstPct: '',
    gstAmt: 0,
  }
}

// ─── Custom Column ─────────────────────────────────────────────────────────────

/**
 * A single custom column added by the user via +Col.
 * The header name is fully user-defined — nothing is hardcoded.
 */
export interface CustomColumn {
  /** Stable ID for React keys */
  id: string
  /** Fully user-defined header name — e.g. "THREAD", "SIZE", "COLOUR CODE" */
  header: string
}

/**
 * A single cell in a custom column.
 * `marked` = this cell is a named sub-group header within the column.
 * Marked cells show their text as a group divider; everything after a marked cell
 * belongs to that group until the next marked cell or end of column.
 */
export interface CustomColCell {
  /** The text content typed by the user */
  value: string
  /** When true this cell is a group header (Mark system) */
  marked: boolean
}

/**
 * All custom column data for a bill.
 * Key = CustomColumn.id  →  Value = array of CustomColCell (one per row, index-matched to BillingRow[])
 */
export type CustomColData = Record<string, CustomColCell[]>

/** Create a fresh CustomColCell */
export function emptyCell(): CustomColCell {
  return { value: '', marked: false }
}

// ─── MKD qty parsing (Hard Spec §2.1) ─────────────────────────────────────────

/**
 * Parse a single custom cell entry to extract quantity.
 *
 * Rules (Hard Spec §2.1 — locked, do not deviate):
 *   - `+` is ALWAYS plain text, never a separator. The whole entry = qty 1.
 *   - `-` and `=` are the only valid separators.
 *   - Entry with no separator (e.g. `1024`, `black`) → qty = 1
 *   - Entry with separator: qty = numeric value after the separator (e.g. `1024-2` → 2, `black=3` → 3)
 *   - If value after separator is non-numeric → qty = 1
 *   - Empty string → qty = 0 (not counted)
 */
export function parseMkdQty(entry: string): number {
  const s = entry.trim()
  if (s === '') return 0

  // `+` is ALWAYS plain text — the whole entry counts as qty 1
  // Only `-` and `=` are separators.
  // Match the FIRST occurrence of `-` or `=` (not the last) so that entries
  // like "black-medium=3" use the `-` separator and produce qty from "medium=3"
  // rather than silently skipping to `=3`. Using the first separator is the
  // most predictable behaviour for the user.
  const sepIdx = s.search(/[-=]/)
  if (sepIdx === -1) {
    // No valid separator found → qty = 1
    return 1
  }

  const after = s.slice(sepIdx + 1).trim()
  if (after === '') return 1

  const n = parseFloat(after)
  if (!Number.isFinite(n)) return 1

  return n
}

/**
 * Compute MKD totals for a custom column.
 * Returns an ordered array of groups: { groupName, total }
 *
 * The first group (before any marked cell) uses the column header name.
 * Marked cells start a new group with the cell's own text as the group name.
 * Marked cell text itself is NOT counted as qty.
 */
export function computeMkdGroups(
  colHeader: string,
  cells: CustomColCell[],
): { groupName: string; total: number }[] {
  const groups: { groupName: string; total: number }[] = []
  let currentGroup = colHeader
  let currentTotal = 0

  for (const cell of cells) {
    if (cell.marked) {
      // Save previous group (only if it has a name or items)
      groups.push({ groupName: currentGroup, total: currentTotal })
      // Start new group using the marked cell's text as the group name
      currentGroup = cell.value.trim() || '(unnamed group)'
      currentTotal = 0
      // Marked cell itself is NOT counted as data
    } else {
      currentTotal += parseMkdQty(cell.value)
    }
  }

  // Push the last open group
  groups.push({ groupName: currentGroup, total: currentTotal })

  return groups
}

// ─── Adjustment ────────────────────────────────────────────────────────────────

export interface AdjustmentRow {
  id: string
  label: string
  amount: string
}

export function createEmptyAdjustment(id: string): AdjustmentRow {
  return { id, label: '', amount: '' }
}

// ─── Column visibility ─────────────────────────────────────────────────────────

export interface GridColumnToggles {
  showDiscount: boolean
  showQtyUnit: boolean
}

export const DEFAULT_COLUMN_TOGGLES: GridColumnToggles = {
  showDiscount: false,
  showQtyUnit: false,
}

// ─── Bill format ───────────────────────────────────────────────────────────────

export type BillFormat = 'free' | 'gst'

// ─── Calculated totals ─────────────────────────────────────────────────────────

export interface BillTotals {
  subtotal: number
  adjustmentsTotal: number
  grandTotal: number
}

// ─── Cell address ──────────────────────────────────────────────────────────────

export const FREE_FORMAT_NAV_COLS = [
  'itemName', 'qtyUnit', 'qty', 'discountValue', 'rate',
] as const

export const GST_FORMAT_NAV_COLS = [
  'itemName', 'qtyUnit', 'qty', 'discountValue', 'rate', 'gstPct',
] as const

export type FreeFormatCol = typeof FREE_FORMAT_NAV_COLS[number]
export type GstFormatCol  = typeof GST_FORMAT_NAV_COLS[number]
export type GridCol = FreeFormatCol | GstFormatCol

export interface CellAddress {
  rowIdx: number
  col: GridCol
}

// ─── Undo/Redo snapshot ────────────────────────────────────────────────────────

/**
 * A full snapshot of mutable grid state used for grid-level undo/redo.
 * Only within the current bill session — not persisted to DB.
 */
export interface GridSnapshot {
  rows: BillingRow[]
  customCols: CustomColumn[]
  customColData: CustomColData
  adjustments: AdjustmentRow[]
}

// ─── Arithmetic helpers ────────────────────────────────────────────────────────

export function parseNum(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function recalcRow(row: BillingRow, format: BillFormat): BillingRow {
  const qty  = parseNum(row.qty)
  const rate = parseNum(row.rate)
  const base = qty * rate

  let discountedBase = base
  const dv = parseNum(row.discountValue)
  if (dv !== 0 && row.discountValue !== '') {
    if (row.discountType === 'pct') {
      discountedBase = base - (base * dv / 100)
    } else {
      discountedBase = base - dv
    }
  }
  discountedBase = Math.max(0, discountedBase)

  if (format === 'free') {
    row.preTax = 0
    row.gstAmt = 0
    row.amount = discountedBase
  } else {
    row.preTax = discountedBase
    const gstPct = parseNum(row.gstPct)
    row.gstAmt = (row.preTax * gstPct) / 100
    row.amount = row.preTax + row.gstAmt
  }
  return row
}

export function calcSlNos(rows: BillingRow[]): number[] {
  let counter = 0
  return rows.map(r => {
    const hasItem = r.itemName.trim() !== ''
    const hasQtyOrRate = r.qty.trim() !== '' || r.rate.trim() !== ''
    if (hasItem && hasQtyOrRate) {
      counter++
      return counter
    }
    return 0
  })
}

export function computeTotals(
  rows: BillingRow[],
  adjustments: AdjustmentRow[],
): BillTotals {
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + parseNum(a.amount), 0)
  const grandTotal = Math.round(subtotal + adjustmentsTotal)
  return { subtotal, adjustmentsTotal, grandTotal }
}

// ─── Cell Formatting (Phase 4a-i) ─────────────────────────────────────────────

/**
 * Per-cell text formatting applied via the Bold+Highlight toolbar button.
 * `textColor` applies to the entire cell text (simplification: full-cell color).
 * `bold` makes the entire cell text bold.
 * `bgColor` is the cell background highlight color (Highlight Cell button).
 *
 * Colors are stored as CSS color strings (e.g. "#ff0000", "rgba(255,0,0,0.3)").
 * These persist with bill data and are always restored when a bill is reopened.
 */
export interface CellFormat {
  bold?: boolean
  textColor?: string   // Text/highlight color from Bold+Highlight button
  bgColor?: string     // Full cell background from Highlight Cell button
}

/**
 * Key format: "{rowId}:{colName}" for standard cells, "custom:{colId}:{rowId}" for custom cells
 * rowId is the BillingRow.id string (stable across reorders).
 */
export type CellFormatMap = Record<string, CellFormat>
