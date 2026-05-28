/**
 * cQikly — IPC Handler: Database
 * Phase: 1a-i-B
 *
 * Handles all db:* IPC channels from the renderer.
 * The actual DB connection is managed by DbConnectionManager (singleton).
 * All SQL execution passes through this handler — renderer never touches SQLite directly.
 */

import { ipcMain } from 'electron'
import { IpcChannels } from '../index'
import { DbConnectionManager } from '../../db/connectionManager'

export function registerDbHandlers(): void {
  const manager = DbConnectionManager.getInstance()

  // ── db:query ──────────────────────────────────────────────────────────────
  // Execute a SELECT and return all rows as an array.
  ipcMain.handle(IpcChannels.DB_QUERY, (_event, sql: string, params?: unknown[]) => {
    try {
      return manager.getDb().prepare(sql).all(...(params ?? []))
    } catch (err) {
      console.error('[IPC db:query] Error:', err)
      throw err
    }
  })

  // ── db:run ────────────────────────────────────────────────────────────────
  // Execute an INSERT / UPDATE / DELETE.
  // Returns { changes, lastInsertRowid }.
  ipcMain.handle(IpcChannels.DB_RUN, (_event, sql: string, params?: unknown[]) => {
    try {
      const result = manager.getDb().prepare(sql).run(...(params ?? []))
      return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) }
    } catch (err) {
      console.error('[IPC db:run] Error:', err)
      throw err
    }
  })

  // ── db:getActivePath ──────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.DB_GET_ACTIVE_PATH, () => {
    return manager.getActivePath()
  })

  // ── db:swap ───────────────────────────────────────────────────────────────
  // Atomically swap to a different SQLite file (e.g. different company profile).
  ipcMain.handle(IpcChannels.DB_SWAP, async (_event, newDbPath: string) => {
    await manager.swap(newDbPath)
  })

  // ── db:getMigrationVersion ────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.DB_GET_MIGRATION_VERSION, () => {
    try {
      const row = manager.getDb()
        .prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1')
        .get() as { version: number } | undefined
      return row?.version ?? 0
    } catch {
      return 0
    }
  })
}
