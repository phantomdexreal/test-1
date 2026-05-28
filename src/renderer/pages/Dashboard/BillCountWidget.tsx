/**
 * cQikly — Bill Count Widgets
 * Phase: 3a-B
 *
 * Two widgets:
 *  - TodayBillCountWidget  → bills created today
 *  - TotalBillsWidget      → all-time bill count
 *
 * Both read from SQLite via dashboard.service.
 * Both respect widgetVisibility from ConfigContext.
 * Refresh every 60 seconds (bills don't change that fast mid-session).
 * Degrade gracefully to "—" on DB error or no-IPC (dev browser mode).
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { getTodayBillCount, getTotalBillCount } from '../../services/dashboard.service'

// ─── Shared card shell ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  accent?: string
  sublabel?: string
  loading?: boolean
}

export function StatCard({ label, value, icon, accent = 'var(--cq-accent)', sublabel, loading }: StatCardProps): React.ReactElement {
  return (
    <div style={{
      background: 'var(--cq-surface)',
      border: '1px solid var(--cq-border)',
      borderRadius: '1rem',
      padding: '1.4rem 1.6rem',
      minWidth: 170,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.6rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle accent glow top-right */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        borderRadius: '0 1rem 0 100%',
        background: accent,
        opacity: 0.07,
        pointerEvents: 'none',
      }} />

      {/* Icon + label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: 'var(--cq-text-muted)',
        }}>
          {label}
        </span>
      </div>

      {/* Main value */}
      <div style={{
        fontSize: loading ? '1.1rem' : '2rem',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color: loading ? 'var(--cq-text-muted)' : 'var(--cq-text-primary)',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {loading ? '—' : value}
      </div>

      {/* Optional sublabel */}
      {sublabel && (
        <div style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)', marginTop: '-0.2rem' }}>
          {sublabel}
        </div>
      )}
    </div>
  )
}

// ─── Today's Bill Count ────────────────────────────────────────────────────────

export function TodayBillCountWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [count, setCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    const n = await getTodayBillCount()
    setCount(n)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.todayBillCount === false) return null

  return (
    <StatCard
      label="Today's Bills"
      value={count ?? 0}
      icon="🧾"
      accent="var(--cq-accent)"
      sublabel="bills created today"
      loading={count === null}
    />
  )
}

// ─── Total Bills ───────────────────────────────────────────────────────────────

export function TotalBillsWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [count, setCount] = useState<number | null>(null)

  const load = useCallback(async () => {
    const n = await getTotalBillCount()
    setCount(n)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  if (config.widgetVisibility?.totalBills === false) return null

  return (
    <StatCard
      label="Total Bills"
      value={count ?? 0}
      icon="📊"
      accent="#06b6d4"
      sublabel="all time"
      loading={count === null}
    />
  )
}
