/**
 * cQikly — Session Activity Logger
 * Phase: 1b-A
 *
 * PURPOSE:
 *   A singleton that logs timestamped app events to a raw text file in Windows
 *   AppData. This file is NEVER surfaced in the app UI in any form.
 *   Accessible only by manually navigating the file system (for debugging/audit).
 *   Per Hard Spec #18: log is a raw file in AppData only.
 *
 * USAGE:
 *   import { sessionLogger } from './sessionLogger'
 *   sessionLogger.log('BILL_CREATED', { billId: '123', party: 'Sharma Traders' })
 *
 * LOG FORMAT (one JSON line per entry):
 *   { "ts": "2026-05-25T10:30:00.000Z", "event": "APP_LAUNCH", "data": {} }
 *
 * BACKUP NOTE (Hard Spec #25):
 *   This log file is included in every backup ZIP by the backup service.
 *
 * DEPENDENCIES:
 *   - electron: app.getPath('userData') for AppData directory
 *   - fs: file writes (sync for reliability during crashes)
 *   - path: file path construction
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'

// ─── Event Types ──────────────────────────────────────────────────────────────

/**
 * All loggable event names.
 * Extend this union as new actions are added in later phases.
 */
export type SessionEventName =
  // Lifecycle
  | 'APP_LAUNCH'
  | 'APP_QUIT'
  // Bills
  | 'BILL_CREATED'
  | 'BILL_EDITED'
  | 'BILL_DELETED'
  | 'BILL_DUPLICATED'
  | 'BILL_SAVED_PDF'
  | 'BILL_PRINTED'
  | 'BILL_DRAFT_SAVED'
  | 'BILL_DRAFT_RESTORED'
  | 'BILL_DRAFT_DISCARDED'
  // Customers
  | 'CUSTOMER_ADDED'
  | 'CUSTOMER_EDITED'
  | 'CUSTOMER_DELETED'
  // Inventory
  | 'INVENTORY_ITEM_ADDED'
  | 'INVENTORY_ITEM_EDITED'
  | 'INVENTORY_ITEM_DELETED'
  | 'INVENTORY_IMPORTED'
  | 'INVENTORY_EXPORTED'
  // Settings
  | 'SETTINGS_CHANGED'
  | 'THEME_CHANGED'
  | 'PERFORMANCE_MODE_CHANGED'
  | 'LANGUAGE_CHANGED'
  | 'FEATURE_FLAG_TOGGLED'
  // Security
  | 'APP_LOCK_ENABLED'
  | 'APP_LOCK_DISABLED'
  | 'APP_LOCK_VERIFIED'
  | 'APP_LOCK_FAILED'
  | 'APP_LOCK_PIN_CHANGED'
  // Backup
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'DB_SWAPPED'
  // Updater
  | 'UPDATE_CHECKED'
  | 'UPDATE_AVAILABLE'
  | 'UPDATE_INSTALLED'

/** Payload attached to a log entry — any serialisable key/value map. */
export type SessionEventData = Record<string, unknown>

/** A single log entry as stored in the file. */
interface LogEntry {
  ts: string               // ISO 8601 timestamp
  event: SessionEventName  // what happened
  data: SessionEventData   // optional context
}

// ─── SessionLogger (singleton) ────────────────────────────────────────────────

class SessionLogger {
  private logPath: string | null = null
  private sessionId: string

  constructor() {
    // Session ID uniquely identifies this run — useful for correlating log lines
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  /**
   * Must be called once after app.whenReady() so that app.getPath() works.
   * Calling log() before init() is safe — entries are silently dropped until ready.
   */
  init(): void {
    try {
      const userData = app.getPath('userData')
      const logsDir  = path.join(userData, 'logs')

      // Ensure logs directory exists
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      // One log file per calendar day: session_activity_2026-05-25.log
      const dateStamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      this.logPath    = path.join(logsDir, `session_activity_${dateStamp}.log`)

      // Write session header so the file always starts with a clear boundary
      this.writeRaw(`\n=== SESSION START [${this.sessionId}] ===\n`)
      this.log('APP_LAUNCH', { sessionId: this.sessionId, pid: process.pid })
    } catch (err) {
      // Logger must never crash the app — swallow and warn to console only
      console.warn('[SessionLogger] init failed:', err)
    }
  }

  /**
   * Log an event. Safe to call from anywhere in the main process.
   * @param event - The event name (type-checked against SessionEventName)
   * @param data  - Optional key/value context (serialised to JSON)
   */
  log(event: SessionEventName, data: SessionEventData = {}): void {
    if (!this.logPath) return // Not yet initialised — drop silently

    try {
      const entry: LogEntry = {
        ts:    new Date().toISOString(),
        event,
        data,
      }
      // Append one JSON line per entry (NDJSON format — easy to parse / grep)
      this.writeRaw(JSON.stringify(entry) + '\n')
    } catch (err) {
      console.warn('[SessionLogger] log() failed:', err)
    }
  }

  /**
   * Returns the absolute path to today's log file.
   * Used by the backup service to include this file in every backup ZIP.
   */
  getLogPath(): string | null {
    return this.logPath
  }

  /**
   * Returns the directory that contains all session log files.
   * Used by the backup service.
   */
  getLogsDir(): string | null {
    if (!this.logPath) return null
    return path.dirname(this.logPath)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private writeRaw(text: string): void {
    if (!this.logPath) return
    // Sync write: ensures the entry is flushed even if the app crashes immediately after
    fs.appendFileSync(this.logPath, text, 'utf-8')
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * The single shared SessionLogger instance.
 * Call sessionLogger.init() once in main/index.ts after app.whenReady().
 * Call sessionLogger.log() from any main-process code thereafter.
 */
export const sessionLogger = new SessionLogger()
