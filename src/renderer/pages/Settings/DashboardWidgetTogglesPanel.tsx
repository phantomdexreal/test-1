/**
 * cQikly — Dashboard Widget Toggles Settings Panel
 * Phase: 11b-i
 *
 * Show/hide toggles for every dashboard widget with instant effect.
 * All changes via updateConfig → eventBus 'configChange' → Dashboard reads
 * config.widgetVisibility and conditionally renders.
 */

import React, { useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { clearAllTodos } from '../Dashboard/TodoWidget'
import { eventBus } from '../../utils/eventBus'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  errText:     '#fca5a5',
  errBg:       'rgba(239,68,68,0.12)',
  errBorder:   'rgba(239,68,68,0.4)',
}

// ─── Widget registry ──────────────────────────────────────────────────────────

interface WidgetDef {
  key: string
  icon: string
  label: string
  desc: string
  group: string
}

const WIDGETS: WidgetDef[] = [
  // Business data
  { key: 'todayBillCount',        icon: '🧾', label: "Today's Bill Count",          desc: 'Number of bills created today.',                                        group: 'Business' },
  { key: 'todayRevenue',          icon: '💰', label: "Today's Total Revenue",        desc: 'Sum of all billed amounts today.',                                      group: 'Business' },
  { key: 'monthComparison',       icon: '📈', label: 'This Month vs Last Month',     desc: 'Revenue comparison card for current and previous month.',                group: 'Business' },
  { key: 'topCustomer',           icon: '🏆', label: 'Top Customer This Month',      desc: 'Customer with highest billed amount this month.',                       group: 'Business' },
  { key: 'pendingDraftIndicator', icon: '✏️',  label: 'Pending Draft Bills',         desc: 'Indicator showing unsaved/draft bills in progress.',                    group: 'Business' },
  { key: 'lowStockAlert',         icon: '⚠️',  label: 'Low Stock Alert',             desc: 'Highlights inventory items below minimum stock threshold.',             group: 'Business' },
  // Utility
  { key: 'clock',                 icon: '🕐', label: 'Clock',                        desc: 'Live clock widget with date and day display.',                          group: 'Utility' },
  { key: 'todoList',              icon: '✅', label: 'To-Do List',                   desc: 'Quick task checklist — unchecked items persist across days.',            group: 'Utility' },
  { key: 'calculator',            icon: '🔢', label: 'Calculator Sidebar',           desc: 'Alt+N calculator panel accessible from the dashboard.',                 group: 'Utility' },
  { key: 'unitConverter',         icon: '⚖️',  label: 'Unit Converter',              desc: 'Length, weight, volume, temperature, and area converter widget.',        group: 'Utility' },
  { key: 'currencyConverter',     icon: '💱', label: 'Currency Converter',           desc: 'Live currency conversion widget.',                                      group: 'Utility' },
  { key: 'systemStatus',          icon: '💻', label: 'System Status',                desc: 'CPU, RAM, disk usage mini-readout.',                                    group: 'Utility' },
  // Live API
  { key: 'weather',               icon: '🌤️',  label: 'Weather Info',                desc: 'Live weather for your configured city.',                                group: 'Live API' },
  { key: 'crypto',                icon: '₿',  label: 'Crypto Markets',               desc: 'Live prices for up to 5 configured cryptocurrencies.',                  group: 'Live API' },
  { key: 'forex',                 icon: '💹', label: 'Forex Rates',                  desc: 'Live exchange rates for configured currency pairs.',                    group: 'Live API' },
]

const GROUPS = ['Business', 'Utility', 'Live API']

// ─── Toggle row ───────────────────────────────────────────────────────────────

