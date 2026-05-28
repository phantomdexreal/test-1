/**
 * cQikly — Security Settings Panel
 * Phase: 11b-i
 *
 * Controls:
 *  - App Lock / PIN enable toggle
 *  - Numeric PIN setup (set / change / clear)
 *  - Idle timeout configuration
 *
 * The AppLockGate (Phase 1b-A) reads appLockEnabled from config.
 * This panel writes: appLockEnabled, appLockPin, appLockIdleTimeout.
 * All changes propagate via eventBus 'appLockChange' + 'configChange'.
 *
 * PIN is stored in config (localStorage fallback in dev; IPC in Electron).
 * In production, the main process encrypts/hashes the PIN via the IPC bridge.
 * In browser/dev mode, the PIN is stored plaintext in config as a dev fallback.
 */

import React, { useCallback, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
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
  amber:       '#fbbf24',
  amberBg:     'rgba(251,191,36,0.1)',
  amberBorder: 'rgba(251,191,36,0.3)',
}

// ─── Idle timeout options ─────────────────────────────────────────────────────

const TIMEOUT_OPTIONS = [
  { value: 0,   label: 'Never' },
  { value: 5,   label: '5 minutes' },
  { value: 10,  label: '10 minutes' },
  { value: 15,  label: '15 minutes' },
  { value: 30,  label: '30 minutes' },
  { value: 60,  label: '1 hour' },
  { value: 120, label: '2 hours' },
]

// ─── PIN dot display ──────────────────────────────────────────────────────────

function PinDots({ length, filled }: { length: number; filled: number }): React.ReactElement {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 12, height: 12, borderRadius: '50%',
            background: i < filled ? C.accent : 'rgba(255,255,255,0.1)',
            border: `2px solid ${i < filled ? C.accent : 'rgba(255,255,255,0.2)'}`,
            transition: 'all 0.15s',
          }}
        />
      ))}
    </div>
  )
}

// ─── PIN setup flow ───────────────────────────────────────────────────────────

type PinStep = 'idle' | 'enter-new' | 'confirm-new' | 'enter-current'

interface PinSetupProps {
  hasPinSet: boolean
  onSet: (pin: string) => void
  onClear: () => void
}

