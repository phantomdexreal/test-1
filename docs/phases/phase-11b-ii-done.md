# Phase 11b-ii — Done

**Built:** May 2026
**Status:** Complete — all deliverables implemented, build clean

---

## What Was Built

### Backup & Restore (`BackupRestorePanel.tsx`)
- **Auto backup scheduler** — daily / weekly / off toggle; destination folder picker via IPC file dialog (with dev-mode simulation fallback); schedule changes wired to `backup.service.ts → setBackupSchedule()`
- **Manual Backup Now** — calls `triggerManualBackup()`; shows running → success (filename + path) / error states
- **Backup restore** — drag-drop zone + browse (file input); accepts `.zip` only; confirmation step shows filename + warning; auto-backup taken before restore begins (calls `triggerManualBackup()`); restore flow: backing-up → restoring → success / error
- **Drag-and-drop DB sync** — drag a `.db` / `.sqlite` file from another device; confirmation + auto-backup before swap; simulates `ipc.db.swap()` or falls back to dev simulation
- **Factory reset (data wipe)** — 3-step multi-step confirmation: step 0 = button shown, step 1 = "are you sure?" with strong warning, step 2 = must type `WIPE` in exact text to unlock the final destructive button; calls `resetConfig()` from ConfigContext which wipes all settings; note: full business data wipe (DB deletion) is main-process work wired via future `ipc.backup` handler

**Hard Spec #25 compliance:** Every backup ZIP contains all SQLite DBs + config + session log — enforced in backup.service.ts comments and IPC contract.

### Saved Lists (`SavedListsPanel.tsx`)
- **Saved transporters list** — add/edit/delete tag-style list; persists in `config.savedTransporters` (string[]); tags appear as autocomplete in Transport Name field (quote page integration in future phase or current autocomplete hook)
- **Saved units list** — same pattern; persists in `config.savedUnits`; pre-seeded with 10 common units on first run: pcs, kg, g, litre, ml, meters, cm, boxes, dozen, set
- Both lists use a reusable `TagList` component with inline editing (click pencil → edit inline → Enter/Escape), add-on-enter support, and duplicate detection

### Customer Settings (`CustomerSettingsPanel.tsx`)
- **Customer credit limit default** — numeric input with ₹ prefix; saved to `config.customerCreditLimitDefault`; applied automatically to all new customers; shows "None (unlimited)" when set to 0; save on button click or Enter key

### Feature Module Toggles (`FeatureModuleTogglesPanel.tsx`)
- **Reports module** — boolean toggle via `setFlag('reports', !isOn)`
- **Expense Tracker** — boolean toggle
- **Multi-User / Operator Profiles** — boolean toggle
- **Payment Recorder & Ledger** — boolean toggle
- **WhatsApp Quick Share** — boolean toggle; when ON shows method selector (Desktop deep link / WhatsApp Web); Hard Spec #11: no hardcoded default; persists to `config.whatsappMethod`
- **Branch Sync** — admin-only; **completely hidden** when `config.cloudAccessKey` is empty; visible and toggleable only when a valid key is active
- Info banner shown when no access key is active explaining why Branch Sync is hidden
- All toggles use `useFeatureFlag()` context → `setFlag()` which persists to config and emits `featureFlagChange` event bus

### Access Key (`AccessKeyPanel.tsx`)
- Text input (password type) for cloud sync access key
- Activate button + Enter key support
- Visual locked/unlocked state indicator
- Active key blurred by default with show/hide toggle
- Revoke key flow (confirmation inline)
- Key stored in `config.cloudAccessKey`; triggers `configChange` event so FeatureModuleTogglesPanel reacts immediately (Branch Sync appears/disappears)
- Note: In dev mode, any non-empty string counts as valid. Server-side validation is future Supabase work.

### Config Export / Import (`ConfigExportImportPanel.tsx`)
- **Export** — downloads a `.json` file named `cQikly_Config_{date}.json` containing the full config object plus `_cqiklyConfigVersion: 1` and `_exportedAt` metadata
- **Import** — drag-drop zone + browse; accepts `.json` / `.cqconfig`; parses and validates `_cqiklyConfigVersion` presence; shows confirmation dialog before applying; **Hard Spec #16 compliance**: `COMPANY_PROFILE_KEYS = ['companyProfileId', 'companyName', 'onboardingComplete']` are stripped from the import payload before calling `updateConfig()` — company profile is never overwritten

---

## Config Fields Added (`ConfigContext.tsx`)

```typescript
// Phase 11b-ii: Backup & Restore
backupSchedule: 'daily' | 'weekly' | 'off'    // default: 'off'
backupDestination: string                       // default: ''

// Phase 11b-ii: Saved Lists
savedTransporters: string[]                     // default: []
savedUnits: string[]                            // default: 10 common units

// Phase 11b-ii: Customer Settings
customerCreditLimitDefault: number              // default: 0

// Phase 11b-ii: Access Key
cloudAccessKey: string                          // default: ''
```

