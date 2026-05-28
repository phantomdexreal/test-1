/**
 * cQikly — Vite Configuration
 * Phase: 1a-i-B
 *
 * Configures Vite for the Electron + React setup.
 * vite-plugin-electron handles:
 *  - Compiling the main process (src/main/index.ts → dist-electron/main/index.js)
 *  - Compiling the preload script (src/main/preload.ts → dist-electron/preload.js)
 *  - Starting Electron after Vite dev server is ready
 *
 * vite-plugin-electron-renderer enables use of Node.js built-ins in renderer
 * when explicitly required (e.g., path for Electron API wrappers).
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // ── Main process ──────────────────────────────────────────────────
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              // These are native/Electron modules — never bundle them
              external: [
                'better-sqlite3',
                'electron',
                'electron-updater',
                'crypto',
                'fs',
                'path',
                'os',
              ],
            },
          },
        },
      },
      {
        // ── Preload script ────────────────────────────────────────────────
        // Must be compiled separately so Electron can load it as a CJS file
        entry: 'src/main/preload.ts',
        onstart(options) {
          // Reload the renderer when the preload script changes in dev mode
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@main': path.resolve(__dirname, 'src/main'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
