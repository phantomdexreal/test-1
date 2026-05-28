/**
 * cQikly — IPC Handler: App Utilities
 * Phase: 1a-i-B / updated 1b-A (added app:sessionLog)
 * Phase: 9b-B-i — added image:* handlers for item image support
 *
 * Handles misc app:* IPC channels — version, file dialogs, shell operations,
 * renderer-originated session log entries, and item image file management.
 */

import { ipcMain, app, shell, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { IpcChannels } from '../index'
import { sessionLogger, SessionEventName } from '../../sessionLogger'

export function registerAppHandlers(): void {
  // ── app:getVersion ────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return app.getVersion()
  })

  // ── app:openFolder ────────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.APP_OPEN_FOLDER, async (_event, folderPath: string) => {
    await shell.openPath(folderPath)
  })

  // ── app:openFileDialog ────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.APP_OPEN_FILE_DIALOG, async (_event, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(options ?? {})
    return result.canceled ? null : result.filePaths
  })

  // ── app:minimize (one-way) ────────────────────────────────────────────────
  ipcMain.on(IpcChannels.APP_MINIMIZE, () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })

  // ── app:close (one-way) ───────────────────────────────────────────────────
  // The renderer fires this after its own unsaved-changes guard passes.
  ipcMain.on(IpcChannels.APP_CLOSE, () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  // ── app:sessionLog (one-way) ──────────────────────────────────────────────
  // Renderer components can log session events through this channel.
  // The main process sessionLogger writes them to the AppData log file.
  ipcMain.on(
    IpcChannels.APP_SESSION_LOG,
    (_event, eventName: SessionEventName, data?: Record<string, unknown>) => {
      sessionLogger.log(eventName, data ?? {})
    }
  )

  // ─────────────────────────────────────────────────────────────────────────
  // Item Image handlers — Phase 9b-B-i
  // Images are stored in: AppData/cQikly/item-images/<uuid>.<ext>
  // ─────────────────────────────────────────────────────────────────────────

  const getImageDir = (): string => {
    const dir = path.join(app.getPath('userData'), 'item-images')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  // ── image:pick — show native file picker for images ───────────────────────
  ipcMain.handle(IpcChannels.IMAGE_PICK, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Item Image',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
      ],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── image:copyToAppData — copy chosen file into AppData and return dest path
  ipcMain.handle(IpcChannels.IMAGE_COPY_TO_APPDATA, async (_event, srcPath: string, itemId: string) => {
    try {
      const dir = getImageDir()
      const ext = path.extname(srcPath).toLowerCase() || '.jpg'
      const destName = `${itemId}${ext}`
      const destPath = path.join(dir, destName)
      fs.copyFileSync(srcPath, destPath)
      return destPath
    } catch (err) {
      console.error('[image:copyToAppData]', err)
      return null
    }
  })

  // ── image:readAsDataUrl — read stored image and return as base64 data URL ─
  ipcMain.handle(IpcChannels.IMAGE_READ_AS_DATA_URL, async (_event, filePath: string) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return null
      const buf = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'png' ? 'image/png'
        : ext === 'gif' ? 'image/gif'
        : ext === 'webp' ? 'image/webp'
        : 'image/jpeg'
      return `data:${mime};base64,${buf.toString('base64')}`
    } catch (err) {
      console.error('[image:readAsDataUrl]', err)
      return null
    }
  })

  // ── image:delete — delete image file from AppData ─────────────────────────
  ipcMain.handle(IpcChannels.IMAGE_DELETE, async (_event, filePath: string) => {
    try {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return true
    } catch (err) {
      console.error('[image:delete]', err)
      return false
    }
  })
}

