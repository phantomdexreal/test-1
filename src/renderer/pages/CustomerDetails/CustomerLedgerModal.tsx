/**
 * cQikly — Customer Ledger Modal
 * Phase 8b-i (base) | Phase 8b-ii: Full Dr/Cr ledger with real payment entries
 *
 * Now shows BOTH bills (Dr) and payments (Cr) together in chronological order,
 * with a correct running balance that updates as payments are recorded.
 *
 * Accessible from:
 *   1. Customer Details page — "Ledger" button per customer row
 *   2. History page Outstanding view — "View Ledger" per customer row
 */

import React, { useMemo, useState, useEffect } from 'react'
import { X, BookOpen, TrendingUp, Calendar } from 'lucide-react'
import type { BillRecord } from '../../services/db.service'
import type { CustomerRecord } from '../../services/customer.service'
import type { PaymentRecord } from '../../services/payment.service'
import { loadPaymentsForCustomer } from '../../services/payment.service'
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

// ─── Ledger entry (unified bill + payment rows) ───────────────────────────────

type LedgerRowType = 'bill' | 'payment'

interface LedgerRow {
  type: LedgerRowType
  date: string
  sortKey: string   // date + createdAt for stable sort
  // Bill fields
  billNumber?: string
  billStatus?: BillRecord['status']
  // Payment fields
  paymentRef?: string
  paymentNote?: string
  linkedBillNumbers?: string[]
  // Amounts
  dr: number
  cr: number
  balance: number  // running balance after this row
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CustomerLedgerModalProps {
  customer: CustomerRecord
  bills: BillRecord[]
  onClose: () => void
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomerLedgerModal({
  customer,
  bills,
  onClose,
}: CustomerLedgerModalProps): React.ReactElement {

  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loadingPayments, setLoadingPayments] = useState(true)

  // Load payments for this customer
  useEffect(() => {
    async function load() {
      if (!customer.id) { setLoadingPayments(false); return }
      setLoadingPayments(true)
      try {
        const pmts = await loadPaymentsForCustomer(customer.id)
        setPayments(pmts)
      } finally {
        setLoadingPayments(false)
      }
    }
    void load()
  }, [customer.id])

  // Build a map of bill numbers by ID (for payment row display)
  const billNumberMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const b of bills) {
      if (b.id != null) m.set(b.id, b.billNumber)
    }
    return m
  }, [bills])

  // Build unified chronological ledger rows
  const { rows, totalDr, totalCr } = useMemo(() => {
    let runningBalance = 0
    let totalDr = 0
    let totalCr = 0
    const entries: LedgerRow[] = []

    // Combine bills + payments and sort chronologically
    type SourceItem =
      | { kind: 'bill'; data: BillRecord }
      | { kind: 'payment'; data: PaymentRecord }

    const sources: SourceItem[] = [
      ...bills
        .filter(b => b.status !== 'cancelled')
        .map(b => ({ kind: 'bill' as const, data: b })),
      ...payments.map(p => ({ kind: 'payment' as const, data: p })),
    ]

    // Sort: primary = date (ISO ascending), secondary = createdAt
    sources.sort((a, b) => {
      const da = a.kind === 'bill'
        ? (a.data.billDate || a.data.createdAt || '')
        : (a.data.paymentDate || a.data.createdAt || '')
      const db = b.kind === 'bill'
        ? (b.data.billDate || b.data.createdAt || '')
        : (b.data.paymentDate || b.data.createdAt || '')
      return da.localeCompare(db)
    })

    for (const src of sources) {
      if (src.kind === 'bill') {
        const b = src.data
        const drAmt = Math.round(b.grandTotal ?? 0)
        runningBalance += drAmt
        totalDr += drAmt
        entries.push({
          type: 'bill',
          date: b.billDate || b.createdAt || '',
          sortKey: b.billDate || b.createdAt || '',
          billNumber: b.billNumber,
          billStatus: b.status,
          dr: drAmt,
          cr: 0,
          balance: runningBalance,
        })
      } else {
        const p = src.data
        const crAmt = Math.round(p.amount)
        runningBalance -= crAmt
        totalCr += crAmt
        const linkedNums = p.linkedBillIds
          .map(id => billNumberMap.get(id))
          .filter(Boolean) as string[]
        entries.push({
          type: 'payment',
          date: p.paymentDate || p.createdAt || '',
          sortKey: p.paymentDate || p.createdAt || '',
          paymentRef: p.reference,
          paymentNote: p.notes,
          linkedBillNumbers: linkedNums,
          dr: 0,
          cr: crAmt,
          balance: runningBalance,
        })
      }
    }

    return { rows: entries, totalDr, totalCr }
  }, [bills, payments, billNumberMap])

  const outstanding = Math.max(0, totalDr - totalCr)

  function fmtDate(iso: string): string {
    if (!iso) return '—'
    try { return formatDateDisplay(iso.slice(0, 10)) } catch { return iso.slice(0, 10) }
  }

  function fmtSince(iso?: string): string {
    if (!iso) return '—'
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return iso }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        fontFamily: S.font,
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: S.surface,
        border: `1px solid ${S.border}`,
        borderRadius: '16px',
        width: '780px',
        maxWidth: 'calc(100vw - 48px)',
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
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
                <BookOpen size={16} style={{ color: S.accent, opacity: 0.8 }} />
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Customer Ledger
                </span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: S.text }}>
                {customer.partyName}
              </div>
              <div style={{ fontSize: '0.75rem', color: S.textMuted, marginTop: '3px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {customer.phoneNo && <span>📞 {customer.phoneNo}</span>}
                {customer.customerSinceDate && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={11} />
                    Customer since {fmtSince(customer.customerSinceDate)}
                  </span>
                )}
                {customer.group && <span>Group: {customer.group}</span>}
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

        {/* ── Summary Stats ── */}
        <div style={{
          display: 'flex', gap: '1px',
          borderBottom: `1px solid ${S.border}`,
          background: S.border,
          flexShrink: 0,
        }}>
          {[
            { label: 'Total Dr (Billed)', value: formatAmountINR(totalDr), color: '#f59e0b' },
            { label: 'Total Cr (Received)', value: formatAmountINR(totalCr), color: '#16a34a' },
            {
              label: 'Outstanding Balance',
              value: outstanding > 0 ? formatAmountINR(outstanding) : 'Nil',
              color: outstanding > 0 ? '#dc2626' : '#16a34a',
            },
            { label: 'Payments Logged', value: String(payments.length), color: S.text },
          ].map(stat => (
            <div key={stat.label} style={{
              flex: 1, padding: '12px 16px',
              background: S.surface,
              display: 'flex', flexDirection: 'column', gap: '3px',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: stat.color, fontVariantNumeric: 'tabular-nums' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Internal Notes ── */}
        {customer.internalNotes && (
          <div style={{
            padding: '10px 20px',
            background: 'color-mix(in srgb, var(--cq-accent) 5%, var(--cq-surface-raised))',
            borderBottom: `1px solid color-mix(in srgb, var(--cq-accent) 15%, ${S.border})`,
            flexShrink: 0,
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: S.accent, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
              🔒 Internal Note (private)
            </div>
            <div style={{ fontSize: '0.78rem', color: S.textMuted, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {customer.internalNotes}
            </div>
          </div>
        )}

        {/* ── Ledger Table ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingPayments ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: S.textMuted, fontSize: '0.83rem' }}>
              Loading ledger…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: S.textMuted }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: '12px' }}>📒</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No transactions yet</div>
              <div style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.6 }}>
                Bills and payments will appear here once recorded
              </div>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '96px 160px 1fr 100px 100px 110px',
                padding: '8px 20px',
                background: 'color-mix(in srgb, var(--cq-border) 35%, transparent)',
                borderBottom: `1px solid ${S.border}`,
                position: 'sticky', top: 0, zIndex: 2,
              }}>
                {[
                  { label: 'Date', align: 'left' },
                  { label: 'Particulars', align: 'left' },
                  { label: 'Details', align: 'left' },
                  { label: 'Dr (Billed)', align: 'right' },
                  { label: 'Cr (Received)', align: 'right' },
                  { label: 'Balance', align: 'right' },
                ].map(h => (
                  <div key={h.label} style={{
                    fontSize: '0.64rem', fontWeight: 700, color: S.textMuted,
                    letterSpacing: '0.07em', textTransform: 'uppercase',
                    textAlign: h.align as React.CSSProperties['textAlign'],
                  }}>
                    {h.label}
                  </div>
                ))}
              </div>

              {/* Opening balance row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '96px 160px 1fr 100px 100px 110px',
                padding: '7px 20px',
                borderBottom: `1px solid ${S.border}`,
                background: 'color-mix(in srgb, var(--cq-border) 15%, transparent)',
              }}>
                <span style={{ fontSize: '0.72rem', color: S.textMuted }}>—</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, fontStyle: 'italic' }}>Opening Balance</span>
                <span />
                <span style={{ textAlign: 'right', fontSize: '0.72rem', color: S.textMuted }}>—</span>
                <span style={{ textAlign: 'right', fontSize: '0.72rem', color: S.textMuted }}>—</span>
                <span style={{ textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: S.textMuted }}>₹0</span>
              </div>

              {/* Ledger rows */}
              {rows.map((row, idx) => {
                const isLastRow = idx === rows.length - 1
                const isBill = row.type === 'bill'

                return (
                  <div
                    key={`${row.type}-${idx}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '96px 160px 1fr 100px 100px 110px',
                      padding: '9px 20px',
                      borderBottom: isLastRow
                        ? `2px solid ${S.border}`
                        : `1px solid color-mix(in srgb, ${S.border} 50%, transparent)`,
                      alignItems: 'center',
                      background: isBill ? 'transparent' : 'color-mix(in srgb, #16a34a 3%, transparent)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = isBill
                        ? 'color-mix(in srgb, var(--cq-accent) 4%, transparent)'
                        : 'color-mix(in srgb, #16a34a 7%, transparent)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isBill
                        ? 'transparent'
                        : 'color-mix(in srgb, #16a34a 3%, transparent)'
                    }}
                  >
                    {/* Date */}
                    <span style={{ fontSize: '0.76rem', color: S.textMuted }}>
                      {fmtDate(row.date)}
                    </span>

                    {/* Particulars */}
                    {isBill ? (
                      <span style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '0.74rem', fontWeight: 700,
                        color: S.accent,
                      }}>
                        {row.billNumber}
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.74rem', fontWeight: 700,
                        color: '#16a34a',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>💳</span>
                        Payment Received
                      </span>
                    )}

                    {/* Details */}
                    {isBill ? (
                      <span>
                        {row.billStatus && (
                          <span style={{
                            padding: '2px 7px',
                            fontSize: '0.61rem', fontWeight: 700,
                            color: STATUS_CONFIG[row.billStatus].color,
                            background: STATUS_CONFIG[row.billStatus].bg,
                            border: `1px solid ${STATUS_CONFIG[row.billStatus].border}`,
                            borderRadius: '10px', textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {STATUS_CONFIG[row.billStatus].label}
                          </span>
                        )}
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {row.paymentRef && (
                          <span style={{ fontSize: '0.73rem', color: S.text, fontWeight: 600 }}>
                            {row.paymentRef}
                          </span>
                        )}
                        {row.paymentNote && (
                          <span style={{ fontSize: '0.68rem', color: S.textMuted }}>
                            {row.paymentNote}
                          </span>
                        )}
                        {(row.linkedBillNumbers ?? []).length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '1px' }}>
                            {row.linkedBillNumbers!.map(bn => (
                              <span key={bn} style={{
                                padding: '0px 5px',
                                fontSize: '0.6rem', fontWeight: 700,
                                background: 'color-mix(in srgb, var(--cq-accent) 10%, transparent)',
                                color: S.accent,
                                border: `1px solid color-mix(in srgb, var(--cq-accent) 20%, transparent)`,
                                borderRadius: '6px',
                                fontFamily: '"JetBrains Mono", monospace',
                              }}>
                                {bn}
                              </span>
                            ))}
                          </div>
                        )}
                        {!row.paymentRef && !row.paymentNote && (row.linkedBillNumbers ?? []).length === 0 && (
                          <span style={{ fontSize: '0.68rem', color: S.textMuted, fontStyle: 'italic' }}>
                            General credit
                          </span>
                        )}
                      </div>
                    )}

                    {/* Dr */}
                    <span style={{
                      textAlign: 'right', fontSize: isBill ? '0.82rem' : '0.76rem',
                      fontWeight: isBill ? 700 : 400,
                      color: isBill ? '#f59e0b' : S.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: !isBill ? 0.35 : 1,
                    }}>
                      {row.dr > 0 ? formatAmountINR(row.dr) : '—'}
                    </span>

                    {/* Cr */}
                    <span style={{
                      textAlign: 'right', fontSize: !isBill ? '0.82rem' : '0.76rem',
                      fontWeight: !isBill ? 700 : 400,
                      color: !isBill ? '#16a34a' : S.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                      opacity: isBill ? 0.35 : 1,
                    }}>
                      {row.cr > 0 ? formatAmountINR(row.cr) : '—'}
                    </span>

                    {/* Running Balance */}
                    <span style={{
                      textAlign: 'right', fontSize: '0.875rem',
                      fontWeight: 800,
                      color: row.balance > 0 ? '#dc2626' : row.balance < 0 ? '#7c3aed' : '#16a34a',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {row.balance > 0
                        ? formatAmountINR(row.balance)
                        : row.balance < 0
                          ? `(${formatAmountINR(Math.abs(row.balance))})`
                          : 'Nil'}
                    </span>
                  </div>
                )
              })}

              {/* Totals footer */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '96px 160px 1fr 100px 100px 110px',
                padding: '10px 20px',
                borderTop: `2px solid ${S.border}`,
                background: S.surfaceRaised,
                position: 'sticky', bottom: 0,
              }}>
                <span />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Closing Balance
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <TrendingUp size={12} style={{ color: S.textMuted, opacity: 0.5 }} />
                  <span style={{ fontSize: '0.7rem', color: S.textMuted, opacity: 0.6 }}>
                    {rows.filter(r => r.type === 'bill').length} bill{rows.filter(r => r.type === 'bill').length !== 1 ? 's' : ''} · {payments.length} payment{payments.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <span style={{
                  textAlign: 'right', fontSize: '0.88rem',
                  fontWeight: 800, color: '#f59e0b',
                  fontVariantNumeric: 'tabular-nums',
                  borderTop: `1px solid ${S.border}`, paddingTop: '4px',
                }}>
                  {formatAmountINR(totalDr)}
                </span>
                <span style={{
                  textAlign: 'right', fontSize: '0.88rem',
                  fontWeight: 800, color: '#16a34a',
                  fontVariantNumeric: 'tabular-nums',
                  borderTop: `1px solid ${S.border}`, paddingTop: '4px',
                }}>
                  {formatAmountINR(totalCr)}
                </span>
                <span style={{
                  textAlign: 'right', fontSize: '0.95rem',
                  fontWeight: 900,
                  color: outstanding > 0 ? '#dc2626' : '#16a34a',
                  fontVariantNumeric: 'tabular-nums',
                  borderTop: `1px solid ${S.border}`, paddingTop: '4px',
                }}>
                  {outstanding > 0 ? formatAmountINR(outstanding) : 'Nil'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
