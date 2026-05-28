/**
 * cQikly — Currency Converter Widget
 * Phase: 3b-i
 *
 * Uses live forex rates from ForexWidget's shared rates cache.
 * Supports all major currencies via Frankfurter.
 * Falls back gracefully if forex rates not yet loaded.
 * Respects widgetVisibility.currencyConverter.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { forexService } from '../../services/forex.service'
import { subscribeForexRates, getSharedForexRates } from './ForexWidget'
import type { ForexRate } from '../../services/forex.service'

// ── Popular currency list ─────────────────────────────────────────────────────

const CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD',
  'JPY', 'CHF', 'CNY', 'SAR', 'QAR', 'KWD', 'MYR', 'THB',
]

// ── Widget ────────────────────────────────────────────────────────────────────

export function CurrencyConverterWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [from, setFrom] = useState('USD')
  const [to, setTo]     = useState('INR')
  const [amount, setAmount] = useState('1')
  const [result, setResult] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [rates, setRates] = useState<ForexRate[]>(getSharedForexRates())

  // Keep rates in sync with ForexWidget's shared rates
  useEffect(() => {
    return subscribeForexRates(r => setRates(r))
  }, [])

  const convert = useCallback(async () => {
    const num = parseFloat(amount)
    if (isNaN(num)) { setResult(null); return }
    if (from === to)  { setResult(num); return }

    setConverting(true)
    try {
      const val = await forexService.convert(num, from, to, rates)
      setResult(val)
    } catch {
      setResult(null)
    } finally {
      setConverting(false)
    }
  }, [amount, from, to, rates])

  // Auto-convert on change
  useEffect(() => { convert() }, [convert])

  if (config.widgetVisibility?.currencyConverter === false) return null

  const sel: React.CSSProperties = {
    background: 'var(--cq-bg-primary)',
    border: '1px solid var(--cq-border)',
    borderRadius: '0.5rem',
    color: 'var(--cq-text-primary)',
    padding: '0.35rem 0.5rem',
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontWeight: 700,
    flex: 1,
  }

  const formatResult = (v: number) => {
    if (v >= 1e6)  return v.toLocaleString('en-IN', { maximumFractionDigits: 2 })
    if (v >= 1)    return v.toLocaleString('en-IN', { maximumFractionDigits: 4 })
    return v.toPrecision(6).replace(/\.?0+$/, '')
  }

  return (
    <div style={{
      background: 'var(--cq-surface)',
      border: '1px solid var(--cq-border)',
      borderRadius: '1rem',
      padding: '1.4rem 1.6rem',
      minWidth: 260,
      maxWidth: 320,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.9rem',
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>
        💱 Currency Converter
      </div>

      {/* Amount input */}
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        style={{
          background: 'var(--cq-bg-primary)',
          border: '1px solid var(--cq-border)',
          borderRadius: '0.6rem',
          color: 'var(--cq-text-primary)',
          padding: '0.5rem 0.75rem',
          fontSize: '1rem',
          fontVariantNumeric: 'tabular-nums',
          width: '100%',
          boxSizing: 'border-box',
        }}
        placeholder="Amount"
      />

      {/* From → To row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <select style={sel} value={from} onChange={e => setFrom(e.target.value)}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => { const t = from; setFrom(to); setTo(t) }}
          style={{
            background: 'var(--cq-bg-primary)', border: '1px solid var(--cq-border)',
            borderRadius: '50%', width: 30, height: 30, cursor: 'pointer',
            color: 'var(--cq-text-primary)', fontSize: '0.85rem', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Swap currencies"
        >⇌</button>
        <select style={sel} value={to} onChange={e => setTo(e.target.value)}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Result */}
      <div style={{
        background: 'var(--cq-bg-primary)',
        border: '1px solid var(--cq-border)',
        borderRadius: '0.65rem',
        padding: '0.75rem 1rem',
      }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--cq-text-muted)', marginBottom: '0.3rem' }}>
          {amount || '0'} {from} =
        </div>
        <div style={{
          fontSize: '1.4rem', fontWeight: 800,
          color: converting ? 'var(--cq-text-muted)' : 'var(--cq-text-primary)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
        }}>
          {converting ? '…' : result !== null ? `${formatResult(result)} ${to}` : '—'}
        </div>
      </div>

      <div style={{ fontSize: '0.62rem', color: 'var(--cq-text-muted)' }}>
        Powered by Frankfurter · ECB rates
      </div>
    </div>
  )
}
