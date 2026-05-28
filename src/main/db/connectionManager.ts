/**
 * cQikly — DB Connection Manager
 * Phase: 1a-i-B
 *
 * Manages the active SQLite database connection.
 * Implements the hot-swap pattern from Section 5 (Architecture):
 *   1. Drains all in-flight writes
 *   2. Closes the current connection
 *   3. Opens the new SQLite file
 *   4. Re-initializes dependent services
 *   5. Broadcasts ready signal
 *
 * Separate SQLite files per company profile/branch (Hard Spec #9).
 * One config DB (settings) is separate from business data DBs.
 *
 * better-sqlite3 is synchronous — all operations are blocking but fast.
 * This is intentional for a local desktop app; no async overhead.
 */

import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReadyListener = (db: Database.Database) => void

// ─── DbConnectionManager ──────────────────────────────────────────────────────

export class DbConnectionManager {
  private static instance: DbConnectionManager
  private db: Database.Database | null = null
  private activePath: string = ''
  private readyListeners: ReadyListener[] = []

  // Singleton: one manager for the entire main process lifetime
  static getInstance(): DbConnectionManager {
    if (!DbConnectionManager.instance) {
      DbConnectionManager.instance = new DbConnectionManager()
    }
    return DbConnectionManager.instance
  }

  private constructor() {}

  // ── Initialization ─────────────────────────────────────────────────────────

  /**
   * Open the default business data database on first launch.
   * Called by MigrationRunner after ensuring migrations are complete.
   */
  initialize(dbPath?: string): void {
    const targetPath = dbPath ?? this.getDefaultDbPath()
    this.openConnection(targetPath)
  }

  private getDefaultDbPath(): string {
    const dataDir = path.join(app.getPath('userData'), 'data')
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    return path.join(dataDir, 'cqikly_main.db')
  }

  // ── Connection Operations ──────────────────────────────────────────────────

  private openConnection(dbPath: string): void {
    if (!fs.existsSync(path.dirname(dbPath))) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    }

    this.db = new Database(dbPath, {
      // WAL mode: better concurrent read performance; safe for single-writer desktop app
      // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
    })

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL')
    // Enforce foreign keys — data integrity
    this.db.pragma('foreign_keys = ON')

    this.activePath = dbPath
    console.log(`[DbConnectionManager] Connected: ${dbPath}`)

    // Notify all registered service listeners that a new DB is ready
    this.readyListeners.forEach(listener => listener(this.db!))
  }

  /**
   * Atomically swap to a different database file.
   * Per Architecture rules: drain writes → close → open new → notify.
   *
   * better-sqlite3 is synchronous so there's no async drain needed —
   * the close() call waits for any in-progress statement to complete.
   */
  async swap(newDbPath: string): Promise<void> {
    console.log(`[DbConnectionManager] Swapping DB to: ${newDbPath}`)

    // Close current connection cleanly
    if (this.db) {
      this.db.close()
      this.db = null
    }

    // Open the new connection and notify all listeners
    this.openConnection(newDbPath)
    console.log('[DbConnectionManager] DB swap complete')
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  /**
   * Get the currently active Database instance.
   * Throws if not yet initialized — callers should only access after app.whenReady().
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('[DbConnectionManager] Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  getActivePath(): string {
    return this.activePath
  }

  // ── Service Registration ───────────────────────────────────────────────────

  /**
   * Register a callback that fires whenever the active DB changes.
   * Services that cache DB references call this so they can re-initialize.
   */
  onReady(listener: ReadyListener): void {
    this.readyListeners.push(listener)
    // If DB is already open, call immediately so late-registering services get the connection
    if (this.db) {
      listener(this.db)
    }
  }
}
