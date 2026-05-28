/**
 * cQikly — Auto-Updater
 * Phase: 1b-A
 *
 * PURPOSE:
 *   Wires electron-updater to auto-check for updates on every launch.
 *   Notifies the renderer via IPC push so it can show a non-blocking toast.
 *   Download happens silently in the background.
 *   One-click install from the toast → quitAndInstall().
 *
 * ARCHITECTURE:
 *   - initUpdater()       — call once in main/index.ts after window is created
 *   - autoUpdater events  — push IPC to renderer (UPDATER_AVAILABLE, UPDATER_PROGRESS)
 *   - IPC handlers        — renderer calls updater:checkForUpdate / updater:installUpdate
 *
 * PRODUCTION NOTE:
 *   autoUpdater requires a configured update feed URL (publish config in electron-builder).
 *   In development / when no publish config is set, it throws — we catch and log silently.
 *   The updater is designed to be completely non-blocking: any failure is swallowed
 *   so billing operations are never affected.
 *
 * DEPENDENCIES:
 *   electron-updater (already in package.json)
 *   IpcChannels from ./ipc/index
 */

import { BrowserWindow } from 'electron'
import { IpcChannels } from './ipc/index'
import { sessionLogger } from './sessionLogger'

// ─── Lazy-load electron-updater ───────────────────────────────────────────────
// We lazy-require so that if electron-updater is misconfigured (no feed URL)
// it doesn't crash the import chain on dev startup.

type AutoUpdaterType = typeof import('electron-updater').autoUpdater

let autoUpdater: AutoUpdaterType | null = null

function getAutoUpdater(): AutoUpdaterType | null {
  if (autoUpdater) return autoUpdater
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    autoUpdater = require('electron-updater').autoUpdater as AutoUpdaterType
    return autoUpdater
  } catch (err) {
    console.warn('[Updater] electron-updater load failed:', err)
    return null
  }
}

// ─── Push helpers ─────────────────────────────────────────────────────────────

/** Send an IPC event to all open renderer windows. */
function pushToRenderer(channel: string, ...args: unknown[]): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the auto-updater and wire all event listeners.
 * Call once after the main BrowserWindow is created and shown.
 *
 * The updater will:
 *   1. Silently check for updates on launch
 *   2. Push UPDATER_AVAILABLE to renderer if a new version is found
 *   3. Download silently in the background
 *   4. Push UPDATER_PROGRESS during download
 *   5. quitAndInstall() when the renderer calls updater:installUpdate
 */
export function initUpdater(): void {
  const updater = getAutoUpdater()
  if (!updater) {
    console.log('[Updater] Not available in this environment — skipping')
    return
  }

  try {
    // ── Configuration ──────────────────────────────────────────────────────
    // Auto-download in background — no user interaction needed to start download
    updater.autoDownload          = true
    // Do NOT auto-install — we show a toast and let the user decide when to restart
    updater.autoInstallOnAppQuit  = false

    // ── Events ────────────────────────────────────────────────────────────

    updater.on('checking-for-update', () => {
      console.log('[Updater] Checking for update…')
    })

    updater.on('update-available', (info) => {
      console.log(`[Updater] Update available: v${info.version}`)
      sessionLogger.log('UPDATE_AVAILABLE', { version: info.version })
      // Push to renderer → shows a non-blocking toast
      pushToRenderer(IpcChannels.UPDATER_AVAILABLE, { version: info.version })
    })

    updater.on('update-not-available', () => {
      console.log('[Updater] App is up to date')
      sessionLogger.log('UPDATE_CHECKED', { result: 'up-to-date' })
    })

    updater.on('download-progress', (progress) => {
      // Push progress percentage to renderer for optional progress display
      pushToRenderer(IpcChannels.UPDATER_PROGRESS, Math.round(progress.percent))
    })

    updater.on('update-downloaded', (info) => {
      console.log(`[Updater] Update v${info.version} downloaded — ready to install`)
      // Re-push the available event so the renderer can prompt "ready to install"
      pushToRenderer(IpcChannels.UPDATER_AVAILABLE, {
        version: info.version,
        readyToInstall: true,
      })
    })

    updater.on('error', (err) => {
      // Log quietly — updater errors must never surface as blocking dialogs
      console.warn('[Updater] Error (non-fatal):', err?.message ?? err)
    })

    // ── Trigger the initial check ─────────────────────────────────────────
    // Wrapped in a timeout so it doesn't compete with the window ready event
    setTimeout(() => {
      updater?.checkForUpdates().catch((err: unknown) => {
        // In dev mode or with no publish config this always throws — swallow silently
        console.warn('[Updater] checkForUpdates() — expected in dev mode:', (err as Error)?.message)
      })
    }, 3000) // 3-second delay after launch

  } catch (err) {
    // Catch-all: updater setup failure must never affect app startup
    console.warn('[Updater] Setup error (non-fatal):', err)
  }
}

/**
 * Trigger a manual update check from the IPC handler.
 * Returns { available: false } if no update or if updater is not configured.
 */
export async function checkForUpdateManual(): Promise<{ available: boolean; version?: string }> {
  const updater = getAutoUpdater()
  if (!updater) return { available: false }

  try {
    const result = await updater.checkForUpdates()
    if (result?.updateInfo?.version) {
      return { available: true, version: result.updateInfo.version }
    }
    return { available: false }
  } catch {
    return { available: false }
  }
}

/**
 * Quit the app and install the downloaded update.
 * Called from the updater IPC handler when the user clicks "Install now" in the toast.
 */
export function installUpdateNow(): void {
  const updater = getAutoUpdater()
  if (!updater) return

  try {
    sessionLogger.log('UPDATE_INSTALLED', {})
    updater.quitAndInstall(false, true) // isSilent=false, isForceRunAfter=true
  } catch (err) {
    console.warn('[Updater] quitAndInstall() error:', err)
  }
}
