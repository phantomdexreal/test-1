/**
 * cQikly — IPC Handler: App Lock (PIN)
 * Phase: 1a-i-B (stub — full PIN UI in Phase 11b-i)
 *
 * PIN is stored hashed in the config file.
 * Full PIN screen and settings UI built in a later phase.
 */

import { ipcMain, app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { IpcChannels } from '../index'

function getLockConfigPath(): string {
  return path.join(app.getPath('userData'), 'lock.json')
}

function readLockConfig(): { enabled: boolean; pinHash?: string } {
  const p = getLockConfigPath()
  if (!fs.existsSync(p)) return { enabled: false }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return { enabled: false }
  }
}

function writeLockConfig(data: { enabled: boolean; pinHash?: string }): void {
  fs.writeFileSync(getLockConfigPath(), JSON.stringify(data), 'utf-8')
}

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex')
}

export function registerAppLockHandlers(): void {
  ipcMain.handle(IpcChannels.APP_LOCK_IS_ENABLED, () => {
    return readLockConfig().enabled
  })

  ipcMain.handle(IpcChannels.APP_LOCK_VERIFY, (_event, pin: string) => {
    const config = readLockConfig()
    if (!config.enabled || !config.pinHash) return true
    return hashPin(pin) === config.pinHash
  })

  ipcMain.handle(IpcChannels.APP_LOCK_ENABLE, (_event, pin: string) => {
    writeLockConfig({ enabled: true, pinHash: hashPin(pin) })
  })

  ipcMain.handle(IpcChannels.APP_LOCK_DISABLE, (_event, pin: string) => {
    const config = readLockConfig()
    if (config.pinHash && hashPin(pin) !== config.pinHash) {
      throw new Error('Incorrect PIN')
    }
    writeLockConfig({ enabled: false })
  })

  ipcMain.handle(IpcChannels.APP_LOCK_CHANGE_PIN, (_event, oldPin: string, newPin: string) => {
    const config = readLockConfig()
    if (config.pinHash && hashPin(oldPin) !== config.pinHash) {
      throw new Error('Incorrect current PIN')
    }
    writeLockConfig({ enabled: true, pinHash: hashPin(newPin) })
  })
}
