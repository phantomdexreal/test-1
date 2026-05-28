/**
 * cQikly — Forex Rates Widget
 * Phase: 3b-i
 *
 * Displays: forex rates for configured currency pairs.
 * Pairs: config.forexPairs (default: USD/INR, EUR/INR, GBP/INR, USD/EUR, AED/INR).
 * API: Frankfurter (free, no key, ECB data).
 * Polling: respects PerformanceContext.
 * Also powers CurrencyConverterWidget (rates passed down).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { usePerformance } from '../../contexts/PerformanceContext'
import { forexService, DEFAULT_FOREX_PAIRS, type ForexRate } from '../../services/forex.service'

// ── Shared rates atom (so CurrencyConverter can consume without double-fetch) ─

let _sharedRates: ForexRate[] = []
const _ratesListeners: Array<(r: ForexRate[]) => void> = []

export function getSharedForexRates(): ForexRate[] { return _sharedRates }
export function subscribeForexRates(fn: (r: ForexRate[]) => void): () => void {
  _ratesListeners.push(fn)
  return () => {
    const i = _ratesListeners.indexOf(fn)
    if (i >= 0) _ratesListeners.splice(i, 1)
  }
}
function setSharedRates(rates: ForexRate[]) {
  _sharedRates = rates
  _ratesListeners.forEach(fn => fn(rates))
}

// ── Rate row ──────────────────────────────────────────────────────────────────

function RateRow({ rate }: { rate: ForexRate }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.5rem 0.75rem',
      borderRadius: '0.6rem',
      background: 'var(--cq-bg-primary)',
      border: '1px solid var(--cq-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
          color: 'var(--cq-accent)',
          background: 'var(--cq-surface)', border: '1px solid var(--cq-border)',
          borderRadius: '0.35rem', padding: '0.1rem 0.4rem',
        }}>
          {rate.from}/{rate.to}
        </span>
      </div>
      <span style={{
        fontSize: '0.9rem', fontWeight: 700,
        color: 'var(--cq-text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {rate.rate >= 100 ? rate.rate.toFixed(2) : rate.rate.toFixed(4)}
      </span>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function ForexWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const { apiPollingEnabled, apiPollingInterval } = usePerformance()

  const cfg = config as Record<string, unknown>
  const pairs = (cfg.forexPairs as typeof DEFAULT_FOREX_PAIRS | undefined) ?? DEFAULT_FOREX_PAIRS

  const [rates, setRates] = useState<ForexRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const onRates = useCallback((r: ForexRate[]) => {
    setRates(r); setFetchedAt(Date.now()); setLoading(false); setSharedRates(r)
  }, [])

  const start = useCallback(() => {
    if (stopRef.current) stopRef.current()
    setError(null); setLoading(true)

    if (!apiPollingEnabled) {
      forexService.fetchRates(pairs)
        .then(onRates)
        .catch(e => { setError(String(e)); setLoading(false) })
      return
    }

    const stop = forexService.startPolling(pairs, apiPollingInterval, onRates)
    stopRef.current = stop

    forexService.fetchRates(pairs)
      .then(onRates)
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [JSON.stringify(pairs), apiPollingEnabled, apiPollingInterval, onRates])

  useEffect(() => {
    start()
    return () => { if (stopRef.current) stopRef.current() }
  }, [start])

  if (config.widgetVisibility?.forex === false) return null

  const cardStyle: React.CSSProperties = {
    background: 'var(--cq-surface)',
    border: '1px solid var(--cq-border)',
    borderRadius: '1rem',
    padding: '1.4rem 1.6rem',
    minWidth: 260,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
    position: 'relative',
    overflow: 'hidden',
  }

  return (
    <div style={cardStyle}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        borderRadius: '0 1rem 0 100%',
        background: '#06b6d4', opacity: 0.07, pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>
            💱 Forex Rates
          </div>
          {!apiPollingEnabled && (
            <div style={{ fontSize: '0.6rem', color: '#f97316' }}>Polling paused (Lite mode)</div>
          )}
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)' }}>ECB · Live</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.85rem' }}>Fetching rates…</div>
      ) : error ? (
        <div style={{ color: '#f97316', fontSize: '0.8rem' }}>Could not fetch forex. Check internet.</div>
      ) : rates.length === 0 ? (
        <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.82rem' }}>No pairs configured.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {rates.map(r => <RateRow key={`${r.from}/${r.to}`} rate={r} />)}
        </div>
      )}

      {fetchedAt && (
        <div style={{ fontSize: '0.62rem', color: 'var(--cq-text-muted)' }}>
          Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
