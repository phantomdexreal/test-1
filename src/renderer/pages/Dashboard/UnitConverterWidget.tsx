/**
 * cQikly — Unit Converter Widget
 * Phase: 3b-i
 *
 * Offline, no API needed.
 * Categories: Weight, Length, Area, Volume, Temperature.
 * Useful for wholesale/production SMBs (kg↔g, meters↔feet, etc.)
 * Respects widgetVisibility.unitConverter.
 */

import React, { useState, useCallback } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ── Unit definitions ──────────────────────────────────────────────────────────

interface UnitDef {
  label: string
  toBase: (v: number) => number   // convert to SI base
  fromBase: (v: number) => number // convert from SI base
}

interface Category {
  name: string
  icon: string
  units: Record<string, UnitDef>
}

const CATEGORIES: Category[] = [
  {
    name: 'Weight', icon: '⚖️',
    units: {
      kg:  { label: 'Kilogram (kg)',  toBase: v => v,       fromBase: v => v },
      g:   { label: 'Gram (g)',       toBase: v => v/1000,  fromBase: v => v*1000 },
      mg:  { label: 'Milligram (mg)', toBase: v => v/1e6,   fromBase: v => v*1e6 },
      lb:  { label: 'Pound (lb)',     toBase: v => v*0.4536, fromBase: v => v/0.4536 },
      oz:  { label: 'Ounce (oz)',     toBase: v => v*0.02835, fromBase: v => v/0.02835 },
      quintal: { label: 'Quintal',   toBase: v => v*100,   fromBase: v => v/100 },
      tonne:   { label: 'Tonne (MT)', toBase: v => v*1000,  fromBase: v => v/1000 },
    },
  },
  {
    name: 'Length', icon: '📏',
    units: {
      m:   { label: 'Metre (m)',  toBase: v => v,        fromBase: v => v },
      cm:  { label: 'Cm',        toBase: v => v/100,    fromBase: v => v*100 },
      mm:  { label: 'Mm',        toBase: v => v/1000,   fromBase: v => v*1000 },
      km:  { label: 'Km',        toBase: v => v*1000,   fromBase: v => v/1000 },
      ft:  { label: 'Feet (ft)', toBase: v => v*0.3048, fromBase: v => v/0.3048 },
      inch:{ label: 'Inch (in)', toBase: v => v*0.0254, fromBase: v => v/0.0254 },
      yard:{ label: 'Yard (yd)', toBase: v => v*0.9144, fromBase: v => v/0.9144 },
    },
  },
  {
    name: 'Area', icon: '📐',
    units: {
      m2:   { label: 'sq metre (m²)',  toBase: v => v,       fromBase: v => v },
      cm2:  { label: 'sq cm',          toBase: v => v/10000, fromBase: v => v*10000 },
      ft2:  { label: 'sq feet',        toBase: v => v*0.0929, fromBase: v => v/0.0929 },
      acre: { label: 'Acre',           toBase: v => v*4046.86, fromBase: v => v/4046.86 },
      cent: { label: 'Cent (India)',    toBase: v => v*40.47, fromBase: v => v/40.47 },
      gunta:{ label: 'Gunta (India)',   toBase: v => v*101.17, fromBase: v => v/101.17 },
    },
  },
  {
    name: 'Volume', icon: '🧴',
    units: {
      l:   { label: 'Litre (L)',   toBase: v => v,       fromBase: v => v },
      ml:  { label: 'mL',         toBase: v => v/1000,  fromBase: v => v*1000 },
      m3:  { label: 'm³',         toBase: v => v*1000,  fromBase: v => v/1000 },
      gal: { label: 'Gallon (US)', toBase: v => v*3.785, fromBase: v => v/3.785 },
    },
  },
  {
    name: 'Temp', icon: '🌡️',
    units: {
      C: { label: '°Celsius',    toBase: v => v,                 fromBase: v => v },
      F: { label: '°Fahrenheit', toBase: v => (v-32)*(5/9),     fromBase: v => v*(9/5)+32 },
      K: { label: 'Kelvin',      toBase: v => v-273.15,          fromBase: v => v+273.15 },
    },
  },
]

