# Phase 9b-A — Done

## What Was Built

### 1. Price Change History (per item)
- Every write to a built-in price field (`price`, `wholesalePrice`, `gstPrice`, `creditPrice`) or a custom price column via `inventoryService.updateItem()` is intercepted and a `PriceChangeEntry` is recorded before the write is applied.
- History is stored in `localStorage` key `cq:inventory:priceHistory` (browser/dev mode); DB migration `002` creates `inventory_price_history` table for Electron/SQLite.
- Accessible via the **📊 history button** on each inventory row → opens `ItemDetailPanel` → "Price History" tab.
- `PriceHistoryPanel` shows: date/time, field name, old value, new value, Δ amount + % as a coloured trend indicator.

### 2. Product Usage History (per item)
- `inventoryService.recordUsageFromBill()` is called by `bill.service.ts` every time a bill is saved with rows matching inventory items (by case-insensitive name match). Wired **unconditionally** — does not require stock deduct to be ON.
- Each `UsageEntry` stores: party name, bill ID, bill number, bill date, qty, rate, amount.
- Accessible from the same `ItemDetailPanel` → "Usage History" tab.
- `UsageHistoryPanel` shows analytics strip (total bills, total qty, total revenue, avg rate), top-5 buyer chips, and a full transaction table.
- DB migration `002` creates `inventory_usage_history` table.

### 3. Bulk Price Update
- **Select items** via per-row checkboxes (left of #); select-all toggle in header.
- When ≥ 1 item selected, **Bulk Price Update (N)** button appears in toolbar.
- `BulkPriceUpdateModal` is a 3-step flow:
  1. **Config** — choose price field (all built-ins + custom columns), mode (% or flat), value, round-to (0/1/2 decimals).
  2. **Preview** — table of all selected items showing current → new value and Δ. Items with blank prices show as unchanged and are clearly marked.
  3. **Confirm** — checkbox confirmation required before Apply button is enabled. Cannot be undone.
- `inventoryService.previewBulkPriceUpdate()` — pure computation, no writes.
- `inventoryService.applyBulkPriceUpdate()` — writes all changed values and records price history entries for each.

### 4. Barcode / SKU Field
- **New `Barcode / SKU` column** added to the inventory table (second column after Item Name), fully editable inline like all other columns.
- **Search** — the toolbar search input also matches `item.barcode` (case-insensitive), so typing or scanning a barcode filters to the matching item.
- **Scanner auto-detection** — `useBarcodeScanner` hook monitors keystroke timing in the search input. Consecutive keystrokes arriving < 50ms apart are treated as scanner input (hardware barcode scanners send characters at wire speed). On Enter after scanner-speed input, `inventoryService.findByBarcode()` is called; if a match is found, the search is set to the barcode and the item detail panel opens.
- `inventoryService.findByBarcode(code)` — exact match (case-insensitive).
- DB migration `002` adds `barcode TEXT` column to `inventory_items` (with ALTER TABLE guard) and a `idx_inventory_barcode` index.

## Files Changed / Created
| File | Action |
|---|---|
| `src/renderer/services/inventory.service.ts` | Major update — added `PriceChangeEntry`, `UsageEntry` types; `getPriceHistory()`, `getUsageHistory()`, `recordUsageFromBill()`, `previewBulkPriceUpdate()`, `applyBulkPriceUpdate()`, `findByBarcode()` |
| `src/renderer/services/bill.service.ts` | Updated stock-deduction block to also call `recordUsageFromBill()` unconditionally for matched items |
| `src/renderer/pages/Inventory/index.tsx` | Full rewrite — barcode column, bulk select checkboxes, scanner hook, history button, `ItemDetailPanel` integration, `BulkPriceUpdateModal` integration |
| `src/renderer/pages/Inventory/PriceHistoryPanel.tsx` | New |
| `src/renderer/pages/Inventory/UsageHistoryPanel.tsx` | New |
| `src/renderer/pages/Inventory/ItemDetailPanel.tsx` | New |
| `src/renderer/pages/Inventory/BulkPriceUpdateModal.tsx` | New |
| `src/main/db/migrations/002_inventory_phase9b_a.ts` | New — price history table, usage history table, barcode column + index |

## Decisions Made
- **Price history is always recorded** — even for single-character edits. Matches the spirit of bill edit versioning (Hard Spec #10).
- **Usage history fires unconditionally** — not gated on stock deduction setting. Stock deduction is about adjusting qty; usage history is a separate concern.
- **Scanner detection threshold: 50ms** — hardware scanners typically emit 10-40ms between chars; human typists rarely exceed 100ms. 50ms is a safe boundary.
- **Preview is stateless** — `previewBulkPriceUpdate` does not modify any state, making the preview step risk-free.
- **Bulk update requires explicit checkbox confirmation** — prevents accidental application.
- **ItemDetailPanel opens as a right-side panel** (not a modal) — keeps the table visible for context while reviewing history.

## Known Issues / Handoff State
- Usage history requires a bill save with matching item names. Items added to bills before Phase 9b-A was deployed will have no history (expected behaviour).
- In dev/browser mode, all data is in localStorage. In production Electron, the IPC layer needs to wire up `recordUsageFromBill` and `getPriceHistory` / `getUsageHistory` to the SQLite tables added in migration 002.
- Custom price column history labels are resolved at write time (snapshotted). If a custom column is later renamed, old history entries retain the original label — this is intentional for audit accuracy.
- Barcode scanner detection may not trigger if the user types very fast manually. This is acceptable — the search field still filters by barcode text when typed normally.
