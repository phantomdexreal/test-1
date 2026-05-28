# Phase 4b-i — Done

## What Was Built

### Party Details Section (`src/renderer/pages/NewQuote/PartyDetailsSection.tsx`)

Full party details section for the New Quote page:

- **Party Name field** — fuzzy autocomplete using Fuse.js (threshold 0.35) against existing customers. Suggestion dropdown shows party name, phone, and most recent transport. Keyboard navigable (↑↓ arrows, Enter to select, Escape to close). Selecting a customer autofills Phone and Transport Name (Hard Spec #17 — per-customer transport memory).

- **Phone Number field** — standard tel input with icon, clears on X button.

- **Transport Name field** — fuzzy autocomplete (threshold 0.4) from the saved transporters list stored in config via `settings.read/write`. Per-customer transport memory: most recently used transport for a selected customer auto-fills. User can change it per-bill. On bill save, the transport updates as the new default for that customer (Hard Spec #17).

- **Expandable Extra Info** — toggled via "More ↓/↑" button. Reveals: Address (textarea with MapPin icon), GSTIN (uppercase, monospace input with Hash icon, 15-char max), Notes (textarea with FileText icon). Smooth fade-in animation.

### Customer Service (`src/renderer/services/customer.service.ts`)

Service layer following architecture rule: no direct DB calls from components.

- `loadCustomers()` — loads from SQLite via IPC or dev mock data; builds Fuse index
- `searchCustomers(query, limit)` — fuzzy search returning CustomerRecord[]
- `getCustomerByName(name)` — exact name lookup (case-insensitive)
- `loadTransporters()` — loads from config via `settings.read` or dev mock
- `searchTransporters(query, limit)` — fuzzy search returning string[]
- `addTransporterToList(name)` — deduplicates and persists new transporter to config
- `updateCustomerTransport(customerId, transportName)` — updates `transport_name` in DB for Hard Spec #17
- `ensureCustomerExists(data)` — checks if customer exists; if not, auto-creates (Hard Spec #4)

### NewQuote Page (`src/renderer/pages/NewQuote/index.tsx`)

Full page shell with:
- Party Details Section integrated
- Save Bill handler that: (1) persists new transporter, (2) auto-creates customer if new (Hard Spec #4), (3) updates transport memory (Hard Spec #17)
- Placeholder sections for Bill Info (Phase 4b-ii) and Billing Grid (Phase 5a)
- Footer with Save Bill button (Ctrl+S hint), and placeholder PDF/Print/Image buttons
- Unsaved state tracking (resets on successful save)
- Toast notifications for save success/error

### Services Index (`src/renderer/services/index.ts`)

Phase 4b-i exports added.

## Dev/Browser Mock Data

In non-Electron environments (browser dev mode), the service uses:
- 5 mock customers (Rajesh Traders, Meera Enterprises, Suresh & Sons, Lakshmi Wholesale, Karnataka Distributors) with realistic Indian business data
- 10 mock transporters (Sri Ram Transport, Kumar Logistics, VRL Logistics, etc.)
- localStorage for persistence across browser refreshes in dev mode

## Decisions Made

1. **FuzzyInput is a reusable generic component** — used for Transport; PartyName has its own richer version showing customer cards with phone + transport sub-info.

2. **Customer autocomplete shows transport hint** — users can preview which transport will auto-fill before selecting, reducing friction.

3. **`ensureCustomerExists` on every save** — not just first save. On subsequent saves for the same party name, it detects the existing record and skips creation. Only the transport gets updated.

4. **Settings IPC for transporter list** — transporters stored under `transporterList` key in the app config file via `settings.write`. This keeps business data in SQLite and config-type data in the config file, matching the architecture rule.

5. **Extra Info fields are optional, no validation** — per spec. GSTIN auto-uppercases as typed.

## Known Issues / Handoff State

- TypeScript reports `Cannot find module 'react'` and JSX element errors — these are pre-existing project-wide issues from the tsconfig/Vite setup, not introduced in this phase. The same errors exist in all previous phase files. Vite handles the JSX transform at build time.
- `better-sqlite3` native rebuild fails in the Linux container (expected — it requires Electron/Windows headers). Normal for this project.
- Bill save currently only writes party details — billing grid rows (Phase 5a) and bill number (Phase 4b-ii) are TODO stubs.

## TODOs Left (Future Phases)

- `// TODO: [BILLING-GRID-SAVE]` — Phase 5a
- `// TODO: [BILL-NUMBER]` — Phase 4b-ii  
- `// TODO: [BILL-STATUS]` — Phase 4b-ii
- `// TODO: [PDF-SAVE]` — Phase 6a-A/B
- `// TODO: [TOOLBAR]` — Phase 4a-A

## Test Checklist (per Phase Spec)

- [ ] Type existing party name → suggestions appear below → select → phone and transport autofill correctly
- [ ] Type a new party name → no autofill, field stays editable
- [ ] Change transport after customer select → save bill → reopen new bill for same customer → new transport is now the default
- [ ] Expand button reveals Address, GSTIN, Notes fields with smooth animation
- [ ] Collapse hides the extra info fields
- [ ] Transport fuzzy search shows suggestions from saved list as user types
- [ ] New transporter typed + bill saved → transporter appears in future suggestions
- [ ] GSTIN field auto-uppercases input
- [ ] Keyboard navigation in dropdowns (↑↓ Enter Escape) works correctly
- [ ] Clear (×) button clears each field

## Files Added This Phase

- `src/renderer/services/customer.service.ts` — NEW
- `src/renderer/pages/NewQuote/PartyDetailsSection.tsx` — NEW
- `src/renderer/pages/NewQuote/index.tsx` — REPLACED (was placeholder)
- `src/renderer/services/index.ts` — UPDATED (added exports)
- `docs/phases/phase-4b-i-done.md` — NEW
