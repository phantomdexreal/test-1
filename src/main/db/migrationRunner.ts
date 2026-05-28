/**
 * cQikly — DB Migration Runner
 * Phase: 1a-i-B
 *
 * Reads all migration files from /src/main/db/migrations/ in numeric order.
 * Each migration file must export:
 *   up(db: Database.Database): void   — apply the migration
 *   down(db: Database.Database): void — rollback the migration
 *
 * Tracks the current migration version in the _migrations table.
 * Supports rollback to any prior version.
 *
 * Called once from main/index.ts before the window is created.
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { DbConnectionManager } from './connectionManager'

// ─── Migration file shape ─────────────────────────────────────────────────────

interface MigrationModule {
  up: (db: Database.Database) => void
  down: (db: Database.Database) => void
}

// ─── MigrationRunner ──────────────────────────────────────────────────────────

export class MigrationRunner {
  private migrationsDir: string

  constructor() {
    // In production (packaged), migrations are in resources/; in dev, in src/main/db/migrations
    this.migrationsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'migrations')
      : path.join(__dirname, 'migrations')
  }

  /**
   * Run all pending migrations in ascending version order.
   * Also ensures the DB connection is initialized.
   */
  async runAll(): Promise<void> {
    // Initialize the DB connection if not already open
    const manager = DbConnectionManager.getInstance()
    manager.initialize()

    const db = manager.getDb()

    // Ensure the migration tracking table exists
    this.ensureMigrationTable(db)

    const currentVersion = this.getCurrentVersion(db)
    const migrationFiles = this.getMigrationFiles()

    let applied = 0
    for (const file of migrationFiles) {
      const version = this.extractVersion(file)
      if (version > currentVersion) {
        await this.applyMigration(db, file, version)
        applied++
      }
    }

    if (applied === 0) {
      console.log(`[MigrationRunner] Already at version ${currentVersion} — no migrations needed`)
    } else {
      console.log(`[MigrationRunner] Applied ${applied} migration(s). Now at version ${this.getCurrentVersion(db)}`)
    }
  }

  /**
   * Rollback to a specific version.
   * Applies down() for all versions above the target in descending order.
   */
  async rollbackTo(targetVersion: number): Promise<void> {
    const manager = DbConnectionManager.getInstance()
    const db = manager.getDb()

    const currentVersion = this.getCurrentVersion(db)
    if (targetVersion >= currentVersion) {
      console.log('[MigrationRunner] Nothing to rollback')
      return
    }

    const migrationFiles = this.getMigrationFiles().reverse()
    for (const file of migrationFiles) {
      const version = this.extractVersion(file)
      if (version > targetVersion && version <= currentVersion) {
        await this.rollbackMigration(db, file, version)
      }
    }
    console.log(`[MigrationRunner] Rolled back to version ${targetVersion}`)
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private ensureMigrationTable(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version   INTEGER PRIMARY KEY,
        name      TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  private getCurrentVersion(db: Database.Database): number {
    const row = db
      .prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined
    return row?.version ?? 0
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsDir)) {
      console.warn(`[MigrationRunner] Migrations dir not found: ${this.migrationsDir}`)
      return []
    }

    return fs
      .readdirSync(this.migrationsDir)
      .filter(f => /^\d{3}_.*\.(ts|js)$/.test(f))
      .sort() // Alphabetic sort gives numeric order since files start with 001_, 002_, etc.
  }

  private extractVersion(filename: string): number {
    const match = filename.match(/^(\d+)_/)
    return match ? parseInt(match[1], 10) : 0
  }

  private async applyMigration(db: Database.Database, filename: string, version: number): Promise<void> {
    console.log(`[MigrationRunner] Applying migration ${filename}...`)
    try {
      // Require the migration module
      const migrationPath = path.join(this.migrationsDir, filename)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migration = require(migrationPath) as MigrationModule

      // Run up() inside a transaction for safety
      const runUp = db.transaction(() => {
        migration.up(db)
        db.prepare(
          'INSERT INTO _migrations (version, name) VALUES (?, ?)'
        ).run(version, filename)
      })
      runUp()

      console.log(`[MigrationRunner] ✓ Applied ${filename}`)
    } catch (err) {
      console.error(`[MigrationRunner] ✗ Failed to apply ${filename}:`, err)
      throw err
    }
  }

  private async rollbackMigration(db: Database.Database, filename: string, version: number): Promise<void> {
    console.log(`[MigrationRunner] Rolling back migration ${filename}...`)
    try {
      const migrationPath = path.join(this.migrationsDir, filename)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migration = require(migrationPath) as MigrationModule

      const runDown = db.transaction(() => {
        migration.down(db)
        db.prepare('DELETE FROM _migrations WHERE version = ?').run(version)
      })
      runDown()

      console.log(`[MigrationRunner] ✓ Rolled back ${filename}`)
    } catch (err) {
      console.error(`[MigrationRunner] ✗ Failed to rollback ${filename}:`, err)
      throw err
    }
  }
}
