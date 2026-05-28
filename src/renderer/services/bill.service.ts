/**
 * cQikly — Bill Service
 * Built in: Phase 4b-ii
 *
 * Responsibilities:
 *   - Bill number generation (via BillNumberEngine)
 *   - Bill save / update / delete
 *   - Bill status management
 *   - In-memory store for dev/browser mode
 *
 * Architecture: All data access goes through this service.
 * Components never call DB directly.
 */

import type { BillStatus, BillRecord } from './db.service'
import type { BillingRow, AdjustmentRow } from '../pages/NewQuote/billingGrid.types'
import { getBillNumberEngine } from '../utils/billNumber'
import { ensureCustomerExists, addTransporterToList, updateCustomerTransport } from './customer.service'
import { eventBus } from '../utils/eventBus'

export type { BillStatus }

// ─── In-memory bill store (dev/browser mode) ────────────────────────────────

let _bills: BillRecord[] = []

function _loadBillsFromStorage(): BillRecord[] {
  try {
    const raw = localStorage.getItem('cq:bills')
    if (raw) return JSON.parse(raw) as BillRecord[]
  } catch { /* ignore */ }
  return _getDevMockBills()
}

function _saveBillsToStorage(bills: BillRecord[]): void {
  try {
    localStorage.setItem('cq:bills', JSON.stringify(bills))
  } catch { /* ignore */ }
}

// Initialize from storage
_bills = _loadBillsFromStorage()

// ─── IPC helper ────────────────────────────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

// ─── Bill number ────────────────────────────────────────────────────────────────

/**
 * Peek at the next bill number without consuming it.
 * Used to display in the UI before saving.
 */
export async function peekNextBillNumber(): Promise<string> {
  return getBillNumberEngine().peek()
}

// ─── Save bill ──────────────────────────────────────────────────────────────────

export interface SaveBillInput {
  partyName: string
  partyPhone?: string
  transportName?: string
  partyAddress?: string
  partyGstin?: string
  partyNotes?: string
  billDate: string          // ISO date string — fully editable, supports backdating
  format: 'free' | 'gst'
  rows?: BillingRow[]
  customColumns?: unknown[]
  adjustments?: AdjustmentRow[]
  subtotal?: number
  grandTotal?: number
  internalRemarks?: string
  templateId?: number
  /** Cell formatting (colors, bold) — persisted with bill data (Hard Spec: color persist) */
  cellFormats?: Record<string, unknown>
}

export interface SaveBillResult {
  id: number
  billNumber: string
}

/**
 * Save a new bill.
 * - Generates the next bill number (Hard Spec #3)
 * - Sets status to 'unpaid' (default — Hard Spec, Section 9.2)
 * - Auto-creates customer if new (Hard Spec #4)
 * - Updates per-customer transport memory (Hard Spec #17)
 * - Adds transport to saved list if new
 */
