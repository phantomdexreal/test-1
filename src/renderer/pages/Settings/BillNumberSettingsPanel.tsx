/**
 * cQikly — Settings: Bill Number Settings Panel
 * Built in: Phase 11a-i
 *
 * Controls:
 *   - PO number prefix (text prefix applied before every bill number)
 *   - Starting number — ONE-TIME migration use only (clearly labelled)
 *   - Auto-increment toggle
 *   - Reset cycle (yearly / monthly / never)
 *   - Financial year start month (mirrors Company Profile; synced)
 *   - Year prefix configuration (applied on each FY rollover)
 *
 * Hard Spec #3:
 *   - Resets ALWAYS restart from 1 — never from the migration starting number
 *   - Starting number is consumed once and then ignored forever
 *   - On year rollover: new FY prefix applied + counter back to 1
 *
 * All changes propagate instantly via updateConfig() + updateBillNumberConfig()
 * → eventBus.emit('configChange') fires → zero restart.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import {
  updateBillNumberConfig,
  getBillNumberEngine,
  setMigrationStartingNumber,
  getFYPrefix,
} from '../../utils/billNumber'
import { eventBus } from '../../utils/eventBus'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  surface:     'var(--cq-surface)',
  border:      'var(--cq-border)',
  panelBg:     'rgba(255,255,255,0.03)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  amber:       '#fbbf24',
  amberBg:     'rgba(251,191,36,0.09)',
  amberBorder: 'rgba(251,191,36,0.33)',
  blue:        '#60a5fa',
  blueBg:      'rgba(96,165,250,0.10)',
  blueBorder:  'rgba(96,165,250,0.30)',
}

// ─── Month helpers ────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: C.textSecond, letterSpacing: '0.02em' }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: '0.74rem', color: C.textSecond, opacity: 0.75, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: C.font,
  fontSize: '0.88rem',
  color: 'var(--cq-text-primary)',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid var(--cq-border)',
  borderRadius: 8,
  padding: '10px 14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b5cf6' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
}

function ToggleRow({
  label, desc, value, onChange,
}: {
  label: string
  desc: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderTop: '1px solid rgba(139,92,246,0.12)',
    }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
          padding: '8px 22px', borderRadius: 9, cursor: 'pointer',
          minWidth: 76,
          background: value ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.06)',
          color: value ? C.green : C.textSecond,
          border: `1.5px solid ${value ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.12)'}`,
          transition: 'all 0.18s',
          outline: 'none',
        }}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BillNumberSettingsPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()

  // Local state mirrors config + engine state
  const [prefix, setPrefix]           = useState(config.billPrefix ?? 'INV/')
  const [fyStartMonth, setFyStartMonth] = useState(
    MONTHS[(config.fyStartMonth ?? 4) - 1] ?? 'April'
  )
  const [resetCycle, setResetCycle]   = useState<'yearly' | 'monthly' | 'never'>(
    (config.billResetCycle as 'yearly' | 'monthly' | 'never') ?? 'yearly'
  )
  const [autoIncrement, setAutoIncrement] = useState(
    config.billAutoIncrement !== false // default true
  )
  const [startingNum, setStartingNum]     = useState('1')
  const [yearPrefix, setYearPrefix]       = useState('')   // displayed current FY prefix
  const [previewBillNum, setPreviewBillNum] = useState('')
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [migrationConsumed, setMigrationConsumed] = useState(false)

  // ── Load engine state on mount ────────────────────────────────────────────
  useEffect(() => {
    const engine = getBillNumberEngine()
    const state  = engine.getState()
    setStartingNum(String(state.migrationStartNumber ?? 1))
    setMigrationConsumed(state.migrationConsumed)
    setYearPrefix(state.currentFYPrefix)

    engine.peek().then(next => setPreviewBillNum(next)).catch(() => {})
  }, [])

  // ── Preview update when config fields change ──────────────────────────────
  useEffect(() => {
    const fyNum = MONTHS.indexOf(fyStartMonth) + 1
    const fyPfx = getFYPrefix(new Date(), fyNum)
    setYearPrefix(fyPfx)
    const next = resetCycle === 'never'
      ? `${prefix}1`
      : `${prefix}${fyPfx}1`
    setPreviewBillNum(next)
  }, [prefix, fyStartMonth, resetCycle])

  // ── Persist helper ────────────────────────────────────────────────────────
  const persist = useCallback(async (
    p: string, fy: string, cycle: 'yearly' | 'monthly' | 'never', auto: boolean
  ) => {
    const fyNum = MONTHS.indexOf(fy) + 1

    updateConfig({
      billPrefix:       p,
      fyStartMonth:     fyNum,
      billResetCycle:   cycle,
      billAutoIncrement: auto,
    })

    await updateBillNumberConfig({
      prefix:       p,
      fyStartMonth: fyNum,
      resetCycle:   cycle,
    })

    // Re-read preview after engine update
    try {
      const next = await getBillNumberEngine().peek()
      setPreviewBillNum(next)
    } catch { /* ignore */ }

    eventBus.emit('configChange', { key: 'billNumberConfigUpdated', value: true })

    setSavedFeedback(true)
    setTimeout(() => setSavedFeedback(false), 2000)
  }, [updateConfig])

  // ── Change handlers ───────────────────────────────────────────────────────
  const handlePrefix = (v: string) => {
    setPrefix(v)
    persist(v, fyStartMonth, resetCycle, autoIncrement)
  }

  const handleFYMonth = (v: string) => {
    setFyStartMonth(v)
    persist(prefix, v, resetCycle, autoIncrement)
  }

  const handleResetCycle = (v: 'yearly' | 'monthly' | 'never') => {
    setResetCycle(v)
    persist(prefix, fyStartMonth, v, autoIncrement)
  }

  const handleAutoIncrement = (v: boolean) => {
    setAutoIncrement(v)
    persist(prefix, fyStartMonth, resetCycle, v)
  }

  const handleStartingNum = async (v: string) => {
    setStartingNum(v)
    const n = parseInt(v, 10)
    if (n > 0 && !migrationConsumed) {
      await setMigrationStartingNumber(n)
      updateConfig({ startingBillNumber: n })
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 2000)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      padding: '28px 32px',
      background: C.panelBg,
      border: '1px solid var(--cq-border)',
      borderRadius: 14,
      fontFamily: C.font,
      marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Bill Numbering
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary }}>
            Bill Number Settings
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {savedFeedback && (
            <div style={{
              fontSize: '0.78rem', fontWeight: 700, color: C.green,
              background: C.greenBg, border: `1px solid ${C.greenBorder}`,
              borderRadius: 8, padding: '5px 12px',
            }}>
              ✓ Saved
            </div>
          )}
        </div>
      </div>

      {/* Live Preview */}
      <div style={{
        background: C.blueBg, border: `1px solid ${C.blueBorder}`,
        borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ fontSize: '1.3rem' }}>🔢</div>
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 600, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
            Next Bill Number Preview
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.textPrimary, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.04em' }}>
            {previewBillNum || `${prefix}${yearPrefix}1`}
          </div>
          <div style={{ fontSize: '0.74rem', color: C.textSecond, marginTop: 2 }}>
            Format: <span style={{ fontFamily: 'monospace' }}>{prefix}{resetCycle !== 'never' ? `${yearPrefix}` : ''}&lt;number&gt;</span>
          </div>
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>

        {/* Prefix */}
        <Field label="PO Number Prefix" hint='e.g. "INV/" → bill becomes INV/25-26/42'>
          <input
            style={inputStyle}
            value={prefix}
            onChange={e => handlePrefix(e.target.value)}
            placeholder="INV/"
            maxLength={20}
          />
        </Field>

        {/* FY Start Month */}
        <Field label="Financial Year Start Month" hint="Determines when yearly reset triggers">
          <select
            style={selectStyle}
            value={fyStartMonth}
            onChange={e => handleFYMonth(e.target.value)}
          >
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>

        {/* Reset Cycle */}
        <Field label="Bill Number Reset Cycle">
          <select
            style={selectStyle}
            value={resetCycle}
            onChange={e => handleResetCycle(e.target.value as 'yearly' | 'monthly' | 'never')}
          >
            <option value="yearly">Yearly — resets on financial year start</option>
            <option value="monthly">Monthly — resets on 1st of each month</option>
            <option value="never">Never — continuous numbering</option>
          </select>
        </Field>

        {/* Year Prefix display */}
        {resetCycle !== 'never' && (
          <Field
            label="Current Year Prefix"
            hint="Automatically computed from financial year start month. Applied on each rollover."
          >
            <div style={{
              ...inputStyle,
              background: 'rgba(255,255,255,0.03)',
              color: C.textSecond,
              cursor: 'default',
              userSelect: 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>Auto:</span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.95rem', color: C.blue, fontWeight: 700 }}>
                {yearPrefix}
              </span>
            </div>
          </Field>
        )}

        {/* Starting Bill Number — one-time migration */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Starting Bill Number">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                value={startingNum}
                onChange={e => handleStartingNum(e.target.value)}
                type="number"
                min="1"
                disabled={migrationConsumed}
              />
              <div style={{
                fontSize: '0.76rem',
                color: migrationConsumed ? C.green : C.amber,
                background: migrationConsumed ? C.greenBg : C.amberBg,
                border: `1px solid ${migrationConsumed ? C.greenBorder : C.amberBorder}`,
                borderRadius: 7, padding: '8px 13px', lineHeight: 1.5, flex: 1,
                maxWidth: 380,
              }}>
                {migrationConsumed
                  ? '✓ Migration starting number already consumed. Future year resets always restart from 1.'
                  : '⚠ ONE-TIME MIGRATION SETTING — used only for the very first bill in this installation to allow migrating from another system. After that first bill, all resets restart from 1.'
                }
              </div>
            </div>
          </Field>
        </div>
      </div>

      {/* Auto-increment toggle */}
      <ToggleRow
        label="Auto-increment Bill Number"
        desc="When ON, bill numbers increment automatically on each new bill. Turn OFF only if you manage numbering manually."
        value={autoIncrement}
        onChange={handleAutoIncrement}
      />

      {/* Reset behaviour note */}
      <div style={{
        marginTop: 20,
        fontSize: '0.8rem', color: C.textSecond, lineHeight: 1.7,
        padding: '12px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(139,92,246,0.12)',
        borderRadius: 9,
      }}>
        <strong style={{ color: C.textPrimary }}>Reset behaviour (Hard Spec #3):</strong>
        {' '}On every yearly or monthly reset, the bill number always restarts from <strong style={{ color: C.textPrimary }}>1</strong>.
        The migration starting number is a one-time setting for legacy migration and is never re-applied after the first bill.
        Deleted bill numbers are permanently retired and never reused.
      </div>
    </div>
  )
}
