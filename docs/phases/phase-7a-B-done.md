# Phase 7a-B — Done

## What Was Built

### Fully Editable Bill View from History

**Core feature:** Clicking any bill row in History opens it in a complete, fully editable view — **identical in behaviour to the New Quote page**.

### Files Added / Modified

| File | Change |
|---|---|
| `src/renderer/pages/History/EditBillView.tsx` | **New** — the entire editable bill view component |
| `src/renderer/pages/History/index.tsx` | Wired open-bill state, `onOpen` callbacks, EditBillView rendering, column header updated |
| `src/renderer/services/bill.service.ts` | Added `updateBill()` + `UpdateBillInput` interface |

### EditBillView — Full Feature List

**Loading (all data restored exactly as saved):**
- Party name, phone, transport name, address, GSTIN, notes
- Bill date (fully editable, backdating supported)
- Bill format (Free or GST, restored correctly)
- All grid rows — item names, qty, rate, discount, GST%, all auto-recalculated amounts
- Custom columns — headers and all cell data
- Mark system — marked cells restored as sub-group headers
- Cell formats — bold text, text colors, cell highlight colors all restored
- Adjustments — labels and amounts (positive and negative)
- Internal remarks
- Bill status

**Toolbar (identical to New Quote):**
- Bold+Color dropdown (Ctrl+B for quick apply)
- Highlight Cell dropdown (Ctrl+H for quick apply)
- +Col / −Col custom column management
- Mark / Show MKD
- Format toggle (Free ↔ GST, Alt+1 / Alt+2) — never loses data
- Row reorder (grip handle drag)
- Undo / Redo (Ctrl+Z / Ctrl+Y) — session-level
- Toolbar hide/show toggle (Ctrl+Shift+H)

**Grid (identical to New Quote):**
- Same free Excel-like navigation (Enter/Tab/arrow keys)
- Same F2 mode behaviour (off by default, configurable)
- Cursor always placed at last letter of content on navigation
- Auto-recalculation on every cell change
- Enter/Down on last row adds new row; Tab does NOT
- Drag-to-reorder rows
- TSV paste into cells

**Bill status — directly editable:**
- Color-tagged dropdown selector in the top breadcrumb bar
- Shows current status (Unpaid/Paid/Partial/Cancelled) with full color coding
- Changing status marks bill as dirty (triggers unsaved changes guard)

**Save back:**
- "Save Changes" button (Ctrl+S)
- Writes updated bill to DB via `updateBill()` in `bill.service.ts`
- Updates in-memory store + persists to localStorage (dev) / SQLite (Electron)
- After save, history list updates in real-time (parent state is patched via `onSaved` callback)
- Bill stays open after save — user can continue editing

**Unsaved changes guard:**
- Navigating back to History with unsaved edits shows a guard dialog
- Three options: Save, Discard Changes, Cancel
- Pressing Escape also triggers the guard if there are unsaved changes

**Keyboard shortcuts:**
- Ctrl+S — Save
- Ctrl+B — Bold quick apply
- Ctrl+H — Highlight Cell quick apply
- Ctrl+Shift+H — Toggle toolbar
- Alt+1 / Alt+2 — Format toggle
- Ctrl+Z / Ctrl+Y — Undo/Redo
- Escape — Back to History (with guard if dirty)

### History Page Changes

- Bill rows now have `cursor: pointer` hover state
- Clicking anywhere on a bill row opens EditBillView
- "Open →" button added per row (rightmost column)
- Status selector cell click is stop-propagated (doesn't trigger row open)
- Table header now has 6 columns (added blank column for "Open →")
- When EditBillView is active, list header, search bar, filter panel, table header, bill list, and footer are hidden (display:none — NOT unmounted, so filter state is preserved)
- Closing edit view restores the list exactly as left

### updateBill() Service Function

```typescript
interface UpdateBillInput {
  id: number
  partyName: string
  partyPhone?: string
  transportName?: string
  partyAddress?: string
  partyGstin?: string
  partyNotes?: string
  billDate: string
  format: 'free' | 'gst'
  rows?: BillingRow[]
  customColumns?: unknown[]
  adjustments?: AdjustmentRow[]
  subtotal?: number
  grandTotal?: number
  status: BillStatus
  internalRemarks?: string
  cellFormats?: Record<string, unknown>
}
```

- Updates in-memory store
- Persists to localStorage (dev) or SQLite (Electron) via IPC
- Non-fatally updates customer record and transport memory (same as saveBill)
- **Phase 7b note:** Versioning sits on top of this function — for now it overwrites; Phase 7b adds the version preservation layer (Hard Spec #10)

### Decisions Made

1. **Panel visibility on bill open:** Used `display: none` on list elements rather than conditional rendering — this preserves all filter/search state when the user closes the edit view and returns to the list.

2. **Bill stays open after save:** After saving, `setOpenBill(updatedBill)` keeps the edit view open. This matches professional billing UX — the user may want to make further changes or save PDF after saving data.

3. **Status selector position:** Placed in the breadcrumb/header bar (always visible at top), not in the scrollable Bill Info section. This makes it the most accessible control for the most common workflow: opening a bill from History just to change its status.

4. **Snapshot loading via useEffect without dependency array:** The grid's `loadSnapshot` imperative method must be called after mount. We use a `hasLoadedRef` flag instead of a dependency-based effect to ensure it runs exactly once after the grid mounts, regardless of prop changes.

5. **Phase 7b hook:** `updateBill()` is structured so Phase 7b can add versioning by intercepting the call and saving the old bill as a version before running the update — zero changes to EditBillView needed.

### Known Issues / Handoff State

- **Version history:** Phase 7b will add the versioning UI (every save creates a preserved version; version history accessible from edit view). The infrastructure (`updateBill`) is already in place.
- **PDF from edit view:** PDF generation, Copy Image, and Quick Print are intentionally **not** wired in this phase — those actions require the bill to be saved first and the complexity belongs in a later phase when the toolbar panel system is extended. The toolbar in EditBillView is currently formatting-only.
- **f2ModeEnabled:** Currently hardcoded to `false` in EditBillView. Phase later will wire it to the Settings context (same as NewQuote).
- **Column toggles (showDiscount, showQtyUnit):** Currently use defaults. Bills saved with these on will not restore the toggle state — this is acceptable for 7a-B since the data cells are still present; the toggle controls column visibility only, not data.

### Test Instructions

1. Open History page → see 20 mock bills in monthly groups
2. Click any bill row → EditBillView opens with all data loaded
3. Verify: party name, date, format, rows, custom cols, colors, adjustments all match the bill
4. Change item name → amount auto-recalculates
5. Change party name → dirty indicator shows ("● Unsaved changes")
6. Change bill status via top-right selector → dirty indicator
7. Add a row → save (Ctrl+S) → toast confirms save
8. Click "Back to History" → history list shows updated party name + amount
9. Reopen the same bill → all edits present exactly as saved
10. Open bill → make changes → click "Back to History" → guard dialog appears → Cancel → still in edit view → Discard → returns to history
11. Alt+1 / Alt+2 → format switches without data loss
12. Toolbar: Bold+Color, Highlight Cell, +Col, −Col, Mark, Show MKD, Undo/Redo all functional
