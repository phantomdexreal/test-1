/**
 * cQikly — IPC Handler: Crash Recovery
 * Phase: 1a-i-B
 *
 * Handles crash:* IPC channels for the single-slot crash draft system.
 * Only the most recent unsaved bill draft is kept (per Hard Spec #7).
 * Draft is stored as a JSON file in AppData.
 */

import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { IpcChannels } from '../index'

function getDraftPath(): string {
  return path.join(app.getPath('userData'), 'crash_draft.json')
}

export function registerCrashRecoveryHandlers(): void {
  // ── crash:hasDraft ────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.CRASH_HAS_DRAFT, () => {
    return fs.existsSync(getDraftPath())
  })

  // ── crash:readDraft ───────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.CRASH_READ_DRAFT, () => {
    const draftPath = getDraftPath()
    if (!fs.existsSync(draftPath)) return null
    try {
      return JSON.parse(fs.readFileSync(draftPath, 'utf-8'))
    } catch {
      return null
    }
  })

  // ── crash:saveDraft ───────────────────────────────────────────────────────
  // Overwrites the single draft slot — only the most recent is kept.
  ipcMain.handle(IpcChannels.CRASH_SAVE_DRAFT, (_event, draft: unknown) => {
    const dir = path.dirname(getDraftPath())
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getDraftPath(), JSON.stringify(draft), 'utf-8')
  })

  // ── crash:clearDraft ──────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.CRASH_CLEAR_DRAFT, () => {
    const draftPath = getDraftPath()
    if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath)
  })
}
