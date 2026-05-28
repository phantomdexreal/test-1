/**
 * cQikly — Appearance & Theme Panel
 * Phase 11a-ii (expands Phase 3b-ii ThemePanel inline in Settings/index.tsx)
 *
 * Sections:
 *   1. Theme selector — 6 themes × dark/light, live preview on hover/click
 *   2. Dark/Light toggle — instant CSS variable swap
 *   3. App-level zoom / font size slider — immediately scales entire UI via
 *      document.documentElement style.fontSize; persisted in config
 *
 * Theme switch: zero flicker, zero reload — CSS variables applied to :root
 * Zoom: applied immediately to document.documentElement.style.zoom AND
 *       adjusts root font-size so all rem-based layouts scale proportionally.
 */

import React, { useCallback } from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { useConfig } from '../../contexts/ConfigContext'
import type { ThemeId } from '../../themes'

// ─── Style tokens ──────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'rgba(196,181,253,0.72)',
  textMuted:   'rgba(196,181,253,0.42)',
  border:      'var(--cq-border)',
}

// ─── Theme metadata ────────────────────────────────────────────────────────────

const THEME_ICONS: Record<ThemeId, string> = {
  'space-particles': '🌌',
  'sakura':          '🌸',
  'minimal':         '◻️',
  'dark-rainbow':    '🌈',
  'neon':            '⚡',
  'dark-rose':       '🌹',
}

const THEME_DESCRIPTIONS: Record<ThemeId, string> = {
  'space-particles': 'Deep space — Three.js animated particle field.',
  'sakura':          'Soft cherry blossom petals drifting down.',
  'minimal':         'Clean flat background with zero animation.',
  'dark-rainbow':    'Animated hue-cycling full-spectrum glow.',
  'neon':            'Dark cyberpunk background with neon glow accents.',
  'dark-rose':       'Deep dark background with rose & mauve animated elements.',
}

// ─── Zoom helpers ──────────────────────────────────────────────────────────────

/** Apply zoom level to the entire document immediately. */
function applyZoom(zoom: number): void {
  // Both approaches for maximum compatibility across Electron/Chrome versions:
  // 1. CSS zoom on :root
  document.documentElement.style.setProperty('--cq-zoom', String(zoom))
  // 2. Adjust root font-size so rem units scale with it
  //    Default browser base is 16px — we scale from that
  document.documentElement.style.fontSize = `${zoom * 16}px`
}

const MIN_ZOOM = 0.75
const MAX_ZOOM = 1.5
const ZOOM_STEP = 0.05

const ZOOM_PRESETS = [
  { label: '75%', value: 0.75 },
  { label: '90%', value: 0.90 },
  { label: '100%', value: 1.0 },
  { label: '110%', value: 1.1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AppearancePanel(): React.ReactElement {
  const { themeId, variant, allThemes, themeMeta, setTheme, toggleVariant } = useTheme()
  const { config, updateConfig } = useConfig()

  const zoom = (config.appZoom as number) ?? 1.0

  const handleZoom = useCallback((val: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(val * 100) / 100))
    updateConfig({ appZoom: clamped })
    applyZoom(clamped)
  }, [updateConfig])

  return (
    <div style={{
      marginTop: 20, padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${C.border}`,
      borderRadius: 14, fontFamily: C.font,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Appearance &amp; Theme
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        Themes, Dark Mode &amp; UI Scale
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 24, lineHeight: 1.6 }}>
        All changes apply instantly — zero reload, zero flicker.
      </div>

      {/* ── Dark / Light toggle ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
            {variant === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </div>
          <div style={{ fontSize: '0.78rem', color: C.textSecond, marginTop: 2 }}>
            Switch between dark and light variants for the active theme.
          </div>
        </div>
        <button
          type="button"
          onClick={toggleVariant}
          style={{
            fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
            background: 'rgba(139,92,246,0.12)', color: C.textPrimary,
            border: '1.5px solid rgba(139,92,246,0.35)', borderRadius: 9,
            padding: '9px 20px', cursor: 'pointer', outline: 'none',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)' }}
        >
          Switch to {variant === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* ── Theme selector ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 4, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
        Theme
      </div>
      <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.5 }}>
        Click a theme to apply it live. The dark/light toggle above applies to all themes.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
        gap: 10, marginBottom: 28,
      }}>
        {allThemes.map(id => {
          const active = id === themeId
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id, variant)}
              style={{
                fontFamily: C.font, textAlign: 'left',
                background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: active ? '2px solid var(--cq-accent)' : `1.5px solid ${C.border}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer', outline: 'none',
                transition: 'all 0.15s',
                boxShadow: active ? '0 0 16px rgba(var(--cq-glow),0.2)' : 'none',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--cq-accent)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' } }}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' } }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{THEME_ICONS[id]}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.textPrimary, marginBottom: 3 }}>
                {themeMeta[id].label}
              </div>
              <div style={{ fontSize: '0.73rem', color: C.textSecond, lineHeight: 1.5 }}>
                {THEME_DESCRIPTIONS[id]}
              </div>
              {active && (
                <div style={{ marginTop: 8, fontSize: '0.68rem', fontWeight: 700, color: 'var(--cq-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ✓ Active
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── App-level Zoom / Font Size ──────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
            🔍 App Zoom / Font Size
          </div>
          <span style={{
            fontSize: '0.8rem', fontWeight: 700,
            color: 'var(--cq-accent)',
            background: 'rgba(139,92,246,0.12)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 6, padding: '2px 10px',
          }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.5 }}>
          Scales the entire app UI immediately — useful for high-DPI screens or visual accessibility.
          All text, spacing, and icons scale proportionally.
        </div>

        {/* Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <span style={{ fontSize: '0.75rem', color: C.textMuted, minWidth: 28, textAlign: 'right' }}>
            {Math.round(MIN_ZOOM * 100)}%
          </span>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={e => handleZoom(parseFloat(e.target.value))}
              style={{
                width: '100%', height: 4, accentColor: 'var(--cq-accent)',
                cursor: 'pointer', outline: 'none',
              }}
            />
          </div>
          <span style={{ fontSize: '0.75rem', color: C.textMuted, minWidth: 28 }}>
            {Math.round(MAX_ZOOM * 100)}%
          </span>
        </div>

        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {ZOOM_PRESETS.map(p => {
            const active = Math.abs(zoom - p.value) < 0.01
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handleZoom(p.value)}
                style={{
                  fontFamily: C.font, fontSize: '0.78rem', fontWeight: active ? 700 : 500,
                  color: active ? 'var(--cq-accent)' : C.textSecond,
                  background: active ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(139,92,246,0.45)' : `1px solid ${C.border}`,
                  borderRadius: 7, padding: '5px 12px', cursor: 'pointer', outline: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        {zoom !== 1.0 && (
          <button
            type="button"
            onClick={() => handleZoom(1.0)}
            style={{
              marginTop: 10, fontFamily: C.font, fontSize: '0.75rem', fontWeight: 600,
              color: C.textMuted, background: 'transparent',
              border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer', outline: 'none',
            }}
          >
            ↩ Reset to 100%
          </button>
        )}
      </div>
    </div>
  )
}
