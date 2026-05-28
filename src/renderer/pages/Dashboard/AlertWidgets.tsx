/**
 * cQikly — Alert Widgets
 * Phase: 3a-B
 *
 * Two widgets:
 *
 * PendingDraftIndicator
 *   - Checks crash recovery system for an unsaved bill draft
 *   - Reads via window.cqikly.crashRecovery.hasDraft() IPC
 *   - Hidden if no draft present (widget disappears when nothing to show)
 *   - Button opens restore flow (navigates to New Quote) — stub for Phase 5+
 *   - Respects widgetVisibility.pendingDraftIndicator
 *
 * LowStockAlertWidget
 *   - Reads inventory_items where stock_qty < min_stock
 *   - Shows item count + first few item names
 *   - Hidden when no low-stock items (green is silent)
 *   - Expandable list on hover/click
 *   - Respects widgetVisibility.lowStockAlert
 *
 * Design: alert-style cards with attention-grabbing but not garish styling.
 * Both degrade gracefully in browser/dev mode with no IPC.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { hasPendingDraft, getLowStockItems, type LowStockItem } from '../../services/dashboard.service'
import { eventBus } from '../../utils/eventBus'

// ─── Pending Draft Indicator ───────────────────────────────────────────────────

export function PendingDraftIndicator(): React.ReactElement | null {
  const { config } = useConfig()
  const [hasDraft, setHasDraft] = useState<boolean>(false)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    const result = await hasPendingDraft()
    setHasDraft(result)
    if (result) setDismissed(false) // re-show if a new draft appears
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000) // check every 30s
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.pendingDraftIndicator === false) return null
  if (!hasDraft || dismissed) return null

  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1.5px solid rgba(245, 158, 11, 0.4)',
      borderRadius: '1rem',
      padding: '1.2rem 1.5rem',
      minWidth: 260,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.85rem',
      position: 'relative',
    }}>
      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        title="Dismiss"
        style={{
          position: 'absolute', top: '0.65rem', right: '0.75rem',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'rgba(245, 158, 11, 0.5)', fontSize: '1rem', lineHeight: 1,
          padding: '0.1rem 0.3rem',
        }}
        aria-label="Dismiss draft indicator"
      >
        ×
      </button>

      {/* Animated pulse dot */}
      <div style={{ position: 'relative', flexShrink: 0, marginTop: '0.1rem' }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#f59e0b',
          boxShadow: '0 0 0 0 rgba(245,158,11,0.6)',
          animation: 'cq-pulse 2s infinite',
        }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: '1.5rem' }}>
        <div style={{
          fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b',
          marginBottom: '0.25rem',
        }}>
          Unsaved Bill Draft
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(245,158,11,0.7)', lineHeight: 1.5, marginBottom: '0.6rem' }}>
          You have a draft bill that wasn't saved. Restore it to continue where you left off.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => {
              // TODO: [DRAFT-RESTORE] — Phase 5+ wires this to navigate to New Quote with draft loaded
              // For now, the CrashRecoveryPrompt handles this flow on launch
              console.info('[Dashboard] Restore draft clicked — handled by CrashRecoveryPrompt on next navigation')
            }}
            style={{
              fontSize: '0.75rem', fontWeight: 700,
              background: 'rgba(245,158,11,0.15)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: '0.5rem',
              padding: '0.3rem 0.75rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            Restore Draft
          </button>
          <button
            type="button"
            onClick={async () => {
              const ipc = (window as Window & { cqikly?: Window['cqikly'] }).cqikly
              if (ipc) {
                try { await ipc.crashRecovery.clearDraft() } catch { /* ignore */ }
              }
              setHasDraft(false)
              setDismissed(true)
            }}
            style={{
              fontSize: '0.75rem', fontWeight: 600,
              background: 'transparent',
              color: 'rgba(245,158,11,0.5)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: '0.5rem',
              padding: '0.3rem 0.75rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            Discard
          </button>
        </div>
      </div>

      {/* Pulse animation injected as a style tag once */}
      <style>{`
        @keyframes cq-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(245,158,11,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
      `}</style>
    </div>
  )
}

// ─── Low Stock Alert ───────────────────────────────────────────────────────────

export function LowStockAlertWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [items, setItems] = useState<LowStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getLowStockItems()
    setItems(result)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 120_000) // refresh every 2 min
    // Also refresh immediately whenever inventory changes (stock deductions, manual edits)
    const unsub = eventBus.on('inventoryChanged', load)
    return () => { clearInterval(t); unsub() }
  }, [load])

  if (config.widgetVisibility?.lowStockAlert === false) return null
  // Hide widget entirely when no low-stock items and not loading
  if (!loading && items.length === 0) return null

  const PREVIEW_COUNT = 3
  const previewItems = items.slice(0, PREVIEW_COUNT)
  const hiddenCount = items.length - PREVIEW_COUNT

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.06)',
      border: '1.5px solid rgba(239, 68, 68, 0.35)',
      borderRadius: '1rem',
      padding: '1.2rem 1.5rem',
      minWidth: 260,
      maxWidth: 380,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>⚠️</span>
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: '#f87171',
        }}>
          Low Stock
        </span>
        {!loading && (
          <span style={{
            marginLeft: 'auto',
            background: 'rgba(239,68,68,0.15)',
            color: '#f87171',
            fontSize: '0.7rem', fontWeight: 700,
            padding: '0.1rem 0.5rem',
            borderRadius: '1rem',
            border: '1px solid rgba(239,68,68,0.3)',
          }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Item list */}
      {loading ? (
        <div style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)' }}>Checking inventory…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {(expanded ? items : previewItems).map(item => (
            <div key={item.itemName} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.5rem',
              padding: '0.35rem 0.6rem',
              background: 'rgba(239,68,68,0.06)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              <span style={{
                fontSize: '0.78rem', color: 'var(--cq-text-primary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                flex: 1, minWidth: 0,
              }}>
                {item.itemName}
              </span>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, color: '#f87171',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {item.stockQty} / {item.minStock}
              </span>
            </div>
          ))}

          {/* Expand / collapse */}
          {hiddenCount > 0 && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', color: '#f87171', textAlign: 'left',
                padding: '0.2rem 0', fontWeight: 600,
              }}
            >
              + {hiddenCount} more item{hiddenCount !== 1 ? 's' : ''}…
            </button>
          )}
          {expanded && items.length > PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '0.72rem', color: 'var(--cq-text-muted)', textAlign: 'left',
                padding: '0.2rem 0', fontWeight: 600,
              }}
            >
              Show less
            </button>
          )}
        </div>
      )}

      {/* Hint */}
      {!loading && items.length > 0 && (
        <div style={{ fontSize: '0.65rem', color: 'rgba(248,113,113,0.5)' }}>
          Go to Inventory to restock these items.
        </div>
      )}
    </div>
  )
}
