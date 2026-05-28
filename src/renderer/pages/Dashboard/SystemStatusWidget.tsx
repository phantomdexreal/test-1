/**
 * cQikly — System Status Widget
 * Phase: 3a-A
 *
 * Shows basic system health information.
 * In Electron: attempts to read via IPC (window.cqikly.app.getSystemInfo).
 * In dev/browser: shows placeholder values.
 *
 * Refreshes every 10 seconds.
 * Visibility: respects config.widgetVisibility.systemStatus
 */

import React, { useCallback, useEffect, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemInfo {
  platform: string
  arch: string
  nodeVersion: string
  electronVersion: string
  memUsedMb: number
  memTotalMb: number
  appVersion: string
  uptime: number   // seconds
}

// ─── IPC helper ────────────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

async function fetchSystemInfo(): Promise<SystemInfo> {
  const ipc = getIpc()
  if (ipc && ipc.app && typeof (ipc.app as Record<string, unknown>).getSystemInfo === 'function') {
    try {
      const info = await (ipc.app as unknown as Record<string, (...args: unknown[]) => Promise<SystemInfo>>).getSystemInfo()
      return info
    } catch { /* fall through to placeholder */ }
  }

  // Dev/browser fallback: use performance.memory if available
  const memInfo = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  const usedMb  = memInfo ? Math.round(memInfo.usedJSHeapSize / 1024 / 1024) : 0
  const totalMb = memInfo ? Math.round(memInfo.jsHeapSizeLimit / 1024 / 1024) : 0

  return {
    platform: navigator.platform || 'Windows',
    arch: 'x64',
    nodeVersion: '—',
    electronVersion: '—',
    memUsedMb: usedMb,
    memTotalMb: totalMb,
    appVersion: '0.1.0',
    uptime: Math.round(performance.now() / 1000),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

function StatusRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: '0.78rem',
        fontWeight: 600,
        color: accent ? 'var(--cq-accent)' : 'var(--cq-text-primary)',
        fontFamily: 'monospace',
        textAlign: 'right',
      }}>
        {value}
      </span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SystemStatusWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [info, setInfo] = useState<SystemInfo | null>(null)

  // Visibility gate
  if (!config.widgetVisibility?.systemStatus) return null

  const refresh = useCallback(() => {
    fetchSystemInfo().then(setInfo).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 10_000)
    return () => clearInterval(id)
  }, [refresh])

  // ── Mem usage colour ──────────────────────────────────────────────────────
  const memPct = info && info.memTotalMb > 0
    ? Math.round((info.memUsedMb / info.memTotalMb) * 100)
    : 0

  const memColour = memPct > 85 ? '#f87171' : memPct > 65 ? '#fbbf24' : '#4ade80'

  return (
    <div
      style={{
        background: 'var(--cq-surface)',
        border: '1px solid var(--cq-border)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 220,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cq-accent)', opacity: 0.8 }}>
          System Status
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80aa' }} />
          <span style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 600 }}>Healthy</span>
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {info ? (
          <>
            <StatusRow label="Platform" value={info.platform} />
            <StatusRow label="Architecture" value={info.arch} />
            {info.electronVersion !== '—' && (
              <StatusRow label="Electron" value={`v${info.electronVersion}`} />
            )}
            <StatusRow label="App Version" value={`v${info.appVersion}`} />
            <StatusRow label="Session Uptime" value={formatUptime(info.uptime)} />

            {info.memTotalMb > 0 && (
              <>
                {/* Memory bar */}
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)' }}>Memory</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: memColour, fontFamily: 'monospace' }}>
                      {info.memUsedMb} / {info.memTotalMb} MB ({memPct}%)
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--cq-bg-primary)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(memPct, 100)}%`,
                      background: memColour,
                      borderRadius: 2,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
            Loading...
          </div>
        )}
      </div>

      {/* DB Status stub — wired when DBContext exposes status in Phase 3a-B */}
      <div style={{
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--cq-border)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cq-accent)', opacity: 0.8 }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)' }}>Local DB · Active</span>
      </div>
    </div>
  )
}
