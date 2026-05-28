/**
 * cQikly — Outstanding Ledger View
 * Phase 7b
 *
 * Accessible from the History page via the "Outstanding" button.
 * Shows per-customer: total billed, total paid (approx), outstanding balance.
 * Filterable by date range.
 * Drill-down to see individual bills per customer.
 */

import React, { useState, useMemo, useCallback } from 'react'
import {
  ArrowLeft, Calendar, ChevronDown, ChevronRight, TrendingDown,
  Users, DollarSign, AlertCircle,
} from 'lucide-react'
import type { BillRecord } from '../../services/db.service'
import { computeLedger, getLedgerTotals } from '../../services/ledger.service'
import type { CustomerLedgerRow } from '../../services/ledger.service'
import { formatAmountINR, formatDateDisplay } from '../../services/history.service'
import { STATUS_CONFIG } from '../NewQuote/BillInfoSection'

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
  accentBg: 'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface-raised))',
  accentBorder: 'color-mix(in srgb, var(--cq-accent) 25%, var(--cq-border))',
}

interface OutstandingLedgerViewProps {
  bills: BillRecord[]
  onClose: () => void
  /** Phase 8b-i: open the full Dr/Cr ledger for a specific customer */
  onViewCustomerLedger?: (partyName: string, bills: BillRecord[]) => void
}

