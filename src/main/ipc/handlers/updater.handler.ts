/**
 * cQikly — IPC Handler: Auto-Updater
 * Phase: 1b-A (fully wired; server-side publish config added in Phase 14)
 *
 * Handles:
 *   updater:checkForUpdate  — manual check from renderer
 *   updater:installUpdate   — install downloaded update + restart
 *
 * Push events (main → renderer) are fired by updater.ts event listeners:
 *   updater:updateAvailable  — new version found
 *   updater:downloadProgress — % complete during background download
 */

import { ipcMain } from 'electron'
import { IpcChannels } from '../index'
import { checkForUpdateManual, installUpdateNow } from '../../updater'

export function registerUpdaterHandlers(): void {
  // ── updater:checkForUpdate ────────────────────────────────────────────────
  // Renderer calls this for a manual "Check for updates" button in Settings.
  ipcMain.handle(IpcChannels.UPDATER_CHECK, async () => {
    return await checkForUpdateManual()
  })

  // ── updater:installUpdate (fire-and-forget) ───────────────────────────────
  // Renderer calls this when user clicks "Install & Restart" in the toast.
  ipcMain.on(IpcChannels.UPDATER_INSTALL, () => {
    installUpdateNow()
  })
}
