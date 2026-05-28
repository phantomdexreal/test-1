/**
 * cQikly — Payment Recorder Modal
 * Phase 8b-ii
 *
 * Allows logging a payment received against a customer.
 * Features:
 *   - Date picker (defaults to today)
 *   - Amount input
 *   - Reference / note field (cheque no, UPI ID, etc.)
 *   - Bill linker: shows all unpaid/partial bills for this customer;
 *     user selects which bill(s) this payment covers
 *   - Smart amount distributor: "Apply to All Outstanding" auto-fills
 *     the total outstanding as the payment amount
 *   - Saves via payment.service → auto-drives bill statuses
 *   - Payment history list at bottom: all past payments for this customer
 *     (with delete option)
 *   - Inline feedback on status changes after save
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { X, CreditCard, Calendar, Hash, FileText, Trash2, CheckCircle2, AlertCircle, Plus } from 'lucide-react'
import type { CustomerRecord, BillRecord } from '../../services/db.service'
import type { PaymentRecord } from '../../services/payment.service'
import {
  loadPaymentsForCustomer,
  savePayment,
  deletePayment,
} from '../../services/payment.service'
import { getBills } from '../../services/bill.service'
import { formatAmountINR, formatDateDisplay } from '../../services/history.service'
import { STATUS_CONFIG } from '../NewQuote/BillInfoSection'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmt(n: number): string {
  return formatAmountINR(Math.round(n))
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try { return formatDateDisplay(iso.slice(0, 10)) } catch { return iso.slice(0, 10) }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PaymentRecorderModalProps {
  customer: CustomerRecord
  onClose: () => void
  /** Called after a payment is saved or deleted so parent can refresh stats */
  onPaymentChange?: () => void
}

// ─── Notification strip ───────────────────────────────────────────────────────

interface Notif {
  type: 'success' | 'error'
  message: string
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PaymentRecorderModal({
  customer,
  onClose,
  onPaymentChange,
}: PaymentRecorderModalProps): React.ReactElement {

  // ── State ──────────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [customerBills, setCustomerBills] = useState<BillRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notif, setNotif] = useState<Notif | null>(null)

  // Form fields
  const [date, setDate] = useState(todayISO())
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [linkedBillIds, setLinkedBillIds] = useState<number[]>([])

  const amountRef = useRef<HTMLInputElement>(null)
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pmts, allBills] = await Promise.all([
          loadPaymentsForCustomer(customer.id!),
          getBills(),
        ])
        setPayments(pmts)

        // Only bills for this customer that are not cancelled
        const cb = allBills.filter(
          b => b.partyName.trim().toLowerCase() === customer.partyName.trim().toLowerCase()
            && b.status !== 'cancelled'
        ).sort((a, b) => (b.billDate || b.createdAt || '').localeCompare(a.billDate || a.createdAt || ''))

