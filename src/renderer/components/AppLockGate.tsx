/**
 * cQikly — AppLockGate
 * Phase: 1b-A
 *
 * PURPOSE:
 *   Sits at the top of the React tree (inside all 6 context providers).
 *   On mount, checks if App Lock is enabled via IPC.
 *   - If DISABLED (default): renders children immediately, zero impact.
 *   - If ENABLED: shows a full-screen PIN entry screen; children are not
 *     rendered until the correct PIN is entered.
 *
 * FULLY WIRED (Phase 11b-i):
 *   - PIN entry fully functional.
 *   - enable/disable/changePIN wired to Settings Security panel.
 *   - Idle timeout auto-lock wired to config.appLockIdleTimeout.
 *
 * SETTINGS DEPENDENCY:
 *   Controlled by Settings → Security → App Lock / PIN.
 *   enable() / disable() / changePIN() IPC calls come from the Settings page.
 *
 * DEPENDENCIES:
 *   window.cqikly.appLock (IPC bridge — preload.ts)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

type LockState = 'checking' | 'unlocked' | 'locked'

// ─── Idle timeout helpers ─────────────────────────────────────────────────────

let _idleTimer: ReturnType<typeof setTimeout> | null = null
let _idleTimeoutMinutes = 0
let _onIdleLock: (() => void) | null = null

function resetIdleTimer() {
  if (!_idleTimeoutMinutes || !_onIdleLock) return
  if (_idleTimer) clearTimeout(_idleTimer)
  _idleTimer = setTimeout(() => {
    _onIdleLock?.()
  }, _idleTimeoutMinutes * 60 * 1000)
}

const IDLE_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']

function startIdleWatcher(minutes: number, onLock: () => void) {
  stopIdleWatcher()
  if (!minutes) return
  _idleTimeoutMinutes = minutes
  _onIdleLock = onLock
  IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
  resetIdleTimer()
}

function stopIdleWatcher() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null }
  IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer))
  _idleTimeoutMinutes = 0
  _onIdleLock = null
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AppLockGateProps {
  children: React.ReactNode
}

/**
 * Wrap your app's page content with this component.
 * It is transparent when App Lock is disabled.
 */
export function AppLockGate({ children }: AppLockGateProps): React.ReactElement {
  const [lockState,  setLockState]  = useState<LockState>('checking')
  const [pin,        setPin]        = useState('')
  const [error,      setError]      = useState('')
  const [isVerifying, setVerifying] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Check lock status on mount ─────────────────────────────────────────────
  useEffect(() => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) {
      // No IPC bridge (e.g. Vite standalone) — skip lock
      setLockState('unlocked')
      return
    }

    api.appLock.isEnabled()
      .then((enabled) => {
        setLockState(enabled ? 'locked' : 'unlocked')
      })
      .catch(() => {
        // On error default to unlocked — lock must never block the app when misconfigured
        setLockState('unlocked')
      })
  }, [])

  // Focus the PIN input when the lock screen appears
  useEffect(() => {
    if (lockState === 'locked') {
      setTimeout(() => inputRef.current?.focus(), 100)
      stopIdleWatcher()
    }
  }, [lockState])

  // ── Idle timeout watcher ────────────────────────────────────────────────
  useEffect(() => {
    if (lockState !== 'unlocked') return

    // Read idle timeout from localStorage (config fallback in browser mode)
    let idleMinutes = 0
    try {
      const raw = localStorage.getItem('cq:config')
      if (raw) {
        const cfg = JSON.parse(raw)
        idleMinutes = Number(cfg.appLockIdleTimeout ?? 0)
      }
    } catch { /* ignore */ }

    if (idleMinutes > 0) {
      startIdleWatcher(idleMinutes, () => setLockState('locked'))
    }

    // Also listen for config changes to update timeout live
    const unsub = eventBus.on('configChange', ({ key, value }) => {
      if (key === 'appLockIdleTimeout') {
        const mins = Number(value ?? 0)
        if (mins > 0) {
          startIdleWatcher(mins, () => setLockState('locked'))
        } else {
          stopIdleWatcher()
        }
      }
      if (key === 'appLockEnabled' && value === false) {
        stopIdleWatcher()
      }
    })

    return () => {
      unsub()
      stopIdleWatcher()
    }
  }, [lockState])

  // ── PIN submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (pin.length < 4 || isVerifying) return

    setVerifying(true)
    setError('')

    try {
      const api = (window as Window & typeof globalThis).cqikly
      if (!api) { setLockState('unlocked'); return }

      const ok = await api.appLock.verify(pin)
      if (ok) {
        api.app.sessionLog('APP_LOCK_VERIFIED', {})
        setLockState('unlocked')
      } else {
        api.app.sessionLog('APP_LOCK_FAILED', {})
        setError('Incorrect PIN. Please try again.')
        setPin('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Verification error. Please try again.')
      setPin('')
    } finally {
      setVerifying(false)
    }
  }, [pin, isVerifying])

  // Allow Enter key to submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }, [handleSubmit])

  // ── Render ─────────────────────────────────────────────────────────────────

  // Checking state — brief loading to avoid flicker
  if (lockState === 'checking') {
    return (
      <div style={checkingStyles}>
        <div style={spinnerStyle} />
      </div>
    )
  }

  // Unlocked (or lock disabled) — completely transparent, renders children
  if (lockState === 'unlocked') {
    return <>{children}</>
  }

  // Locked — show PIN screen; children NOT rendered
  return (
    <div style={lockScreenStyles}>
      <div style={lockCardStyles}>
        {/* Lock icon */}
        <div style={lockIconStyles}>🔒</div>

        <h1 style={lockTitleStyles}>cQikly</h1>
        <p style={lockSubtitleStyles}>Enter your PIN to continue</p>

        {/* PIN dots display */}
        <div style={pinDotsContainerStyles}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                ...pinDotStyles,
                background: i < pin.length
                  ? 'var(--cq-accent, #3b82f6)'
                  : 'var(--cq-border, #1e293b)',
              }}
            />
          ))}
        </div>

        {/* Hidden input — captures keystrokes */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={pin}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '')
            setPin(v)
            setError('')
          }}
          onKeyDown={handleKeyDown}
          style={hiddenInputStyles}
          aria-label="PIN entry"
          autoComplete="off"
        />

        {/* Click-to-focus hint */}
        <button
          onClick={() => inputRef.current?.focus()}
          style={tapToContinueStyles}
        >
          Tap here then type your PIN
        </button>

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={pin.length < 4 || isVerifying}
          style={{
            ...submitButtonStyles,
            opacity: pin.length < 4 || isVerifying ? 0.5 : 1,
            cursor:  pin.length < 4 || isVerifying ? 'not-allowed' : 'pointer',
          }}
        >
          {isVerifying ? 'Verifying…' : 'Unlock'}
        </button>

        {/* Error message */}
        {error && (
          <p style={errorStyles}>{error}</p>
        )}

        <p style={hintStyles}>PIN is set in Settings → Security</p>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const checkingStyles: React.CSSProperties = {
  position: 'fixed', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--cq-bg-primary, #050b18)',
  zIndex: 9999,
}

