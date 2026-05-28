/**
 * cQikly — Duplicate Detection Service
 * Phase 7b
 *
 * Detects potential duplicate bills before saving.
 * Trigger: same party name + same bill date + similar grand total (within 5%).
 *
 * Architecture: Pure function — no side effects, no DB calls.
 * Components pass the existing bill list and candidate bill; service returns match list.
 */

import type { BillRecord } from './db.service'

export interface DuplicateCandidate {
  bill: BillRecord
  reason: string
}

/**
 * Check if a proposed bill (party + date + total) is a likely duplicate
 * of any existing bill in the provided list.
 *
 * Matching rules (ALL three must match):
 *   1. Party name: case-insensitive exact match (trimmed)
 *   2. Bill date: exact ISO date match (YYYY-MM-DD)
 *   3. Grand total: within 5% of the existing bill's grand total
 *      (or both are zero/empty — zero-total bills are always flagged)
 *
 * Excludes the bill with `excludeId` (the bill being edited, if any).
 */
export function findDuplicates(
  bills: BillRecord[],
  candidate: {
    partyName: string
    billDate: string
    grandTotal: number
  },
  excludeId?: number,
): DuplicateCandidate[] {
  const pNorm = candidate.partyName.trim().toLowerCase()
  const dateNorm = (candidate.billDate || '').slice(0, 10)
  const total = candidate.grandTotal ?? 0

  if (!pNorm || !dateNorm) return []

  const results: DuplicateCandidate[] = []

  for (const bill of bills) {
    if (excludeId != null && bill.id === excludeId) continue
    if (bill.partyName.trim().toLowerCase() !== pNorm) continue
    if ((bill.billDate || '').slice(0, 10) !== dateNorm) continue

    const existingTotal = bill.grandTotal ?? 0

    // Total similarity check
    let totalMatch = false
    let totalReason = ''

    if (total === 0 && existingTotal === 0) {
      totalMatch = true
      totalReason = 'zero-total bill'
    } else if (total === 0 || existingTotal === 0) {
      // One is zero, other isn't — not a duplicate on total grounds
      totalMatch = false
    } else {
      const diff = Math.abs(total - existingTotal)
      const pct = diff / Math.max(total, existingTotal)
      if (pct <= 0.05) {
        totalMatch = true
        if (total === existingTotal) {
          totalReason = `identical total ₹${Math.round(existingTotal).toLocaleString('en-IN')}`
        } else {
          totalReason = `similar total ₹${Math.round(existingTotal).toLocaleString('en-IN')} (${(pct * 100).toFixed(1)}% difference)`
        }
      }
    }

    if (!totalMatch) continue

    results.push({
      bill,
      reason: `Same party, same date${totalReason ? `, ${totalReason}` : ''}`,
    })
  }

  return results
}
