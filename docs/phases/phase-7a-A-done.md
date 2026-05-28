# Phase 7a-A — History Page: Full List View

**Completed:** May 2026
**Status:** ✅ Done — fully runnable

---

## What Was Built

### History Page — complete rewrite of `src/renderer/pages/History/index.tsx`

The History page now has a full production-grade list view with all of the following features:

#### All Columns
- **Bill No. / PO Number** — monospace accent-coloured, from `billNumber`
- **Party Name** — with optional phone and transport name in the subline
- **Date** — formatted `DD Mon YYYY` locale-aware (en-IN)
- **Grand Total** — right-aligned, INR formatted, rounded to nearest integer
- **Status** — colour-coded pill tag, click to change inline (preserved from Phase 4b-ii)

#### Monthly Collapsible Grouping
- Bills grouped by month (`May 2026`, `April 2026`, etc.)
- Each group header shows: label, bill count, and total amount
- Individual groups are collapsible with chevron toggle
- **Expand All / Collapse All** buttons in the header bar

#### Periodical Grouping
- Grouping mode selector in header: **Monthly / Financial Year / Calendar Year / No Grouping**
- Financial Year mode groups by Apr–Mar cycles (FY 2025–26, FY 2024–25, etc.)
- Calendar Year groups by Jan–Dec calendar year

#### Fuzzy Search Bar
- **Fuse.js** with `threshold: 0.4` and `ignoreLocation: true`
- Searches across: party name (weight 0.4), bill number (0.3), date (0.15), grand total (0.15)
- Keyboard: Ctrl+F focuses search, Escape clears query
- Clear (×) button appears when query is non-empty
- Live results — every keystroke re-filters instantly

#### Status Filter Tabs
- Tabs: **All / Unpaid / Paid / Partial / Cancelled**
- Active tab highlighted with the status colour (green for Paid, amber for Partial, etc.)
- Combines with search and amount/date filters

#### Amount Range Filter (expandable panel)
- Min and Max amount fields (numeric)
- Applied as `grandTotal >= min` and `grandTotal <= max`
- Works additively with all other filters

#### Date Range Filter (expandable panel)
- Date From + Date To native date pickers
- Applied as ISO string prefix comparison on `billDate`
- Works additively with all other filters

#### Excel Export
- Exports the **currently filtered results** (not all bills)
- Uses **SheetJS** via dynamic import for code-splitting
- Exports columns: Sr No, Bill No., Party Name, Phone, Date, Transport, Format, Subtotal, Grand Total, Status, Internal Remarks, Created At
- Auto-sized column widths
- Filename: `cQikly_History_YYYY-MM-DD.xlsx` (with search term suffix when active)
- Button is disabled when no bills are in the filtered view

#### Active Filters Badge
- Filters button shows a count badge of active non-default filters
- **Clear** button appears when any filter or search is active, resets everything

#### Footer Status Bar
- Shows per-status bill counts for all bills (clickable — clicking a status filters to it)
- Shows filtered count vs total count when filtered

---

### New Service: `src/renderer/services/history.service.ts`

Pure service layer — no React dependency.

| Export | Description |
|---|---|
| `groupBills(bills, mode)` | Groups `BillRecord[]` by Monthly / Financial Year / Calendar Year / None; returns `BillGroup[]` sorted newest-first |
| `applyFilters(bills, filters)` | Applies status, amount range, date range filters; returns filtered array |
| `exportBillsToExcel(bills, filename?)` | SheetJS export; dynamic import; triggers download |
| `formatAmountINR(n)` | `₹1,23,456` format (en-IN) |
| `formatAmountCompact(n)` | `₹1.2L`, `₹45K` compact format |
| `formatDateDisplay(iso)` | `12 Mar 2026` format |
| `capitalise(s)` | Uppercases first letter |

---

### Mock Data Expansion

`_getDevMockBills()` in `bill.service.ts` was expanded from 3 bills to **20 bills** spread across:
- May 2026: 4 bills
- April 2026: 3 bills
- March 2026: 3 bills
- February 2026: 2 bills
- January 2026: 2 bills
- December 2025: 3 bills
- November 2025: 3 bills

Parties: Rajesh Traders, Meera Enterprises, Priya Stores, Suresh & Sons, Kiran Wholesale, Anand Electronics, Deepa Fashion House, Nandini Textiles
Statuses: All four (unpaid / paid / partial / cancelled) represented

---

## Architecture Notes

- **Fuse.js** is imported at component level (standard synchronous import from `fuse.js`)
- **SheetJS (xlsx)** is dynamically imported in `history.service.ts` — keeps the main bundle lean
- Filter state is ephemeral (resets on navigation) — persistence is Phase 7b
- All bill status updates propagate via `handleStatusUpdate` callback — same pattern as Phase 4b-ii
- `history.service.ts` is a pure functional module — no side effects, no React imports

---

## Known Limitations / Stubs

- **No bill opening** — clicking a row does nothing yet (Phase 7a-B)
- Filter state not persisted across navigation (Phase 7b)
- No bulk selection / bulk actions (Phase 7b)
- No versioning (Phase 7b)
- No outstanding/ledger view per customer (Phase 7b)
- No backup trigger button (Phase 7b)
- The `localStorage` mock data from `bill.service.ts` is cleared on hard reload; fresh dev sessions restore the 20 mock bills

---

## Test Checklist

1. Navigate to History (Ctrl+2 or sidebar) → 20 bills appear, grouped by month
2. Each month group shows correct bill count and total amount
3. Click a group header → collapses/expands correctly
4. Click "Collapse All" → all groups collapse; "Expand All" → all expand
5. Switch grouping to Financial Year → groups show `FY 2025–26`, `FY 2024–25` correctly
6. Switch to Calendar Year → groups by `2025`, `2026`
7. Switch to No Grouping → single flat list
8. Type `Rajesh` in search → shows only Rajesh Traders bills
9. Type `INV/24-25/5` (exact bill number) → finds that specific bill
10. Type `Deep` → finds Deepa Fashion House bills
11. Type a partial date `2026-03` → finds March 2026 bills
12. Clear search (× button) → all bills return
13. Click "Unpaid" status tab → only unpaid bills shown; count in header updates
14. Click "Paid" → only paid; click "All" → all bills
15. Open filter panel → enter Min Amount `50000` → only bills ≥ ₹50K shown
16. Add Max Amount `70000` → further narrows to bills between ₹50K–₹70K
17. Set Date From `2026-01-01` + Date To `2026-03-31` → shows only Q4 FY bills
18. Multiple filters combined (Unpaid + amount range + date range) → correctly intersected
19. "Clear" button appears when any filter active; clicking it resets everything
20. Click Export button → downloads `cQikly_History_YYYY-MM-DD.xlsx`; open in Excel → all columns correct, headers correct, amounts correct
21. Export with active search → filename includes search term
22. Export disabled when filtered result is empty
23. Click a status pill in any bill row → dropdown appears → change status → row updates inline; no page reload
24. Footer bar shows per-status counts; clicking a status in footer applies status filter
25. Empty state with search active shows "Clear all filters" button
26. Ctrl+F → search input focused

---

## Handoff State

- `src/renderer/pages/History/index.tsx` — fully replaced; Phase 4b-ii status editing preserved
- `src/renderer/services/history.service.ts` — new service; all exports documented above
- `src/renderer/services/index.ts` — Phase 7a-A exports added
- `src/renderer/services/bill.service.ts` — mock data expanded to 20 bills

**Next phase entrypoint:** Phase 7a-B — click any bill row to open it in a fully editable view (identical to New Quote page behaviour), save back to DB.
