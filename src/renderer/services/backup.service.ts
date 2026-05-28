/**
 * cQikly — Backup Service
 * Phase 7b (initial), Phase 11b-ii (expanded)
 *
 * Responsibilities:
 *   - Trigger a manual backup (produces one ZIP containing all DB files + config + session log)
 *   - Set/update the auto backup schedule (daily / weekly / off) + destination folder
 *   - Returns path of the created backup file
 *
 * Architecture:
 *   - In Electron: delegates to main process via IPC (backup.handler.ts)
 *   - In browser/dev mode: simulates a backup with a mock response
 *
 * Hard Spec #25: Every backup (scheduled or manual) produces one ZIP containing:
 *   all SQLite DB files (active + all company/branch profiles) + config file + session activity log.
 * Hard Spec #18: Session activity log is in AppData — not surfaced in UI.
 */

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

export interface BackupResult {
  success: boolean
  path?: string
  filename?: string
  error?: string
}

/**
 * Trigger a manual backup immediately.
 * Optionally pass a destination folder override.
 */
export async function triggerManualBackup(destination?: string): Promise<BackupResult> {
  const ipc = getIpc()

  if (ipc) {
    try {
      const result = await ipc.backup.create(destination ? { destination } : undefined)
      return result
    } catch (err) {
      console.error('[BackupService] IPC backup failed:', err)
      return { success: false, error: String(err) }
    }
  }

  // ── Dev / browser mode: simulate backup ──────────────────────────────────
  await new Promise(r => setTimeout(r, 800))

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename  = `cQikly_Backup_${timestamp}.zip`
  const path      = destination
    ? `${destination}\\${filename}`
    : `C:\\Users\\User\\AppData\\Roaming\\cQikly\\backups\\${filename}`

  console.info('[BackupService] Dev mode: simulated backup →', path)
  return { success: true, path, filename }
}

/**
 * Apply a new auto-backup schedule to the main process.
 * Called whenever the user changes the schedule or destination in Settings.
 */
export async function setBackupSchedule(
  schedule: 'daily' | 'weekly' | 'off',
  destination?: string,
): Promise<void> {
  const ipc = getIpc()

  if (ipc) {
    try {
      await ipc.backup.scheduleSet(schedule, destination)
    } catch (err) {
      console.error('[BackupService] Failed to set schedule via IPC:', err)
    }
    return
  }

  // Dev mode — just log
  console.info(`[BackupService] Dev mode: schedule set to "${schedule}", dest: "${destination ?? 'default'}"`)
}
