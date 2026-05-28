# cQikly

**Desktop billing & business management for Indian SMBs.**  
Version 1.0.0 · Windows · Electron + React + SQLite · 100% Offline

---

## What cQikly Does

cQikly is a fast, offline-first billing desktop application built for Indian wholesale, retail, production, and B2B/B2C businesses. It runs entirely on your computer — no internet required for any billing operation.

**Core capabilities:**
- Create professional bills with customisable formats (Simplified, Professional, Detailed Professional)
- Auto-manage customers — saved automatically from bill data, no extra form needed
- Inventory management with stock tracking, price history, and fuzzy autocomplete while billing
- Full bill history with edit versioning — every change to a saved bill is preserved
- Payment recorder and outstanding ledger per customer
- Dashboard with revenue widgets, alerts, and optional live data (weather, crypto, forex)
- MKD (Marked Key Details) — custom billing grid markers with group totals
- PDF generation + copy as image + quick print for every bill format
- WhatsApp Quick Share (optional module) — opens WhatsApp after copying bill image
- Boolean-gated future modules: Reports, Expense Tracker, Multi-User, Branch Sync, and more

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (Radix) |
| Desktop Shell | Electron 31 (Windows only) |
| Animations | Three.js + Framer Motion (gated by Performance mode) |
| Local Database | SQLite via better-sqlite3 |
| Excel I/O | SheetJS |
| Fuzzy Search | Fuse.js |
| Build/Installer | electron-builder (NSIS, x64) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- Windows 10/11 (x64)
- Git

### Install

```bash
git clone https://github.com/your-org/cqikly.git
cd cqikly
npm install
# postinstall automatically runs: electron-rebuild -f -w better-sqlite3
# This step takes 2–5 minutes on first run
```

### Run in Dev Mode

```bash
npm run dev
```

- Starts the Vite dev server at `http://localhost:5173`
- `vite-plugin-electron` launches Electron pointed at the dev server
- Hot Module Replacement (HMR) works for renderer code
- Main process auto-restarts on change
- **No `.exe` is compiled or produced**
- Full app features work in dev mode: SQLite, IPC, PDF, crash recovery

### Build for Production

```bash
npm run build
# Compiles: Vite renderer → /dist   +   Electron main → /dist-electron
```

### Package Windows Installer

```bash
npm run package
# Runs build then electron-builder
# Output: /release/cQikly-Setup-1.0.0.exe
```

The installer is a standard NSIS wizard. Users can choose their installation directory. Desktop and Start Menu shortcuts are created automatically.

---

## Project Structure

```
cqikly/
├── src/
│   ├── main/                     # Electron main process
│   │   ├── index.ts              # Entry: window, IPC registration, migrations
│   │   ├── preload.ts            # contextBridge → window.cqikly.*
│   │   ├── ipc/                  # IPC handlers (db, pdf, settings, app, etc.)
│   │   ├── db/
│   │   │   ├── connectionManager.ts   # Swaps SQLite file per company profile
│   │   │   ├── migrationRunner.ts     # Auto-runs pending migrations on launch
│   │   │   └── migrations/            # Sequential SQL migration files
│   │   ├── crashRecovery.ts      # Draft detection on launch
│   │   ├── sessionLogger.ts      # Activity log to AppData
│   │   └── updater.ts            # electron-updater (graceful no-op without server)
│   └── renderer/                 # React app
│       ├── App.tsx               # Root: context providers + AppShell
│       ├── contexts/             # All global state (Config, Performance, FeatureFlags, ...)
│       ├── pages/                # 6 core pages + Onboarding
│       │   ├── NewQuote/         # Billing grid, MKD, PDF, copy image
│       │   ├── History/          # Bill history, versioning, edit
│       │   ├── CustomerDetails/  # Customer CRUD, ledger, payment recorder
│       │   ├── Inventory/        # Item CRUD, stock tracking, price history
│       │   ├── LooseInventoryHistory/
│       │   ├── Settings/         # 17 settings panels
│       │   ├── Dashboard/        # Widgets, backgrounds, alerts
│       │   └── Onboarding/       # First-run wizard
│       ├── modules/              # Boolean-gated feature stubs
│       │   ├── reports/
│       │   ├── expenseTracker/
│       │   ├── multiUser/
│       │   ├── paymentLedger/
│       │   ├── whatsappShare/
│       │   ├── branchSync/
│       │   ├── branchActivityMonitor/
│       │   ├── customerDbSync/
│       │   └── priceListSync/
│       ├── components/           # Shared UI components
│       ├── services/             # ALL external calls (DB, API, PDF, backup)
│       ├── hooks/                # useGlobalShortcuts and other hooks
│       ├── config/               # Feature flag definitions, app defaults
│       ├── utils/                # eventBus, billNumber, cn
│       └── types/                # cqiklyApi.d.ts (window.cqikly types)
├── docs/
│   ├── phases/                   # Phase-done files for all 45 sessions
│   └── architecture/             # Architecture diagram + document
├── changelog/CHANGELOG.md
├── decisions/DECISIONS.md
├── assets/                       # Icon files (icon.ico required for installer)
├── electron-builder.config.js
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.electron.json
└── package.json
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` | New Quote |
| `Ctrl+2` | History |
| `Ctrl+3` | Customer Details |
| `Ctrl+4` | Inventory |
| `Ctrl+5` | Loose Inventory History |
| `Ctrl+6` | Settings |
| `Ctrl+S` | Save bill |
| `Ctrl+Shift+S` | Save as PDF (prompt) |
| `Ctrl+Shift+C` | Copy bill as professional image |
| `Ctrl+Shift+X` | Copy bill as simplified image |
| `Ctrl+Shift+P` | Quick print |
| `Ctrl+D` | Duplicate bill |
| `Ctrl+F2` | Toggle F2 lock mode (grid) |
| `Insert` | Accept inventory autocomplete / rate hint |
| `Alt+N` | Toggle universal calculator |
| `Ctrl+Shift+N` | Toggle scratchpad |
| `Ctrl+K` | Global command palette |
| `Ctrl+/` | Shortcut reference panel |
| `Ctrl+Z` | Undo (grid) |
| `Ctrl+Y` | Redo (grid) |
| `Escape` | Close overlay / cancel |