        setCustomerBills(cb)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [customer])

  // ── Compute outstanding per bill (used in linker) ──────────────────────────
  const paidPerBill = useMemo(() => {
    const map = new Map<number, number>()
    for (const p of payments) {
      for (const bid of p.linkedBillIds) {
        map.set(bid, (map.get(bid) ?? 0) + p.amount)
      }
    }
    return map
  }, [payments])

  const unpaidBills = useMemo(
    () => customerBills.filter(b => b.id != null && b.status !== 'paid'),
    [customerBills]
  )

  const totalOutstanding = useMemo(() => {
    let total = 0
    for (const b of unpaidBills) {
      const paid = paidPerBill.get(b.id!) ?? 0
      total += Math.max(0, (b.grandTotal ?? 0) - paid)
    }
    return total
  }, [unpaidBills, paidPerBill])

  // ── Notification helper ───────────────────────────────────────────────────
  function showNotif(type: 'success' | 'error', message: string) {
    setNotif({ type, message })
    if (notifTimer.current) clearTimeout(notifTimer.current)
    notifTimer.current = setTimeout(() => setNotif(null), 4000)
  }

  // ── Bill linker toggle ─────────────────────────────────────────────────────
  function toggleBill(billId: number) {
    setLinkedBillIds(prev =>
      prev.includes(billId) ? prev.filter(id => id !== billId) : [...prev, billId]
    )
  }

  // ── Apply to all outstanding ───────────────────────────────────────────────
  function applyToAll() {
    const billIds = unpaidBills.map(b => b.id!).filter(Boolean)
    setLinkedBillIds(billIds)
    setAmount(String(Math.round(totalOutstanding)))
  }

  // ── Save payment ───────────────────────────────────────────────────────────
  async function handleSave() {
    const amtNum = parseFloat(amount)
    if (!amtNum || amtNum <= 0) {
      showNotif('error', 'Enter a valid payment amount')
      amountRef.current?.focus()
      return
    }
    if (!date) {
      showNotif('error', 'Select a payment date')
      return
    }

    setSaving(true)
    try {
      const saved = await savePayment({
        customerId: customer.id!,
        partyName: customer.partyName,
        amount: amtNum,
        paymentDate: date,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        linkedBillIds,
      })

      // Reload payments + bills to reflect new statuses
      const [pmts, allBills] = await Promise.all([
        loadPaymentsForCustomer(customer.id!),
        getBills(),
      ])
      setPayments(pmts)
      const cb = allBills.filter(
        b => b.partyName.trim().toLowerCase() === customer.partyName.trim().toLowerCase()
          && b.status !== 'cancelled'
      ).sort((a, b) => (b.billDate || b.createdAt || '').localeCompare(a.billDate || a.createdAt || ''))
      setCustomerBills(cb)

      // Reset form
      setDate(todayISO())
      setAmount('')
      setReference('')
      setNotes('')
      setLinkedBillIds([])

      const linkedCount = saved.linkedBillIds.length
      showNotif('success', `Payment of ${fmt(amtNum)} recorded${linkedCount > 0 ? ` — ${linkedCount} bill${linkedCount > 1 ? 's' : ''} status updated` : ''}`)

      onPaymentChange?.()
    } catch (err) {
      showNotif('error', `Failed to save: ${String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete payment ─────────────────────────────────────────────────────────
  async function handleDeletePayment(paymentId: number) {
    try {
      await deletePayment(paymentId, customer.id!)
      const [pmts, allBills] = await Promise.all([
        loadPaymentsForCustomer(customer.id!),
        getBills(),
      ])
      setPayments(pmts)
      const cb = allBills.filter(
        b => b.partyName.trim().toLowerCase() === customer.partyName.trim().toLowerCase()
          && b.status !== 'cancelled'
      ).sort((a, b) => (b.billDate || b.createdAt || '').localeCompare(a.billDate || a.createdAt || ''))
      setCustomerBills(cb)
      showNotif('success', 'Payment deleted — bill statuses recalculated')
      onPaymentChange?.()
    } catch (err) {
      showNotif('error', `Delete failed: ${String(err)}`)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 65,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.78)',
        fontFamily: S.font,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: '16px',
        width: '780px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 28px 100px rgba(0,0,0,0.65)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '18px 24px 16px',
          borderBottom: `1px solid ${S.border}`,
          background: S.surfaceRaised,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <CreditCard size={15} style={{ color: S.accent, opacity: 0.9 }} />
                <span style={{ fontSize: '0.63rem', fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Payment Recorder
                </span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: S.text }}>
                {customer.partyName}
              </div>
              <div style={{ fontSize: '0.73rem', color: S.textMuted, marginTop: '2px' }}>
                {customer.phoneNo && <span>📞 {customer.phoneNo} &nbsp;·&nbsp;</span>}
                {totalOutstanding > 0
                  ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>Outstanding: {fmt(totalOutstanding)}</span>
                  : <span style={{ color: '#16a34a', fontWeight: 600 }}>No outstanding balance</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: S.textMuted, padding: '4px', borderRadius: '6px',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = S.text)}
              onMouseLeave={e => (e.currentTarget.style.color = S.textMuted)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Notification ── */}
        {notif && (
          <div style={{
            padding: '8px 20px',
            background: notif.type === 'success'
              ? 'color-mix(in srgb, #16a34a 12%, var(--cq-surface))'
              : 'color-mix(in srgb, #dc2626 12%, var(--cq-surface))',
            borderBottom: `1px solid ${notif.type === 'success' ? 'color-mix(in srgb, #16a34a 30%, transparent)' : 'color-mix(in srgb, #dc2626 30%, transparent)'}`,
            display: 'flex', alignItems: 'center', gap: '8px',
            fontSize: '0.78rem', fontWeight: 600,
            color: notif.type === 'success' ? '#16a34a' : '#dc2626',
            flexShrink: 0,
          }}>
            {notif.type === 'success'
              ? <CheckCircle2 size={14} />
              : <AlertCircle size={14} />}
            {notif.message}
          </div>
        )}

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* ── New Payment Form ── */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
            <div style={{
              fontSize: '0.68rem', fontWeight: 700, color: S.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Plus size={11} />
              Record New Payment
            </div>

            {/* Row 1: Date + Amount + Reference */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>

              {/* Date */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: S.textMuted, display: 'block', marginBottom: '5px' }}>
                  <Calendar size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Payment Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: S.surfaceRaised, border: `1px solid ${S.border}`,
                    borderRadius: '8px', color: S.text,
                    fontSize: '0.83rem', outline: 'none',
                    fontFamily: S.font,
                  }}
                />
              </div>

              {/* Amount */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: S.textMuted, display: 'block', marginBottom: '5px' }}>
                  Amount Received (₹)
                </label>
                <input
                  ref={amountRef}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: S.surfaceRaised, border: `1px solid ${S.border}`,
                    borderRadius: '8px', color: S.text,
                    fontSize: '0.88rem', fontWeight: 700,
                    outline: 'none', fontFamily: S.font,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = S.accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = S.border)}
                />
              </div>

              {/* Reference */}
              <div>
                <label style={{ fontSize: '0.68rem', fontWeight: 600, color: S.textMuted, display: 'block', marginBottom: '5px' }}>
                  <Hash size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Reference / Cheque / UPI
                </label>
                <input
                  type="text"
                  placeholder="Optional reference"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px',
                    background: S.surfaceRaised, border: `1px solid ${S.border}`,
                    borderRadius: '8px', color: S.text,
                    fontSize: '0.83rem', outline: 'none', fontFamily: S.font,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = S.accent)}
                  onBlur={e => (e.currentTarget.style.borderColor = S.border)}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: S.textMuted, display: 'block', marginBottom: '5px' }}>
                <FileText size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                Note (optional)
              </label>
              <input
                type="text"
                placeholder="Add a note about this payment..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '8px 10px',
                  background: S.surfaceRaised, border: `1px solid ${S.border}`,
                  borderRadius: '8px', color: S.text,
                  fontSize: '0.83rem', outline: 'none', fontFamily: S.font,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = S.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = S.border)}
              />
            </div>

            {/* Bill Linker */}
            {!loading && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Link to Bills (select which bill(s) this payment covers)
                  </span>
                  {unpaidBills.length > 0 && totalOutstanding > 0 && (
                    <button
                      onClick={applyToAll}
                      style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px',
                        background: 'color-mix(in srgb, var(--cq-accent) 12%, transparent)',
                        color: S.accent, border: `1px solid color-mix(in srgb, var(--cq-accent) 30%, transparent)`,
                        borderRadius: '6px', cursor: 'pointer',
                      }}
                    >
                      Apply to All Outstanding ({fmt(totalOutstanding)})
                    </button>
                  )}
                </div>

                {unpaidBills.length === 0 ? (
                  <div style={{
                    padding: '10px 14px',
                    background: S.surfaceRaised, borderRadius: '8px',
                    fontSize: '0.77rem', color: S.textMuted, fontStyle: 'italic',
                  }}>
                    No unpaid / partial bills — payment will be logged as a general credit
                  </div>
                ) : (
                  <div style={{
                    border: `1px solid ${S.border}`, borderRadius: '8px', overflow: 'hidden',
                  }}>
                    {/* Bill list header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '28px 130px 90px 100px 100px 100px',
                      padding: '6px 12px',
                      background: 'color-mix(in srgb, var(--cq-border) 40%, transparent)',
                      borderBottom: `1px solid ${S.border}`,
                    }}>
                      {['', 'Bill No.', 'Date', 'Total', 'Paid So Far', 'Remaining'].map((h, i) => (
                        <span key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 1 ? 'right' : 'left' }}>
                          {h}
                        </span>
                      ))}
                    </div>

                    {/* Bill rows */}
                    {unpaidBills.map(bill => {
                      const paid = paidPerBill.get(bill.id!) ?? 0
                      const remaining = Math.max(0, (bill.grandTotal ?? 0) - paid)
                      const isLinked = linkedBillIds.includes(bill.id!)
                      return (
                        <div
                          key={bill.id}
                          onClick={() => toggleBill(bill.id!)}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '28px 130px 90px 100px 100px 100px',
                            padding: '8px 12px',
                            borderBottom: `1px solid color-mix(in srgb, ${S.border} 50%, transparent)`,
                            alignItems: 'center', cursor: 'pointer',
                            background: isLinked
                              ? 'color-mix(in srgb, var(--cq-accent) 8%, transparent)'
                              : 'transparent',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => { if (!isLinked) e.currentTarget.style.background = 'color-mix(in srgb, var(--cq-border) 20%, transparent)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isLinked ? 'color-mix(in srgb, var(--cq-accent) 8%, transparent)' : 'transparent' }}
                        >
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isLinked}
                            readOnly
                            style={{ accentColor: S.accent, cursor: 'pointer', pointerEvents: 'none' }}
                          />

                          {/* Bill number */}
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.75rem', fontWeight: 700, color: S.accent }}>
                            {bill.billNumber}
                          </span>

                          {/* Date */}
                          <span style={{ fontSize: '0.75rem', color: S.textMuted }}>
                            {fmtDate(bill.billDate)}
                          </span>

                          {/* Total */}
                          <span style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600, color: S.text, fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(bill.grandTotal ?? 0)}
                          </span>

                          {/* Paid so far */}
                          <span style={{ textAlign: 'right', fontSize: '0.78rem', color: paid > 0 ? '#16a34a' : S.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                            {paid > 0 ? fmt(paid) : '—'}
                          </span>

                          {/* Remaining */}
                          <span style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: remaining > 0 ? '#f59e0b' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                            {remaining > 0 ? fmt(remaining) : 'Paid'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '9px 24px',
                  background: saving ? 'color-mix(in srgb, var(--cq-accent) 50%, transparent)' : S.accent,
                  color: 'white', border: 'none', borderRadius: '8px',
                  fontSize: '0.85rem', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'opacity 0.15s',
                  fontFamily: S.font,
                }}
              >
                <CreditCard size={14} />
                {saving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>

          {/* ── Payment History ── */}
          <div style={{ padding: '16px 24px 20px', flex: 1 }}>
            <div style={{
              fontSize: '0.68rem', fontWeight: 700, color: S.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px',
            }}>
              Payment History ({payments.length})
            </div>

            {loading && (
              <div style={{ color: S.textMuted, fontSize: '0.78rem', padding: '20px 0', textAlign: 'center' }}>
                Loading…
              </div>
            )}

            {!loading && payments.length === 0 && (
              <div style={{
                padding: '28px 0', textAlign: 'center',
                color: S.textMuted, fontSize: '0.8rem',
              }}>
                <div style={{ fontSize: '2rem', opacity: 0.2, marginBottom: '8px' }}>💳</div>
                No payments recorded yet
              </div>
            )}

            {!loading && payments.length > 0 && (
              <div style={{ border: `1px solid ${S.border}`, borderRadius: '8px', overflow: 'hidden' }}>
                {/* History header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '95px 100px 1fr 160px 36px',
                  padding: '6px 12px',
                  background: 'color-mix(in srgb, var(--cq-border) 40%, transparent)',
                  borderBottom: `1px solid ${S.border}`,
                }}>
                  {['Date', 'Amount', 'Reference / Note', 'Linked Bills', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '0.62rem', fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* History rows (newest first) */}
                {[...payments].reverse().map(p => {
                  const linkedBills = customerBills.filter(b => p.linkedBillIds.includes(b.id!))
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '95px 100px 1fr 160px 36px',
                        padding: '10px 12px',
                        borderBottom: `1px solid color-mix(in srgb, ${S.border} 50%, transparent)`,
                        alignItems: 'center',
                      }}
                    >
                      {/* Date */}
                      <span style={{ fontSize: '0.76rem', color: S.textMuted }}>
                        {fmtDate(p.paymentDate)}
                      </span>

                      {/* Amount */}
                      <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(p.amount)}
                      </span>

                      {/* Reference + notes */}
                      <div>
                        {p.reference && (
                          <div style={{ fontSize: '0.76rem', fontWeight: 600, color: S.text }}>
                            {p.reference}
                          </div>
                        )}
                        {p.notes && (
                          <div style={{ fontSize: '0.71rem', color: S.textMuted, marginTop: '1px' }}>
                            {p.notes}
                          </div>
                        )}
                        {!p.reference && !p.notes && (
                          <span style={{ fontSize: '0.72rem', color: S.textMuted, fontStyle: 'italic' }}>—</span>
                        )}
                      </div>

                      {/* Linked bills */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {linkedBills.length === 0 ? (
                          <span style={{ fontSize: '0.7rem', color: S.textMuted, fontStyle: 'italic' }}>General credit</span>
                        ) : (
                          linkedBills.map(b => {
                            const cfg = STATUS_CONFIG[b.status]
                            return (
                              <span
                                key={b.id}
                                style={{
                                  padding: '1px 7px',
                                  fontSize: '0.63rem', fontWeight: 700,
                                  background: 'color-mix(in srgb, var(--cq-accent) 12%, transparent)',
                                  color: S.accent,
                                  border: `1px solid color-mix(in srgb, var(--cq-accent) 25%, transparent)`,
                                  borderRadius: '8px',
                                  fontFamily: '"JetBrains Mono", monospace',
                                }}
                                title={`${b.billNumber} — ${cfg.label}`}
                              >
                                {b.billNumber}
                              </span>
                            )
                          })
                        )}
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeletePayment(p.id!)}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: S.textMuted, padding: '4px',
                          borderRadius: '4px', display: 'flex', alignItems: 'center',
                        }}
                        title="Delete payment"
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={e => (e.currentTarget.style.color = S.textMuted)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
