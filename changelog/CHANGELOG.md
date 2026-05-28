# cQikly Changelog

---

## v1.0.0 — Phase 14: Final Release (May 2026)

### Phase 14 — Polish, Performance, Integration Testing, Packaging

#### Added
- `docs/phases/phase-14-done.md` — Full integration test results, performance validation, known limitations, packaging decisions
- `docs/architecture/ARCHITECTURE.md` — Final architecture document covering all process, storage, service, and module layers
- `docs/architecture/architecture-diagram.mermaid` — Mermaid source for the complete system architecture diagram
- `docs/INTEGRATION_TEST_REPORT.md` (embedded in phase-14-done) — 40+ feature test results across all pages and global UX
- `docs/PERFORMANCE_VALIDATION.md` (embedded in phase-14-done) — Lite/Balanced/Ultra tier comparison table

#### Changed
- `electron-builder.config.js` — **Phase 14 final config**: `asar: true`, `asarUnpack` for better-sqlite3 and binding dependencies, `release/` output directory, full NSIS options (per-user install, install dir choice, shortcuts), `publish: null` with documentation for future update server configuration
- `package.json` — Version bumped to **1.0.0**; `build:vite` simplified to `vite build`; `preview` script added
- `README.md` — **Full rewrite**: complete setup guide, project structure, keyboard shortcuts table, performance modes, feature modules, hard specs, known limitations, dev notes, architecture references

#### Validated (no code changes needed)
- `PerformanceContext` correctly derives all flags: `animationsEnabled`, `heavyAnimationsEnabled`, `apiPollingEnabled`, `apiPollingInterval` — all polling hooks consume `apiPollingEnabled`; billing never degraded in any mode
- `npm run dev` = `vite` only; `vite-plugin-electron` handles Electron launch; no `.exe` compiled
- All 9 boolean-gated module stubs from Phase 13 confirmed working: flag OFF = zero impact; flag ON = placeholder page visible
- All 45 phase-done files present and complete in `docs/phases/`

---

## Phase 12a — Global Keyboard Shortcuts Wired (May 2026)

### Added
- `useGlobalShortcuts.ts` — global shortcut manager hook; mounted once in AppShell via `GlobalShortcutsMounter`; wires all Section 15 shortcuts at capture phase
- `CalculatorOverlay.tsx` — Phase 12a functional stub; slides up from bottom on Alt+N; basic expression eval + history; full version in Phase 12b
- `CommandPaletteOverlay.tsx` — Phase 12a stub; Ctrl+K opens palette with page navigation and fuzzy filtering; full cross-entity search in Phase 12b
- `ShortcutReferencePanel.tsx` — **full implementation**; Ctrl+/ opens floating reference card listing all 22 shortcuts grouped by category
- New eventBus event types: `openCalculator`, `openCommandPalette`, `openShortcutPanel`, `shortcutSaveBill`, `shortcutSavePdf`, `shortcutCopyImage`, `shortcutCopySimplified`, `shortcutQuickPrint`, `shortcutDuplicateBill`
- NewQuote now subscribes to all `shortcut*` eventBus events for cross-page shortcut delivery
- NewQuote: **Ctrl+Shift+C** (copy professional image), **Ctrl+Shift+X** (copy simplified), **Ctrl+Shift+P** (quick print) now keyboard-accessible (were click-only)
- AppShell: three global overlay components mounted at root level

### Changed
- AppShell: added `GlobalShortcutsMounter`, `CalculatorOverlay`, `CommandPaletteOverlay`, `ShortcutReferencePanel` to root render
- NewQuote shortcut hint strips updated to list all new shortcuts
- Hooks barrel (`hooks/index.ts`): exports `useGlobalShortcuts`
- Components barrel (`components/index.ts`): exports three new overlay components

### Removed / Resolved
- **Ctrl+H → highlight cell** removed from NewQuote (was informal shortcut). Masterplan Section 15 assigns Ctrl+H to "Open History". Highlight Cell remains available via toolbar button.

## Phase 9b-B-ii-A — Inventory Mode on Quote Page: Fuzzy Autocomplete (May 2026)


