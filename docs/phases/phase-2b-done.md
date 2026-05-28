# Phase 2b — Done

**Phase:** 2b — Onboarding Flow: Internet Detection + DB Write + Redirect + Re-run  
**Completed:** 2026-05  
**Status:** ✅ Complete

---

## What Was Built

### 1. Internet Detection Service (`services/internet.service.ts`)
- `checkConnection()` — one-shot check via HEAD requests to Google ping endpoints with 5s timeout
- `watchConnection(cb, pollMs)` — subscribes to live online/offline browser events + polling
- Returns `ConnectionStatus`: `'checking' | 'online' | 'offline'`
- Uses `no-cors` mode to avoid CORS errors; any resolved fetch = internet confirmed
- Falls back gracefully across multiple ping targets

### 2. InternetGate Component (`components/InternetGate.tsx`)
- **Role A — Pre-wizard gate (firstLaunch=true):**
  - Shown before wizard opens on first launch
  - Cannot be dismissed or skipped
  - Auto-proceeds when online confirmed
  - Retry button for manual re-check
- **Role B — Mid-fill overlay (firstLaunch=false):**
  - Shown as overlay over the wizard when internet drops during filling
  - Shows "Continue Filling Without Internet →" option
  - Auto-closes when connection restores
  - All wizard data fully preserved — nothing reset
- Animated spinner, status dots, fade-in transitions
- Same dark purple palette as OnboardingWizard for visual continuity

### 3. Onboarding Persistence Service (`services/onboarding.service.ts`)
- `persistOnboardingData(data)` — writes to SQLite:
  - Deletes existing company_profile row (idempotent — supports re-run)
  - Inserts full company profile with all wizard fields
  - Seeds/updates `bill_number_sequence` with user's starting bill number
  - Logo stored as data URL in DB (file-based migration in Phase 11a-i)
- `readCompanyProfile()` — reads back company profile (for Settings and verification)
- Graceful no-IPC fallback (dev/browser mode silently succeeds)

### 4. Onboarding Page Rewrite (`pages/Onboarding/index.tsx`)
Full state machine: `landing → internet-check → wizard → internet-lost-mid → saving → complete`

- **Internet gate wired:** `landing → internet-check` (first launch only); gate fires `watchConnection` automatically
- **Mid-fill internet monitor:** starts when wizard opens, fires `InternetGate` overlay on drop, auto-recovers
- **Data preservation:** `wizardDataRef` holds wizard data across all state transitions — never reset
- **DB write:** `persistOnboardingData()` called on wizard complete
- **Config file update:** `updateConfig()` called with all billing prefs + `onboardingComplete: true`
- **Dashboard redirect:** setting `onboardingComplete: true` causes App.tsx to switch to AppShell (no explicit navigation needed)
- **Re-run mode (`isRerun=true`):** skips internet gate entirely; wizard opens immediately; `onRerunComplete` callback fires after save so Settings can dismiss the flow

### 5. Settings Page — Re-run Button (`pages/Settings/index.tsx`)
- "Re-run Company Setup Wizard" button added to Settings under Company Profile section
- Two-step confirmation dialog before opening the wizard ("Billing history is not affected")
- No internet check on re-run (as specified)
- On wizard complete: `onRerunComplete` fires → `setShowRerun(false)` → Settings page re-appears
- `PlaceholderPage` updated to accept optional `children` prop for the re-run section

### 6. OnboardingWizard — Save Error Banner
- New props: `saveError?: string`, `onClearSaveError?: () => void`
- If DB write fails, error banner shown at top of wizard body
- User can dismiss the error and try again — all data preserved

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| No-cors HEAD pings for internet check | Avoids CORS preflight; resolving = network exists; doesn't require server cooperation |
| Multiple ping targets | Resilience — if one CDN is blocked by ISP, others succeed |
| `watchConnection` polling + browser events | Browser online/offline events are unreliable alone (fire on LAN connect, not actual internet); polling catches flaky connections |
| Logo stored as data URL in DB | Simple for Phase 2b; file-based storage in Phase 11a-i avoids bloating DB |
| `onboardingComplete` flag in config drives redirect | Single source of truth; App.tsx already gates on it; no router needed |
| Re-run: no internet check | Spec requirement — returning users don't need internet gate |
| `wizardDataRef` (not state) for data preservation | Survives `setStage` re-renders without triggering extra effects |

---

## Test Scenarios

| Test | Expected |
|---|---|
| First launch, offline | LandingScreen shown; click cQikly text → InternetGate appears; retry works; cannot skip |
| First launch, online | Click text → brief "Checking..." → auto-opens wizard |
| Fill wizard 4 steps → kill internet | Mid-fill InternetGate overlay appears; all 4 steps' data preserved |
| Restore internet during mid-fill | Overlay auto-dismisses; wizard resumes from exact step |
| Click "Continue without internet" | Overlay closes; wizard continues (DB write will fail gracefully later) |
| Complete wizard → check SQLite | `company_profile` row populated with all fields |
| Complete wizard → check config | `onboardingComplete: true`, `fyStartMonth`, `billResetCycle`, `startingBillNumber` set |
| Complete wizard → app state | App switches to AppShell (Dashboard) |
| Settings → Re-run button → confirm | Wizard opens without internet check |
| Re-run wizard complete | Company profile in DB overwritten; Settings page returns |
| DB write fails | Error banner in wizard; user can retry; data preserved |

---

## Known Issues / Notes

- Logo storage as data URL in SQLite is a short-term approach. Very large logos (>500 KB) are rejected with a warning. Phase 11a-i will migrate to file-based storage.
- In browser-only dev mode (no Electron IPC), DB writes are silently skipped; config file write uses localStorage. The redirect (onboardingComplete = true) still fires correctly.
- The `bill_number_sequence` uses `INSERT ... ON CONFLICT DO UPDATE` — requires SQLite 3.24+. better-sqlite3 bundles SQLite 3.39+, so this is safe.

---

## Files Modified / Created

| File | Change |
|---|---|
| `src/renderer/services/internet.service.ts` | **NEW** — internet detection + live watcher |
| `src/renderer/services/onboarding.service.ts` | **NEW** — SQLite write + config persistence |
| `src/renderer/components/InternetGate.tsx` | **NEW** — internet gate UI (pre-wizard + mid-fill) |
| `src/renderer/pages/Onboarding/index.tsx` | **REWRITE** — full Phase 2b state machine |
| `src/renderer/pages/Onboarding/OnboardingWizard.tsx` | **MODIFIED** — added saveError props |
| `src/renderer/pages/Settings/index.tsx` | **REWRITE** — re-run button + confirmation dialog |
| `src/renderer/components/PlaceholderPage.tsx` | **MODIFIED** — added children prop |
| `src/renderer/components/index.ts` | **MODIFIED** — export InternetGate |
| `src/renderer/services/index.ts` | **MODIFIED** — export new services |

---

## Handoff State

All Phase 2b deliverables complete. The onboarding flow is fully wired end-to-end:
- Internet gate blocks wizard on first launch
- Mid-fill internet loss detected and recovered without data loss
- All onboarding data persists to SQLite + config file on completion
- Dashboard redirect works (via onboardingComplete flag in ConfigContext)
- Settings Onboarding Re-run button is live and functional

**Next phase:** Phase 3a-A — Dashboard layout shell, sidebar, clock, to-do, system status, animated background.