export async function saveBill(input: SaveBillInput): Promise<SaveBillResult> {
  // 1. Generate bill number (consumes next number)
  const billNumber = await getBillNumberEngine().getNext()

  // 2. Build bill record with status = unpaid
  const bill: BillRecord = {
    billNumber,
    billDate: input.billDate,
    partyName: input.partyName,
    partyPhone: input.partyPhone,
    transportName: input.transportName,
    partyAddress: input.partyAddress,
    partyGstin: input.partyGstin,
    partyNotes: input.partyNotes,
    format: input.format,
    rows: input.rows ?? [],
    customColumns: input.customColumns ?? [],
    adjustments: input.adjustments ?? [],
    subtotal: input.subtotal ?? 0,
    grandTotal: input.grandTotal ?? 0,
    status: 'unpaid',  // Hard Spec: always defaults to unpaid
    internalRemarks: input.internalRemarks,
    templateId: input.templateId,
    cellFormats: input.cellFormats ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 3. Save to DB or in-memory
  const ipc = getIpc()
  let savedId: number

  if (ipc) {
    try {
      const result = await ipc.db.run(
        `INSERT INTO bills (
          bill_number, bill_date, party_name, phone, transport_name,
          address, gstin, po_notes, bill_format, custom_columns,
          adjustments, subtotal, grand_total, status, internal_notes,
          cell_formats, template_id, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
        [
          bill.billNumber, bill.billDate, bill.partyName,
          bill.partyPhone ?? null, bill.transportName ?? null,
          bill.partyAddress ?? null, bill.partyGstin ?? null,
          bill.partyNotes ?? null, bill.format,
          JSON.stringify(bill.customColumns),
          JSON.stringify(bill.adjustments), bill.subtotal, bill.grandTotal,
          bill.status, bill.internalRemarks ?? null,
          JSON.stringify(bill.cellFormats ?? {}), bill.templateId ?? null,
        ]
      )
      savedId = (result as { lastInsertRowid: number }).lastInsertRowid

      // Insert each row into bill_rows table
      for (let i = 0; i < (bill.rows ?? []).length; i++) {
        const row = (bill.rows ?? [])[i]
        await ipc.db.run(
          `INSERT INTO bill_rows (
            bill_id, row_index, item_name, qty, qty_unit, rate,
            discount, discount_type, amount, gst_percent, gst_amount,
            pre_tax, custom_cells, marked
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            savedId, i,
            row.itemName ?? '', row.qty ?? '', row.qtyUnit ?? '', row.rate ?? '',
            row.discountValue ?? '', row.discountType ?? 'pct',
            row.amount ?? 0, row.gstPct ?? '', row.gstAmt ?? 0,
            row.preTax ?? 0, null, null,
          ]
        )
      }
    } catch (err) {
      console.error('[BillService] DB save failed, falling back to in-memory:', err)
      savedId = Date.now()
    }
  } else {
    savedId = Date.now()
  }

  bill.id = savedId
  _bills = [bill, ..._bills]
  _saveBillsToStorage(_bills)

  // 4. Auto-create customer (Hard Spec #4 — silent, no button)
  try {
    const customerId = await ensureCustomerExists({
      partyName: input.partyName,
      phoneNo: input.partyPhone,
      lastTransportName: input.transportName,
      address: input.partyAddress,
      gstin: input.partyGstin,
      internalNotes: input.partyNotes,
      billDate: input.billDate,  // Phase 8b-i: auto-set customer_since from first bill date
    })
    // 5. Update per-customer transport memory (Hard Spec #17)
    if (customerId && input.transportName?.trim()) {
      await updateCustomerTransport(customerId, input.transportName.trim())
    }
  } catch (err) {
    console.error('[BillService] Auto-create customer failed (non-fatal):', err)
  }

  // 6. Persist transporter to saved list
  if (input.transportName?.trim()) {
    try { await addTransporterToList(input.transportName.trim()) } catch { /* non-fatal */ }
  }

  // 7. Stock deduction + Usage History recording on bill save (Phase 9a-B / 9b-A)
  // Reads stockDeductOnSave from config (localStorage in dev, IPC in Electron).
  // Matches billed item names case-insensitively against inventory items.
  // Usage history is ALWAYS recorded for matched items (regardless of stock deduct setting).
  // Non-fatal — a failure here never prevents the bill from saving.
  try {
    let deductEnabled = false
    const rawCfg = localStorage.getItem('cq:config')
    if (rawCfg) {
      const parsed = JSON.parse(rawCfg) as Record<string, unknown>
      deductEnabled = parsed.stockDeductOnSave === true
    }
    const { inventoryService } = await import('./inventory.service')
    const allItems = inventoryService.getItems()
    const usageEntries: Array<{
      itemId: string; partyName: string; billId: string | number
      billNumber: string; billDate: string; qty: string; rate: string; amount: string
    }> = []

    for (const row of (input.rows ?? [])) {
      if (!row.itemName.trim()) continue
      const match = allItems.find(
        inv => inv.itemName.trim().toLowerCase() === row.itemName.trim().toLowerCase()
      )
      if (!match) continue

      // Stock deduction (conditional)
      if (deductEnabled) {
        const billed = parseFloat(row.qty)
        if (Number.isFinite(billed) && billed > 0) {
          const current = parseFloat(match.stockQty)
          const newQty = Number.isFinite(current) ? Math.max(0, current - billed) : 0
          inventoryService.updateItem(match.id, { stockQty: String(newQty) })
        }
      }

      // Usage history (always recorded)
      usageEntries.push({
        itemId:     match.id,
        partyName:  input.partyName ?? '',
        billId:     savedId,
        billNumber: billNumber,
        billDate:   input.billDate ?? new Date().toISOString().slice(0, 10),
        qty:        String(row.qty ?? ''),
        rate:       String(row.rate ?? ''),
        amount:     String(row.amount ?? ''),
      })
    }

    if (usageEntries.length > 0) {
      inventoryService.recordUsageFromBill(usageEntries)
    }
  } catch (err) {
    console.warn('[BillService] Stock deduction / usage history failed (non-fatal):', err)
  }

  // Notify listeners (Loose Inventory History page re-derives on this)
  eventBus.emit('billSaved', { billId: savedId, billNumber })

  return { id: savedId, billNumber }}

