/**
 * cQikly — UpdateToast
 * Phase: 1b-A
 *
 * PURPOSE:
 *   Listens for updater:updateAvailable IPC push events from the main process.
 *   Shows a non-blocking top-right toast when a new version is available.
 *   Shows "Download complete — click to install" when readyToInstall is true.
 *   One-click "Install & Restart" calls the updater:installUpdate IPC channel.
 *
 * DESIGN:
 *   - Non-blocking: always floats; never prevents billing operations
 *   - Auto-dismisses after 30 seconds if user does nothing (re-shown on next
 *     update event push from the main process)
 *   - Download in progress: shows a progress bar if the updater pushes % events
 *
 * DEPENDENCIES:
 *   window.cqikly.updater (IPC bridge)
 */

import React, { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastState = 'hidden' | 'update-available' | 'downloading' | 'ready-to-install'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Mount once high in the React tree.
 * Renders nothing until the main process pushes an update event.
 */
export function UpdateToast(): React.ReactElement | null {
  const [toastState,    setToastState]    = useState<ToastState>('hidden')
  const [version,       setVersion]       = useState<string>('')
  const [downloadPct,   setDownloadPct]   = useState<number>(0)
  const [isInstalling,  setIsInstalling]  = useState(false)

  // ── Subscribe to IPC events ────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) return

    // Update available (also fires when download is complete with readyToInstall: true)
    const unsubUpdate = api.updater.onUpdateAvailable((info: { version: string; readyToInstall?: boolean }) => {
      setVersion(info.version)
      if (info.readyToInstall) {
        setToastState('ready-to-install')
        setDownloadPct(100)
      } else {
        setToastState('update-available')
      }
    })

    // Download progress percentage
    const unsubProgress = api.updater.onDownloadProgress((pct: number) => {
      setDownloadPct(pct)
      setToastState('downloading')
    })

    return () => {
      if (typeof unsubUpdate   === 'function') unsubUpdate()
      if (typeof unsubProgress === 'function') unsubProgress()
    }
  }, [])

  // ── Auto-dismiss (update-available only; ready-to-install stays until acted on) ──
  useEffect(() => {
    if (toastState !== 'update-available') return
    const timer = setTimeout(() => setToastState('hidden'), 30_000)
    return () => clearTimeout(timer)
  }, [toastState])

  // ── Install ────────────────────────────────────────────────────────────────
  const handleInstall = useCallback(() => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) return
    setIsInstalling(true)
    api.app.sessionLog('UPDATE_INSTALLED', { version })
    api.updater.installUpdate()
    // App will quit and restart — no need to reset state
  }, [version])

  // ── Render nothing if hidden ───────────────────────────────────────────────
  if (toastState === 'hidden') return null

  // ── Toast content ──────────────────────────────────────────────────────────
  const isDownloading = toastState === 'downloading'
  const isReady       = toastState === 'ready-to-install'

  return (
    <div style={toastContainerStyles}>
      <div style={{
        ...toastStyles,
        borderColor: isReady ? '#22c55e44' : '#3b82f644',
        borderLeftColor: isReady ? '#22c55e' : '#3b82f6',
      }}>
        {/* Header row */}
        <div style={toastHeaderStyles}>
          <span style={toastIconStyles}>{isReady ? '✅' : '🔄'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={toastTitleStyles}>
              {isReady
                ? `cQikly v${version} ready to install`
                : isDownloading
                  ? `Downloading v${version}…`
                  : `Update available: v${version}`
              }
            </p>
            <p style={toastSubtitleStyles}>
              {isReady
                ? 'Restart now to apply the update'
                : isDownloading
                  ? 'Downloading in background'
                  : 'A new version is being downloaded'
              }
            </p>
          </div>
          {/* Dismiss (only for non-ready states) */}
          {!isReady && (
            <button
              onClick={() => setToastState('hidden')}
              style={dismissButtonStyles}
              title="Dismiss"
            >
              ×
            </button>
          )}
        </div>

        {/* Progress bar (visible while downloading) */}
        {(isDownloading || isReady) && (
          <div style={progressTrackStyles}>
            <div style={{
              ...progressFillStyles,
              width: `${downloadPct}%`,
              background: isReady ? '#22c55e' : 'var(--cq-accent, #3b82f6)',
            }} />
          </div>
        )}

        {/* Install button (visible when ready) */}
        {isReady && (
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            style={{
              ...installButtonStyles,
              opacity: isInstalling ? 0.7 : 1,
              cursor: isInstalling ? 'not-allowed' : 'pointer',
            }}
          >
            {isInstalling ? 'Restarting…' : 'Install & Restart'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const toastContainerStyles: React.CSSProperties = {
  position: 'fixed',
  top: '1.5rem',
  right: '1.5rem',
  zIndex: 9000,
  maxWidth: 380,
  width: 'calc(100vw - 3rem)',
}

const toastStyles: React.CSSProperties = {
  background: 'var(--cq-surface, #111827)',
  border: '1px solid #3b82f644',
  borderLeft: '4px solid #3b82f6',
  borderRadius: '0.75rem',
  padding: '1rem 1.25rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  animation: 'slideDownIn 0.25s ease',
}

const toastHeaderStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
}

const toastIconStyles: React.CSSProperties = {
  fontSize: '1.25rem',
  flexShrink: 0,
}

const toastTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--cq-text-primary, #e2e8f0)',
}

const toastSubtitleStyles: React.CSSProperties = {
  margin: '0.15rem 0 0',
  fontSize: '0.75rem',
  color: 'var(--cq-text-muted, #475569)',
}

const dismissButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--cq-text-muted, #475569)',
  fontSize: '1.2rem',
  cursor: 'pointer',
  padding: '0.1rem 0.3rem',
  lineHeight: 1,
  borderRadius: '0.3rem',
  flexShrink: 0,
}

const progressTrackStyles: React.CSSProperties = {
  height: 4,
  background: 'var(--cq-border, #1e293b)',
  borderRadius: 2,
  overflow: 'hidden',
}

const progressFillStyles: React.CSSProperties = {
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.3s ease',
}

const installButtonStyles: React.CSSProperties = {
  background: '#22c55e',
  color: '#000',
  border: 'none',
  borderRadius: '0.4rem',
  padding: '0.55rem 1rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  width: '100%',
  transition: 'opacity 0.15s ease',
}
