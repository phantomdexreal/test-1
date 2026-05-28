/**
 * cQikly — ShortcutReferencePanel
 * Built in: Phase 12a
 *
 * Floating overlay listing all active keyboard shortcuts.
 * Toggle via Ctrl+/ or the eventBus 'openShortcutPanel' event.
 * Close via Ctrl+/ again, Escape, or clicking the backdrop.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { eventBus } from '../utils/eventBus'

// ─── Shortcut data ─────────────────────────────────────────────────────────────

interface ShortcutEntry {
  shortcut: string
  action: string
}

interface ShortcutGroup {
  group: string
  entries: ShortcutEntry[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: 'Navigation',
    entries: [
      { shortcut: 'Ctrl+1', action: 'New Quote' },
      { shortcut: 'Ctrl+2', action: 'History' },
      { shortcut: 'Ctrl+3', action: 'Customer Details' },
      { shortcut: 'Ctrl+4', action: 'Inventory' },
      { shortcut: 'Ctrl+5', action: 'Loose Inventory History' },
      { shortcut: 'Ctrl+6', action: 'Settings' },
      { shortcut: 'Ctrl+H', action: 'Open History' },
      { shortcut: 'Ctrl+,', action: 'Open Settings' },
    ],
  },
  {
    group: 'Billing Grid',
    entries: [
      { shortcut: 'Alt+1', action: 'Switch to Free Format' },
      { shortcut: 'Alt+2', action: 'Switch to GST Format' },
      { shortcut: 'Ctrl+Z', action: 'Undo (grid-level)' },
      { shortcut: 'Ctrl+Y', action: 'Redo (grid-level)' },
      { shortcut: 'F2', action: 'Enter edit mode in cell (when F2 lock is on)' },
      { shortcut: 'Insert', action: 'Accept inventory autocomplete (Item Name cell) or rate hint (Rate cell)' },
      { shortcut: 'Enter / ↓ (last row)', action: 'Add new row' },
    ],
  },
  {
    group: 'Bill Actions',
    entries: [
      { shortcut: 'Ctrl+S', action: 'Save bill' },
      { shortcut: 'Ctrl+P', action: 'Save PDF' },
      { shortcut: 'Ctrl+Shift+C', action: 'Copy bill as image (Professional format)' },
      { shortcut: 'Ctrl+Shift+X', action: 'Copy simplified image' },
      { shortcut: 'Ctrl+Shift+P', action: 'Quick print' },
      { shortcut: 'Ctrl+D', action: 'Duplicate current bill' },
    ],
  },
  {
    group: 'Toolbar',
    entries: [
      { shortcut: 'Ctrl+B', action: 'Bold + Text Color (quick apply)' },
      { shortcut: 'Ctrl+Shift+H', action: 'Show / hide toolbar' },
      { shortcut: 'Ctrl+E', action: 'Excel export' },
      { shortcut: 'Ctrl+Shift+T', action: 'Bill templates' },
      { shortcut: 'Ctrl+Shift+R', action: 'Internal remarks' },
    ],
  },
  {
    group: 'Global Tools',
    entries: [
      { shortcut: 'Alt+N', action: 'Open / close calculator' },
      { shortcut: 'Alt+S', action: 'Open / close scratchpad / sticky notes' },
      { shortcut: 'Ctrl+K', action: 'Global command palette (search everything)' },
      { shortcut: 'Ctrl+/', action: 'This shortcut reference panel' },
    ],
  },
  {
    group: 'General',
    entries: [
      { shortcut: 'Escape', action: 'Back / close modal or overlay' },
    ],
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

export function ShortcutReferencePanel(): React.ReactElement | null {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen(v => !v), [])
  const close  = useCallback(() => setOpen(false), [])

  // Subscribe to event bus
  useEffect(() => {
    return eventBus.on('openShortcutPanel', toggle)
  }, [toggle])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') { e.preventDefault(); close() }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, close])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcut Reference"
      onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        background: 'rgba(0,0,0,0.50)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <div style={{
        background: 'var(--cq-surface-raised)',
        border: '1px solid var(--cq-border)',
        borderRadius: '16px',
        padding: '0',
        width: 'min(680px, 92vw)',
        maxHeight: '82vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        animation: 'shortcutPanelIn 0.18s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 16px',
          borderBottom: '1px solid var(--cq-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.15rem' }}>⌨️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--cq-text-primary)' }}>
                Keyboard Shortcuts
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)', marginTop: '1px' }}>
                All active shortcuts in cQikly
              </div>
            </div>
          </div>
          <button
            onClick={close}
            title="Close (Escape or Ctrl+/)"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--cq-text-muted)', fontSize: '1.1rem',
              padding: '4px 6px', borderRadius: '6px',
              lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {SHORTCUT_GROUPS.map(grp => (
            <div key={grp.group}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--cq-accent)',
                marginBottom: '8px',
              }}>
                {grp.group}
              </div>
              <div style={{
                background: 'var(--cq-surface)',
                border: '1px solid var(--cq-border)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}>
                {grp.entries.map((entry, idx) => (
                  <div
                    key={entry.shortcut}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '12px',
                      padding: '9px 14px',
                      borderBottom: idx < grp.entries.length - 1 ? '1px solid var(--cq-border)' : 'none',
                    }}
                  >
                    <span style={{
                      fontSize: '0.78rem', color: 'var(--cq-text-muted)',
                      flex: 1, lineHeight: 1.4,
                    }}>
                      {entry.action}
                    </span>
                    <kbd style={{
                      display: 'inline-block',
                      background: 'var(--cq-surface-raised)',
                      border: '1px solid var(--cq-border)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      fontFamily: '"JetBrains Mono", "Consolas", monospace',
                      fontWeight: 600,
                      color: 'var(--cq-text-primary)',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 0 var(--cq-border)',
                      flexShrink: 0,
                    }}>
                      {entry.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 24px',
          borderTop: '1px solid var(--cq-border)',
          fontSize: '0.68rem', color: 'var(--cq-text-muted)',
          textAlign: 'right', flexShrink: 0,
        }}>
          Press <strong>Ctrl+/</strong> or <strong>Escape</strong> to close
        </div>
      </div>

      <style>{`
        @keyframes shortcutPanelIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
