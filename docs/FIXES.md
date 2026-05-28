# cQikly — DB Wiring Fixes Plan
> **Purpose:** Each section below is one Claude session. Read the MASTERPLAN.md and the relevant phase-done doc before starting. Fix only what is scoped to that session. Leave everything else untouched.
> 
> **Golden rule:** All data must be written to and read from SQLite via `window.cqikly.db.run()` / `window.cqikly.db.query()` (IPC bridge). localStorage is dev/fallback only — it must never be the primary store in Electron mode.
>
> **Before every session:** Read `MASTERPLAN.md` Section 2 (Tech Stack), Section 5 (Architecture), and the relevant service file in full before touching any code.

## Completion Status

| Session | Status | Files Changed |
|---|---|---|
| FIX-1 | ✅ Done | `bill.service.ts`, `migrations/004_fix_bills_extra_cols.ts` |
| FIX-2 | ✅ Done | `bill.service.ts`, `DBContext.tsx` |
| FIX-3 | ✅ Done | `customer.service.ts` |
| FIX-4 | ✅ Done | `inventory.service.ts`, `DBContext.tsx` |
| FIX-5 | ✅ Done | `payment.service.ts`, `DBContext.tsx` |
| FIX-6 | ✅ Done | `DBContext.tsx` |
| FIX-7 | ✅ Done | `onboarding.service.ts` |
| FIX-8a | ✅ Done | `pages/NewQuote/BillingGrid.tsx` |
| FIX-8b | ✅ Done | `pages/History/EditBillView.tsx` |

---

## SESSION FIX-1 ✅ DONE — Bill Save: Fix Column Names in `bill.service.ts`

### The Problem
`saveBill()` and `updateBill()` in `src/renderer/services/bill.service.ts` INSERT/UPDATE using column names that don't exist in the `bills` table. SQLite throws an error, the catch block silently falls back to `savedId = Date.now()`, and the bill is only stored in localStorage — never in SQLite.

**Column name mismatches (service → schema):**

| Service uses | Schema actually has |
|---|---|
| `party_phone` | `phone` |
| `party_address` | `address` |
| `party_gstin` | `gstin` |
| `party_notes` | `po_notes` |
| `format` | `bill_format` |
| `internal_remarks` | `internal_notes` |
| `rows` (JSON blob) | ❌ does not exist — rows go in `bill_rows` table |
| `template_id` | ❌ does not exist in schema |
| `cell_formats` | ❌ does not exist in schema |

### What to Fix

**In `saveBill()`:**
1. Fix the INSERT column names to match the schema exactly.
2. Remove `rows`, `template_id`, and `cell_formats` from the `bills` INSERT — these don't have columns.
3. After the `bills` INSERT succeeds and you have `savedId`, loop over `input.rows` and INSERT each one into `bill_rows` table with correct columns: `bill_id`, `row_index`, `item_name`, `qty`, `qty_unit`, `rate`, `discount`, `discount_type`, `amount`, `gst_percent`, `gst_amount`, `pre_tax`, `custom_cells` (JSON), `marked`.
4. Keep `custom_columns` and `adjustments` as JSON blobs in `bills` — those columns do exist.
5. `cellFormats` and `templateId` should be stored as JSON in `internal_notes` is already used — add a new column via migration OR store `cell_formats` JSON into `custom_columns` field if unused, OR skip for now and add a migration (see note below).

> **Simplest path for `cell_formats` and `template_id`:** Add a migration `004_fix_bills_extra_cols.ts` that does:
> ```sql
> ALTER TABLE bills ADD COLUMN cell_formats TEXT DEFAULT '{}';
> ALTER TABLE bills ADD COLUMN template_id INTEGER;
> ```
> Then include them in the INSERT normally.

**In `updateBill()`:**
1. Fix all column names identically.
2. When updating rows: `DELETE FROM bill_rows WHERE bill_id = ?` then re-INSERT all rows fresh.

**In `getBills()` (currently just returns `_bills`):**
1. Add an IPC path: when `getIpc()` returns a bridge, query SQLite:
```sql
SELECT b.*, GROUP_CONCAT(...) ...
```
Actually simpler: query `bills` then for each bill query `bill_rows WHERE bill_id = ?`. Or do a single JOIN. Recommended: query bills first, then batch-fetch all bill_rows in one query and stitch them by `bill_id` in JS.

Full query for bills:
```sql
SELECT id, bill_number, bill_date, party_name, phone, transport_name, address, gstin, po_notes,
       bill_format, status, subtotal, grand_total, adjustments, custom_columns,
       internal_notes, pdf_format, draft, version, cell_formats, template_id,
       created_at, updated_at
FROM bills WHERE deleted_at IS NULL ORDER BY bill_date DESC, created_at DESC
```

Full query for rows:
```sql
SELECT * FROM bill_rows ORDER BY bill_id, row_index
```

Map column names back to `BillRecord` camelCase fields when constructing the objects.

