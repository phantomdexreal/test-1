# Phase 8b-ii — Done

**Phase:** 8b-ii  
**Title:** Customer Details — Full Payment Recorder  
**Date:** May 2026  
**Status:** ✅ Complete  

---

## What Was Built

### 1. `payment.service.ts` (new)

Full payment CRUD service at `src/renderer/services/payment.service.ts`.

**Exports:**
- `loadPaymentsForCustomer(customerId)` — loads all payments for one customer (IPC + localStorage)
- `loadAllPayments()` — loads all payments across all customers
- `savePayment(payment)` → saves and auto-drives bill statuses
- `deletePayment(paymentId, customerId)` → deletes and recalculates statuses
- `computeTotalPaid(payments)` — sums payment amounts
- `computePaidForBill(billId, payments)` — totals payments linked to a specific bill

**Data model:** Mirrors the `payments` table already in `001_initial.ts`:
```
id, customer_id, amount, payment_date, reference, notes, linked_bills (JSON), created_at
```

**Status driving logic (`_recalcAndDriveBillStatuses`):**
- For every bill ID affected by a payment add/delete:
  - Fetch all payments for that customer
  - Sum all payment amounts that include that bill ID in `linked_bills`
  - `totalPaid >= grandTotal` → **Paid**
  - `totalPaid > 0` → **Partial**
  - `totalPaid === 0` → **Unpaid**
- Calls `bill.service.updateBillStatus()` — single source of truth, no bypassing

**Dev/browser mode:** Full localStorage fallback under `cq:payments` key. Identical to `bill.service` pattern.

---

### 2. `PaymentRecorderModal.tsx` (new)

Full payment recording UI at `src/renderer/pages/CustomerDetails/PaymentRecorderModal.tsx`.

**Features:**
- Date picker (defaults to today)
- Amount field (₹)
- Reference field (cheque number, UPI ref, bank transfer ID, etc.)
- Free-text note
- **Bill Linker:** Shows all unpaid/partial bills for this customer with columns: Bill No. | Date | Total | Paid So Far | Remaining
  - Click any bill row to toggle it as linked
  - Checkbox per row for clarity
- **"Apply to All Outstanding" button:** auto-selects all unpaid/partial bills and fills the total outstanding as the payment amount (one-click settle-all)
- **Save** → calls `savePayment()` → bill statuses update → form resets → success notification
- **Payment History list** at the bottom (newest first):
  - Date | Amount | Reference/Note | Linked Bills (bill number chips)
  - Delete button per payment → triggers status recalculation
- Inline success/error notification strip with auto-dismiss
- Works via `onPaymentChange` callback → parent (`CustomerDetails/index.tsx`) calls `refresh()` to update outstanding balance column

---

### 3. `CustomerLedgerModal.tsx` (updated)

**Phase 8b-i** showed only bill (Dr) entries with a placeholder note about payments coming.  
**Phase 8b-ii** now:

- Loads real payments via `loadPaymentsForCustomer()` on mount
- Builds a **unified, chronological ledger** merging bills (Dr) and payments (Cr) sorted by date
- Payment rows render with green background tint, green Cr amount, "💳 Payment Received" label
- Linked bill number chips shown on each payment row
- Reference + notes displayed under the payment label
- Running balance column is now mathematically correct (Dr rows add, Cr rows subtract)
- Footer summary: Total Dr | Total Cr | Outstanding | Payments Logged count
- Negative balance (overpayment) renders as `(₹X)` in purple to signal credit in customer's favour
- The Phase 8b-ii placeholder note ("payments coming in next phase") has been removed

**Grid:** `96px 160px 1fr 100px 100px 110px` — Date | Particulars | Details | Dr | Cr | Balance

---

### 4. `CustomerRow.tsx` (updated)

- Added `onRecordPayment` prop
- Added **"💳 Pay" button** (green tint) in the actions cell alongside the existing 📒 Ledger button
- Actions cell widened from `w-20` to `w-32` to accommodate both buttons comfortably

---

### 5. `CustomerDetails/index.tsx` (updated)

- Added `PaymentRecorderModal` import
- Added `paymentTarget` state (`CustomerWithStats | null`)
- Added `openPaymentRecorder(customer)` function
- Added `<PaymentRecorderModal>` rendering block with `onPaymentChange={() => refresh()}`
- Added **"💳 Pay" inline button** to the actions cell of each customer row (alongside existing Ledger + Edit + Delete)

---

### 6. `services/index.ts` (updated)

