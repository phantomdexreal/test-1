/**
 * cQikly — electron-builder Configuration
 * Phase: 14 (FINAL)
 *
 * Builds a distributable Windows installer (.exe).
 * Target platform: Windows only (Hard Spec #13).
 *
 * Build command: npm run package
 * Dev command:   npm run dev  (no .exe compilation; Vite dev server only)
 */

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.cqikly.app',
  productName: 'cQikly',
  copyright: 'Copyright © 2026 cQikly',

  // ── Files to bundle ──────────────────────────────────────────────────────
  files: [
    'dist/**/*',           // Vite-built renderer (React app)
    'dist-electron/**/*',  // Compiled Electron main process + preload
    'node_modules/**/*',   // All runtime dependencies
    'package.json',
  ],

  // ── Extra Resources ──────────────────────────────────────────────────────
  // Non-JS assets that must be accessible at runtime (outside asar)
  extraResources: [
    {
      // SQL migration files must be on disk at runtime for MigrationRunner.
      // FIX-17: Point to the compiled output dir (dist-electron/main/db/migrations),
      // not the TS source dir (src/main/db/migrations) which has no .js files.
      from: 'dist-electron/main/db/migrations',
      to: 'migrations',
      filter: ['**/*.js'],  // Only compiled JS (TypeScript compiled before packaging)
    },
  ],

  // ── asar settings ────────────────────────────────────────────────────────
  // better-sqlite3 is a native module — must be outside asar
  asar: true,
  asarUnpack: [
    '**/node_modules/better-sqlite3/**',
    '**/node_modules/bindings/**',
    '**/node_modules/file-uri-to-path/**',
  ],

  // ── Windows target ───────────────────────────────────────────────────────
  win: {
    target: [
      { target: 'nsis', arch: ['x64'] },   // Standard Windows installer (64-bit)
    ],
    icon: 'assets/icon.ico',
    // Sign the installer when a code signing cert is available:
    // certificateFile: process.env.WIN_CSC_LINK,
    // certificatePassword: process.env.WIN_CSC_KEY_PASSWORD,
  },

  // ── NSIS installer wizard ─────────────────────────────────────────────────
  nsis: {
    oneClick: false,                       // Multi-step wizard (not silent install)
    allowToChangeInstallationDirectory: true,
    perMachine: false,                     // Install per-user by default
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'cQikly',
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    // license removed — no EULA screen in installer (FIX-18: LICENSE file didn't exist)
    // installerLanguages: ['en_US'],       // Defaults to all languages
  },

  // ── Directories ───────────────────────────────────────────────────────────
  directories: {
    output: 'release',                     // Installer output folder: /release/
    buildResources: 'assets',
  },

  // ── Auto-updater publish config ───────────────────────────────────────────
  // Set to a real server URL when hosting update infrastructure.
  // For Phase 14: null = no auto-update publishing. electron-updater is
  // wired in the app but update checks will gracefully no-op.
  publish: null,
  // Example future config:
  // publish: {
  //   provider: 'github',
  //   owner: 'cqikly',
  //   repo: 'releases',
  // },

  // ── Rebuild native modules ─────────────────────────────────────────────────
  // electron-rebuild (run via postinstall or `npm run rebuild`) handles
  // better-sqlite3 → no additional config needed here.

  // ── Excluded from scope ───────────────────────────────────────────────────
  // macOS / Linux builds are future considerations (Hard Spec #13).
  // mac:   { target: 'dmg' },   // NOT in scope
  // linux: { target: 'AppImage' }, // NOT in scope
}
