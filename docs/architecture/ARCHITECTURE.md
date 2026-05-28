# cQikly — Final Architecture Document
**Version:** 1.0.0 | **Phase:** 14 (Final) | **Date:** May 2026

---

## Overview

cQikly is a fully offline-capable desktop billing and business management application for Indian SMBs. It is built on Electron (Windows only for v1.x), with a React + TypeScript renderer, SQLite storage via better-sqlite3, and a strict service-layer abstraction for all external calls.

---

## Process Architecture

### Main Process (`src/main/`)
The Electron main process owns:
- **Window management** — single BrowserWindow, 1280×800 min, dark background
- **IPC handler registration** — all renderer↔main communication via `ipcMain`/`ipcRenderer` via contextBridge
- **Database lifecycle** — `MigrationRunner` runs all pending migrations on startup; `ConnectionManager` swaps the active SQLite file when switching company profiles
- **Safety systems** — `SessionLogger` (activity log to AppData), `Updater` (electron-updater, graceful no-op when publish=null), `CrashRecovery` (draft detection on launch), App Lock gate
- **PDF production** — hidden BrowserWindow receives HTML from renderer, calls `webContents.printToPDF()` or `webContents.capturePage()` for image copy

### Preload Script (`src/main/preload.ts`)
Exposes a single `window.cqikly` API via `contextBridge.exposeInMainWorld`. This is the only surface through which the renderer can reach the main process. No `nodeIntegration`. No `remote`. Full context isolation.

### Renderer Process (`src/renderer/`)
A standard React SPA rendered by Vite. In dev mode, loaded from `http://localhost:5173`. In production, loaded from `dist/index.html`.

---

## State Management

cQikly uses React Context exclusively — no Redux, no Zustand, no external state library.

| Context | Owns |
|---|---|
| `ConfigContext` | All app configuration (company profile, settings, preferences). Reads/writes to config SQLite via IPC. |
| `PerformanceContext` | `mode` (lite/balanced/ultra) + derived flags: `animationsEnabled`, `heavyAnimationsEnabled`, `apiPollingEnabled`, `apiPollingInterval` |
| `FeatureFlagContext` | All 9 boolean module flags. Read from ConfigContext; written via Settings panel. |
| `NavigationContext` | Active page (`PageId`), nav guards for unsaved changes |
| `DBContext` | DB ready state (migration complete flag before app renders) |
| `LanguageContext` | Active locale string; i18n lookup |
| `ThemeContext` | Active visual theme |

**EventBus** (`src/renderer/utils/eventBus.ts`) handles cross-component communication without prop drilling: shortcuts fire events consumed by the relevant page, performance mode changes propagate to polling hooks, etc.

---

## Service Layer

**Rule:** Zero direct DB calls or API calls from components. All external access goes through `src/renderer/services/`.

| Service | Responsibility |
|---|---|
| `db.service` | Wraps `window.cqikly.db.*` IPC calls; all SQL is in IPC handlers |
| `bill.service` | Bill CRUD, versioning, bill number generation, stock deduction |
| `customer.service` | Customer CRUD, auto-create from quote |
| `inventory.service` | Item CRUD, fuzzy search, price history, stock queries |
| `history.service` | Bill list queries, filtering, version retrieval |
| `ledger.service` | Outstanding ledger computation |
| `payment.service` | Payment CRUD, status recomputation per customer |
| `pdf.service` | HTML template building + IPC call to main for PDF/image |
| `backup.service` | DB file export/import |
| `dashboard.service` | Revenue aggregation, low stock query, alert aggregation |
| `weather.service` | OpenMeteo API (polled only in Balanced/Ultra) |
| `crypto.service` | CoinGecko API (polled only in Balanced/Ultra) |
| `forex.service` | ExchangeRate-API (polled only in Balanced/Ultra) |
| `supabase.service` | Stub — cloud sync for future phases |

---

## Storage

