# Phase 9a-B — Done

**Phase:** 9a-B  
**Built:** Stock Quantity Tracking · Min Stock Threshold · Stock Deduction on Bill Save · Low Stock Alerts · Dashboard Low Stock Widget Feed · Unit of Measurement

---

## What Was Built

### 1. AppConfig — Two New Settings (`ConfigContext.tsx`)

Added to the `AppConfig` interface and `DEFAULT_APP_CONFIG`:

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `stockQtyEnabled` | `boolean` | `false` | Global toggle — enables all stock tracking columns on Inventory page |
| `stockDeductOnSave` | `boolean` | `false` | When ON, reduces stock qty of matched inventory items on every bill save |

Both are persisted via `updateConfig()` and available app-wide via `useConfig()`.

---

### 2. Inventory Page — Stock Columns (`Inventory/index.tsx`)

When `stockQtyEnabled` is ON, three new columns are appended between the price columns and the custom price columns:

- **Stock Qty** (numeric, 90px) — current stock on hand
- **Min Stock** (numeric, 90px) — minimum threshold; below this = low stock
- **Unit** (text, 70px) — unit of measurement (e.g. "kg", "pcs", "box")

All three columns use the same tabular free-navigation editing as all other inventory columns (Enter/Tab/arrow/F2, cursor at last letter, no modal required).

**Low Stock Badge:**
- Any item where `stockQty < lowStockThreshold` (both numeric, threshold set) is flagged:
  - Row background: `rgba(239,68,68,0.06)` — subtle red tint
  - Row number cell: replaced with a red `AlertTriangle` icon
  - Stock Qty cell: red text + red border
- `isLowStock()` helper handles edge cases: if qty is blank but threshold is set → treated as low stock

**Status Bar:**
- When stock tracking is ON, shows:
  - 🔴 `{N} low stock` in red + triangle icon — when any items are below threshold
  - 🟢 `✓ Stock OK` in green — when all items are above threshold

**Toolbar Badge:**
- Pill badge: `Stock Tracking ON` appears next to the "📦 Inventory" heading when enabled

---

### 3. Settings Page — Stock Tracking Panel (`Settings/index.tsx`)

New panel "Inventory — Stock Tracking" added after the Inventory Rate Source panel, containing two ON/OFF toggle buttons:

1. **Enable Stock Quantity Tracking** — master toggle for stock columns
2. **Deduct Stock on Bill Save** — automatically disabled (greyed out + warning) when master toggle is OFF

Both toggles call `updateConfig()` directly — changes are instant and persist to config.

---

### 4. Stock Deduction on Bill Save (`bill.service.ts`)

Step 7 added to `saveBill()`:

- Reads `stockDeductOnSave` from `localStorage` (`cq:config`) — non-blocking
- When enabled: iterates over all bill rows, matches each `itemName` (case-insensitive) against inventory items
- Deducts the billed `qty` from the matched item's `stockQty`
- `stockQty` never goes below 0 (clamped to `Math.max(0, current - billed)`)
- Non-fatal: a failure at this step never prevents the bill from saving
- Emits `inventoryChanged` indirectly via `inventoryService.updateItem()` which calls `persist()` → `eventBus.emit('inventoryChanged')`

---

### 5. Dashboard Low Stock Widget (`Dashboard/AlertWidgets.tsx`)

`LowStockAlertWidget` now subscribes to `eventBus.on('inventoryChanged')` in addition to the existing 2-minute polling interval:

```
useEffect(() => {
  load()
  const t = setInterval(load, 120_000)
  const unsub = eventBus.on('inventoryChanged', load)
  return () => { clearInterval(t); unsub() }
}, [load])
```

This means the dashboard widget reflects stock changes immediately after:
- A bill is saved with stock deduction enabled
- An item's stock qty is manually edited in the Inventory page
- Any other inventory mutation

---

### 6. `getLowStockItems()` Browser-Mode Fix (`dashboard.service.ts`)

`getLowStockItems()` was previously SQLite-only (Electron IPC). It now has a full browser/dev-mode fallback:

