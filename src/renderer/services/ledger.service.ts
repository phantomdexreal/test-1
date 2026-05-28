/**
 * cQikly — Outstanding / Ledger Service
 * Phase 7b
 *
 * Responsibilities:
 *   - Compute outstanding balance per customer (total billed vs total paid)
 *   - Provide per-customer bill summary filterable by date range
 *   - Drive the "Outstanding Ledger" view on the History page
 *
 * Architecture: Pure computation functions — no DB calls.
 * All data is passed in from bill.service and customer.service.
 *
 * Note: "Total Paid" in Phase 7b is approximated from bill statuses
 * (paid bills count as fully paid; partial bills count as 0 paid).
 * Phase 8b adds a full payment recorder that tracks exact amounts paid per bill.
 */

import type { BillRecord } from './db.service'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CustomerLedgerRow {
  partyName: string
  partyPhone?: string
  billCount: number
  totalBilled: number
  /** Approximated until Phase 8b payment recorder is built */
  totalPaid: number
  outstanding: number
  /** Breakdown by status for display */
  statusBreakdown: {
    unpaid: number
    paid: number
    partial: number
    cancelled: number
  }
  /** The bills themselves (for drill-down) */
  bills: BillRecord[]
}

export interface LedgerDateRange {
  dateFrom: string   // ISO YYYY-MM-DD or ''
  dateTo: string     // ISO YYYY-MM-DD or ''
}

// ─── Ledger computation ───────────────────────────────────────────────────────

/**
 * Compute outstanding ledger per customer from a flat list of bills.
 * Optionally filtered by date range.
 *
 * Total Paid approximation (Phase 7b):
 *   - Bills with status 'paid' → full grand total counted as paid
 *   - Bills with status 'partial' → 0 paid (exact amount unknown until Phase 8b)
 *   - Bills with status 'unpaid' → 0 paid
 *   - Bills with status 'cancelled' → excluded from billed total
 *
 * Sorted by outstanding descending (highest debt first).
 */
export function computeLedger(
  bills: BillRecord[],
  range?: LedgerDateRange,
): CustomerLedgerRow[] {
  // Apply date range filter if provided
  let filtered = [...bills]
  if (range?.dateFrom) {
    filtered = filtered.filter(b => (b.billDate || '').slice(0, 10) >= range.dateFrom)
  }
  if (range?.dateTo) {
    filtered = filtered.filter(b => (b.billDate || '').slice(0, 10) <= range.dateTo)
  }

  // Group by party name (case-insensitive)
  const map = new Map<string, BillRecord[]>()
  for (const bill of filtered) {
    const key = bill.partyName.trim().toLowerCase()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(bill)
  }

  const rows: CustomerLedgerRow[] = []

  for (const [, partyBills] of map) {
    const first = partyBills[0]
    let totalBilled = 0
    let totalPaid = 0
    const breakdown = { unpaid: 0, paid: 0, partial: 0, cancelled: 0 }

    for (const b of partyBills) {
      const amt = Math.round(b.grandTotal ?? 0)
      breakdown[b.status] = (breakdown[b.status] ?? 0) + 1

      if (b.status === 'cancelled') continue  // Don't count cancelled in billed
      totalBilled += amt
      if (b.status === 'paid') totalPaid += amt
      // partial: exact paid amount tracked in Phase 8b; for now count 0 paid
    }

    rows.push({
      partyName: first.partyName,
      partyPhone: first.partyPhone,
      billCount: partyBills.filter(b => b.status !== 'cancelled').length,
      totalBilled,
      totalPaid,
      outstanding: totalBilled - totalPaid,
      statusBreakdown: breakdown,
      bills: partyBills.sort((a, b) =>
        (b.billDate || b.createdAt || '').localeCompare(a.billDate || a.createdAt || '')
      ),
    })
  }

  // Sort by outstanding desc (highest first), then by name
  rows.sort((a, b) => {
    if (b.outstanding !== a.outstanding) return b.outstanding - a.outstanding
    return a.partyName.localeCompare(b.partyName, 'en-IN')
  })

  return rows
}

/**
 * Get ledger summary totals across all customers.
 */
export function getLedgerTotals(rows: CustomerLedgerRow[]): {
  totalBilled: number
  totalPaid: number
  totalOutstanding: number
  customerCount: number
} {
  return {
    totalBilled: rows.reduce((s, r) => s + r.totalBilled, 0),
    totalPaid: rows.reduce((s, r) => s + r.totalPaid, 0),
    totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    customerCount: rows.length,
  }
}
