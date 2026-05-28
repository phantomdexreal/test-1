/**
 * cQikly — BillInfoSection
 * Built in: Phase 4b-ii
 *
 * Renders the bill number, bill date, and bill status fields.
 *
 * Bill Number:
 *   - Displays the upcoming auto-incremented number (read-only preview)
 *   - Prefix from Settings
 *   - Resets on FY start, always to 1 (Hard Spec #3)
 *
 * Bill Date:
 *   - Fully editable date field
 *   - Defaults to today
 *   - Backdating fully supported (common in Indian businesses)
 *
 * Bill Status:
 *   - Defaults to "Unpaid" on new bill
 *   - On new bill page: display-only (Unpaid badge), editable from History
 *   - Status colors: Unpaid=amber, Paid=green, Partial=blue, Cancelled=red
 */

import React, { useEffect, useState } from 'react'
import { Hash, Calendar } from 'lucide-react'
import { peekNextBillNumber } from '../../services/bill.service'
import type { BillStatus } from '../../services/db.service'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BillInfo {
  billNumber: string   // readonly — auto-generated on save
  billDate: string     // ISO date string (YYYY-MM-DD)
  status: BillStatus
}

interface BillInfoSectionProps {
  value: BillInfo
  onChange: (info: BillInfo) => void
  /** If true, status is editable (used in History page edit mode) */
  statusEditable?: boolean
}

// ─── Status config ──────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<BillStatus, { label: string; color: string; bg: string; border: string }> = {
  unpaid:    { label: 'Unpaid',    color: '#d97706', bg: 'rgba(217,119,6,0.12)',   border: 'rgba(217,119,6,0.4)' },
  paid:      { label: 'Paid',      color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   border: 'rgba(22,163,74,0.4)' },
  partial:   { label: 'Partial',   color: '#2563eb', bg: 'rgba(37,99,235,0.12)',   border: 'rgba(37,99,235,0.4)' },
  cancelled: { label: 'Cancelled', color: '#dc2626', bg: 'rgba(220,38,38,0.12)',   border: 'rgba(220,38,38,0.4)' },
}

const ALL_STATUSES: BillStatus[] = ['unpaid', 'paid', 'partial', 'cancelled']

// ─── Styles ─────────────────────────────────────────────────────────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
  radius: '8px',
}

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    fontFamily: S.font,
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '9px 12px 9px 36px',
    fontSize: '0.875rem',
    color: S.text,
    background: S.surfaceRaised,
    border: `1.5px solid ${focused ? S.accent : S.border}`,
    borderRadius: S.radius,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focused ? `0 0 0 3px color-mix(in srgb, var(--cq-accent) 15%, transparent)` : 'none',
  }
}

// ─── StatusTag — colored pill ──────────────────────────────────────────────────

export function StatusTag({
  status,
  size = 'md',
}: {
  status: BillStatus
  size?: 'sm' | 'md'
}): React.ReactElement {
  const cfg = STATUS_CONFIG[status]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '4px 12px',
      fontSize: size === 'sm' ? '0.68rem' : '0.75rem',
      fontWeight: 700,
      fontFamily: S.font,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: '20px',
    }}>
      {cfg.label}
    </span>
  )
}

// ─── StatusSelector — dropdown ─────────────────────────────────────────────────