function WidgetToggleRow({ widget }: { widget: WidgetDef }): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const vis = config.widgetVisibility ?? {}
  const isOn = vis[widget.key] !== false  // default true

  const toggle = () => {
    const next = !isOn
    updateConfig({ widgetVisibility: { ...vis, [widget.key]: next } })
    eventBus.emit('widgetVisibilityChange', { key: widget.key, visible: next })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0',
      borderTop: '1px solid rgba(139,92,246,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, paddingRight: 20 }}>
        <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{widget.icon}</span>
        <div>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.textPrimary }}>
            {widget.label}
          </div>
          <div style={{ fontSize: '0.76rem', color: C.textSecond, marginTop: 2, lineHeight: 1.5 }}>
            {widget.desc}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={toggle}
        style={{
          fontFamily: C.font, fontSize: '0.82rem', fontWeight: 700,
          padding: '6px 18px', borderRadius: 8, cursor: 'pointer', minWidth: 64,
          background: isOn ? C.greenBg : 'rgba(255,255,255,0.05)',
          color: isOn ? C.green : C.textSecond,
          border: `1.5px solid ${isOn ? C.greenBorder : 'rgba(255,255,255,0.1)'}`,
          transition: 'all 0.18s', outline: 'none', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
      >
        {isOn ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}

// ─── City selector for Weather ────────────────────────────────────────────────

function WeatherCitySelector(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const vis = config.widgetVisibility ?? {}
  if (vis['weather'] === false) return <></>

  return (
    <div style={{
      marginTop: 8, padding: '12px 16px',
      background: 'rgba(139,92,246,0.06)', borderRadius: 10,
      border: '1px solid rgba(139,92,246,0.15)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: '0.78rem', color: C.textSecond, whiteSpace: 'nowrap' }}>
        🌍 Weather city:
      </span>
      <input
        type="text"
        value={config.weatherCity ?? 'Mumbai'}
        onChange={e => updateConfig({ weatherCity: e.target.value })}
        placeholder="e.g. Mumbai, Delhi, Bangalore"
        style={{
          flex: 1, fontFamily: C.font, fontSize: '0.84rem',
          background: 'rgba(255,255,255,0.05)', color: C.textPrimary,
          border: '1px solid rgba(139,92,246,0.25)', borderRadius: 7,
          padding: '6px 12px', outline: 'none', minWidth: 0,
        }}
      />
    </div>
  )
}

// ─── Crypto selector ─────────────────────────────────────────────────────────

const KNOWN_CRYPTOS = [
  { id: 'bitcoin',       label: 'Bitcoin (BTC)' },
  { id: 'ethereum',      label: 'Ethereum (ETH)' },
  { id: 'solana',        label: 'Solana (SOL)' },
  { id: 'binancecoin',   label: 'BNB' },
  { id: 'ripple',        label: 'XRP' },
  { id: 'cardano',       label: 'Cardano (ADA)' },
  { id: 'dogecoin',      label: 'Dogecoin (DOGE)' },
  { id: 'polkadot',      label: 'Polkadot (DOT)' },
  { id: 'avalanche-2',   label: 'Avalanche (AVAX)' },
  { id: 'matic-network', label: 'Polygon (MATIC)' },
]

function CryptoSelector(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const vis = config.widgetVisibility ?? {}
  if (vis['crypto'] === false) return <></>

  const selected = config.cryptoIds ?? ['bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple']
  const currency  = config.cryptoCurrency ?? 'inr'

  const toggleCoin = (id: string) => {
    if (selected.includes(id)) {
      if (selected.length <= 1) return  // keep at least 1
      updateConfig({ cryptoIds: selected.filter(c => c !== id) })
    } else {
      if (selected.length >= 5) return  // max 5
      updateConfig({ cryptoIds: [...selected, id] })
    }
  }

  return (
    <div style={{
      marginTop: 8, padding: '12px 16px',
      background: 'rgba(139,92,246,0.06)', borderRadius: 10,
      border: '1px solid rgba(139,92,246,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', color: C.textSecond }}>💱 Display currency:</span>
        <select
          value={currency}
          onChange={e => updateConfig({ cryptoCurrency: e.target.value })}
          style={{
            fontFamily: C.font, fontSize: '0.82rem',
            background: 'rgba(255,255,255,0.06)', color: C.textPrimary,
            border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6,
            padding: '4px 8px', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="inr">INR (₹)</option>
          <option value="usd">USD ($)</option>
          <option value="eur">EUR (€)</option>
          <option value="gbp">GBP (£)</option>
        </select>
        <span style={{ fontSize: '0.72rem', color: C.textSecond, marginLeft: 'auto' }}>
          {selected.length}/5 coins selected
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {KNOWN_CRYPTOS.map(c => {
          const active = selected.includes(c.id)
          const disabled = !active && selected.length >= 5
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => !disabled && toggleCoin(c.id)}
              style={{
                fontFamily: C.font, fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                padding: '4px 12px', borderRadius: 20, cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? C.greenBg : 'rgba(255,255,255,0.05)',
                color: active ? C.green : disabled ? 'rgba(255,255,255,0.25)' : C.textSecond,
                border: `1px solid ${active ? C.greenBorder : 'rgba(255,255,255,0.1)'}`,
                transition: 'all 0.15s', outline: 'none', opacity: disabled ? 0.45 : 1,
              }}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Forex selector ───────────────────────────────────────────────────────────

const CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'JPY', 'SGD', 'AUD', 'CAD', 'CHF']

function ForexSelector(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const vis = config.widgetVisibility ?? {}
  if (vis['forex'] === false) return <></>

  const pairs = config.forexPairs ?? [
    { from: 'USD', to: 'INR' },
    { from: 'EUR', to: 'INR' },
  ]

  const addPair = () => {
    if (pairs.length >= 6) return
    updateConfig({ forexPairs: [...pairs, { from: 'USD', to: 'INR' }] })
  }

  const removePair = (i: number) => {
    if (pairs.length <= 1) return
    updateConfig({ forexPairs: pairs.filter((_, idx) => idx !== i) })
  }

  const updatePair = (i: number, field: 'from' | 'to', value: string) => {
    const next = pairs.map((p, idx) => idx === i ? { ...p, [field]: value } : p)
    updateConfig({ forexPairs: next })
  }

  return (
    <div style={{
      marginTop: 8, padding: '12px 16px',
      background: 'rgba(139,92,246,0.06)', borderRadius: 10,
      border: '1px solid rgba(139,92,246,0.15)',
    }}>
      <div style={{ fontSize: '0.78rem', color: C.textSecond, marginBottom: 10 }}>
        💹 Forex currency pairs ({pairs.length}/6):
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pairs.map((pair, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={pair.from}
              onChange={e => updatePair(i, 'from', e.target.value)}
              style={{ fontFamily: C.font, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, padding: '4px 8px', outline: 'none', cursor: 'pointer' }}
            >
              {CURRENCY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ color: C.textSecond, fontSize: '0.8rem' }}>→</span>
            <select
              value={pair.to}
              onChange={e => updatePair(i, 'to', e.target.value)}
              style={{ fontFamily: C.font, fontSize: '0.82rem', background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: '1px solid rgba(139,92,246,0.25)', borderRadius: 6, padding: '4px 8px', outline: 'none', cursor: 'pointer' }}
            >
              {CURRENCY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              type="button"
              onClick={() => removePair(i)}
              disabled={pairs.length <= 1}
              style={{ fontFamily: C.font, fontSize: '0.75rem', padding: '4px 8px', borderRadius: 6, cursor: pairs.length <= 1 ? 'not-allowed' : 'pointer', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)', outline: 'none', opacity: pairs.length <= 1 ? 0.4 : 1 }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      {pairs.length < 6 && (
        <button
          type="button"
          onClick={addPair}
          style={{ marginTop: 10, fontFamily: C.font, fontSize: '0.78rem', fontWeight: 600, padding: '5px 14px', borderRadius: 7, cursor: 'pointer', background: 'rgba(139,92,246,0.12)', color: C.accent, border: '1px solid rgba(139,92,246,0.3)', outline: 'none', transition: 'all 0.15s' }}
        >
          + Add pair
        </button>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function DashboardWidgetTogglesPanel(): React.ReactElement {
  return (
    <div style={{
      padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--cq-border)',
      borderRadius: 14, fontFamily: C.font, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Dashboard
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        Widget Visibility
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 20, lineHeight: 1.6 }}>
        Toggle any widget on or off — changes take effect on the dashboard instantly.
      </div>

      {GROUPS.map(group => (
        <div key={group} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: '0.68rem', fontWeight: 700, color: C.textSecond,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginBottom: 6, paddingBottom: 4,
            borderBottom: '1px solid rgba(139,92,246,0.2)',
          }}>
            {group}
          </div>
          {WIDGETS.filter(w => w.group === group).map(w => (
            <React.Fragment key={w.key}>
              <WidgetToggleRow widget={w} />
              {w.key === 'weather' && <WeatherCitySelector />}
              {w.key === 'crypto' && <CryptoSelector />}
              {w.key === 'forex' && <ForexSelector />}
            </React.Fragment>
          ))}
        </div>
      ))}

      {/* To-Do list management */}
      <TodoClearControl />
    </div>
  )
}

// ─── Todo clear control ───────────────────────────────────────────────────────

function TodoClearControl(): React.ReactElement {
  const [cleared, setCleared] = useState(false)

  return (
    <div style={{
      marginTop: 8, paddingTop: 20,
      borderTop: '1px solid rgba(139,92,246,0.2)',
    }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: C.textSecond, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        To-Do List
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, lineHeight: 1.6, marginBottom: 14 }}>
        Unchecked to-do items carry over across days automatically. Use this button to manually clear the entire list.
      </div>
      <button
        type="button"
        onClick={() => {
          clearAllTodos()
          setCleared(true)
          setTimeout(() => setCleared(false), 2500)
        }}
        style={{
          fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
          background: cleared ? C.greenBg : C.errBg,
          color: cleared ? C.green : C.errText,
          border: `1.5px solid ${cleared ? C.greenBorder : C.errBorder}`,
          borderRadius: 10, padding: '11px 24px', cursor: 'pointer',
          outline: 'none', transition: 'all 0.2s',
        }}
      >
        {cleared ? '✓ To-Do List Cleared' : '🗑 Clear Entire To-Do List'}
      </button>
    </div>
  )
}
