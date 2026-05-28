# Phase 3a-B — Dashboard DB-Reading Widgets

**Completed:** Phase 3a-B
**Session goal:** Wire all DB-reading dashboard widgets.

---

## What Was Built

### New Files

| File | Purpose |
|---|---|
| `src/renderer/services/dashboard.service.ts` | All DB queries for dashboard widgets — zero SQL in components |
| `src/renderer/pages/Dashboard/BillCountWidget.tsx` | `TodayBillCountWidget` + `TotalBillsWidget` + shared `StatCard` |
| `src/renderer/pages/Dashboard/RevenueWidgets.tsx` | `TodayRevenueWidget`, `MonthComparisonWidget`, `TopCustomerWidget` |
| `src/renderer/pages/Dashboard/AlertWidgets.tsx` | `PendingDraftIndicator`, `LowStockAlertWidget` |

### Modified Files

| File | Change |
|---|---|
| `src/renderer/pages/Dashboard/index.tsx` | Replaced all `ComingSoonWidget` stubs with real widgets for 3a-B scope; kept 3b-i stubs |
| `src/renderer/services/index.ts` | Added `export * from './dashboard.service'` |

---

## Widget-by-Widget Summary

### TodayBillCountWidget
- SQL: `COUNT(*) FROM bills WHERE bill_date = TODAY AND deleted_at IS NULL AND draft = 0`
- Refreshes every 60s
- Controlled by `widgetVisibility.todayBillCount`

### TotalBillsWidget
- SQL: `COUNT(*) FROM bills WHERE deleted_at IS NULL AND draft = 0`
- Refreshes every 60s
- Controlled by `widgetVisibility.totalBills`

### TodayRevenueWidget
- SQL: `SUM(grand_total) FROM bills WHERE bill_date = TODAY ...`
- Shows compact INR format (₹12.5K, ₹1.2L) with full amount as sublabel
- Controlled by `widgetVisibility.todayRevenue`

### MonthComparisonWidget
- Two SQL queries: this month SUM + last month SUM
- Shows delta % badge (green ▲ / red ▼)
- Controlled by `widgetVisibility.monthComparison`

### TopCustomerWidget
- SQL: GROUP BY party_name, SUM(grand_total) DESC LIMIT 1 for current month
- Shows customer name, total billed, bill count
- Hides gracefully when no bills exist this month
- Controlled by `widgetVisibility.topCustomer`

### PendingDraftIndicator
- Reads via `window.cqikly.crashRecovery.hasDraft()` IPC — not SQL
- Checks every 30s
- Shows animated amber pulse dot
- Restore button: logs intent (full restore wired Phase 5+ when New Quote page is built)
- Discard button: calls `crashRecovery.clearDraft()` and hides
- Self-hides when no draft exists
- Controlled by `widgetVisibility.pendingDraftIndicator`

### LowStockAlertWidget
- SQL: `WHERE min_stock IS NOT NULL AND stock_qty < min_stock AND deleted_at IS NULL`
- Shows first 3 items, expandable to full list
- Self-hides completely when no low-stock items (silent green state)
- Shows qty / threshold for each item
- Refreshes every 2 min
- Controlled by `widgetVisibility.lowStockAlert`

---

## Dashboard Service (`dashboard.service.ts`)

All queries isolated here. Zero SQL in widget components. Consistent error handling — all methods return safe defaults (0, null, [], false) on any DB error or missing IPC bridge (dev browser mode).

Helper functions:
- `formatINR(amount)` — compact Indian Rupee format (₹5K, ₹1.2L)
- `formatINRFull(amount)` — full Intl.NumberFormat INR for tooltips

---

## Architecture Decisions

- **Self-hiding alert widgets** — `PendingDraftIndicator` and `LowStockAlertWidget` return `null` when there's nothing to alert about. This avoids an empty row on the dashboard.
- **StatCard shared component** — exported from `BillCountWidget.tsx` for reuse across any stat-style card.
- **60s refresh for billing stats** — fast enough to feel live; not so frequent as to hammer SQLite.
- **30s draft check** — slightly faster than billing stats because draft status is more urgent.
- **`draft = 0` filter** — all bill queries exclude in-progress drafts so they don't inflate the count.

---

## Known Issues / TODOs

- `[DRAFT-RESTORE]` in `AlertWidgets.tsx` — Restore Draft button click is a stub. Full navigation to New Quote with draft pre-loaded is implemented in Phase 5+ when the New Quote page is built.
- `formatINR` uses simple thresholds (1000 → K, 100,000 → L). A full Indian number formatting util will be centralized in Phase 5 or Phase 9.

---

## Handoff State

All Phase 3a-B widgets are complete and wired:
- ✅ Today's Bill Count
- ✅ Total Bills
- ✅ Today's Total Revenue
- ✅ This Month vs Last Month Revenue
- ✅ Top Customer This Month
- ✅ Pending Draft Bills Indicator (reads crash recovery IPC)
- ✅ Low Stock Alert Indicator (reads inventory thresholds from DB)

All widgets individually show/hide from Settings via `widgetVisibility` in ConfigContext.

Phase 3b-i stubs remain in place (weather, crypto, forex, converters) — still tagged as `ComingSoonWidget`.

**Next session:** Phase 3b-i — Weather, Crypto Markets, Forex Rates, Unit Converter, Currency Converter widgets (all API-powered, all toggleable from Settings, all respect Lite performance mode).
