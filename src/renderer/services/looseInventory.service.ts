/**
 * cQikly — Loose Inventory History Service
 * Phase 10
 *
 * "Loose" items = items that appear in bills but are NOT in the inventory.
 * This service:
 *   1. Derives loose entries by scanning all saved bills.
 *   2. Provides rich analytics per loose item (parties, dates, prices, totals).
 *   3. Exposes filter helpers used by the page.
 *
 * Architecture: All access goes through this service. Components call nothing else.
 * Storage: purely derived from the bills store — no separate persistence needed.
 */

import { getBills } from './bill.service'
import { inventoryService } from './inventory.service'
import type { BillingRow } from '../pages/NewQuote/billingGrid.types'

// ─── Types ────────────────────────────────────────────────────────────────────

/** One occurrence of a loose item inside a single bill row */
export interface LooseEntry {
  /** Canonical normalised item name (lowercase trimmed) */
  itemKey: string
  /** Original casing from the bill row */
  itemName: string
  /** Bill metadata */
  billId: number
  billNumber: string
  billDate: string      // YYYY-MM-DD
  partyName: string
  partyPhone?: string
  /** Billing values */
  qty: string
  qtyUnit?: string
  rate: string
  amount: number
  /** Bill format */
  format: 'free' | 'gst'
  gstPct?: string
}

/** Aggregated analytics for one loose item */
export interface LooseItemAnalytics {
  itemKey: string
  /** Display name — most-used casing variant */
  itemName: string
  /** All raw entries across all bills */
  entries: LooseEntry[]
  /** Total times this item appeared across all bills */
  totalOccurrences: number
  /** Total quantity billed (numeric where parseable) */
  totalQty: number
  /** Total amount billed across all occurrences */
  totalAmount: number
  /** Min / max / avg rate (numeric where parseable) */
  minRate: number
  maxRate: number
  avgRate: number
  /** Unique parties that billed this item */
  parties: string[]
  /** Date range: earliest and latest bill dates */
  firstSeen: string
  lastSeen: string
  /** Price points over time (sorted by date) */
  priceTimeline: Array<{ date: string; rate: string; partyName: string; billNumber: string }>
}

/** Filters for the history view */
export interface LooseHistoryFilters {
  searchText: string        // matches item name (fuzzy substring)
  partyName: string         // exact party filter; '' = all
  dateFrom: string          // YYYY-MM-DD or ''
  dateTo: string            // YYYY-MM-DD or ''
  minAmount: string         // numeric string or ''
  maxAmount: string         // numeric string or ''
}

export const DEFAULT_FILTERS: LooseHistoryFilters = {
  searchText: '',
  partyName: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
}

// ─── Core derivation logic ─────────────────────────────────────────────────────

/**
 * Return the normalised name key for a bill row item.
 * Preserves uniqueness across case variants.
 */
function toItemKey(name: string): string {
  return name.trim().toLowerCase()
}

/**
 * Derive all loose entries from the current bills store.
 * A bill row is "loose" if its item name does NOT match any inventory item name
 * (case-insensitive).
 */
export async function getAllLooseEntries(): Promise<LooseEntry[]> {
  const bills = await getBills()
  const inventoryItems = inventoryService.getItems()
  const inventoryNames = new Set(inventoryItems.map(i => i.itemName.trim().toLowerCase()))

  const results: LooseEntry[] = []

  for (const bill of bills) {
    const rows = (bill.rows ?? []) as BillingRow[]
    for (const row of rows) {
      const name = row.itemName?.trim() ?? ''
      if (!name) continue

      const key = toItemKey(name)
      // Skip if it IS in inventory
      if (inventoryNames.has(key)) continue

      const amount = typeof row.amount === 'number'
        ? row.amount
        : parseFloat(String(row.amount ?? '0')) || 0

      results.push({
        itemKey: key,
        itemName: name,
        billId: bill.id ?? 0,
        billNumber: bill.billNumber ?? '',
        billDate: bill.billDate ?? '',
        partyName: bill.partyName ?? '',
        partyPhone: bill.partyPhone,
        qty: String(row.qty ?? ''),
        qtyUnit: (row as { qtyUnit?: string }).qtyUnit,
        rate: String(row.rate ?? ''),
        amount,
        format: bill.format ?? 'free',
        gstPct: String((row as { gstPct?: string }).gstPct ?? ''),
      })
    }
  }

  // Sort newest first
  return results.sort((a, b) => b.billDate.localeCompare(a.billDate))
}

