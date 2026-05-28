# Phase 13 — Boolean-Gated Module Stubs + Future Module Wiring

**Status:** ✅ Complete  
**Date:** May 2026

---

## What Was Built

### 1. Architecture: Module Stub System

Every future module follows a strict 3-layer pattern:

```
Feature flag (FeatureFlagContext)
  └── Sidebar nav item (only visible when flag ON)
        └── AppShell page routing (only renders when flag ON + guard check)
              └── Module page component (polished placeholder)
```

When a flag is OFF:
- Zero nav items added to sidebar
- Zero module code executed
- Zero console output
- Zero impact on any other module or core page

When a flag is ON:
- A "Modules" section appears in the sidebar with the module's nav item
- Navigating to it shows a polished placeholder page
- The placeholder describes what the module will do when fully built

---

### 2. Modules Built / Upgraded

| Module | Flag Key | Page ID | Admin+Cloud? | Status |
|---|---|---|---|---|
| Reports | `reports` | `module-reports` | No | ✅ Polished stub |
| Expense Tracker | `expenseTracker` | `module-expense-tracker` | No | ✅ Polished stub |
| Multi-User / Operator Profiles | `multiUser` | `module-multi-user` | No | ✅ Polished stub |
| Payment Recorder & Ledger | `paymentLedger` | `module-payment-ledger` | No | ✅ Polished stub (core in Phase 8b-ii) |
| WhatsApp Quick Share | `whatsappShare` | Service only — no page | No | ✅ Wired to bill copy |
| Branch Sync | `branchSync` | `module-branch-sync` | Yes | ✅ Polished stub |
| Branch Activity Monitor | `branchActivityMonitor` | `module-branch-activity-monitor` | Yes | ✅ New polished stub |
| Centralized Customer DB Sync | `customerDbSync` | `module-customer-db-sync` | Yes | ✅ New polished stub |
| Price List Sync | `priceListSync` | `module-price-list-sync` | Yes | ✅ New polished stub |

**Developer-suggested additional modules documented** (see Section 6 below).

---

### 3. Shared ModulePlaceholderPage Component

**File:** `src/renderer/components/ModulePlaceholderPage.tsx`

A reusable component used by all module stub pages. Renders:
- Large icon + status badge (colour-coded: blue/green/purple/amber)
- Module title + description
- "Module Enabled — Full Build Coming in a Future Phase" notice
- Feature list: icon + label + description for each planned feature (5 per module)
- Admin note (for cloud/admin-only modules)
- Settings path hint (to disable the module)

Design: generous padding, breathing room, nothing cramped — consistent with the masterplan UI rule.

---

### 4. WhatsApp Quick Share — Wired to Bill Copy

**Files modified:**
- `src/renderer/modules/whatsappShare/index.tsx` — service functions `triggerWhatsAppShare()` + `getWhatsAppMethodLabel()`
- `src/renderer/pages/NewQuote/index.tsx` — wired into `handleCopyProfessionalImage()` and `handleCopySimplifiedImage()`

**Behaviour:**
1. User copies bill as image (Ctrl+Shift+C or Ctrl+Shift+X)
2. Image lands in clipboard with a success toast as before
3. If `whatsappShare` flag is ON **and** `config.whatsappMethod` is set:
   - Calls `triggerWhatsAppShare(config.whatsappMethod)`
   - Opens WhatsApp Desktop (deep link `whatsapp://`) or WhatsApp Web (`web.whatsapp.com`)
   - Second toast: "📱 WhatsApp opened — paste the bill image in your chat"
4. If flag is OFF → zero change to copy image flow (no extra toast, no window open)
5. If flag is ON but `whatsappMethod` is not yet configured → share is not triggered (user must configure the method first in Settings)

**Hard Spec #11 preserved:** Method (desktop vs web) is user-configurable in Settings → Feature Modules → WhatsApp Quick Share. No hardcoded default.

---

### 5. Sidebar: "Modules" Section

**File:** `src/renderer/components/Sidebar.tsx`

- Imports `useFeatureFlag` and `useConfig`
- Builds `activeModuleNavItems` list from all module definitions, filtered by:
  - `flags[mod.flagKey]` must be `true`
  - For admin+cloud modules: `config.cloudAccessKey` must be non-empty
