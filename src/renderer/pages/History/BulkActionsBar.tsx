/**
 * cQikly — Bulk Actions Bar
 * Phase 7b
 *
 * Appears when 1+ bills are selected in History.
 * Actions: Delete selected, Export to Excel, Change status of selected, Batch PDF.
 */

import React, { useState } from 'react'
import { Trash2, Download, FileText, ChevronDown, X } from 'lucide-react'
import type { BillStatus } from '../../services/db.service'
import { STATUS_CONFIG } from '../NewQuote/BillInfoSection'

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
}

const ALL_STATUSES: BillStatus[] = ['unpaid', 'paid', 'partial', 'cancelled']

interface BulkActionsBarProps {
  selectedCount: number
  onClearSelection: () => void
  onDeleteSelected: () => Promise<void>
  onExportSelected: () => Promise<void>
  onChangeStatusSelected: (status: BillStatus) => Promise<void>
  onBatchPdfSelected: () => Promise<void>
}

export default function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onChangeStatusSelected,
  onBatchPdfSelected,
}: BulkActionsBarProps): React.ReactElement | null {
  if (selectedCount === 0) return null

  return (
    <div style={{
      padding: '10px 24px',
      background: 'color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))',
      border: `1px solid color-mix(in srgb, var(--cq-accent) 25%, var(--cq-border))`,
      borderLeft: 'none', borderRight: 'none',
      display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      {/* Selection count */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 12px',
        background: S.surfaceRaised,
        border: `1px solid ${S.border}`,
        borderRadius: '20px',
        fontSize: '0.78rem', fontFamily: S.font, fontWeight: 700, color: S.text,
      }}>
        <span style={{
          width: '18px', height: '18px', background: 'var(--cq-accent)',
          borderRadius: '50%', display: 'inline-flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#fff',
        }}>
          {selectedCount}
        </span>
        bill{selectedCount !== 1 ? 's' : ''} selected
        <button
          type="button"
          onClick={onClearSelection}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '0 0 0 2px', display: 'flex', alignItems: 'center',
            color: S.textMuted,
          }}
          title="Clear selection"
        >
          <X size={12} />
        </button>
      </div>

      <div style={{ width: 1, height: 22, background: S.border, flexShrink: 0 }} />

      {/* Delete */}
      <BulkActionButton
        icon={<Trash2 size={13} />}
        label="Delete"
        dangerous
        onClick={onDeleteSelected}
        confirmMessage={`Delete ${selectedCount} bill${selectedCount !== 1 ? 's' : ''}? This cannot be undone.`}
      />

      {/* Export Excel */}
      <BulkActionButton
        icon={<Download size={13} />}
        label="Export Excel"
        onClick={onExportSelected}
      />

      {/* Batch PDF */}
      <BulkActionButton
        icon={<FileText size={13} />}
        label="Batch PDF"
        onClick={onBatchPdfSelected}
      />

      {/* Change Status */}
      <StatusChangeDropdown
        selectedCount={selectedCount}
        onChange={onChangeStatusSelected}
      />
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BulkActionButton({
  icon,
  label,
  onClick,
  dangerous = false,
  confirmMessage,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => Promise<void>
  dangerous?: boolean
  confirmMessage?: string
}): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleClick = async () => {
    if (dangerous && confirmMessage && !confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    setLoading(true)
    try {
      await onClick()
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 12px',
        background: 'color-mix(in srgb, #dc2626 10%, var(--cq-surface-raised))',
        border: '1px solid color-mix(in srgb, #dc2626 30%, var(--cq-border))',
        borderRadius: '7px',
        fontSize: '0.76rem', fontFamily: S.font, color: '#dc2626',
      }}>
        <span style={{ fontWeight: 500 }}>{confirmMessage}</span>
        <button
          type="button"
          onClick={handleClick}
          style={{
            padding: '3px 10px', background: '#dc2626', border: 'none',
            borderRadius: '5px', cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 700, color: '#fff', fontFamily: S.font,
          }}
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          style={{
            padding: '3px 8px', background: 'transparent',
            border: '1px solid var(--cq-border)',
            borderRadius: '5px', cursor: 'pointer',
            fontSize: '0.72rem', fontWeight: 500, color: S.textMuted, fontFamily: S.font,
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '6px 13px',
        background: dangerous
          ? 'color-mix(in srgb, #dc2626 8%, var(--cq-surface-raised))'
          : S.surfaceRaised,
        border: `1px solid ${dangerous ? 'color-mix(in srgb, #dc2626 25%, var(--cq-border))' : S.border}`,
        borderRadius: '7px',
        fontSize: '0.78rem', fontFamily: S.font, fontWeight: 600,
        color: dangerous ? '#dc2626' : S.text,
        cursor: loading ? 'wait' : 'pointer',
        opacity: loading ? 0.6 : 1, transition: 'opacity 0.12s',
      }}
    >
      {icon}
      {loading ? 'Working…' : label}
    </button>
  )
}

function StatusChangeDropdown({
  selectedCount,
  onChange,
}: {
  selectedCount: number
  onChange: (status: BillStatus) => Promise<void>
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = async (status: BillStatus) => {
    setOpen(false)
    setLoading(true)
    try { await onChange(status) } finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '6px 13px',
          background: S.surfaceRaised,
          border: `1px solid ${S.border}`,
          borderRadius: '7px',
          fontSize: '0.78rem', fontFamily: S.font, fontWeight: 600,
          color: S.text,
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        Change Status
        <ChevronDown size={12} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: S.surfaceRaised,
            border: `1.5px solid ${S.border}`,
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100, padding: '4px', minWidth: '160px',
          }}>
            <div style={{
              padding: '5px 10px 4px',
              fontSize: '0.64rem', fontWeight: 700, color: S.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
              Set {selectedCount} bills to…
            </div>
            {ALL_STATUSES.map(s => {
              const c = STATUS_CONFIG[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleChange(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '8px 10px',
                    background: 'transparent',
                    border: 'none', borderRadius: '5px', cursor: 'pointer',
                    fontFamily: S.font, fontSize: '0.8rem',
                    fontWeight: 500, color: c.color, textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.bg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
