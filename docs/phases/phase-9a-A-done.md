# Phase 9a-A — Done

## What Was Built

### Inventory Service (`services/inventory.service.ts`)
- Full in-memory + localStorage-backed service (IPC-ready for Electron)
- `InventoryItemFull` type: itemName, category, subCategory, price, wholesalePrice, gstPrice, creditPrice, gstRate, customPrices (Record<colId, string>), plus stubs for stockQty/threshold/unit/barcode/imagePath (Phase 9a-B)
- CRUD: `addItem`, `updateItem`, `deleteItem`, `getItems`
- Custom Price Columns: `addCustomColumn`, `renameCustomColumn`, `deleteCustomColumn`, `getCustomColumns`
- Categories: `addCategory`, `addSubCategory`, `deleteCategory`, `getCategories`
- Inventory Rate Source Config: `getRateSourceConfig`, `setRateSourceConfig`, `getPriceFieldOptions`, `getPriceValue`
- `invalidate()` for DB hot-swap support
- All mutations emit `inventoryChanged` via eventBus

### Inventory Page (`pages/Inventory/index.tsx`)
- Full tabular editor: FIXED_COLS (Item Name, Category, Sub-Category, Price, Wholesale Price, GST Price, Credit) + unlimited custom price columns + TAIL_COLS (GST Rate %)
- Category sidebar with collapsible sub-categories, add/remove categories and sub-categories
- Tabular free-navigation editing identical to billing grid:
  - Enter/↓ → next row (adds new item on last row)
  - ↑ → previous row
  - Tab/Shift+Tab → next/previous column
  - ←/→ → left/right column (when F2 unlocked or F2 mode OFF)
  - F2 → unlock cell in F2 mode (cursor stays in content)
  - Cursor placed at end of content on focus
- F2 Mode toggle in toolbar (ON = strict Excel-style lock; OFF = immediate edit)
- Local edit state flushed on blur → no full re-render per keystroke
- Add Item button + Enter on last row
- Delete item with confirm dialog
- Search bar (fuzzy by itemName, barcode)
- Category filter via sidebar with sub-category drill-down
- Custom column: Add (modal), Rename (modal), Delete (confirm dialog)
- Status bar: item count, active filter badge, F2 mode indicator
- Sticky header row; alternating row shading; active row highlight

### Settings Panel (`pages/Settings/InventoryRateSourcePanel.tsx`)
- Wired into Settings page after PDF Settings
- Independently configures price field per bill format: Free Format (Alt+1) and GST Format (Alt+2)
- Dropdown includes all 4 built-in fields + any custom price columns
- Reacts live to `inventoryChanged` events — custom columns appear instantly when added in Inventory
- Selections persisted via `inventoryService.setRateSourceConfig`

### eventBus
- Added `inventoryChanged: Record<string, never>` event type

### Services index
- Exported `inventoryService` and all related types

## Decisions Made
- **Local edit state pattern**: each cell has a localEdits entry (itemId::colId → value) flushed on blur. This avoids re-rendering the full table on every keystroke while keeping the service as the single source of truth.
- **Category storage**: category is stored as category.id in item; display resolves to cat.name. Raw text accepted as fallback for categories typed directly (create-on-the-fly behaviour).
- **Custom column IDs**: stable `cp-{timestamp}` IDs, never re-used. Deleting a column removes the id from all items and resets rate source config if it pointed to the deleted column.
- **eventBus `inventoryChanged`**: uses `Record<string, never>` (empty object type) since no payload is needed — subscribers just reload.

## Known Issues / Stubs for Next Phase
- `stockQty`, `lowStockThreshold`, `unit`, `barcode`, `imagePath` fields are present in the type and service but NOT shown as columns in this phase — they are Phase 9a-B deliverables.
- No Excel import/export yet (Phase 9b-B).
- No price change history or usage analytics (Phase 9b-A).
- Inventory autocomplete on Quote page (Insert key wiring) uses the rate source config from this phase but is built in Phase 9b-B.

## Handoff State
- `npm run dev` passes; inventory page fully functional
- All columns navigable; F2 mode works; custom price columns appear in Settings rate source selector
- eventBus `inventoryChanged` fires on every mutation
- Phase 9a-B can proceed immediately
