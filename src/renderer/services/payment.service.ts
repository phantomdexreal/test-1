/**
 * cQikly — Payment Service
 * Phase 8b-ii
 *
 * Responsibilities:
 *   - Log payments received against a customer
 *   - Each payment: date, amount, reference/note, linked bill IDs
 *   - Auto-drive bill status when payment is logged:
 *       full payment  → Paid
 *       partial payment → Partial
 *       no payment    → Unpaid
 *   - Provide payment history per customer for ledger integration
 *
 * Architecture:
 *   - IPC path: communicates with Electron main via window.cqikly.db
 *   - Dev/browser path: localStorage (mirrors bill.service pattern)
 *   - All bill status writes go through bill.service.updateBillStatus
 *     so the existing status system stays as the single source of truth.
 *
 * Data model (mirrors `payments` table in 001_initial.ts):
 *   id           INTEGER PRIMARY KEY
 *   customer_id  INTEGER (references customers.id)
 *   amount       REAL
 *   payment_date TEXT (ISO date)
 *   reference    TEXT (cheque no, UPI ref, etc.)
 *   notes        TEXT (free text)
 *   linked_bills TEXT (JSON array of bill IDs)
 *   created_at   TEXT
 */

import { updateBillStatus, getBills } from './bill.service'
import { getAllCustomers } from './customer.service'
import type { BillRecord } from './db.service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id?: number
  customerId: number
  /** Customer party name — denormalised for display without joins */
  partyName: string
  amount: number
  paymentDate: string   // ISO YYYY-MM-DD
  reference?: string    // cheque number, UPI ref, etc.
  notes?: string
  /** IDs of bills this payment (fully or partially) covers */
  linkedBillIds: number[]
  createdAt?: string
}

// ─── IPC helper ───────────────────────────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

// ─── Dev / localStorage persistence ──────────────────────────────────────────

const STORAGE_KEY = 'cq:payments'

function _loadFromStorage(): PaymentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PaymentRecord[]
  } catch { /* ignore */ }
  return []
}

function _saveToStorage(payments: PaymentRecord[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payments)) } catch { /* ignore */ }
}

let _cache: PaymentRecord[] = _loadFromStorage()

// ─── Load all payments from SQLite on startup (FIX-5) ────────────────────────

export async function loadAllPaymentsFromDb(): Promise<void> {
  const ipc = getIpc()
  if (!ipc) return

  try {
    const rows = await ipc.db.query(
      `SELECT id, customer_id as customerId, amount, payment_date as paymentDate,
              reference, notes, linked_bills as linkedBillsJson, created_at as createdAt
       FROM payments ORDER BY payment_date ASC`,
      []
    ) as Array<Record<string, unknown>>

    _cache = rows.map(r => ({
      id: r.id as number,
      customerId: r.customerId as number,
      partyName: '',
      amount: r.amount as number,
      paymentDate: r.paymentDate as string,
      reference: (r.reference as string) ?? undefined,
      notes: (r.notes as string) ?? undefined,
      linkedBillIds: r.linkedBillsJson ? JSON.parse(r.linkedBillsJson as string) as number[] : [],
      createdAt: r.createdAt as string,
    }))

    // Populate partyName from the already-loaded customer cache
    const customers = getAllCustomers()
    const customerMap = new Map(customers.map(c => [c.id, c.partyName ?? '']))
    _cache = _cache.map(p => ({ ...p, partyName: customerMap.get(p.customerId) ?? '' }))

    _saveToStorage(_cache)
  } catch (err) {
    console.error('[PaymentService] loadAllPaymentsFromDb failed:', err)
  }
}

// ─── Load payments ────────────────────────────────────────────────────────────

/**
 * Load all payments for a specific customer by customerId.
 * Falls back to localStorage in dev mode.
 */
export async function loadPaymentsForCustomer(customerId: number): Promise<PaymentRecord[]> {
  const ipc = getIpc()
  if (ipc) {
    try {
      const rows = await ipc.db.query(
        `SELECT id, customer_id as customerId, amount, payment_date as paymentDate,
                reference, notes, linked_bills as linkedBillsJson,
                created_at as createdAt
           FROM payments
          WHERE customer_id = ?
          ORDER BY payment_date ASC, created_at ASC`,
        [customerId]
      ) as Array<{
        id: number; customerId: number; amount: number; paymentDate: string;
        reference?: string; notes?: string; linkedBillsJson?: string; createdAt?: string
      }>

      const customers = getAllCustomers()
      const customerMap = new Map(customers.map(c => [c.id, c.partyName ?? '']))
      return rows.map(r => ({
        id: r.id,
        customerId: r.customerId,
        partyName: customerMap.get(r.customerId) ?? '',
        amount: r.amount,
        paymentDate: r.paymentDate,
        reference: r.reference ?? undefined,
        notes: r.notes ?? undefined,
        linkedBillIds: r.linkedBillsJson ? (JSON.parse(r.linkedBillsJson) as number[]) : [],
        createdAt: r.createdAt,
      }))
    } catch (err) {
      console.error('[PaymentService] loadPaymentsForCustomer IPC failed, using cache:', err)
    }
  }

  // Dev mode: filter from in-memory cache by customerId
  _cache = _loadFromStorage()
  return _cache.filter(p => p.customerId === customerId)
    .sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''))
}

/**
 * Load all payments across all customers (for ledger service).
 */
