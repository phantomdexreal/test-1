/**
 * cQikly — Customer Service
 * Built in: Phase 4b-i (base) | Expanded: Phase 8a (full CRUD, groups, credit limit, outstanding)
 *
 * Responsibilities:
 *   - Full customer CRUD (add, edit, delete)
 *   - Fuzzy search across customers (Fuse.js)
 *   - Per-customer transport memory (Hard Spec #17)
 *   - Auto-create customer on first bill save (Hard Spec #4)
 *   - Transporter list management (saved in config/settings)
 *   - Customer groups (filtering, bulk actions)
 *   - Outstanding balance calculation (auto from bills)
 *   - Bill count per customer (auto from bills)
 *   - Credit limit warning system
 *   - Excel import/export (SheetJS)
 *
 * Architecture: All data access goes through this service.
 * Components never call DB directly.
 */

import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import type { CustomerRecord, BillRecord } from './db.service'

export type { CustomerRecord }

// ─── Extended customer record with computed fields ───────────────────────────

export interface CustomerWithStats extends CustomerRecord {
  billCount: number
  outstandingBalance: number
  totalBilled: number
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

let _customerCache: CustomerRecord[] = []
let _fuseCustomers: Fuse<CustomerRecord> | null = null

let _transporterList: string[] = []
let _fuseTransporters: Fuse<{ name: string }> | null = null

// ─── IPC helpers ─────────────────────────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

// ─── Customer fuzzy search ────────────────────────────────────────────────────

const FUSE_CUSTOMER_OPTIONS: IFuseOptions<CustomerRecord> = {
  keys: ['partyName', 'phoneNo', 'mobileNo', 'email', 'gstin', 'panNo', 'contactPerson'],
  threshold: 0.35,
  minMatchCharLength: 1,
  includeScore: true,
  shouldSort: true,
}

// ─── Persistence helpers (dev/browser localStorage) ──────────────────────────

function _saveCustomersToStorage(customers: CustomerRecord[]): void {
  try { localStorage.setItem('cq:customers', JSON.stringify(customers)) } catch { /* ignore */ }
}

function _loadCustomersFromStorage(): CustomerRecord[] {
  try {
    const stored = localStorage.getItem('cq:customers')
    if (stored) return JSON.parse(stored) as CustomerRecord[]
  } catch { /* ignore */ }
  return _getDevMockCustomers()
}

// ─── Load / Refresh ──────────────────────────────────────────────────────────

export async function loadCustomers(): Promise<CustomerRecord[]> {
  const ipc = getIpc()
  if (ipc) {
    try {
      const result = await ipc.db.query(
        `SELECT id, party_name as partyName, address, customer_group as "group", pincode, state_name as stateName,
                contact_person as contactPerson, phone as phoneNo, mobile as mobileNo, email, website,
                pan_number as panNo, gstin, reg_type as regType, credit_limit as creditLimit,
                transport_name as lastTransportName, internal_notes as internalNotes,
                customer_since as customerSinceDate, created_at as createdAt
         FROM customers WHERE deleted_at IS NULL ORDER BY party_name COLLATE NOCASE`,
        []
      )
      _customerCache = (result as CustomerRecord[]) || []
    } catch {
      _customerCache = _loadCustomersFromStorage()
    }
  } else {
    _customerCache = _loadCustomersFromStorage()
  }

  _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
  return _customerCache
}

export function searchCustomers(query: string, limit = 8): CustomerRecord[] {
  if (!query.trim()) return []
  if (!_fuseCustomers) _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
  return _fuseCustomers.search(query, { limit }).map(r => r.item)
}

export function getCustomerByName(name: string): CustomerRecord | null {
  const normalized = name.trim().toLowerCase()
  return _customerCache.find(c => (c.partyName ?? '').toLowerCase() === normalized) ?? null
}

export function getAllCustomers(): CustomerRecord[] {
  return [..._customerCache]
}

export function getCustomerGroups(): string[] {
  const groups = new Set<string>()
  for (const c of _customerCache) {
    if (c.group?.trim()) groups.add(c.group.trim())
  }
  return Array.from(groups).sort()
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function addCustomer(data: Omit<CustomerRecord, 'id' | 'createdAt'>): Promise<number> {
  const ipc = getIpc()
  if (!ipc) {
    const newId = Date.now()
    const record: CustomerRecord = { ...data, id: newId, createdAt: new Date().toISOString() }
    _customerCache.push(record)
    _customerCache.sort((a, b) => (a.partyName ?? '').localeCompare(b.partyName ?? ''))
    _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
    _saveCustomersToStorage(_customerCache)
    return newId
  }

  try {
    const result = await ipc.db.run(
      `INSERT INTO customers
        (party_name, address, customer_group, pincode, state_name, contact_person, phone, mobile, email,
         website, pan_number, gstin, reg_type, credit_limit, transport_name, internal_notes,
         customer_since, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
      [
        data.partyName, data.address ?? null, data.group ?? null, data.pincode ?? null,
        data.stateName ?? null, data.contactPerson ?? null, data.phoneNo ?? null,
        data.mobileNo ?? null, data.email ?? null, data.website ?? null, data.panNo ?? null,
        data.gstin ?? null, data.regType ?? null, data.creditLimit ?? null,
        data.lastTransportName ?? null, data.internalNotes ?? null, data.customerSinceDate ?? null,
      ]
    )
    const newId = (result as { lastInsertRowid: number }).lastInsertRowid
    await loadCustomers()
    return newId
  } catch (err) {
    console.error('[CustomerService] addCustomer failed:', err)
    return 0
  }
}

export async function updateCustomer(id: number, partial: Partial<CustomerRecord>): Promise<void> {
  const idx = _customerCache.findIndex(c => c.id === id)
  if (idx !== -1) _customerCache[idx] = { ..._customerCache[idx], ...partial }
  _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
  _saveCustomersToStorage(_customerCache)

  const ipc = getIpc()
  if (!ipc) return

  const fieldMap: Record<string, string> = {
    partyName: 'party_name', address: 'address', group: 'customer_group', pincode: 'pincode',
    stateName: 'state_name', contactPerson: 'contact_person', phoneNo: 'phone',
    mobileNo: 'mobile', email: 'email', website: 'website', panNo: 'pan_number',
    gstin: 'gstin', regType: 'reg_type', creditLimit: 'credit_limit',
    lastTransportName: 'transport_name', internalNotes: 'internal_notes',
    customerSinceDate: 'customer_since',
  }

  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, val] of Object.entries(partial)) {
    const col = fieldMap[key]
    if (col) { sets.push(`${col} = ?`); params.push(val ?? null) }
  }
  if (sets.length === 0) return

  sets.push(`updated_at = datetime('now')`)
  params.push(id)

  try {
    await ipc.db.run(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`, params)
  } catch (err) {
    console.error('[CustomerService] updateCustomer failed:', err)
  }
}

export async function deleteCustomer(id: number): Promise<void> {
  _customerCache = _customerCache.filter(c => c.id !== id)
  _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
  _saveCustomersToStorage(_customerCache)

  const ipc = getIpc()
  if (!ipc) return
  try {
    await ipc.db.run(`UPDATE customers SET deleted_at = datetime('now') WHERE id = ?`, [id])
  } catch (err) {
    console.error('[CustomerService] deleteCustomer failed:', err)
  }
}

export async function deleteCustomers(ids: number[]): Promise<void> {
  for (const id of ids) await deleteCustomer(id)
}

// ─── Outstanding balance + bill count (computed from bills) ──────────────────

export interface CustomerStats {
  billCount: number
  outstandingBalance: number
  totalBilled: number
}

export function computeCustomerStats(bills: BillRecord[]): Map<string, CustomerStats> {
  const map = new Map<string, CustomerStats>()
  for (const bill of bills) {
    const key = (bill.partyName ?? '').toLowerCase()
    if (!key) continue
    const existing = map.get(key) ?? { billCount: 0, outstandingBalance: 0, totalBilled: 0 }
    existing.billCount += 1
    existing.totalBilled += bill.grandTotal ?? 0
    if (bill.status === 'unpaid' || bill.status === 'partial') {
      existing.outstandingBalance += bill.grandTotal ?? 0
    }
    map.set(key, existing)
  }
  return map
}

export function mergeCustomerStats(
  customers: CustomerRecord[],
  statsMap: Map<string, CustomerStats>
): CustomerWithStats[] {
  return customers.map(c => {
    const key = (c.partyName ?? '').toLowerCase()
    const stats = statsMap.get(key) ?? { billCount: 0, outstandingBalance: 0, totalBilled: 0 }
    return { ...c, ...stats }
  })
}

// ─── Credit limit check ───────────────────────────────────────────────────────

export function wouldExceedCreditLimit(
  customer: CustomerRecord,
  currentOutstanding: number,
  newBillAmount: number
): { exceeds: boolean; limit: number; projected: number } {
  if (!customer.creditLimit || customer.creditLimit <= 0) {
    return { exceeds: false, limit: 0, projected: 0 }
  }
  const projected = currentOutstanding + newBillAmount
  return { exceeds: projected > customer.creditLimit, limit: customer.creditLimit, projected }
}

// ─── Excel import (SheetJS) ──────────────────────────────────────────────────

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importCustomersFromExcel(buffer: ArrayBuffer): Promise<ImportResult> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const partyName = String(row['Party Name'] ?? row['party_name'] ?? row['PARTY NAME'] ?? '').trim()
    if (!partyName) { result.skipped++; continue }

    const existing = getCustomerByName(partyName)
    if (existing) { result.skipped++; continue }

    try {
      await addCustomer({
        partyName,
        address: String(row['Address'] ?? row['ADDRESS'] ?? '').trim() || undefined,
        group: String(row['Group'] ?? row['GROUP'] ?? '').trim() || undefined,
        pincode: String(row['Pincode'] ?? row['PINCODE'] ?? row['Pin Code'] ?? '').trim() || undefined,
        stateName: String(row['State Name'] ?? row['STATE NAME'] ?? row['State'] ?? '').trim() || undefined,
        contactPerson: String(row['Contact Person'] ?? row['CONTACT PERSON'] ?? '').trim() || undefined,
        phoneNo: String(row['Phone No'] ?? row['PHONE NO'] ?? row['Phone'] ?? '').trim() || undefined,
        mobileNo: String(row['Mobile No'] ?? row['MOBILE NO'] ?? row['Mobile'] ?? '').trim() || undefined,
        email: String(row['Email'] ?? row['EMAIL'] ?? '').trim() || undefined,
        website: String(row['Website'] ?? row['WEBSITE'] ?? '').trim() || undefined,
        panNo: String(row['PAN No'] ?? row['PAN NO'] ?? row['Pan No'] ?? '').trim() || undefined,
        gstin: String(row['GSTIN'] ?? row['Gstin'] ?? '').trim() || undefined,
        regType: String(row['Reg Type'] ?? row['REG TYPE'] ?? row['Reg. Type'] ?? '').trim() || undefined,
      })
      result.imported++
    } catch (err) {
      result.errors.push(`Row ${i + 2}: ${String(err)}`)
    }
  }

