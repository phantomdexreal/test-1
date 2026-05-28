/**
 * cQikly — DB Migration 003
 * Phase: 11a-i
 *
 * Changes:
 *   - company_profile: add number_of_branches column (missing from initial schema)
 *   - No data loss; ALTER TABLE IF NOT EXISTS already skips if column exists
 */

import type Database from 'better-sqlite3'

export function up(db: InstanceType<typeof Database>): void {
  // Add number_of_branches if not present (safe — SQLite ignores errors for existing cols via try/catch)
  try {
    db.exec(`ALTER TABLE company_profile ADD COLUMN number_of_branches INTEGER DEFAULT 0`)
  } catch {
    // Column already exists — safe to ignore
  }
}

export function down(db: InstanceType<typeof Database>): void {
  // SQLite does not support DROP COLUMN in older versions — skip
  void db
}
