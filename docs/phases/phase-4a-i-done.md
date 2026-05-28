# Phase 4a-i — Done

## What was built

### Toolbar Strip (NewQuote `index.tsx`)
A proper toolbar strip now sits between the breadcrumb bar and the main scrollable content. It contains four logical button groups separated by dividers:

1. **Bold + Color** — Opens a color dropdown (15 preset swatches + custom color picker). On color select, applies bold + text color to the active cell via `gridImperativeRef.current.applyBoldHighlight(color)`. Quick-apply shortcut: `Ctrl+B` (applies red by default).
2. **Highlight Cell** — Opens a color dropdown. On select, sets the full background color of the active cell via `gridImperativeRef.current.highlightCell(color)`. Quick-apply shortcut: `Ctrl+H` (applies amber by default).
3. **+Col / −Col** — Wire directly to `addCustomColumn` / `removeLastCustomColumn` on the grid imperative handle. Same logic as Phase 5b, now accessible from the proper toolbar.
4. **Mark / Show MKD** — Wire to `markActiveCustomCell` / `showMkd` on the grid imperative handle.
5. **Undo / Redo** — Wire to `undo` / `redo`.

### Toolbar Visibility Toggle
- A "Hide Toolbar / Show Toolbar" button in the breadcrumb bar always remains visible.
- Toggles the toolbar strip on/off with `toolbarVisible` state.
- When hidden, the strip disappears but **all keyboard shortcuts continue to fire** because they are registered globally in the page-level `useEffect`, independent of the toolbar DOM.
- Keyboard shortcut: `Ctrl+Shift+H`.

### Color Persist System (`BillingGrid.tsx`)
- New `cellFormats: CellFormatMap` state added to `BillingGrid`.
- `CellFormatMap` is a `Record<string, CellFormat>` where keys are stable (row IDs, not indexes):
  - Standard cells: `"{rowId}:{colName}"`
  - Custom cells: `"custom:{colId}:{rowId}"`
- `CellFormat` stores `bold?: boolean`, `textColor?: string`, `bgColor?: string`.
- Because keys use stable `row.id` strings (not array indexes), formats survive row reorder without corruption.
- `applyBoldHighlight(color)` — finds the active cell's format key, toggles bold+textColor (clears if same color already applied).
- `highlightCell(color)` — finds the active cell's format key, toggles bgColor (clears if same color already applied).
- `clearCellFormat()` — removes all formatting from active cell.
- Format state is passed to the parent `onChange` callback as the 6th argument: `(rows, adjustments, totals, customCols, customColData, cellFormats)`.
- `gridCellFormatsRef` in the parent captures this for persistence with bill data.
- `GridCell` and `CustomCell` render components accept a `fmt: CellFormat` prop and apply styles:
  - `color: fmt.textColor ?? 'var(--cq-text-primary)'`
  - `fontWeight: fmt.bold ? 700 : 400`
  - Cell `<td>` background: `fmt.bgColor ?? 'transparent'`

### `BillingGridImperative` extensions
Four new methods added to the imperative handle:
- `applyBoldHighlight(color: string)` 
- `highlightCell(color: string)`
- `clearCellFormat()`
- `getActiveInfo(): { hasActiveCell, hasActiveCustomCell }`

### `billingGrid.types.ts` extensions
```typescript
export interface CellFormat {
  bold?: boolean
  textColor?: string   // from Bold+Highlight button
  bgColor?: string     // from Highlight Cell button
}
export type CellFormatMap = Record<string, CellFormat>
```

## Keyboard shortcuts added
| Shortcut | Action |
|---|---|
| `Ctrl+B` | Bold + red text color on active cell (quick apply) |
| `Ctrl+H` | Amber cell highlight on active cell (quick apply) |
| `Ctrl+Shift+H` | Toggle toolbar strip visibility |

All previous shortcuts (`Ctrl+Z`, `Ctrl+Y`, `Alt+1`, `Alt+2`, `Ctrl+S`) remain unchanged.

## Color Dropdown Component (`ColorDropdown` in `index.tsx`)
- 15 preset swatches (solids + translucent highlights)
- Custom HTML color picker with live preview
- Closes on outside click

## Color persist on bill reopen
- `initialCellFormats?: CellFormatMap` prop added to `BillingGrid`.
- When a bill is reopened from History (Phase 7), pass `cellFormats` from the saved bill data into this prop.
- Colors are keyed by stable row IDs so they survive any reorder.
- DB persistence of `cellFormats` alongside bill rows is deferred to Phase 6a-A (save/load bill).

## Decisions made
- Color picker lives in `index.tsx` (toolbar), not inside `BillingGrid`. BillingGrid only exposes the imperative `applyBoldHighlight` / `highlightCell` methods. This keeps the grid clean and the toolbar fully self-contained.
- Bold and text color are always applied together (Bold+Highlight). This matches the spec: the button is called "Bold+Highlight" not separate Bold and Color buttons.
- `CellFormatMap` keys use stable `row.id` (not `rowIdx`) so drag-reorder never corrupts highlights.
- Toolbar dividers and group layout follow the "generous spacing, breathing room" UI rule from the masterplan.

## Known issues / handoff state
- `cellFormats` is captured in `gridCellFormatsRef` in the parent but not yet persisted to the DB (pending Phase 6a-A save/load).
- The `initialCellFormats` prop is wired in `BillingGrid` but not yet passed from the History page (pending Phase 7).
- `Bold, Highlighter, PaintBucket` icons imported in `index.tsx` — `Highlighter` is unused (Bold+Color uses the `Bold` icon; PaintBucket is for Highlight Cell). Cleanup welcome in next phase.

## Files changed
- `src/renderer/pages/NewQuote/billingGrid.types.ts` — added `CellFormat`, `CellFormatMap`
- `src/renderer/pages/NewQuote/BillingGrid.tsx` — full rewrite with cell formatting state, imperative extensions, `fmt` prop on `GridCell`/`CustomCell`, removed unused `ColorPickerPopup`
- `src/renderer/pages/NewQuote/index.tsx` — full toolbar strip, visibility toggle, `ColorDropdown` component, shortcut wiring