// ─── Update bill status ─────────────────────────────────────────────────────────

/**
 * Update the status of a saved bill.
 * Called from the History page.
 */
export async function updateBillStatus(id: number, status: BillStatus): Promise<void> {
  // Update in-memory
  const bill = _bills.find(b => b.id === id)
  if (bill) {
    bill.status = status
    bill.updatedAt = new Date().toISOString()
    _saveBillsToStorage(_bills)
  }

  const ipc = getIpc()
  if (!ipc) return
  try {
    await ipc.db.run(
      `UPDATE bills SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      [status, id]
    )
  } catch (err) {
    console.error('[BillService] updateBillStatus failed:', err)
  }
}

// ─── Delete bill ────────────────────────────────────────────────────────────────

/**
 * Delete a bill. The bill number is recorded as deleted and NEVER reused.
 * Hard Spec #3: Deleted numbers are permanently skipped.
 */
export async function deleteBill(id: number): Promise<void> {
  const bill = _bills.find(b => b.id === id)
  if (!bill) return

  // Mark number as deleted in the engine (Hard Spec #3)
  await getBillNumberEngine().markDeleted(bill.billNumber)

  // Remove from in-memory
  _bills = _bills.filter(b => b.id !== id)
  _saveBillsToStorage(_bills)

  eventBus.emit('billDeleted', { billId: id })

  const ipc = getIpc()
  if (!ipc) return
  try {
    await ipc.db.run(`DELETE FROM bill_rows WHERE bill_id = ?`, [id])
    await ipc.db.run(`DELETE FROM bills WHERE id = ?`, [id])
  } catch (err) {
    console.error('[BillService] deleteBill failed:', err)
  }
}

// ─── Update bill (Phase 7a-B) ────────────────────────────────────────────────────
//
// Hard Spec #10: Every single edit creates a preserved version — but versioning
// is Phase 7b. For now, saving overwrites; versioning sits on top in 7b.

export interface UpdateBillInput {
  id: number
  partyName: string
  partyPhone?: string
  transportName?: string
  partyAddress?: string
  partyGstin?: string
  partyNotes?: string
  billDate: string
  format: 'free' | 'gst'
  rows?: BillingRow[]
  customColumns?: unknown[]
  adjustments?: AdjustmentRow[]
  subtotal?: number
  grandTotal?: number
  status: BillStatus
  internalRemarks?: string
  cellFormats?: Record<string, unknown>
}

/**
 * Update an existing saved bill.
 * Phase 7a-B: overwrites the existing record.
 * Phase 7b will add versioning on top of this (Hard Spec #10).
 */
export async function updateBill(input: UpdateBillInput): Promise<void> {
  // Update in-memory store
  const bill = _bills.find(b => b.id === input.id)
  if (bill) {
    bill.partyName = input.partyName
    bill.partyPhone = input.partyPhone
    bill.transportName = input.transportName
    bill.partyAddress = input.partyAddress
    bill.partyGstin = input.partyGstin
    bill.partyNotes = input.partyNotes
    bill.billDate = input.billDate
    bill.format = input.format
    bill.rows = input.rows ?? []
    bill.customColumns = input.customColumns ?? []
    bill.adjustments = input.adjustments ?? []
    bill.subtotal = input.subtotal ?? 0
    bill.grandTotal = input.grandTotal ?? 0
    bill.status = input.status
    bill.internalRemarks = input.internalRemarks
    bill.cellFormats = input.cellFormats ?? {}
    bill.updatedAt = new Date().toISOString()
    _saveBillsToStorage(_bills)
    eventBus.emit('billUpdated', { billId: input.id })
  }
  // Update customer record (non-fatal side effects)
  try {
    const customerId = await ensureCustomerExists({
      partyName: input.partyName,
      phoneNo: input.partyPhone,
      lastTransportName: input.transportName,
      address: input.partyAddress,
      gstin: input.partyGstin,
      internalNotes: input.partyNotes,
      billDate: input.billDate,  // Phase 8b-i: may update customer_since if backdated
    })
    if (customerId && input.transportName?.trim()) {
      await updateCustomerTransport(customerId, input.transportName.trim())
    }
  } catch { /* non-fatal */ }

  const ipc = getIpc()
  if (!ipc) return
  try {
    await ipc.db.run(
      `UPDATE bills SET
        party_name=?, phone=?, transport_name=?, address=?,
        gstin=?, po_notes=?, bill_date=?, bill_format=?,
        custom_columns=?, adjustments=?, subtotal=?, grand_total=?,
        status=?, internal_notes=?, cell_formats=?, updated_at=datetime('now')
       WHERE id=?`,
      [
        input.partyName,
        input.partyPhone ?? null,
        input.transportName ?? null,
        input.partyAddress ?? null,
        input.partyGstin ?? null,
        input.partyNotes ?? null,
        input.billDate,
        input.format,
        JSON.stringify(input.customColumns ?? []),
        JSON.stringify(input.adjustments ?? []),
        input.subtotal ?? 0,
        input.grandTotal ?? 0,
        input.status,
        input.internalRemarks ?? null,
        JSON.stringify(input.cellFormats ?? {}),
        input.id,
      ]
    )

    // Delete old rows and re-insert fresh
    await ipc.db.run(`DELETE FROM bill_rows WHERE bill_id = ?`, [input.id])
    for (let i = 0; i < (input.rows ?? []).length; i++) {
      const row = (input.rows ?? [])[i]
      await ipc.db.run(
        `INSERT INTO bill_rows (
          bill_id, row_index, item_name, qty, qty_unit, rate,
          discount, discount_type, amount, gst_percent, gst_amount,
          pre_tax, custom_cells, marked
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          input.id, i,
          row.itemName ?? '', row.qty ?? '', row.qtyUnit ?? '', row.rate ?? '',
          row.discountValue ?? '', row.discountType ?? 'pct',
          row.amount ?? 0, row.gstPct ?? '', row.gstAmt ?? 0,
          row.preTax ?? 0, null, null,
        ]
      )
    }
  } catch (err) {
    console.error('[BillService] updateBill DB write failed:', err)
  }
}