### Added
- `inventoryModeEnabled: boolean` to `AppConfig` (default `false`) in `ConfigContext.tsx`
- **Settings — Inventory Mode on Quote Page panel**: ON/OFF toggle; describes Insert key behaviour and rate source interaction
- `inventoryService.fuzzySearchItems(query, limit)` — pure-JS scored fuzzy search; returns up to 8 matches ordered by relevance; no external dependency
- **`NewQuote/InventoryAutocomplete.tsx`** — new floating suggestion dropdown component:
  - `position: fixed` anchored below the active Item Name cell
  - Each card: item image (36×36, loaded async) or IMG placeholder, item name, price/unit/barcode
  - Highlighted item shows "Insert ↵" badge; header shows "↑↓ navigate · Insert to accept"
  - `onMouseDown` preventDefault prevents blur-before-click race condition
- **BillingGrid**: full inventory autocomplete wiring:
  - New props: `inventoryModeEnabled`, `billFormatForInv`
  - New state: `invSuggestions`, `invSelectedIdx`, `invAnchorRowIdx`, `invImageCache`, `invSearchTimerRef`
  - New callbacks: `closeInvDropdown()`, `triggerInvSearch()`, `acceptInvSuggestion()`
  - Item Name cell: `onChange` triggers debounced (80ms) fuzzy search; `onFocus` re-triggers if text present; `onBlur` closes dropdown after 120ms delay
  - `GridCell`: added optional `onBlur` prop wired to the `<input>`
- **NewQuote/index.tsx**: passes `inventoryModeEnabled` and `billFormatForInv` to BillingGrid via `useConfig`

### Fixed
- **BillingGrid**: removed stale `setActiveRateHint(null)` call in rate Insert handler — this function never existed and would have crashed at runtime when accepting a rate hint

### Key Behaviour
- Insert in `itemName` (inventory mode ON, dropdown visible) → accept suggestion → fill name + fill Rate per active format's Inventory Rate Source setting → cursor stays in Item Name → user can keep typing
- Insert in `rate` (hint visible) → accept rate history ghost → completely independent, zero conflict
- ArrowDown/ArrowUp in `itemName` (dropdown open) → navigate suggestions (does NOT move grid rows)
- Escape in `itemName` (dropdown open) → close dropdown, stay in cell
- Inventory mode OFF → no dropdown, no behaviour change anywhere

---

## Phase 9b-B-i — Inventory Item Images (May 2026)



### Added
- `stockQtyEnabled` and `stockDeductOnSave` boolean settings added to `AppConfig` (ConfigContext)
- **Inventory page**: Stock Qty, Min Stock, and Unit columns — visible only when `stockQtyEnabled` is ON; fully editable inline like all other inventory columns
- **Low stock badge**: items below threshold get red row highlight, `AlertTriangle` badge replacing row number, red bold Stock Qty text
- **Status bar low stock count**: shows `{N} low stock` (red) or `✓ Stock OK` (green) when stock tracking is enabled
- **Toolbar badge**: `Stock Tracking ON` pill appears next to inventory heading when enabled
- **Settings — Stock Tracking panel**: two ON/OFF toggles — "Enable Stock Quantity Tracking" and "Deduct Stock on Bill Save"; the second is disabled/greyed when the first is OFF
- **`bill.service.ts` step 7**: stock deduction on save — case-insensitive item name match, billed qty deducted from `stockQty`, clamped to 0, non-fatal
- **`getLowStockItems()` browser fallback**: reads from `inventoryService.getItems()` when no IPC (dev/browser mode); same threshold logic as SQL query
- **`LowStockAlertWidget`**: now subscribes to `eventBus('inventoryChanged')` for immediate refresh after stock changes; no longer requires polling interval to see updates

### Changed
- `Dashboard/AlertWidgets.tsx` — added `eventBus` import; `LowStockAlertWidget` useEffect now cleans up both interval and event subscription
- `dashboard.service.ts` — `getLowStockItems()` split into IPC path (Electron) and in-memory path (browser)
- `Inventory/index.tsx` — `useConfig` and `AlertTriangle` imported; `STOCK_COLS` computed from config; `getCellValue`/`setCellValue` expanded for stock fields; `isLowStock()` helper added

### No New Migration
- `inventory_items` table already has `stock_qty`, `min_stock`, `unit` columns from `001_initial.ts`

---

## Phase 9a-A — Inventory Page: Table + Categories + Tabular Editing + CRUD + Custom Price Columns (May 2026)



### Added
- `payment.service.ts` — full payment CRUD with IPC + localStorage dev fallback
- `PaymentRecorderModal.tsx` — record payments, link to bills, view payment history
- Bill status auto-driving: full payment → Paid; partial → Partial; no payment → Unpaid
- Status recalculation on payment delete (correctly reverts affected bills)
- "Apply to All Outstanding" shortcut in payment recorder
- General credit support (payment with no linked bills)
- `CustomerLedgerModal` now shows real payment rows (Cr) alongside bills (Dr) in chronological order with correct running balance
- "💳 Pay" button per customer row in Customer Details page
- `PaymentRecord` type exported from services index

