/**
 * cQikly — Customer Settings Panel
 * Phase 11b-ii
 *
 * Features:
 *   - Customer credit limit global default — applied to all new customers
 *     who don't have a specific credit limit set.
 */

import React, { useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
}

export default function CustomerSettingsPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const [saved, setSaved] = useState(false)

  const currentLimit = typeof config.customerCreditLimitDefault === 'number'
    ? config.customerCreditLimitDefault
    : 0

  const [draft, setDraft] = useState(String(currentLimit))

  const handleSave = () => {
    const parsed = parseFloat(draft)
    if (isNaN(parsed) || parsed < 0) return
    updateConfig({ customerCreditLimitDefault: parsed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div id="customersettings" style={{ scrollMarginTop: 20 }}>
      <div style={{
        padding: '28px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--cq-border)',
        borderRadius: 14, fontFamily: C.font, marginTop: 20,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Customer Settings
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
          Global Credit Limit Default
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 22, lineHeight: 1.6 }}>
          This value is automatically applied as the credit limit for every new customer added to the system. You can override it per-customer anytime from the Customer Details page. Set to 0 for no default limit.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 9, overflow: 'hidden', border: '1.5px solid var(--cq-border)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '9px 14px', fontSize: '0.88rem', fontWeight: 700, color: C.textSecond, borderRight: '1px solid var(--cq-border)', background: 'rgba(255,255,255,0.03)' }}>₹</div>
            <input
              type="number"
              min={0}
              step={500}
              value={draft}
              onChange={e => { setDraft(e.target.value); setSaved(false) }}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              style={{
                fontFamily: C.font, fontSize: '0.95rem', fontWeight: 700,
                padding: '9px 16px', background: 'transparent', border: 'none',
                color: C.textPrimary, outline: 'none', width: 140,
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            style={{
              fontFamily: C.font, fontSize: '0.86rem', fontWeight: 700,
              padding: '9px 22px', borderRadius: 9, cursor: 'pointer', outline: 'none',
              background: saved ? C.greenBg : 'rgba(139,92,246,0.16)',
              color: saved ? C.green : C.accent,
              border: `1.5px solid ${saved ? C.greenBorder : 'rgba(139,92,246,0.4)'}`,
              transition: 'all 0.2s',
            }}
          >
            {saved ? '✅ Saved' : 'Save Default'}
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: '0.78rem', color: C.textSecond, lineHeight: 1.55 }}>
          💡 Current default: <strong style={{ color: C.textPrimary }}>
            {currentLimit === 0 ? 'None (unlimited)' : `₹${currentLimit.toLocaleString('en-IN')}`}
          </strong>
        </div>
      </div>
    </div>
  )
}
