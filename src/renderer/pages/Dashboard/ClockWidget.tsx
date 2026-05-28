/**
 * cQikly — Date & Clock Widget
 * Phase: 3a-A
 *
 * Shows current date and time.
 * Clock format (12h / 24h) is read from ConfigContext.config.clockFormat.
 * Updates every second via setInterval.
 * Respects widget visibility: if config.widgetVisibility.clock === false → hidden.
 */

import React, { useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date, format: '12h' | '24h'): string {
  if (format === '24h') {
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  }
  // 12h
  let h = date.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s} ${ampm}`
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClockWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [now, setNow] = useState<Date>(new Date())

  // Visibility gate
  if (!config.widgetVisibility?.clock) return null

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const clockFormat = config.clockFormat ?? '12h'

  return (
    <div
      className="cq-widget"
      style={{
        background: 'var(--cq-surface)',
        border: '1px solid var(--cq-border)',
        borderRadius: '1rem',
        padding: '1.5rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minWidth: 260,
      }}
    >
      {/* Widget label */}
      <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cq-accent)', opacity: 0.8 }}>
        Date & Time
      </div>

      {/* Time display */}
      <div style={{
        fontSize: '2.4rem',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        color: 'var(--cq-text-primary)',
        lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {formatTime(now, clockFormat)}
      </div>

      {/* Date display */}
      <div style={{
        fontSize: '0.875rem',
        color: 'var(--cq-text-muted)',
        fontWeight: 400,
        lineHeight: 1.4,
      }}>
        {formatDate(now)}
      </div>

      {/* Format badge */}
      <div style={{
        marginTop: '0.25rem',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}>
        <span style={{
          fontSize: '0.6rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          padding: '2px 7px',
          borderRadius: '999px',
          background: 'var(--cq-accent)',
          color: '#fff',
          opacity: 0.7,
        }}>
          {clockFormat.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
