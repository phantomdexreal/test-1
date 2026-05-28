# cQikly — Bug Fixes FIX-17 through FIX-21

> Applied in order: FIX-17 → FIX-18 → FIX-19 → FIX-20 → FIX-21

---

## SESSION FIX-17 ✅ DONE — Packaged App: Migrations Dir Empty, DB Schema Never Created

### Root Cause
`electron-builder.config.js` pointed `extraResources.from` at `src/main/db/migrations/` (the TypeScript source directory), which contains only `.ts` files. The filter `['**/*.js']` matched nothing, so **zero files** were copied into the packaged app's `resources/migrations/` directory.

At runtime, `MigrationRunner` reads from `process.resourcesPath/migrations` in the packaged app. With an empty directory, `getMigrationFiles()` returns `[]`. No migrations run, no tables are created, and every IPC call that touches the DB throws `no such table: bills` (or similar). The entire app is non-functional in packaged form.

### Fix Applied
Changed `extraResources.from` to point to the compiled output directory, which `tsc -p tsconfig.electron.json` populates with `.js` files before `electron-builder` runs:

```js
// BEFORE (broken):
from: 'src/main/db/migrations',

// AFTER (fixed):
from: 'dist-electron/main/db/migrations',
```

### Files Changed
- `electron-builder.config.js` — `extraResources[0].from` updated

### Did Not Touch
- `MigrationRunner` — the runtime path resolution is correct; only the packaging source was wrong
- Migration file names, version numbers, or `runAll()` logic
- `asarUnpack` config for `better-sqlite3`
- Dev-mode migration path (`__dirname/migrations` still resolves correctly from `dist-electron/main/db/`)

---

## SESSION FIX-18 ✅ DONE — Packaged App: Missing `LICENSE` File Breaks NSIS Installer Build

### Root Cause
`electron-builder.config.js` referenced `license: 'LICENSE'` in the `nsis` block. No `LICENSE` file exists in the project root. When `electron-builder` encounters a `license` path that doesn't resolve, it throws `ENOENT` and aborts — the installer `.exe` is never produced.

### Fix Applied
Removed the `license` line from the `nsis` block (Option A — preferred). The EULA screen is optional for NSIS; no license needs to be displayed in the installer.

```js
// BEFORE (broken):
license: 'LICENSE',

// AFTER (fixed):
// license removed — no EULA screen in installer (FIX-18: LICENSE file didn't exist)
```

### Files Changed
- `electron-builder.config.js` — `nsis.license` line removed

### Did Not Touch
- All other NSIS installer settings
- `package.json` `"license": "UNLICENSED"` field

---

## SESSION FIX-19 ✅ DONE — Preload `on()`: IPC Listener Never Actually Removed (Memory Leak + Duplicate Events)

### Root Cause
`preload.ts`'s `on()` helper registered an **anonymous wrapper function** with `ipcRenderer.on()`, but returned an unsubscribe closure that called `ipcRenderer.removeListener(channel, listener)` — passing the original `listener`, not the anonymous wrapper. `removeListener` uses strict reference equality, so it silently did nothing and the listener accumulated forever.

**Concrete effects:**
- Every component that subscribes on mount and unsubscribes on unmount (e.g. `CrashRecoveryPrompt`, `UpdateToast`) leaks listeners on every remount or HMR cycle.
- `crash:draftFoundOnLaunch` fires the handler multiple times after remounts.
- `UpdateToast` shows duplicate toasts for a single update event after navigation.

### Fix Applied
Assigned the wrapper to a named `const` before registering it, then closed over that same `const` in the unsubscribe function:

```ts
// BEFORE (broken):
function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  ipcRenderer.on(channel, (_event, ...args) => listener(...args))
  return () => ipcRenderer.removeListener(channel, listener)
}

// AFTER (fixed):
function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapper = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
  ipcRenderer.on(channel, wrapper)
  return () => ipcRenderer.removeListener(channel, wrapper)
}
```

### Files Changed
- `src/main/preload.ts` — `on()` function body

### Did Not Touch
- All callers of `on()`: `updater.onUpdateAvailable`, `updater.onDownloadProgress`, `crashRecovery.onDraftFound` — signatures unchanged
- `send()` and `invoke()` helpers

---

## SESSION FIX-20 ✅ DONE — Bill Number Engine Not Reset on Company DB Swap

### Root Cause
`src/renderer/utils/billNumber.ts` exports a module-level singleton `_engine` holding the current company's bill number state. When `DBContext.swapDatabase()` switches to a new company DB, the engine was never reset. The next bill for the new company continued the old company's sequence.

Example: Company A's last bill was `INV/25-26/42`. After swapping to Company B (counter at `INV/25-26/7`), the engine still holds Company A's state. Company B's next bill is incorrectly issued as `INV/25-26/43`.

`resetBillNumberEngine()` was already implemented and exported — it sets `_engine = null`, forcing a re-read from storage on next use.

### Fix Applied
Added the import and a `resetBillNumberEngine()` call in `swapDatabase()`, immediately after the `dbSwap` event is emitted:

```ts
// New import added:
import { resetBillNumberEngine } from '../utils/billNumber'

// Inside swapDatabase(), after eventBus.emit('dbSwap', ...):
eventBus.emit('dbSwap', { newDbPath: confirmedPath ?? newDbPath })
resetBillNumberEngine()   // forces re-init from storage on next bill save
await loadCustomers()
```

### Files Changed
- `src/renderer/contexts/DBContext.tsx`
  - Added import for `resetBillNumberEngine`
  - Added `resetBillNumberEngine()` call in `swapDatabase()` after `dbSwap` emit

### Did Not Touch
- Initial DB load on startup — `resetBillNumberEngine` is not called there; the engine lazily initializes on first use
- `peekNextBillNumber()` — will re-init from storage on next call after swap
- `BillNumberSettingsPanel` — re-reads from the freshly initialized engine on next mount
- All other DB swap logic in `swapDatabase()` — one line inserted, nothing else changed

---

## SESSION FIX-21 ✅ DONE — `backup.*` IPC Methods Declared in Types but Missing from Preload

### Root Cause
`cqiklyApi.d.ts` declared a `backup` namespace on `window.cqikly`, and `backup.service.ts` called `ipc.backup.create(...)` and `ipc.backup.scheduleSet(...)`. However, **the `backup` namespace was never added to `cqiklyAPI` in `preload.ts`**. `window.cqikly.backup` was `undefined` at runtime.

**Concrete effects:**
- **Manual backup**: `ipc?.backup?.create` evaluated to `undefined`, silently falling through to `simulateBackup()`. No real ZIP was ever created.
- **Restore from ZIP**: `typeof ipc.backup === 'object'` returned `false` (since `undefined` is not an object), falling through to `simulateRestore()`. No actual restore happened.
- **DB Sync**: Always called `simulateDbSwap()` — the actual `ipc.backup.swapDb` path was never reached.
- **Schedule set**: `ipc?.backup?.scheduleSet` silently did nothing.

Additionally, `restore` and `swapDb` were typed to accept `File` objects, which cannot be serialized across the IPC bridge. The correct types are path strings.

### Fix Applied

**Step 1 — preload.ts**: Added the `backup` namespace to `cqiklyAPI` with correct string-path signatures:

```ts
backup: {
  create: (options?: { destination?: string }) =>
    invoke<{ success: boolean; path?: string; filename?: string; error?: string }>(
      'backup:create', options
    ),
  restore: (zipPath: string) =>
    invoke<void>('backup:restore', zipPath),
  swapDb: (dbPath: string) =>
    invoke<void>('backup:swapDb', dbPath),
  scheduleSet: (schedule: 'daily' | 'weekly' | 'off', destination?: string) =>
    invoke<void>('backup:scheduleSet', schedule, destination),
},
```

**Step 2 — cqiklyApi.d.ts**: Updated `restore` and `swapDb` parameter types from `File` to `string`:

```ts
restore: (zipPath: string) => Promise<void>
swapDb:  (dbPath: string) => Promise<void>
```

**Step 3 — backup.service.ts**: Replaced optional-chain guards (`ipc?.backup?.create`, `ipc?.backup?.scheduleSet`) with plain `ipc` checks. The `backup` namespace is now always present on the preload object, so the optional chaining was only masking the missing method:

```ts
// triggerManualBackup — BEFORE:
if (ipc?.backup?.create) { ... }

// AFTER:
if (ipc) { ... }

// setBackupSchedule — same pattern applied
```

**Important note:** The main-process `backup.handler.ts` (which implements actual ZIP creation, restore, and DB swap logic) is a separate implementation task. After this fix, calling backup methods in Electron will throw an IPC error (`No handler registered for 'backup:create'`) rather than silently pretending to succeed. The renderer's `catch` blocks in `backup.service.ts` will surface a real error to the user — strictly better than silent fake-success.

### Files Changed
- `src/main/preload.ts` — added `backup` namespace to `cqiklyAPI`
- `src/renderer/types/cqiklyApi.d.ts` — updated `restore`/`swapDb` param types `File` → `string`
- `src/renderer/services/backup.service.ts` — replaced optional-chain guards with plain `ipc` checks in `triggerManualBackup` and `setBackupSchedule`

### Did Not Touch
- Dev-mode simulation paths in `backup.service.ts` — still fire when `ipc` is falsy (browser/non-Electron)
- All other `window.cqikly.*` namespaces
- `BackupRestorePanel.tsx` — after this fix `typeof ipc.backup === 'object'` will return `true`; the `restore` callsite will need updating separately (it passes a `File` where a `string` path is now required — the type system will flag this)

---

## Completion Status

| Session | Status      | Files Changed |
|---------|-------------|---------------|
| FIX-17  | ✅ Done     | `electron-builder.config.js` |
| FIX-18  | ✅ Done     | `electron-builder.config.js` |
| FIX-19  | ✅ Done     | `src/main/preload.ts` |
| FIX-20  | ✅ Done     | `src/renderer/contexts/DBContext.tsx` |
| FIX-21  | ✅ Done     | `src/main/preload.ts`, `src/renderer/types/cqiklyApi.d.ts`, `src/renderer/services/backup.service.ts` |