export async function loadAllPayments(): Promise<PaymentRecord[]> {
  const ipc = getIpc()
  if (ipc) {
    try {
      const rows = await ipc.db.query(
        `SELECT id, customer_id as customerId, amount, payment_date as paymentDate,
                reference, notes, linked_bills as linkedBillsJson, created_at as createdAt
           FROM payments
          ORDER BY payment_date ASC`,
        []
      ) as Array<{
        id: number; customerId: number; amount: number; paymentDate: string;
        reference?: string; notes?: string; linkedBillsJson?: string; createdAt?: string
      }>
      const customers = getAllCustomers()
      const customerMap = new Map(customers.map(c => [c.id, c.partyName ?? '']))
      return rows.map(r => ({
        id: r.id,
        customerId: r.customerId,
        partyName: customerMap.get(r.customerId) ?? '',
        amount: r.amount,
        paymentDate: r.paymentDate,
        reference: r.reference,
        notes: r.notes,
        linkedBillIds: r.linkedBillsJson ? (JSON.parse(r.linkedBillsJson) as number[]) : [],
        createdAt: r.createdAt,
      }))
    } catch (err) {
      console.error('[PaymentService] loadAllPayments IPC failed, using cache:', err)
    }
  }
  _cache = _loadFromStorage()
  return [..._cache].sort((a, b) => (a.paymentDate || '').localeCompare(b.paymentDate || ''))
}

// ─── Save payment ─────────────────────────────────────────────────────────────

/**
 * Save a new payment and auto-drive the status on all linked bills.
 *
 * Status logic:
 *   For each linked bill:
 *     totalPaidForBill = sum of all payment amounts that link to this bill
 *     if totalPaidForBill >= billGrandTotal → Paid
 *     if totalPaidForBill > 0              → Partial
 *     if totalPaidForBill === 0            → Unpaid
 */
export async function savePayment(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<PaymentRecord> {
  const ipc = getIpc()

  let savedId: number

  if (ipc) {
    try {
      const result = await ipc.db.run(
        `INSERT INTO payments (customer_id, amount, payment_date, reference, notes, linked_bills, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          payment.customerId,
          payment.amount,
          payment.paymentDate,
          payment.reference ?? null,
          payment.notes ?? null,
          JSON.stringify(payment.linkedBillIds),
        ]
      ) as { lastInsertRowid: number }
      savedId = result.lastInsertRowid
    } catch (err) {
      console.error('[PaymentService] savePayment IPC failed:', err)
      throw err
    }
  } else {
    // Dev mode: add to localStorage
    savedId = Date.now()
    const record: PaymentRecord = {
      ...payment,
      id: savedId,
      createdAt: new Date().toISOString(),
    }
    _cache.push(record)
    _saveToStorage(_cache)
  }

  const saved: PaymentRecord = {
    ...payment,
    id: savedId,
    createdAt: new Date().toISOString(),
  }

  // ── Auto-drive bill statuses ──────────────────────────────────────────────
  if (payment.linkedBillIds.length > 0) {
    await _recalcAndDriveBillStatuses(payment.linkedBillIds, payment.customerId)
  }

  return saved
}

/**
 * Delete a payment by ID and recalculate status on its previously-linked bills.
 */
export async function deletePayment(paymentId: number, customerId: number): Promise<void> {
  const ipc = getIpc()

  // Grab linked bills before deleting
  const all = await loadPaymentsForCustomer(customerId)
  const target = all.find(p => p.id === paymentId)
  const affectedBillIds = target?.linkedBillIds ?? []

  if (ipc) {
    try {
      await ipc.db.run(`DELETE FROM payments WHERE id = ?`, [paymentId])
    } catch (err) {
      console.error('[PaymentService] deletePayment IPC failed:', err)
      throw err
    }
  } else {
    _cache = _cache.filter(p => p.id !== paymentId)
    _saveToStorage(_cache)
  }

  // Recalculate statuses for bills that were affected
  if (affectedBillIds.length > 0) {
    await _recalcAndDriveBillStatuses(affectedBillIds, customerId)
  }
}

// ─── Status recalculation ─────────────────────────────────────────────────────

/**
 * Given a set of bill IDs that may have been affected by a payment change,
 * compute the total paid for each bill across ALL payments for this customer
 * and drive the bill status accordingly.
 */
async function _recalcAndDriveBillStatuses(billIds: number[], customerId: number): Promise<void> {
  // Fetch all payments for this customer so we can total them correctly
  const allPayments = await loadPaymentsForCustomer(customerId)
  // Fetch all bills so we know each bill's grandTotal
  const allBills = await getBills()

  const billMap = new Map<number, BillRecord>()
  for (const b of allBills) {
    if (b.id != null) billMap.set(b.id, b)
  }

  for (const billId of billIds) {
    const bill = billMap.get(billId)
    if (!bill) continue
    if (bill.status === 'cancelled') continue  // never touch cancelled bills

    const grandTotal = Math.round(bill.grandTotal ?? 0)

    // Sum all payment amounts that link to this specific bill
    let totalPaidForBill = 0
    for (const p of allPayments) {
      if (p.linkedBillIds.includes(billId)) {
        totalPaidForBill += p.amount
      }
    }
    totalPaidForBill = Math.round(totalPaidForBill)

    let newStatus: 'paid' | 'partial' | 'unpaid'
    if (totalPaidForBill >= grandTotal) {
      newStatus = 'paid'
    } else if (totalPaidForBill > 0) {
      newStatus = 'partial'
    } else {
      newStatus = 'unpaid'
    }

    if (bill.status !== newStatus) {
      await updateBillStatus(billId, newStatus)
    }
  }
}

// ─── Totals helper ────────────────────────────────────────────────────────────

/**
 * Compute total amount received (Cr) for a customer from their payment list.
 * Used by the ledger to get precise Cr totals.
 */
export function computeTotalPaid(payments: PaymentRecord[]): number {
  return payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)
}

/**
 * Compute total paid specifically for one bill across a list of payments.
 */
export function computePaidForBill(billId: number, payments: PaymentRecord[]): number {
  return payments
    .filter(p => p.linkedBillIds.includes(billId))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
}