/**
 * Group loose entries by item key and compute per-item analytics.
 */
export async function getLooseItemAnalytics(): Promise<LooseItemAnalytics[]> {
  const entries = await getAllLooseEntries()

  const grouped = new Map<string, LooseEntry[]>()
  for (const e of entries) {
    const list = grouped.get(e.itemKey) ?? []
    list.push(e)
    grouped.set(e.itemKey, list)
  }

  const result: LooseItemAnalytics[] = []

  for (const [itemKey, group] of grouped) {
    // Most-used casing variant as display name
    const nameCounts = new Map<string, number>()
    for (const e of group) nameCounts.set(e.itemName, (nameCounts.get(e.itemName) ?? 0) + 1)
    const itemName = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    // Compute numeric rates and amounts
    const rates = group.map(e => parseFloat(e.rate)).filter(Number.isFinite)
    const qtys = group.map(e => parseFloat(e.qty)).filter(Number.isFinite)
    const totalAmount = group.reduce((s, e) => s + e.amount, 0)
    const totalQty = qtys.reduce((s, q) => s + q, 0)

    const parties = [...new Set(group.map(e => e.partyName))].sort()

    const dates = group.map(e => e.billDate).filter(Boolean).sort()
    const firstSeen = dates[0] ?? ''
    const lastSeen = dates[dates.length - 1] ?? ''

    const priceTimeline = group
      .filter(e => e.rate && e.rate !== '0')
      .map(e => ({
        date: e.billDate,
        rate: e.rate,
        partyName: e.partyName,
        billNumber: e.billNumber,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    result.push({
      itemKey,
      itemName,
      entries: group,
      totalOccurrences: group.length,
      totalQty,
      totalAmount,
      minRate: rates.length ? Math.min(...rates) : 0,
      maxRate: rates.length ? Math.max(...rates) : 0,
      avgRate: rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : 0,
      parties,
      firstSeen,
      lastSeen,
      priceTimeline,
    })
  }

  // Sort by total amount desc
  return result.sort((a, b) => b.totalAmount - a.totalAmount)
}

/**
 * Apply filters to a list of LooseEntry records.
 */
export function applyFilters(entries: LooseEntry[], filters: LooseHistoryFilters): LooseEntry[] {
  return entries.filter(e => {
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase()
      if (!e.itemName.toLowerCase().includes(q) && !e.itemKey.includes(q)) return false
    }
    if (filters.partyName && e.partyName !== filters.partyName) return false
    if (filters.dateFrom && e.billDate < filters.dateFrom) return false
    if (filters.dateTo && e.billDate > filters.dateTo) return false

    const amt = e.amount
    if (filters.minAmount !== '' && !isNaN(parseFloat(filters.minAmount))) {
      if (amt < parseFloat(filters.minAmount)) return false
    }
    if (filters.maxAmount !== '' && !isNaN(parseFloat(filters.maxAmount))) {
      if (amt > parseFloat(filters.maxAmount)) return false
    }
    return true
  })
}

/**
 * Apply filters to a list of LooseItemAnalytics (for the aggregated view).
 */
export function applyAnalyticsFilters(
  analytics: LooseItemAnalytics[],
  filters: LooseHistoryFilters,
): LooseItemAnalytics[] {
  return analytics.filter(a => {
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase()
      if (!a.itemName.toLowerCase().includes(q)) return false
    }
    if (filters.partyName && !a.parties.includes(filters.partyName)) return false
    if (filters.dateFrom && a.lastSeen < filters.dateFrom) return false
    if (filters.dateTo && a.firstSeen > filters.dateTo) return false

    if (filters.minAmount !== '' && !isNaN(parseFloat(filters.minAmount))) {
      if (a.totalAmount < parseFloat(filters.minAmount)) return false
    }
    if (filters.maxAmount !== '' && !isNaN(parseFloat(filters.maxAmount))) {
      if (a.totalAmount > parseFloat(filters.maxAmount)) return false
    }
    return true
  })
}

/**
 * Get all unique party names from the loose entries — used to populate the party filter dropdown.
 */
export async function getLoosePartyNames(): Promise<string[]> {
  const entries = await getAllLooseEntries()
  return [...new Set(entries.map(e => e.partyName))].sort()
}

/** Format a number as Indian rupee string */
export function formatINR(value: number): string {
  return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}
