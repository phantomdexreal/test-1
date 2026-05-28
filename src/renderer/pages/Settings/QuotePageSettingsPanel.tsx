/**
 * cQikly — Quote Page Settings Panel
 * Phase: 11b-i
 *
 * Controls:
 *  - Inventory mode toggle
 *  - F2 / mouse-click edit mode toggle (Hard Spec #5)
 *  - Discount column toggle
 *  - Qty unit column toggle
 *  - Rate history hint toggle
 *  - Stock deduction on bill save toggle
 *  - Inventory Rate Source per Format (Free & GST independently)
 *
 * All changes instant via eventBus / ConfigContext.
 */

import React from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { eventBus } from '../../utils/eventBus'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
}

// ─── Toggle row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string
  desc: string
  value: boolean
  disabled?: boolean
  disabledReason?: string
  onChange: (v: boolean) => void
  tag?: string
}

function ToggleRow({ label, desc, value, disabled, disabledReason, onChange, tag }: ToggleRowProps): React.ReactElement {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0',
      borderTop: '1px solid rgba(139,92,246,0.1)',
      opacity: disabled ? 0.45 : 1,
    }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>{label}</span>
          {tag && (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: C.accent, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {tag}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>
          {disabled && disabledReason ? disabledReason : desc}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(!value)}
        style={{
          fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
          padding: '8px 22px', borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer',
          minWidth: 76, flexShrink: 0,
          background: value ? C.greenBg : 'rgba(255,255,255,0.06)',
          color: value ? C.green : C.textSecond,
          border: `1.5px solid ${value ? C.greenBorder : 'rgba(255,255,255,0.12)'}`,
          transition: 'all 0.18s', outline: 'none',
        }}
      >
        {value ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

// ─── Inventory Rate Source selectors ─────────────────────────────────────────

const DEFAULT_PRICE_FIELDS = ['Price', 'Wholesale Price', 'GST Price', 'Credit']

function InventoryRateSourceRow({
  format,
  label,
  configKey,
}: {
  format: string
  label: string
  configKey: 'inventoryRateSourceFree' | 'inventoryRateSourceGst'
}): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const current = (config[configKey] as string) ?? 'Price'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0',
      borderTop: '1px solid rgba(139,92,246,0.1)',
    }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
            Rate Source — {label}
          </span>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {format}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>
          Which price field fills the Rate column when an inventory item is inserted via the <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '0 4px', fontSize: '0.75rem' }}>Insert</kbd> key. Independently configurable per format.
        </div>
      </div>
      <select
        value={current}
        onChange={e => {
          updateConfig({ [configKey]: e.target.value } as Record<string, string>)
          eventBus.emit('configChange', { key: configKey, value: e.target.value })
        }}
        style={{
          fontFamily: C.font, fontSize: '0.84rem', fontWeight: 600,
          background: 'rgba(139,92,246,0.1)', color: C.accent,
          border: '1.5px solid rgba(139,92,246,0.35)', borderRadius: 8,
          padding: '8px 14px', outline: 'none', cursor: 'pointer', flexShrink: 0,
          minWidth: 160,
        }}
      >
        {DEFAULT_PRICE_FIELDS.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
        {/* TODO: Phase 9b-B: custom price columns from inventory schema appear here */}
      </select>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function QuotePageSettingsPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()

  return (
    <div style={{
      padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--cq-border)',
      borderRadius: 14, fontFamily: C.font, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Quote Page
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        Quote Page Settings
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 4, lineHeight: 1.6 }}>
        Configure billing grid behaviour, column visibility, and inventory integration. All changes apply instantly.
      </div>

      {/* Inventory mode */}
      <ToggleRow
        label="Inventory Autocomplete"
        desc='Typing in the Item Name cell shows a fuzzy autocomplete dropdown from your inventory. Press Insert to fill item name + rate.'
        value={config.inventoryModeEnabled === true}
        onChange={v => updateConfig({ inventoryModeEnabled: v })}
        tag="Inventory"
      />

      {/* F2 edit mode */}
      <ToggleRow
        label="F2 Edit Mode"
        desc='Strict Excel-style cell locking. When ON: navigating to a cell and typing does nothing — press F2 first to unlock the cell for editing. When OFF: typing immediately replaces the cell content.'
        value={config.f2EditMode === true}
        onChange={v => {
          updateConfig({ f2EditMode: v })
          eventBus.emit('configChange', { key: 'f2EditMode', value: v })
        }}
        tag="Hard Spec #5"
      />

      {/* Discount column */}
      <ToggleRow
        label="Discount Column"
        desc="Show or hide the per-item discount percentage/amount column on the billing grid. Hidden by default."
        value={config.discountColumnVisible === true}
        onChange={v => {
          updateConfig({ discountColumnVisible: v })
          eventBus.emit('configChange', { key: 'discountColumnVisible', value: v })
        }}
      />

      {/* Qty unit column */}
      <ToggleRow
        label="Qty Unit Column"
        desc="Show or hide the unit field alongside the Quantity column (e.g. pcs, kg, boxes). Unit suggestions come from your Saved Units list."
        value={config.qtyUnitColumnVisible === true}
        onChange={v => {
          updateConfig({ qtyUnitColumnVisible: v })
          eventBus.emit('configChange', { key: 'qtyUnitColumnVisible', value: v })
        }}
      />

      {/* Rate history hint */}
      <ToggleRow
        label="Rate History Hint"
        desc='Shows a ghost placeholder in the Rate cell with the last used rate for that item (fuzzy match). Press Insert while in the Rate cell to accept the hint.'
        value={config.rateHistoryHintEnabled !== false}  // default ON
        onChange={v => {
          updateConfig({ rateHistoryHintEnabled: v })
          eventBus.emit('configChange', { key: 'rateHistoryHintEnabled', value: v })
        }}
      />

      {/* Stock deduction */}
      <ToggleRow
        label="Deduct Stock on Bill Save"
        desc="Automatically reduces each matched inventory item's Stock Qty by the billed quantity when a bill is saved. Requires Stock Quantity Tracking to be enabled."
        value={config.stockDeductOnSave === true}
        disabled={!config.stockQtyEnabled}
        disabledReason="Enable Stock Quantity Tracking first (Inventory & Stock section) to use this setting."
        onChange={v => updateConfig({ stockDeductOnSave: v })}
      />

      {/* Inventory Rate Source — Free Format */}
      <InventoryRateSourceRow
        format="Free Format"
        label="Free Format"
        configKey="inventoryRateSourceFree"
      />

      {/* Inventory Rate Source — GST Format */}
      <InventoryRateSourceRow
        format="GST Format"
        label="GST Format"
        configKey="inventoryRateSourceGst"
      />

      {/* Info note */}
      <div style={{
        marginTop: 18, padding: '12px 16px',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10,
        fontSize: '0.76rem', color: C.textSecond, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.textPrimary }}>Insert key behaviour:</strong> Column-context-aware with zero conflict — in the Item Name cell (inventory mode ON) it accepts the autocomplete suggestion; in the Rate cell (hint visible) it accepts the rate hint. These never conflict because they fire in different columns.
      </div>
    </div>
  )
}
