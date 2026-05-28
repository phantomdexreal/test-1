/**
 * cQikly — Inventory Rate Source Settings Panel
 * Phase 9a-A: Lets user configure which price field fills the Rate column
 *             when an inventory item is inserted, independently per bill format.
 *             Custom price columns from inventory appear here automatically.
 */

import React, { useEffect, useState } from 'react'
import { inventoryService, type PriceFieldId } from '../../services/inventory.service'
import { eventBus } from '../../utils/eventBus'

const C = {
  font:        '"Inter", system-ui, sans-serif',
  border:      'rgba(139,92,246,0.25)',
  accent:      '#8b5cf6',
  textPrimary: '#f1f0ff',
  textSecond:  'rgba(196,181,253,0.72)',
  textMuted:   'rgba(196,181,253,0.42)',
  surface:     'rgba(139,92,246,0.08)',
}

export default function InventoryRateSourcePanel(): React.ReactElement {
  const [options, setOptions] = useState<Array<{ id: PriceFieldId; label: string }>>([])
  const [cfg, setCfg] = useState(inventoryService.getRateSourceConfig())

  const reload = () => {
    setOptions(inventoryService.getPriceFieldOptions())
    setCfg(inventoryService.getRateSourceConfig())
  }

  useEffect(() => {
    reload()
    const unsub = eventBus.on('inventoryChanged', reload)
    return () => unsub()
  }, [])

  const set = (key: 'freeFormat' | 'gstFormat', value: PriceFieldId) => {
    inventoryService.setRateSourceConfig({ [key]: value })
    setCfg(inventoryService.getRateSourceConfig())
  }

  const selectStyle: React.CSSProperties = {
    fontFamily: C.font, fontSize: '0.85rem',
    padding: '7px 10px', borderRadius: 8,
    background: 'rgba(139,92,246,0.12)',
    border: `1.5px solid ${C.border}`,
    color: C.textPrimary,
    outline: 'none', cursor: 'pointer',
    minWidth: 180,
  }

  return (
    <div style={{
      marginTop: '24px', padding: '24px 28px',
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '14px',
      fontFamily: C.font,
    }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
        Inventory
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: C.textPrimary, marginBottom: '6px' }}>
        Inventory Rate Source per Format
      </div>
      <div style={{ fontSize: '0.85rem', color: C.textSecond, lineHeight: 1.7, marginBottom: '22px' }}>
        When you press <strong style={{ color: C.textPrimary }}>Insert</strong> to auto-fill an item from inventory, this setting controls which price field
        is used to fill the Rate column — configured independently for Free Format and GST Format.
        Custom price columns added in the Inventory page appear here automatically.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Free Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>Free Format</div>
            <div style={{ fontSize: '0.73rem', color: C.textMuted }}>Alt+1 bill format</div>
          </div>
          <select
            value={cfg.freeFormat}
            onChange={e => set('freeFormat', e.target.value as PriceFieldId)}
            style={selectStyle}
          >
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <div style={{ fontSize: '0.75rem', color: C.textMuted }}>
            Currently: <strong style={{ color: C.textSecond }}>{options.find(o => o.id === cfg.freeFormat)?.label ?? cfg.freeFormat}</strong>
          </div>
        </div>

        {/* GST Format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>GST Format</div>
            <div style={{ fontSize: '0.73rem', color: C.textMuted }}>Alt+2 bill format</div>
          </div>
          <select
            value={cfg.gstFormat}
            onChange={e => set('gstFormat', e.target.value as PriceFieldId)}
            style={selectStyle}
          >
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <div style={{ fontSize: '0.75rem', color: C.textMuted }}>
            Currently: <strong style={{ color: C.textSecond }}>{options.find(o => o.id === cfg.gstFormat)?.label ?? cfg.gstFormat}</strong>
          </div>
        </div>
      </div>

      {options.length > 4 && (
        <div style={{ marginTop: 16, fontSize: '0.75rem', color: C.accent, opacity: 0.75 }}>
          ✦ {options.length - 4} custom price column{options.length - 4 !== 1 ? 's' : ''} available — added from the Inventory page
        </div>
      )}
    </div>
  )
}
