# Phase 10 — Done

## What Was Built

### Loose Inventory History Page (Page 5, Ctrl+5)

Fully replaces the Phase 9b placeholder with a complete, production-grade page.

---

## Features Delivered

### 1. Loose Inventory Service (`services/looseInventory.service.ts`)
- **`getAllLooseEntries()`** — Derives all loose item rows by scanning the full bills store and excluding items that match any inventory item name (case-insensitive). Returns every row sorted newest-first.
- **`getLooseItemAnalytics()`** — Groups entries by item key; computes per-item analytics: total occurrences, total qty, total amount, min/max/avg rate, unique parties, first/last seen dates, price timeline.
- **`getLoosePartyNames()`** — All unique parties from loose entries, for the filter dropdown.
- **`applyFilters()`** — Filters the flat entry list by: item name (substring), party (exact), date range (from/to), amount range (min/max).
- **`applyAnalyticsFilters()`** — Same filters applied to the analytics aggregated view.
- **`formatINR()`** — Indian rupee formatter (₹ with `en-IN` locale).

### 2. Loose Inventory History Page (`pages/LooseInventoryHistory/index.tsx`)

#### Header & Summary
- Page header with icon and description.
- Three summary stat cards: Unique Loose Items, Total Value Billed, Bills Containing Loose Items.
- Re-derives automatically on any bill or inventory change (via eventBus subscriptions).

#### Filter Bar
- Item name text search (substring, case-insensitive).
- Party dropdown (populated from actual data).
- Date range pickers (From Date / To Date).
- Amount range inputs (Min / Max ₹).
- Clear button (appears only when any filter is active).
- Live result count.

#### Tab 1 — History (flat list)
- Full table: Date, Item Name, Party, Qty, Rate (₹), Amount (₹), Bill No, Analytics button.
- Every item name is a clickable link — jumps directly to Analytics detail for that item.
- Alternating row shading for readability.
- Empty state with helpful message.

#### Tab 2 — Analytics (card grid)
- One card per unique loose item, sorted by total value descending.
- Each card shows: item name, occurrence count badge, total amount, rate range, avg rate, party count, party name pills (first 3 + overflow count), first/last seen date range.
- Click a card → drills into the item detail view.

#### Analytics Detail View (per item)
- Back button returns to analytics list.
- Item name header with first/last seen dates.
- Five stat cards: total occurrences, total amount, total qty, rate range (min–max + avg), unique party count.
- Party filter pills — click any party to filter all sub-tables to that party; "All parties" pill to reset.
- Filtered stats bar (shown when party is filtered): entry count, filtered total, avg rate, qty.
- **Party Breakdown table**: party name, order count, total amount, last used date; rows are clickable to toggle party filter; sorted by total amount desc.
- **Price History table**: date, party, rate (with ▲/▼ delta vs previous entry), bill number; newest first; respects party filter.
- **All Bill Entries table**: full row-level detail — date, party, qty+unit, rate, amount, bill number, format badge (GST/Free); respects party filter + date range filter from the global filter bar.

### 3. EventBus Extensions (`utils/eventBus.ts`)
Added three new typed events:
- `billSaved` — `{ billId, billNumber }` — emitted in `bill.service.saveBill()`
- `billUpdated` — `{ billId }` — emitted in `bill.service.updateBill()`
- `billDeleted` — `{ billId }` — emitted in `bill.service.deleteBill()`
- `inventoryUsageChanged` — already existed in inventory service; now in the event map

The Loose Inventory History page subscribes to all four + `inventoryChanged` and re-derives its entire dataset on any change — fully reactive, zero stale data.

### 4. Bill Service (`services/bill.service.ts`)
- Imported `eventBus`.
- Added `eventBus.emit('billSaved', ...)` after successful save.
- Added `eventBus.emit('billUpdated', ...)` after successful update.
- Added `eventBus.emit('billDeleted', ...)` after successful delete.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Derive, don't store** | Loose items are fully derivable from bills. No separate DB table needed. Re-deriving on every change is fast enough (O(bills × rows)). |
| **Case-insensitive item key** | `itemKey = name.trim().toLowerCase()` — normalises casing variants ("Cotton Fabric" vs "cotton fabric") into one aggregate. Display name uses the most-used casing variant. |
| **Party filter as pills** | Pills are faster than a dropdown for drilling into a specific party inside the item analytics. They double as a visual party list. |
| **Price delta in timeline** | The ▲/▼ diff vs previous entry in the price history table makes price drift immediately visible at a glance. |
| **Global filter + local party filter** | Global filters (item search, party, date, amount) apply to both tabs. Inside the analytics detail, a local party filter narrows sub-tables without losing global context. |

---

## Known Limitations / TODOs

- **Excel export of loose history** — not in Phase 10 spec; can be added in a future phase using SheetJS (pattern already established in Inventory export).
- **"Add to Inventory" shortcut from loose item** — a natural next feature: one-click promote a loose item into the inventory. Not in Phase 10 spec.
- **Rate history delta** is relative to the adjacent row in the filtered/sorted list, not a global previous occurrence. This is intentional — it shows the change between consecutive visible entries.

---

## Handoff State

- All Phase 9b-B-ii code is preserved intact.
- `looseInventory.service.ts` is a pure addition — zero changes to existing services except the three `eventBus.emit()` calls in `bill.service.ts`.
- Page is fully wired via `AppShell.tsx` (no changes needed — it already imported `LooseInventoryHistoryPage`).
- `npm run dev` works without `.exe` compilation.
- No TypeScript errors introduced.
