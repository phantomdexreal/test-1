# Phase 7b — Done

## What Was Built

### 1. Duplicate Detection Warning
- **File:** `src/renderer/services/duplicate.service.ts`
- **Wired in:** `src/renderer/pages/NewQuote/index.tsx`
- Triggers before any bill save when: **same party name (case-insensitive) + same bill date + similar grand total (within 5%)**
- A modal (`DuplicateBillWarning`) appears showing all matching bills with bill number, amount, and reason
- User can **Cancel** (don't save) or **Save Anyway** (proceeds past the warning, no second check)
- Uses `getBills()` → `findDuplicates()` on every save attempt; fast (pure in-memory scan)
- Zero-total bills are always flagged if party + date match
- Excludes the bill being edited (`excludeId` param — ready for use when edit-save is plumbed in Phase 8+)

### 2. Bulk Actions — History Page
- **File:** `src/renderer/pages/History/BulkActionsBar.tsx`
- **Wired in:** `src/renderer/pages/History/index.tsx`
- Each bill row now has a **checkbox** for selection; table header has a **select-all** checkbox
- Selected rows highlighted with left accent border + background tint
- `BulkActionsBar` appears above the table header whenever ≥1 bill is selected
- **Delete selected** — with two-step confirmation (click Delete → confirm → executes `deleteBillsBulk`)
- **Export Excel** — exports only selected bills via `exportSelectedBillsToExcel` (SheetJS)
- **Batch PDF** — generates one combined PDF/HTML for all selected bills via `generateBatchPdf`; in Electron uses IPC; in dev/browser downloads as HTML file
- **Change Status** — dropdown to set all selected bills to any status; calls `updateBillStatusBulk`; clears selection after
- Bill service: added `deleteBillsBulk` and `updateBillStatusBulk`

### 3. Outstanding / Ledger View Per Customer
- **File:** `src/renderer/services/ledger.service.ts`
- **File:** `src/renderer/pages/History/OutstandingLedgerView.tsx`
- Accessible via **"Outstanding"** button in the History page header
- Shows per-customer: **Total Billed**, **Total Paid** (approximated from status), **Outstanding Balance**
- Filterable by **date range** (From/To)
- Toggle: **"Show only with balance"** — filters to customers with outstanding > 0
- Summary stat cards at top: customer count, total billed, total paid, total outstanding
- **Drill-down**: click any customer row to expand and see individual bills, each with bill number, date, amount, status, transport
- Note displayed: "Paid" is estimated from bill status; Phase 8b adds exact partial payment tracking
- Customers sorted by outstanding balance descending (highest debt first)

### 4. Periodical Backup Trigger
- **File:** `src/renderer/services/backup.service.ts`
- **Wired in:** History page header ("Backup Now" button, green)
- In Electron: calls `ipc.backup.create()` → main process builds ZIP of all DBs + config + session log (Hard Spec #25)
- In dev/browser mode: simulates 800ms async work, returns a mock filename
- After backup: shows a green/red toast notification bottom-right for 4 seconds
- Button shows "Backing up…" with wait cursor while in progress; disabled during backup

## Architecture Decisions

- `filteredBills` useMemo is defined before all selection/bulk handlers so `toggleSelectAll` can reference it
- `showLedger` state gates the `OutstandingLedgerView` overlay; all existing header/search/list divs get `(openBill || showLedger) ? 'none'` guard so they hide cleanly
- `duplicatePendingSave` flag pattern: when user clicks "Save Anyway" → flag set → useEffect re-triggers `handleSaveBill` → on next invocation the duplicate check is skipped → flag cleared
- Batch PDF in browser/dev: generates a complete self-contained HTML file with page-break-before CSS between bills, downloaded as `.html`. In Electron, this would call `pdf.generateBatch` IPC handler (stubbed with `typeof check`)

## Known Issues / TODOs

- `TODO: [BATCH_PDF_IPC] - Phase 6b: wire batch PDF through main process pdf.handler for true PDF output` — currently produces HTML in dev mode
- `TODO: [BACKUP_IPC] - Phase 14: implement backup.create IPC handler in main process (app.handler.ts)` — ZIP creation logic not yet in main process
- `TODO: [LEDGER_PAID_EXACT] - Phase 8b: replace status-based "totalPaid" approximation with exact payment recorder amounts`
- `TODO: [DUPLICATE_EDIT] - Phase 8+: pass excludeId when editing a bill so duplicate check correctly ignores the bill being updated`
- Pre-existing: `Highlighter` unused import in NewQuote/index.tsx (TS6133) — inherited from Phase 7a-B

## Handoff State

All Phase 7b deliverables are complete and runnable:
- `npm run dev` works; all features functional in browser/dev mode
- Duplicate detection fires correctly before new bill saves
- Bulk checkboxes, bulk actions bar, all four bulk actions work
- Outstanding ledger view opens from History, shows data, drill-down works, date range filter works
- Backup trigger button fires, shows toast
- No regressions to Phase 7a-B features (history list, edit view, status inline edit, search, grouping, Excel export)

**ZIP output:** `cQikly-phase-7b.zip`
**Next session:** Phase 8a — Customer Details page