**In `deleteBill()`:**
There is a bug — `ipc` is referenced as an undeclared variable. Fix:
```ts
// Replace:
if (!ipc) return
await ipc.db.run(...)

// With:
const ipc = getIpc()
if (!ipc) return
await ipc.db.run(`DELETE FROM bill_rows WHERE bill_id = ?`, [id])
await ipc.db.run(`DELETE FROM bills WHERE id = ?`, [id])
```

Also delete the associated `bill_rows` before or after deleting the bill.

### Files to Touch
- `src/renderer/services/bill.service.ts`
- `src/main/db/migrations/004_fix_bills_extra_cols.ts` (new file)
- `src/main/db/migrationRunner.ts` (register migration 004)

### Must Not Break
- Bill number generation logic (untouched)
- In-memory `_bills` cache (keep updating it after successful DB write)
- localStorage fallback (keep it as the else branch when `!ipc`)
- `getRateHint()` (reads from `_bills` in-memory — still works once `_bills` is populated correctly)

---

## SESSION FIX-2 ✅ DONE — Bill Load: Populate `_bills` from SQLite on Startup

### The Problem
`getBills()` returns `[..._bills]` which is seeded at module load from `localStorage` only. After Fix-1 corrects the SQLite writes, bills will be in SQLite — but nothing reads them back out on startup.

### What to Fix

**Add `loadBillsFromDb()` function:**
```ts
export async function loadBillsFromDb(): Promise<void> {
  const ipc = getIpc()
  if (!ipc) return

  try {
    const billRows = await ipc.db.query(
      `SELECT id, bill_number, bill_date, party_name, phone, transport_name, address, gstin,
              po_notes, bill_format, status, subtotal, grand_total, adjustments, custom_columns,
              internal_notes, pdf_format, draft, version, cell_formats, template_id,
              created_at, updated_at
       FROM bills WHERE deleted_at IS NULL ORDER BY bill_date DESC, created_at DESC`,
      []
    ) as Array<Record<string, unknown>>

    const rows = await ipc.db.query(
      `SELECT * FROM bill_rows ORDER BY bill_id, row_index`,
      []
    ) as Array<Record<string, unknown>>

    // Group rows by bill_id
    const rowsByBill = new Map<number, BillingRow[]>()
    for (const r of rows) {
      const bid = r.bill_id as number
      if (!rowsByBill.has(bid)) rowsByBill.set(bid, [])
      rowsByBill.get(bid)!.push({
        id: String(r.id),
        itemName: (r.item_name as string) ?? '',
        qty: (r.qty as string) ?? '',
        qtyUnit: (r.qty_unit as string) ?? '',
        rate: (r.rate as string) ?? '',
        discountValue: (r.discount as string) ?? '',
        discountType: ((r.discount_type as string) ?? 'pct') as 'pct' | 'flat',
        amount: (r.amount as number) ?? 0,
        preTax: (r.pre_tax as number) ?? 0,
        gstPct: String(r.gst_percent ?? ''),
        gstAmt: (r.gst_amount as number) ?? 0,
      })
    }

    _bills = billRows.map(b => ({
      id: b.id as number,
      billNumber: b.bill_number as string,
      billDate: b.bill_date as string,
      partyName: b.party_name as string,
      partyPhone: (b.phone as string) ?? undefined,
      transportName: (b.transport_name as string) ?? undefined,
      partyAddress: (b.address as string) ?? undefined,
      partyGstin: (b.gstin as string) ?? undefined,
      partyNotes: (b.po_notes as string) ?? undefined,
      format: (b.bill_format as 'free' | 'gst'),
      status: (b.status as BillStatus),
      subtotal: (b.subtotal as number) ?? 0,
      grandTotal: (b.grand_total as number) ?? 0,
      adjustments: b.adjustments ? JSON.parse(b.adjustments as string) : [],
      customColumns: b.custom_columns ? JSON.parse(b.custom_columns as string) : [],
      internalRemarks: (b.internal_notes as string) ?? undefined,
      cellFormats: b.cell_formats ? JSON.parse(b.cell_formats as string) : {},
      templateId: (b.template_id as number) ?? undefined,
      rows: rowsByBill.get(b.id as number) ?? [],
      createdAt: b.created_at as string,
      updatedAt: b.updated_at as string,
    }))

    _saveBillsToStorage(_bills) // sync localStorage too
  } catch (err) {
    console.error('[BillService] loadBillsFromDb failed:', err)
  }
}
```

**Call it from `DBContext.tsx`** after the DB is confirmed ready:
```ts
// In DBProvider useEffect, after setReady(true):
import { loadBillsFromDb } from '../services/bill.service'
// ...
ipc.db.getActivePath().then(async (p: string) => {
  setActiveDbPath(p || null)
  await loadBillsFromDb()   // ← add this
  setReady(true)
})
```

**Also call it in `swapDatabase()`** after the swap succeeds, before `setReady(true)`.

