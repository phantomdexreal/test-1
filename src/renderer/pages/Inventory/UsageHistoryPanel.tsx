/**
 * cQikly — UsageHistoryPanel
 * Phase 9b-A: Shows per-item product usage — which party bought it, when, at what price.
 */

import { useMemo } from 'react'
import { type UsageEntry } from '../../services/inventory.service'

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
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function num(s: string): number { return parseFloat(s) || 0 }

interface Props {
  history: UsageEntry[]
  itemName: string
}

export default function UsageHistoryPanel({ history, itemName: _itemName }: Props) {
  // Analytics
  const analytics = useMemo(() => {
    if (!history.length) return null
    const totalQty = history.reduce((s, e) => s + num(e.qty), 0)
    const totalAmount = history.reduce((s, e) => s + num(e.amount), 0)
    const partyMap: Record<string, { count: number; qty: number; amount: number }> = {}
    for (const e of history) {
      if (!partyMap[e.partyName]) partyMap[e.partyName] = { count: 0, qty: 0, amount: 0 }
      partyMap[e.partyName].count++
      partyMap[e.partyName].qty += num(e.qty)
      partyMap[e.partyName].amount += num(e.amount)
    }
    const topParties = Object.entries(partyMap)
      .sort((a, b) => b[1].amount - a[1].amount)
      .slice(0, 5)
    const avgRate = history.length > 0
      ? history.reduce((s, e) => s + num(e.rate), 0) / history.length
      : 0
    return { totalQty, totalAmount, topParties, avgRate, billCount: history.length }
  }, [history])

  if (history.length === 0) {
    return (
      <div style={{ padding: '32px 20px', textAlign: 'center', color: S.muted, fontFamily: S.font }}>
        <div style={{ fontSize: '1.6rem', marginBottom: 10 }}>🛒</div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>No usage recorded yet</div>
        <div style={{ fontSize: '0.77rem', marginTop: 5 }}>Usage is recorded automatically when this item appears in a saved bill.</div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: S.font, overflowY: 'auto', maxHeight: '100%' }}>
      {/* Analytics strip */}
      {analytics && (
        <div style={{ display: 'flex', gap: 0, borderBottom: `1.5px solid ${S.border}`, background: S.raised }}>
          {[
            { label: 'Total Bills', value: analytics.billCount },
            { label: 'Total Qty', value: analytics.totalQty.toFixed(2) },
            { label: 'Total Revenue', value: `₹${analytics.totalAmount.toFixed(2)}` },
            { label: 'Avg Rate', value: `₹${analytics.avgRate.toFixed(2)}` },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, padding: '10px 16px', borderRight: `1px solid ${S.border}` }}>
              <div style={{ fontSize: '0.68rem', color: S.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{stat.label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: S.text }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Top parties */}
      {analytics && analytics.topParties.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.border}` }}>
          <div style={{ fontSize: '0.69rem', color: S.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Top Buyers</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {analytics.topParties.map(([party, data]) => (
              <div key={party} style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${S.accent}18`, border: `1px solid ${S.accent}33`, borderRadius: 8, padding: '4px 10px', fontSize: '0.78rem' }}>
                <span style={{ fontWeight: 700, color: S.accent }}>{party}</span>
                <span style={{ color: S.muted }}>{data.count} bill{data.count !== 1 ? 's' : ''}</span>
                <span style={{ color: S.text, fontWeight: 600 }}>₹{data.amount.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 16px 4px', fontSize: '0.72rem', color: S.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {history.length} transaction{history.length !== 1 ? 's' : ''}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: S.raised }}>
            {['Date', 'Party / Customer', 'Bill #', 'Qty', 'Rate', 'Amount'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: S.muted, fontWeight: 600, fontSize: '0.69rem', letterSpacing: '0.05em', textTransform: 'uppercase', borderBottom: `1.5px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((entry, i) => (
            <tr key={entry.id} style={{ background: i % 2 === 0 ? 'transparent' : `${S.surface}55` }}>
              <td style={{ padding: '7px 12px', color: S.muted, fontSize: '0.77rem', borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{fmtDate(entry.billDate)}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}`, fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.partyName || <span style={{ color: S.muted }}>—</span>}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}`, color: S.accent, fontWeight: 700, whiteSpace: 'nowrap' }}>{entry.billNumber}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}`, fontWeight: 600 }}>{entry.qty}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}` }}>₹{entry.rate}</td>
              <td style={{ padding: '7px 12px', borderBottom: `1px solid ${S.border}`, fontWeight: 700 }}>₹{entry.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