---

## Performance Modes

Set in **Settings → Appearance → Performance Mode**.

| Mode | Animations | API Polling | Best For |
|---|---|---|---|
| **Lite** | Off (no Three.js, no Framer Motion) | Stopped | Low-spec PCs; pure billing speed |
| **Balanced** | CSS only | Every 2 minutes | Most users |
| **Ultra** | Full Three.js + Framer Motion | Every 30 seconds | High-spec machines |

Billing, PDF generation, and database operations run at full speed in all modes.

---

## Feature Modules (Optional)

Enable/disable in **Settings → Feature Modules**. All modules are off by default. When off, they have zero effect on the app.

| Module | Description | Admin/Cloud? |
|---|---|---|
| Reports | Business reports (future) | No |
| Expense Tracker | Track business expenses (future) | No |
| Multi-User / Operator Profiles | Multiple operators per installation (future) | No |
| Payment Recorder & Ledger | Payment tracking (partially in core) | No |
| WhatsApp Quick Share | Open WhatsApp after copying bill image | No |
| Branch Sync | Sync across branches (future) | Yes |
| Branch Activity Monitor | Monitor branch operations (future) | Yes |
| Customer DB Sync | Centralized customer database (future) | Yes |
| Price List Sync | Sync price lists across locations (future) | Yes |

---

## Hard Specs (Design Invariants)

These are product decisions that must never be changed without an explicit owner decision:

1. MKD separators: only `-` and `=` are valid. `+` is plain text.
2. MKD group names use actual column header names (never hardcoded "custom").
3. Bill number resets to 1 on every financial year reset. Starting number is one-time only.
4. New party from bill → auto-saved to Customer Details silently on bill save.
5. F2 lock mode: F2 unlocks cell with cursor inside existing content (not erased).
6. Sl.No column is never manually editable.
7. Crash recovery stores only the single most recent draft.
8. Simplified PDF has zero company info — header is `{Customer Name} - {Contact}` only.
9. Separate SQLite file per company profile/branch.
10. Every single bill edit (even one character) creates a preserved version.
11. WhatsApp share method (Desktop vs Web) is user-configurable in Settings.
12. Lite mode kills animations AND all API polling. Billing is never degraded.
13. Windows only for v1.x.
14. New rows in billing grid: Enter or Down arrow only. Tab does not add rows.
15. PDF page split: A5 (format-dependent row limit) → A4 → multi-page A4.

---

## Known Limitations

See `docs/phases/phase-14-done.md` for the full limitations list. Key points:

- **Windows only.** macOS/Linux are future considerations.
- **No code signing.** SmartScreen will warn "Unknown Publisher". Click "More info → Run anyway".
- **No auto-update server.** electron-updater is wired but update checks gracefully no-op.
- **All 9 feature modules are placeholder stubs.** Full implementations are future phases.
- **WhatsApp deep link requires WhatsApp Desktop installed.** Use "WhatsApp Web" method if not installed.

---

## Development Notes

### Rebuilding better-sqlite3

If you update the Electron version:
```bash
npm run rebuild
# electron-rebuild -f -w better-sqlite3
```

### TypeScript

```bash
npm run typecheck
# tsc --noEmit — type-checks both renderer and Electron main
```

### Adding a New Feature Module

1. Add a flag key to `FeatureFlagsMap` in `src/renderer/contexts/FeatureFlagContext.tsx`
2. Add default + label to `src/renderer/config/featureFlags.ts`
3. Add a toggle row in `src/renderer/pages/Settings/FeatureModuleTogglesPanel.tsx`
4. Create `src/renderer/modules/{yourModule}/index.tsx` (use `ModulePlaceholderPage`)
5. Add a `PageId` to `NavigationContext.tsx`
6. Add a route in `AppShell.tsx`'s `GatedModulePage`

### Adding a New DB Migration

Create `src/main/db/migrations/NNN_description.ts` with a `migrate(db)` function.
`MigrationRunner` will pick it up on next launch.

---

## Architecture

See `docs/architecture/ARCHITECTURE.md` for the full architecture document.  
See `docs/architecture/architecture-diagram.mermaid` for the Mermaid diagram source.

---

## Changelog

See `changelog/CHANGELOG.md`.

## Decisions Log

See `decisions/DECISIONS.md` — every significant architectural decision across all 45 sessions.

---

## Phase Completion

All 45 planned sessions complete:

`1a-i-A, 1a-i-B, 1a-ii-A, 1a-ii-B, 1b-A, 1b-B, 2a-A, 2a-B, 2b, 3a-A, 3a-B, 3b-i, 3b-ii, 4b-i, 4b-ii, 5a, 5b, 4a-i, 4a-ii-A, 4a-ii-B, 6a-A, 6b-A-i, 6b-A-ii, 6b-B, 7a-A, 7a-B, 7b, 8a, 8b-i, 8b-ii, 9a-A, 9a-B, 9b-A, 9b-B-i, 9b-B-ii-A, 9b-B-ii-B, 10, 11a-i, 11a-ii, 11b-i, 11b-ii, 12a, 12b, 13, 14`

---

*cQikly — Built for Indian SMBs. Offline forever. Fast always.*
