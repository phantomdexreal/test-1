/**
 * cQikly — Weather Widget
 * Phase: 3b-i
 *
 * Displays: temperature, feels-like, humidity, wind speed, AQI, condition.
 * City: config.weatherCity (set in Settings).
 * API: Open-Meteo (free, no key).
 * Polling: respects PerformanceContext.apiPollingEnabled + apiPollingInterval.
 *   In Lite mode → no polling, shows last cached value or "Paused" state.
 * Hot-swap: when weatherCity changes, refetches immediately.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { usePerformance } from '../../contexts/PerformanceContext'
import { weatherService, type WeatherData } from '../../services/weather.service'

// ── AQI colour ────────────────────────────────────────────────────────────────

function aqiColour(aqi: number): string {
  if (aqi <= 20) return '#22c55e'
  if (aqi <= 40) return '#86efac'
  if (aqi <= 60) return '#facc15'
  if (aqi <= 80) return '#f97316'
  return '#ef4444'
}

// ── Metric pill ───────────────────────────────────────────────────────────────

function Pill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
      padding: '0.55rem 0.8rem',
      background: 'var(--cq-bg-primary)',
      borderRadius: '0.65rem',
      border: '1px solid var(--cq-border)',
      minWidth: 64,
    }}>
      <span style={{ fontSize: '1rem' }}>{icon}</span>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--cq-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '0.6rem', color: 'var(--cq-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

export function WeatherWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const { apiPollingEnabled, apiPollingInterval } = usePerformance()

  const [data, setData] = useState<WeatherData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const stopRef = useRef<(() => void) | null>(null)

  const city = (config as Record<string, unknown>).weatherCity as string ?? 'Mumbai'

  const startFetch = useCallback(() => {
    if (stopRef.current) stopRef.current()
    setError(null)

    if (!apiPollingEnabled) {
      // Lite mode: single fetch only (or skip if no city)
      if (city.trim()) {
        setLoading(true)
        weatherService.fetchWeather(city)
          .then(d => { setData(d); setLoading(false) })
          .catch(e => { setError(String(e)); setLoading(false) })
      } else {
        setLoading(false)
      }
      return
    }

    setLoading(true)
    const stop = weatherService.startPolling(city, apiPollingInterval, d => {
      setData(d)
      setLoading(false)
      setError(null)
    })
    stopRef.current = stop

    // Handle error on first fetch (startPolling doesn't expose it)
    weatherService.fetchWeather(city)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [city, apiPollingEnabled, apiPollingInterval])

  useEffect(() => {
    startFetch()
    return () => { if (stopRef.current) stopRef.current() }
  }, [startFetch])

  if (config.widgetVisibility?.weather === false) return null

  const cardStyle: React.CSSProperties = {
    background: 'var(--cq-surface)',
    border: '1px solid var(--cq-border)',
    borderRadius: '1rem',
    padding: '1.4rem 1.6rem',
    minWidth: 280,
    maxWidth: 340,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    position: 'relative',
    overflow: 'hidden',
  }

  // Loading skeleton
  if (loading) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>🌤 Weather</div>
        <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.85rem' }}>Fetching weather…</div>
      </div>
    )
  }

  // Error
  if (error || !data) {
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>🌤 Weather</div>
        <div style={{ color: '#f97316', fontSize: '0.8rem' }}>
          {!city.trim() ? 'Set your city in Settings → Weather City' : 'Could not fetch weather. Check internet.'}
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      {/* Accent glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 100, height: 100,
        borderRadius: '0 1rem 0 100%',
        background: 'var(--cq-accent)',
        opacity: 0.06,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--cq-text-muted)' }}>
            🌤 Weather · {data.city}
          </div>
          {!apiPollingEnabled && (
            <div style={{ fontSize: '0.6rem', color: '#f97316', marginTop: '0.2rem' }}>Polling paused (Lite mode)</div>
          )}
        </div>
        <span style={{ fontSize: '2rem' }}>{data.conditionIcon}</span>
      </div>

      {/* Main temp */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem' }}>
        <span style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1, color: 'var(--cq-text-primary)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}>
          {data.temperature}°
        </span>
        <div style={{ paddingBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--cq-text-primary)' }}>{data.condition}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)' }}>Feels {data.feelsLike}°C</div>
        </div>
      </div>

      {/* Metric pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Pill icon="💧" value={`${data.humidity}%`} label="Humidity" />
        <Pill icon="💨" value={`${data.windSpeed} km/h`} label="Wind" />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
          padding: '0.55rem 0.8rem',
          background: 'var(--cq-bg-primary)',
          borderRadius: '0.65rem',
          border: `1px solid ${aqiColour(data.aqi)}44`,
          minWidth: 64,
        }}>
          <span style={{ fontSize: '1rem' }}>🌫</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: aqiColour(data.aqi), fontVariantNumeric: 'tabular-nums' }}>
            {data.aqi}
          </span>
          <span style={{ fontSize: '0.6rem', color: aqiColour(data.aqi), textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {data.aqiLabel || 'AQI'}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div style={{ fontSize: '0.62rem', color: 'var(--cq-text-muted)', marginTop: '-0.5rem' }}>
        Updated {new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  )
}
