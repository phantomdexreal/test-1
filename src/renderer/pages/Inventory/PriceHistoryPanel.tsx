/**
 * cQikly — PriceHistoryPanel
 * Phase 9b-A: Shows per-item price change log (newest first).
 */

import { TrendingUp, TrendingDown } from 'lucide-react'
import { type PriceChangeEntry } from '../../services/inventory.service'

const S = {
  font:    '"Inter", system-ui, sans-serif',
  text:    'var(--cq-text-primary)',
  muted:   'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  raised:  'var(--cq-surface-raised)',
  border:  'var(--cq-border)',
  accent:  'var(--cq-accent)',
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function PriceDelta({ oldVal, newVal }: { oldVal: string; newVal: string }) {
  const o = parseFloat(oldVal)
  const n = parseFloat(newVal)
  if (!Number.isFinite(o) || !Number.isFinite(n)) return null
  const diff = n - o
  const pct = o !== 0 ? ((diff / Math.abs(o)) * 100).toFixed(1) : null
  if (diff === 0) return <span style={{ color: S.muted, fontSize: '0.72rem' }}>— no change</span>
  const up = diff > 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: up ? '#4ade80' : '#f87171', fontWeight: 700 }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? '+' : ''}{diff.toFixed(2)}{pct !== null ? ` (${up ? '+' : ''}${pct}%)` : ''}
    </span>
  )
}

interface Props {
  history: PriceChangeEntry[]
  itemName: string
}

export default function PriceHistoryPanel({ history, itemName }: Props) {
  if (history.length === 0) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: S.muted, fontFamily: S.font }}>
        <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>📊</div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>No price changes recorded yet</div>
        <div style={{ fontSize: '0.77rem', marginTop: 5 }}>Changes to Price, Wholesale, GST Price, and Credit fields appear here.</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: S.font, overflowY: 'auto', maxHeight: '100%' }}>
      <div style={{ padding: '10px 16px 6px', fontSize: '0.72rem', color: S.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {history.length} change{history.length !== 1 ? 's' : ''} — {itemName}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: S.raised }}>
            {['Date / Time', 'Field', 'Old Value', 'New Value', 'Change'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: S.muted, fontWeight: 600, fontSize: '0.69rem', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `1.5px solid var(--cq-border)`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((entry, i) => (
            <tr key={entry.id} style={{ background: i % 2 === 0 ? 'transparent' : `${S.surface}55`, transition: 'background 0.1s' }}>
              <td style={{ padding: '7px 12px', color: S.muted, fontSize: '0.77rem', borderBottom: `1px solid var(--cq-border)`, whiteSpace: 'nowrap' }}>{fmtDate(entry.changedAt)}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid var(--cq-border)`, fontWeight: 600 }}>{entry.fieldLabel}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid var(--cq-border)`, color: '#f87171' }}>{entry.oldValue || <span style={{ color: S.muted }}>—</span>}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid var(--cq-border)`, color: '#4ade80', fontWeight: 700 }}>{entry.newValue || <span style={{ color: S.muted }}>—</span>}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid var(--cq-border)` }}><PriceDelta oldVal={entry.oldValue} newVal={entry.newValue} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