function StatCard({ label, value, icon, color }: {
  label: string
  value: string
  icon: React.ReactNode
  color?: string
}): React.ReactElement {
  return (
    <div style={{
      background: S.surfaceRaised,
      border: `1px solid ${S.border}`,
      borderRadius: '10px',
      padding: '16px 20px',
      flex: 1,
      minWidth: '140px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <div style={{ color: color ?? S.accent, opacity: 0.7 }}>{icon}</div>
        <span style={{ fontSize: '0.69rem', fontWeight: 600, color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: color ?? S.text, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

/** Per-customer row with drill-down */
function LedgerCustomerRow({
  row,
  onViewLedger,
}: {
  row: CustomerLedgerRow
  onViewLedger?: () => void
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const hasOutstanding = row.outstanding > 0

  return (
    <div style={{ borderBottom: `1px solid color-mix(in srgb, ${S.border} 60%, transparent)` }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 1fr 130px 130px 130px 90px',
          alignItems: 'center',
          padding: '13px 20px 13px 12px',
          cursor: 'pointer',
          background: expanded
            ? 'color-mix(in srgb, var(--cq-accent) 5%, var(--cq-surface-raised))'
            : 'transparent',
          transition: 'background 0.12s',
        }}
      >
        {/* Expand toggle */}
        <div style={{ color: S.textMuted, display: 'flex', alignItems: 'center' }}>
          {expanded
            ? <ChevronDown size={14} />
            : <ChevronRight size={14} />}
        </div>

        {/* Party */}
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: S.text }}>
            {row.partyName}
          </div>
          {row.partyPhone && (
            <div style={{ fontSize: '0.7rem', color: S.textMuted, marginTop: '2px' }}>
              {row.partyPhone} · {row.billCount} bill{row.billCount !== 1 ? 's' : ''}
            </div>
          )}
          {onViewLedger && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onViewLedger() }}
              style={{
                marginTop: '4px',
                padding: '2px 8px',
                fontSize: '0.62rem', fontWeight: 600,
                background: 'color-mix(in srgb, var(--cq-accent) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--cq-accent) 25%, transparent)',
                borderRadius: '6px', cursor: 'pointer',
                color: 'var(--cq-accent)', fontFamily: S.font,
              }}
            >
              📒 View Ledger
            </button>
          )}
        </div>

        {/* Total Billed */}
        <div style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: S.text }}>
          {formatAmountINR(row.totalBilled)}
        </div>

        {/* Total Paid */}
        <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
          {formatAmountINR(row.totalPaid)}
        </div>

        {/* Outstanding */}
        <div style={{
          textAlign: 'right', fontSize: '0.875rem', fontWeight: 800,
          color: hasOutstanding ? '#dc2626' : '#16a34a',
        }}>
          {hasOutstanding ? formatAmountINR(row.outstanding) : '—'}
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {row.statusBreakdown.unpaid > 0 && (
            <span style={{
              padding: '2px 7px', fontSize: '0.62rem', fontWeight: 700,
              color: STATUS_CONFIG.unpaid.color, background: STATUS_CONFIG.unpaid.bg,
              border: `1px solid ${STATUS_CONFIG.unpaid.border}`,
              borderRadius: '10px',
            }}>
              {row.statusBreakdown.unpaid} unpaid
            </span>
          )}
          {row.statusBreakdown.partial > 0 && (
            <span style={{
              padding: '2px 7px', fontSize: '0.62rem', fontWeight: 700,
              color: STATUS_CONFIG.partial.color, background: STATUS_CONFIG.partial.bg,
              border: `1px solid ${STATUS_CONFIG.partial.border}`,
              borderRadius: '10px',
            }}>
              {row.statusBreakdown.partial} partial
            </span>
          )}
        </div>
      </div>

      {/* Drill-down: individual bills for this customer */}
      {expanded && (
        <div style={{
          background: 'color-mix(in srgb, var(--cq-border) 15%, transparent)',
          borderTop: `1px dashed ${S.border}`,
          padding: '0 20px 8px 48px',
        }}>
          {/* Bill list header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '140px 1fr 90px 120px 100px',
            padding: '7px 0 5px',
            fontSize: '0.62rem', fontWeight: 700, color: S.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: `1px solid ${S.border}`,
          }}>
            <span>Bill No.</span>
            <span>Date</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span style={{ textAlign: 'right' }}>Status</span>
            <span></span>
          </div>

          {row.bills.map(bill => {
            const cfg = STATUS_CONFIG[bill.status]
            return (
              <div key={bill.id ?? bill.billNumber} style={{
                display: 'grid', gridTemplateColumns: '140px 1fr 90px 120px 100px',
                padding: '8px 0',
                borderBottom: `1px solid color-mix(in srgb, ${S.border} 30%, transparent)`,
                alignItems: 'center',
                fontSize: '0.78rem',
              }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
                  color: S.accent, fontSize: '0.73rem',
                }}>
                  {bill.billNumber}
                </span>
                <span style={{ color: S.textMuted }}>
                  {bill.billDate ? formatDateDisplay(bill.billDate) : '—'}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: S.text }}>
                  {formatAmountINR(Math.round(bill.grandTotal ?? 0))}
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{
                    padding: '2px 9px', fontSize: '0.64rem', fontWeight: 700,
                    color: cfg.color, background: cfg.bg,
                    border: `1px solid ${cfg.border}`,
                    borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {cfg.label}
                  </span>
                </span>
                <span style={{ textAlign: 'right', color: S.textMuted, fontSize: '0.7rem' }}>
                  {bill.transportName || ''}
                </span>
              </div>
            )
          })}

          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '24px',
            padding: '8px 0 4px',
            fontSize: '0.75rem', color: S.textMuted,
          }}>
            <span>Billed: <strong style={{ color: S.text }}>{formatAmountINR(row.totalBilled)}</strong></span>
            <span>Paid: <strong style={{ color: '#16a34a' }}>{formatAmountINR(row.totalPaid)}</strong></span>
            <span>Outstanding: <strong style={{ color: row.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
              {formatAmountINR(row.outstanding)}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OutstandingLedgerView({
  bills,
  onClose,
  onViewCustomerLedger,
}: OutstandingLedgerViewProps): React.ReactElement {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showOnlyOutstanding, setShowOnlyOutstanding] = useState(false)

  const ledgerRows = useMemo(
    () => computeLedger(bills, { dateFrom, dateTo }),
    [bills, dateFrom, dateTo],
  )

  const displayRows = useMemo(
    () => showOnlyOutstanding ? ledgerRows.filter(r => r.outstanding > 0) : ledgerRows,
    [ledgerRows, showOnlyOutstanding],
  )

  const totals = useMemo(() => getLedgerTotals(ledgerRows), [ledgerRows])

  const inputStyle: React.CSSProperties = {
    padding: '7px 11px', fontFamily: S.font, fontSize: '0.8rem',
    color: S.text, background: S.surfaceRaised,
    border: `1px solid ${S.border}`, borderRadius: '6px',
    outline: 'none',
  }

  const resetRange = useCallback(() => {
    setDateFrom('')
    setDateTo('')
  }, [])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: S.font, color: S.text, background: S.surface, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        background: S.surfaceRaised,
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', background: 'transparent',
            border: `1px solid ${S.border}`, borderRadius: '7px',
            fontSize: '0.78rem', fontFamily: S.font, fontWeight: 500,
            color: S.textMuted, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={13} /> Back to History
        </button>

        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: S.text }}>
            Outstanding Ledger
          </div>
          <div style={{ fontSize: '0.72rem', color: S.textMuted, marginTop: '1px' }}>
            Per-customer summary · total billed vs total paid vs outstanding balance
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Outstanding-only toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          fontSize: '0.78rem', fontWeight: 500, color: S.textMuted, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showOnlyOutstanding}
            onChange={e => setShowOnlyOutstanding(e.target.checked)}
            style={{ accentColor: 'var(--cq-accent)', width: '14px', height: '14px' }}
          />
          Show only with balance
        </label>
      </div>

      {/* Date range filter */}
      <div style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        background: S.surface,
      }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Date Range:
        </span>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            style={{ ...inputStyle, paddingRight: '32px' }}
          />
          <Calendar size={13} style={{
            position: 'absolute', right: '10px',
            opacity: 0.4, pointerEvents: 'none',
          }} />
        </div>

        <span style={{ color: S.textMuted, fontSize: '0.75rem' }}>to</span>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            style={{ ...inputStyle, paddingRight: '32px' }}
          />
          <Calendar size={13} style={{
            position: 'absolute', right: '10px',
            opacity: 0.4, pointerEvents: 'none',
          }} />
        </div>

        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={resetRange}
            style={{
              padding: '6px 11px', background: 'transparent',
              border: `1px solid ${S.border}`, borderRadius: '6px',
              fontSize: '0.75rem', fontFamily: S.font, fontWeight: 500,
              color: S.textMuted, cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary stat cards */}
      <div style={{
        padding: '14px 24px',
        display: 'flex', gap: '12px', flexShrink: 0,
        borderBottom: `1px solid ${S.border}`,
        background: S.surface,
      }}>
        <StatCard
          label="Customers"
          value={String(totals.customerCount)}
          icon={<Users size={15} />}
        />
        <StatCard
          label="Total Billed"
          value={formatAmountINR(totals.totalBilled)}
          icon={<DollarSign size={15} />}
        />
        <StatCard
          label="Total Paid"
          value={formatAmountINR(totals.totalPaid)}
          icon={<TrendingDown size={15} />}
          color="#16a34a"
        />
        <StatCard
          label="Total Outstanding"
          value={formatAmountINR(totals.totalOutstanding)}
          icon={<AlertCircle size={15} />}
          color={totals.totalOutstanding > 0 ? '#dc2626' : '#16a34a'}
        />
      </div>

      {/* Note about Phase 8b-ii */}
      {totals.totalOutstanding > 0 && (
        <div style={{
          padding: '8px 24px',
          background: 'color-mix(in srgb, #f59e0b 8%, var(--cq-surface))',
          borderBottom: `1px solid color-mix(in srgb, #f59e0b 20%, var(--cq-border))`,
          fontSize: '0.72rem', color: '#92400e', flexShrink: 0,
        }}>
          ✅ &nbsp;<strong>Phase 8b-ii active:</strong> Payment Recorder is live. Open the Customer Details page to record payments against a customer. Ledger here shows the latest balances.
        </div>
      )}

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 130px 130px 130px 90px',
        padding: '8px 20px 8px 12px',
        background: 'color-mix(in srgb, var(--cq-border) 35%, transparent)',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        {[
          { label: '', w: '28px' },
          { label: 'Customer', align: 'left' },
          { label: 'Total Billed', align: 'right' },
          { label: 'Total Paid', align: 'right' },
          { label: 'Outstanding', align: 'right' },
          { label: 'Status', align: 'right' },
        ].map(({ label, align }, i) => (
          <div key={i} style={{
            fontSize: '0.67rem', fontWeight: 700, color: S.textMuted,
            letterSpacing: '0.07em', textTransform: 'uppercase',
            textAlign: (align ?? 'left') as React.CSSProperties['textAlign'],
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* Customer rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: S.textMuted }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.2, marginBottom: '12px' }}>📊</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>
              {showOnlyOutstanding ? 'No outstanding balances' : 'No customer data yet'}
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.6 }}>
              Save bills to see ledger data here
            </div>
          </div>
        ) : (
          displayRows.map(row => (
            <LedgerCustomerRow
              key={row.partyName}
              row={row}
              onViewLedger={onViewCustomerLedger
                ? () => onViewCustomerLedger(row.partyName, row.bills)
                : undefined}
            />
          ))
        )}
      </div>
    </div>
  )
}
