/**
 * cQikly — Preload Script
 * Phase: 1a-i-B
 *
 * The preload script runs in a privileged context and acts as a secure bridge
 * between the Electron main process and the React renderer.
 *
 * Rules:
 *  - Only expose what the renderer strictly needs (contextBridge)
 *  - Never expose ipcRenderer directly — only typed, named wrappers
 *  - All channel names are typed via IpcChannels
 *
 * The exposed `window.cqikly` API gives the renderer access to all IPC calls
 * without granting full Node.js or Electron access.
 */

import { contextBridge, ipcRenderer } from 'electron'

// ─── Typed IPC invoke helper ───────────────────────────────────────────────────

/**
 * Generic IPC invoke wrapper — renderer calls this, main process handles it.
 * Returns a Promise that resolves with the result from the main handler.
 */
function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args)
}

/**
 * One-way send from renderer to main (fire-and-forget).
 */
function send(channel: string, ...args: unknown[]): void {
  ipcRenderer.send(channel, ...args)
}

/**
 * Subscribe to events pushed from main → renderer.
 * Returns an unsubscribe function.
 *
 * FIX-19: Capture the wrapper reference so removeListener removes the correct
 * function. Previously, the anonymous wrapper was registered but the original
 * listener was passed to removeListener — a no-op due to strict ref equality.
 */
function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
  ipcRenderer.on(channel, wrapper)
  return () => ipcRenderer.removeListener(channel, wrapper)
}

// ─── Exposed API ──────────────────────────────────────────────────────────────

/**
 * The full cQikly renderer API.
 * Every IPC channel the renderer needs must be listed here — nothing else passes through.
 */