### Changed
- `CustomerLedgerModal` — Phase 8b-i placeholder note removed; now loads and renders real payments
- `CustomerRow` — added `onRecordPayment` prop and "💳 Pay" action button
- `CustomerDetails/index.tsx` — PaymentRecorderModal wired in; outstanding balance refreshes after payment
- `OutstandingLedgerView` — Phase 8b-ii status note updated


## [Phase 6a-A] — May 2026

### Added
- **Save Bill — enhanced validation guard**: resists save only when party name AND all cells are empty (Hard Spec §9.4). Previously failed on name-empty regardless of grid content.
- **Cell formats persisted on save**: text highlight colors and bold settings now saved with the bill record (`cellFormats` field in BillRecord).
- **`isBillSaved` state tracking**: bill page now knows when the current bill has been saved in this session — used by PDF generation for DRAFT watermark.
- **Simplified PDF format — full implementation** (`pdf.service.ts`):
  - Header: `{CustomerName} — {Contact}` only, zero company info (Hard Spec #8)
  - Page size: A5 ≤40 rows → A4 ≤80 rows → multi-page A4 (Hard Spec #15)
  - CSS `<thead>` repeat on every printed page
  - Totals on last page / table footer section
  - DRAFT watermark (position: fixed CSS) for unsaved bills
  - Empty rows skipped; long names wrap; grand total rounded
  - Transport name footer row after totals
  - Custom columns in Free Format (≤4); warning if >4; excluded in GST Format
- **Save PDF button** (footer): wired, shows DRAFT badge when unsaved
- **Quick Print button** (footer): wired, with A4 warning guard (two-click confirm)
- **Copy Image button** (footer): wired stub, opens HTML preview in new window
- **PDF IPC handler** (main process): creates hidden BrowserWindow, loads HTML, calls `printToPDF`
- Phase docs: `docs/phases/phase-6a-A-done.md`

### Modified
- `src/renderer/services/bill.service.ts`: `SaveBillInput` extended with `cellFormats`; bill record now persists cellFormats
- `src/renderer/services/db.service.ts`: `BillRecord` extended with `cellFormats?: Record<string, unknown>`
- `src/main/ipc/handlers/pdf.handler.ts`: full printToPDF implementation replacing stub
- `src/renderer/pages/NewQuote/index.tsx`: new handlers (`handleSavePdf`, `handleCopySimplifiedImage`, `handleQuickPrint`, `billHasContent`, `buildPdfInput`); footer buttons wired; validation guard updated

## Phase 6b-A-i — Professional PDF Format
_Date: 2026-05-26_

### Added
- `buildProfessionalPdfHtml()` — full HTML generator for Professional PDF format
- `CompanyInfo` interface — firmName, address, phones, logoPath
- `ProfessionalPdfInput` interface — extends SimplifiedPdfInput with company block
- `decideProfessionalPageSize()` — Hard Spec #15: A5 ≤30 rows, A4 ≤60, multi-page A4 beyond
- `saveProfessionalPdf()` — IPC-wired save function (mirrors simplified flow)
- **"Pro PDF"** button in NewQuote footer action bar
- Live company profile fetch from SQLite at PDF generation time
- Column headers repeat on every page (`thead { display: table-header-group }`)
- Totals only on last page via `<tfoot>` natural flow
- DRAFT watermark support (inherited from base input)
- Logo image rendered via `file:///` URI for local paths in Electron hidden window

## Phase 6b-B — Copy Image, Quick Print, Unsaved Changes Guard

### New Features
- **Copy Image**: Renders bill in Professional format, captures full-page screenshot, copies to system clipboard as PNG — one click, no dialogs. Uses Electron's `webContents.capturePage()` API.
- **Copy Simplified Image**: Same as Copy Image but always in Simplified format (no company info). Button labeled "Copy Simple" to differentiate.
- **Quick Print**: Prints Simplified bill (A5 by default) silently without any print dialogue. If bill has >40 rows, first click shows amber A4 warning; second click confirms and prints A4.
- **Unsaved Changes Guard**: When navigating away from New Quote page with unsaved bill content, a modal dialog prompts: Save Bill (Enter) | Discard & Leave | Cancel (Esc). Guard intercepts sidebar navigation and all Ctrl+1–6 keyboard shortcuts.

### New IPC Channels
- `pdf:captureImage` — renders HTML, screenshots full page, returns base64 PNG
- `pdf:writeClipboardImage` — writes base64 PNG to system clipboard
- `pdf:silentPrint` — generates PDF and sends to printer via `shell.openPath()`

### New Service Functions (pdf.service.ts)
- `copyBillAsImage(input)` → 'copied' | 'dev-fallback' | 'error'
- `copyBillAsSimplifiedImage(input)` → 'copied' | 'dev-fallback' | 'error'
- `quickPrintSilent(input, opts)` → `{ printed, a4Warning }`

### New Hook (NavigationContext.tsx)
- `useUnsavedGuard({ onSave })` — call `setDirty(true/false)` to register/clear guard

## [Phase 7a-A] — May 2026

### Added
- **History Page — full list view rewrite** (`src/renderer/pages/History/index.tsx`):
  - All columns: Bill No., Party Name (+ phone/transport subline), Date, Grand Total (right-aligned INR), Status (colour pill)
  - Monthly collapsible grouping with group headers showing bill count + total amount
  - Periodical grouping selector: Monthly / Financial Year / Calendar Year / No Grouping
  - Expand All / Collapse All controls
  - **Fuzzy search bar** (Fuse.js) across party name, bill number, date, grand total
  - **Status filter tabs** (All / Unpaid / Paid / Partial / Cancelled) with per-status colour styling
  - **Expandable filter panel**: amount range (min/max) + date range (from/to)
  - Active filter count badge on Filters button
  - Clear button resets all filters and search in one click
  - **Excel export** of filtered results (SheetJS, dynamic import)
  - Footer status bar with per-status counts (clickable to filter)
  - Empty state handles: no bills ever vs no matching results
  - Keyboard: Ctrl+F focuses search, Escape clears query
- **`src/renderer/services/history.service.ts`** — new pure service with `groupBills()`, `applyFilters()`, `exportBillsToExcel()`, and formatting helpers
- Mock bill data expanded to **20 bills** across 7 months (Nov 2025 – May 2026)

### Modified
- `src/renderer/services/index.ts` — Phase 7a-A exports added
- `src/renderer/services/bill.service.ts` — `_getDevMockBills()` expanded to 20 bills

## [Phase 7b] — May 2026

### Added
- **Duplicate bill warning** — fires before any new bill save when same party + same date + similar total (±5%) exists; modal shows matching bills; user can proceed or cancel
- **Bulk selection** — checkboxes on every History bill row; select-all in header
- **Bulk delete** — delete selected bills with two-step confirmation; bill numbers permanently retired
- **Bulk Excel export** — export only selected bills to .xlsx (SheetJS)
- **Bulk status change** — change status of all selected bills to any status at once
- **Batch PDF generation** — generate one combined PDF/HTML for all selected bills (Electron: true PDF via IPC; dev: HTML download)
- **Outstanding Ledger view** — per-customer: total billed vs total paid (approx.) vs outstanding balance; date range filter; drill-down to individual bills per customer; accessible from History page header
- **Backup Now button** — manual backup trigger on History page; toast notification on success/failure; Hard Spec #25 compliant (Electron: all DBs + config + session log in ZIP; dev: simulated)
- `src/renderer/services/duplicate.service.ts`
- `src/renderer/services/ledger.service.ts`
- `src/renderer/services/backup.service.ts`
- `src/renderer/pages/History/BulkActionsBar.tsx`
- `src/renderer/pages/History/OutstandingLedgerView.tsx`

## Phase 11a-ii — PDF Settings + Print Settings + Appearance + Language
### Added
- **PDF Settings (full build)**: default format selector, filename pattern with token buttons + live preview, PDF save location with Browse, PDF quality selector (screen/print/prepress), watermark/DRAFT stamp toggle, UPI ID field
- **Print Settings**: default printer selector (fetches from OS via IPC, graceful empty fallback), default page size (A4/A5/Letter/Legal)
- **Appearance & Theme panel**: dark/light toggle, 6-theme selector with live preview, app-level zoom/font size slider (75%–150%) with presets and reset
- **Language panel**: grid of 7 languages (English active, 6 Indian regional languages as "Coming Soon")
- **ZoomBootstrap**: restores saved zoom level on every app start
- **ConfigContext extensions**: `appZoom`, `printDefaultPrinter`, `printDefaultPageSize`
- **pdfSettings.service extensions**: default format, filename pattern, save location, quality, watermark
### Changed
- Settings page left nav: expanded with Print Settings + Language sections, smooth-scroll navigation
- PDF Settings panel: rebuilt as single comprehensive panel replacing the Phase 6b-A-ii-only version
- Appearance section: moved out of inline Settings/index.tsx into standalone AppearancePanel.tsx

## Phase 12b — Global UX: Calculator + Scratchpad + Command Palette + Shortcut Reference (May 2026)

### Added
- `CalculatorOverlay.tsx` — **full implementation** replacing Phase 12a stub:
  - Persistent rows stored in `localStorage`; history survives close/reopen and app restarts
  - Every row is individually editable; editing a previous row re-evaluates its result on blur
  - Full keyboard-only operation: Enter (eval + next), ↑↓ (navigate), Tab/Shift+Tab (cycle), Ctrl+Enter (new row at end), Delete on empty (remove row), Ctrl+L (clear all)
  - Supports `%`, `^`, parentheses in addition to basic arithmetic
- `ScratchpadOverlay.tsx` — **new file**; floating draggable notepad:
  - `Alt+S` toggles open/close from anywhere in the app
  - Content persists in `localStorage` across navigation and app restarts
  - Position persists; draggable via title bar
  - Character count in footer; monospace textarea
- `CommandPaletteOverlay.tsx` — **full implementation** replacing Phase 12a stub:
  - Searches across customers (`loadCustomers`), bills (`getBills`), inventory (`inventoryService.getItems()`), pages, and settings sections simultaneously
  - Fuse.js fuzzy search on title + subtitle fields (threshold 0.38)
  - Activating a customer → Customer Details page + search pre-filled via `navigateToCustomer` event
  - Activating a bill → History page + search pre-filled via `navigateToBill` event
  - Activating inventory item → Inventory page + detail panel opens via `navigateToInventoryItem` event
  - Activating settings entry → Settings page + `scrollIntoView` to section
  - Kind badges (coloured): Page, Customer, Bill, Inventory, Setting
  - Async data load on open; loading indicator shown
- New `eventBus` events: `openScratchpad`, `navigateToCustomer`, `navigateToBill`, `navigateToInventoryItem`

### Changed
- `AppShell.tsx` — mounted `ScratchpadOverlay` alongside existing overlays; updated phase comment
- `components/index.ts` — exported `ScratchpadOverlay`
- `hooks/useGlobalShortcuts.ts` — added `Alt+S → openScratchpad`
- `ShortcutReferencePanel.tsx` — added `Alt+S` entry in Global Tools group
- `pages/CustomerDetails/index.tsx` — added `navigateToCustomer` listener; imported `eventBus`
- `pages/History/index.tsx` — added `navigateToBill` listener; imported `eventBus`
- `pages/Inventory/index.tsx` — added `navigateToInventoryItem` listener
- `utils/eventBus.ts` — added 4 new typed event entries

### No regressions
- All Phase 12a shortcuts remain wired and working
- Calculator, Scratchpad, CommandPalette, and ShortcutPanel each independently manage their own open/close state
- No new conflicts in the shortcut map

## Phase 13 — Boolean-Gated Module Stubs + Future Module Wiring

### Added
- `ModulePlaceholderPage` shared component for all stub pages
- Reports module page (polished stub with 5 planned features listed)
- Expense Tracker module page (polished stub)
- Multi-User / Operator Profiles module page (polished stub)
- Payment Recorder & Ledger module page (polished stub; notes core is in Phase 8b-ii)
- WhatsApp Quick Share service (`triggerWhatsAppShare`) — wired to bill copy in NewQuote
- Branch Sync module page (polished stub, admin+cloud)
- Branch Activity Monitor module page (new; polished stub, admin+cloud)
- Centralized Customer DB Sync module page (new; polished stub, admin+cloud)
- Price List Sync module page (new; polished stub, admin+cloud)
- Sidebar "Modules" section — appears only when ≥1 module is active
- `GatedModulePage` renderer in AppShell
- 9 new module PageId values in NavigationContext
- 3 new admin+cloud module toggles in FeatureModuleTogglesPanel
- `whatsappShareTriggered` event on eventBus
- Developer-suggested future modules documented in phase-13-done.md
- Mobile module path documented in phase-13-done.md

### Changed
- All existing module stubs upgraded from bare 4-line placeholders to full polished pages
- Sidebar now imports FeatureFlagContext and ConfigContext to gate module nav items

### Fixed
- branchActivityMonitor, customerDbSync, priceListSync flags existed in FeatureFlagContext but had no UI toggles — now fully exposed in FeatureModuleTogglesPanel
