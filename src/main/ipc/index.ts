/**
 * cQikly — IPC Handler Registry
 * Phase: 1a-i-B
 *
 * Registers ALL ipcMain handlers in one place.
 * Each domain (db, pdf, settings, updater, crash, appLock, app) is a separate handler module.
 *
 * Calling registerAllIpcHandlers() once in main/index.ts wires everything.
 * To add a new channel: create a handler in the relevant module and call it here.
 */

import { registerDbHandlers } from './handlers/db.handler'
import { registerPdfHandlers } from './handlers/pdf.handler'
import { registerSettingsHandlers } from './handlers/settings.handler'
import { registerUpdaterHandlers } from './handlers/updater.handler'
import { registerCrashRecoveryHandlers } from './handlers/crashRecovery.handler'
import { registerAppLockHandlers } from './handlers/appLock.handler'
import { registerAppHandlers } from './handlers/app.handler'

/**
 * Register every IPC handler with the main process.
 * Called once from main/index.ts after app.whenReady().
 */
export function registerAllIpcHandlers(): void {
  registerDbHandlers()
  registerPdfHandlers()
  registerSettingsHandlers()
  registerUpdaterHandlers()
  registerCrashRecoveryHandlers()
  registerAppLockHandlers()
  registerAppHandlers()
}

/**
 * Typed IPC channel names.
 * Every channel used in preload.ts must appear here.
 * Used as a single source of truth for channel string literals.
 */
export const IpcChannels = {
  // Database
  DB_QUERY: 'db:query',
  DB_RUN: 'db:run',
  DB_GET_ACTIVE_PATH: 'db:getActivePath',
  DB_SWAP: 'db:swap',
  DB_GET_MIGRATION_VERSION: 'db:getMigrationVersion',

  // PDF
  PDF_GENERATE: 'pdf:generate',
  PDF_CHOOSE_SAVE_PATH: 'pdf:chooseSavePath',
  PDF_CAPTURE_IMAGE: 'pdf:captureImage',
  PDF_WRITE_CLIPBOARD_IMAGE: 'pdf:writeClipboardImage',
  PDF_SILENT_PRINT: 'pdf:silentPrint',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_WRITE: 'settings:write',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_GET_APPDATA_PATH: 'settings:getAppDataPath',

  // Updater
  UPDATER_CHECK: 'updater:checkForUpdate',
  UPDATER_INSTALL: 'updater:installUpdate',
  UPDATER_AVAILABLE: 'updater:updateAvailable',     // pushed main → renderer
  UPDATER_PROGRESS: 'updater:downloadProgress',      // pushed main → renderer

  // Crash Recovery
  CRASH_HAS_DRAFT: 'crash:hasDraft',
  CRASH_READ_DRAFT: 'crash:readDraft',
  CRASH_SAVE_DRAFT: 'crash:saveDraft',
  CRASH_CLEAR_DRAFT: 'crash:clearDraft',

  // App Lock
  APP_LOCK_IS_ENABLED: 'appLock:isEnabled',
  APP_LOCK_VERIFY: 'appLock:verify',
  APP_LOCK_ENABLE: 'appLock:enable',
  APP_LOCK_DISABLE: 'appLock:disable',
  APP_LOCK_CHANGE_PIN: 'appLock:changePIN',

  // App Utilities
  APP_GET_VERSION: 'app:getVersion',
  APP_OPEN_FOLDER: 'app:openFolder',
  APP_OPEN_FILE_DIALOG: 'app:openFileDialog',
  APP_MINIMIZE: 'app:minimize',
  APP_CLOSE: 'app:close',
  APP_SESSION_LOG: 'app:sessionLog', // renderer → main: log a session event

  // Item Images (Phase 9b-B-i)
  IMAGE_PICK: 'image:pick',                   // show file picker → returns chosen path or null
  IMAGE_COPY_TO_APPDATA: 'image:copyToAppData', // copy file to AppData/cQikly/item-images/ → returns dest path
  IMAGE_READ_AS_DATA_URL: 'image:readAsDataUrl', // read file at path → returns base64 data URL
  IMAGE_DELETE: 'image:delete',               // delete file at AppData path
} as const

export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels]