function StatusSelector({
  value,
  onChange,
}: {
  value: BillStatus
  onChange: (s: BillStatus) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[value]

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          fontSize: '0.75rem',
          fontWeight: 700,
          fontFamily: S.font,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          borderRadius: '20px',
          cursor: 'pointer',
          outline: 'none',
          transition: 'opacity 0.1s',
        }}
      >
        {cfg.label}
        <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            background: S.surfaceRaised,
            border: `1.5px solid ${S.border}`,
            borderRadius: S.radius,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100,
            padding: '4px',
            minWidth: '140px',
          }}>
            {ALL_STATUSES.map(s => {
              const c = STATUS_CONFIG[s]
              const active = s === value
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { onChange(s); setOpen(false) }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    background: active ? c.bg : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontFamily: S.font,
                    fontSize: '0.82rem',
                    fontWeight: active ? 700 : 500,
                    color: c.color,
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = c.bg }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    width: '8px', height: '8px',
                    borderRadius: '50%',
                    background: c.color,
                    flexShrink: 0,
                  }} />
                  {c.label}
                  {active && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── BillInfoSection ────────────────────────────────────────────────────────────

export function BillInfoSection({
  value,
  onChange,
  statusEditable = false,
}: BillInfoSectionProps): React.ReactElement {
  const [dateFocused, setDateFocused] = useState(false)
  const [nextBillNumber, setNextBillNumber] = useState<string>('...')

  // Peek at the upcoming bill number on mount
  useEffect(() => {
    peekNextBillNumber()
      .then(n => setNextBillNumber(n))
      .catch(() => setNextBillNumber('INV/--'))
  }, [])

  const patch = (fields: Partial<BillInfo>) => onChange({ ...value, ...fields })

  return (
    <div style={{
      fontFamily: S.font,
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: '12px',
      alignItems: 'end',
    }}>
      {/* ── Bill Number (read-only preview) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{
          fontSize: '0.72rem', fontWeight: 600, color: S.textMuted,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Bill No.
        </label>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px',
          background: 'color-mix(in srgb, var(--cq-accent) 6%, var(--cq-surface-raised))',
          border: `1.5px solid color-mix(in srgb, var(--cq-accent) 30%, var(--cq-border))`,
          borderRadius: S.radius,
          minWidth: '160px',
        }}>
          <Hash size={14} style={{ color: S.accent, flexShrink: 0 }} />
          <span style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            color: S.accent,
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            letterSpacing: '0.03em',
          }}>
            {nextBillNumber}
          </span>
          <span style={{
            fontSize: '0.65rem',
            color: S.textMuted,
            marginLeft: '4px',
            fontStyle: 'italic',
          }}>
            auto
          </span>
        </div>
      </div>

      {/* ── Bill Date (fully editable) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{
          fontSize: '0.72rem', fontWeight: 600, color: S.textMuted,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Bill Date
          <span style={{ marginLeft: '6px', fontWeight: 400, opacity: 0.7 }}>
            (backdating supported)
          </span>
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
            color: dateFocused ? S.accent : S.textMuted,
            pointerEvents: 'none', display: 'flex',
            transition: 'color 0.15s',
            zIndex: 1,
          }}>
            <Calendar size={15} />
          </span>
          <input
            type="date"
            value={value.billDate}
            onChange={e => patch({ billDate: e.target.value })}
            onFocus={() => setDateFocused(true)}
            onBlur={() => setDateFocused(false)}
            style={{
              ...inputStyle(dateFocused),
              // Ensure native date picker looks good with theme
              colorScheme: 'dark',
            }}
          />
        </div>
      </div>

      {/* ── Status ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <label style={{
          fontSize: '0.72rem', fontWeight: 600, color: S.textMuted,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          Status
        </label>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '6px 4px',
          minHeight: '38px',
        }}>
          {statusEditable ? (
            <StatusSelector
              value={value.status}
              onChange={s => patch({ status: s })}
            />
          ) : (
            <StatusTag status={value.status} />
          )}
          {!statusEditable && (
            <span style={{
              marginLeft: '8px',
              fontSize: '0.68rem',
              color: S.textMuted,
              fontStyle: 'italic',
              opacity: 0.7,
            }}>
              editable from History
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Create a fresh BillInfo with today's date and default status */
export function createDefaultBillInfo(): BillInfo {
  return {
    billNumber: '',
    billDate: new Date().toISOString().split('T')[0],
    status: 'unpaid',
  }
}

export default BillInfoSection