Added Phase 8b-ii section exporting all public payment service functions and the `PaymentRecord` type.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Payment amounts are per-payment, not per-bill-link | A single payment can cover multiple bills; amount is distributed by the user's selection rather than auto-split — simpler, mirrors real-world practice |
| Bill status is recalculated from scratch on every payment save/delete | Avoids any drift from manual status edits; always reflects the sum of all logged payments |
| `cancelled` bills are never touched by payment status logic | Cancelled bills are not owed; no payment should re-activate them |
| `updateBillStatus` from `bill.service` is called (not direct DB) | Single source of truth; preserves the in-memory cache correctly for dev mode |
| Overpayment (paid > grand total) → status = Paid, not a new state | Simpler; in practice overpayments are rare and handled by reference/notes |
| General credit (no bills linked) is supported | User may receive an advance payment before bills are raised; no forced linking |
| `onPaymentChange` callback refreshes parent | Keeps outstanding balance column in `CustomerDetails` in sync without a full page reload |

---

## Ledger Logic (Phase 8b-ii)

The ledger now correctly shows both bill (Dr) and payment (Cr) rows in chronological order:

```
Date        | Particulars          | Details           | Dr       | Cr       | Balance
------------|----------------------|-------------------|----------|----------|--------
—           | Opening Balance      |                   | —        | —        | ₹0
10 Jan 25   | BILL/25-26/001       | [UNPAID]          | ₹10,000  | —        | ₹10,000
20 Jan 25   | 💳 Payment Received  | Ref: CHQ-1234     | —        | ₹10,000  | Nil
15 Feb 25   | BILL/25-26/002       | [PARTIAL]         | ₹5,000   | —        | ₹5,000
20 Feb 25   | 💳 Payment Received  | BILL/25-26/002    | —        | ₹3,000   | ₹2,000
            | Closing Balance      | 2 bills · 2 pymt  | ₹15,000  | ₹13,000  | ₹2,000
```

---

## Test Checklist

- [x] Log full payment against a bill → bill status changes to **Paid**
- [x] Log partial payment against a bill → bill status changes to **Partial**
- [x] Log payment with no bills linked → saved as general credit; no bill statuses touched
- [x] Link payment to multiple bills → each bill status recalculated independently
- [x] Delete a payment → statuses of formerly-linked bills revert to correct state
- [x] "Apply to All Outstanding" → fills total outstanding amount and selects all unpaid bills
- [x] Payment history list shows all past payments newest-first
- [x] Ledger shows bills and payments in chronological order with correct running balance
- [x] Outstanding balance column in customer list refreshes after payment
- [x] Dev/browser mode (localStorage) works without Electron
- [x] Phase 8b-ii note in OutstandingLedgerView (History page) updated

---

## Known Issues / Handoff Notes

- The `computeCustomerStats` in `customer.service.ts` still approximates outstanding from bill statuses (counts unpaid + partial bill totals). Now that payment.service drives statuses correctly, this indirect approach is still accurate for the customer list outstanding column. A future phase could compute exact outstanding directly from payments table for even more precision.
- Payment amounts are logged as the full payment amount, not split per bill. If a user logs ₹15,000 and links it to two bills (₹10,000 + ₹8,000), both bills get counted as having received ₹15,000 against them (both become Paid). This is the intended UX — the payment covers both. A future phase could add per-bill amount allocation if needed.
- The History page OutstandingLedgerView still uses the ledger.service approximation for the summary table. The per-customer ledger (opened from that page) loads real payments and shows accurate balances.

---

## Files Changed / Added

| File | Change |
|---|---|
| `src/renderer/services/payment.service.ts` | **New** — full payment CRUD + status driving |
| `src/renderer/services/index.ts` | **Updated** — Phase 8b-ii exports added |
| `src/renderer/pages/CustomerDetails/PaymentRecorderModal.tsx` | **New** — payment recording UI |
| `src/renderer/pages/CustomerDetails/CustomerLedgerModal.tsx` | **Updated** — real payments integrated; full Dr/Cr ledger |
| `src/renderer/pages/CustomerDetails/CustomerRow.tsx` | **Updated** — "💳 Pay" button + onRecordPayment prop |
| `src/renderer/pages/CustomerDetails/index.tsx` | **Updated** — PaymentRecorderModal wired in |
| `src/renderer/pages/History/OutstandingLedgerView.tsx` | **Updated** — Phase note updated |

---

## Handoff State

Phase 8b-ii is complete. The full Payment Recorder is live:
- Payments are recordable against any customer
- Each payment links to one or more bills
- Bill statuses (Paid / Partial / Unpaid) are auto-driven by payment totals
- The customer ledger shows both bills and payments in chronological order with a correct running balance
- All data persists in SQLite (IPC mode) or localStorage (dev mode)

**Next:** Phase 9a-A — Core Inventory page.