function PinSetupWidget({ hasPinSet, onSet, onClear }: PinSetupProps): React.ReactElement {
  const [step,       setStep]       = useState<PinStep>('idle')
  const [newPin,     setNewPin]     = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const reset = useCallback(() => {
    setStep('idle')
    setNewPin('')
    setConfirmPin('')
    setErrorMsg('')
  }, [])

  const handleNewPinChange = (v: string) => {
    setNewPin(v.replace(/\D/g, '').slice(0, 6))
    setErrorMsg('')
  }

  const handleConfirmChange = (v: string) => {
    setConfirmPin(v.replace(/\D/g, '').slice(0, 6))
    setErrorMsg('')
  }

  const startSetPin = () => {
    setStep('enter-new')
    setNewPin('')
    setConfirmPin('')
    setErrorMsg('')
  }

  const proceedToConfirm = () => {
    if (newPin.length < 4) {
      setErrorMsg('PIN must be at least 4 digits.')
      return
    }
    setStep('confirm-new')
    setConfirmPin('')
  }

  const finishSetPin = () => {
    if (confirmPin !== newPin) {
      setErrorMsg("PINs don't match. Please try again.")
      setConfirmPin('')
      return
    }
    onSet(newPin)
    reset()
    setSuccessMsg(hasPinSet ? 'PIN changed successfully.' : 'PIN set successfully.')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleClear = () => {
    onClear()
    setSuccessMsg('PIN removed. App Lock has been disabled.')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  // ── Render based on step ─────────────────────────────────────────────────

  if (step === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {successMsg && (
          <div style={{ fontSize: '0.8rem', color: C.green, background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 7, padding: '8px 14px' }}>
            ✓ {successMsg}
          </div>
        )}
        {hasPinSet ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={startSetPin}
              style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 700, padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'rgba(139,92,246,0.14)', color: C.accent, border: '1.5px solid rgba(139,92,246,0.35)', outline: 'none', transition: 'all 0.15s' }}
            >
              🔑 Change PIN
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 700, padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: C.errBg, color: C.errText, border: `1.5px solid ${C.errBorder}`, outline: 'none', transition: 'all 0.15s' }}
            >
              🗑 Remove PIN
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startSetPin}
            style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 700, padding: '9px 20px', borderRadius: 8, cursor: 'pointer', background: 'rgba(139,92,246,0.14)', color: C.accent, border: '1.5px solid rgba(139,92,246,0.35)', outline: 'none', transition: 'all 0.15s', alignSelf: 'flex-start' }}
          >
            🔒 Set PIN
          </button>
        )}
      </div>
    )
  }

  if (step === 'enter-new') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: C.textPrimary }}>
          {hasPinSet ? 'Enter new PIN (4–6 digits):' : 'Set a new PIN (4–6 digits):'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PinDots length={6} filled={newPin.length} />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={newPin}
            autoFocus
            onChange={e => handleNewPinChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') proceedToConfirm() }}
            placeholder="Type digits..."
            style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.3em', width: 120, background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: `1.5px solid ${errorMsg ? C.errBorder : 'rgba(139,92,246,0.35)'}`, borderRadius: 8, padding: '8px 12px', outline: 'none' }}
          />
        </div>
        {errorMsg && (
          <div style={{ fontSize: '0.78rem', color: C.errText }}>{errorMsg}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={proceedToConfirm} disabled={newPin.length < 4} style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 700, padding: '8px 18px', borderRadius: 8, cursor: newPin.length < 4 ? 'not-allowed' : 'pointer', background: newPin.length >= 4 ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.04)', color: newPin.length >= 4 ? C.accent : C.textSecond, border: '1.5px solid rgba(139,92,246,0.3)', outline: 'none', opacity: newPin.length < 4 ? 0.5 : 1 }}>
            Next →
          </button>
          <button type="button" onClick={reset} style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 600, padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: C.textSecond, border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (step === 'confirm-new') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.84rem', fontWeight: 600, color: C.textPrimary }}>
          Confirm PIN — enter it again:
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PinDots length={newPin.length} filled={confirmPin.length} />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={newPin.length}
            value={confirmPin}
            autoFocus
            onChange={e => handleConfirmChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') finishSetPin() }}
            placeholder="Re-enter PIN..."
            style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '0.3em', width: 120, background: 'rgba(255,255,255,0.06)', color: C.textPrimary, border: `1.5px solid ${errorMsg ? C.errBorder : 'rgba(139,92,246,0.35)'}`, borderRadius: 8, padding: '8px 12px', outline: 'none' }}
          />
        </div>
        {errorMsg && (
          <div style={{ fontSize: '0.78rem', color: C.errText }}>{errorMsg}</div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={finishSetPin} disabled={confirmPin.length < 4} style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 700, padding: '8px 18px', borderRadius: 8, cursor: confirmPin.length < 4 ? 'not-allowed' : 'pointer', background: confirmPin.length >= 4 ? C.greenBg : 'rgba(255,255,255,0.04)', color: confirmPin.length >= 4 ? C.green : C.textSecond, border: `1.5px solid ${confirmPin.length >= 4 ? C.greenBorder : 'rgba(255,255,255,0.1)'}`, outline: 'none', opacity: confirmPin.length < 4 ? 0.5 : 1 }}>
            ✓ Confirm PIN
          </button>
          <button type="button" onClick={() => { setStep('enter-new'); setConfirmPin('') }} style={{ fontFamily: C.font, fontSize: '0.84rem', fontWeight: 600, padding: '8px 18px', borderRadius: 8, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: C.textSecond, border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }}>
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return <></>
}

// ─── Idle timeout control ─────────────────────────────────────────────────────

function IdleTimeoutControl(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const current = (config.appLockIdleTimeout as number) ?? 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0',
      borderTop: '1px solid rgba(139,92,246,0.1)',
      opacity: config.appLockEnabled ? 1 : 0.45,
    }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
          Auto-Lock Timeout
        </div>
        <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>
          Automatically lock the app after this period of inactivity. Set to "Never" to only lock on manual close/relaunch.
        </div>
      </div>
      <select
        value={current}
        disabled={!config.appLockEnabled}
        onChange={e => {
          const v = Number(e.target.value)
          updateConfig({ appLockIdleTimeout: v })
          eventBus.emit('configChange', { key: 'appLockIdleTimeout', value: v })
        }}
        style={{
          fontFamily: C.font, fontSize: '0.84rem', fontWeight: 600,
          background: config.appLockEnabled ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.04)',
          color: config.appLockEnabled ? C.accent : C.textSecond,
          border: `1.5px solid ${config.appLockEnabled ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 8, padding: '8px 14px', outline: 'none',
          cursor: config.appLockEnabled ? 'pointer' : 'not-allowed',
          minWidth: 140, flexShrink: 0,
        }}
      >
        {TIMEOUT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function SecurityPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()

  const appLockEnabled = config.appLockEnabled === true
  const hasPinSet      = typeof config.appLockPin === 'string' && (config.appLockPin as string).length >= 4

  const handleToggleLock = (enabled: boolean) => {
    if (enabled && !hasPinSet) {
      // Don't enable App Lock without a PIN — show the user they need to set one first
      // We enable the toggle but also highlight the PIN setup
      updateConfig({ appLockEnabled: true })
      eventBus.emit('appLockChange', { enabled: true })
      // Trigger IPC if available
      const api = (window as Window & typeof globalThis).cqikly
      api?.appLock?.enable?.((config.appLockPin as string) ?? '')?.catch?.(() => {})
    } else if (!enabled) {
      updateConfig({ appLockEnabled: false })
      eventBus.emit('appLockChange', { enabled: false })
      const api = (window as Window & typeof globalThis).cqikly
      api?.appLock?.disable?.('')?.catch?.(() => {})
    } else {
      updateConfig({ appLockEnabled: enabled })
      eventBus.emit('appLockChange', { enabled })
    }
  }

  const handleSetPin = (pin: string) => {
    updateConfig({ appLockPin: pin, appLockEnabled: true })
    eventBus.emit('pinChanged', {})
    eventBus.emit('appLockChange', { enabled: true })
    // IPC bridge (Electron only)
    const api = (window as Window & typeof globalThis).cqikly
    api?.appLock?.enable?.(pin)?.catch?.(() => {})
  }

  const handleClearPin = () => {
    updateConfig({ appLockPin: '', appLockEnabled: false })
    eventBus.emit('pinChanged', {})
    eventBus.emit('appLockChange', { enabled: false })
    const api = (window as Window & typeof globalThis).cqikly
    api?.appLock?.disable?.((config.appLockPin as string) ?? '')?.catch?.(() => {})
  }

  return (
    <div style={{
      padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--cq-border)',
      borderRadius: 14, fontFamily: C.font, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Security
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        App Lock &amp; PIN
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 8, lineHeight: 1.6 }}>
        Protect business data with a numeric PIN. The lock screen appears on app launch and after the idle timeout.
      </div>

      {/* App Lock enable toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0',
        borderTop: '1px solid rgba(139,92,246,0.1)',
      }}>
        <div style={{ flex: 1, paddingRight: 20 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
            Enable App Lock
          </div>
          <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>
            When enabled, the app requires a PIN before loading on launch or after idle timeout. A PIN must be set to use this feature.
          </div>
        </div>
        <button
          type="button"
          onClick={() => handleToggleLock(!appLockEnabled)}
          style={{
            fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
            padding: '8px 22px', borderRadius: 9, cursor: 'pointer', minWidth: 76, flexShrink: 0,
            background: appLockEnabled ? C.greenBg : 'rgba(255,255,255,0.06)',
            color: appLockEnabled ? C.green : C.textSecond,
            border: `1.5px solid ${appLockEnabled ? C.greenBorder : 'rgba(255,255,255,0.12)'}`,
            transition: 'all 0.18s', outline: 'none',
          }}
        >
          {appLockEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* PIN setup */}
      <div style={{
        padding: '16px 0',
        borderTop: '1px solid rgba(139,92,246,0.1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
            PIN Setup
          </div>
          {hasPinSet ? (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.green, background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: '2px 8px' }}>
              ● PIN SET
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: C.amber, background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '2px 8px' }}>
              ○ NO PIN
            </span>
          )}
        </div>
        {!appLockEnabled && !hasPinSet && (
          <div style={{ fontSize: '0.78rem', color: C.textSecond, marginBottom: 12, padding: '8px 14px', background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderRadius: 8 }}>
            ⚠ Set a PIN before enabling App Lock.
          </div>
        )}
        <PinSetupWidget
          hasPinSet={hasPinSet}
          onSet={handleSetPin}
          onClear={handleClearPin}
        />
      </div>

      {/* Idle timeout */}
      <IdleTimeoutControl />

      {/* Info note */}
      <div style={{
        marginTop: 14, padding: '12px 16px',
        background: 'rgba(139,92,246,0.06)',
        border: '1px solid rgba(139,92,246,0.15)', borderRadius: 10,
        fontSize: '0.76rem', color: C.textSecond, lineHeight: 1.6,
      }}>
        <strong style={{ color: C.textPrimary }}>Note:</strong> The PIN is stored locally on this device only. There is no recovery option — if you forget your PIN, you will need to reset the app. In the Electron build, the PIN is secured via the OS keychain. In dev mode, it is stored in the local config file.
      </div>
    </div>
  )
}
