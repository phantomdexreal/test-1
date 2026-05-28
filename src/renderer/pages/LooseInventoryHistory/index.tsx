/**
 * cQikly — Loose Inventory History Page
 * Phase 10 — Full Build
 *
 * Two tabs:
 *   1. History  — flat list of every loose-item row across all bills; filterable
 *   2. Analytics — per-item aggregation with price timeline, party breakdown, totals
 *
 * "Loose" = item in a bill that does NOT exist in the Inventory page.
 * Fully derived from the bills store; no separate persistence.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getAllLooseEntries,
  getLooseItemAnalytics,
  getLoosePartyNames,
  applyFilters,
  applyAnalyticsFilters,
  formatINR,
  DEFAULT_FILTERS,
  type LooseEntry,
  type LooseItemAnalytics,
  type LooseHistoryFilters,
} from '../../services/looseInventory.service'
import { eventBus } from '../../utils/eventBus'

// ─── Tiny UI helpers ──────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
}

function fmtDate(s: string) {
  if (!s) return '—'
  try {
    return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return s }
}

function StatusBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: color + '22', color }}
    >
      {children}
    </span>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: LooseHistoryFilters
  onChange: (f: LooseHistoryFilters) => void
  parties: string[]
  resultCount: number
}

function FilterBar({ filters, onChange, parties, resultCount }: FilterBarProps) {
  function set(key: keyof LooseHistoryFilters, value: string) {
    onChange({ ...filters, [key]: value })
  }

  const hasActive =
    filters.searchText || filters.partyName || filters.dateFrom ||
    filters.dateTo || filters.minAmount || filters.maxAmount

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>

      {/* Search */}
      <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Item Name</label>
        <input
          className="px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2"
          style={{
            background: 'var(--color-bg)', borderColor: 'var(--color-border)',
            color: 'var(--color-text)', '--tw-ring-color': 'var(--color-accent)',
          } as React.CSSProperties}
          placeholder="Search item…"
          value={filters.searchText}
          onChange={e => set('searchText', e.target.value)}
        />
      </div>

      {/* Party */}
      <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Party</label>
        <select
          className="px-3 py-2 rounded-lg text-sm border focus:outline-none"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={filters.partyName}
          onChange={e => set('partyName', e.target.value)}
        >
          <option value="">All parties</option>
          {parties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>From Date</label>
        <input
          type="date"
          className="px-3 py-2 rounded-lg text-sm border focus:outline-none"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={filters.dateFrom}
          onChange={e => set('dateFrom', e.target.value)}
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>To Date</label>
        <input
          type="date"
          className="px-3 py-2 rounded-lg text-sm border focus:outline-none"
          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          value={filters.dateTo}
          onChange={e => set('dateTo', e.target.value)}
        />
      </div>

      {/* Min / Max amount */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>Amount ₹</label>
        <div className="flex gap-1">
          <input
            className="w-24 px-2 py-2 rounded-lg text-sm border focus:outline-none"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            placeholder="Min"
            value={filters.minAmount}
            onChange={e => set('minAmount', e.target.value)}
          />
          <input
            className="w-24 px-2 py-2 rounded-lg text-sm border focus:outline-none"
            style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            placeholder="Max"
            value={filters.maxAmount}
            onChange={e => set('maxAmount', e.target.value)}
          />
        </div>
      </div>

      {/* Clear + count */}
      <div className="flex items-end gap-2">
        {hasActive && (
          <button
            className="px-3 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-accent)', color: '#fff' }}
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
          >
            Clear
          </button>
        )}
        <span className="text-xs pb-2.5 whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>
          {resultCount} result{resultCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

interface HistoryTabProps {
  entries: LooseEntry[]
  onSelectItem: (itemKey: string) => void
}

function HistoryTab({ entries, onSelectItem }: HistoryTabProps) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-5xl">📋</span>
        <p className="text-lg font-medium" style={{ color: 'var(--color-muted)' }}>
          No loose items found
        </p>
        <p className="text-sm text-center max-w-sm" style={{ color: 'var(--color-muted)' }}>
          Items that appear in your bills but are not in your Inventory will show up here automatically.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--color-surface-2, var(--color-surface))' }}>
            {['Date', 'Item Name', 'Party', 'Qty', 'Rate (₹)', 'Amount (₹)', 'Bill No', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide"
                style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.billId}-${e.itemKey}-${i}`}
              className="transition-colors hover:opacity-90"
              style={{
                borderBottom: '1px solid var(--color-border)',
                background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)',
              }}>
              <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>
                {fmtDate(e.billDate)}
              </td>
              <td className="px-4 py-3 font-medium max-w-[200px]" style={{ color: 'var(--color-text)' }}>
                <button
                  className="text-left hover:underline"
                  style={{ color: 'var(--color-accent)' }}
                  onClick={() => onSelectItem(e.itemKey)}
                >
                  {e.itemName}
                </button>
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                {e.partyName}
              </td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text)' }}>
                {e.qty}{e.qtyUnit ? ` ${e.qtyUnit}` : ''}
              </td>
              <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text)' }}>
                {e.rate ? fmt(parseFloat(e.rate) || 0) : '—'}
              </td>
              <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatINR(e.amount)}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>
                <span className="font-mono text-xs px-2 py-0.5 rounded"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  {e.billNumber}
                </span>
              </td>
              <td className="px-4 py-3">
                <button
                  className="text-xs px-2 py-1 rounded-md transition-opacity hover:opacity-80"
                  style={{ background: 'var(--color-accent)22', color: 'var(--color-accent)' }}
                  onClick={() => onSelectItem(e.itemKey)}
                >
                  Analytics →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Analytics tab — item card ────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl border"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-muted)' }}>{label}</span>
      <span className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{sub}</span>}
    </div>
  )
}

interface ItemAnalyticsCardProps {
  analytics: LooseItemAnalytics
  filters: LooseHistoryFilters
  onBack: () => void
}

function ItemAnalyticsCard({ analytics: a, filters, onBack }: ItemAnalyticsCardProps) {
  const [partyFilter, setPartyFilter] = useState<string>(filters.partyName)

  const visibleEntries = useMemo(() => {
    return a.entries.filter(e => {
      if (partyFilter && e.partyName !== partyFilter) return false
      if (filters.dateFrom && e.billDate < filters.dateFrom) return false
      if (filters.dateTo && e.billDate > filters.dateTo) return false
      return true
    }).sort((x, y) => y.billDate.localeCompare(x.billDate))
  }, [a.entries, partyFilter, filters.dateFrom, filters.dateTo])

  const filteredTotal = visibleEntries.reduce((s, e) => s + e.amount, 0)
  const filteredQty = visibleEntries.reduce((s, e) => s + (parseFloat(e.qty) || 0), 0)
  const visibleRates = visibleEntries.map(e => parseFloat(e.rate)).filter(Number.isFinite)
  const filteredAvgRate = visibleRates.length
    ? visibleRates.reduce((s, r) => s + r, 0) / visibleRates.length : 0

  // Party breakdown for this item
  const partyBreakdown = useMemo(() => {
    const byParty = new Map<string, { count: number; total: number; lastDate: string }>()
    for (const e of a.entries) {
      const p = byParty.get(e.partyName) ?? { count: 0, total: 0, lastDate: '' }
      p.count++
      p.total += e.amount
      if (!p.lastDate || e.billDate > p.lastDate) p.lastDate = e.billDate
      byParty.set(e.partyName, p)
    }
    return [...byParty.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((x, y) => y.total - x.total)
  }, [a.entries])

  // Price timeline (condensed)
  const timeline = useMemo(() =>
    [...a.priceTimeline]
      .filter(pt => !partyFilter || pt.partyName === partyFilter)
      .sort((x, y) => y.date.localeCompare(x.date))
      .slice(0, 20),
    [a.priceTimeline, partyFilter]
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          className="mt-1 text-sm px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-surface)', color: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
          onClick={onBack}
        >
          ← Back
        </button>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{a.itemName}</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            First seen {fmtDate(a.firstSeen)} · Last seen {fmtDate(a.lastSeen)}
          </p>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Total Occurrences" value={String(a.totalOccurrences)} sub="bill rows" />
        <StatCard label="Total Amount" value={formatINR(a.totalAmount)} />
        <StatCard label="Total Qty" value={fmt(a.totalQty, 2)} />
        <StatCard
          label="Rate Range"
          value={a.minRate === a.maxRate ? formatINR(a.minRate) : `${formatINR(a.minRate)} – ${formatINR(a.maxRate)}`}
          sub={`avg ${formatINR(a.avgRate)}`}
        />
        <StatCard label="Unique Parties" value={String(a.parties.length)} />
      </div>

      {/* Party filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          className="px-3 py-1 rounded-full text-xs font-medium transition-all"
          style={{
            background: !partyFilter ? 'var(--color-accent)' : 'var(--color-surface)',
            color: !partyFilter ? '#fff' : 'var(--color-muted)',
            border: '1px solid var(--color-border)',
          }}
          onClick={() => setPartyFilter('')}
        >
          All parties
        </button>
        {a.parties.map(p => (
          <button
            key={p}
            className="px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: partyFilter === p ? 'var(--color-accent)' : 'var(--color-surface)',
              color: partyFilter === p ? '#fff' : 'var(--color-text)',
              border: '1px solid var(--color-border)',
            }}
            onClick={() => setPartyFilter(partyFilter === p ? '' : p)}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Filtered stats row */}
      {partyFilter && (
        <div className="flex gap-4 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'var(--color-accent)11', border: '1px solid var(--color-accent)44' }}>
          <span style={{ color: 'var(--color-accent)' }}>Filtered: {partyFilter}</span>
          <span style={{ color: 'var(--color-muted)' }}>
            {visibleEntries.length} entries · {formatINR(filteredTotal)} total ·
            avg rate {formatINR(filteredAvgRate)} · {fmt(filteredQty, 2)} qty
          </span>
        </div>
      )}

      {/* Two-column: party breakdown + price timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Party breakdown */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-4 py-3 font-semibold text-sm border-b"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            Party Breakdown
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface)' }}>
                  {['Party', 'Orders', 'Total', 'Last Used'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partyBreakdown.map((pb, i) => (
                  <tr key={pb.name}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: partyFilter === pb.name
                        ? 'var(--color-accent)11'
                        : i % 2 === 0 ? 'transparent' : 'var(--color-surface)',
                    }}
                    onClick={() => setPartyFilter(partyFilter === pb.name ? '' : pb.name)}
                  >
                    <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text)' }}>{pb.name}</td>
                    <td className="px-4 py-2 text-center" style={{ color: 'var(--color-muted)' }}>{pb.count}</td>
                    <td className="px-4 py-2 font-semibold" style={{ color: 'var(--color-text)' }}>{formatINR(pb.total)}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--color-muted)' }}>{fmtDate(pb.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Price timeline */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-4 py-3 font-semibold text-sm border-b"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            Price History {partyFilter ? `— ${partyFilter}` : '(all parties)'}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
            {timeline.length === 0 ? (
              <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
                No price data for the selected filter
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--color-surface)' }}>
                    {['Date', 'Party', 'Rate (₹)', 'Bill No'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((pt, i) => {
                    const rate = parseFloat(pt.rate) || 0
                    const prev = timeline[i + 1]
                    const prevRate = prev ? (parseFloat(prev.rate) || 0) : null
                    const diff = prevRate !== null ? rate - prevRate : 0
                    return (
                      <tr key={`${pt.date}-${pt.billNumber}`}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)',
                        }}>
                        <td className="px-4 py-2 whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>
                          {fmtDate(pt.date)}
                        </td>
                        <td className="px-4 py-2" style={{ color: 'var(--color-text)' }}>{pt.partyName}</td>
                        <td className="px-4 py-2 font-semibold" style={{ color: 'var(--color-text)' }}>
                          {formatINR(rate)}
                          {diff !== 0 && (
                            <span className="ml-1 text-xs" style={{ color: diff > 0 ? '#22c55e' : '#ef4444' }}>
                              {diff > 0 ? '▲' : '▼'} {formatINR(Math.abs(diff))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                            {pt.billNumber}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* All occurrences for this item */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <div className="px-4 py-3 font-semibold text-sm border-b flex items-center justify-between"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
          <span>All Bill Entries{partyFilter ? ` — ${partyFilter}` : ''}</span>
          <span className="text-xs font-normal" style={{ color: 'var(--color-muted)' }}>
            {visibleEntries.length} entries · {formatINR(filteredTotal)} total
          </span>
        </div>
        <div className="overflow-x-auto">
          {visibleEntries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--color-muted)' }}>
              No entries match the current filter
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--color-surface-2, var(--color-surface))' }}>
                  {['Date', 'Party', 'Qty', 'Rate (₹)', 'Amount (₹)', 'Bill No', 'Format'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEntries.map((e, i) => (
                  <tr key={`${e.billId}-${i}`}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--color-surface)',
                    }}>
                    <td className="px-4 py-2 whitespace-nowrap" style={{ color: 'var(--color-muted)' }}>{fmtDate(e.billDate)}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--color-text)' }}>{e.partyName}</td>
                    <td className="px-4 py-2 text-right" style={{ color: 'var(--color-text)' }}>
                      {e.qty}{e.qtyUnit ? ` ${e.qtyUnit}` : ''}
                    </td>
                    <td className="px-4 py-2 text-right" style={{ color: 'var(--color-text)' }}>
                      {e.rate ? formatINR(parseFloat(e.rate) || 0) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold" style={{ color: 'var(--color-text)' }}>
                      {formatINR(e.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                        {e.billNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge color={e.format === 'gst' ? '#a78bfa' : '#60a5fa'}>
                        {e.format === 'gst' ? 'GST' : 'Free'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Analytics tab — list view ────────────────────────────────────────────────

interface AnalyticsTabProps {
  analytics: LooseItemAnalytics[]
  onSelect: (itemKey: string) => void
  selectedItemKey: string | null
}

function AnalyticsTab({ analytics, onSelect }: AnalyticsTabProps) {
  if (analytics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-5xl">📊</span>
        <p className="text-lg font-medium" style={{ color: 'var(--color-muted)' }}>
          No loose item analytics yet
        </p>
        <p className="text-sm text-center max-w-sm" style={{ color: 'var(--color-muted)' }}>
          Create bills with items that aren't in your inventory and they'll appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {analytics.map(a => {
        const rateRange = a.minRate === a.maxRate
          ? formatINR(a.minRate)
          : `${formatINR(a.minRate)} – ${formatINR(a.maxRate)}`
        return (
          <button
            key={a.itemKey}
            className="text-left p-5 rounded-xl border transition-all hover:opacity-90 hover:shadow-md flex flex-col gap-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            onClick={() => onSelect(a.itemKey)}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base leading-tight" style={{ color: 'var(--color-text)' }}>
                {a.itemName}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0"
                style={{ background: 'var(--color-accent)22', color: 'var(--color-accent)' }}>
                {a.totalOccurrences}×
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span style={{ color: 'var(--color-muted)' }}>Total</span>
              <span className="font-semibold text-right" style={{ color: 'var(--color-text)' }}>
                {formatINR(a.totalAmount)}
              </span>
              <span style={{ color: 'var(--color-muted)' }}>Rate range</span>
              <span className="text-right" style={{ color: 'var(--color-text)' }}>{rateRange}</span>
              <span style={{ color: 'var(--color-muted)' }}>Avg rate</span>
              <span className="text-right" style={{ color: 'var(--color-text)' }}>{formatINR(a.avgRate)}</span>
              <span style={{ color: 'var(--color-muted)' }}>Parties</span>
              <span className="text-right" style={{ color: 'var(--color-text)' }}>{a.parties.length}</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {a.parties.slice(0, 3).map(p => (
                <span key={p} className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                  {p}
                </span>
              ))}
              {a.parties.length > 3 && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                  +{a.parties.length - 3} more
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-muted)' }}>
              <span>{fmtDate(a.firstSeen)} → {fmtDate(a.lastSeen)}</span>
              <span style={{ color: 'var(--color-accent)' }}>View analytics →</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type TabId = 'history' | 'analytics'

export default function LooseInventoryHistoryPage(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<TabId>('history')
  const [filters, setFilters] = useState<LooseHistoryFilters>(DEFAULT_FILTERS)
  const [parties, setParties] = useState<string[]>([])

  const [allEntries, setAllEntries] = useState<LooseEntry[]>([])
  const [allAnalytics, setAllAnalytics] = useState<LooseItemAnalytics[]>([])
  const [loading, setLoading] = useState(true)

  // Selected item for analytics detail view (null = list view)
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [entries, analytics, partyNames] = await Promise.all([
        getAllLooseEntries(),
        getLooseItemAnalytics(),
        getLoosePartyNames(),
      ])
      setAllEntries(entries)
      setAllAnalytics(analytics)
      setParties(partyNames)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // Re-derive when bills or inventory change
    const unsub1 = eventBus.on('billSaved', () => void load())
    const unsub2 = eventBus.on('billUpdated', () => void load())
    const unsub3 = eventBus.on('billDeleted', () => void load())
    const unsub4 = eventBus.on('inventoryChanged', () => void load())
    return () => { unsub1(); unsub2(); unsub3(); unsub4() }
  }, [load])

  // Derived filtered data
  const filteredEntries = useMemo(
    () => applyFilters(allEntries, filters),
    [allEntries, filters]
  )
  const filteredAnalytics = useMemo(
    () => applyAnalyticsFilters(allAnalytics, filters),
    [allAnalytics, filters]
  )

  // When item is selected in history tab, switch to analytics tab and drill in
  function handleSelectItem(itemKey: string) {
    setSelectedItemKey(itemKey)
    setActiveTab('analytics')
  }

  function handleAnalyticsBack() {
    setSelectedItemKey(null)
  }

  // The selected analytics object
  const selectedAnalytics = selectedItemKey
    ? allAnalytics.find(a => a.itemKey === selectedItemKey) ?? null
    : null

  // Summary stats for header
  const totalItems = allAnalytics.length
  const totalValue = allAnalytics.reduce((s, a) => s + a.totalAmount, 0)
  const totalBills = new Set(allEntries.map(e => e.billNumber)).size

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'history', label: 'History', count: allEntries.length },
    { id: 'analytics', label: 'Analytics', count: allAnalytics.length },
  ]

  return (
    <div className="flex flex-col gap-6 p-6" style={{ color: 'var(--color-text)' }}>

      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h1 className="text-2xl font-bold">Loose Inventory History</h1>
        </div>
        <p className="text-sm ml-9" style={{ color: 'var(--color-muted)' }}>
          Items in your bills that are not in Inventory — tracked automatically across all bills.
        </p>
      </div>

      {/* Summary bar */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <span className="text-xs uppercase font-semibold tracking-wide" style={{ color: 'var(--color-muted)' }}>Unique Loose Items</span>
            <span className="text-2xl font-bold">{totalItems}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <span className="text-xs uppercase font-semibold tracking-wide" style={{ color: 'var(--color-muted)' }}>Total Value Billed</span>
            <span className="text-2xl font-bold">{formatINR(totalValue)}</span>
          </div>
          <div className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <span className="text-xs uppercase font-semibold tracking-wide" style={{ color: 'var(--color-muted)' }}>Bills Containing Loose Items</span>
            <span className="text-2xl font-bold">{totalBills}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      {!selectedAnalytics && (
        <div className="flex gap-1 p-1 rounded-xl w-fit"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              style={{
                background: activeTab === tab.id ? 'var(--color-accent)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--color-muted)',
              }}
              onClick={() => { setActiveTab(tab.id); setSelectedItemKey(null) }}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : 'var(--color-bg)',
                    color: activeTab === tab.id ? '#fff' : 'var(--color-muted)',
                  }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Filter bar (not shown in detail view) */}
      {!selectedAnalytics && (
        <FilterBar
          filters={filters}
          onChange={setFilters}
          parties={parties}
          resultCount={activeTab === 'history' ? filteredEntries.length : filteredAnalytics.length}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }} />
          <span style={{ color: 'var(--color-muted)' }}>Loading loose inventory data…</span>
        </div>
      ) : selectedAnalytics ? (
        <ItemAnalyticsCard
          analytics={selectedAnalytics}
          filters={filters}
          onBack={handleAnalyticsBack}
        />
      ) : activeTab === 'history' ? (
        <HistoryTab entries={filteredEntries} onSelectItem={handleSelectItem} />
      ) : (
        <AnalyticsTab
          analytics={filteredAnalytics}
          onSelect={key => setSelectedItemKey(key)}
          selectedItemKey={selectedItemKey}
        />
      )}
    </div>
  )
}
