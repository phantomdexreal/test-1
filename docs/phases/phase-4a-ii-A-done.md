# Phase 4a-ii-A — Done

## What was built

Five new toolbar buttons on the NewQuote page, each fully functional with keyboard shortcuts that fire even when the toolbar is hidden.

---

### 1. Excel Export (`Ctrl+E`)

**File:** `ToolbarPanels.tsx` — `ExcelExportButton`

Copies the current bill as TSV (tab-separated values) to the system clipboard. Paste directly into Excel or Google Sheets.

**TSV structure (nothing truncated):**
- Row 1-4: Party name, bill number, bill date, format
- Row 5: blank
- Row 6: Column headers — Sl.No, Item Name, [Unit], Qty, [Discount], Rate, [Pre Tax, GST%, GST Amt], Amount, [custom col headers…]
- Rows 7–N: All non-empty item rows; Sl.No auto-calculated
- Blank separator row
- Subtotal, each adjustment row (label + amount), Grand Total

Custom columns are fully included (one column per header). GST breakdown columns appear only in GST Format. Discount column only appears if any row has a discount. Empty rows are gracefully skipped.

Panel shows a summary of what's included, then a "Copy TSV to Clipboard" button with visual feedback (✓ Copied / error states).

---

### 2. Print Options (`Ctrl+P`)

**File:** `ToolbarPanels.tsx` — `PrintOptionsPanel`

Opens a panel with format and page size options, then triggers browser print.

**Format options:**
- Simplified — party name + contact only; zero company info (Hard Spec §8)
- Professional — includes company header, logo placeholder, UPI QR option
- Detailed Professional — full company + customer details including address

**Page size:** A5 / A4 (user selects)

**Row count advisory:** Warns if row count exceeds the A5 limit for the chosen format (40/30/20 rows respectively per Hard Spec §15).

**UPI QR toggle:** Checkbox to include UPI QR in print; placeholder shown until UPI ID is configured in Settings (Phase 6a-A).

**Print contract:** Internal remarks are explicitly excluded from the printed HTML output. The HTML comment `<!-- Internal remarks are intentionally excluded -->` is present in the generated print document to make this visible to any future developer.

Print opens a clean `window.open` print document styled for the chosen page size via `@page` CSS rule.

---

### 3. Duplicate Bill (`Ctrl+D`)

**File:** `ToolbarPanels.tsx` — `DuplicateBillPanel`

Copies the current bill as a new in-progress draft.

**What is always carried over:**
- All item rows (all columns: qty, rate, discounts, GST%)
- All adjustment rows (label + amount)
- All custom columns (headers + all cell data + mark states)
- Bill format (Free / GST)

**User-configurable options:**
- Keep party details (name, phone, transport) — checked by default
- Keep cell formatting (bold, text color, cell highlights) — unchecked by default

