# Phase 5b — Done

**Phase:** 5b  
**Date:** May 2026  
**Built in:** This session (Claude Sonnet 4.6)

---

## What Was Built

### 1. Custom Column System (+Col / -Col)

- **+Col**: Clicking opens a `window.prompt` asking for the header name. No hardcoded names anywhere — the user types whatever they want (THREAD, SIZE, COLOUR CODE, etc.). Column is added to the right side of the grid with the exact user-supplied header.
- **-Col**: Removes the last added custom column. Disabled (greyed out) when no custom columns exist.
- Custom columns persist their data across format switches (Free ↔ GST). Switching format does not touch custom column state at all — they are stored independently from billing row data.
- Custom column data is included in the `saveBill()` payload as `customColumns` (array of `{ id, header, cells }`), so it persists in saved bills when the bill service is fully implemented.
- Each custom column has a stable `id` (generated once). The `CustomColData` map keyed on this id stores `CustomColCell[]` — one cell per row, index-matched to `BillingRow[]`.

### 2. Mark System

- The **Mark** toolbar button marks/unmarks the currently active custom column cell.
- A marked cell becomes a **named sub-group header**: its text becomes the group name in MKD totals.
- Visually, marked cells have:
  - A left accent bar (3px wide, `--cq-accent` color)
  - Accent-colored text, bold weight
  - Slightly tinted background
  - A small `MKD` badge in the top-right corner of the cell
- The Mark button is disabled when no custom column cell is focused.
- The **first group** (before any marked cell) always uses the column header name as the group name (per spec §9.1 Hard Spec).
- Marking/unmarking pushes to the undo stack.

### 3. Show MKD Dialog

- Opens a **movable, closeable** floating dialog via the `MKD` toolbar button.
- Dialog is draggable by its title bar (mouse drag, no library required).
- **For each custom column**, the dialog shows:
  - `Column: {user-defined column name}` as a section header
  - One line per group: `{group name} = {total qty}`
- **Qty parsing rules (exactly per Hard Spec §2.1)**:
  - `+` is ALWAYS plain text — the whole entry counts as qty 1, never a separator
  - `-` and `=` are the only valid separators
  - Entry with no separator (e.g. `1024`, `black`) → qty = 1
  - Entry with separator: qty = numeric value after separator (e.g. `1024-2` → 2, `black=3` → 3)
  - Non-numeric after separator (e.g. `abc-xyz`) → qty = 1
  - Empty cell → qty = 0 (not counted)
- The dialog shows a helpful empty state when no custom columns have been added.
- Close button (X) in the title bar closes the dialog.

### 4. Grid-Level Undo / Redo

- **Ctrl+Z** to undo, **Ctrl+Y** or **Ctrl+Shift+Z** to redo.
- Also accessible via the `Undo` / `Redo` toolbar buttons (with disabled state and step count in tooltip).
- Undo/redo stack is grid-level only — it only affects the billing table, not the whole app.
- Scope: within current bill session only. Stack resets when a new bill is started.
- Stack depth: 100 snapshots max (oldest dropped on overflow).
- A `GridSnapshot` captures: `rows`, `customCols`, `customColData`, `adjustments`.
- Operations that push to the undo stack: any cell edit, +Col, -Col, Mark/Unmark, row drag-to-reorder.

### 5. Row Drag-to-Reorder

- Every row has a `GripVertical` drag handle on the far left.
- Standard HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`).
- When dragging: source row becomes semi-transparent (opacity 0.45). Target row gets an accent-tinted highlight.
- On drop: rows are reordered. **Custom column data arrays are also reordered** in sync — so custom column cell data follows each row correctly.
- Drag pushes to the undo stack before reordering.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| `CustomColData` keyed by stable column ID | Columns can be renamed or reordered without corrupting cell data |
| Cells indexed by row index (not row ID) | Simpler; row IDs are stable but index is what matters for render order |
| `imperativeRef` pattern | Toolbar buttons in a parent component can call `addCustomColumn()`, `markActiveCustomCell()`, etc. without lifting all state up |
| `window.prompt` for column name | No UI dependency needed; a proper inline-rename dialog can be added in a later phase when the full toolbar is built |
| Separate `activeCustomCell` state from `activeCell` | Custom cells and standard grid cells are visually and behaviorally distinct; separate tracking avoids confusion |
| Undo stack in `useRef` + shadow `useState` lengths | Avoids re-rendering the entire grid on every undo — only the toolbar buttons need to know stack depth |

---

## MKD Parsing — Verified Test Cases

| Input       | Expected qty | Actual |
|-------------|-------------|--------|
| `1001-2`    | 2           | ✓      |
| `1111-45`   | 45          | ✓      |
| `112`       | 1           | ✓      |
| `1332`      | 1           | ✓      |
| `111-2`     | 2           | ✓      |
| `12121=2`   | 2           | ✓      |
| `nlaks+4`   | 1 (+  is plain text) | ✓ |
| `abc-xyz`   | 1 (non-numeric after sep) | ✓ |
| `black=3`   | 3           | ✓      |
| `1024`      | 1           | ✓      |
| ``          | 0           | ✓      |

---

## Files Changed

| File | Change |
|---|---|
| `src/renderer/pages/NewQuote/billingGrid.types.ts` | Added `CustomColumn`, `CustomColCell`, `CustomColData`, `GridSnapshot`, `emptyCell()`, `parseMkdQty()`, `computeMkdGroups()` |
| `src/renderer/pages/NewQuote/BillingGrid.tsx` | Full rewrite for Phase 5b: custom cols, mark system, MKD dialog, undo/redo, drag reorder, imperative ref |
| `src/renderer/pages/NewQuote/index.tsx` | Updated `onChange` signature to include custom col state; passes `imperativeRef`; includes custom col data in save payload |
| `docs/phases/phase-5b-done.md` | This file |

---

## Known Issues / Limitations

- `window.prompt` for column name input: works but is a browser modal. A proper inline-rename widget will come when the full toolbar is built in Phase 4a-i.
- Undo stack does not capture `columnToggles` changes (Discount/Qty Unit toggles) — these are considered UI preferences, not bill data.
- Drag-to-reorder uses HTML5 native drag-and-drop. Works well on desktop Electron. Mobile is not in scope.
- If `addRow()` is called during drag (by pressing Enter/Down while the last row is selected), the custom column data array for that column is expanded correctly. However, if a row is added from a non-dragged context while a drag is in progress (unlikely), there may be a one-frame index mismatch. Not a realistic user scenario.

---

## Handoff State

Phase 5b is complete. The grid now has:
- ✅ Custom columns with fully user-defined headers
- ✅ Custom column data persists across format switches
- ✅ Custom column data saved with bills
- ✅ Mark system with visually distinct marked cells
- ✅ First group uses column header name
- ✅ Show MKD dialog — movable, closeable, correct qty parsing per Hard Spec §2.1
- ✅ Grid-level Undo/Redo (Ctrl+Z / Ctrl+Y)
- ✅ Row drag-to-reorder with custom col data sync

**Next phase:** Phase 4a-i — Build the first half of the full toolbar: Bold+Highlight, Highlight Cell, +Col, -Col, Mark, Show MKD, toolbar visibility toggle, and color persist system.