  return result
}

export async function exportCustomersToExcel(customers: CustomerRecord[]): Promise<Blob> {
  const XLSX = await import('xlsx')

  const rows = customers.map((c, i) => ({
    'Sr No': i + 1,
    'Party Name': c.partyName ?? '',
    'Address': c.address ?? '',
    'Group': c.group ?? '',
    'Pincode': c.pincode ?? '',
    'State Name': c.stateName ?? '',
    'Contact Person': c.contactPerson ?? '',
    'Phone No': c.phoneNo ?? '',
    'Mobile No': c.mobileNo ?? '',
    'Email': c.email ?? '',
    'Website': c.website ?? '',
    'PAN No': c.panNo ?? '',
    'GSTIN': c.gstin ?? '',
    'Reg Type': c.regType ?? '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Customers')

  ws['!cols'] = [
    { wch: 6 }, { wch: 28 }, { wch: 30 }, { wch: 16 }, { wch: 10 },
    { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
  ]

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ─── Transporter fuzzy search ─────────────────────────────────────────────────

const FUSE_TRANSPORTER_OPTIONS: IFuseOptions<{ name: string }> = {
  keys: ['name'], threshold: 0.4, minMatchCharLength: 1, includeScore: true, shouldSort: true,
}

export async function loadTransporters(): Promise<string[]> {
  const ipc = getIpc()
  if (ipc) {
    try {
      const config = await ipc.settings.read()
      const raw = config['transporterList']
      if (typeof raw === 'string') _transporterList = JSON.parse(raw) as string[]
      else if (Array.isArray(raw)) _transporterList = raw as string[]
    } catch {
      _transporterList = _getDevMockTransporters()
    }
  } else {
    _transporterList = _getDevMockTransporters()
  }
  _fuseTransporters = new Fuse(_transporterList.map(name => ({ name })), FUSE_TRANSPORTER_OPTIONS)
  return _transporterList
}

export function searchTransporters(query: string, limit = 6): string[] {
  if (!query.trim()) return []
  if (!_fuseTransporters) {
    _fuseTransporters = new Fuse(_transporterList.map(name => ({ name })), FUSE_TRANSPORTER_OPTIONS)
  }
  return _fuseTransporters.search(query, { limit }).map(r => r.item.name)
}

export async function addTransporterToList(transportName: string): Promise<void> {
  const trimmed = transportName.trim()
  if (!trimmed || _transporterList.includes(trimmed)) return
  _transporterList = [trimmed, ..._transporterList]
  _fuseTransporters = new Fuse(_transporterList.map(name => ({ name })), FUSE_TRANSPORTER_OPTIONS)
  const ipc = getIpc()
  if (ipc) {
    try { await ipc.settings.write({ transporterList: JSON.stringify(_transporterList) }) } catch { /* ignore */ }
  } else {
    try { localStorage.setItem('cq:transporterList', JSON.stringify(_transporterList)) } catch { /* ignore */ }
  }
}

// ─── Per-customer transport memory (Hard Spec #17) ───────────────────────────

export async function updateCustomerTransport(customerId: number, transportName: string): Promise<void> {
  const ipc = getIpc()
  if (!ipc) {
    const c = _customerCache.find(x => x.id === customerId)
    if (c) c.lastTransportName = transportName
    _saveCustomersToStorage(_customerCache)
    return
  }
  try {
    await ipc.db.run(
      `UPDATE customers SET transport_name = ?, updated_at = datetime('now') WHERE id = ?`,
      [transportName, customerId]
    )
    const c = _customerCache.find(x => x.id === customerId)
    if (c) c.lastTransportName = transportName
  } catch (err) {
    console.error('[CustomerService] Failed to update transport:', err)
  }
}

// ─── Auto-create customer on first bill save (Hard Spec #4) ──────────────────

export interface NewCustomerFromBill {
  partyName: string
  phoneNo?: string
  lastTransportName?: string
  address?: string
  gstin?: string
  internalNotes?: string
  /** ISO date of the bill being saved — used to auto-set customer_since on first bill */
  billDate?: string
}

export async function ensureCustomerExists(data: NewCustomerFromBill): Promise<number | null> {
  const existing = getCustomerByName(data.partyName)

  if (existing?.id) {
    const updates: string[] = []
    const params: (string | null)[] = []

    if (!existing.phoneNo && data.phoneNo) { updates.push('phone = ?'); params.push(data.phoneNo); existing.phoneNo = data.phoneNo }
    if (!existing.address && data.address) { updates.push('address = ?'); params.push(data.address); existing.address = data.address }
    if (!existing.gstin && data.gstin) { updates.push('gstin = ?'); params.push(data.gstin); existing.gstin = data.gstin }
    if (!existing.internalNotes && data.internalNotes) { updates.push('internal_notes = ?'); params.push(data.internalNotes); existing.internalNotes = data.internalNotes }

    // Auto-set customer_since from first bill date if not already set (Phase 8b-i)
    if (!existing.customerSinceDate && data.billDate) {
      updates.push('customer_since = ?')
      params.push(data.billDate)
      existing.customerSinceDate = data.billDate
    } else if (existing.customerSinceDate && data.billDate && data.billDate < existing.customerSinceDate) {
      // Backdated bill — update customer_since to earlier date
      updates.push('customer_since = ?')
      params.push(data.billDate)
      existing.customerSinceDate = data.billDate
    }

    if (updates.length > 0) {
      params.push(String(existing.id))
      const ipc = getIpc()
      if (ipc) {
        try {
          await ipc.db.run(
            `UPDATE customers SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
            params
          )
        } catch (err) { console.error('[CustomerService] Failed to patch customer:', err) }
      } else {
        _saveCustomersToStorage(_customerCache)
      }
    }
    return existing.id
  }

  return await addCustomer({
    partyName: data.partyName,
    phoneNo: data.phoneNo,
    lastTransportName: data.lastTransportName,
    address: data.address,
    gstin: data.gstin,
    internalNotes: data.internalNotes,
    // Auto-set customer_since from first bill date (Phase 8b-i)
    customerSinceDate: data.billDate ?? undefined,
  })
}

// ─── Dev/Browser mock data ────────────────────────────────────────────────────

function _getDevMockCustomers(): CustomerRecord[] {
  return [
    {
      id: 1, partyName: 'Rajesh Traders', address: '12, MG Road, Bengaluru',
      group: 'Wholesale', pincode: '560001', stateName: 'Karnataka',
      contactPerson: 'Rajesh Kumar', phoneNo: '9876543210', mobileNo: '9876543210',
      email: 'rajesh@traders.com', website: 'www.rajeshtraders.com',
      panNo: 'ABCDE1234F', gstin: '29ABCDE1234F1Z5', regType: 'Regular',
      creditLimit: 100000, lastTransportName: 'Sri Ram Transport', createdAt: '2024-01-15',
    },
    {
      id: 2, partyName: 'Meera Enterprises', address: '45, Commercial Street, Bengaluru',
      group: 'Retail', pincode: '560001', stateName: 'Karnataka',
      contactPerson: 'Meera Singh', phoneNo: '9123456789', mobileNo: '9123456789',
      email: 'meera@enterprises.com', gstin: '', regType: 'Unregistered',
      creditLimit: 50000, lastTransportName: 'Kumar Logistics', createdAt: '2024-02-20',
    },
    {
      id: 3, partyName: 'Suresh & Sons', address: 'Gandhi Nagar, Hubli',
      group: 'Wholesale', pincode: '580001', stateName: 'Karnataka',
      contactPerson: 'Suresh Patil', phoneNo: '9988776655', mobileNo: '9988776655',
      email: 'suresh@sons.in', panNo: 'FGHIJ5678K', gstin: '29FGHIJ5678K1Z5', regType: 'Regular',
      creditLimit: 0, lastTransportName: 'VRL Logistics', createdAt: '2024-03-10',
    },
    {
      id: 4, partyName: 'Lakshmi Wholesale', address: 'Chickpet, Bengaluru',
      group: 'Wholesale', pincode: '560053', stateName: 'Karnataka',
      contactPerson: 'Lakshmi Devi', phoneNo: '8765432109', mobileNo: '8765432109',
      email: 'lakshmi@wholesale.com', regType: 'Composition',
      creditLimit: 75000, lastTransportName: '', createdAt: '2024-04-05',
    },
    {
      id: 5, partyName: 'Karnataka Distributors', address: 'KR Market, Bengaluru',
      group: 'Distributor', pincode: '560002', stateName: 'Karnataka',
      contactPerson: 'Venkat Rao', phoneNo: '7654321098', mobileNo: '7654321098',
      email: 'info@karnatakadist.com', website: 'www.karnatakadist.com',
      panNo: 'LMNOP9012Q', gstin: '29LMNOP9012Q1Z5', regType: 'Regular',
      creditLimit: 200000, lastTransportName: 'KSRTC Cargo', createdAt: '2024-05-01',
    },
    {
      id: 6, partyName: 'Pooja Fabrics', address: '8, Textile Market, Surat',
      group: 'Retail', pincode: '395002', stateName: 'Gujarat',
      contactPerson: 'Pooja Shah', phoneNo: '9090909090', mobileNo: '9090909090',
      email: 'pooja@fabrics.in', gstin: '24RSTUV3456W1Z5', regType: 'Regular',
      creditLimit: 30000, createdAt: '2024-05-15',
    },
    {
      id: 7, partyName: 'North Star Trading Co', address: 'Chandni Chowk, Delhi',
      group: 'Wholesale', pincode: '110006', stateName: 'Delhi',
      contactPerson: 'Ramesh Gupta', phoneNo: '9811223344', mobileNo: '9811223344',
      email: 'northstar@trading.co.in', panNo: 'WXYZ1234A', gstin: '07WXYZ1234A1Z5', regType: 'Regular',
      creditLimit: 500000, lastTransportName: 'Gati Express', createdAt: '2024-06-01',
    },
  ]
}

function _getDevMockTransporters(): string[] {
  try {
    const stored = localStorage.getItem('cq:transporterList')
    if (stored) return JSON.parse(stored) as string[]
  } catch { /* ignore */ }
  return [
    'Sri Ram Transport', 'Kumar Logistics', 'VRL Logistics', 'KSRTC Cargo',
    'Gati Express', 'Blue Dart', 'DTDC', 'Delhivery', 'Mahindra Logistics', 'TCI Express',
  ]
}

// Initialize with dev mock on import in non-Electron env
if (typeof window !== 'undefined' && !(window as Window & { cqApi?: unknown }).cqApi) {
  _customerCache = _loadCustomersFromStorage()
  _fuseCustomers = new Fuse(_customerCache, FUSE_CUSTOMER_OPTIONS)
  _transporterList = _getDevMockTransporters()
  _fuseTransporters = new Fuse(_transporterList.map(name => ({ name })), FUSE_TRANSPORTER_OPTIONS)
}