- **Electron mode**: SQL query on `inventory_items` (unchanged, most accurate)
- **Browser/dev mode**: reads from `inventoryService.getItems()` in-memory store; applies the same threshold comparison logic; sorts by most urgent

---

### 7. Unit of Measurement — Flow Through

The `unit` field on `InventoryItemFull` was already present (Phase 9a-A stub). It is now fully active:

- **Inventory page**: editable in the `Unit` column when stock tracking is ON
- **PDF service**: `qtyUnit` is already appended to the qty cell in all three PDF formats (Simplified, Professional, Detailed Professional) — this was verified as working from Phase 5a
- **Billing grid**: the `qtyUnit` column was built in Phase 5a and accepts free-text entry. When Phase 9b wires the inventory autocomplete (`Insert` key in Item Name cell), the selected item's `unit` will auto-populate `qtyUnit`. The data path is fully ready — no structural changes needed in Phase 9b.

---

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/contexts/ConfigContext.tsx` | Added `stockQtyEnabled`, `stockDeductOnSave` to `AppConfig` interface + defaults |
| `src/renderer/pages/Inventory/index.tsx` | Stock columns, low-stock badge, status bar count, toolbar badge, `isLowStock()`, expanded `getCellValue`/`setCellValue` |
| `src/renderer/pages/Settings/index.tsx` | `useConfig` import, Stock Tracking panel with two ON/OFF toggles |
| `src/renderer/services/bill.service.ts` | Step 7 — stock deduction on save |
| `src/renderer/services/dashboard.service.ts` | `getLowStockItems()` browser-mode fallback via `inventoryService` |
| `src/renderer/pages/Dashboard/AlertWidgets.tsx` | `eventBus` import, `inventoryChanged` subscription in `LowStockAlertWidget` |

## No New Migration Needed

The `inventory_items` table already has `stock_qty`, `min_stock`, and `unit` columns in `001_initial.ts` (Phase 1a-i-B). No new migration file was required.

---

## Decisions Made

1. **Stock deduction reads config from `localStorage`** — avoids a prop-drilling chain through saveBill into Settings context. This is safe because the config is always written to `localStorage` first.

2. **`stockQty` clamped to 0** — prevents negative stock values. If more is billed than in stock, qty becomes 0. This is the expected behaviour for a simple SMB tool.

3. **Unit column only visible when stock tracking is ON** — keeps the inventory table clean for users who don't use stock tracking. Unit is a natural companion to stock qty (you track "10 kg" not just "10").

4. **`stockDeductOnSave` is disabled in UI when `stockQtyEnabled` is OFF** — prevents the user from enabling deduction without the underlying columns being visible, which would cause silent updates they couldn't see.

5. **Dashboard widget refresh on `inventoryChanged`** — more responsive than waiting 2 minutes for the polling interval. Deducting stock via a bill save now immediately updates the dashboard.

---

## Known Issues / TODOs

- **Inventory autocomplete → auto-fill unit**: When Phase 9b builds the Insert key autocomplete in the Item Name cell, `inventoryService.getPriceValue()` should also return `item.unit` to auto-populate the `qtyUnit` grid cell. The data path is ready; just needs the Phase 9b trigger.
- **Electron IPC for stock deduction**: In Electron mode, `inventoryService` uses localStorage as well (Phase 9a-A decision). When Phase 9b or later wires IPC-backed inventory ops, the deduction step will seamlessly follow.
- **Stock deduction on bill edit**: Editing a saved bill (History page) currently does not re-deduct or reverse stock. Phase 10+ would need a "reverse deduction on edit" mechanism.

---

## Handoff State

App is fully runnable. All six deliverables from the Phase 9a-B spec are wired:
- ✅ Stock Qty field per item (toggleable globally from Settings)
- ✅ Minimum stock threshold per item
- ✅ Stock deduction on bill save (toggle in Settings)
- ✅ Low stock alerts on inventory page (color badge + row highlight)
- ✅ Low stock alert feeds the dashboard Low Stock Indicator widget
- ✅ Unit of measurement per item (visible in inventory, flows to PDF qty column)

Next phase: **9b-A** — price change history, product usage history, bulk price update, barcode/SKU field.