function fmt(v: number): string {
  if (!isFinite(v)) return 'Error'
  if (Math.abs(v) >= 1e9) return v.toExponential(4)
  if (Math.abs(v) >= 1000) return v.toLocaleString('en-IN', { maximumFractionDigits: 4 })
  return v.toPrecision(7).replace(/\.?0+$/, '')
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function UnitConverterWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [catIdx, setCatIdx] = useState(0)
  const [fromUnit, setFromUnit] = useState<string>('')
  const [toUnit, setToUnit]   = useState<string>('')
  const [inputVal, setInputVal] = useState('1')

  const cat = CATEGORIES[catIdx]
  const unitKeys = Object.keys(cat.units)

  // Reset units when category changes
  const selectCat = (i: number) => {
    setCatIdx(i)
    const keys = Object.keys(CATEGORIES[i].units)
    setFromUnit(keys[0])
    setToUnit(keys[1] ?? keys[0])
    setInputVal('1')
  }

  // Init defaults
  const fu = fromUnit || unitKeys[0]
  const tu = toUnit   || (unitKeys[1] ?? unitKeys[0])

  const compute = useCallback(() => {
    const num = parseFloat(inputVal)
    if (isNaN(num)) return '—'
    const base = cat.units[fu]?.toBase(num)
    const result = cat.units[tu]?.fromBase(base ?? 0)
    return fmt(result ?? 0)
  }, [inputVal, fu, tu, cat])

  const swap = () => {
    setFromUnit(tu)
    setToUnit(fu)
  }

  if (config.widgetVisibility?.unitConverter === false) return null

  const sel: React.CSSProperties = {
    background: 'var(--cq-bg-primary)',
    border: '1px solid var(--cq-border)',
    borderRadius: '0.5rem',
    color: 'var(--cq-text-primary)',
    padding: '0.35rem 0.5rem',
    fontSize: '0.78rem',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
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
      gap: '1rem',
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>
        📐 Unit Converter
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            onClick={() => selectCat(i)}
            style={{
              padding: '0.25rem 0.6rem',
              borderRadius: '0.45rem',
              border: '1px solid var(--cq-border)',
              background: i === catIdx ? 'var(--cq-accent)' : 'var(--cq-bg-primary)',
              color: i === catIdx ? '#fff' : 'var(--cq-text-muted)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* From/To row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <select style={sel} value={fu} onChange={e => setFromUnit(e.target.value)}>
          {unitKeys.map(k => <option key={k} value={k}>{cat.units[k].label}</option>)}
        </select>
        <button
          onClick={swap}
          style={{
            background: 'var(--cq-bg-primary)', border: '1px solid var(--cq-border)',
            borderRadius: '50%', width: 28, height: 28, cursor: 'pointer',
            color: 'var(--cq-text-primary)', fontSize: '0.8rem', flexShrink: 0,
          }}
          title="Swap"
        >⇌</button>
        <select style={sel} value={tu} onChange={e => setToUnit(e.target.value)}>
          {unitKeys.map(k => <option key={k} value={k}>{cat.units[k].label}</option>)}
        </select>
      </div>

      {/* Input */}
      <input
        type="number"
        value={inputVal}
        onChange={e => setInputVal(e.target.value)}
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
        placeholder="Enter value"
      />

      {/* Result */}
      <div style={{
        background: 'var(--cq-bg-primary)',
        border: '1px solid var(--cq-border)',
        borderRadius: '0.65rem',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)' }}>Result</span>
        <span style={{
          fontSize: '1.25rem', fontWeight: 800,
          color: 'var(--cq-text-primary)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.03em',
        }}>
          {compute()} <span style={{ fontSize: '0.7rem', fontWeight: 500 }}>{cat.units[tu]?.label.replace(/\(.*\)/, '').trim()}</span>
        </span>
      </div>
    </div>
  )
}
