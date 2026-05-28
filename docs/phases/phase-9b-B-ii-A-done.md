# Phase 9b-B-ii-A — Inventory Mode on Quote Page (Autocomplete)

**Status:** Complete  
**Session:** May 2026

---

## What Was Built

### 1. Inventory Mode Toggle in Settings (`AppConfig` + Settings UI)

- Added `inventoryModeEnabled: boolean` to `AppConfig` in `ConfigContext.tsx` (default: `false`)
- Added an "Inventory Mode on Quote Page" settings panel in `Settings/index.tsx` — ON/OFF toggle
- Panel explains the feature: fuzzy autocomplete when typing in Item Name, Insert key accepts, fills rate per format, user can keep typing freely

### 2. Fuzzy Search in Inventory Service (`inventory.service.ts`)

- Added `fuzzySearchItems(query, limit = 8)` — returns up to 8 inventory items scored by:
  - Exact match → score 1000
  - Starts with query → score 900+
  - Word starts with query → score 800
  - Contains query → score 700 - position
  - All chars appear in order (fuzzy) → score 100+
- No external dependency — pure JS, fast for typical inventory sizes (hundreds to low thousands of items)

### 3. InventoryAutocomplete Component (`NewQuote/InventoryAutocomplete.tsx`)

New self-contained component:
- Renders as a `position: fixed` dropdown below the active Item Name cell (anchored to the cell's DOMRect)
- Shows up to 8 fuzzy-matched items
- Each suggestion card: 36×36 item image (or IMG placeholder if no image) + item name + price + unit/barcode
- Highlighted item shows "Insert ↵" badge on the right
- Header shows "↑↓ navigate · Insert to accept"
- `onMouseDown={e.preventDefault()}` prevents blur on click so click-to-select still works
- Scrolls selected item into view on keyboard navigation

### 4. BillingGrid Wiring (`NewQuote/BillingGrid.tsx`)

New props:
- `inventoryModeEnabled?: boolean` — gates all autocomplete behaviour
- `billFormatForInv?: BillFormat` — passed so rate source lookup uses the correct format

New state:
- `invSuggestions: InventoryItemFull[]` — current fuzzy matches
- `invSelectedIdx: number` — currently highlighted suggestion (0-based)
- `invAnchorRowIdx: number | null` — which row the dropdown belongs to
- `invImageCache: Record<string, string | null>` — pre-loaded data URLs per item id
- `invSearchTimerRef` — debounce timer (80ms)

New helper callbacks:
- `closeInvDropdown()` — clears all inv dropdown state
- `triggerInvSearch(query, rowIdx)` — debounced fuzzy search + image preloading
- `acceptInvSuggestion(rowIdx)` — accepts highlighted suggestion; fills itemName + rate; returns true if accepted

`handleCellKeyDown` changes (fully column-context-aware, zero conflict):
- **Insert in `itemName` cell:** calls `acceptInvSuggestion`. If a suggestion is accepted, cursor stays in Item Name cell and user can keep typing. If no dropdown is open, Insert does nothing.
- **Insert in `rate` cell:** accepts rate history hint (Phase 4a-ii-B). Completely independent. Bug fix: removed stale `setActiveRateHint(null)` call that referenced an undefined setter.
- **ArrowDown/ArrowUp in `itemName` when dropdown open:** navigates the suggestion list instead of moving rows.
- **Escape in `itemName` when dropdown open:** closes dropdown without moving away.
- **Tab/Enter/ArrowDown navigating away from `itemName`:** calls `closeInvDropdown()` to clean up.

Item Name `GridCell` JSX:
- `onChange`: calls `triggerInvSearch(v, rowIdx)` on every keystroke (only when `inventoryModeEnabled`)
- `onFocus`: re-triggers search if cell already has text (re-focus scenario)
- `onBlur`: closes dropdown with 120ms delay (so click-to-select in dropdown fires first)

`InventoryAutocomplete` render (portal-style fixed position at bottom of BillingGrid JSX):
- Click-to-select directly applies the item (same logic as Insert accept)
- After click-select, refocuses the Item Name cell with cursor at end

`GridCell` interface: added optional `onBlur?: () => void` prop; wired to the `<input>` element.

### 5. NewQuote Page (`NewQuote/index.tsx`)

- Added `import { useConfig }` from ConfigContext
- Added `const { config } = useConfig()` in component body
- Passes `inventoryModeEnabled={config.inventoryModeEnabled === true}` and `billFormatForInv={billFormat}` to `<BillingGrid>`

---

## Architectural Decisions

- **No external fuzzy search library** for this use case — simple scoring is fast and predictable for SMB inventory sizes
- **Image preloading on match** — images are loaded asynchronously when suggestions first appear, cached in component state, and shown in the card without blocking the dropdown render
- **80ms debounce** — balances responsiveness with not hammering inventory on every keystroke
- **120ms blur delay** — standard pattern to allow click events on the dropdown to fire before the blur closes it
- **Column-context Insert** — the Insert key handler checks `col` first, making the two behaviours (inventory accept vs rate hint accept) completely independent with no shared state

---

## Zero-Conflict Guarantee

| Context | Insert fires | What happens |
|---|---|---|
| In `itemName`, dropdown open | ✓ | Accept inventory suggestion; fill name + rate; cursor stays in cell |
| In `itemName`, dropdown closed | No-op | Nothing (dropdown not open) |
| In `rate`, hint visible | ✓ | Accept rate history ghost; fill rate; cursor stays in cell |
| In `rate`, no hint | No-op | Nothing (hint not visible) |
| In any other column | No-op | Nothing |

---

## Files Changed

| File | Change |
|---|---|
| `src/renderer/contexts/ConfigContext.tsx` | Added `inventoryModeEnabled: boolean` to `AppConfig` type and defaults |
| `src/renderer/services/inventory.service.ts` | Added `fuzzySearchItems()` method |
| `src/renderer/pages/NewQuote/InventoryAutocomplete.tsx` | **New file** — autocomplete dropdown component |
| `src/renderer/pages/NewQuote/BillingGrid.tsx` | Full inventory autocomplete wiring; Insert key context fix; setActiveRateHint bug fix |
| `src/renderer/pages/NewQuote/index.tsx` | Pass `inventoryModeEnabled` and `billFormatForInv` to BillingGrid |
| `src/renderer/pages/Settings/index.tsx` | Added "Inventory Mode on Quote Page" toggle panel |

---

## Known Issues / Notes

- `fuzzySearchItems` is pure-JS — if inventory grows to 10k+ items, consider swapping in Fuse.js (already a project dependency) without changing the call site
- Image cache lives in BillingGrid state — cleared on remount (new bill). This is intentional: no stale images across bills
- The `billFormatForInv` prop mirrors `format` from NewQuote but is passed separately so BillingGrid doesn't need to own format state just for inventory

---

## Test Checklist

- [ ] Settings → Quote Page — Inventory Mode: toggle ON/OFF persists across navigation
- [ ] Inventory mode OFF: typing in Item Name shows no dropdown; Insert in Item Name does nothing
- [ ] Inventory mode ON: typing "abc" shows up to 8 fuzzy-matched items from inventory
- [ ] Items with images show the image in the suggestion card; items without show "IMG" placeholder
- [ ] ArrowDown/ArrowUp navigate the dropdown without moving grid rows
- [ ] Insert accepts the highlighted item: fills Item Name + fills Rate column per active format
- [ ] After Insert, user can continue typing in Item Name freely (not locked)
- [ ] Free Format + "Price" rate source → Insert fills `price` field from the matched item
- [ ] GST Format + "GST Price" rate source → Insert fills `gstPrice` field from the matched item
- [ ] Clicking a suggestion in the dropdown accepts it (same as Insert)
- [ ] Escape closes the dropdown without navigating away
- [ ] Tab/Enter/ArrowDown while dropdown is open navigates away AND closes dropdown
- [ ] Insert in Rate cell (rate hint visible) still works correctly — fills rate, cursor stays
- [ ] Insert in Rate cell (no hint) does nothing — no conflict
- [ ] Insert in any other column (Qty, GST%, etc.) does nothing

---

*Phase 9b-B-ii-A complete. Next: Phase 10 — History page.*