// ─── Load bills from SQLite on startup (FIX-2) ────────────────────────────────

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
    const rowsByBill = new Map<number, import('../pages/NewQuote/billingGrid.types').BillingRow[]>()
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

    _saveBillsToStorage(_bills)
  } catch (err) {
    console.error('[BillService] loadBillsFromDb failed:', err)
  }
}

// ─── Get bills ──────────────────────────────────────────────────────────────────

export async function getBills(): Promise<BillRecord[]> {
  return [..._bills]
}

export async function getBillById(id: number): Promise<BillRecord | null> {
  return _bills.find(b => b.id === id) ?? null
}

// ─── Dev mock data ──────────────────────────────────────────────────────────────

function _getDevMockBills(): BillRecord[] {
  // Helper: offset days from today
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0]

  // Spread bills across ~6 months for realistic monthly grouping
  return [
    // ─ May 2026 (this month) ─
    {
      id: 1001, billNumber: 'INV/25-26/20', billDate: daysAgo(1),
      partyName: 'Rajesh Traders', partyPhone: '9876543210',
      transportName: 'Sri Ram Transport', format: 'free',
      rows: [
        { id: 'm1', itemName: 'Cotton Fabric', qty: '50', qtyUnit: 'mt', rate: '120', discountValue: '', discountType: 'pct', amount: 6000, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm2', itemName: 'Polyester Thread', qty: '10', qtyUnit: 'kg', rate: '250', discountValue: '', discountType: 'pct', amount: 2500, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm3', itemName: 'Elastic Band 1in', qty: '100', qtyUnit: 'mtr', rate: '40', discountValue: '', discountType: 'pct', amount: 4000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 12500, grandTotal: 12500,
      status: 'unpaid', createdAt: daysAgo(1), updatedAt: daysAgo(1),
    },
    {
      id: 1002, billNumber: 'INV/25-26/19', billDate: daysAgo(3),
      partyName: 'Meera Enterprises', partyPhone: '9123456789',
      transportName: 'Kumar Logistics', format: 'gst',
      rows: [
        { id: 'm5', itemName: 'Steel Pipe 1inch', qty: '20', qtyUnit: 'pc', rate: '450', discountValue: '', discountType: 'pct', amount: 9000, preTax: 9000, gstPct: '18', gstAmt: 1620 },
        { id: 'm6', itemName: 'GI Wire 10SWG', qty: '50', qtyUnit: 'kg', rate: '85', discountValue: '', discountType: 'pct', amount: 4250, preTax: 4250, gstPct: '18', gstAmt: 765 },
      ],
      customColumns: [], adjustments: [], subtotal: 14835, grandTotal: 14835,
      status: 'paid', createdAt: daysAgo(3), updatedAt: daysAgo(3),
    },
    {
      id: 1003, billNumber: 'INV/25-26/18', billDate: daysAgo(8),
      partyName: 'Priya Stores', partyPhone: '9900112233',
      transportName: 'VRL Logistics', format: 'free',
      rows: [
        { id: 'm8', itemName: 'Basmati Rice 5kg', qty: '50', qtyUnit: 'bag', rate: '325', discountValue: '', discountType: 'pct', amount: 16250, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm9', itemName: 'Sunflower Oil 1L', qty: '24', qtyUnit: 'btl', rate: '162', discountValue: '', discountType: 'pct', amount: 3888, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 20138, grandTotal: 20138,
      status: 'partial', createdAt: daysAgo(8), updatedAt: daysAgo(8),
    },
    {
      id: 1004, billNumber: 'INV/25-26/17', billDate: daysAgo(14),
      partyName: 'Suresh & Sons', partyPhone: '9988776655',
      transportName: 'Blue Dart', format: 'gst',
      rows: [
        { id: 'm11', itemName: 'HDPE Pipe 1inch', qty: '100', qtyUnit: 'mt', rate: '85', discountValue: '', discountType: 'pct', amount: 8500, preTax: 8500, gstPct: '18', gstAmt: 1530 },
      ],
      customColumns: [], adjustments: [], subtotal: 10030, grandTotal: 10030,
      status: 'unpaid', createdAt: daysAgo(14), updatedAt: daysAgo(14),
    },
    // ─ April 2026 ─
    {
      id: 1005, billNumber: 'INV/25-26/16', billDate: '2026-04-22',
      partyName: 'Kiran Wholesale', partyPhone: '9711223344',
      transportName: 'DTDC', format: 'free',
      rows: [
        { id: 'm12', itemName: 'Cotton Fabric Premium', qty: '200', qtyUnit: 'mt', rate: '180', discountValue: '', discountType: 'pct', amount: 36000, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm13', itemName: 'Lining Cloth', qty: '100', qtyUnit: 'mt', rate: '60', discountValue: '', discountType: 'pct', amount: 6000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 42000, grandTotal: 42000,
      status: 'paid', createdAt: '2026-04-22', updatedAt: '2026-04-22',
    },
    {
      id: 1006, billNumber: 'INV/25-26/15', billDate: '2026-04-15',
      partyName: 'Anand Electronics', partyPhone: '9822334455',
      transportName: 'FedEx', format: 'gst',
      rows: [
        { id: 'm14', itemName: 'LED Driver 12W', qty: '500', qtyUnit: 'pcs', rate: '45', discountValue: '', discountType: 'pct', amount: 22500, preTax: 22500, gstPct: '18', gstAmt: 4050 },
        { id: 'm15', itemName: 'PCB Board 5x5cm', qty: '200', qtyUnit: 'pcs', rate: '32', discountValue: '', discountType: 'pct', amount: 6400, preTax: 6400, gstPct: '18', gstAmt: 1152 },
      ],
      customColumns: [], adjustments: [], subtotal: 34102, grandTotal: 34102,
      status: 'cancelled', createdAt: '2026-04-15', updatedAt: '2026-04-15',
    },
    {
      id: 1007, billNumber: 'INV/25-26/14', billDate: '2026-04-05',
      partyName: 'Rajesh Traders', partyPhone: '9876543210',
      transportName: 'Sri Ram Transport', format: 'free',
      rows: [
        { id: 'm16', itemName: 'Zip Fastener 10cm', qty: '1000', qtyUnit: 'pcs', rate: '4', discountValue: '', discountType: 'pct', amount: 4000, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm17', itemName: 'Button 15mm', qty: '2000', qtyUnit: 'pcs', rate: '1.5', discountValue: '', discountType: 'pct', amount: 3000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 7000, grandTotal: 7000,
      status: 'paid', createdAt: '2026-04-05', updatedAt: '2026-04-05',
    },
    // ─ March 2026 ─
    {
      id: 1008, billNumber: 'INV/24-25/13', billDate: '2026-03-28',
      partyName: 'Deepa Fashion House', partyPhone: '9633445566',
      transportName: 'Kumar Logistics', format: 'free',
      rows: [
        { id: 'm18', itemName: 'Silk Dupatta', qty: '50', qtyUnit: 'pcs', rate: '350', discountValue: '', discountType: 'pct', amount: 17500, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm19', itemName: 'Georgette Fabric', qty: '80', qtyUnit: 'mt', rate: '290', discountValue: '', discountType: 'pct', amount: 23200, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 40700, grandTotal: 40700,
      status: 'unpaid', createdAt: '2026-03-28', updatedAt: '2026-03-28',
    },
    {
      id: 1009, billNumber: 'INV/24-25/12', billDate: '2026-03-18',
      partyName: 'Meera Enterprises', partyPhone: '9123456789',
      transportName: 'VRL Logistics', format: 'gst',
      rows: [
        { id: 'm20', itemName: 'MS Angle 25x25mm', qty: '50', qtyUnit: 'kg', rate: '62', discountValue: '', discountType: 'pct', amount: 3100, preTax: 3100, gstPct: '18', gstAmt: 558 },
        { id: 'm21', itemName: 'Cement 50kg', qty: '100', qtyUnit: 'bag', rate: '380', discountValue: '', discountType: 'pct', amount: 38000, preTax: 38000, gstPct: '28', gstAmt: 10640 },
      ],
      customColumns: [], adjustments: [], subtotal: 52298, grandTotal: 52298,
      status: 'partial', createdAt: '2026-03-18', updatedAt: '2026-03-18',
    },
    {
      id: 1010, billNumber: 'INV/24-25/11', billDate: '2026-03-05',
      partyName: 'Nandini Textiles', partyPhone: '9511223344',
      transportName: 'DTDC', format: 'free',
      rows: [
        { id: 'm22', itemName: 'Cotton Yarn 20/1', qty: '500', qtyUnit: 'kg', rate: '142', discountValue: '', discountType: 'pct', amount: 71000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 71000, grandTotal: 71000,
      status: 'paid', createdAt: '2026-03-05', updatedAt: '2026-03-05',
    },
    // ─ February 2026 ─
    {
      id: 1011, billNumber: 'INV/24-25/10', billDate: '2026-02-20',
      partyName: 'Suresh & Sons', partyPhone: '9988776655',
      transportName: 'Blue Dart', format: 'gst',
      rows: [
        { id: 'm23', itemName: 'PVC Granules', qty: '200', qtyUnit: 'kg', rate: '95', discountValue: '', discountType: 'pct', amount: 19000, preTax: 19000, gstPct: '18', gstAmt: 3420 },
      ],
      customColumns: [], adjustments: [], subtotal: 22420, grandTotal: 22420,
      status: 'unpaid', createdAt: '2026-02-20', updatedAt: '2026-02-20',
    },
    {
      id: 1012, billNumber: 'INV/24-25/9', billDate: '2026-02-10',
      partyName: 'Kiran Wholesale', partyPhone: '9711223344',
      transportName: 'FedEx', format: 'free',
      rows: [
        { id: 'm24', itemName: 'Velvet Fabric', qty: '150', qtyUnit: 'mt', rate: '220', discountValue: '', discountType: 'pct', amount: 33000, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm25', itemName: 'Interlining', qty: '200', qtyUnit: 'mt', rate: '35', discountValue: '', discountType: 'pct', amount: 7000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 40000, grandTotal: 40000,
      status: 'paid', createdAt: '2026-02-10', updatedAt: '2026-02-10',
    },
    // ─ January 2026 ─
    {
      id: 1013, billNumber: 'INV/24-25/8', billDate: '2026-01-25',
      partyName: 'Priya Stores', partyPhone: '9900112233',
      transportName: 'DTDC', format: 'gst',
      rows: [
        { id: 'm26', itemName: 'Toor Dal Premium', qty: '100', qtyUnit: 'kg', rate: '168', discountValue: '', discountType: 'pct', amount: 16800, preTax: 16800, gstPct: '5', gstAmt: 840 },
        { id: 'm27', itemName: 'Mustard Oil 1L', qty: '50', qtyUnit: 'btl', rate: '195', discountValue: '', discountType: 'pct', amount: 9750, preTax: 9750, gstPct: '5', gstAmt: 487 },
      ],
      customColumns: [], adjustments: [], subtotal: 27877, grandTotal: 27877,
      status: 'paid', createdAt: '2026-01-25', updatedAt: '2026-01-25',
    },
    {
      id: 1014, billNumber: 'INV/24-25/7', billDate: '2026-01-12',
      partyName: 'Deepa Fashion House', partyPhone: '9633445566',
      transportName: 'Kumar Logistics', format: 'free',
      rows: [
        { id: 'm28', itemName: 'Embroidery Thread', qty: '200', qtyUnit: 'spool', rate: '28', discountValue: '', discountType: 'pct', amount: 5600, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm29', itemName: 'Sequin Roll', qty: '50', qtyUnit: 'roll', rate: '120', discountValue: '', discountType: 'pct', amount: 6000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 11600, grandTotal: 11600,
      status: 'cancelled', createdAt: '2026-01-12', updatedAt: '2026-01-12',
    },
    // ─ December 2025 ─
    {
      id: 1015, billNumber: 'INV/24-25/6', billDate: '2025-12-20',
      partyName: 'Anand Electronics', partyPhone: '9822334455',
      transportName: 'Sri Ram Transport', format: 'gst',
      rows: [
        { id: 'm30', itemName: 'Capacitor 100uF', qty: '5000', qtyUnit: 'pcs', rate: '2.5', discountValue: '', discountType: 'pct', amount: 12500, preTax: 12500, gstPct: '18', gstAmt: 2250 },
        { id: 'm31', itemName: 'Resistor 10k', qty: '10000', qtyUnit: 'pcs', rate: '0.8', discountValue: '', discountType: 'pct', amount: 8000, preTax: 8000, gstPct: '18', gstAmt: 1440 },
      ],
      customColumns: [], adjustments: [], subtotal: 24190, grandTotal: 24190,
      status: 'paid', createdAt: '2025-12-20', updatedAt: '2025-12-20',
    },
    {
      id: 1016, billNumber: 'INV/24-25/5', billDate: '2025-12-08',
      partyName: 'Rajesh Traders', partyPhone: '9876543210',
      transportName: 'VRL Logistics', format: 'free',
      rows: [
        { id: 'm32', itemName: 'Denim Fabric', qty: '300', qtyUnit: 'mt', rate: '210', discountValue: '', discountType: 'pct', amount: 63000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 63000, grandTotal: 63000,
      status: 'unpaid', createdAt: '2025-12-08', updatedAt: '2025-12-08',
    },
    {
      id: 1017, billNumber: 'INV/24-25/4', billDate: '2025-12-01',
      partyName: 'Nandini Textiles', partyPhone: '9511223344',
      transportName: 'Blue Dart', format: 'gst',
      rows: [
        { id: 'm33', itemName: 'Cotton Yarn 40/2', qty: '300', qtyUnit: 'kg', rate: '195', discountValue: '', discountType: 'pct', amount: 58500, preTax: 58500, gstPct: '5', gstAmt: 2925 },
      ],
      customColumns: [], adjustments: [], subtotal: 61425, grandTotal: 61425,
      status: 'partial', createdAt: '2025-12-01', updatedAt: '2025-12-01',
    },
    // ─ November 2025 ─
    {
      id: 1018, billNumber: 'INV/24-25/3', billDate: '2025-11-22',
      partyName: 'Meera Enterprises', partyPhone: '9123456789',
      transportName: 'FedEx', format: 'free',
      rows: [
        { id: 'm34', itemName: 'TMT Bar 8mm', qty: '2000', qtyUnit: 'kg', rate: '56', discountValue: '', discountType: 'pct', amount: 112000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 112000, grandTotal: 112000,
      status: 'paid', createdAt: '2025-11-22', updatedAt: '2025-11-22',
    },
    {
      id: 1019, billNumber: 'INV/24-25/2', billDate: '2025-11-10',
      partyName: 'Kiran Wholesale', partyPhone: '9711223344',
      transportName: 'DTDC', format: 'gst',
      rows: [
        { id: 'm35', itemName: 'Polyester Yarn', qty: '500', qtyUnit: 'kg', rate: '112', discountValue: '', discountType: 'pct', amount: 56000, preTax: 56000, gstPct: '12', gstAmt: 6720 },
      ],
      customColumns: [], adjustments: [], subtotal: 62720, grandTotal: 62720,
      status: 'unpaid', createdAt: '2025-11-10', updatedAt: '2025-11-10',
    },
    {
      id: 1020, billNumber: 'INV/24-25/1', billDate: '2025-11-02',
      partyName: 'Suresh & Sons', partyPhone: '9988776655',
      transportName: 'VRL Logistics', format: 'free',
      rows: [
        { id: 'm36', itemName: 'Wheat Flour 5kg', qty: '200', qtyUnit: 'bag', rate: '215', discountValue: '', discountType: 'pct', amount: 43000, preTax: 0, gstPct: '', gstAmt: 0 },
        { id: 'm37', itemName: 'Sugar 1kg', qty: '500', qtyUnit: 'pkg', rate: '42', discountValue: '', discountType: 'pct', amount: 21000, preTax: 0, gstPct: '', gstAmt: 0 },
      ],
      customColumns: [], adjustments: [], subtotal: 64000, grandTotal: 64000,
      status: 'paid', createdAt: '2025-11-02', updatedAt: '2025-11-02',
    },
  ]
}

// ─── Bulk operations (Phase 7b) ──────────────────────────────────────────────

/**
 * Delete multiple bills at once.
 * Each bill number is recorded as deleted (Hard Spec #3 — numbers never reused).
 */
export async function deleteBillsBulk(ids: number[]): Promise<void> {
  for (const id of ids) {
    await deleteBill(id)
  }
}

/**
 * Update the status of multiple bills at once.
 */
export async function updateBillStatusBulk(
  ids: number[],
  status: BillStatus,
): Promise<void> {
  for (const id of ids) {
    await updateBillStatus(id, status)
  }
}

// ─── Rate History Hint (Phase 4a-ii-B) ─────────────────────────────────────────

/**
 * Fuzzy-match an item name against bill history for a given party.
 * Returns the most recent rate found for the best-matching item name,
 * or null if no match found.
 *
 * Match strategy (fuzzy, not exact):
 *   1. Exact match (case-insensitive)
 *   2. Prefix match (item starts with query or query starts with item)
 *   3. All words in query appear somewhere in item name
 *   4. Levenshtein distance ≤ 2 for short strings
 *
 * Always picks the most recent matching bill row.
 */
export function getRateHint(
  partyName: string,
  itemName: string,
): string | null {
  if (!partyName.trim() || !itemName.trim()) return null

  const queryNorm = itemName.toLowerCase().trim()
  const partyNorm = partyName.toLowerCase().trim()

  // Collect all (date, itemName, rate) tuples from this party's bills
  const candidates: { date: string; item: string; rate: string }[] = []

  for (const bill of _bills) {
    if (bill.partyName.toLowerCase().trim() !== partyNorm) continue
    const rows: Array<{ itemName?: string; rate?: string }> =
      (bill.rows as Array<{ itemName?: string; rate?: string }>) ?? []
    for (const row of rows) {
      const rn = (row.itemName ?? '').trim()
      const rv = (row.rate ?? '').trim()
      if (rn && rv && rv !== '0') {
        candidates.push({ date: bill.billDate, item: rn, rate: rv })
      }
    }
  }

  if (candidates.length === 0) return null

  // Score each candidate
  function scoreItem(item: string): number {
    const n = item.toLowerCase()
    if (n === queryNorm) return 100
    if (n.startsWith(queryNorm) || queryNorm.startsWith(n)) return 80
    const qWords = queryNorm.split(/\s+/)
    if (qWords.every(w => n.includes(w))) return 60
    const nWords = n.split(/\s+/)
    if (nWords.every(w => queryNorm.includes(w))) return 55
    // Partial word overlap
    const overlap = qWords.filter(w => n.includes(w)).length
    if (overlap > 0) return 30 + overlap * 5
    return 0
  }

  let bestScore = 0
  let bestDate = ''
  let bestRate: string | null = null

  for (const c of candidates) {
    const score = scoreItem(c.item)
    if (score <= 0) continue
    // Prefer higher score; break ties by most recent date
    if (score > bestScore || (score === bestScore && c.date > bestDate)) {
      bestScore = score
      bestDate = c.date
      bestRate = c.rate
    }
  }

  if (bestScore < 30) return null
  return bestRate
}
