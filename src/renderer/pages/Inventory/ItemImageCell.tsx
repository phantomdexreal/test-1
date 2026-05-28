/**
 * cQikly — ItemImageCell
 * Phase 9b-B-i: Item image support.
 *
 * Renders inline with the Item Name column:
 *  - If the item has an image: shows a 30×30 thumbnail.
 *  - If no image: renders nothing (zero gap).
 * On row hover:
 *  - If image present: thumbnail + [Change] [Remove] buttons appear.
 *  - If no image: a small [+] "Add image" button appears.
 *
 * This component owns its own async load — it fetches the data URL from
 * the service once on mount (and again whenever imagePath changes).
 *
 * All async image ops go through inventoryService — no direct IPC calls.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, X, RefreshCw } from 'lucide-react'
import { inventoryService } from '../../services/inventory.service'

interface Props {
  itemId: string
  imagePath: string    // item.imagePath — used as the cache key / change signal
  rowHovered: boolean  // parent tells us if the row is hovered
}

const S = {
  accent: 'var(--cq-accent)',
  muted:  'var(--cq-text-muted)',
  text:   'var(--cq-text-primary)',
  border: 'var(--cq-border)',
  font:   '"Inter", system-ui, sans-serif',
}

export default function ItemImageCell({ itemId, imagePath, rowHovered }: Props): React.ReactElement {
  const [dataUrl, setDataUrl]     = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Load / reload image whenever imagePath changes
  useEffect(() => {
    if (!imagePath) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    setLoading(true)
    inventoryService.getItemImageDataUrl(itemId).then(url => {
      if (!cancelled && mountedRef.current) {
        setDataUrl(url)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled && mountedRef.current) {
        setDataUrl(null)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [itemId, imagePath])

  const handlePick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (actionLoading) return
    setActionLoading(true)
    const url = await inventoryService.pickAndSetItemImage(itemId)
    if (mountedRef.current) {
      if (url) setDataUrl(url)
      setActionLoading(false)
    }
  }, [itemId, actionLoading])

  const handleRemove = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (actionLoading) return
    setActionLoading(true)
    await inventoryService.removeItemImage(itemId)
    if (mountedRef.current) {
      setDataUrl(null)
      setActionLoading(false)
    }
  }, [itemId, actionLoading])

  const hasImage = !!dataUrl && !loading

  // ── Layout ──────────────────────────────────────────────────────────────
  // We render a small fixed-width container before the item name text.
  // When the item has no image AND the row is not hovered → render nothing (0px wide).
  // When hovered with no image → render a small add button.
  // When image present → render thumbnail + optional action buttons on hover.

  const showAddButton = !hasImage && rowHovered && !loading
  const showThumb     = hasImage
  const showActions   = hasImage && rowHovered

  if (!showAddButton && !showThumb && !loading) {
    // Nothing to render — zero footprint
    return <></>
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginRight: 5,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Loading spinner */}
      {loading && (
        <span style={{
          display: 'inline-flex', width: 30, height: 30, alignItems: 'center',
          justifyContent: 'center', opacity: 0.45,
        }}>
          <RefreshCw size={11} color={S.muted} style={{ animation: 'spin 1s linear infinite' }} />
        </span>
      )}

      {/* Thumbnail */}
      {showThumb && (
        <span style={{
          display: 'inline-flex', flexShrink: 0,
          width: 30, height: 30,
          borderRadius: 5,
          overflow: 'hidden',
          border: `1px solid ${S.border}`,
          background: '#000',
        }}>
          <img
            src={dataUrl!}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </span>
      )}

      {/* Action buttons — shown on hover */}
      {showActions && (
        <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }}>
          <ActionButton
            onClick={handlePick}
            title="Change image"
            disabled={actionLoading}
            color={S.accent}
          >
            <RefreshCw size={9} />
          </ActionButton>
          <ActionButton
            onClick={handleRemove}
            title="Remove image"
            disabled={actionLoading}
            color="#ef4444"
          >
            <X size={9} />
          </ActionButton>
        </span>
      )}

      {/* Add button — when no image, row hovered */}
      {showAddButton && (
        <ActionButton
          onClick={handlePick}
          title="Add image"
          disabled={actionLoading}
          color={S.muted}
        >
          <ImagePlus size={10} />
        </ActionButton>
      )}
    </span>
  )
}

// ─── ActionButton ─────────────────────────────────────────────────────────────

function ActionButton({ onClick, title, disabled, color, children }: {
  onClick: (e: React.MouseEvent) => void
  title: string
  disabled: boolean
  color: string
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        background: hov ? `${color}22` : 'transparent',
        border: `1px solid ${hov ? color : 'transparent'}`,
        color,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.1s',
        padding: 0,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}
