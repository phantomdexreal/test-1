/**
 * cQikly — InventoryAutocomplete
 * Phase 9b-B-ii-A: Fuzzy autocomplete dropdown for the Item Name cell in inventory mode.
 *
 * Responsibilities:
 *  - Shows a floating suggestion card below the active Item Name cell
 *  - Renders up to 8 fuzzy-matched inventory items with optional image
 *  - Highlights the currently focused suggestion (keyboard navigable from parent)
 *  - Insert key (handled in parent) accepts the highlighted suggestion
 *  - Does NOT interfere with Insert behaviour in Rate cell
 *
 * Props:
 *  - items: matching inventory items to show
 *  - selectedIdx: which item is highlighted (-1 = none)
 *  - anchorEl: the input element to position relative to (Item Name cell input)
 *  - onSelect: callback when a suggestion is chosen (Insert or click)
 *  - imageCache: map of itemId → dataUrl (pre-loaded images)
 */

import React, { useEffect, useRef, useState } from 'react'
import type { InventoryItemFull } from '../../services/inventory.service'

interface InventoryAutocompleteProps {
  items: InventoryItemFull[]
  selectedIdx: number
  anchorEl: HTMLInputElement | null
  onSelect: (item: InventoryItemFull) => void
  imageCache: Record<string, string | null>
}

export default function InventoryAutocomplete({
  items,
  selectedIdx,
  anchorEl,
  onSelect,
  imageCache,
}: InventoryAutocompleteProps): React.ReactElement | null {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Recompute position whenever anchorEl or items change
  useEffect(() => {
    if (!anchorEl || items.length === 0) {
      setPos(null)
      return
    }
    const rect = anchorEl.getBoundingClientRect()
    setPos({
      top:   rect.bottom + 4,
      left:  rect.left,
      width: Math.max(rect.width, 260),
    })
  }, [anchorEl, items.length])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || selectedIdx < 0) return
    const el = listRef.current.children[selectedIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  if (!pos || items.length === 0) return null

  return (
    <div
      ref={listRef}
      style={{
        position:     'fixed',
        top:          pos.top,
        left:         pos.left,
        minWidth:     pos.width,
        maxWidth:     Math.max(pos.width, 320),
        zIndex:       9999,
        background:   'var(--cq-surface-raised)',
        border:       '1.5px solid var(--cq-accent)',
        borderRadius: '10px',
        boxShadow:    '0 8px 32px rgba(0,0,0,0.4)',
        overflow:     'hidden',
        maxHeight:    '320px',
        overflowY:    'auto',
      }}
      // Prevent mouse-click from stealing focus from the input
      onMouseDown={e => e.preventDefault()}
    >
      {/* Header hint */}
      <div style={{
        padding:       '5px 12px',
        fontSize:      '0.62rem',
        fontWeight:    700,
        letterSpacing: '0.07em',
        color:         'var(--cq-accent)',
        opacity:       0.7,
        background:    'color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))',
        borderBottom:  '1px solid var(--cq-border)',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        userSelect:    'none',
      }}>
        <span>INVENTORY MATCH</span>
        <span style={{ fontWeight: 400, opacity: 0.8 }}>↑↓ navigate · Insert to accept</span>
      </div>

      {items.map((item, idx) => {
        const isSelected = idx === selectedIdx
        const imgSrc = imageCache[item.id] ?? null

        return (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            style={{
              display:    'flex',
              alignItems: 'center',
              gap:        '10px',
              padding:    '7px 12px',
              cursor:     'pointer',
              background: isSelected
                ? 'color-mix(in srgb, var(--cq-accent) 18%, var(--cq-surface-raised))'
                : 'transparent',
              borderBottom: idx < items.length - 1 ? '1px solid var(--cq-border)' : 'none',
              transition: 'background 0.1s',
            }}
          >
            {/* Item image or placeholder */}
            <div style={{
              width:        36,
              height:       36,
              borderRadius: '6px',
              overflow:     'hidden',
              flexShrink:   0,
              background:   'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface))',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              border:       isSelected ? '1.5px solid var(--cq-accent)' : '1px solid var(--cq-border)',
            }}>
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={item.itemName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', opacity: 0.5, userSelect: 'none' }}>
                  IMG
                </span>
              )}
            </div>

            {/* Name + price info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize:     '0.83rem',
                fontWeight:   isSelected ? 700 : 500,
                color:        isSelected ? 'var(--cq-accent)' : 'var(--cq-text-primary)',
                whiteSpace:   'nowrap',
                overflow:     'hidden',
                textOverflow: 'ellipsis',
                fontFamily:   '"Inter", system-ui, sans-serif',
              }}>
                {item.itemName}
              </div>
              <div style={{
                fontSize:   '0.7rem',
                color:      'var(--cq-text-muted)',
                marginTop:  '1px',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                display:    'flex',
                gap:        '8px',
              }}>
                {item.price    && <span>₹{item.price}</span>}
                {item.unit     && <span style={{ opacity: 0.6 }}>{item.unit}</span>}
                {item.barcode  && <span style={{ opacity: 0.45 }}>#{item.barcode}</span>}
              </div>
            </div>

            {/* Accept indicator */}
            {isSelected && (
              <div style={{
                flexShrink:    0,
                fontSize:      '0.6rem',
                fontWeight:    700,
                color:         'var(--cq-accent)',
                background:    'color-mix(in srgb, var(--cq-accent) 15%, var(--cq-surface-raised))',
                border:        '1px solid var(--cq-accent)',
                borderRadius:  '4px',
                padding:       '2px 6px',
                whiteSpace:    'nowrap',
                letterSpacing: '0.04em',
              }}>
                Insert ↵
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