const spinnerStyle: React.CSSProperties = {
  width: 24, height: 24,
  border: '3px solid var(--cq-border, #1e293b)',
  borderTop: '3px solid var(--cq-accent, #3b82f6)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}

const lockScreenStyles: React.CSSProperties = {
  position: 'fixed', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--cq-bg-primary, #050b18)',
  zIndex: 9999,
}

const lockCardStyles: React.CSSProperties = {
  background: 'var(--cq-surface, #111827)',
  border: '1px solid var(--cq-border, #1e293b)',
  borderRadius: '1rem',
  padding: '3rem 2.5rem',
  width: '100%', maxWidth: 360,
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
}

const lockIconStyles: React.CSSProperties = {
  fontSize: '2.5rem',
  marginBottom: '0.5rem',
}

const lockTitleStyles: React.CSSProperties = {
  fontSize: '2rem', fontWeight: 800,
  color: 'var(--cq-accent, #3b82f6)',
  letterSpacing: '-0.03em',
  margin: 0,
}

const lockSubtitleStyles: React.CSSProperties = {
  fontSize: '0.9rem',
  color: 'var(--cq-text-muted, #475569)',
  margin: 0,
}

const pinDotsContainerStyles: React.CSSProperties = {
  display: 'flex', gap: '1rem',
  marginTop: '0.75rem',
}

const pinDotStyles: React.CSSProperties = {
  width: 14, height: 14,
  borderRadius: '50%',
  transition: 'background 0.15s ease',
}

const hiddenInputStyles: React.CSSProperties = {
  position: 'absolute',
  opacity: 0,
  width: 1, height: 1,
  pointerEvents: 'none',
}

const tapToContinueStyles: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--cq-text-muted, #475569)',
  background: 'none',
  border: '1px dashed var(--cq-border, #1e293b)',
  borderRadius: '0.4rem',
  padding: '0.4rem 0.8rem',
  cursor: 'pointer',
  marginTop: '0.25rem',
}

const submitButtonStyles: React.CSSProperties = {
  background: 'var(--cq-accent, #3b82f6)',
  color: '#fff',
  border: 'none',
  borderRadius: '0.5rem',
  padding: '0.7rem 2rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  marginTop: '0.5rem',
  transition: 'opacity 0.15s ease',
}

const errorStyles: React.CSSProperties = {
  color: '#ef4444',
  fontSize: '0.82rem',
  margin: 0,
  textAlign: 'center',
}

const hintStyles: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--cq-text-muted, #475569)',
  margin: 0,
  marginTop: '0.5rem',
  opacity: 0.7,
}