### Two SQLite Files (Hard Spec #9)

1. **Config DB** (`config.sqlite`) — company profile, settings, feature flags, cloud access key, saved lists. One file regardless of profiles.
2. **Business DB** (`{profile}.sqlite`) — bills, bill_versions, customers, inventory_items, inventory_price_history, payments, loose_inventory_log, crash_draft. One file per company profile/branch. `ConnectionManager` swaps the active file when switching.

### Migrations (`src/main/db/migrations/`)
Sequential numbered SQL migrations. `MigrationRunner` tracks applied migrations in a `schema_migrations` table. All pending migrations run on every app launch — idempotent and non-destructive.

---

## Performance Tiers (Hard Spec #12)

| Tier | Animations | Three.js | Framer Motion | API Polling |
|---|---|---|---|---|
| **Lite** | ❌ Off | ❌ Off | ❌ Off | ❌ Stopped |
| **Balanced** | ✅ CSS only | ❌ Off | ✅ Moderate | ✅ 2 min interval |
| **Ultra** | ✅ Full | ✅ Full | ✅ Full | ✅ 30 sec interval |

**Billing is never degraded by any performance tier.** All bill save, PDF, and DB operations run at full speed in all three modes.

Mode switch is live (no app reload). `PerformanceContext` emits `performanceModeChange` via EventBus. All polling hooks consume `apiPollingEnabled` — when false, no `setInterval` is created and existing intervals are cleared immediately.

---

## Boolean-Gated Module System (Phase 13)

All future modules follow a strict 3-layer gate:

```
FeatureFlagContext (flag = false by default)
  └── Sidebar (nav item only visible when flag true)
        └── AppShell GatedModulePage (renders only when flag true + optional cloud key)
              └── Module page component (polished placeholder until built)
```

When a flag is OFF: zero code runs, zero nav items show, zero impact on core app.
When a flag is ON: module nav item appears; placeholder page renders with feature list.

Admin+cloud modules (Branch Activity Monitor, Customer DB Sync, Price List Sync) additionally require a non-empty `cloudAccessKey` in config.

---

## Build & Packaging

### Dev Mode
```bash
npm run dev
# Vite dev server → http://localhost:5173
# vite-plugin-electron launches Electron pointed at dev server
# No .exe produced. HMR for renderer. Main process auto-restarts on change.
```

### Production Build
```bash
npm run build     # Vite renderer build → /dist + tsc Electron → /dist-electron
npm run package   # build + electron-builder → /release/cQikly-Setup-1.0.0.exe
```

### Installer (NSIS)
- x64 Windows only
- Multi-step wizard (not one-click silent)
- User chooses install directory
- Desktop + Start Menu shortcuts created
- Uninstaller included
- `better-sqlite3` extracted outside asar (`asarUnpack`)

---

## Security

- `nodeIntegration: false` — renderer cannot use Node.js APIs
- `contextIsolation: true` — no shared JavaScript context between main and renderer
- `contextBridge` — only `window.cqikly.*` exposed to renderer; minimal surface
- All external URLs opened via `shell.openExternal` (system browser, not Electron)
- App Lock — optional PIN lock with configurable inactivity timeout
- No remote module usage

---

## Key Architectural Decisions Log

See `/decisions/DECISIONS.md` for the full log across all 45 phases.

Most significant decisions:
- **D-1a-ii-B-1:** All external calls in service layer — components never touch DB/API directly
- **D-1b-A-3:** Crash recovery stores only the single most recent draft (Hard Spec #7)
- **D-6a-A-1:** PDF via HTML→Chromium printToPDF (no jsPDF/PDFKit)
- **D-8b-ii-2:** Payment status recomputed from scratch on every change (no delta tracking)
- **D-13-5:** GatedModulePage is separate from PageContent to avoid hook-count issues
- **D-14-2:** `asar: true` + `asarUnpack` for better-sqlite3 native module
