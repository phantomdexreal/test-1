/**
 * cQikly — Crypto Markets Widget
 * Phase: 3b-i
 *
 * Displays: up to 5 crypto prices + 24h change.
 * Currency: config.cryptoCurrency (default: inr).
 * Coins: config.cryptoIds (up to 5 CoinGecko IDs).
 * API: CoinGecko public (free, no key).
 * Polling: respects PerformanceContext.
 * Lite mode: no polling.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { usePerformance } from '../../contexts/PerformanceContext'
import { cryptoService, type CryptoPrice } from '../../services/crypto.service'

// ── Currency format helpers ───────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  const cur = currency.toUpperCase()
  if (price >= 1_000_000) return `${cur === 'INR' ? '₹' : '$'}${(price / 1_000_000).toFixed(2)}M`
  if (price >= 1_000)     return `${cur === 'INR' ? '₹' : '$'}${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
  return `${cur === 'INR' ? '₹' : '$'}${price.toFixed(2)}`
}

// ── Single coin row ───────────────────────────────────────────────────────────

function CoinRow({ coin }: { coin: CryptoPrice }) {
  const up = coin.change24h >= 0
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.55rem 0.75rem',
      borderRadius: '0.65rem',
      background: 'var(--cq-bg-primary)',
      border: '1px solid var(--cq-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 800, color: 'var(--cq-text-muted)',
          background: 'var(--cq-surface)', border: '1px solid var(--cq-border)',
          borderRadius: '0.35rem', padding: '0.1rem 0.4rem', letterSpacing: '0.05em',
        }}>
          {coin.symbol}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)' }}>{coin.name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--cq-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatPrice(coin.price, coin.currency)}
        </span>
        <span style={{
          fontSize: '0.72rem', fontWeight: 600,
          color: up ? '#22c55e' : '#ef4444',
          minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}>
          {up ? '▲' : '▼'} {Math.abs(coin.change24h).toFixed(2)}%
        </span>
      </div>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function CryptoWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const { apiPollingEnabled, apiPollingInterval } = usePerformance()

  const cfg = config as Record<string, unknown>
  const currency = cfg.cryptoCurrency as string ?? 'inr'
  const ids = (cfg.cryptoIds as string[] | undefined) ?? ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple']

  const [prices, setPrices] = useState<CryptoPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  const start = useCallback(() => {
    if (stopRef.current) stopRef.current()
    setError(null)
    setLoading(true)

    if (!apiPollingEnabled) {
      cryptoService.fetchPrices(ids.slice(0, 5), currency)
        .then(p => { setPrices(p); setFetchedAt(Date.now()); setLoading(false) })
        .catch(e => { setError(String(e)); setLoading(false) })
      return
    }

    const stop = cryptoService.startPolling(ids.slice(0, 5), currency, apiPollingInterval, p => {
      setPrices(p); setFetchedAt(Date.now()); setLoading(false)
    })
    stopRef.current = stop

    cryptoService.fetchPrices(ids.slice(0, 5), currency)
      .then(p => { setPrices(p); setFetchedAt(Date.now()); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [ids.join(','), currency, apiPollingEnabled, apiPollingInterval])

  useEffect(() => {
    start()
    return () => { if (stopRef.current) stopRef.current() }
  }, [start])

  if (config.widgetVisibility?.crypto === false) return null

  const cardStyle: React.CSSProperties = {
    background: 'var(--cq-surface)',
    border: '1px solid var(--cq-border)',
    borderRadius: '1rem',
    padding: '1.4rem 1.6rem',
    minWidth: 300,
    maxWidth: 380,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    position: 'relative',
    overflow: 'hidden',
  }

  return (
    <div style={cardStyle}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        borderRadius: '0 1rem 0 100%',
        background: '#f7931a', opacity: 0.08, pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>
            ₿ Crypto Markets
          </div>
          {!apiPollingEnabled && (
            <div style={{ fontSize: '0.6rem', color: '#f97316' }}>Polling paused (Lite mode)</div>
          )}
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {currency.toUpperCase()}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.85rem' }}>Fetching prices…</div>
      ) : error ? (
        <div style={{ color: '#f97316', fontSize: '0.8rem' }}>Could not fetch prices. Check internet.</div>
      ) : prices.length === 0 ? (
        <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.82rem' }}>No coins configured.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {prices.map(c => <CoinRow key={c.id} coin={c} />)}
        </div>
      )}

      {/* Timestamp */}
      {fetchedAt && (
        <div style={{ fontSize: '0.62rem', color: 'var(--cq-text-muted)' }}>
          Updated {new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
