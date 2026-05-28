# Phase 5a — Core Billing Grid

**Date:** May 2026
**Status:** Complete

---

## What Was Built

### New Files

| File | Purpose |
|---|---|
| `src/renderer/pages/NewQuote/billingGrid.types.ts` | All shared types for the billing grid: `BillingRow`, `AdjustmentRow`, `BillFormat`, `GridColumnToggles`, `CellAddress`, arithmetic helpers |
| `src/renderer/pages/NewQuote/BillingGrid.tsx` | Core billing grid component (~1100 lines) |

### Modified Files

| File | Change |
|---|---|
| `src/renderer/pages/NewQuote/index.tsx` | Replaced billing grid placeholder with live `<BillingGrid />` |
| `src/renderer/services/db.service.ts` | Updated `BillRecord.rows` and `BillRecord.adjustments` from `unknown[]` to proper typed arrays |
| `src/renderer/services/bill.service.ts` | Updated `SaveBillInput.rows` / `adjustments` to typed imports |

---

## Features Implemented (per spec)

### Free Format Columns
Sl.No | Item Name | [Qty Unit] | Qty | [Discount] | Rate | Amount

### GST Format Columns
Sl.No | Item Name | [Qty Unit] | Qty | [Discount] | Rate | Pre Tax | GST% | GST Amt | Amount

### Sl.No — Auto Only (Hard Spec #6)
- Purely auto-calculated. Never rendered as an input. Never editable under any circumstance.
- Logic: Sl.No is assigned only when `itemName` is non-empty **and** at least one of `qty`/`rate` is non-empty. Rows with only a name, or completely empty rows, get no serial number.

### Navigation
- Enter / Tab / Arrow keys move between cells freely
- Writing cursor placed at last character on every navigation (via `setSelectionRange(len, len)`)
- Arrow Left/Right cross cell boundaries at start/end of content
- Enter or Down on last row → adds a new row (Hard Spec #14)
- Tab on last col of last row → does **not** add a row (Hard Spec #14)
- Shift+Tab moves backward

### F2 Edit Mode (Hard Spec #5)
- Controlled by `f2ModeEnabled` prop (from Settings in future phases)
- When ON: navigating to a cell with arrow keys does not enter edit mode; typing does nothing until F2 is pressed; F2 unlocks without erasing content (cursor placed at end)
- When OFF: typing immediately replaces cell content (default browser behavior)

### TSV Paste
- Detects tab/newline in pasted text
- Fills cells from paste position, row by row, column by column
- Auto-expands rows if paste extends beyond current last row

### Format Switch Alt+1 / Alt+2
- Alt+1 → Free Format, Alt+2 → GST Format
- Data is fully preserved on switch; only derived calculated fields are recomputed
- Also available via toolbar toggle buttons in the grid header

### Discount Column
- Toggleable via toolbar button (persists in component state)
- Per-row type toggle button (% or ₹ flat) — small button inside the cell
- Applied before Amount calculation: `base - (base * pct/100)` or `base - flat`
- Floored at 0 (no negative item amounts)
- Works in both Free and GST formats

### Qty Unit Column
- Toggleable via toolbar button (persists in component state)
- Free-text column after Item Name
- Not part of any calculation

### Auto-calculations
- Free: `amount = qty × rate` (with optional discount)
- GST: `preTax = qty × rate × discount; gstAmt = preTax × gstPct / 100; amount = preTax + gstAmt`
- Pre Tax, GST Amt, Amount are all read-only cells (visually distinct background)
- Recalc triggered on any change to qty, rate, discount, gstPct

### Starting Rows & Expansion
- 20 rows on mount
- No upper limit — rows added one at a time when Enter/Down pressed on last row

### Adjustments
- User-defined label + amount rows below subtotal
- Amount can be positive or negative (Hard Spec #20) — negative values shown in red
- Add / Remove buttons
- Any number of adjustment rows

### Totals
- **Subtotal**: sum of all row amounts
- **Adjustments Total**: sum of all adjustment amounts (signed)
- **Grand Total**: `Math.round(subtotal + adjustmentsTotal)` — silently rounded to nearest integer (Hard Spec § 9.3)
- Round-off is applied only to grand total, never to row amounts or adjustment rows

---

## Architecture Decisions

1. **Row values kept as strings** — `qty`, `rate`, `discountValue`, `gstPct` are all stored as strings in state. This allows free typing without forcing number formatting on the user. Parsed to numbers only for calculation via `parseNum()` helper.

2. **Ref-based cell focus management** — `cellRefs` Map keyed by `rowIdx:col` lets us imperatively focus any cell. A `pendingFocusRef` + `useLayoutEffect` pattern ensures focus fires after React commits the DOM (handles new row addition correctly).

3. **F2 unlock state is per-active-cell** — `f2Unlocked` resets to `false` on every navigation, so each new cell starts locked in F2 mode.

4. **recalcRow mutates and returns** — Slight departure from pure immutability for performance; the caller always spreads first (`{ ...row }`) before passing to `recalcRow`.

5. **notifyChange pattern** — Parent reads grid state via callback (not controlled state) to avoid excessive re-renders. Parent stores refs `gridRowsRef` / `gridAdjustmentsRef` / `gridTotalsRef` for use only at save time.

---

## Known Issues / Limitations

- `f2ModeEnabled` is hardcoded to `false` in `NewQuote/index.tsx`. Phase 4a-A (Settings) will wire the actual toggle.
- Column toggles (discount, qty unit) persist only for the current session. Phase 4a-A (Settings) will persist them across sessions.
- Rate History Hint (ghost placeholder in Rate cell, Insert to accept) — spec § 9.1 — is stubbed. Phase 4a-A toolbar build.
- Inventory autocomplete in Item Name cell — spec § 9.7 — is stubbed. Phase 4a-A/5b.
- Custom columns (+Col) are not yet part of the grid — Phase 5b.
- Bold/highlight cell formatting — Phase 4a-A toolbar.
- TSV paste fills only navigable columns; does not handle Sl.No column (correct — Sl.No is never writable).

---

## Handoff State

Phase 5a is complete and the app is fully runnable. The billing grid is live on the New Quote page. Saving a bill correctly passes all row data, adjustments, subtotal, and grand total to `bill.service.ts`.

Next: **Phase 5b** — custom columns (+Col / -Col / Mark / Show MKD), bill templates, toolbar full build.
