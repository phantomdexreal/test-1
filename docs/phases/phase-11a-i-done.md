# Phase 11a-i — Done

## What Was Built

### Settings Page: Company Profile + Bill Number Settings

This phase built the first two major sections of the Settings page (Page 6):

---

### 1. Company Profile Panel (`CompanyProfilePanel.tsx`)

All onboarding fields are now fully editable from Settings:

| Field | Notes |
|---|---|
| Firm / Company Name | Propagates instantly to app-wide `companyName` config key via event bus |
| Company Address | Textarea |
| GST Number | Auto-uppercased, optional |
| Office Type | Head Office / Branch selector |
| Number of Branches | Shown only when Head Office selected |
| Contact Phone | |
| Contact Email | |
| Financial Year Start Month | Changing this updates the bill number reset schedule immediately |
| Bill Number Reset Cycle | Yearly / Monthly / Never |
| Starting Bill Number | Clearly labelled ONE-TIME ONLY; amber warning badge; disabled after first bill |
| Company Logo | File picker with preview, update/remove buttons |
| **Onboarding Re-run button** | Opens confirmation modal → launches full wizard |

**Persistence:** Writes to `company_profile` SQLite table (via IPC in Electron; localStorage in dev/browser). Also calls `updateConfig()` for instant event bus propagation.

**Debounce:** All field changes are debounced 400 ms before writing — no IPC churn on fast typing. Visual "✓ Saved" badge appears after each save.

---

### 2. Bill Number Settings Panel (`BillNumberSettingsPanel.tsx`)

| Control | Notes |
|---|---|
| PO Number Prefix | e.g. `INV/` — applied to every new bill number |
| Financial Year Start Month | Independent selector (mirrored with Company Profile) |
| Reset Cycle | Yearly / Monthly / Never |
| Year Prefix (read-only display) | Auto-computed `YY-YY/` format; shown live as user adjusts FY month |
| Starting Number | One-time migration; disabled + green badge after consumed |
| Auto-increment toggle | ON/OFF; default ON |
| **Live Preview** | Shows next bill number in real time as settings change |

**Hard Spec #3 compliance:**
- Starting number is one-time only — `migrationConsumed` flag tracked in `BillNumberEngine`
- Resets always go back to 1 — never re-apply migration number
- Year prefix auto-computed via `getFYPrefix()` from `billNumber.ts`
- Deleted bill numbers permanently retired

---

### 3. Settings Page Layout Refactor

The Settings page (`index.tsx`) was refactored from a `PlaceholderPage` wrapper to a proper two-column layout:

- **Left nav sidebar** (200px) — anchor links to all sections with active state
- **Main content area** — scrollable, all panels stacked vertically with `id` anchors for nav
- Sections: Company Profile, Bill Number Settings, PDF Settings, Appearance, Performance, Inventory & Stock, Dashboard

---

### 4. ConfigContext Updates

Added two new fields to `AppConfig`:
- `companyName: string` — firm name propagated via event bus on profile save
- `billAutoIncrement: boolean` — default `true`; controls whether bill number increments automatically

---

### 5. DB Migration 003 (`003_phase11a_i.ts`)

Added `number_of_branches INTEGER DEFAULT 0` column to `company_profile` table (was missing from initial schema). Migration is safe — guarded with try/catch against already-existing columns.

---

## Architecture Notes

- **CompanyProfilePanel** reads from DB (IPC) on mount for richest data; falls back to `localStorage` in browser dev mode
- **BillNumberSettingsPanel** uses `getBillNumberEngine()` singleton — same engine used by quote page
- Both panels call `updateBillNumberConfig()` on FY month / reset cycle change → engine recalculates next prefix immediately
- Settings page left nav uses `<a href="#id">` anchor scrolling — no router needed, purely CSS scroll-margin
- The `PlaceholderPage` wrapper is fully removed from Settings — replaced with real layout

---

## Known Limitations

- Logo is stored as base64 data URL in the DB (fast to implement; future migration to file system is noted in onboarding service comments)
- `number_of_branches` field added as migration; existing installs upgrade cleanly
- Cloud sharing toggle from onboarding is not shown in Company Profile (future phase — requires cloud key activation)

---

## Test Checklist

- [ ] Open Settings → Company Profile panel loads with existing firm details from DB
- [ ] Change firm name → "✓ Saved" badge appears; QuotePage header reflects new name on next render
- [ ] Change Financial Year Start Month → Bill Number Settings "Current Year Prefix" updates immediately
- [ ] Change Reset Cycle → Live Preview bill number updates
- [ ] Upload logo → preview shows; save appears; logo persists after app restart
- [ ] Remove logo → preview reverts to placeholder icon
- [ ] Starting Bill Number field shows amber warning; after first bill, shows green "already consumed"
- [ ] Onboarding Re-run button → confirmation modal → "Open Setup Wizard" → wizard opens
- [ ] All changes persist after app restart (config + DB)
- [ ] Bill Number Settings "Auto-increment" toggle → flips ON/OFF → persists

---

## Handoff State

All existing features from Phase 10 are fully intact. Settings page now has real sections. Next phase is **11a-ii**: PDF Settings, Print Settings, Appearance & Theme, and Language selector panels.

---

## Files Added / Changed

| File | Status |
|---|---|
| `src/renderer/pages/Settings/CompanyProfilePanel.tsx` | **NEW** |
| `src/renderer/pages/Settings/BillNumberSettingsPanel.tsx` | **NEW** |
| `src/renderer/pages/Settings/index.tsx` | **UPDATED** — full layout refactor |
| `src/renderer/contexts/ConfigContext.tsx` | **UPDATED** — `companyName`, `billAutoIncrement` fields |
| `src/main/db/migrations/003_phase11a_i.ts` | **NEW** |
| `docs/phases/phase-11a-i-done.md` | **NEW** |
