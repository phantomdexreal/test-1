/**
 * cQikly — InternetGate
 * Built in: Phase 2b
 *
 * Two roles:
 *   A. PRE-WIZARD GATE (firstLaunch=true)
 *      - Shown before the onboarding wizard can open on first launch.
 *      - Cannot be dismissed / skipped — user must have internet.
 *      - Shows Checking → Online (auto-proceed) / Offline (retry button).
 *
 *   B. MID-FILL DROP (firstLaunch=false)
 *      - Shown as an overlay when internet drops DURING the wizard.
 *      - Preserves all filled data (the wizard state is NOT reset).
 *      - When connection restores the overlay closes automatically.
 *      - User can also click "Resume Anyway" to dismiss and continue.
 *
 * Design: same dark purple palette as OnboardingWizard for visual continuity.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { checkConnection, watchConnection, type ConnectionStatus } from '../services/internet.service'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:           'rgba(8,3,22,0.98)',
  border:       'rgba(139,92,246,0.25)',
  accent:       '#8b5cf6',
  accentLight:  '#c4b5fd',
  textPrimary:  '#f1f0ff',
  textSecond:   'rgba(196,181,253,0.72)',
  textMuted:    'rgba(196,181,253,0.42)',
  font:         '"Inter", system-ui, -apple-system, sans-serif',
  errBg:        'rgba(239,68,68,0.1)',
  errBorder:    'rgba(239,68,68,0.35)',
  errText:      '#fca5a5',
  successBg:    'rgba(34,197,94,0.12)',
  successBorder:'rgba(34,197,94,0.4)',
  successText:  '#86efac',
  warnBg:       'rgba(234,179,8,0.1)',
  warnBorder:   'rgba(234,179,8,0.35)',
  warnText:     '#fde68a',
  shadow:       '0 0 80px rgba(139,92,246,0.2), 0 32px 64px rgba(0,0,0,0.7)',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface InternetGateProps {
  /**
   * firstLaunch=true → Pre-wizard gate. Cannot be skipped. onOnline fires when confirmed online.
   * firstLaunch=false → Mid-fill overlay. Shows over the wizard. onOnline fires to dismiss.
   */
  firstLaunch: boolean
  /** Called when internet is confirmed online (gate should be dismissed by the parent) */
  onOnline: () => void
  /** Mid-fill only: let user dismiss and continue offline */
  onResumeAnyway?: () => void
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
      border: `3px solid rgba(139,92,246,0.2)`,
      borderTopColor: C.accent,
      animation: 'cq-spin 0.9s linear infinite',
    }} />
  )
}

// ─── Pulsing status dot ───────────────────────────────────────────────────────

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color = status === 'online' ? '#4ade80'
              : status === 'offline' ? '#f87171'
              : C.accent
  return (
    <div style={{
      width: '12px', height: '12px', borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: `0 0 8px ${color}`,
      animation: status === 'checking' ? 'cq-pulse 1.2s ease-in-out infinite' : 'none',
    }} />
  )
}

// ─── Styles injection ─────────────────────────────────────────────────────────

