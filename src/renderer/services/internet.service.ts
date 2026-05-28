/**
 * cQikly — Internet Detection Service
 * Built in: Phase 2b
 *
 * Provides internet connectivity detection for the onboarding flow.
 *
 * Architecture:
 *   - checkConnection(): one-shot check → resolves true/false
 *   - watchConnection(cb): subscribes to live online/offline events
 *   - Uses navigator.onLine — the OS network state, accurate in Electron.
 *
 * NOTE: fetch-based ping targets were removed. Electron's CSP blocks all
 * cross-origin fetch from the renderer process regardless of actual internet
 * state, causing every ping to fail with a CSP violation. navigator.onLine
 * is set by the OS and is the correct signal for a desktop Electron app.
 *
 * Used by: OnboardingPage (gate before wizard), mid-fill detection
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConnectionStatus = 'online' | 'offline' | 'checking'

export interface ConnectionWatcher {
  /** Unsubscribe from live connection events */
  stop: () => void
}

// ─── Core check ───────────────────────────────────────────────────────────────

/**
 * Check if the device has active internet.
 * Returns navigator.onLine — the OS-level network state.
 * Accurate and instant; no fetch required (and fetch is CSP-blocked in Electron).
 */
export async function checkConnection(): Promise<boolean> {
  return navigator.onLine
}

// ─── Live watcher ─────────────────────────────────────────────────────────────

/**
 * Subscribe to live connection status changes.
 * Fires immediately with the current state, then on every change.
 *
 * @param onStatusChange - callback with new status
 * @param pollIntervalMs - how often to re-check even if no browser event fires (default 5s)
 * @returns ConnectionWatcher with a stop() method
 */
export function watchConnection(
  onStatusChange: (status: ConnectionStatus) => void,
  pollIntervalMs = 5000
): ConnectionWatcher {
  let stopped = false
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function doCheck() {
    if (stopped) return
    const online = await checkConnection()
    if (!stopped) {
      onStatusChange(online ? 'online' : 'offline')
    }
  }

  // Immediate check
  doCheck()

  // Browser events for fast response
  const handleOnline  = () => { if (!stopped) onStatusChange('online') }
  const handleOffline = () => { if (!stopped) onStatusChange('offline') }

  window.addEventListener('online',  handleOnline)
  window.addEventListener('offline', handleOffline)

  // Polling as belt-and-suspenders (catches flaky connections browser events miss)
  pollTimer = setInterval(doCheck, pollIntervalMs)

  return {
    stop() {
      stopped = true
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
    },
  }
}
