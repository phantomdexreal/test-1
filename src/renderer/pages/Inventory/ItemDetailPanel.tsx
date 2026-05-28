/**
 * cQikly — ItemDetailPanel
 * Phase 9b-A: Side panel showing Price History + Usage History tabs for a selected item.
 */

import { useState, useEffect } from 'react'
import { X, Clock, ShoppingCart } from 'lucide-react'
import {
  inventoryService,
  type InventoryItemFull,
  type PriceChangeEntry,
  type UsageEntry,
} from '../../services/inventory.service'
import PriceHistoryPanel from './PriceHistoryPanel'
import UsageHistoryPanel from './UsageHistoryPanel'
import { eventBus } from '../../utils/eventBus'

const S = {
  font:    '"Inter", system-ui, sans-serif',
  text:    'var(--cq-text-primary)',
  muted:   'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  raised:  'var(--cq-surface-raised)',
  border:  'var(--cq-border)',
  accent:  'var(--cq-accent)',
}

type Tab = 'price' | 'usage'

interface Props {
  item: InventoryItemFull
  onClose: () => void
}

export default function ItemDetailPanel({ item, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('price')
  const [priceHistory, setPriceHistory] = useState<PriceChangeEntry[]>([])
  const [usageHistory, setUsageHistory] = useState<UsageEntry[]>([])

  const reload = () => {
    setPriceHistory(inventoryService.getPriceHistory(item.id))
    setUsageHistory(inventoryService.getUsageHistory(item.id))
  }

  useEffect(() => {
    reload()
    const u1 = eventBus.on('inventoryChanged', reload)
    const u2 = eventBus.on('inventoryUsageChanged', reload)
    return () => { u1(); u2() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  return (
    <div style={{
      width: 520, flexShrink: 0,
      borderLeft: `1.5px solid ${S.border}`,
      display: 'flex', flexDirection: 'column',
      background: S.raised, fontFamily: S.font,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px 10px', borderBottom: `1px solid ${S.border}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: S.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.itemName || '(unnamed item)'}</div>
          <div style={{ fontSize: '0.74rem', color: S.muted, marginTop: 2, display: 'flex', gap: 10 }}>
            {item.barcode && <span>SKU: <strong style={{ color: S.text }}>{item.barcode}</strong></span>}
            {item.price && <span>₹{item.price}</span>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4, borderRadius: 6, flexShrink: 0 }}><X size={15} /></button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, background: S.surface }}>
        {([
          ['price', <Clock size={13} />, 'Price History', priceHistory.length],
          ['usage', <ShoppingCart size={13} />, 'Usage History', usageHistory.length],
        ] as const).map(([t, icon, label, count]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: S.font, fontSize: '0.8rem', fontWeight: tab === t ? 700 : 500,
              color: tab === t ? S.accent : S.muted,
              borderBottom: `2.5px solid ${tab === t ? S.accent : 'transparent'}`,
              transition: 'all 0.13s',
            }}>
            {icon}
            {label}
            {(count as number) > 0 && (
              <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: tab === t ? `${S.accent}33` : S.raised, color: tab === t ? S.accent : S.muted }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'price' && <PriceHistoryPanel history={priceHistory} itemName={item.itemName} />}
        {tab === 'usage' && <UsageHistoryPanel history={usageHistory} itemName={item.itemName} />}
      </div>
    </div>
  )
}