**What always resets:**
- Date → today (Hard Spec mandate: duplicate gets today's date)
- Bill number → assigned fresh on next save (via the bill number engine)
- Internal remarks → cleared (private to original bill, never duplicated)

**Implementation:** Uses `BillingGridImperative.loadSnapshot()` — a new method added to the grid's imperative handle (Phase 4a-ii-A). This loads a full grid state snapshot (rows, adjustments, customCols, customColData, cellFormats) into the live grid without a remount.

---

### 4. Bill Templates (`Ctrl+Shift+T`)

**File:** `ToolbarPanels.tsx` — `BillTemplatesPanel`
**Service:** `src/renderer/services/template.service.ts`

Save bill structure (format type + custom column headers) as a named reusable template. Zero row data is ever stored.

**Hard Spec §19 compliance:** "Templates save format type + custom column headers only — zero row data. Templates are fully manageable: create, rename, delete from a template manager panel. Loading a template into a new bill applies the structure only."

**Two-tab panel:**

*Saved Templates tab:*
- Lists all templates (most recently updated first)
- Each entry shows: name, format, custom column count + headers
- Load button: applies format + custom columns to the current bill (rows unchanged; custom column data cleared for the new columns)
- Rename (inline edit with Enter/Escape) 
- Delete (requires confirm click to prevent accidental deletion)
- Empty state: illustrated placeholder with instructions

*Save Current Structure tab:*
- Shows what will be saved (format, custom column names) and explicitly what won't be (row data — shown in red)
- Template name input (Enter to save)
- Format selector (defaults to current bill's format)
- Save button disabled until name is typed

**Storage:** `localStorage` key `cq:bill_templates` for dev/browser mode; IPC → SQLite in Electron (when `window.cqikly.db` is available). All data access is through `template.service.ts` — no component touches storage directly.

---

### 5. Internal Remarks (`Ctrl+Shift+R`)

**File:** `ToolbarPanels.tsx` — `InternalRemarksPanel`

A private text area per bill for internal notes. 

**Hard privacy contract:**
- Never included in any PDF output (Phase 6a-A will enforce in PDF renderer)
- Never included in print output (explicitly excluded from PrintOptionsPanel's HTML)
- Never included in Excel/TSV export (`buildTsv()` does not read `internalRemarks`)
- Never included in Duplicate Bill (cleared on duplicate)
- Only visible inside the NewQuote page

**UX:**
- Auto-saves to parent state on every keystroke (no explicit Save button)
- Yellow privacy notice banner always shown in the panel
- Character counter shown when text is present
- Clear button (with trash icon) when text is present
- The toolbar button shows a yellow dot badge when remarks are non-empty (visual reminder)

**State:** `internalRemarks: string` in `NewQuotePage` state. Passed into `saveBill()` as `internalRemarks` field (already typed in `SaveBillInput` from Phase 4b-ii). Cleared on bill save success.

---

## New methods added to `BillingGridImperative`

| Method | Description |
|---|---|
| `getSnapshot()` | Returns a deep copy of current rows, adjustments, customCols, customColData, cellFormats |
| `loadSnapshot(snap)` | Loads a full grid state snapshot — used by Duplicate Bill |

---

## New keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+E` | Toggle Excel Export panel |
| `Ctrl+P` | Toggle Print Options panel |
| `Ctrl+D` | Toggle Duplicate Bill panel |
| `Ctrl+Shift+T` | Toggle Bill Templates panel |
| `Ctrl+Shift+R` | Toggle Internal Remarks panel |

All previous shortcuts remain unchanged (`Ctrl+B`, `Ctrl+H`, `Ctrl+Shift+H`, `Ctrl+Z`, `Ctrl+Y`, `Ctrl+S`, `Alt+1/2`).

All 5 new shortcuts fire even when the toolbar is hidden (registered in the page-level `useEffect`, not in the toolbar DOM).

---

## Files changed

| File | Change |
|---|---|
| `src/renderer/pages/NewQuote/index.tsx` | New imports, 5 panel state vars, `internalRemarks` state, `handleDuplicate`, `handleLoadTemplate` callbacks, `internalRemarks` passed to `saveBill`, 5 new keyboard shortcuts, 5 new toolbar button groups |
| `src/renderer/pages/NewQuote/BillingGrid.tsx` | `BillingGridImperative` extended with `getSnapshot` and `loadSnapshot`; both implemented in the imperative handle `useEffect` |
| `src/renderer/pages/NewQuote/ToolbarPanels.tsx` | **New file** — all 5 panel components: `ExcelExportButton`, `PrintOptionsPanel`, `DuplicateBillPanel`, `BillTemplatesPanel`, `InternalRemarksPanel`, plus shared `Panel`, `Btn`, `Label` helpers |
| `src/renderer/services/template.service.ts` | **New file** — `getTemplates`, `createTemplate`, `renameTemplate`, `deleteTemplate`; localStorage + IPC dual-mode |

---

## Decisions made

- **Panel design pattern:** All 5 panels use a shared `Panel` wrapper component (title bar + close button + Escape key + outside-click dismiss). This ensures all panels feel consistent and future panels can reuse the same wrapper.
- **Toolbar mutual exclusivity:** Opening any panel closes all other open panels (color pickers included). This prevents UI clutter where multiple panels are stacked.
- **Print via `window.open`:** Rather than using Electron's `webContents.print()` IPC (not yet wired), the print panel opens a clean HTML document in a new window and triggers `window.print()`. This works in both browser dev mode and Electron. Full IPC-based printing deferred to Phase 6a-A.
- **Duplicate remarks policy:** Internal remarks are intentionally NOT duplicated. They belong to the original bill and are private to it. A duplicated bill starts with a clean remarks slate.
- **Template loading keeps row data:** Loading a template onto a bill with existing rows does not wipe those rows. It applies format + column headers only — preserving the user's typed content. Only custom column cell data is cleared for the newly-applied columns.
- **`internalRemarks` in `SaveBillInput`:** The field already existed in `bill.service.ts` from Phase 4b-ii (foresight). This phase now populates it.
- **`LayoutTemplate` icon:** Used instead of `BookTemplate` to ensure compatibility with lucide-react 0.383 without node_modules available for verification.

## Known issues / handoff state

- Print output is a basic browser-rendered HTML document. Full professional PDF-quality print with company logo, correct page breaks, bank details, and UPI QR code integration is deferred to Phase 6a-A (PDF generation system).
- `internalRemarks` is saved in the in-memory `BillRecord` and to SQLite (when Electron IPC is available) but is not yet displayed when reopening a bill from History (deferred to Phase 7 — bill reopen flow).
- Template IDs use `Date.now() + random` for dev mode. In Electron mode, SQLite `lastInsertRowid` is used. Full migration to sequential IDs deferred to Phase 6a-A DB migration.
- The `ExcelExportButton` reads from `gridRowsRef.current` (a ref, not React state) — this is correct and intentional. The ref is always current because `handleGridChange` updates it on every grid change.