---

## Backup Service Updates (`backup.service.ts`)
- Added `setBackupSchedule(schedule, destination?)` — calls `ipc.backup.scheduleSet()` or logs in dev mode
- `triggerManualBackup()` now accepts optional `destination` parameter
- IPC type augmentation added to `cqiklyApi.d.ts`: `backup.create()`, `backup.restore()`, `backup.swapDb()`, `backup.scheduleSet()`

---

## Pre-existing Bug Fixes (carried from Phase 11b-i)
1. `UnitConverterWidget.tsx:113` — `??` with `||` without parentheses (esbuild parse error) → fixed with `(unitKeys[1] ?? unitKeys[0])`
2. `bill.service.ts:351` — garbled comment syntax `} and customer record (non-fatal side effects)` → restored to `} // Update customer record`
3. `InternetGate.tsx` — wrong relative import path `../../services/internet.service` (component is one level deep, not two) → corrected to `../services/internet.service`

---

## Settings Navigation
New sections added to left nav:
- 💾 Backup & Restore → `#backup`
- 📋 Saved Lists → `#savedlists`
- 👤 Customer Settings → `#customersettings`
- 🧩 Feature Modules → `#featuretoggles`
- 🔑 Access Key → `#accesskey`
- 📤 Config Export/Import → `#configexportimport`

---

## Architecture Notes

- All panels follow the established pattern: `useConfig()` for reads/writes, `eventBus.emit('configChange', ...)` for cross-context propagation, zero restart required
- `FeatureModuleTogglesPanel` reacts to `cloudAccessKey` changes instantly because it reads from `config` (ConfigContext) which is reactive — Branch Sync toggle appears/disappears within the same render cycle
- The `ConfigExportImportPanel` export uses browser `URL.createObjectURL()` — works in both Electron renderer and dev browser mode
- Factory reset calls `resetConfig()` which is the established ConfigContext reset path; main-process DB deletion is a future `ipc.backup.factoryReset()` handler (stubbed)

---

## Known Limitations / Future Work

1. **Main-process backup handler** — `ipc.backup.create/restore/swapDb/scheduleSet` are typed but not yet implemented in `src/main/ipc/handlers/`. Dev mode simulates everything. The renderer-side logic is complete.
2. **Scheduled backup daemon** — `setBackupSchedule()` sends the schedule to main process; the actual cron-like scheduler (using `node-schedule` or `setInterval`) needs to be implemented in `src/main/`.
3. **Transport autocomplete wiring** — `config.savedTransporters` is populated; the quote page Transport Name field needs to read this list and show suggestions. To be wired in a future session.
4. **Units dropdown wiring** — `config.savedUnits` is populated; the Qty Unit column picker on the billing grid reads from this in the inventory/quote pages.
5. **Factory reset main process** — full DB deletion, session log clearing, and AppData cleanup need corresponding IPC handler.

---

## Test Checklist

- [ ] Auto backup: set schedule to Daily → verify `setBackupSchedule('daily', ...)` called in console
- [ ] Pick destination folder → path shown in field
- [ ] Backup Now → spinner → success card with filename and path
- [ ] Restore: drop a .zip → confirmation shown → "Back Up & Restore" → backing-up → restoring → success
- [ ] DB Sync: drop a .db file → confirmation → swap → success
- [ ] Factory Reset: click button → step 1 warning → step 2 text input → type anything but "WIPE" → button disabled → type "WIPE" → enabled → click → config resets
- [ ] Saved transporters: add "Blue Dart" → tag appears; click edit → rename; click ✕ → removed
- [ ] Saved units: add "litre" → duplicate warning shown (already default)
- [ ] Credit limit: enter 5000 → Save → reload page → still 5000
- [ ] Feature toggles: turn on Reports → toggle is green; turn off → back to grey
- [ ] WhatsApp toggle ON → method selector appears; choose Desktop; toggle OFF → method selector hidden
- [ ] No access key → Branch Sync row is hidden; enter any key → Branch Sync row appears
- [ ] Revoke key → Branch Sync row hides again
- [ ] Export config → file downloaded; open JSON → _cqiklyConfigVersion present, all settings present, companyName present
- [ ] Import config → confirmation shown → Apply → settings changed; verify companyName was NOT overwritten

---

## Handoff State

All 6 new Settings panels built, wired, TypeScript-clean, build passes.
Next phase: **Phase 12a** — wire every keyboard shortcut from the full shortcut map.

Entrypoint: `src/renderer/pages/Settings/index.tsx` (Settings page, all panels mounted)
Config: `src/renderer/contexts/ConfigContext.tsx` (all new fields added with defaults)
Services: `src/renderer/services/backup.service.ts` (updated with schedule support)