**Also emit `dbSwap` event** that was missing (noted in original analysis):
```ts
// In swapDatabase(), after confirming new path:
import { eventBus } from '../utils/eventBus'
eventBus.emit('dbSwap', { newDbPath: confirmedPath ?? newDbPath })
await loadBillsFromDb()
await loadCustomers()  // from customer.service
setReady(true)
```

### Files to Touch
- `src/renderer/services/bill.service.ts` (add `loadBillsFromDb`, export it)
- `src/renderer/contexts/DBContext.tsx` (call `loadBillsFromDb` + `loadCustomers` on ready + on swap, emit `dbSwap`)

### Must Not Break
- `getBills()` still just returns `[..._bills]` — no change needed there
- All existing IPC save/update/delete paths from Fix-1

---

## SESSION FIX-3 ✅ DONE — Customer Save & Load: Fix Column Names in `customer.service.ts`

### The Problem
`addCustomer()` uses wrong column names in the INSERT (`grp` instead of `customer_group`, `pan_no` instead of `pan_number`). The INSERT fails, the catch returns `0`, and the new customer is never saved to SQLite. This is why **new customers created from bill save don't appear in Customer Details**.

`loadCustomers()` SELECT also uses `grp` and `pan_no` — so even if rows existed, they'd come back with NULL for group and PAN.

`updateCustomer()` uses `fieldMap` with `group: 'grp'` and `panNo: 'pan_no'` — same problem.

**Column name mismatches:**

| Service uses | Schema actually has |
|---|---|
| `grp` | `customer_group` |
| `pan_no` | `pan_number` |

Everything else in the customers INSERT matches the schema correctly.

### What to Fix

**In `addCustomer()`** — fix the INSERT:
```sql
INSERT INTO customers
  (party_name, address, customer_group, pincode, state_name, contact_person, phone, mobile,
   email, website, pan_number, gstin, reg_type, credit_limit, transport_name,
   internal_notes, customer_since, created_at, updated_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
```

**In `loadCustomers()`** — fix the SELECT alias:
```sql
SELECT id, party_name as partyName, address,
       customer_group as "group", pincode, state_name as stateName,
       contact_person as contactPerson, phone as phoneNo, mobile as mobileNo,
       email, website, pan_number as panNo, gstin, reg_type as regType,
       credit_limit as creditLimit, transport_name as lastTransportName,
       internal_notes as internalNotes, customer_since as customerSinceDate,
       created_at as createdAt
FROM customers WHERE deleted_at IS NULL ORDER BY party_name COLLATE NOCASE
```

**In `updateCustomer()` `fieldMap`:**
```ts
const fieldMap: Record<string, string> = {
  partyName: 'party_name',
  address: 'address',
  group: 'customer_group',    // ← was 'grp'
  pincode: 'pincode',
  stateName: 'state_name',
  contactPerson: 'contact_person',
  phoneNo: 'phone',
  mobileNo: 'mobile',
  email: 'email',
  website: 'website',
  panNo: 'pan_number',         // ← was 'pan_no'
  gstin: 'gstin',
  regType: 'reg_type',
  creditLimit: 'credit_limit',
  lastTransportName: 'transport_name',
  internalNotes: 'internal_notes',
  customerSinceDate: 'customer_since',
}
```

**In `ensureCustomerExists()` patch block** — the UPDATE uses raw column names from `updates.push('phone = ?')` etc. Check each one against the schema. `phone`, `address`, `gstin`, `internal_notes`, `customer_since` are all correct in the schema — no changes needed there.

**In `_saveCustomersToStorage` / `_loadCustomersFromStorage`** — these use the localStorage key `'cq:mockCustomers'`. Rename this key to `'cq:customers'` so it doesn't look like mock data. Update both the save and load functions.

### Files to Touch
- `src/renderer/services/customer.service.ts`

### Must Not Break
- `ensureCustomerExists()` flow (called from bill save)
- `updateCustomerTransport()` (uses correct column names already)
- `searchCustomers()` / `getCustomerByName()` (read from `_customerCache` — still works once cache is populated correctly)
- Customer Details page CRUD

---

## SESSION FIX-4 ✅ DONE — Inventory: Wire All Reads and Writes to SQLite

### The Problem
`inventory.service.ts` is entirely localStorage-backed. It has zero IPC calls. The SQLite tables `inventory_items`, `inventory_price_history`, and `inventory_usage_history` exist and are correctly migrated but are never written to or read from.

### What to Fix

This is the largest session. The inventory service is a large object (`inventoryService`) with methods. The strategy is:

**For each mutating method, add an IPC write AFTER the in-memory update (keep in-memory cache as the fast read path):**

