/**
 * cQikly — Saved Lists Panel
 * Phase 11b-ii
 *
 * Features:
 *   - Saved transporters list — add, edit, delete; appear as autocomplete in Transport Name field
 *   - Saved units list — add, edit, delete; used across billing grid and inventory
 *
 * Both lists persist in config and propagate instantly via event bus.
 */

import React, { useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  red:         '#f87171',
  redBg:       'rgba(239,68,68,0.08)',
}

// ─── Generic editable tag list ────────────────────────────────────────────────

interface TagListProps {
  label: string
  icon: string
  description: string
  items: string[]
  placeholder: string
  onUpdate: (items: string[]) => void
}

function TagList({ label, icon, description, items, placeholder, onUpdate }: TagListProps): React.ReactElement {
  const [input, setInput]       = useState('')
  const [editIdx, setEditIdx]   = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleAdd = () => {
    const val = input.trim()
    if (!val || items.includes(val)) return
    onUpdate([...items, val])
    setInput('')
  }

  const handleDelete = (idx: number) => {
    const next = items.filter((_, i) => i !== idx)
    onUpdate(next)
    if (editIdx === idx) setEditIdx(null)
  }

  const handleEditStart = (idx: number) => {
    setEditIdx(idx)
    setEditValue(items[idx])
  }

  const handleEditSave = () => {
    if (editIdx === null) return
    const val = editValue.trim()
    if (!val) { setEditIdx(null); return }
    const next = items.map((item, i) => i === editIdx ? val : item)
    onUpdate(next)
    setEditIdx(null)
  }

  return (
    <div style={{
      padding: '24px 28px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--cq-border)',
      borderRadius: 12, fontFamily: C.font,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          {icon} {label}
        </div>
        <div style={{ fontSize: '0.82rem', color: C.textSecond, lineHeight: 1.55 }}>{description}</div>
      </div>

      {/* Tag list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, minHeight: 36 }}>
        {items.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: C.textSecond, fontStyle: 'italic', padding: '4px 0' }}>
            No items yet — add one below
          </div>
        )}
        {items.map((item, idx) => {
          if (editIdx === idx) {
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleEditSave()
                    if (e.key === 'Escape') setEditIdx(null)
                  }}
                  style={{
                    fontFamily: C.font, fontSize: '0.82rem', padding: '4px 10px',
                    borderRadius: 6, border: `1.5px solid ${C.accent}`,
                    background: 'rgba(139,92,246,0.1)', color: C.textPrimary,
                    outline: 'none', width: 120,
                  }}
                />
                <button type="button" onClick={handleEditSave} style={{ fontFamily: C.font, fontSize: '0.76rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', outline: 'none' }}>✓</button>
                <button type="button" onClick={() => setEditIdx(null)} style={{ fontFamily: C.font, fontSize: '0.76rem', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: C.textSecond, cursor: 'pointer', outline: 'none' }}>✕</button>
              </div>
            )
          }
          return (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 20,
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)',
                fontSize: '0.82rem', color: C.textPrimary,
              }}
            >
              <span>{item}</span>
              <button type="button" onClick={() => handleEditStart(idx)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem', color: C.textSecond, padding: '0 2px', outline: 'none' }}>✏️</button>
              <button type="button" onClick={() => handleDelete(idx)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: C.red, padding: '0 2px', outline: 'none' }}>✕</button>
            </div>
          )
        })}
      </div>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder={placeholder}
          style={{
            fontFamily: C.font, fontSize: '0.85rem', padding: '8px 14px',
            borderRadius: 8, border: '1.5px solid var(--cq-border)',
            background: 'rgba(0,0,0,0.2)', color: C.textPrimary,
            outline: 'none', flex: 1, transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--cq-accent)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--cq-border)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!input.trim() || items.includes(input.trim())}
          style={{
            fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
            padding: '8px 18px', borderRadius: 8, cursor: input.trim() ? 'pointer' : 'not-allowed',
            background: input.trim() ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
            color: input.trim() ? C.accent : C.textSecond,
            border: `1.5px solid ${input.trim() ? 'rgba(139,92,246,0.4)' : 'var(--cq-border)'}`,
            outline: 'none', transition: 'all 0.15s',
          }}
        >
          + Add
        </button>
      </div>
      {items.includes(input.trim()) && input.trim() && (
        <div style={{ fontSize: '0.74rem', color: C.red, marginTop: 6 }}>Already in the list</div>
      )}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function SavedListsPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()

  return (
    <div id="savedlists" style={{ scrollMarginTop: 20 }}>

      {/* ── Section header ───────────────────────────────────────────────── */}
      <div style={{
        padding: '28px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--cq-border)',
        borderRadius: 14, fontFamily: C.font, marginTop: 20,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Saved Lists
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
          Transporters & Units
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 24, lineHeight: 1.6 }}>
          Manage your saved lists. These appear as quick autocomplete suggestions across the app — no re-typing required.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Transporters */}
          <TagList
            label="Saved Transporters"
            icon="🚚"
            description="These names appear as autocomplete suggestions in the Transport Name field on the quote page. Click the truck name to fill it instantly."
            items={config.savedTransporters as string[] ?? []}
            placeholder="Add transporter name, e.g. Blue Dart"
            onUpdate={items => updateConfig({ savedTransporters: items })}
          />

          {/* Units */}
          <TagList
            label="Saved Units"
            icon="📏"
            description="Quantity units available across the billing grid (Qty Unit column) and inventory items. E.g. pcs, kg, box, dozen."
            items={config.savedUnits as string[] ?? []}
            placeholder="Add unit, e.g. litre"
            onUpdate={items => updateConfig({ savedUnits: items })}
          />

        </div>
      </div>
    </div>
  )
}
