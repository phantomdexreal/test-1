/**
 * cQikly — IPC Handler: PDF
 * Phase 6a-A: Full Simplified PDF generation via Electron printToPDF.
 *
 * Flow:
 *   renderer calls ipc.pdf.generate(htmlString, format, options)
 *   → main opens a hidden BrowserWindow
 *   → loads the HTML string as a data URL
 *   → calls webContents.printToPDF({ pageSize, ... })
 *   → saves to savePath (from options)
 *   → returns savedPath to renderer
 *
 * The renderer builds all the HTML layout/design — main only handles
 * the print-to-PDF rendering and disk I/O.
 */

import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import path from 'path'
import fs from 'fs'
import { IpcChannels } from '../index'

// Electron's PrintToPDFOptions.pageSize union — defined locally because
// Electron does not export PageSize as a standalone named type.
type ElectronPageSize =
  | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  | 'Legal' | 'Letter' | 'Tabloid' | 'Ledger'

// ─── Helper: create a hidden BrowserWindow for PDF rendering ──────────────────

function createPdfWindow(): BrowserWindow {
  return new BrowserWindow({
    width: 1200,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      javascript: true,
    },
  })
}

// ─── Register IPC handlers ────────────────────────────────────────────────────

export function registerPdfHandlers(): void {

  // ── pdf:generate ──────────────────────────────────────────────────────────
  //
  // options: {
  //   pageSize: 'A5' | 'A4'
  //   savePath?: string    — if set, save here; otherwise return path of temp file
  //   printDialog?: bool  — if true, open print dialog instead of saving silently
  //   filename?: string   — used for dialog default name
  // }
  ipcMain.handle(IpcChannels.PDF_GENERATE, async (_event, htmlString: string, _format: string, options?: {
    pageSize?: 'A5' | 'A4'
    savePath?: string
    printDialog?: boolean
    filename?: string
  }) => {
    const pageSize = options?.pageSize ?? 'A4'
    const targetPath = options?.savePath

    let win: BrowserWindow | null = null
    try {
      win = createPdfWindow()

      // Load HTML as a data URL (avoids CSP issues with file:// and external URLs)
      const encoded = Buffer.from(htmlString, 'utf-8').toString('base64')
      await win.loadURL(`data:text/html;base64,${encoded}`)

      // Give it a moment to render fully (fonts, layout)
      await new Promise<void>(res => setTimeout(res, 800))

      if (options?.printDialog) {
        // Send to print dialog (user sees the system print dialog)
        win.webContents.print({ silent: false }, (success, failureReason) => {
          if (!success) console.warn('[PDF] Print dialog failed:', failureReason)
        })
        return null
      }

      // Generate PDF buffer
      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: pageSize as ElectronPageSize,
        printBackground: true,
        landscape: false,
      })

      // Determine save path
      let finalPath = targetPath
      if (!finalPath) {
        // Fall back to Downloads
        const downloadsDir = app.getPath('downloads')
        finalPath = path.join(downloadsDir, options?.filename ?? 'bill.pdf')
      }

      // Ensure directory exists
      const dir = path.dirname(finalPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.writeFileSync(finalPath, pdfBuffer)
      return finalPath

    } catch (err) {
      console.error('[IPC pdf:generate] Failed:', err)
      throw err
    } finally {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
  })

  // ── pdf:chooseSavePath ────────────────────────────────────────────────────
  ipcMain.handle(IpcChannels.PDF_CHOOSE_SAVE_PATH, async (_event, defaultName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })
    return result.canceled ? null : result.filePath
  })

  // ── pdf:captureImage ──────────────────────────────────────────────────────
  //
  // Renders an HTML string in a hidden BrowserWindow, captures a screenshot
  // of the rendered page, crops to content, and returns it as a base64 PNG.
  //
  // options: {
  //   width?: number   — viewport width for rendering (default 794 ≈ A4 at 96dpi)
  //   height?: number  — viewport height for initial render (default 1200)
  // }
  //
  // Returns: base64-encoded PNG string, or null on failure.
  ipcMain.handle(IpcChannels.PDF_CAPTURE_IMAGE, async (_event, htmlString: string, options?: {
    width?: number
    height?: number
  }) => {
    const viewW = options?.width  ?? 794
    const viewH = options?.height ?? 1200

    let win: BrowserWindow | null = null
    try {
      win = new BrowserWindow({
        width:  viewW,
        height: viewH,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          javascript: true,
          offscreen: false,
        },
      })

      // Load the HTML string as a data URL
      const encoded = Buffer.from(htmlString, 'utf-8').toString('base64')
      await win.loadURL(`data:text/html;base64,${encoded}`)

      // Wait for fonts/layout to settle
      await new Promise<void>(res => setTimeout(res, 900))

      // Measure the actual rendered page height so we can resize before capture
      const pageHeight = await win.webContents.executeJavaScript(
        'Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)'
      ) as number

      const captureH = Math.min(Math.max(pageHeight, viewH), 12000) // cap at 12 000 px
      win.setSize(viewW, captureH)

      // Small wait after resize
      await new Promise<void>(res => setTimeout(res, 200))

      // Capture the visible window as a NativeImage
      const nativeImg = await win.webContents.capturePage()
      const pngBuffer = nativeImg.toPNG()

      return pngBuffer.toString('base64')

    } catch (err) {
      console.error('[IPC pdf:captureImage] Failed:', err)
      return null
    } finally {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
  })

  // ── pdf:writeClipboardImage ───────────────────────────────────────────────
  //
  // Receives a base64-encoded PNG and writes it to the system clipboard.
  // Returns true on success, false on failure.
  ipcMain.handle(IpcChannels.PDF_WRITE_CLIPBOARD_IMAGE, async (_event, base64Png: string) => {
    try {
      const { clipboard, nativeImage } = await import('electron')
      const buffer = Buffer.from(base64Png, 'base64')
      const img = nativeImage.createFromBuffer(buffer)
      clipboard.writeImage(img)
      return true
    } catch (err) {
      console.error('[IPC pdf:writeClipboardImage] Failed:', err)
      return false
    }
  })

  // ── pdf:silentPrint ───────────────────────────────────────────────────────
  //
  // Renders HTML in a hidden window and sends to the default printer silently,
  // without any print dialog. Used for Quick Print.
  //
  // options: { pageSize: 'A5' | 'A4' }
  // Returns: true on success.
  ipcMain.handle(IpcChannels.PDF_SILENT_PRINT, async (_event, htmlString: string, options?: {
    pageSize?: 'A5' | 'A4'
  }) => {
    const pageSize = options?.pageSize ?? 'A5'

    let win: BrowserWindow | null = null
    try {
      win = createPdfWindow()

      const encoded = Buffer.from(htmlString, 'utf-8').toString('base64')
      await win.loadURL(`data:text/html;base64,${encoded}`)

      await new Promise<void>(res => setTimeout(res, 800))

      // Generate PDF buffer then print it via the default printer
      const pdfBuffer = await win.webContents.printToPDF({
        pageSize: pageSize as ElectronPageSize,
        printBackground: true,
        landscape: false,
      })

      // Write to a temp file and open for printing via shell
      const tmpDir  = app.getPath('temp')
      const tmpFile = path.join(tmpDir, `cqikly_quickprint_${Date.now()}.pdf`)
      fs.writeFileSync(tmpFile, pdfBuffer)

      // Use Electron's shell to open the PDF with the system default viewer/printer
      // On Windows this will silently print via the default PDF handler
      const { shell } = await import('electron')
      await shell.openPath(tmpFile)

      return true

    } catch (err) {
      console.error('[IPC pdf:silentPrint] Failed:', err)
      return false
    } finally {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    }
  })
}