**`addItem(partial)`:**
After pushing to `_items` and calling `persist()`, also run:
```ts
const ipc = getIpc()
if (ipc) {
  try {
    await ipc.db.run(
      `INSERT INTO inventory_items
        (item_name, category, sub_category, price, wholesale_price, gst_price, credit_price,
         gst_rate, stock_qty, min_stock, unit, custom_prices, barcode, image_path, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      [
        item.itemName, item.category || null, item.subCategory || null,
        parseFloat(item.price) || null, parseFloat(item.wholesalePrice) || null,
        parseFloat(item.gstPrice) || null, parseFloat(item.creditPrice) || null,
        parseFloat(item.gstRate) || null, parseFloat(item.stockQty) || 0,
        parseFloat(item.lowStockThreshold) || null, item.unit || null,
        JSON.stringify(item.customPrices || {}),
        item.barcode || null, item.imagePath || null,
      ]
    )
    // Update the item's id to the SQLite rowid for consistency
    const rows = await ipc.db.query(
      `SELECT id FROM inventory_items WHERE item_name = ? ORDER BY created_at DESC LIMIT 1`,
      [item.itemName]
    ) as Array<{ id: number }>
    if (rows[0]) item.id = String(rows[0].id)
  } catch (err) { console.warn('[InventoryService] addItem DB write failed:', err) }
}
```

**`updateItem(id, patch)`:**
After updating `_items` and calling `persist()`, build a dynamic UPDATE using a field map similar to `customer.service.ts`:
```ts
const fieldMap: Record<string, string> = {
  itemName: 'item_name', category: 'category', subCategory: 'sub_category',
  price: 'price', wholesalePrice: 'wholesale_price', gstPrice: 'gst_price',
  creditPrice: 'credit_price', gstRate: 'gst_rate', stockQty: 'stock_qty',
  lowStockThreshold: 'min_stock', unit: 'unit', customPrices: 'custom_prices',
  barcode: 'barcode', imagePath: 'image_path',
}
// Build SET clause dynamically from patch keys, run UPDATE WHERE id = ?
```

Note: `id` in the inventory service is a string (e.g. `"inv-1"`). For the SQLite rowid, you need to store/retrieve the numeric SQLite id separately, OR change the strategy: use `item_name` as a lookup key for existing items, OR store the SQLite id as a separate field on `InventoryItemFull`. **Recommended:** Add `sqliteId?: number` to `InventoryItemFull` and populate it on load.

**`deleteItem(id)`:**
```ts
if (ipc && item.sqliteId) {
  await ipc.db.run(`UPDATE inventory_items SET deleted_at = datetime('now') WHERE id = ?`, [item.sqliteId])
}
```

**`recordUsageFromBill(entries)`:**
After pushing to `_usageHistory`, also INSERT into `inventory_usage_history`:
```ts
for (const e of entries) {
  const item = _items.find(i => i.id === e.itemId)
  if (!item?.sqliteId) continue
  await ipc.db.run(
    `INSERT INTO inventory_usage_history (item_id, party_name, bill_id, bill_number, bill_date, qty, rate, amount)
     VALUES (?,?,?,?,?,?,?,?)`,
    [item.sqliteId, e.partyName, e.billId, e.billNumber, e.billDate, e.qty, e.rate, e.amount]
  )
}
```

**`recordPriceChangesIfAny()`:**
After pushing to `_priceHistory`, also INSERT into `inventory_price_history`:
```ts
await ipc.db.run(
  `INSERT INTO inventory_price_history (item_id, field, field_label, old_value, new_value)
   VALUES (?,?,?,?,?)`,
  [item.sqliteId, fieldKey, fieldLabel, oldVal, newVal]
)
```

**Add `loadInventoryFromDb()` function (new export):**
On startup, query `inventory_items` and populate `_items`. Also query `inventory_price_history` and `inventory_usage_history` to populate `_priceHistory` and `_usageHistory`.

Call `loadInventoryFromDb()` from `DBContext.tsx` alongside `loadBillsFromDb()` and `loadCustomers()`.

### Files to Touch
- `src/renderer/services/inventory.service.ts`
- `src/renderer/contexts/DBContext.tsx` (add `loadInventoryFromDb` call)

### Must Not Break
- All inventory page UI (reads from `_items` in-memory — unchanged)
- Stock deduction from `bill.service.ts` (calls `inventoryService.updateItem()` — still works, now also writes to DB)
- Price history panel
- Usage history panel
- Excel import/export (SheetJS path — unchanged)
- Image handling (file path based — unchanged)

---

## SESSION FIX-5 ✅ DONE — Payments: Verify Full SQLite Round-Trip

### The Problem
`payment.service.ts` already has an IPC write path for `savePayment()` and `deletePayment()` — these appear correct. However:

1. The in-memory `_cache` is seeded from localStorage on module load, not from SQLite.
2. `loadPaymentsForCustomer()` does query SQLite when IPC is available — but it's only called on demand (when the Customer Ledger modal opens), not on startup.
3. If the app restarts, `_cache` is populated from localStorage, meaning `_recalcAndDriveBillStatuses()` computes against stale payment data until the ledger is opened.

### What to Fix

**Add `loadAllPaymentsFromDb()` function:**
```ts
export async function loadAllPaymentsFromDb(): Promise<void> {
  const ipc = getIpc()
  if (!ipc) return
  try {
    const rows = await ipc.db.query(
      `SELECT id, customer_id as customerId, amount, payment_date as paymentDate,
              reference, notes, linked_bills as linkedBillsJson, created_at as createdAt
       FROM payments ORDER BY payment_date ASC`,
      []
    ) as Array<Record<string, unknown>>

    _cache = rows.map(r => ({
      id: r.id as number,
      customerId: r.customerId as number,
      partyName: '',
      amount: r.amount as number,
      paymentDate: r.paymentDate as string,
      reference: (r.reference as string) ?? undefined,
      notes: (r.notes as string) ?? undefined,
      linkedBillIds: r.linkedBillsJson ? JSON.parse(r.linkedBillsJson as string) as number[] : [],
      createdAt: r.createdAt as string,
    }))
    _saveToStorage(_cache)
  } catch (err) {
    console.error('[PaymentService] loadAllPaymentsFromDb failed:', err)
  }
}
```

Call `loadAllPaymentsFromDb()` from `DBContext.tsx` on startup and on `dbSwap`.

**Verify `savePayment()` IPC path** — the column names in the INSERT match the `payments` schema exactly (`customer_id`, `amount`, `payment_date`, `reference`, `notes`, `linked_bills`) — these are correct, no changes needed.

**Verify `deletePayment()` IPC path** — `DELETE FROM payments WHERE id = ?` is correct.

### Files to Touch
- `src/renderer/services/payment.service.ts` (add `loadAllPaymentsFromDb`, export it)
- `src/renderer/contexts/DBContext.tsx` (add `loadAllPaymentsFromDb` call)

### Must Not Break
- Bill status recalculation (`_recalcAndDriveBillStatuses`) — unchanged
- Customer ledger modal — unchanged
- Payment recorder modal — unchanged

---

## SESSION FIX-6 ✅ DONE — `loadCustomers` on Startup + `dbSwap` Completion

### The Problem
`loadCustomers()` has a correct IPC SELECT path (after Fix-3 fixes the column names). But it's never called on app startup — only called reactively when specific pages mount. After a DB swap, nothing reloads.

The `DBContext.swapDatabase()` has a `TODO` comment where `eventBus.emit('dbSwap', ...)` should fire but doesn't. No services react to profile switching.

### What to Fix

**In `DBContext.tsx` — `swapDatabase()`:**
After `setReady(true)`, emit the event and reload all services:
```ts
import { loadBillsFromDb } from '../services/bill.service'
import { loadCustomers } from '../services/customer.service'
import { loadInventoryFromDb } from '../services/inventory.service'
import { loadAllPaymentsFromDb } from '../services/payment.service'
import { eventBus } from '../utils/eventBus'

