/**
 * cQikly — Crash Recovery / Autosave Draft Detection
 * Phase: 1b-A
 *
 * PURPOSE:
 *   On every launch, checks AppData for an unsaved bill draft file.
 *   If found, pushes an IPC event to the renderer so it can show a
 *   non-blocking restore/discard prompt.
 *
 * RULES (Hard Spec #7):
 *   Only ONE draft slot. Only the most recent unsaved bill is recoverable.
 *   If multiple bills were in progress before a crash, only the last one
 *   written to the slot is recoverable. There is no draft history.
 *
 * DRAFT FILE:
 *   Location: {AppData}/crash_draft.json
 *   Format:   JSON — the full in-memory bill state at time of last autosave
 *   Written:  By the renderer via crash:saveDraft IPC (wired in Phase 3+)
 *   Cleared:  By the renderer via crash:clearDraft after restore OR discard
 *
 * FLOW:
 *   main/index.ts → checkForDraftOnLaunch() → if draft exists, push IPC to renderer
 *   Renderer shows restore/discard prompt (wired in CrashRecoveryPrompt component)
 *   User picks restore → renderer loads draft via crash:readDraft → crash:clearDraft
 *   User picks discard → renderer calls crash:clearDraft → draft deleted
 *
 * DEPENDENCIES:
 *   electron: app, BrowserWindow
 *   IpcChannels: for the push channel name
 *   sessionLogger: to record draft events
 */

import { app, BrowserWindow } from 'electron'
import fs from 'fs'
import path from 'path'
import { sessionLogger } from './sessionLogger'

// ─── IPC Channel ──────────────────────────────────────────────────────────────
// Defined here to avoid circular imports; also listed in IpcChannels for the preload.
export const CRASH_DRAFT_FOUND_CHANNEL = 'crash:draftFoundOnLaunch'

// ─── Draft path helper ────────────────────────────────────────────────────────

export function getDraftFilePath(): string {
  return path.join(app.getPath('userData'), 'crash_draft.json')
}

// ─── Launch check ─────────────────────────────────────────────────────────────

/**
 * Check for a crash draft on launch.
 * Call this from main/index.ts AFTER the window is shown (ready-to-show).
 * If a draft is found, pushes crash:draftFoundOnLaunch to the renderer.
 * The renderer handles showing the restore/discard prompt.
 */
export function checkForDraftOnLaunch(): void {
  try {
    const draftPath = getDraftFilePath()

    if (!fs.existsSync(draftPath)) {
      console.log('[CrashRecovery] No pending draft — clean launch')
      return
    }

    // Draft exists — validate it's parseable JSON before notifying renderer
    let draftData: unknown = null
    try {
      const raw = fs.readFileSync(draftPath, 'utf-8')
      draftData = JSON.parse(raw)
    } catch {
      // Corrupt draft — delete and log, don't bother the user
      console.warn('[CrashRecovery] Draft file is corrupt — deleting')
      fs.unlinkSync(draftPath)
      return
    }

    console.log('[CrashRecovery] Unsaved draft detected — notifying renderer')
    sessionLogger.log('BILL_DRAFT_SAVED', { recovered: true, source: 'launch-check' })

    // Push to renderer — window may not be shown yet so we retry after a delay
    pushDraftFoundToRenderer(draftData)
  } catch (err) {
    // Crash recovery must never prevent app launch
    console.warn('[CrashRecovery] checkForDraftOnLaunch() error (non-fatal):', err)
  }
}

/**
 * Push the draft-found notification to the renderer.
 * Retries once after 2 seconds in case the window is still loading.
 */
function pushDraftFoundToRenderer(draftData: unknown): void {
  // Small delay: renderer needs to be mounted and listening before we push
  setTimeout(() => {
    const windows = BrowserWindow.getAllWindows()
    let sent = false

    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(CRASH_DRAFT_FOUND_CHANNEL, {
          hasDraft: true,
          // Pass a lightweight summary so the renderer can show "Restore bill for Sharma Traders?"
          // Full draft is fetched via crash:readDraft IPC when the user clicks Restore
          summary: extractDraftSummary(draftData),
        })
        sent = true
      }
    }

    if (!sent) {
      // Retry once more — window may have been slow to show
      setTimeout(() => pushDraftFoundToRenderer(draftData), 2000)
    }
  }, 1500) // 1.5s after launch — enough for React to mount
}

/**
 * Extract a human-readable summary from the draft for the restore prompt.
 * Safe to call even on malformed drafts — always returns something sensible.
 */
function extractDraftSummary(draft: unknown): {
  partyName?: string
  billDate?: string
  itemCount?: number
} {
  try {
    if (typeof draft !== 'object' || draft === null) return {}
    const d = draft as Record<string, unknown>
    return {
      partyName: typeof d.partyName === 'string' ? d.partyName : undefined,
      billDate:  typeof d.billDate  === 'string' ? d.billDate  : undefined,
      itemCount: Array.isArray(d.rows) ? d.rows.length : undefined,
    }
  } catch {
    return {}
  }
}

// ─── IPC Handler: crash:saveDraft (called from preload, handled in crashRecovery.handler.ts) ───
// The handler already lives in ipc/handlers/crashRecovery.handler.ts and is complete from Phase 1a-i-B.
// This module provides the launch-check push logic only.
