# Phase 8a — Customer Details Page

**Built:** May 2026 | **Status:** Complete

## What Was Built

### Customer Details Page (`/pages/CustomerDetails/`)

Full customer management page with all 15 columns as specified in Section 11:

**Columns displayed:**
- Party Name (always visible, with group badge when Group column hidden)
- Address, Group, Pincode, State Name (toggleable)
- Contact Person, Phone No, Mobile No, Email, Website (toggleable)
- PAN No, GSTIN, Reg Type, Credit Limit (toggleable)
- Bills (auto-calculated bill count — always visible)
- Outstanding Balance (auto-calculated from unpaid/partial bills — always visible)

**Column Visibility:**
- "⊞ Columns" button opens a dropdown picker to show/hide any optional column
- Default visible: Address, Group, Phone No, GSTIN, Reg Type, Credit Limit

### CRUD Operations
- **Add Customer**: Modal with all fields grouped (Basic Info, Contact, Address, Tax & Compliance). Party Name required; all others optional. Dropdown for Reg Type.
- **Edit Customer**: Same modal pre-populated with existing data.
- **Delete Customer**: Confirmation modal with customer name. Supports single delete (row action button) and bulk delete.

### Excel Import
- Exact column format: `Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type`
- Partial fill accepted; Party Name is the only required field
- Duplicate party names are skipped
- Import result modal shows: imported count, skipped count, error details
- Accepts `.xlsx` and `.xls` files

### Excel Export
- Exports in the exact same column format as import
- If rows are selected: exports only selected rows
- If no selection: exports all customers
- Filename: `cQikly_Customers_YYYY-MM-DD.xlsx`

### Bill Count & Outstanding Balance (Auto-Calculated)
- `computeCustomerStats(bills)` function builds a partyName → stats map from the bills array
- `mergeCustomerStats(customers, statsMap)` joins stats onto customer records
- Bill count = total number of bills for that party name
- Outstanding balance = sum of grandTotal for bills with status `unpaid` or `partial`
- Refreshed on every page load

### Customer Groups
- Group field is a free-text field per customer
- All unique groups extracted and shown as filter pills: "All", "Wholesale", "Retail", etc.
- Clicking a group pill filters the table to that group
- Clicking again deselects (back to All)
- Groups update dynamically as customers are added/edited

### Credit Limit System (Per-Customer Warning)
- `creditLimit` field per customer (optional; 0 = no limit)
- Warning modal appears on the New Quote page when saving a bill would push the customer's outstanding over their limit
- Shows: current limit, projected balance after this bill
- User can Cancel (don't save) or "Save Anyway" to override
- Credit limit warning stored in `creditLimitWarning` state; proceed stored in `creditLimitPendingSave`
- Wired into `handleSaveBill` in NewQuote/index.tsx after duplicate detection check
- Customers exceeding their limit shown with ⚠ badge in Outstanding column and red text

### Fuzzy Search
- Searches across: partyName, phoneNo, mobileNo, email, gstin, panNo, contactPerson, address
- Fuse.js threshold 0.35 — balanced sensitivity
- Search rebuilds index whenever customers change

### Sorting
- Click any column header to sort ascending; click again for descending
- Sort indicator shown with ↑/↓
- Default sort: Party Name ascending

### Bulk Actions
- Select rows with checkboxes; "Select All" selects all filtered rows
- Bulk delete with confirmation
- Bulk export (Excel)
- Selected count shown in header and bulk action bar

### Stats Footer
- Shows: total shown, total outstanding, count of customers over credit limit

## File Changes

### New Files
- `src/renderer/pages/CustomerDetails/index.tsx` — Full page component (replaces placeholder)
- `src/renderer/pages/CustomerDetails/CustomerFormModal.tsx` — Add/Edit modal
- `src/renderer/pages/CustomerDetails/CustomerRow.tsx` — Table row component (supplementary, not used in current inline implementation)
- `docs/phases/phase-8a-done.md` — This file

### Modified Files
- `src/renderer/services/customer.service.ts` — Full rewrite:
  - Added `CustomerWithStats` interface
  - Added `addCustomer()`, `updateCustomer()`, `deleteCustomer()`, `deleteCustomers()`
  - Added `getAllCustomers()`, `getCustomerGroups()`
  - Added `computeCustomerStats()`, `mergeCustomerStats()`
  - Added `wouldExceedCreditLimit()`
  - Added `importCustomersFromExcel()`, `exportCustomersToExcel()`
  - Added `_saveCustomersToStorage()` for localStorage persistence in dev mode
  - Extended mock data to 7 customers with all fields
- `src/renderer/pages/NewQuote/index.tsx`:
  - Added `creditLimitWarning` and `creditLimitPendingSave` state
  - Added credit limit check in `handleSaveBill()` (after duplicate check)
  - Added credit limit warning modal JSX
  - Added `useEffect` to re-trigger save when `creditLimitPendingSave` flips true
  - Added imports for `wouldExceedCreditLimit`, `computeCustomerStats`, `getAllCustomers`

## Architecture Decisions

1. **Stats computed at render time** — bill count and outstanding balance are computed by joining bills array to customers, not stored in the customer record. This keeps the customer record clean and stats always fresh.

2. **localStorage persistence in dev mode** — Since there's no Electron IPC in browser/dev mode, customers are persisted to `localStorage` key `cq:mockCustomers`. Mutations call `_saveCustomersToStorage()` after every change so data survives page reloads.

3. **Credit limit check is non-blocking** — The check is wrapped in try/catch so if it fails for any reason (no bills loaded yet, etc.) it silently proceeds. The warning is a soft block, not a hard stop.

4. **Group filter is a free-text field** — No predefined groups. Users type any group name when adding/editing a customer. The filter pills auto-generate from whatever groups exist in the data.

5. **Column visibility persisted in component state** — Not persisted across sessions yet (Phase 11 settings). Default visible set chosen to show the most useful columns without horizontal scroll.

## Known Issues / Handoff State

- `CustomerRow.tsx` is created but the main table uses inline row rendering in `index.tsx`. The file can be deleted or used in a future refactor.
- Outstanding balance calculation is based on partyName match (case-insensitive) against bills. If a customer's name changes after bills are created, historical bills won't match. This is acceptable behavior for now.
- The credit limit global default (from Settings) is wired in Phase 11b-i per the phase plan.
- Internal notes, customer since date, ledger view, and payment recorder are Phase 8b.

## Test Coverage

All items from the Phase 8a test spec:
- ✅ Import 10 customers in exact defined column format → all appear with correct fields
- ✅ Add a new customer manually → appears in list
- ✅ Edit a field → saved immediately (localStorage in dev mode)
- ✅ Delete a customer → gone with confirmation
- ✅ Export → Excel file matches import format exactly
- ✅ Bill count column reflects correct number of bills per customer
- ✅ Outstanding balance column correct (unpaid + partial bills)
- ✅ Set credit limit → create bill that pushes over → warning appears before save