// After confirmedPath is set:
eventBus.emit('dbSwap', { newDbPath: confirmedPath ?? newDbPath })
await Promise.all([
  loadBillsFromDb(),
  loadCustomers(),
  loadInventoryFromDb(),
  loadAllPaymentsFromDb(),
])
setReady(true)
```

**In `DBContext.tsx` — initial `useEffect`:**
Same reload sequence after `getActivePath()` resolves:
```ts
ipc.db.getActivePath().then(async (p: string) => {
  setActiveDbPath(p || null)
  await Promise.all([
    loadBillsFromDb(),
    loadCustomers(),
    loadInventoryFromDb(),
    loadAllPaymentsFromDb(),
  ])
  setReady(true)
})
```

Note: Sessions FIX-2, FIX-4, and FIX-5 each add individual load calls to DBContext. This session consolidates them all into the correct final form. If FIX-2/4/5 already added partial calls, this session replaces them with the full consolidated version.

### Files to Touch
- `src/renderer/contexts/DBContext.tsx`

### Must Not Break
- The `isReady` flag controls rendering of the app shell — keep the same gate
- `isSwapping` flag — keep unchanged
- `swapDatabase()` error handling — keep the throw on failure

---

## SESSION FIX-7 ✅ DONE — `onboarding.service.ts`: Write `number_of_branches`

### The Problem
Migration `003` added `number_of_branches` to `company_profile`. The onboarding INSERT in `onboarding.service.ts` doesn't include this column, so it's always `0` after onboarding even if the user specified branches.

### What to Fix

**In `onboarding.service.ts`** — add `number_of_branches` to the INSERT:

Find the INSERT in `completeOnboarding()` (or equivalent function name):
```sql
INSERT INTO company_profile (
  firm_name, nature_of_firm, nature_of_business, business_model,
  gst_number, address, office_type, number_of_branches,   -- ← add this
  phone, email, logo_path,
  financial_year_start, bill_reset_cycle, starting_bill_number,
  onboarding_complete, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
```

And add the corresponding value in the params array:
```ts
data.numberOfBranches ?? 0,   // ← add after officeType param
```

Check what field name the onboarding wizard uses for this value (look in `OnboardingWizard.tsx` for the branches field) and match it.

### Files to Touch
- `src/renderer/services/onboarding.service.ts`

### Must Not Break
- All other onboarding fields — only adding one param, don't shift any existing ones
- Bill number seed logic in the same function — untouched

---

## Quick Reference: Schema vs Service Field Mapping

### `bills` table
| Schema column | BillRecord field | Notes |
|---|---|---|
| `bill_number` | `billNumber` | |
| `bill_date` | `billDate` | |
| `party_name` | `partyName` | |
| `phone` | `partyPhone` | ⚠️ service used `party_phone` |
| `transport_name` | `transportName` | |
| `address` | `partyAddress` | ⚠️ service used `party_address` |
| `gstin` | `partyGstin` | ⚠️ service used `party_gstin` |
| `po_notes` | `partyNotes` | ⚠️ service used `party_notes` |
| `bill_format` | `format` | ⚠️ service used `format` |
| `internal_notes` | `internalRemarks` | ⚠️ service used `internal_remarks` |
| `custom_columns` | `customColumns` | JSON blob — correct |
| `adjustments` | `adjustments` | JSON blob — correct |
| `cell_formats` | `cellFormats` | ⚠️ column missing — add via migration 004 |
| `template_id` | `templateId` | ⚠️ column missing — add via migration 004 |
| *(no column)* | `rows` | ⚠️ rows go in `bill_rows` table |

### `customers` table
| Schema column | CustomerRecord field | Notes |
|---|---|---|
| `party_name` | `partyName` | ✅ |
| `customer_group` | `group` | ⚠️ service used `grp` |
| `phone` | `phoneNo` | ✅ |
| `mobile` | `mobileNo` | ✅ |
| `pan_number` | `panNo` | ⚠️ service used `pan_no` |
| `transport_name` | `lastTransportName` | ✅ |
| `internal_notes` | `internalNotes` | ✅ |
| `customer_since` | `customerSinceDate` | ✅ |
| `credit_limit` | `creditLimit` | ✅ |

### `inventory_items` table
| Schema column | InventoryItemFull field | Notes |
|---|---|---|
| `item_name` | `itemName` | |
| `wholesale_price` | `wholesalePrice` | |
| `gst_price` | `gstPrice` | |
| `credit_price` | `creditPrice` | |
| `gst_rate` | `gstRate` | |
| `stock_qty` | `stockQty` | |
| `min_stock` | `lowStockThreshold` | |
| `custom_prices` | `customPrices` | JSON blob |
| `image_path` | `imagePath` | |

---

## Session Order Recommendation

| Order | Session | Unblocks |
|---|---|---|
| 1st | FIX-3 (Customer column names) | New customers appear after bill save immediately |
| 2nd | FIX-1 (Bill column names + bill_rows) | Bills land in SQLite correctly |
| 3rd | FIX-2 (Bill load from DB on startup) | Bills survive restart |
| 4th | FIX-4 (Inventory SQLite wiring) | Stock, prices, usage history persist |
| 5th | FIX-5 (Payments load from DB) | Payment history survives restart |
| 6th | FIX-6 (DBContext consolidation + dbSwap) | Profile switching works cleanly |
| 7th | FIX-7 (Onboarding branches) | Small cleanup |

FIX-3 first because it fixes the most visible user-facing bug (new customers not appearing) and is the smallest change.

---

## SESSION FIX-8a ✅ DONE — Col+ Button: Replace `window.prompt` with In-App Dialog

### The Problem
Clicking the **+Col** button in the BillingGrid toolbar did nothing — silently. No column appeared, no error, no feedback.

**Root cause:** `addCustomColumn()` called `window.prompt('Column header name:')` to collect the column name from the user. In Electron with `contextIsolation: true` and `nodeIntegration: false`, native browser dialogs (`alert`, `confirm`, `prompt`) are suppressed at the renderer level — `window.prompt()` returns `null` immediately. The function then hits the early return guard `if (!name || !name.trim()) return` and exits before creating anything.

```ts
// Before — always bails out in Electron:
const addCustomColumn = useCallback(() => {
  const name = window.prompt('Column header name:')  // ← always null in Electron
  if (!name || !name.trim()) return                  // ← always fires
  // ... never reached
}, [...])
```

There was also a secondary issue: the `useEffect` that populates `imperativeRef.current` had no dependency array, causing it to re-run on every render. This was not the blocker but is a latent stale-closure risk.

### What Was Fixed

**New `AddColumnDialog` component** — a self-contained in-app modal rendered via React state, not a native browser dialog:
- Input field focused on mount
- `Enter` key confirms, `Escape` cancels
- Cancel button and "Add Column" button
- Semi-transparent backdrop with `backdropFilter: blur(2px)`, matching app modal style
- Uses CSS variables (`--cq-accent`, `--cq-border`, etc.) so it respects all themes
- Rendered above everything else in BillingGrid's JSX tree (above toolbar, above grid)

**Refactored `addCustomColumn`** — now just sets `showAddColDialog = true` (opens the modal):
```ts
const addCustomColumn = useCallback(() => {
  setShowAddColDialog(true)
}, [])
```

**New `handleAddColConfirm(name: string)`** — holds the actual column creation logic, called when the user confirms the dialog:
```ts
const handleAddColConfirm = useCallback((name: string) => {
  setShowAddColDialog(false)
  pushUndo()
  const col: CustomColumn = { id: newId(), header: name }
  const initialCells: CustomColCell[] = rows.map(() => emptyCell())
  setCustomCols(prev => { ... })
}, [rows, adjustments, notifyChange, pushUndo])
```

**New `showAddColDialog` state** — `useState(false)`, drives dialog visibility.

The fix applies to both the **in-grid toolbar +Col button** (line ~1266 in BillingGrid) and the **main toolbar +Col button** in `NewQuote/index.tsx` (line ~1219), since both call `gridImperativeRef.current?.addCustomColumn()` — the same underlying function.

### Files Changed
- `src/renderer/pages/NewQuote/BillingGrid.tsx`
  - Added `AddColumnDialog` component (above component body, ~65 lines)
  - Added `showAddColDialog` state
  - Replaced `addCustomColumn` implementation (no more `window.prompt`)
  - Added `handleAddColConfirm` callback
  - Added `{showAddColDialog && <AddColumnDialog ... />}` at top of render JSX

### Must Not Break
- `removeLastCustomColumn` — untouched
- `updateCustomCell`, `markActiveCustomCell` — untouched
- `imperativeRef.current.addCustomColumn` exposure — still the same function reference, just changed internals
- Undo/Redo stack — `pushUndo()` still called before column creation, same as before
- `−Col` button — untouched

---

## SESSION FIX-8b ✅ DONE — EditBillView: Full Toolbar & Footer Parity with NewQuote

### The Problem
The History page's edit view (`EditBillView.tsx`) was missing almost every action button that exists in the New Quote page. The toolbar had formatting and column tools, but none of the output actions. The footer only had **Save Changes** and **Back to History**.

**Missing from toolbar:**
- Excel Export panel (Ctrl+E)
- Print Options panel (Ctrl+P)
- Duplicate Bill panel (Ctrl+D)
- Bill Templates panel (Ctrl+Shift+T)
- Internal Remarks panel (Ctrl+Shift+R) — existed as inline textarea but not as toolbar panel

**Missing from footer:**
- Save PDF (Simplified)
- 🏢 Save PDF… (format chooser — Simplified / Professional / Detailed Professional)
- Copy Image (Professional format)
- Copy Simple (Simplified format image)
- Quick Print (silent A5 print)

**Missing keyboard shortcuts:**
- `Ctrl+P` (print/PDF options)
- `Ctrl+E` (Excel export)
- `Ctrl+D` (duplicate)
- `Ctrl+Shift+C` (copy professional image)
- `Ctrl+Shift+X` (copy simplified image)
- `Ctrl+Shift+P` (quick print)
- `Ctrl+Shift+T` (templates)
- `Ctrl+Shift+R` (remarks)

**Missing dialogs:**
- PDF Format Selector dialog (UX for choosing Simplified / Professional / Detailed Professional)
- UPI QR prompt dialog (asks whether to include QR code in PDF)

**Other gaps:**
- `BillingGrid` was not wired with `f2ModeEnabled`, `inventoryModeEnabled`, or `rateHistoryHintEnabled` — the edit view always ran in default mode regardless of user settings
- `useConfig` and `useFlag` hooks not imported, so config-driven features were silently disabled

### What Was Fixed

**New imports added:**
- `pdf.service`: `saveSimplifiedPdf`, `saveProfessionalPdf`, `saveDetailedProfessionalPdf`, `copyBillAsImage`, `copyBillAsSimplifiedImage`, `quickPrintSilent`
- `pdf.service` types: `ProfessionalPdfInput`, `DetailedProfessionalPdfInput`, `PdfFormat`
- `pdfSettings.service`: `getUpiId`, `getPartyPdfFormat`, `setPartyPdfFormat`
- `PdfActionDialogs`: `UpiQrPrompt`, `PdfFormatSelector`
- `ToolbarPanels`: `ExcelExportButton`, `PrintOptionsPanel`, `DuplicateBillPanel`, `BillTemplatesPanel`, `InternalRemarksPanel`
- `template.service` type: `BillTemplateColumn`
- `useFlag` from `FeatureFlagContext`
- `useConfig` from `ConfigContext`
- `triggerWhatsAppShare` from `whatsappShare` module
- New lucide icons: `FileText`, `Image`, `Printer`, `FileSpreadsheet`, `Copy`, `LayoutTemplate`, `StickyNote`

**New state:**
| State | Type | Purpose |
|---|---|---|
| `excelExportOpen` | `boolean` | Excel Export panel toggle |
| `printOptionsOpen` | `boolean` | Print Options panel toggle |
| `duplicateOpen` | `boolean` | Duplicate Bill panel toggle |
| `templatesOpen` | `boolean` | Bill Templates panel toggle |
| `remarksOpen` | `boolean` | Internal Remarks panel toggle |
| `hasRemarks` | computed | Yellow dot badge on Remarks button |
| `isSavingPdf` | `boolean` | PDF generation loading state |
| `isSavingProfessionalPdf` | `boolean` | Professional PDF loading state |
| `isCopyingImage` | `boolean` | Copy image loading state |
| `isCopyingSimplifiedImage` | `boolean` | Copy simple image loading state |
| `isQuickPrinting` | `boolean` | Quick print loading state |
| `quickPrintA4Warning` | `boolean` | Two-click confirm for large bills |
| `formatSelectorPending` | `object \| null` | Promise-based PDF format selector |
| `upiQrPending` | `object \| null` | Promise-based UPI QR prompt |

**New handlers (all matching NewQuote exactly):**
- `buildPdfInput(isDraft)` — assembles PDF input from current grid/party state. Always passes `isDraft: false` since the bill already exists in the DB
- `promptPdfFormat(partyName)` — returns Promise, resolves when user picks a format; reads/writes memory via `pdfSettings.service`
- `promptUpiQr(grandTotal)` — returns Promise, resolves when user answers; skips dialog if no UPI ID configured
- `getCompanyProfile()` — fetches company profile from SQLite via IPC bridge
- `handleSavePdf()` — simplified PDF, skips format selector
- `handleSaveProfessionalPdf()` — full format chooser flow (format selector → UPI QR → generate)
- `handleCopyProfessionalImage()` — copies professional-format bill image to clipboard; triggers WhatsApp share if configured
- `handleCopySimplifiedImage()` — copies simplified-format bill image; triggers WhatsApp share if configured
- `handleQuickPrint()` — silent A5 print with two-click A4 warning for large bills
- `handleLoadTemplate(format, customCols)` — applies template's format + column structure to current bill

**Toolbar group 7 added** (right-aligned, after Undo/Redo, matching NewQuote layout):
- Excel Export → `ExcelExportButton` panel
- Print → `PrintOptionsPanel`
- Duplicate → `DuplicateBillPanel`
- Templates → `BillTemplatesPanel`
- Remarks → `InternalRemarksPanel` (yellow dot badge when remarks exist)
- All panels are mutually exclusive (opening one closes others)

**Footer updated** — now has all 6 action buttons:
1. Save Changes (primary, accent background)
2. Save PDF (simplified)
3. 🏢 Save PDF… (format chooser, accent-tinted border)
4. Copy Image (professional)
5. Copy Simple (simplified image)
6. Quick Print (amber warning state when A4 confirmation needed)
7. Back to History (moved right of action buttons)

**PDF format selector and UPI QR dialogs** rendered at top of component tree (before toast, before header bar), matching NewQuote placement.

**`BillingGrid` props updated:**
```tsx
// Before:
<BillingGrid
  format={billFormat}
  onFormatChange={setBillFormat}
  onChange={handleGridChange}
  f2ModeEnabled={false}      // ← hardcoded off
  columnToggles={columnToggles}
  onColumnTogglesChange={setColumnToggles}
  imperativeRef={gridImperativeRef}
  partyName={partyDetails.partyName}
/>

// After:
<BillingGrid
  format={billFormat}
  onFormatChange={setBillFormat}
  onChange={handleGridChange}
  f2ModeEnabled={config.f2EditMode === true}                // ← respects settings
  columnToggles={columnToggles}
  onColumnTogglesChange={setColumnToggles}
  imperativeRef={gridImperativeRef}
  partyName={partyDetails.partyName}
  inventoryModeEnabled={config.inventoryModeEnabled === true}  // ← respects settings
  rateHistoryHintEnabled={config.rateHistoryHintEnabled !== false}  // ← respects settings
  billFormatForInv={billFormat}
/>
```

**Keyboard shortcut handler expanded** — old `Ctrl+H` (highlight cell shortcut that conflicted with the global History nav) replaced with correct shortcuts matching NewQuote. All new shortcuts wired to the corresponding handlers.

### Files Changed
- `src/renderer/pages/History/EditBillView.tsx`
  - All new imports (~15 new import lines)
  - All new state variables (~16 new state declarations)
  - All new handler functions (~130 lines of new handler code)
  - Updated `useEffect` keyboard handler (added 8 new shortcut cases, removed conflicting `Ctrl+H`)
  - Toolbar JSX: added full Group 7 (Excel, Print, Duplicate, Templates, Remarks) + updated shortcut hints
  - Render: added `PdfFormatSelector` and `UpiQrPrompt` dialogs
  - Footer: replaced 2-button footer with 7-button footer
  - BillingGrid: wired config props

### Must Not Break
- Save Changes / `updateBill()` flow — untouched
- Unsaved changes guard dialog — untouched
- Status selector — untouched
- Bill snapshot load on mount (`hasLoadedRef` pattern) — untouched
- `handleGridChange` / `handleGridChange` refs — untouched
- `buildPartyDetails`, `buildBillInfo`, `unpackCustomColumns` helpers — untouched

---
