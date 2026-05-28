# Phase 8b-i — Done

## What Was Built

### 1. Internal Notes Per Customer
- **Field:** `internalNotes` (TEXT) — already in DB schema from Phase 8a
- **UI:** Added `textarea` field to `CustomerFormModal.tsx` in a new "Internal Notes" section
- **Privacy guarantees:**
  - Labelled `🔒 Private · never shown on any bill, PDF, or print`
  - Field is never passed to PDF service, print output, or bill templates — it exists solely in the customer record and the internal ledger modal
  - Auto-creates from bill save (Hard Spec #4) only if bill has a `internalNotes` field — not shown on PDF (existing guarantee from Phase 4a-ii-A)
- **Indicator:** A faint `🔒` icon appears in the Party Name cell of the customer table when the customer has internal notes — hover shows the note text as a tooltip

### 2. Customer Since Date
- **Field:** `customerSinceDate` (TEXT ISO date) — already in DB schema from Phase 8a
- **Auto-recording:** `ensureCustomerExists()` in `customer.service.ts` now receives `billDate` from both `saveBill()` and `editBill()` in `bill.service.ts`
  - On first bill: sets `customer_since` to the bill date
  - On subsequent bills: if the new bill is backdated earlier than the stored `customer_since`, updates to the earlier date (handles migrated data / backdated entries correctly)
- **Editable manually:** `CustomerFormModal.tsx` has a date input for `customerSinceDate` with the label "Customer Since (auto-set from first bill · editable)"
- **Display:** Customer table Party Name cell shows "Since [Mon YYYY]" in tiny muted text below the name when set

### 3. Full Running Dr/Cr Ledger Per Customer

#### New Component: `CustomerLedgerModal.tsx`
- Full-screen modal (720px wide, 90vh tall)
- **Header:** Customer name, phone, "Customer since" date, group
- **Summary row:** Total Bills | Total Dr (Billed) | Total Cr (Paid) | Outstanding Balance
- **Internal notes panel:** If customer has internal notes, shown in a private panel within the ledger (purple tint, 🔒 label)
- **Table:**
  - Opening balance row (₹0)
  - One row per non-cancelled bill sorted oldest→newest
  - Columns: Date | Bill No. | Status | Dr (Billed) | Cr (Paid) | Running Balance
  - Running balance is cumulative (Dr − Cr)
  - Phase 8b-ii note: Paid bills show full Cr; Partial/Unpaid show Cr = 0 until payment recorder is built
  - Closing balance sticky footer with totals
- **Empty state:** Clear message when no bills exist

#### Access Point 1: Customer Details Page
- Hover any customer row → 📒 button appears alongside ✏ and 🗑 buttons
- Click opens `CustomerLedgerModal` with that customer's bills filtered from the cached `allBillsRef`

#### Access Point 2: History → Outstanding Ledger View
- `OutstandingLedgerView` now has an optional `onViewCustomerLedger` prop
- Each customer row in the outstanding view has a "📒 View Ledger" button
- Clicking opens `CustomerLedgerModal` overlaid above the outstanding view
- Customer record metadata (internalNotes, customerSinceDate) populated via `getCustomerByName()` — customers are loaded alongside bills in the History page's `loadBills()` call

## Files Changed

| File | Change |
|---|---|
| `src/renderer/services/customer.service.ts` | `ensureCustomerExists` now accepts `billDate`; auto-sets `customer_since` on first bill; updates if backdated bill is earlier |
| `src/renderer/services/bill.service.ts` | Both `saveBill()` and `editBill()` pass `billDate` to `ensureCustomerExists` |
| `src/renderer/pages/CustomerDetails/CustomerFormModal.tsx` | Added `customerSinceDate` date field + `internalNotes` textarea |
| `src/renderer/pages/CustomerDetails/CustomerLedgerModal.tsx` | **New file** — full running Dr/Cr ledger modal |
| `src/renderer/pages/CustomerDetails/index.tsx` | Added `CustomerLedgerModal` import; `ledgerTarget` state; `openLedger()` handler; 📒 button per row; customer since + 🔒 indicator in party name cell; bills stored in `allBillsRef` |
| `src/renderer/pages/History/OutstandingLedgerView.tsx` | Added `onViewCustomerLedger` prop; "📒 View Ledger" button per customer row; updated Phase 8b note banner |
| `src/renderer/pages/History/index.tsx` | Added `CustomerLedgerModal` + customer service imports; `customerLedger` state; wired `onViewCustomerLedger`; `loadCustomers()` called alongside `getBills()` |

## Architecture Decisions

- **Bill filtering for ledger:** Bills are filtered client-side by party name (case-insensitive) — same approach used throughout the app. No new DB query needed.
- **Customer record in History:** `getCustomerByName()` returns the in-memory cached record after `loadCustomers()` runs. If the cache is empty (edge case), a minimal fallback record is constructed from bill data.
- **Backdating customer_since:** When a bill is edited with an earlier date, `ensureCustomerExists` now compares dates and sets `customer_since` to the earlier value. This handles migration scenarios correctly.
- **Cr column in Phase 8b-i:** For bills marked `paid`, we approximate Cr = full grand total (same logic as Phase 7b ledger service). For `partial`/`unpaid`, Cr = 0. Phase 8b-ii payment recorder will populate exact Cr amounts per payment entry.

## Known Issues / Handoff State

- Cr column shows 0 for `partial` bills until Phase 8b-ii payment recorder is built — a banner note is shown in the ledger modal
- The running balance for partial payments is therefore overstated until 8b-ii
- No print/export of the per-customer ledger yet — that can be added in Phase 8b-ii or later

## Test Checklist

- [ ] Add internal note to a customer → note visible in form and ledger modal
- [ ] Open customer's PDF bill → internal note is NOT present anywhere on the PDF
- [ ] Save a bill for a new customer → customer_since auto-sets to bill date
- [ ] Save a backdated bill for an existing customer → customer_since updates if earlier
- [ ] Manually edit customer since date → saves correctly
- [ ] Customer Details: hover a row → 📒 button appears → click → ledger opens with correct bills
- [ ] Customer with internal notes → 🔒 icon visible in table row
- [ ] Customer with `customerSinceDate` → "Since [Month Year]" shown in table row
- [ ] History → Outstanding → click "📒 View Ledger" → correct ledger opens
- [ ] Ledger: bills shown oldest→newest; running balance accumulates correctly
- [ ] Ledger: paid bills show Cr = full amount; unpaid/partial show Cr = 0
- [ ] Ledger: closing balance row shows correct totals
- [ ] Ledger: internal notes panel visible only when notes exist
- [ ] Ledger: empty state shown when customer has no bills
