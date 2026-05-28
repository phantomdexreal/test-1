/**
 * cQikly — Revenue Widgets
 * Phase: 3a-B
 *
 * Three widgets:
 *  - TodayRevenueWidget       → total billed amount today (grand_total sum)
 *  - MonthComparisonWidget    → this month vs last month as two figures + delta badge
 *  - TopCustomerWidget        → top customer by billed value this month
 *
 * All read from SQLite via dashboard.service.
 * All respect widgetVisibility from ConfigContext.
 * Refresh every 60 seconds.
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import {
  getTodayRevenue,
  getThisMonthRevenue,
  getLastMonthRevenue,
  getTopCustomerThisMonth,
  formatINR,
  formatINRFull,
  type TopCustomerResult,
} from '../../services/dashboard.service'
import { StatCard } from './BillCountWidget'

// ─── Today's Revenue ───────────────────────────────────────────────────────────

export function TodayRevenueWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [amount, setAmount] = useState<number | null>(null)

  const load = useCallback(async () => {
    const n = await getTodayRevenue()
    setAmount(n)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.todayRevenue === false) return null

  return (
    <StatCard
      label="Today's Revenue"
      value={amount !== null ? formatINR(amount) : '—'}
      icon="💰"
      accent="#10b981"
      sublabel={amount !== null && amount > 0 ? formatINRFull(amount) : 'no bills today'}
      loading={amount === null}
    />
  )
}

// ─── Month Comparison ──────────────────────────────────────────────────────────

export function MonthComparisonWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [thisMonth, setThisMonth] = useState<number | null>(null)
  const [lastMonth, setLastMonth] = useState<number | null>(null)

  const load = useCallback(async () => {
    const [tm, lm] = await Promise.all([getThisMonthRevenue(), getLastMonthRevenue()])
    setThisMonth(tm)
    setLastMonth(lm)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.monthComparison === false) return null

  const loading = thisMonth === null || lastMonth === null

  // Delta calculation
  const delta = (!loading && lastMonth !== 0)
    ? (((thisMonth! - lastMonth!) / lastMonth!) * 100)
    : null

  const deltaColor = delta === null ? 'var(--cq-text-muted)'
    : delta >= 0 ? '#10b981' : '#f87171'

  const deltaLabel = delta === null ? ''
    : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`

  // Current month name
  const now = new Date()
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const thisMonthName = monthNames[now.getMonth()]
  const lastMonthName = monthNames[(now.getMonth() + 11) % 12]

  return (
    <div style={{
      background: 'var(--cq-surface)',
      border: '1px solid var(--cq-border)',
      borderRadius: '1rem',
      padding: '1.4rem 1.6rem',
      minWidth: 230,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        borderRadius: '0 1rem 0 100%',
        background: '#f59e0b',
        opacity: 0.07,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>📅</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--cq-text-muted)',
        }}>Month vs Month</span>
        {!loading && delta !== null && (
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.7rem', fontWeight: 700,
            color: deltaColor,
            background: `${deltaColor}1a`,
            padding: '0.15rem 0.5rem',
            borderRadius: '0.4rem',
            border: `1px solid ${deltaColor}33`,
          }}>
            {deltaLabel}
          </span>
        )}
      </div>

      {/* Two-column comparison */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end' }}>
        {/* This month */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', marginBottom: '0.25rem' }}>
            {thisMonthName} (this month)
          </div>
          <div style={{
            fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em',
            color: 'var(--cq-text-primary)', fontVariantNumeric: 'tabular-nums',
          }}>
            {loading ? '—' : formatINR(thisMonth!)}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 40, background: 'var(--cq-border)', flexShrink: 0 }} />

        {/* Last month */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', marginBottom: '0.25rem' }}>
            {lastMonthName} (last month)
          </div>
          <div style={{
            fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.03em',
            color: 'var(--cq-text-muted)', fontVariantNumeric: 'tabular-nums',
          }}>
            {loading ? '—' : formatINR(lastMonth!)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Top Customer This Month ───────────────────────────────────────────────────

export function TopCustomerWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [data, setData] = useState<TopCustomerResult | null | 'loading'>('loading')

  const load = useCallback(async () => {
    const result = await getTopCustomerThisMonth()
    setData(result)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.topCustomer === false) return null

  const loading = data === 'loading'
  const customer = data !== 'loading' ? data : null

  return (
    <div style={{
      background: 'var(--cq-surface)',
      border: '1px solid var(--cq-border)',
      borderRadius: '1rem',
      padding: '1.4rem 1.6rem',
      minWidth: 220,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        borderRadius: '0 1rem 0 100%',
        background: '#a855f7',
        opacity: 0.07,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>🏆</span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: 'var(--cq-text-muted)',
        }}>Top Customer</span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--cq-text-muted)',
          background: 'var(--cq-bg-primary)', padding: '0.1rem 0.4rem',
          borderRadius: '0.3rem', border: '1px solid var(--cq-border)',
        }}>
          this month
        </span>
      </div>

      {/* Customer name */}
      <div style={{
        fontSize: loading ? '0.9rem' : (customer ? '1.15rem' : '0.85rem'),
        fontWeight: 700,
        color: loading || !customer ? 'var(--cq-text-muted)' : 'var(--cq-text-primary)',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {loading ? '—' : (customer ? customer.partyName : 'No bills this month')}
      </div>

      {/* Amount + bill count */}
      {!loading && customer && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em',
            color: '#a855f7', fontVariantNumeric: 'tabular-nums',
          }}>
            {formatINR(customer.totalAmount)}
          </span>
          <span style={{
            fontSize: '0.7rem', color: 'var(--cq-text-muted)',
            background: 'var(--cq-bg-primary)',
            padding: '0.15rem 0.5rem',
            borderRadius: '0.4rem',
            border: '1px solid var(--cq-border)',
          }}>
            {customer.billCount} bill{customer.billCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
