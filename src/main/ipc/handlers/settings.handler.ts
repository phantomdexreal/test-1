/**
 * cQikly — IPC Handler: Settings
 * Phase: 1a-i-B
 *
 * Handles all settings:* IPC channels.
 * Config is stored as a JSON file in the OS AppData directory.
 * Full ConfigContext + settings UI built in Phase 1a-ii-A and Phase 11a-i.
 */

import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { IpcChannels } from '../index'

// ─── Config file path ──────────────────────────────────────────────────────────

function getConfigPath(): string {
  const appData = app.getPath('userData')
  return path.join(appData, 'config.json')
}

function readConfig(): Record<string, unknown> {
  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) {
    return {}
  }
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {} // Corrupt config → return empty (Section 4: Settings corruption recovers to last known valid)
  }
}

function writeConfig(data: Record<string, unknown>): void {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8')
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function registerSettingsHandlers(): void {
  // ── settings:read ─────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_READ, () => {
    return readConfig()
  })

  // ── settings:write ────────────────────────────────────────────────────────
  // Merges the patch into the existing config (partial update).
  ipcMain.handle(IpcChannels.SETTINGS_WRITE, (_event, patch: Record<string, unknown>) => {
    const current = readConfig()
    const updated = { ...current, ...patch }
    writeConfig(updated)
  })

  // ── settings:reset ────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_RESET, () => {
    writeConfig({})
  })

  // ── settings:getAppDataPath ───────────────────────────────────────────────
  ipcMain.handle(IpcChannels.SETTINGS_GET_APPDATA_PATH, () => {
    return app.getPath('userData')
  })
}
