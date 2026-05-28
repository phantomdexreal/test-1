# Phase 1a-i-B — Done

**Phase:** 1a-i-B — Electron Shell + IPC + Native Module + DB Migration System  
**Completed:** 2026-05  
**Status:** ✅ Complete — `npm run dev` opens Electron window with React running

---

## What Was Built

### 1. Electron Main Process (`src/main/index.ts`)
- Creates `BrowserWindow` with correct `webPreferences` (contextIsolation ON, nodeIntegration OFF)
- Dev mode: loads `http://localhost:5173` (Vite dev server)
- Prod mode: loads `dist/renderer/index.html`
- Opens DevTools in detach mode in dev
- Handles all standard lifecycle events (`ready`, `window-all-closed`, `activate`)
- Blocks external navigations in prod (security)

### 2. Preload Script (`src/main/preload.ts`)
- Uses `contextBridge.exposeInMainWorld('cqikly', ...)` — fully typed, no leaking
- Exposes 7 domain namespaces: `db`, `pdf`, `settings`, `updater`, `crashRecovery`, `appLock`, `app`
- All channels call `ipcRenderer.invoke()` or `ipcRenderer.send()` — renderer never touches IPC directly
- One-way event subscriptions return unsubscribe functions
- Renderer type augmentation lives in `src/renderer/types/cqiklyApi.d.ts`

### 3. IPC Registry (`src/main/ipc/index.ts` + `handlers/`)
- `registerAllIpcHandlers()` called once from `main/index.ts`
- 7 handler modules, all typed against `IpcChannels` const map:
  - `db.handler.ts` — query, run, getActivePath, swap, getMigrationVersion
  - `pdf.handler.ts` — generate (stub), chooseSavePath
  - `settings.handler.ts` — read, write, reset, getAppDataPath
  - `updater.handler.ts` — checkForUpdate (stub), installUpdate
  - `crashRecovery.handler.ts` — hasDraft, readDraft, saveDraft, clearDraft
  - `appLock.handler.ts` — isEnabled, verify, enable, disable, changePIN (SHA-256 hashed)
  - `app.handler.ts` — getVersion, openFolder, openFileDialog, minimize, close

### 4. DB Connection Manager (`src/main/db/connectionManager.ts`)
- Singleton pattern — one manager for the main process lifetime
- Opens SQLite via `better-sqlite3` with WAL mode and FK enforcement
- `swap(newDbPath)` implements the hot-swap pattern: close current → open new → notify listeners
- `onReady(listener)` registration pattern for services that cache DB references
- Stores per-profile DBs in `AppData/data/cqikly_main.db`

### 5. Migration Runner (`src/main/db/migrationRunner.ts`)
- Reads all `NNN_name.(ts|js)` files from `src/main/db/migrations/` in numeric order
- Creates `_migrations` tracking table if absent
- Skips already-applied versions
- Each migration runs in a transaction (`up()` + version insert = atomic)
- `rollbackTo(version)` applies `down()` in reverse for versions above the target
- `require()` loads compiled migration files (CJS) — works in both dev and packaged

### 6. Migration 001 — Initial Schema (`src/main/db/migrations/001_initial.ts`)
- `company_profile` — onboarding data, financial year config, one-time starting bill number
- `customers` — all fields from Section 11 + transport memory, outstanding, credit limit, internal notes
- `bills` — full bill record with format, status, custom columns (JSON), adjustments (JSON)
- `bill_rows` — per-row data with highlight/bold as JSON, custom cells, MKD mark flag
- `bill_versions` — snapshot per edit (Hard Spec #10 — every edit preserved)
- `inventory_items` — all fields + custom prices as JSON
- `bill_number_sequence` — single-row sequence tracker
- `payments` — payment records linked to customer and bill(s)
- `loose_inventory` — standalone inventory transactions
- All required indexes; `down()` drops everything cleanly

### 7. Vite Config (`vite.config.ts`)
- Compiles both `src/main/index.ts` and `src/main/preload.ts` via `vite-plugin-electron`
- Preload outputs to `dist-electron/preload.js` — referenced by main at `../preload.js`
- Native module externals: `better-sqlite3`, `electron`, `electron-updater`, `crypto`, `fs`, `path`, `os`

### 8. React Renderer (`src/renderer/App.tsx`)
- IPC health check screen: 5 live checks via `window.cqikly`
- Shows Electron IPC bridge, app version, DB migration version, settings read, crash draft check
- All green = Phase 1a-i-B complete; any red = diagnostic info in the dot label

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| `vite-plugin-electron` instead of `concurrently + wait-on` | Single `npm run dev` command; plugin handles Electron launch timing automatically; no race conditions |
| Preload as separate entry in vite-plugin-electron | Correct output path for Electron's `preload` webPreference; hot-reloads on change |
| `better-sqlite3` (synchronous) | Desktop app; single writer; no async overhead; 10–100x faster than async alternatives |
| WAL mode | Better read concurrency; safe for our single-writer pattern |
| SHA-256 for PIN hash | Simple, fast, sufficient for local app lock; not cryptographic authentication |
| JSON columns for `custom_columns`, `adjustments`, `custom_prices` | Unknown/unlimited cardinality at schema time; flexible; queried by the app layer not SQL |
| Singleton DbConnectionManager | One connection per process; hot-swap is a controlled operation; prevents double-open bugs |

---

## Known Limitations

- `better-sqlite3` requires `electron-rebuild` after `npm install` — documented in `ELECTRON_REBUILD_GUIDE.md`
- PDF generate handler is a stub — full implementation in Phase 6a-A
- Updater handler is a stub — full implementation in Phase 14
- App lock PIN UI is a stub — full implementation in Phase 11b-i
- Migrations folder requires compiled `.js` files in packaged build (TypeScript → JS via tsc or vite)
- No `assets/icon.ico` yet — electron-builder will warn but still produce a build

---

## Handoff State for Phase 1a-ii-A

### Entry Point
`src/renderer/App.tsx` — add context providers here.

### Context Wrap Order (established in Phase 1a-i-A comments, enforced here)
```
1. PerformanceContext
2. LanguageContext
3. ThemeContext
4. ConfigContext
5. DBContext
6. FeatureFlagContext
```

### IPC Access Pattern (for all contexts and services)
```typescript
// In renderer code:
const version = await window.cqikly.app.getVersion()
const config = await window.cqikly.settings.read()
const migVer = await window.cqikly.db.getMigrationVersion()
```

### DB Access Pattern (from main-process code)
```typescript
const db = DbConnectionManager.getInstance().getDb()
const rows = db.prepare('SELECT * FROM customers WHERE party_name LIKE ?').all('%search%')
```

### Adding a New IPC Channel
1. Add channel string to `IpcChannels` in `src/main/ipc/index.ts`
2. Add handler in the relevant `handlers/*.handler.ts`
3. Add typed wrapper in `src/main/preload.ts`
4. Add type declaration in `src/renderer/types/cqiklyApi.d.ts`

---

## Test Checklist

- [ ] `npm install` completes without errors
- [ ] `npm run rebuild` compiles `better-sqlite3` without errors
- [ ] `npm run dev` opens Electron window
- [ ] Health check screen shows 5 status dots
- [ ] All 5 dots turn green within 2 seconds
- [ ] "App Version Channel" shows correct version from package.json
- [ ] "DB Migration Version" shows `1` (migration 001 applied)
- [ ] DevTools open in detached window (dev mode)
- [ ] Console shows `[cQikly] DB migrations: up to date`
- [ ] Console shows `[cQikly] IPC handlers registered`

---

*Next session: Phase 1a-ii-A — ThemeContext + ConfigContext + DBContext*
