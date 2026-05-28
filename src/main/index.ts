/**
 * cQikly — Electron Main Process
 * Phase: 1b-A (added: sessionLogger, initUpdater, checkForDraftOnLaunch)
 *
 * Responsibilities:
 *  - Creates and manages the BrowserWindow
 *  - In dev mode: loads Vite dev server (localhost:5173)
 *  - In prod mode: loads built renderer index.html
 *  - Registers all IPC handlers via registerAllIpcHandlers()
 *  - Runs DB migrations on startup via MigrationRunner
 *  - Initialises all 4 safety systems (Phase 1b-A):
 *      1. sessionLogger    — starts writing activity log to AppData
 *      2. initUpdater      — auto-checks for update (non-blocking)
 *      3. App Lock check   — happens in renderer via AppLockGate component
 *      4. checkForDraft    — pushes IPC if a crash draft exists
 *
 * Preload path: dist-electron/preload.js (compiled by vite-plugin-electron)
 */

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { registerAllIpcHandlers } from './ipc/index'
import { MigrationRunner } from './db/migrationRunner'
import { sessionLogger } from './sessionLogger'
import { initUpdater } from './updater'
import { checkForDraftOnLaunch } from './crashRecovery'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEV_SERVER_URL = 'http://localhost:5173'
const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Window Management ────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false, // Hidden until ready-to-show fires — prevents white flash
    backgroundColor: '#0a0a0f', // Match app dark background
    titleBarStyle: 'default',
    webPreferences: {
      // Preload script bridges main ↔ renderer via contextBridge.
      // vite-plugin-electron outputs it to dist-electron/preload.js
      preload: path.join(__dirname, '../preload.js'),
      // Security: renderer cannot use Node.js APIs directly
      nodeIntegration: false,
      contextIsolation: true,
      // Allow devtools in dev mode
      devTools: IS_DEV,
    },
  })

  // Show window smoothly once content is ready, then run post-show safety checks
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (IS_DEV) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }

    // ── Safety System 4: Crash Recovery ──────────────────────────────────────
    // Runs after the window is shown so the renderer is ready to receive the IPC push.
    checkForDraftOnLaunch()
  })

  // Open external links in OS default browser rather than Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load renderer
  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    sessionLogger.log('APP_QUIT', { sessionId: 'see launch log' })
    mainWindow = null
  })
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // ── Safety System 1: Session Activity Logger ──────────────────────────────
  // Must be first — everything else logs through this singleton.
  sessionLogger.init()

  // Step 1: Run DB migrations before anything else
  try {
    const runner = new MigrationRunner()
    await runner.runAll()
    console.log('[cQikly] DB migrations: up to date')
    sessionLogger.log('SETTINGS_CHANGED', { action: 'db-migrations-run' })
  } catch (err) {
    console.error('[cQikly] ===========================================')
    console.error('[cQikly] FATAL: DB migration / initialization failed')
    console.error('[cQikly] Full error:', err)
    console.error('[cQikly] -------------------------------------------')
    console.error('[cQikly] In dev: better-sqlite3 needs rebuilding for')
    console.error('[cQikly] this Electron version. Run:  npm run rebuild')
    console.error('[cQikly] Then restart:                npm run dev')
    console.error('[cQikly] ===========================================')
    // Window still opens so devtools show the error above.
    // All db:* IPC calls will throw 'not initialized' until rebuild + restart.
  }

  // Step 2: Register all IPC handlers
  registerAllIpcHandlers()
  console.log('[cQikly] IPC handlers registered')

  // Step 3: Create the main window
  createWindow()

  // ── Safety System 2: Auto-Updater ─────────────────────────────────────────
  // Runs after window creation. Non-blocking — any failure is swallowed inside initUpdater().
  // The 3-second delay inside initUpdater() ensures it doesn't compete with the window paint.
  initUpdater()
  sessionLogger.log('UPDATE_CHECKED', { trigger: 'launch-auto-check' })

  // ── Safety System 3: App Lock ─────────────────────────────────────────────
  // The renderer-side AppLockGate component handles this.
  // On launch it calls appLock.isEnabled() and shows the PIN screen if needed.
  // When disabled (default), it renders nothing and passes children through.
  // No main-process logic needed here — IPC handlers already registered above.

  // macOS: re-create window on dock icon click if all windows were closed
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Windows/Linux: quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation from renderer
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    // In prod: block all navigations away from our app
    if (!IS_DEV && !url.startsWith('file://')) {
      event.preventDefault()
    }
  })
})