let stylesInjected = false
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const el = document.createElement('style')
  el.textContent = `
    @keyframes cq-spin  { to { transform: rotate(360deg) } }
    @keyframes cq-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes cq-fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  `
  document.head.appendChild(el)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InternetGate({
  firstLaunch,
  onOnline,
  onResumeAnyway,
}: InternetGateProps): React.ReactElement {
  injectStyles()

  const [status, setStatus]     = useState<ConnectionStatus>('checking')
  const [retrying, setRetrying] = useState(false)
  const [dotCount, setDotCount] = useState(1)
  const watcherRef              = useRef<{ stop: () => void } | null>(null)
  const onOnlineRef             = useRef(onOnline)
  onOnlineRef.current           = onOnline

  // Animated ellipsis for "Checking..." text
  useEffect(() => {
    const t = setInterval(() => setDotCount(d => (d % 3) + 1), 500)
    return () => clearInterval(t)
  }, [])

  // Start watching on mount
  useEffect(() => {
    watcherRef.current = watchConnection((newStatus) => {
      setStatus(newStatus)
      if (newStatus === 'online') {
        // Auto-proceed when online is confirmed
        setTimeout(() => onOnlineRef.current(), 700)
      }
    }, 4000)
    return () => watcherRef.current?.stop()
  }, [])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    setStatus('checking')
    const online = await checkConnection()
    setRetrying(false)
    setStatus(online ? 'online' : 'offline')
    if (online) setTimeout(() => onOnlineRef.current(), 700)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  const isOverlay  = !firstLaunch
  const zIndex     = isOverlay ? 3000 : 2500
  const bgOpacity  = isOverlay ? 'rgba(2,0,10,0.92)' : 'rgba(2,0,10,0.98)'

  const statusLabel =
    status === 'checking' ? `Checking${'.'.repeat(dotCount)}`
    : status === 'online'  ? 'Connected ✓'
    : 'No Internet Connection'

  const statusColor =
    status === 'online' ? C.successText
    : status === 'offline' ? C.errText
    : C.accentLight

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex,
      background: bgOpacity,
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        padding: '44px 48px',
        maxWidth: '460px', width: '100%',
        boxShadow: C.shadow,
        textAlign: 'center',
        animation: 'cq-fadein 0.35s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px',
      }}>

        {/* Icon */}
        <div style={{ fontSize: '3.5rem', lineHeight: 1 }}>
          {status === 'online'   ? '🌐'
           : status === 'offline' ? '📵'
           : '📡'}
        </div>

        {/* Title */}
        <div>
          <div style={{
            fontFamily: C.font, fontSize: '1.3rem', fontWeight: 800,
            color: C.textPrimary, marginBottom: '10px',
          }}>
            {firstLaunch
              ? (status === 'online' ? 'You\'re Online!' : 'Internet Required')
              : (status === 'online' ? 'Connection Restored!' : 'Connection Lost')}
          </div>
          <div style={{
            fontFamily: C.font, fontSize: '0.9rem', color: C.textSecond, lineHeight: 1.7,
          }}>
            {firstLaunch
              ? (status === 'offline' || status === 'checking'
                  ? 'An active internet connection is required to complete your first-time setup. cQikly will be fully offline after setup.'
                  : 'Internet confirmed. Taking you to setup...')
              : (status === 'offline' || status === 'checking'
                  ? 'Your data is safe — nothing has been lost. Connect to the internet and this screen will close automatically.'
                  : 'Connection restored. Resuming your setup...')}
          </div>
        </div>

        {/* Status indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: status === 'online'   ? C.successBg
                     : status === 'offline' ? C.errBg
                     : 'rgba(139,92,246,0.1)',
          border: `1px solid ${
            status === 'online'   ? C.successBorder
            : status === 'offline' ? C.errBorder
            : 'rgba(139,92,246,0.3)'}`,
          borderRadius: '40px',
          padding: '10px 20px',
        }}>
          {status === 'checking' ? <Spinner /> : <StatusDot status={status} />}
          <span style={{
            fontFamily: C.font, fontSize: '0.88rem', fontWeight: 600,
            color: statusColor,
          }}>
            {statusLabel}
          </span>
        </div>

        {/* Actions */}
        {status === 'offline' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              style={{
                fontFamily: C.font, fontSize: '0.93rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#fff', border: 'none', borderRadius: '10px',
                padding: '13px 28px', cursor: retrying ? 'not-allowed' : 'pointer',
                outline: 'none', opacity: retrying ? 0.6 : 1,
                boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                transition: 'transform 0.15s, opacity 0.15s',
                width: '100%',
              }}
              onMouseEnter={e => { if (!retrying) (e.currentTarget).style.transform = 'scale(1.02)' }}
              onMouseLeave={e => { (e.currentTarget).style.transform = 'scale(1)' }}
            >
              {retrying ? '⏳ Checking...' : '🔄 Retry Connection'}
            </button>

            {/* Mid-fill only: allow resuming without internet */}
            {!firstLaunch && onResumeAnyway && (
              <button
                type="button"
                onClick={onResumeAnyway}
                style={{
                  fontFamily: C.font, fontSize: '0.85rem', fontWeight: 600,
                  color: C.textMuted,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid rgba(255,255,255,0.08)`,
                  borderRadius: '10px',
                  padding: '11px 28px', cursor: 'pointer', outline: 'none',
                  width: '100%', transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = C.textPrimary
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = C.textMuted
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
              >
                Continue Filling Without Internet →
              </button>
            )}
          </div>
        )}

        {/* Footer note */}
        <div style={{
          fontFamily: C.font, fontSize: '0.77rem', color: C.textMuted, lineHeight: 1.6,
        }}>
          {firstLaunch
            ? 'After completing setup, cQikly runs 100% offline — no internet needed for billing.'
            : '📋 All fields you\'ve filled are preserved. Nothing is lost.'}
        </div>
      </div>
    </div>
  )
}