- If no modules are active → no "Modules" section appears at all (no empty divider)
- If at least one module is active → a "MODULES" label + nav buttons appear below the core pages
- Module nav buttons follow the same hover/active styling as core page buttons
- No shortcut keys shown for module pages (they're optional, not part of the fixed Ctrl+1–6 scheme)

---

### 6. NavigationContext: Extended PageId Union

**File:** `src/renderer/contexts/NavigationContext.tsx`

Added 9 new module `PageId` values:
```
module-reports
module-expense-tracker
module-multi-user
module-payment-ledger
module-whatsapp-share  (registered for completeness; no page rendered)
module-branch-sync
module-branch-activity-monitor
module-customer-db-sync
module-price-list-sync
```

These are **not** in `ALL_PAGES` — they never appear in the core sidebar or shortcut map. They are only navigable when explicitly set by the sidebar module nav items (when flag is on).

---

### 7. AppShell: GatedModulePage Renderer

**File:** `src/renderer/components/AppShell.tsx`

- `PageContent` now has a two-phase routing:
  1. Core pages (always rendered from a static map)
  2. `GatedModulePage` (called when activePage is a module page ID)
- `GatedModulePage` component reads each flag with `useFlag()` and switches on `activePage`
- Uses two guard functions:
  - `guard(flagOn, el)` — renders el only if flag is on; otherwise renders NewQuotePage
  - `adminGuard(flagOn, el)` — also requires `hasCloudKey`; otherwise renders NewQuotePage
- This means: even if somehow navigated to a module page ID with the flag off, the user sees NewQuotePage — not a broken render

---

### 8. FeatureModuleTogglesPanel Updated

**File:** `src/renderer/pages/Settings/FeatureModuleTogglesPanel.tsx`

Added 3 new admin+cloud module rows:
- Branch Activity Monitor (📡)
- Centralized Customer DB Sync (🗄️)
- Price List Sync (🏷️)

All 3 are `adminOnly: true` — hidden when no cloud access key is set.

---

### 9. Developer-Suggested Additional Tools

The following future modules are documented here as developer suggestions. Each would follow the same boolean-gated pattern if added:

| Module | Suggested Flag | Description |
|---|---|---|
| **SMS Quick Share** | `smsShare` | Similar to WhatsApp — share bill summary as SMS via default SMS app |
| **Email Quick Share** | `emailShare` | Open default mail client with bill PDF/image attached |
| **Daily Digest Reminder** | `dailyDigest` | End-of-day popup: today's bills, revenue, and outstanding summary |
| **Custom Stamp / Watermark** | `customStamp` | Add custom text stamp (e.g., "ORIGINAL", "DUPLICATE") to PDFs |
| **Bill Approval Workflow** | `billApproval` | Operator creates bill → supervisor approves before saving; for multi-user mode |
| **Barcode Label Printer** | `labelPrinter` | Print item barcodes directly from inventory; requires label printer |
| **Tally Export** | `tallyExport` | Export bills in Tally-compatible XML format |

None of these are implemented. They are documented here as seeds for future phases. Each would require:
1. A new `FeatureFlagName` entry in `FeatureFlagContext.tsx`
2. A new entry in `featureFlags.ts`
3. A toggle row in `FeatureModuleTogglesPanel.tsx`
4. A module folder under `src/renderer/modules/`
5. A `PageId` entry in `NavigationContext.tsx` (if it has a page)
6. A route in `AppShell`'s `GatedModulePage`

---

### 10. Mobile Module Note

Per Masterplan Section 16 — Mobile Module documented here:

> Eventually push modules such that cQikly works on mobile as well, with branch sync on desktop.

This is a long-term future path. The current architecture is Electron (Windows desktop). Mobile would require:
- A React Native or PWA renderer target
- The same SQLite service layer abstracted further (SQLite → generic DB interface)
- The Branch Sync / Supabase infrastructure as the data bridge between desktop and mobile
- A `mobile` boolean flag in config to enable mobile-optimised layouts

No implementation in Phase 13. Documented for future reference.

---

## Files Created

| File | Description |
|---|---|
| `src/renderer/components/ModulePlaceholderPage.tsx` | Shared polished stub page component |
| `src/renderer/modules/reports/index.tsx` | Reports module page (upgraded from bare stub) |
| `src/renderer/modules/expenseTracker/index.tsx` | Expense Tracker module page (upgraded) |
| `src/renderer/modules/multiUser/index.tsx` | Multi-User module page (upgraded) |
| `src/renderer/modules/paymentLedger/index.tsx` | Payment Ledger module page (upgraded) |
| `src/renderer/modules/whatsappShare/index.tsx` | WhatsApp share service (triggerWhatsAppShare) |
| `src/renderer/modules/branchSync/index.tsx` | Branch Sync module page (upgraded) |
| `src/renderer/modules/branchActivityMonitor/index.tsx` | Branch Activity Monitor page (new) |
| `src/renderer/modules/customerDbSync/index.tsx` | Customer DB Sync page (new) |
| `src/renderer/modules/priceListSync/index.tsx` | Price List Sync page (new) |

## Files Modified

| File | Change |
|---|---|
| `src/renderer/contexts/NavigationContext.tsx` | Added 9 module PageId values to union type |
| `src/renderer/components/AppShell.tsx` | Added GatedModulePage renderer + all module imports |
| `src/renderer/components/Sidebar.tsx` | Added useFeatureFlag + module nav items section |
| `src/renderer/components/index.ts` | Exported ModulePlaceholderPage |
| `src/renderer/pages/NewQuote/index.tsx` | Wired WhatsApp share after bill image copy |
| `src/renderer/pages/Settings/FeatureModuleTogglesPanel.tsx` | Added 3 new admin+cloud module toggles |
| `src/renderer/utils/eventBus.ts` | Added whatsappShareTriggered event |

---

## Decisions Made

1. **Module pages use PageId extension, not a separate routing system.** Adding module IDs to the PageId union keeps all navigation in one place. The Sidebar and AppShell are the only gatekeepers — they check flags before showing nav or rendering content.

2. **WhatsApp Share has no page — it's a service module.** It has no dedicated nav page. The flag controls whether the share trigger fires after a copy operation. The Settings panel is the only UI. This matches the masterplan description: "wired to trigger on bill copy."

3. **Admin+cloud modules require BOTH flag AND cloud key.** Turning on the flag in Settings when no cloud key is set does nothing — the nav item never appears. This prevents confusion for single-machine users who accidentally enable admin features.

4. **ModulePlaceholderPage is a shared component, not copy-pasted.** Keeps the stub UI consistent across all modules and makes it trivial to update the stub design in one place.

5. **`GatedModulePage` is a separate component from `PageContent`.** This cleanly separates core page routing (no hooks needed) from module routing (hooks needed per flag). Avoids hook-count issues and keeps AppShell readable.

6. **The "Modules" sidebar section only renders if ≥1 module is active.** No empty divider or orphaned label when all modules are off.

---

## Known Issues / Limitations

- **WhatsApp deep link (`whatsapp://`) requires WhatsApp Desktop to be installed.** If it's not installed, the OS may show an error. This is expected behaviour — the user chose "WhatsApp Desktop" as their method.
- **WhatsApp Web opens a new browser window.** On some Electron builds, `window.open` may open inside the Electron window rather than the system browser. This requires an IPC handler for `shell.openExternal` in the Electron main process for production builds. In dev mode, it opens in the default browser.
- **Module nav items have no keyboard shortcuts.** The core Ctrl+1–6 shortcuts are reserved for core pages. Module pages are accessed via mouse click in the sidebar. This is by design — the shortcuts are fixed in the masterplan.
- **NavigationContext's `allPages` does not include module pages.** The command palette (Ctrl+K) and shortcut reference panel therefore don't list module pages. This is intentional — module pages are optional and shouldn't pollute the command palette with stubs.

---

## Test Checklist

- [x] All 9 module flags start as OFF
- [x] With all flags OFF: zero module nav items visible, zero module code runs, zero console errors
- [x] Enable `reports` flag in Settings → "Reports" appears in sidebar under "Modules" section
- [x] Navigate to Reports via sidebar → polished placeholder page renders
- [x] Disable `reports` flag → nav item disappears, navigating away works
- [x] Same test for: expenseTracker, multiUser, paymentLedger
- [x] Enable `branchSync` with NO cloud key → nav item does NOT appear
- [x] Enter a cloud key in Settings → enable `branchSync` → nav item appears
- [x] Navigate to Branch Sync → placeholder shows admin note
- [x] Same for branchActivityMonitor, customerDbSync, priceListSync
- [x] Enable `whatsappShare` + set method to "WhatsApp Web" → copy bill image → WhatsApp Web opens in browser + second toast appears
- [x] Enable `whatsappShare` + NO method set → copy bill image → only original copy toast, no WhatsApp trigger
- [x] Disable `whatsappShare` → copy bill image → original copy behaviour unchanged
- [x] All core pages (New Quote, History, Customer Details, Inventory, Settings) work identically with any combination of module flags
- [x] Restarting the app with module flags ON → modules still visible (persisted in config)

---

*Handoff state: All boolean-gated module stubs wired and working. WhatsApp Quick Share fires on bill copy. Settings panel shows all 9 module toggles. No core functionality broken. Next session: Phase 14 — Final integration test, performance validation, packaging.*
