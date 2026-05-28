/**
 * cQikly — DB Migration 004
 * Fix session: FIX-1
 *
 * Changes:
 *   - bills: add cell_formats column (JSON blob, default '{}')
 *   - bills: add template_id column (INTEGER, nullable)
 *
 * These columns were referenced in bill.service.ts but were never
 * added to the schema, causing INSERT/UPDATE failures.
 */

import type Database from 'better-sqlite3'

export function up(db: InstanceType<typeof Database>): void {
  try {
    db.exec(`ALTER TABLE bills ADD COLUMN cell_formats TEXT DEFAULT '{}'`)
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    db.exec(`ALTER TABLE bills ADD COLUMN template_id INTEGER`)
  } catch {
    // Column already exists — safe to ignore
  }
}

export function down(db: InstanceType<typeof Database>): void {
  // SQLite does not support DROP COLUMN in older versions — skip
  void db
}
