/**
 * cQikly — Renderer-side type augmentation for window.cqikly
 * Phase: 1a-i-B
 *
 * The actual implementation is in src/main/preload.ts.
 * This file extends the Window interface so renderer TypeScript
 * can safely access window.cqikly with full type checking.
 */

// This export exists only to make TypeScript treat this as a module.
// The important part is the global augmentation below.
export declare const cqiklyAPI: Window['cqikly']

declare global {
  interface Window {
    cqikly: {
      db: {
        query: (sql: string, params?: unknown[]) => Promise<unknown>
        run: (sql: string, params?: unknown[]) => Promise<{ changes: number; lastInsertRowid: number }>
        getActivePath: () => Promise<string>
        swap: (newDbPath: string) => Promise<void>
        getMigrationVersion: () => Promise<number>
      }
      pdf: {
        generate: (billData: unknown, format: string, options?: unknown) => Promise<string>
        chooseSavePath: (defaultName: string) => Promise<string | null>
        captureImage: (htmlString: string, options?: { width?: number; height?: number }) => Promise<string | null>
        writeClipboardImage: (base64Png: string) => Promise<boolean>
        silentPrint: (htmlString: string, options?: { pageSize?: 'A5' | 'A4' }) => Promise<boolean>
      }
      settings: {
        read: () => Promise<Record<string, unknown>>
        write: (patch: Record<string, unknown>) => Promise<void>
        reset: () => Promise<void>
        getAppDataPath: () => Promise<string>
      }
      updater: {
        checkForUpdate: () => Promise<{ available: boolean; version?: string }>
        installUpdate: () => void
        onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
        onDownloadProgress: (cb: (progress: number) => void) => () => void
      }
      crashRecovery: {
        hasDraft: () => Promise<boolean>
        readDraft: () => Promise<unknown>
        saveDraft: (draft: unknown) => Promise<void>
        clearDraft: () => Promise<void>
        onDraftFound: (cb: (payload: {
          hasDraft: boolean
          summary?: { partyName?: string; billDate?: string; itemCount?: number }
        }) => void) => () => void
      }
      appLock: {
        isEnabled: () => Promise<boolean>
        verify: (pin: string) => Promise<boolean>
        enable: (pin: string) => Promise<void>
        disable: (pin: string) => Promise<void>
        changePIN: (oldPin: string, newPin: string) => Promise<void>
      }
      app: {
        getVersion: () => Promise<string>
        openFolder: (folderPath: string) => Promise<void>
        openFileDialog: (options?: unknown) => Promise<string[] | null>
        minimize: () => void
        close: () => void
        sessionLog: (event: string, data?: Record<string, unknown>) => void
      }
      backup: {
        create: (options?: { destination?: string }) => Promise<{ success: boolean; path?: string; filename?: string; error?: string }>
        restore: (zipPath: string) => Promise<void>
        swapDb: (dbPath: string) => Promise<void>
        scheduleSet: (schedule: 'daily' | 'weekly' | 'off', destination?: string) => Promise<void>
      }
      image: {
        pick: () => Promise<string | null>
        copyToAppData: (srcPath: string, itemId: string) => Promise<string | null>
        readAsDataUrl: (filePath: string) => Promise<string | null>
        delete: (filePath: string) => Promise<boolean>
      }
    }
  }
}
