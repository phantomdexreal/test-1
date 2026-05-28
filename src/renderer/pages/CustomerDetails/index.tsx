/**
 * cQikly — Customer Details Page
 * Built: Phase 8a
 *
 * Features:
 *   - Full customer table: Party Name, Address, Group, Pincode, State Name,
 *     Contact Person, Phone No, Mobile No, Email, Website, PAN No, GSTIN,
 *     Reg Type, Credit Limit, Outstanding Balance (all columns)
 *   - Add / Edit / Delete customers
 *   - Excel import (exact defined column format)
 *   - Excel export (same column format)
 *   - Bill count per customer (auto-calculated from bills DB)
 *   - Outstanding balance per customer (auto-calculated)
 *   - Customer groups — group-based filtering + bulk actions
 *   - Credit limit system: warn when bill would exceed limit
 *   - Fuzzy search (Fuse.js) across name, phone, email, GSTIN
 *   - Column visibility toggle
 *   - Select all / bulk delete
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Fuse from 'fuse.js'
import {
  loadCustomers, getAllCustomers, getCustomerGroups,
  addCustomer, updateCustomer, deleteCustomer,
  mergeCustomerStats, computeCustomerStats,
  importCustomersFromExcel, exportCustomersToExcel,
} from '../../services/customer.service'
import type { CustomerWithStats } from '../../services/customer.service'
import type { CustomerRecord } from '../../services/db.service'
import { getBills } from '../../services/bill.service'
import type { BillRecord } from '../../services/db.service'
import CustomerFormModal from './CustomerFormModal'
import CustomerLedgerModal from './CustomerLedgerModal'
import PaymentRecorderModal from './PaymentRecorderModal'
import { eventBus } from '../../utils/eventBus'

// ─── Column definitions ───────────────────────────────────────────────────────

const ALL_COLS = [
  { key: 'address', label: 'Address' },
  { key: 'group', label: 'Group' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'stateName', label: 'State' },
  { key: 'contactPerson', label: 'Contact Person' },
  { key: 'phoneNo', label: 'Phone No' },
  { key: 'mobileNo', label: 'Mobile No' },
  { key: 'email', label: 'Email' },
  { key: 'website', label: 'Website' },
  { key: 'panNo', label: 'PAN No' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'regType', label: 'Reg Type' },
  { key: 'creditLimit', label: 'Credit Limit' },
]

const DEFAULT_VISIBLE = ['address', 'group', 'phoneNo', 'gstin', 'regType', 'creditLimit']

// ─── Fuzzy search ─────────────────────────────────────────────────────────────

function buildFuse(customers: CustomerWithStats[]) {
  return new Fuse(customers, {
    keys: ['partyName', 'phoneNo', 'mobileNo', 'email', 'gstin', 'panNo', 'contactPerson', 'address'],
    threshold: 0.35, minMatchCharLength: 1, includeScore: true, shouldSort: true,
  })
}

// ─── Delete Confirmation ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  targets, onConfirm, onCancel,
}: { targets: CustomerWithStats[]; onConfirm: () => void; onCancel: () => void }): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1e1e2a] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-white font-semibold text-lg mb-2">Delete {targets.length > 1 ? `${targets.length} customers` : 'customer'}?</h3>
        <p className="text-white/50 text-sm mb-4">
          {targets.length === 1
            ? <>Remove <strong className="text-white">{targets[0].partyName}</strong>? This cannot be undone.</>
            : <>This will permanently delete {targets.length} customers.</>}
        </p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Result Modal ──────────────────────────────────────────────────────

function ImportResultModal({
  imported, skipped, errors, onClose,
}: { imported: number; skipped: number; errors: string[]; onClose: () => void }): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1e1e2a] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-white font-semibold text-lg mb-3">Import Complete</h3>
        <div className="space-y-2 mb-4">
          <p className="text-emerald-400 text-sm">✓ {imported} customers imported</p>
          {skipped > 0 && <p className="text-amber-400 text-sm">⚠ {skipped} rows skipped (duplicate or missing name)</p>}
          {errors.length > 0 && (
            <div>
              <p className="text-red-400 text-sm">{errors.length} error{errors.length > 1 ? 's' : ''}:</p>
              <ul className="text-red-300 text-xs mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
        <button onClick={onClose} className="w-full py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9c71fa] text-white font-semibold text-sm transition-colors">Done</button>
      </div>
    </div>
  )
}

// ─── Column Picker ────────────────────────────────────────────────────────────

function ColumnPicker({
  visible, onChange, onClose,
}: { visible: string[]; onChange: (cols: string[]) => void; onClose: () => void }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function toggle(key: string) {
    if (visible.includes(key)) onChange(visible.filter(k => k !== key))
    else onChange([...visible, key])
  }

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-40 bg-[#1e1e2a] border border-white/10 rounded-xl shadow-2xl p-3 w-48">
      <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Show Columns</p>
      {ALL_COLS.map(c => (
        <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-white/5 rounded px-1">
          <input
            type="checkbox"
            checked={visible.includes(c.key)}
            onChange={() => toggle(c.key)}
            className="accent-[#a78bfa]"
          />
          <span className="text-white/70 text-xs">{c.label}</span>
        </label>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDetailsPage(): React.ReactElement {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQ, setSearchQ] = useState('')
  const [groupFilter, setGroupFilter] = useState('All')
  const [groups, setGroups] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<keyof CustomerWithStats>('partyName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE)
  const [showColPicker, setShowColPicker] = useState(false)

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CustomerWithStats | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerWithStats[] | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null)

  // Phase 8b-i: Ledger modal
  const [ledgerTarget, setLedgerTarget] = useState<{ customer: CustomerWithStats; bills: BillRecord[] } | null>(null)
  const allBillsRef = React.useRef<BillRecord[]>([])
  // Phase 8b-ii: Payment Recorder modal
  const [paymentTarget, setPaymentTarget] = useState<CustomerWithStats | null>(null)


  const fileInputRef = useRef<HTMLInputElement>(null)
  const fuseRef = useRef<Fuse<CustomerWithStats> | null>(null)

  // ─── Load data ──────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      await loadCustomers()
      const raw = getAllCustomers()
      const bills = await getBills()
      allBillsRef.current = bills  // Phase 8b-i: cache for ledger
      const statsMap = computeCustomerStats(bills)
      const withStats = mergeCustomerStats(raw, statsMap)
      setCustomers(withStats)
      setGroups(getCustomerGroups())
      fuseRef.current = buildFuse(withStats)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // ─── Phase 12b: navigate-to-customer from command palette ──────────────────
  useEffect(() => {
    return eventBus.on('navigateToCustomer', ({ customerId }) => {
      // Put the target customer's name in the search box so it surfaces immediately
      const target = customers.find(c => c.id === customerId)
      if (target) setSearchQ(target.partyName)
    })
  }, [customers])

  const filtered = React.useMemo(() => {
    let list = customers

    // Group filter
    if (groupFilter !== 'All') {
      list = list.filter(c => c.group === groupFilter)
    }

    // Fuzzy search
    if (searchQ.trim()) {
      if (fuseRef.current) {
        list = fuseRef.current.search(searchQ, { limit: 200 }).map(r => r.item)
      }
    }

    // Sort
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'en-IN')
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [customers, searchQ, groupFilter, sortKey, sortDir])

  // ─── Rebuild fuse when customers change ─────────────────────────────────────

  useEffect(() => { fuseRef.current = buildFuse(customers) }, [customers])

  // ─── Selection ──────────────────────────────────────────────────────────────

  function toggleSelect(id: number, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) setSelected(new Set(filtered.map(c => c.id!).filter(Boolean)))
    else setSelected(new Set())
  }

  const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id!))
  const someSelected = selected.size > 0

  // ─── Sort handler ────────────────────────────────────────────────────────────

  function handleSort(key: keyof CustomerWithStats) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  // ─── CRUD handlers ──────────────────────────────────────────────────────────

  async function handleAdd(data: Omit<CustomerRecord, 'id' | 'createdAt'>) {
    await addCustomer(data)
    setAddOpen(false)
    await refresh()
  }

  async function handleEdit(data: Omit<CustomerRecord, 'id' | 'createdAt'>) {
    if (!editTarget?.id) return
    await updateCustomer(editTarget.id, data)
    setEditTarget(null)
    await refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    for (const c of deleteTarget) {
      if (c.id) await deleteCustomer(c.id)
    }
    setSelected(new Set())
    setDeleteTarget(null)
    await refresh()
  }

  async function handleBulkDelete() {
    const targets = filtered.filter(c => selected.has(c.id!))
    setDeleteTarget(targets)
  }

  // Phase 8b-i: Open per-customer ledger
  function openLedger(customer: CustomerWithStats) {
    const customerBills = allBillsRef.current.filter(
      b => b.partyName.trim().toLowerCase() === (customer.partyName ?? '').trim().toLowerCase()
    )
    setLedgerTarget({ customer, bills: customerBills })
  }

  // Phase 8b-ii: Open payment recorder
  function openPaymentRecorder(customer: CustomerWithStats) {
    setPaymentTarget(customer)
  }

  // ─── Excel import ────────────────────────────────────────────────────────────

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const buf = await file.arrayBuffer()
    const result = await importCustomersFromExcel(buf)
    setImportResult(result)
    await refresh()
  }

  // ─── Excel export ────────────────────────────────────────────────────────────

  async function handleExport() {
    const toExport = someSelected
      ? customers.filter(c => selected.has(c.id!))
      : customers
    const blob = await exportCustomersToExcel(toExport)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cQikly_Customers_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Sort indicator ──────────────────────────────────────────────────────────

  function SortIcon({ col }: { col: keyof CustomerWithStats }) {
    if (sortKey !== col) return <span className="ml-1 text-white/20">↕</span>
    return <span className="ml-1 text-[#a78bfa]">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  function Th({ label, col, right }: { label: string; col: keyof CustomerWithStats; right?: boolean }) {
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider cursor-pointer hover:text-white/70 select-none ${right ? 'text-right' : 'text-left'}`}
      >
        {label}<SortIcon col={col} />
      </th>
    )
  }

  // ─── Stats bar ───────────────────────────────────────────────────────────────

  const totalOutstanding = customers.reduce((s, c) => s + c.outstandingBalance, 0)
  const overLimit = customers.filter(c => (c.creditLimit ?? 0) > 0 && c.outstandingBalance > (c.creditLimit ?? 0)).length

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#13131a] text-white overflow-hidden">
      {/* ── Modals ── */}
      {addOpen && (
        <CustomerFormModal mode="add" onSave={handleAdd} onClose={() => setAddOpen(false)} />
      )}
      {editTarget && (
        <CustomerFormModal
          mode="edit"
          initial={editTarget}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          targets={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {importResult && (
        <ImportResultModal
          {...importResult}
          onClose={() => setImportResult(null)}
        />
      )}

      {/* Phase 8b-i: Per-customer ledger modal */}
      {ledgerTarget && (
        <CustomerLedgerModal
          customer={ledgerTarget.customer}
          bills={ledgerTarget.bills}
          onClose={() => setLedgerTarget(null)}
        />
      )}

      {/* Phase 8b-ii: Payment Recorder modal */}
      {paymentTarget && (
        <PaymentRecorderModal
          customer={paymentTarget}
          onClose={() => setPaymentTarget(null)}
          onPaymentChange={() => {
            // Refresh customer list to update outstanding balances
            refresh()
          }}
        />
      )}

      {/* Hidden file input for import */}
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />

      {/* ── Header ── */}
      <div className="px-6 pt-5 pb-4 flex-shrink-0 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-bold tracking-tight">Customer Details</h1>
            <p className="text-white/40 text-sm mt-0.5">
              {customers.length} customers · ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })} outstanding
              {overLimit > 0 && (
                <span className="ml-2 text-red-400">⚠ {overLimit} over credit limit</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Import */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
              title="Import from Excel (Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type)"
            >
              <span>📥</span> Import
            </button>

            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-colors"
              title="Export to Excel"
            >
              <span>📤</span> Export{someSelected ? ` (${selected.size})` : ''}
            </button>

            {/* Add */}
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9c71fa] text-white font-semibold text-sm transition-colors"
            >
              <span>+</span> Add Customer
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar: search + group filter + column toggle ── */}
      <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0 border-b border-white/5">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">🔍</span>
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search name, phone, GSTIN, email…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]/60 placeholder-white/25"
          />
          {searchQ && (
            <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">×</button>
          )}
        </div>

        {/* Group filter */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setGroupFilter('All')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              groupFilter === 'All' ? 'bg-[#a78bfa] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            All
          </button>
          {groups.map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g === groupFilter ? 'All' : g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                groupFilter === g ? 'bg-[#a78bfa] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Results count */}
        <span className="text-white/30 text-xs">
          {filtered.length} / {customers.length}
        </span>

        {/* Column picker */}
        <div className="relative">
          <button
            onClick={() => setShowColPicker(p => !p)}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors"
            title="Toggle columns"
          >
            ⊞ Columns
          </button>
          {showColPicker && (
            <ColumnPicker
              visible={visibleCols}
              onChange={setVisibleCols}
              onClose={() => setShowColPicker(false)}
            />
          )}
        </div>
      </div>

      {/* ── Bulk actions bar ── */}
      {someSelected && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-[#a78bfa]/10 border-b border-[#a78bfa]/20 flex-shrink-0">
          <span className="text-[#a78bfa] text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors"
          >
            🗑 Delete Selected
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium transition-colors"
          >
            📤 Export Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-white/30 hover:text-white text-xs"
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#a78bfa]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-white/30">
            <span className="text-4xl mb-3">👥</span>
            <p className="text-sm">
              {searchQ || groupFilter !== 'All'
                ? 'No customers match your filter.'
                : 'No customers yet. Add one or import from Excel.'}
            </p>
            {!searchQ && groupFilter === 'All' && (
              <button
                onClick={() => setAddOpen(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9c71fa] text-white text-sm font-semibold transition-colors"
              >
                + Add First Customer
              </button>
            )}
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[#13131a] border-b border-white/10">
              <tr>
                {/* Select all */}
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={e => toggleSelectAll(e.target.checked)}
                    className="accent-[#a78bfa] cursor-pointer"
                  />
                </th>

                <Th label="Party Name" col="partyName" />

                {visibleCols.includes('address') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Address</th>
                )}
                {visibleCols.includes('group') && (
                  <Th label="Group" col="group" />
                )}
                {visibleCols.includes('pincode') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Pincode</th>
                )}
                {visibleCols.includes('stateName') && (
                  <Th label="State" col="stateName" />
                )}
                {visibleCols.includes('contactPerson') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Contact</th>
                )}
                {visibleCols.includes('phoneNo') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Phone</th>
                )}
                {visibleCols.includes('mobileNo') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Mobile</th>
                )}
                {visibleCols.includes('email') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Email</th>
                )}
                {visibleCols.includes('website') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Website</th>
                )}
                {visibleCols.includes('panNo') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">PAN</th>
                )}
                {visibleCols.includes('gstin') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">GSTIN</th>
                )}
                {visibleCols.includes('regType') && (
                  <th className="px-3 py-2.5 text-xs font-semibold text-white/40 uppercase tracking-wider text-left">Reg Type</th>
                )}
                {visibleCols.includes('creditLimit') && (
                  <Th label="Credit Limit" col="creditLimit" right />
                )}

                {/* Always visible */}
                <Th label="Bills" col="billCount" />
                <Th label="Outstanding" col="outstandingBalance" right />

                {/* Actions */}
                <th className="px-3 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(customer => (
                <tr
                  key={customer.id}
                  className={`group border-b border-white/5 hover:bg-white/3 transition-colors ${selected.has(customer.id!) ? 'bg-[#a78bfa]/10' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selected.has(customer.id!)}
                      onChange={e => toggleSelect(customer.id!, e.target.checked)}
                      className="accent-[#a78bfa] cursor-pointer"
                    />
                  </td>

                  {/* Party Name */}
                  <td className="px-3 py-2.5 min-w-[140px]">
                    <span className="text-white font-medium text-sm">{customer.partyName}</span>
                    {customer.group && !visibleCols.includes('group') && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#a78bfa]/20 text-[#a78bfa]">{customer.group}</span>
                    )}
                    {customer.internalNotes && (
                      <span className="ml-1 text-[10px] text-amber-400/60" title={`Internal note: ${customer.internalNotes}`}>🔒</span>
                    )}
                    {customer.customerSinceDate && (
                      <div className="text-[10px] text-white/25 mt-0.5">
                        Since {new Date(customer.customerSinceDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </td>

                  {visibleCols.includes('address') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs max-w-[160px] truncate" title={customer.address}>
                      {customer.address || '—'}
                    </td>
                  )}
                  {visibleCols.includes('group') && (
                    <td className="px-3 py-2.5 text-xs">
                      {customer.group ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#a78bfa]/20 text-[#a78bfa]">{customer.group}</span>
                      ) : '—'}
                    </td>
                  )}
                  {visibleCols.includes('pincode') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs">{customer.pincode || '—'}</td>
                  )}
                  {visibleCols.includes('stateName') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs">{customer.stateName || '—'}</td>
                  )}
                  {visibleCols.includes('contactPerson') && (
                    <td className="px-3 py-2.5 text-white/60 text-xs">{customer.contactPerson || '—'}</td>
                  )}
                  {visibleCols.includes('phoneNo') && (
                    <td className="px-3 py-2.5 text-white/60 text-xs">{customer.phoneNo || '—'}</td>
                  )}
                  {visibleCols.includes('mobileNo') && (
                    <td className="px-3 py-2.5 text-white/60 text-xs">{customer.mobileNo || '—'}</td>
                  )}
                  {visibleCols.includes('email') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs max-w-[140px] truncate" title={customer.email}>
                      {customer.email || '—'}
                    </td>
                  )}
                  {visibleCols.includes('website') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs max-w-[120px] truncate" title={customer.website}>
                      {customer.website || '—'}
                    </td>
                  )}
                  {visibleCols.includes('panNo') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs font-mono">{customer.panNo || '—'}</td>
                  )}
                  {visibleCols.includes('gstin') && (
                    <td className="px-3 py-2.5 text-white/50 text-xs font-mono">{customer.gstin || '—'}</td>
                  )}
                  {visibleCols.includes('regType') && (
                    <td className="px-3 py-2.5 text-xs">
                      {customer.regType ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          customer.regType === 'Regular' ? 'bg-emerald-500/20 text-emerald-400' :
                          customer.regType === 'Unregistered' ? 'bg-gray-500/20 text-gray-400' :
                          customer.regType === 'Composition' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>{customer.regType}</span>
                      ) : '—'}
                    </td>
                  )}
                  {visibleCols.includes('creditLimit') && (
                    <td className="px-3 py-2.5 text-white/60 text-xs text-right">
                      {(customer.creditLimit ?? 0) > 0
                        ? '₹' + customer.creditLimit!.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                        : '—'}
                    </td>
                  )}

                  {/* Bill count */}
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-sm text-white/70 font-medium">{customer.billCount}</span>
                  </td>

                  {/* Outstanding */}
                  <td className="px-3 py-2.5 text-right">
                    {(() => {
                      const over = (customer.creditLimit ?? 0) > 0 && customer.outstandingBalance > (customer.creditLimit ?? 0)
                      return (
                        <span className={`text-sm font-semibold ${
                          over ? 'text-red-400' :
                          customer.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {customer.outstandingBalance > 0
                            ? '₹' + customer.outstandingBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                            : '—'}
                          {over && <span className="ml-1 text-[10px]" title="Exceeds credit limit">⚠</span>}
                        </span>
                      )
                    })()}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right w-32">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openPaymentRecorder(customer)}
                        className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                        title="Record Payment"
                      >
                        💳 Pay
                      </button>
                      <button
                        onClick={() => openLedger(customer)}
                        className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-emerald-400 transition-colors text-xs"
                        title="View Dr/Cr Ledger"
                      >
                        📒
                      </button>
                      <button
                        onClick={() => setEditTarget(customer)}
                        className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-[#a78bfa] transition-colors text-xs"
                        title="Edit"
                      >
                        ✏
                      </button>
                      <button
                        onClick={() => setDeleteTarget([customer])}
                        className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors text-xs"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer stats ── */}
      <div className="flex items-center gap-6 px-6 py-2.5 border-t border-white/5 flex-shrink-0 bg-[#13131a]/80">
        <span className="text-white/30 text-xs">{filtered.length} shown</span>
        <span className="text-white/30 text-xs">
          Total Outstanding: <strong className="text-amber-400">
            ₹{totalOutstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </strong>
        </span>
        {overLimit > 0 && (
          <span className="text-red-400 text-xs">
            ⚠ {overLimit} customer{overLimit > 1 ? 's' : ''} over credit limit
          </span>
        )}
        <div className="flex-1" />
        <span className="text-white/20 text-xs">Excel import format: Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type</span>
      </div>
    </div>
  )
}
