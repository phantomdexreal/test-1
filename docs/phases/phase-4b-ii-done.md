# Phase 4b-ii — Done

## What Was Built

### 1. Bill Numbering Engine (`src/renderer/utils/billNumber.ts`)

Full `BillNumberEngine` class implementing all Hard Spec #3 rules:

- **Prefix configurable** from Settings (`INV/` by default)
- **Auto-increment**: `getNext()` atomically increments + persists state
- **FY reset**: `isResetDue()` detects when FY/month has changed; `applyResetIfDue()` resets to 0 before next `getNext()` returns 1
- **Always restarts from 1 on reset** — the migration starting number is a one-time-only value consumed on the very first bill ever saved (`migrationConsumed` flag); subsequent year resets always go to 1 (Hard Spec #3, never deviated)
- **Deleted numbers never reused**: `markDeleted(billNumber)` records the full number string; `deleteBill()` in bill.service calls this before removing the record
- **FY prefix computation**: `getFYPrefix(date, fyStartMonth)` correctly handles April–March cycle (Indian financial year default)
- **`peek()`**: returns the upcoming number without consuming it — used to display in the UI before saving
- **Singleton engine**: `getBillNumberEngine()` returns/creates singleton; `resetBillNumberEngine()` tears it down (for DB swapping / profile switching)
- **`updateBillNumberConfig()`**: hot-swaps prefix/cycle without app restart

State persisted to `localStorage` in dev/browser mode. Will use IPC + settings DB in full Electron build.

### 2. Bill Service (`src/renderer/services/bill.service.ts`)

- `saveBill(input)`: generates bill number, sets `status: 'unpaid'`, persists bill, silently auto-creates customer (Hard Spec #4), updates transport memory (Hard Spec #17), adds transporter to list
- `updateBillStatus(id, status)`: in-memory + IPC update; called from History page
- `deleteBill(id)`: marks number deleted in engine, removes from store
- `getBills()`, `getBillById()`: read from in-memory store
- `peekNextBillNumber()`: delegates to engine `peek()`
- Dev mock data: 3 sample bills with different statuses for immediate UI testing

### 3. BillInfoSection Component (`src/renderer/pages/NewQuote/BillInfoSection.tsx`)

- **Bill Number field**: read-only preview of upcoming number (shows live `peek()` result), styled with accent color + monospace font, "auto" label
- **Bill Date field**: native `<input type="date">` fully editable, defaults to today, backdating/forward-dating both work, calendar icon
- **Status field**: on New Quote page shows non-editable `StatusTag` with "editable from History" hint
- `StatusTag` component: reusable colored pill (Unpaid=amber, Paid=green, Partial=blue, Cancelled=red)
- `StatusSelector`: dropdown used in History page for inline status editing
- `createDefaultBillInfo()`: returns `{ billNumber: '', billDate: today, status: 'unpaid' }`

### 4. Updated NewQuote Page (`src/renderer/pages/NewQuote/index.tsx`)

- Replaced the Phase 4b-i stub placeholder with live `BillInfoSection`
- `handleSaveBill` now calls `saveBill()` from bill.service (auto-creates customer silently — Hard Spec #4)
- Toast shows the actual generated bill number: `✓ Bill INV/25-26/4 saved for Rajesh Traders`
- Ctrl+S shortcut wired to save
- Bill date defaults to today, is passed to saveBill

### 5. Updated History Page (`src/renderer/pages/History/index.tsx`)

- Replaces the Phase 1b-B PlaceholderPage with a real bill list
- Columns: Bill No., Party, Date, Amount, Status
- Status column: inline `HistoryStatusCell` — click to open dropdown, select new status → `updateBillStatus()` called → optimistic UI update
- Status legend (all 4 tags) shown in header
- Refresh button
- Alternating row colors, hover highlight
- Footer stub row showing Phase 7a features (search, filter, versioning, bulk export)

### 6. Services Index Updated

New Phase 4b-ii exports added: bill.service functions + billNumber utils.

---

## Decisions Made

| Decision | Rationale |
|---|---|
| `peek()` separate from `getNext()` | Bill number must only be consumed when bill is actually saved — previewing must never increment the counter |
| `migrationConsumed` flag | Hard Spec #3 is explicit: migration starting number is one-time only. Flag persisted so it survives restarts |
| Full bill number string stored in `deletedNumbers` | Includes FY prefix — a deleted "INV/24-25/5" doesn't block "INV/25-26/5" from a future year |
| Status defaults to `'unpaid'` in `saveBill()` | Spec: "Defaults to Unpaid on save" — not caller-configurable on creation |
| History page status editing with optimistic update | Spec says "editable from History page" — inline dropdown avoids full page reload |
| `colorScheme: 'dark'` on date input | Native date picker picks up dark theme; prevents jarring white popup |

---

## Known Issues / TODOs

- `TODO: [BILLING-GRID-SAVE]` — rows/adjustments/grandTotal passed as zeros until Phase 5a
- `TODO: [TOOLBAR]` — toolbar remains a stub until Phase 4a-A
- `TODO: [PDF-SAVE]` — Save PDF / Copy Image / Quick Print buttons are disabled stubs until Phase 6a-A
- `TODO: [DB-BILL-TABLE]` — SQLite `bills` table migration not yet written (Phase 1a-ii-A scope); IPC calls fall back to in-memory gracefully
- History page: no search/filter/versioning — Phase 7a
- Bill edit from History (reopen + edit) — Phase 7a

---

## Handoff State

- All Phase 4b-ii deliverables complete and working
- `npm run dev` passes — app is fully runnable
- No regressions to Phase 4b-i (PartyDetails, fuzzy autocomplete, transport memory all intact)
- Next session: **Phase 5a** — billing grid table (Free Format + GST Format, Excel-like navigation, F2 mode, auto-Sl.No, adjustments, grand total)
