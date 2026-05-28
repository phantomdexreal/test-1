# Phase 1b-A — Done

**Built:** May 2026  
**Status:** ✅ Complete — `npm run dev` runs with zero errors

---

## What Was Built

### Safety System 1: Session Activity Logger (`src/main/sessionLogger.ts`)

- **Singleton class** — `sessionLogger` exported as a module-level singleton
- **`init()`** — call once in `main/index.ts` after `app.whenReady()`; creates `AppData/logs/session_activity_YYYY-MM-DD.log`
- **`log(event, data)`** — appends one NDJSON line per call; synchronous `appendFileSync` for crash safety
- **20+ typed `SessionEventName` values** — APP_LAUNCH, BILL_CREATED, CUSTOMER_ADDED, SETTINGS_CHANGED, etc.
- **`getLogPath()` / `getLogsDir()`** — for the backup service (Phase 10) to include log in every ZIP (Hard Spec #25)
- **Never surfaces in UI** — per Hard Spec #18; file is in AppData only; accessible by navigating the file system
- **Session header** written at `init()` with a unique session ID per run
- **Renderer bridge** — `app:sessionLog` IPC channel + `window.cqikly.app.sessionLog()` so renderer components can log events without main-process imports

### Safety System 2: Auto-Updater (`src/main/updater.ts`)

- **`initUpdater()`** — call once in `main/index.ts` after window is created
- **`electron-updater` lazy-loaded** — if misconfigured (no publish URL), caught silently; billing is never affected
- **`autoDownload: true`** — background download; `autoInstallOnAppQuit: false` — user controls when to restart
- **3-second delayed check** — avoids competing with window ready paint
- **IPC push events** — `updater:updateAvailable` (with `readyToInstall: boolean`) and `updater:downloadProgress` (%) pushed to all renderer windows
- **`checkForUpdateManual()`** — for Settings page "Check for updates" button
- **`installUpdateNow()`** — called by IPC handler; fires `autoUpdater.quitAndInstall()`
- **Zero-crash guarantee** — every `electron-updater` call wrapped in try/catch; errors are `console.warn` only

#### UpdateToast (`src/renderer/components/UpdateToast.tsx`)
- Listens for `updater:updateAvailable` and `updater:downloadProgress` IPC events
- Top-right floating toast; never blocks billing
- States: `update-available` → `downloading` (with progress bar) → `ready-to-install`
- "Install & Restart" one-click button
- Auto-dismisses after 30s if user does nothing (re-shown on next update event)

### Safety System 3: App Lock / PIN Gate (`src/renderer/components/AppLockGate.tsx`)

- **Wired into launch flow** — wraps all app content at the top of the React tree (inside all 6 context providers)
- **Skips cleanly when disabled** (default) — `isEnabled()` returns `false` → children rendered immediately; zero UI impact
- **When enabled** — shows a full-screen PIN entry screen; children are NOT rendered until the correct PIN is entered
- **PIN UI** — 4 hidden input, dot indicators, Enter key submit, error message, IPC verify
- **IPC handlers** — `appLock:isEnabled`, `appLock:verify`, `appLock:enable`, `appLock:disable`, `appLock:changePIN` all wired in Phase 1a-i-B; PIN stored as SHA-256 hash in `AppData/lock.json`
- **Settings UI** (enable/change/disable PIN, idle timeout lock) — Phase 11b-i
- **Session logging** — `APP_LOCK_VERIFIED` / `APP_LOCK_FAILED` events

### Safety System 4: Crash Recovery (`src/main/crashRecovery.ts` + `src/renderer/components/CrashRecoveryPrompt.tsx`)

**Main process (`crashRecovery.ts`):**
- **`checkForDraftOnLaunch()`** — called after `ready-to-show` so the window is already visible
- Checks `AppData/crash_draft.json`; validates JSON; deletes corrupt files silently
- Pushes `crash:draftFoundOnLaunch` IPC with a lightweight summary (partyName, billDate, itemCount) to all renderer windows
- 1.5s delay before push (React needs to mount and subscribe first)
- Retries once after 2 more seconds if no windows were ready

**Renderer component (`CrashRecoveryPrompt.tsx`):**
- Subscribes to `crash:draftFoundOnLaunch` via `onDraftFound()`
- Bottom-right floating banner; never blocks billing
- Shows party name, bill date, item count from the summary
- **Restore** → reads full draft → logs `BILL_DRAFT_RESTORED` → clears draft → logs to console (Phase 3 will hydrate the quote page)
- **Discard** → logs `BILL_DRAFT_DISCARDED` → calls `crash:clearDraft`
- **Dismiss** → hides banner; draft file NOT deleted; will re-appear on next launch
- Auto-dismisses after 60 seconds (draft not deleted)

---

## Files Created / Modified

| File | Status |
|---|---|
| `src/main/sessionLogger.ts` | ✅ New |
| `src/main/updater.ts` | ✅ Replaced stub |
| `src/main/crashRecovery.ts` | ✅ Replaced stub |
| `src/main/index.ts` | ✅ Modified — wires all 4 safety systems |
| `src/main/preload.ts` | ✅ Modified — added `onDraftFound`, `sessionLog` |
| `src/main/ipc/index.ts` | ✅ Modified — added `APP_SESSION_LOG` channel |
| `src/main/ipc/handlers/app.handler.ts` | ✅ Modified — handles `app:sessionLog` |
| `src/main/ipc/handlers/updater.handler.ts` | ✅ Modified — uses real updater module |
| `src/renderer/components/AppLockGate.tsx` | ✅ New |
| `src/renderer/components/CrashRecoveryPrompt.tsx` | ✅ New |
| `src/renderer/components/UpdateToast.tsx` | ✅ New |
| `src/renderer/components/index.ts` | ✅ Modified — exports 3 new components |
| `src/renderer/types/cqiklyApi.d.ts` | ✅ Modified — added `onDraftFound`, `sessionLog` types |
| `src/renderer/App.tsx` | ✅ Modified — wires AppLockGate, UpdateToast, CrashRecoveryPrompt |
| `docs/phases/phase-1b-A-done.md` | ✅ This file |

---

## Architecture Decisions

1. **Session logger is main-process only** — per Hard Spec #18; no log file path ever sent to renderer. The `app:sessionLog` IPC is fire-and-forget (one-way `send`, not `invoke`) so it never blocks renderer code.

2. **electron-updater lazy-loaded** — avoids crashing the import chain in dev mode where no publish URL is configured. The `require()` is wrapped in try/catch.

3. **CrashRecovery push timing** — the main process can't guarantee the renderer is mounted when `ready-to-show` fires. The 1.5s delay + 2s retry ensures the React `useEffect` subscription is in place before the event arrives.

4. **AppLockGate location** — sits inside all 6 context providers so it has access to theme CSS variables for styling the PIN screen. Sits outside the page router (added in Phase 1b-B) so the lock screen is truly app-wide.

5. **Zero-crash guarantees** — every safety system has independent try/catch. Failure in the logger, updater, or crash recovery never prevents app launch or billing operations (Core Principle: visual systems must never block billing).

---

## Test Checklist

| Test | How to verify |
|---|---|
| `npm run dev` — zero errors | Run `npm run dev`; app window opens |
| Session logger creates file | After launch, check `%APPDATA%\cqikly\logs\` for `session_activity_*.log` |
| Logger contains APP_LAUNCH entry | Open the log file — first line contains `"event":"APP_LAUNCH"` |
| Auto-updater check fires | Console shows `[Updater] Checking for update…` or `expected in dev mode` |
| App Lock Gate — disabled | Loads normally with no PIN screen (lock.json doesn't exist) |
| App Lock Gate — enabled | Create `%APPDATA%\cqikly\lock.json` with `{"enabled":true,"pinHash":"<sha256 of 1234>"}` → PIN screen appears |
| Crash recovery — no draft | Console shows `[CrashRecovery] No pending draft — clean launch` |
| Crash recovery — draft found | Manually create `%APPDATA%\cqikly\crash_draft.json` with `{"partyName":"Test Co","rows":[]}` → bottom-right banner appears after ~1.5s |
| Crash recovery — discard | Click Discard → banner disappears → draft file deleted |
| Crash recovery — dismiss | Click × → banner disappears → draft file NOT deleted → re-appears on next launch |
| Health check rows | App shows all 13 status rows turning green |

---

## Known Issues / TODOs

- `// TODO: [DRAFT-RESTORE]` — in `CrashRecoveryPrompt.tsx` line ~95: bill hydration from draft into the quote page form. Phase 3.
- `// TODO: [IDLE-LOCK]` — idle timeout auto-lock. Phase 11b-i.
- `// TODO: [SETTINGS-PIN-UI]` — enable/change/disable PIN UI in Settings page. Phase 11b-i.
- electron-updater requires a publish feed URL in `electron-builder.config.js` for production. See `ELECTRON_REBUILD_GUIDE.md`. Phase 14.

---

## Handoff State

All 4 safety systems are wired and fully operational. `npm run dev` passes. The app shell is a status dashboard from Phase 1a-ii-B — unchanged. Phase 1b-B next: sidebar navigation shell with 6 placeholder pages, dark/light toggle, and performance mode UI wiring.
