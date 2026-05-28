# Phase 9b-B-ii — Done

## What Was Built

### Inventory Mode on Quote Page (9b-B-ii-A — previously complete)
- Fuzzy autocomplete dropdown in Item Name cell when inventory mode is ON
- Insert key accepts autocomplete → fills item name + fills rate per active format
- Rate source independently configurable per format (Free / GST) in Settings
- Item image shown in suggestion card if set; no broken placeholder if unset
- After insert, user can continue typing freely — no cell lock

### Excel Export (NEW — 9b-B-ii-B)
- Full inventory exported to `.xlsx` via SheetJS (`xlsx` package already in `package.json`)
- **Column order:** Item Name · Category · Sub-Category · Price · Wholesale Price · GST Price · Credit · *[custom price cols…]* · GST Rate · Stock Qty · Low Stock Threshold · Unit · Barcode / SKU
- Second sheet "Column Guide" included automatically describing every column and whether it's required
- Electron mode: uses `window.cqikly.dialog.saveFile` + `writeFile` IPC → shows native save dialog
- Dev/browser mode: triggers `<a download>` click → browser download
- Filename: `cQikly_Inventory_YYYY-MM-DD.xlsx`

### Excel Import (NEW — 9b-B-ii-B)
- Import from `.xlsx`, `.xls`, `.ods`, or `.csv` (SheetJS supports all)
- **Item Name is the only required column.** All other columns are optional; partial fill accepted.
- Unrecognised column headers are ignored silently
- Custom price column headers in the spreadsheet:
  - Match (case-insensitive) to an existing custom column → values merged into that column
  - No match → a new custom column is created on the fly; user is informed in the result summary
- Rows with no Item Name are silently skipped (counted as `skipped`)
- Import creates new items — no upsert (deduplication is user responsibility; documented in modal)
- Import result summary: count of imported rows, skipped rows, new custom columns created, any row-level errors

### UI — Inventory Excel Panel
- Single modal with two tabs: **Export** and **Import**
- Accessible via the **Excel** button (📥📤) added to the Inventory toolbar next to "Custom Column"
- Export tab: shows item count, one-click export, success/error feedback
- Import tab: drag-and-drop zone + click-to-browse; file selected → preview filename + size + confirm; result badge summary
- All states handled: idle → selecting/exporting → loading → done/error; full error display with per-row warnings

## Files Added / Changed

| File | Change |
|---|---|
| `src/renderer/services/inventory.service.ts` | Added `exportToExcel()` and `importFromExcel(file)` async methods |
| `src/renderer/pages/Inventory/InventoryExcelPanel.tsx` | New component — Export + Import modal |
| `src/renderer/pages/Inventory/index.tsx` | Import of `InventoryExcelPanel`, `FileDown`, `FileUp`; `showExcelPanel` state; Excel toolbar button; modal mounted in JSX |

## Decisions Made

1. **No upsert on import** — import always creates new items. Rationale: this is a migration/bulk-add tool; the user should audit duplicates themselves. Stated clearly in the confirm step UI.
2. **Custom column auto-creation on import** — if a spreadsheet has a column header that doesn't match any standard column and doesn't match any existing custom column, a new custom column is created silently and reported in the result. This makes the round-trip (export → edit → import) lossless even after custom column additions.
3. **Same file format for import and export** — the export column order exactly matches what import expects, so the export can be used as a template for bulk data entry.
4. **Dev mode download** — in browser/dev mode with no `window.cqikly`, export triggers a browser download. Zero dependency on Electron IPC in dev.
5. **SheetJS dynamic import** — `import('xlsx')` is done lazily inside the service methods to keep it out of the initial bundle; no change to build config required.

## Known Issues / Limitations

- ODS and CSV import is supported by SheetJS but only the first sheet/column is read.
- Image paths are not exported or imported (images are device-local AppData files; not portable via Excel).
- Stock deduction history is not included in export (only current stock qty is exported).
- Very large inventories (5000+ items) may show a brief UI freeze during SheetJS workbook build — acceptable for the target use case.

## Handoff State

Phase 9b-B-ii is complete. All deliverables from the masterplan are met:
- Inventory mode on quote page fully wired (autocomplete + Insert key + rate source per format + item image) — done in 9b-B-ii-A
- Excel import working (partial fill, Item Name only required, custom columns auto-created)
- Excel export working (full inventory, same column format as import)

Ready for **Phase 10**: Loose Inventory History page.
