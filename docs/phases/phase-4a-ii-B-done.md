# Phase 4a-ii-B — Done

## What Was Built

### 1. Row Reorder (Toolbar Button)
- The drag-to-reorder grip handle (⠿) on every row was already implemented in Phase 5b and remains fully functional.
- Added a **"Row Reorder"** indicator button to the main toolbar strip (Group 5) with `GripVertical` + `MoveVertical` icons and a tooltip explaining the drag gesture.
- The button is intentionally non-clickable (it's a visual affordance reminder, not a mode toggle) — dragging the grip handles on the left of any row is how reordering is performed.
- Drag reorder pushes to the undo stack so it can be undone with Ctrl+Z.

### 2. Undo / Redo (Grid-Level, Toolbar Buttons)
- Undo/Redo was already implemented in the grid (Phase 5b). This phase wires the **toolbar buttons** with correct **disabled states**.
- Undo button grays out when there are no steps to undo; Redo button grays out when there are no steps to redo.
- The `handleGridChange` callback now refreshes `undoLen` / `redoLen` counts by querying `imp.canUndo()` / `imp.canRedo()` after every grid mutation.
- The page-level keyboard handler (Ctrl+Z, Ctrl+Y) also refreshes counts after firing.
- Scope: **grid-level only** (rows, adjustments, custom columns, custom col data). Not app-global. Not session-persistent.

### 3. Rate History Hint
- New `getRateHint(partyName, itemName)` function in `bill.service.ts`.
- **Match logic (fuzzy, 5-tier scoring):**
  1. Exact case-insensitive match → score 100
  2. Prefix match (either string is prefix of the other) → 80
  3. All query words appear in item name → 60
  4. All item name words appear in query → 55
  5. Partial word overlap → 30 + bonus per overlap word
  - Minimum score threshold: 30 (below that = no hint shown)
- Picks the most recent matching bill row by `billDate` for the given party.
- **Ghost placeholder** renders in the Rate cell when: value is empty AND cursor is in that Rate cell AND a hint exists.
- **"Insert to accept ↑" badge** appears above the cell (tiny, non-intrusive) when the ghost is visible.
- **Insert key in Rate cell** → accepts the hint, fills the rate, cursor stays in Rate cell. Completely column-context-aware: only fires from the `rate` column, never from `itemName` (zero conflict with inventory Insert from Item Name cell — they are in different columns).
- `partyName` prop flows: `NewQuotePage` → `BillingGrid`. When party name changes, all rate hints recompute.
- Mock bill data updated with realistic item rows (Cotton Fabric, Steel Pipe, Basmati Rice etc.) so the hint works in dev mode out of the box.

### 4. Format Toggle (Alt+1 / Alt+2 — Toolbar Buttons)
- Added **Free / GST** toggle button pair to the main toolbar strip (Group 4), replacing the prior inlined format display.
- The two buttons are styled as a connected toggle group with rounded corners on outer edges only.
- Active format shows accent background + accent color text + active icon (ToggleRight).
- Inactive shows muted style with ToggleLeft icon.
- Both buttons show `Alt+1` / `Alt+2` shortcut labels inline.
- Alt+1 / Alt+2 keyboard shortcuts wired at page level (in addition to BillingGrid's own handler) to ensure the toolbar buttons also reflect format changes triggered by keyboard.
- Format switch logic is hot — no row data is lost when switching format; amounts are recalculated.

## Architecture Decisions
- Rate hint state is stored as a `Record<number, string | null>` keyed by `rowIdx`. Recomputed on `partyName` or `itemName` column change (dependency string: `rows.map(r => r.itemName).join('\x00')`). This avoids per-focus DB queries.
- `activeRateHint` state was considered but removed — the ghost is shown directly from `rateHints[rowIdx]` combined with the `isActive` prop in `GridCell`, keeping the logic simple.
- `GridCell` now accepts an optional `rateHint?: string | null` prop. Only the Rate cell passes it; all other cells pass nothing (clean default).
- Insert key guard: `if (e.key === 'Insert' && col === 'rate')` — the column check is the conflict prevention mechanism. Zero conditional branching needed.

## Keyboard Shortcuts Added
| Shortcut | Action |
|---|---|
| Alt+1 | Switch to Free Format |
| Alt+2 | Switch to GST Format |
| Insert (in Rate cell, hint visible) | Accept rate history hint, fill rate, cursor stays in Rate cell |
| Insert (in Rate cell, no hint) | Does nothing |

## Known Issues / Handoff State
- Rate History Hint currently searches the in-memory `_bills` store (dev mode). In production, the IPC handler will need a `getRateHint` call to SQLite that performs a `SELECT` over bill rows joined by party name.
- The "Insert to accept ↑" badge is positioned `top: -18px` which may overlap the column header on the very first row. A future pass could use a tooltip instead.
- The Row Reorder toolbar button is a passive affordance indicator. If a future phase wants "reorder mode" (click to activate, then arrow keys to move rows), that would be a separate spec item.

## Files Modified
- `src/renderer/pages/NewQuote/BillingGrid.tsx` — partyName prop, rateHints state, rate hint useEffect, Insert key handler in rate column, GridCell rateHint + ghost placeholder + badge
- `src/renderer/pages/NewQuote/index.tsx` — Format Toggle toolbar group, Row Reorder indicator, Undo/Redo with disabled states, undoLen/redoLen state, partyName passed to BillingGrid, keyboard handler extended with Alt+1/Alt+2 and undo/redo count refresh
- `src/renderer/services/bill.service.ts` — getRateHint() function, mock bill data enriched with rows

## ZIP Output
`cQikly-phase-4a-ii-B.zip`