const cqiklyAPI = {
  // ── Database ──────────────────────────────────────────────────────────────
  db: {
    /** Run a named query. Used by db.service.ts for all DB operations. */
    query: (sql: string, params?: unknown[]) =>
      invoke<unknown>('db:query', sql, params),
    /** Run a named write operation (insert/update/delete). */
    run: (sql: string, params?: unknown[]) =>
      invoke<{ changes: number; lastInsertRowid: number }>('db:run', sql, params),
    /** Get the currently active database file path. */
    getActivePath: () => invoke<string>('db:getActivePath'),
    /** Atomically swap the active database to a new file path. */
    swap: (newDbPath: string) => invoke<void>('db:swap', newDbPath),
    /** Get migration version info. */
    getMigrationVersion: () => invoke<number>('db:getMigrationVersion'),
  },

  // ── PDF ───────────────────────────────────────────────────────────────────
  pdf: {
    /** Generate a PDF from bill data. Returns the saved file path. */
    generate: (billData: unknown, format: string, options?: unknown) =>
      invoke<string>('pdf:generate', billData, format, options),
    /** Open a Save dialog and return the chosen path. */
    chooseSavePath: (defaultName: string) =>
      invoke<string | null>('pdf:chooseSavePath', defaultName),
    /**
     * Render HTML in a hidden window and capture as a base64 PNG image.
     * Used for Copy Image / Copy Simplified Image buttons.
     */
    captureImage: (htmlString: string, options?: { width?: number; height?: number }) =>
      invoke<string | null>('pdf:captureImage', htmlString, options),
    /**
     * Write a base64-encoded PNG to the system clipboard as an image.
     * Returns true on success.
     */
    writeClipboardImage: (base64Png: string) =>
      invoke<boolean>('pdf:writeClipboardImage', base64Png),
    /**
     * Silent print — renders HTML and sends to printer without any dialog.
     * Used for Quick Print (Simplified format, A5 default).
     */
    silentPrint: (htmlString: string, options?: { pageSize?: 'A5' | 'A4' }) =>
      invoke<boolean>('pdf:silentPrint', htmlString, options),
  },

  // ── Settings / Config ─────────────────────────────────────────────────────
  settings: {
    /** Read the full settings config file from AppData. */
    read: () => invoke<Record<string, unknown>>('settings:read'),
    /** Write a partial update to the settings config file. */
    write: (patch: Record<string, unknown>) => invoke<void>('settings:write', patch),
    /** Reset settings to factory defaults. */
    reset: () => invoke<void>('settings:reset'),
    /** Get the AppData directory path for this app. */
    getAppDataPath: () => invoke<string>('settings:getAppDataPath'),
  },

  // ── Updater ───────────────────────────────────────────────────────────────
  updater: {
    /** Check if an update is available. */
    checkForUpdate: () => invoke<{ available: boolean; version?: string }>('updater:checkForUpdate'),
    /** Download and install the pending update (triggers restart). */
    installUpdate: () => send('updater:installUpdate'),
    /** Listen for update-available events pushed from main. */
    onUpdateAvailable: (cb: (info: { version: string }) => void) =>
      on('updater:updateAvailable', cb as (...args: unknown[]) => void),
    /** Listen for download-progress events. */
    onDownloadProgress: (cb: (progress: number) => void) =>
      on('updater:downloadProgress', cb as (...args: unknown[]) => void),
  },

  // ── Crash Recovery ────────────────────────────────────────────────────────
  crashRecovery: {
    /** Check if a recoverable draft exists from the last session. */
    hasDraft: () => invoke<boolean>('crash:hasDraft'),
    /** Read the most recent crash draft. */
    readDraft: () => invoke<unknown>('crash:readDraft'),
    /** Save the current bill state as a crash-recovery draft. */
    saveDraft: (draft: unknown) => invoke<void>('crash:saveDraft', draft),
    /** Clear the crash draft (e.g., after the user discards it). */
    clearDraft: () => invoke<void>('crash:clearDraft'),
    /**
     * Listen for the draft-found push event from main on launch.
     * Fires once after app starts if an unsaved draft was detected.
     * Returns an unsubscribe function.
     */
    onDraftFound: (cb: (payload: {
      hasDraft: boolean
      summary?: { partyName?: string; billDate?: string; itemCount?: number }
    }) => void) =>
      on('crash:draftFoundOnLaunch', cb as (...args: unknown[]) => void),
  },

  // ── App Lock (PIN) ────────────────────────────────────────────────────────
  appLock: {
    /** Check if app lock is enabled. */
    isEnabled: () => invoke<boolean>('appLock:isEnabled'),
    /** Verify a PIN attempt. */
    verify: (pin: string) => invoke<boolean>('appLock:verify', pin),
    /** Enable app lock with a new PIN. */
    enable: (pin: string) => invoke<void>('appLock:enable', pin),
    /** Disable app lock (requires current PIN). */
    disable: (pin: string) => invoke<void>('appLock:disable', pin),
    /** Change PIN. */
    changePIN: (oldPin: string, newPin: string) =>
      invoke<void>('appLock:changePIN', oldPin, newPin),
  },

  // ── App Utilities ─────────────────────────────────────────────────────────
  app: {
    /** Get the current app version. */
    getVersion: () => invoke<string>('app:getVersion'),
    /** Open a folder in the OS file explorer. */
    openFolder: (folderPath: string) => invoke<void>('app:openFolder', folderPath),
    /** Show a native OS open-file dialog. */
    openFileDialog: (options?: unknown) => invoke<string[] | null>('app:openFileDialog', options),
    /** Minimise the main window. */
    minimize: () => send('app:minimize'),
    /** Close the main window (triggers unsaved changes guard in renderer first). */
    close: () => send('app:close'),
    /**
     * Log a session event from the renderer.
     * The main process writes it to the AppData session log file.
     * Use this for all user-initiated events (bill saved, customer added, etc.)
     */
    sessionLog: (event: string, data?: Record<string, unknown>) =>
      send('app:sessionLog', event, data),
  },

  // ── Backup (FIX-21) ───────────────────────────────────────────────────────
  // NOTE: restore and swapDb accept file path strings, not File objects.
  // File objects are renderer-side Web API objects that cannot cross the IPC bridge.
  // The renderer must obtain a path (e.g. via app.openFileDialog) and pass that string.
  backup: {
    /** Create a backup ZIP. Returns result with path/filename on success. */
    create: (options?: { destination?: string }) =>
      invoke<{ success: boolean; path?: string; filename?: string; error?: string }>(
        'backup:create', options
      ),
    /** Restore from a backup ZIP at the given file path. */
    restore: (zipPath: string) =>
      invoke<void>('backup:restore', zipPath),
    /** Hot-swap the active DB with the .db file at the given file path. */
    swapDb: (dbPath: string) =>
      invoke<void>('backup:swapDb', dbPath),
    /** Apply a new auto-backup schedule (and optional destination folder). */
    scheduleSet: (schedule: 'daily' | 'weekly' | 'off', destination?: string) =>
      invoke<void>('backup:scheduleSet', schedule, destination),
  },

  // ── Item Images (Phase 9b-B-i) ────────────────────────────────────────────
  image: {
    /** Show native OS file picker filtered to images → returns chosen path or null. */
    pick: () => invoke<string | null>('image:pick'),
    /** Copy a file at srcPath into AppData/item-images/ for item with itemId → returns dest path. */
    copyToAppData: (srcPath: string, itemId: string) =>
      invoke<string | null>('image:copyToAppData', srcPath, itemId),
    /** Read file at filePath and return as a base64 data URL (for img src). */
    readAsDataUrl: (filePath: string) =>
      invoke<string | null>('image:readAsDataUrl', filePath),
    /** Delete image file at filePath from AppData. */
    delete: (filePath: string) =>
      invoke<boolean>('image:delete', filePath),
  },
} as const

// Expose the API on window.cqikly — accessible in renderer without nodeIntegration
contextBridge.exposeInMainWorld('cqikly', cqiklyAPI)

// ─── TypeScript augmentation (used by renderer tsconfig) ──────────────────────
// The renderer references this type via window.cqikly
export type CQiklyAPI = typeof cqiklyAPI
