/**
 * cQikly — BulkPriceUpdateModal
 * Phase 9b-A: Select multiple items → apply % or flat price change
 *             → preview → confirm → write.
 */

import React, { useState, useMemo, useCallback } from 'react'
import { X, TrendingUp, TrendingDown, Check, AlertTriangle } from 'lucide-react'
import {
  inventoryService,
  type InventoryItemFull,
  type PriceFieldId,
} from '../../services/inventory.service'

const S = {
  font:    '"Inter", system-ui, sans-serif',
  text:    'var(--cq-text-primary)',
  muted:   'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  raised:  'var(--cq-surface-raised)',
  border:  'var(--cq-border)',
  accent:  'var(--cq-accent)',
}

interface Props {
  selectedItems: InventoryItemFull[]
  onClose: () => void
  onApplied: () => void
}

type Step = 'config' | 'preview' | 'done'

export default function BulkPriceUpdateModal({ selectedItems, onClose, onApplied }: Props) {
  const [step, setStep] = useState<Step>('config')
  const [field, setField] = useState<PriceFieldId>('price')
  const [mode, setMode] = useState<'percent' | 'flat'>('percent')
  const [value, setValue] = useState('')
  const [roundTo, setRoundTo] = useState(2)
  const [confirmed, setConfirmed] = useState(false)

  const fieldOptions = useMemo(() => inventoryService.getPriceFieldOptions(), [])
  const numVal = parseFloat(value)
  const validValue = Number.isFinite(numVal)

  const preview = useMemo(() => {
    if (step !== 'preview' || !validValue) return []
    return inventoryService.previewBulkPriceUpdate({
      itemIds: selectedItems.map(i => i.id),
      field,
      mode,
      value: numVal,
      roundTo,
    })
  }, [step, selectedItems, field, mode, numVal, validValue, roundTo])

  const changedCount = preview.filter(p => p.changed).length

  const handleApply = useCallback(() => {
    if (!confirmed) return
    inventoryService.applyBulkPriceUpdate(preview)
    setStep('done')
    onApplied()
  }, [confirmed, preview, onApplied])

  const fieldLabel = fieldOptions.find(f => f.id === field)?.label ?? field

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: S.font }}>
      <div style={{ background: S.raised, borderRadius: 16, border: `1px solid ${S.border}`, width: 660, maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 70px rgba(0,0,0,0.5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 22px 14px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: S.text }}>Bulk Price Update</div>
            <div style={{ fontSize: '0.77rem', color: S.muted, marginTop: 2 }}>{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected</div>
          </div>
          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginRight: 8 }}>
            {(['config', 'preview', 'done'] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, background: step === s ? S.accent : ((['config', 'preview', 'done'].indexOf(step) > i) ? `${S.accent}55` : S.surface), color: step === s ? '#fff' : S.muted, border: `1.5px solid ${step === s ? S.accent : S.border}` }}>
                  {i + 1}
                </div>
                {i < 2 && <div style={{ width: 16, height: 1, background: S.border }} />}
              </React.Fragment>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4, borderRadius: 6 }}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {step === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Field selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Field to Update</label>
                <select value={field} onChange={e => setField(e.target.value as PriceFieldId)}
                  style={{ fontFamily: S.font, fontSize: '0.88rem', padding: '8px 12px', borderRadius: 9, background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, outline: 'none', width: '100%' }}>
                  {fieldOptions.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>

              {/* Mode selector */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Update Mode</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([['percent', '% Percentage', 'Apply ± percentage change'], ['flat', '₹ Flat Amount', 'Add / subtract a fixed amount']] as const).map(([m, label, desc]) => (
                    <div key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${mode === m ? S.accent : S.border}`, background: mode === m ? `${S.accent}18` : 'transparent', transition: 'all 0.13s' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.87rem', color: mode === m ? S.accent : S.text }}>{label}</div>
                      <div style={{ fontSize: '0.74rem', color: S.muted, marginTop: 2 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Value input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {mode === 'percent' ? 'Percentage (negative = decrease)' : 'Amount (negative = decrease)'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder={mode === 'percent' ? 'e.g. 10 for +10%' : 'e.g. 5 for +₹5'}
                    style={{ fontFamily: S.font, fontSize: '1rem', padding: '9px 13px', borderRadius: 9, background: S.surface, border: `1.5px solid ${validValue ? S.accent : S.border}`, color: S.text, outline: 'none', flex: 1 }}
                    autoFocus
                  />
                  <span style={{ fontSize: '0.9rem', color: S.muted, fontWeight: 600 }}>{mode === 'percent' ? '%' : '₹'}</span>
                </div>
                {validValue && (
                  <div style={{ marginTop: 6, fontSize: '0.77rem', color: numVal >= 0 ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {numVal >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {numVal >= 0 ? 'Increase' : 'Decrease'} {fieldLabel} by {Math.abs(numVal)}{mode === 'percent' ? '%' : ' ₹'} for all {selectedItems.length} items
                  </div>
                )}
              </div>

              {/* Round to */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Round Result To</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[0, 1, 2].map(n => (
                    <button key={n} onClick={() => setRoundTo(n)} style={{ fontFamily: S.font, padding: '5px 14px', borderRadius: 7, cursor: 'pointer', fontWeight: roundTo === n ? 700 : 500, border: `1.5px solid ${roundTo === n ? S.accent : S.border}`, background: roundTo === n ? `${S.accent}22` : 'transparent', color: roundTo === n ? S.accent : S.text, fontSize: '0.82rem' }}>
                      {n === 0 ? 'Whole number' : `${n} decimal${n > 1 ? 's' : ''}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected items preview */}
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: S.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Items</label>
                <div style={{ background: S.surface, borderRadius: 9, border: `1px solid ${S.border}`, maxHeight: 130, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {selectedItems.map(item => (
                    <span key={item.id} style={{ fontSize: '0.78rem', padding: '3px 9px', borderRadius: 6, background: `${S.accent}18`, border: `1px solid ${S.accent}33`, color: S.text }}>{item.itemName || '(unnamed)'}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: changedCount > 0 ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${changedCount > 0 ? 'rgba(74,222,128,0.25)' : S.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                {changedCount > 0
                  ? <><Check size={14} color="#4ade80" /><span style={{ fontSize: '0.83rem', fontWeight: 600, color: '#4ade80' }}>{changedCount} item{changedCount !== 1 ? 's' : ''} will be updated</span></>
                  : <><AlertTriangle size={14} color={S.muted} /><span style={{ fontSize: '0.83rem', color: S.muted }}>No items will change (blank prices skipped)</span></>
                }
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: S.raised }}>
                    {['Item Name', 'Current', 'New Value', 'Δ'].map(h => (
                      <th key={h} style={{ padding: '7px 11px', textAlign: 'left', color: S.muted, fontWeight: 600, fontSize: '0.69rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1.5px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr key={p.itemId} style={{ background: !p.changed ? `rgba(255,255,255,0.02)` : (i % 2 === 0 ? 'transparent' : `${S.surface}55`) }}>
                      <td style={{ padding: '7px 11px', borderBottom: `1px solid ${S.border}`, fontWeight: 600, opacity: p.changed ? 1 : 0.45 }}>{p.itemName || '(unnamed)'}</td>
                      <td style={{ padding: '7px 11px', borderBottom: `1px solid ${S.border}`, color: S.muted, opacity: p.changed ? 1 : 0.45 }}>{p.currentValue || '—'}</td>
                      <td style={{ padding: '7px 11px', borderBottom: `1px solid ${S.border}`, fontWeight: 700, color: p.changed ? '#4ade80' : S.muted }}>{p.newValue || '—'}</td>
                      <td style={{ padding: '7px 11px', borderBottom: `1px solid ${S.border}`, fontSize: '0.76rem' }}>
                        {p.changed
                          ? (() => {
                              const o = parseFloat(p.currentValue), n = parseFloat(p.newValue)
                              if (!Number.isFinite(o) || !Number.isFinite(n)) return null
                              const d = n - o
                              return <span style={{ color: d >= 0 ? '#4ade80' : '#f87171', fontWeight: 700 }}>{d >= 0 ? '+' : ''}{d.toFixed(2)}</span>
                            })()
                          : <span style={{ color: S.muted }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Confirmation checkbox */}
              {changedCount > 0 && (
                <div onClick={() => setConfirmed(p => !p)} style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 9, border: `1.5px solid ${confirmed ? S.accent : S.border}`, background: confirmed ? `${S.accent}12` : 'transparent', userSelect: 'none' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${confirmed ? S.accent : S.border}`, background: confirmed ? S.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {confirmed && <Check size={11} color="#fff" />}
                  </div>
                  <span style={{ fontSize: '0.83rem', fontWeight: 600, color: confirmed ? S.text : S.muted }}>
                    I confirm: update {changedCount} item{changedCount !== 1 ? 's' : ''}'s <strong>{fieldLabel}</strong> — this cannot be undone
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: S.text }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: '1rem', fontWeight: 800 }}>Prices Updated</div>
              <div style={{ fontSize: '0.82rem', color: S.muted, marginTop: 6 }}>{changedCount} item{changedCount !== 1 ? 's' : ''} updated successfully. Price change history has been recorded.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 22px', borderTop: `1px solid ${S.border}` }}>
          {step !== 'done' && <button onClick={onClose} style={{ fontFamily: S.font, fontSize: '0.82rem', padding: '8px 18px', borderRadius: 9, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${S.border}`, color: S.muted }}>Cancel</button>}
          {step === 'config' && (
            <button onClick={() => setStep('preview')} disabled={!validValue}
              style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '8px 20px', borderRadius: 9, cursor: validValue ? 'pointer' : 'not-allowed', background: validValue ? S.accent : S.surface, border: 'none', color: validValue ? '#fff' : S.muted, opacity: validValue ? 1 : 0.5 }}>
              Preview Changes →
            </button>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => { setStep('config'); setConfirmed(false) }} style={{ fontFamily: S.font, fontSize: '0.82rem', padding: '8px 16px', borderRadius: 9, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${S.border}`, color: S.muted }}>← Back</button>
              <button onClick={handleApply} disabled={!confirmed || changedCount === 0}
                style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '8px 20px', borderRadius: 9, cursor: (confirmed && changedCount > 0) ? 'pointer' : 'not-allowed', background: (confirmed && changedCount > 0) ? S.accent : S.surface, border: 'none', color: (confirmed && changedCount > 0) ? '#fff' : S.muted, opacity: (confirmed && changedCount > 0) ? 1 : 0.5 }}>
                Apply {changedCount} Change{changedCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <button onClick={onClose} style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '8px 22px', borderRadius: 9, cursor: 'pointer', background: S.accent, border: 'none', color: '#fff' }}>Close</button>
          )}
        </div>
      </div>
    </div>
  )
}
