/**
 * cQikly — History Page
 * Phase 7a-A: Full list view — all columns, monthly/periodical grouping,
 *             fuzzy search, status tabs, amount range, date range, Excel export.
 * Phase 7a-B: Open any bill from history in a fully editable view.
 *             Clicking a bill row opens EditBillView with all fields editable.
 *             Saving writes the updated bill back to DB.
 *             Bill status editable directly from the edit view.
 *
 * Architecture:
 *   - Fuse.js drives fuzzy search across party name, PO number, date, amount
 *   - history.service.ts handles grouping, filtering, and Excel export
 *   - Status update still wired to bill.service (existing functionality preserved)
 *   - All filter state is ephemeral (URL or localStorage persistence is Phase 7b)
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import {
  Archive, Calendar, ChevronDown, ChevronRight, Download, RefreshCw,
  Search, SlidersHorizontal, X, LayoutList,
} from 'lucide-react'

import { getBills, updateBillStatus, deleteBillsBulk, updateBillStatusBulk } from '../../services/bill.service'
import {
  applyFilters, exportBillsToExcel, exportSelectedBillsToExcel,
  generateBatchPdf, formatAmountINR, formatDateDisplay, groupBills,
} from '../../services/history.service'
import type { GroupingMode, HistoryFilters } from '../../services/history.service'
import { STATUS_CONFIG } from '../NewQuote/BillInfoSection'
import type { BillRecord, BillStatus } from '../../services/db.service'
import EditBillView from './EditBillView'
import BulkActionsBar from './BulkActionsBar'
import OutstandingLedgerView from './OutstandingLedgerView'
import { triggerManualBackup } from '../../services/backup.service'
import CustomerLedgerModal from '../CustomerDetails/CustomerLedgerModal'
import { loadCustomers, getCustomerByName } from '../../services/customer.service'
import { eventBus } from '../../utils/eventBus'

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES: BillStatus[] = ['unpaid', 'paid', 'partial', 'cancelled']

const STATUS_TABS: Array<{ id: 'all' | BillStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'paid', label: 'Paid' },
  { id: 'partial', label: 'Partial' },
  { id: 'cancelled', label: 'Cancelled' },
]

const GROUPING_OPTIONS: Array<{ value: GroupingMode; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'financial-year', label: 'Financial Year' },
  { value: 'yearly', label: 'Calendar Year' },
  { value: 'none', label: 'No Grouping' },
]

const DEFAULT_FILTERS: HistoryFilters = {
  statusFilter: 'all',
  amountMin: '',
  amountMax: '',
  dateFrom: '',
  dateTo: '',
}

// Fuse.js config — fuzzy match across all meaningful bill fields
const FUSE_OPTIONS: IFuseOptions<BillRecord> = {
  threshold: 0.4,
  minMatchCharLength: 1,
  ignoreLocation: true,
  keys: [
    { name: 'partyName', weight: 0.4 },
    { name: 'billNumber', weight: 0.3 },
    { name: 'billDate', weight: 0.15 },
    { name: 'grandTotal', weight: 0.15 },
  ],
}

// ─── Style tokens (CSS variable references) ───────────────────────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
  accentBg: 'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface-raised))',
  accentBorder: 'color-mix(in srgb, var(--cq-accent) 25%, var(--cq-border))',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Inline status selector cell — click to cycle status */
function HistoryStatusCell({
  billId, status, onUpdate,
}: {
  billId: number; status: BillStatus; onUpdate: (id: number, s: BillStatus) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const cfg = STATUS_CONFIG[status]

  const handleChange = async (newStatus: BillStatus) => {
    setOpen(false)
    if (newStatus === status) return
    setSaving(true)
    try {
      await updateBillStatus(billId, newStatus)
      onUpdate(billId, newStatus)
    } catch (err) {
      console.error('[History] updateBillStatus failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        title="Click to change status"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '3px 10px', fontSize: '0.67rem', fontWeight: 700,
          fontFamily: S.font, letterSpacing: '0.05em', textTransform: 'uppercase',
          color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
          borderRadius: '20px', cursor: saving ? 'wait' : 'pointer',
          outline: 'none', opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s',
        }}
      >
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
        {cfg.label}
        <span style={{ fontSize: '0.5rem', opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: S.surfaceRaised, border: `1.5px solid ${S.border}`,
            borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100, padding: '4px', minWidth: '136px',
          }}>
            {ALL_STATUSES.map(s => {
              const c = STATUS_CONFIG[s]
              const active = s === status
              return (
                <button key={s} type="button" onClick={() => handleChange(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    width: '100%', padding: '7px 10px',
                    background: active ? c.bg : 'transparent',
                    border: 'none', borderRadius: '5px', cursor: 'pointer',
                    fontFamily: S.font, fontSize: '0.78rem',
                    fontWeight: active ? 700 : 500, color: c.color, textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = c.bg }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                  {c.label}
                  {active && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', opacity: 0.7 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** A collapsible month/period group header */
function GroupHeader({
  label, sublabel, count, collapsed, onToggle,
}: {
  label: string; sublabel: string; count: number; collapsed: boolean; onToggle: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        width: '100%', padding: '10px 16px',
        background: 'color-mix(in srgb, var(--cq-accent) 6%, var(--cq-surface-raised))',
        border: 'none',
        borderBottom: `1px solid ${S.border}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--cq-accent) 12%, var(--cq-surface-raised))' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--cq-accent) 6%, var(--cq-surface-raised))' }}
    >
      {collapsed
        ? <ChevronRight size={14} style={{ color: S.accent, flexShrink: 0 }} />
        : <ChevronDown size={14} style={{ color: S.accent, flexShrink: 0 }} />}
      <span style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, color: S.text, flex: 1 }}>
        {label}
      </span>
      <span style={{ fontFamily: S.font, fontSize: '0.74rem', color: S.textMuted }}>
        {sublabel}
      </span>
      <span style={{
        marginLeft: '8px', padding: '2px 8px', background: S.accentBg,
        border: `1px solid ${S.accentBorder}`, borderRadius: '12px',
        fontSize: '0.68rem', fontWeight: 700, color: S.accent, letterSpacing: '0.03em',
      }}>
        {count}
      </span>
    </button>
  )
}

/** Single bill row in the list */
function BillRow({
  bill, onStatusUpdate, onOpen, selected, onToggleSelect,
}: {
  bill: BillRecord
  onStatusUpdate: (id: number, s: BillStatus) => void
  onOpen: (bill: BillRecord) => void
  selected?: boolean
  onToggleSelect?: () => void
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(bill)}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 160px 1fr 110px 90px 130px 90px',
        gap: '0',
        padding: '12px 20px',
        background: selected
          ? 'color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))'
          : hovered
          ? 'color-mix(in srgb, var(--cq-accent) 5%, var(--cq-surface-raised))'
          : 'transparent',
        borderBottom: `1px solid color-mix(in srgb, ${S.border} 50%, transparent)`,
        alignItems: 'center',
        transition: 'background 0.1s',
        cursor: 'pointer',
        borderLeft: selected ? '3px solid var(--cq-accent)' : '3px solid transparent',
      }}
    >
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); onToggleSelect?.() }} style={{ display: 'flex', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={() => onToggleSelect?.()}
          style={{ accentColor: 'var(--cq-accent)', width: '14px', height: '14px', cursor: 'pointer' }}
        />
      </div>
      {/* Bill Number / PO */}
      <div style={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.78rem', fontWeight: 700, color: S.accent, letterSpacing: '0.02em',
      }}>
        {bill.billNumber}
      </div>

      {/* Party Name + optional phone */}
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: S.text }}>
          {bill.partyName || <span style={{ opacity: 0.35, fontStyle: 'italic', fontWeight: 400 }}>—</span>}
        </div>
        {bill.partyPhone && (
          <div style={{ fontSize: '0.7rem', color: S.textMuted, marginTop: '2px' }}>
            {bill.partyPhone}
            {bill.transportName && (
              <span style={{ marginLeft: '8px', opacity: 0.6 }}>· {bill.transportName}</span>
            )}
          </div>
        )}
      </div>

      {/* Date */}
      <div style={{ fontSize: '0.78rem', color: S.textMuted }}>
        {bill.billDate ? formatDateDisplay(bill.billDate) : '—'}
      </div>

      {/* Grand Total */}
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: S.text, textAlign: 'right', paddingRight: '16px' }}>
        {(bill.grandTotal ?? 0) > 0
          ? formatAmountINR(Math.round(bill.grandTotal ?? 0))
          : <span style={{ opacity: 0.35, fontWeight: 400 }}>—</span>}
      </div>

      {/* Status — clickable */}
      <div onClick={e => e.stopPropagation()}>
        {bill.id != null ? (
          <HistoryStatusCell billId={bill.id} status={bill.status} onUpdate={onStatusUpdate} />
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '3px 10px', fontSize: '0.67rem', fontWeight: 700, fontFamily: S.font,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: STATUS_CONFIG[bill.status].color,
            background: STATUS_CONFIG[bill.status].bg,
            border: `1px solid ${STATUS_CONFIG[bill.status].border}`,
            borderRadius: '20px',
          }}>
            {STATUS_CONFIG[bill.status].label}
          </span>
        )}
      </div>

      {/* Open button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '4px' }} onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onOpen(bill)}
          title="Open and edit this bill"
          style={{
            padding: '4px 10px', fontFamily: S.font, fontSize: '0.72rem', fontWeight: 600,
            color: S.accent,
            background: 'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface-raised))',
            border: `1px solid color-mix(in srgb, var(--cq-accent) 30%, var(--cq-border))`,
            borderRadius: '6px', cursor: 'pointer',
            transition: 'all 0.12s',
          }}
        >
          Open →
        </button>
      </div>
    </div>
  )
}

// ─── AmountRangeFilter component ──────────────────────────────────────────────

function FilterPanel({
  filters, setFilters, visible,
}: {
  filters: HistoryFilters
  setFilters: React.Dispatch<React.SetStateAction<HistoryFilters>>
  visible: boolean
}): React.ReactElement | null {
  if (!visible) return null

  const inputStyle: React.CSSProperties = {
    padding: '7px 11px', fontFamily: S.font, fontSize: '0.8rem',
    color: S.text, background: S.surfaceRaised,
    border: `1px solid ${S.border}`, borderRadius: '6px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '0.69rem', fontWeight: 600, color: S.textMuted,
    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px',
    display: 'block',
  }

  const handleChange = <K extends keyof HistoryFilters>(key: K, val: HistoryFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div style={{
      padding: '14px 24px',
      background: 'color-mix(in srgb, var(--cq-surface-raised) 80%, var(--cq-surface))',
      borderBottom: `1px solid ${S.border}`,
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
      gap: '14px',
    }}>
      {/* Amount min */}
      <div>
        <label style={labelStyle}>Min Amount (₹)</label>
        <input
          type="number"
          placeholder="e.g. 10000"
          value={filters.amountMin}
          onChange={e => handleChange('amountMin', e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Amount max */}
      <div>
        <label style={labelStyle}>Max Amount (₹)</label>
        <input
          type="number"
          placeholder="e.g. 200000"
          value={filters.amountMax}
          onChange={e => handleChange('amountMax', e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Date from */}
      <div>
        <label style={labelStyle}>Date From</label>
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={e => handleChange('dateFrom', e.target.value)}
            style={{ ...inputStyle, paddingRight: '30px' }}
          />
          <Calendar size={13} style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* Date to */}
      <div>
        <label style={labelStyle}>Date To</label>
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            value={filters.dateTo}
            onChange={e => handleChange('dateTo', e.target.value)}
            style={{ ...inputStyle, paddingRight: '30px' }}
          />
          <Calendar size={13} style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none',
          }} />
        </div>
      </div>
    </div>
  )
}

// ─── Main HistoryPage ─────────────────────────────────────────────────────────

export default function HistoryPage(): React.ReactElement {
  const [allBills, setAllBills] = useState<BillRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<HistoryFilters>({ ...DEFAULT_FILTERS })
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('monthly')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Phase 7a-B: open bill in edit view ───────────────────────────────────
  const [openBill, setOpenBill] = useState<BillRecord | null>(null)

  // ── Phase 7b: bulk selection ───────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Phase 7b: outstanding ledger view ────────────────────────────────────
  const [showLedger, setShowLedger] = useState(false)

  // ── Phase 8b-i: per-customer Dr/Cr ledger modal ───────────────────────────
  const [customerLedger, setCustomerLedger] = useState<{
    partyName: string
    bills: BillRecord[]
  } | null>(null)

  // ── Phase 7b: backup state ────────────────────────────────────────────────
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [backupToast, setBackupToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // ── Load bills ────────────────────────────────────────────────────────────

  const loadBills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getBills()
      // Sort newest first
      data.sort((a, b) => {
        const da = (a.billDate || a.createdAt || '0')
        const db = (b.billDate || b.createdAt || '0')
        return db.localeCompare(da)
      })
      setAllBills(data)
      // Phase 8b-i: also warm up customer cache so getCustomerByName works in ledger
      loadCustomers().catch(() => { /* non-fatal */ })
    } catch (err) {
      console.error('[History] Failed to load bills:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBills() }, [loadBills])

  // Phase 12b: navigate-to-bill from command palette
  useEffect(() => {
    return eventBus.on('navigateToBill', ({ billId }) => {
      const bill = allBills.find(b => b.id === billId)
      if (bill) setSearchQuery(bill.billNumber)
    })
  }, [allBills])

  // Ctrl+H shortcut re-focus / Escape clears search
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchQuery) {
        setSearchQuery('')
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [searchQuery])

  // ── Fuzzy search ──────────────────────────────────────────────────────────

  const fuse = useMemo(() => new Fuse(allBills, FUSE_OPTIONS), [allBills])

  const searchedBills = useMemo<BillRecord[]>(() => {
    const q = searchQuery.trim()
    if (!q) return allBills
    // If query looks like a number, also search against grandTotal as string
    return fuse.search(q).map(r => r.item)
  }, [fuse, allBills, searchQuery])

  // ── Apply hard filters ────────────────────────────────────────────────────

  const filteredBills = useMemo(
    () => applyFilters(searchedBills, filters),
    [searchedBills, filters],
  )

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groups = useMemo(
    () => groupBills(filteredBills, groupingMode),
    [filteredBills, groupingMode],
  )

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalAmount = useMemo(
    () => filteredBills.reduce((s, b) => s + Math.round(b.grandTotal ?? 0), 0),
    [filteredBills],
  )

  // ── Status update propagation ─────────────────────────────────────────────

  const handleStatusUpdate = useCallback((id: number, newStatus: BillStatus) => {
    setAllBills(prev => prev.map(b => b.id === id ? { ...b, status: newStatus } : b))
  }, [])

  // ── Phase 7a-B: handle bill saved from edit view ─────────────────────────
  const handleBillSaved = useCallback((updatedBill: BillRecord) => {
    setAllBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b))
    setOpenBill(updatedBill) // keep same bill open (stay in edit view after save)
  }, [])

  // ── Phase 7b: selection helpers ──────────────────────────────────────────

  const toggleSelectBill = useCallback((id: number | undefined) => {
    if (id == null) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    const visibleIds = filteredBills.map(b => b.id).filter((id): id is number => id != null)
    setSelectedIds(prev => {
      const allSelected = visibleIds.every(id => prev.has(id))
      if (allSelected) return new Set()
      return new Set(visibleIds)
    })
  }, [filteredBills])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ── Phase 7b: bulk actions ────────────────────────────────────────────────

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    await deleteBillsBulk(ids)
    setAllBills(prev => prev.filter(b => b.id == null || !selectedIds.has(b.id)))
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleBulkExport = useCallback(async () => {
    const selected = allBills.filter(b => b.id != null && selectedIds.has(b.id!))
    await exportSelectedBillsToExcel(
      selected,
      `cQikly_Selected_${selected.length}bills_${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }, [allBills, selectedIds])

  const handleBulkStatusChange = useCallback(async (status: BillStatus) => {
    const ids = Array.from(selectedIds)
    await updateBillStatusBulk(ids, status)
    setAllBills(prev => prev.map(b =>
      b.id != null && selectedIds.has(b.id) ? { ...b, status } : b
    ))
    setSelectedIds(new Set())
  }, [selectedIds])

  const handleBatchPdf = useCallback(async () => {
    const selected = allBills.filter(b => b.id != null && selectedIds.has(b.id!))
    await generateBatchPdf(selected)
  }, [allBills, selectedIds])

  // ── Phase 7b: backup trigger ──────────────────────────────────────────────

  const handleBackup = useCallback(async () => {
    if (isBackingUp) return
    setIsBackingUp(true)
    setBackupToast(null)
    try {
      const result = await triggerManualBackup()
      setBackupToast({
        msg: result.success
          ? `✓ Backup saved: ${result.filename ?? 'backup.zip'}`
          : `Backup failed: ${result.error ?? 'Unknown error'}`,
        ok: result.success,
      })
      setTimeout(() => setBackupToast(null), 4000)
    } finally {
      setIsBackingUp(false)
    }
  }, [isBackingUp])

  // ── Toggle group collapse ─────────────────────────────────────────────────

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    setCollapsedGroups(new Set(groups.map(g => g.key)))
  }, [groups])

  const expandAll = useCallback(() => {
    setCollapsedGroups(new Set())
  }, [])

  // ── Excel export ──────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (filteredBills.length === 0) return
    setExporting(true)
    try {
      const q = searchQuery.trim()
      const suffix = q ? `_search_${q.replace(/\s+/g, '_')}` : ''
      await exportBillsToExcel(
        filteredBills,
        `cQikly_History${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      )
    } catch (err) {
      console.error('[History] Export failed:', err)
    } finally {
      setExporting(false)
    }
  }, [filteredBills, searchQuery])

  // ── Active filter count (for badge) ──────────────────────────────────────

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.statusFilter !== 'all') n++
    if (filters.amountMin) n++
    if (filters.amountMax) n++
    if (filters.dateFrom) n++
    if (filters.dateTo) n++
    return n
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0 || searchQuery.trim().length > 0

  const resetAllFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
    setSearchQuery('')
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: S.font, color: S.text, background: S.surface, overflow: 'hidden',
    }}>
      {/* ── Phase 7b: Backup toast notification ─────────────────────────────── */}
      {backupToast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
          padding: '12px 18px',
          background: backupToast.ok
            ? 'color-mix(in srgb, #16a34a 12%, var(--cq-surface-raised))'
            : 'color-mix(in srgb, #dc2626 12%, var(--cq-surface-raised))',
          border: `1.5px solid ${backupToast.ok ? '#16a34a' : '#dc2626'}`,
          borderRadius: '10px',
          fontFamily: S.font, fontSize: '0.82rem', fontWeight: 600,
          color: backupToast.ok ? '#15803d' : '#dc2626',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          maxWidth: '380px',
        }}>
          {backupToast.msg}
        </div>
      )}

      {/* ── Phase 7b: Outstanding Ledger overlay ───────────────────────────── */}
      {showLedger && (
        <OutstandingLedgerView
          bills={allBills}
          onClose={() => setShowLedger(false)}
          onViewCustomerLedger={(partyName, bills) => {
            setCustomerLedger({ partyName, bills })
          }}
        />
      )}

      {/* ── Phase 8b-i: Per-customer Dr/Cr Ledger modal ──────────────────── */}
      {customerLedger && (() => {
        // Build a minimal CustomerRecord from available bill data + loaded customers
        const custRecord = getCustomerByName(customerLedger.partyName) ?? {
          partyName: customerLedger.partyName,
          phoneNo: customerLedger.bills[0]?.partyPhone,
        }
        return (
          <CustomerLedgerModal
            customer={custRecord}
            bills={customerLedger.bills}
            onClose={() => setCustomerLedger(null)}
          />
        )
      })()}

      {/* ── Phase 7a-B: EditBillView overlay ──────────────────────────────── */}
      {!showLedger && openBill && (
        <EditBillView
          bill={openBill}
          onClose={() => setOpenBill(null)}
          onSaved={handleBillSaved}
        />
      )}

      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${S.border}`,
        display: (openBill || showLedger) ? 'none' : 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        background: S.surfaceRaised,
      }}>
        {/* Title */}
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: S.text }}>
            Bill History
          </div>
          <div style={{ fontSize: '0.72rem', color: S.textMuted, marginTop: '1px' }}>
            {loading ? 'Loading…' : (
              <>
                {filteredBills.length} bill{filteredBills.length !== 1 ? 's' : ''}
                {filteredBills.length > 0 && (
                  <> · {formatAmountINR(totalAmount)} total</>
                )}
                {allBills.length !== filteredBills.length && (
                  <span style={{ color: S.accent, marginLeft: '6px' }}>
                    (filtered from {allBills.length})
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Grouping selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.72rem', color: S.textMuted, fontWeight: 500 }}>Group:</span>
          <select
            value={groupingMode}
            onChange={e => setGroupingMode(e.target.value as GroupingMode)}
            style={{
              padding: '6px 10px', fontFamily: S.font, fontSize: '0.78rem',
              color: S.text, background: S.surface,
              border: `1px solid ${S.border}`, borderRadius: '6px',
              cursor: 'pointer', outline: 'none',
            }}
          >
            {GROUPING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Collapse/Expand all */}
        {groupingMode !== 'none' && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={expandAll}
              title="Expand all groups"
              style={smallBtnStyle}
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={collapseAll}
              title="Collapse all groups"
              style={smallBtnStyle}
            >
              Collapse All
            </button>
          </div>
        )}

        {/* ── Phase 7b: Outstanding Ledger ─ */}
        <button
          type="button"
          onClick={() => setShowLedger(true)}
          title="View outstanding balances per customer"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 13px',
            background: S.surfaceRaised,
            border: `1px solid ${S.border}`,
            borderRadius: '7px', fontSize: '0.78rem', fontFamily: S.font, fontWeight: 600,
            color: S.textMuted,
            cursor: 'pointer', transition: 'all 0.12s',
          }}
        >
          <LayoutList size={13} />
          Outstanding
        </button>

        {/* ── Phase 7b: Backup trigger ─ */}
        <button
          type="button"
          onClick={handleBackup}
          disabled={isBackingUp}
          title="Trigger a manual backup of all data"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 13px',
            background: isBackingUp ? S.surfaceRaised : 'color-mix(in srgb, #16a34a 8%, var(--cq-surface-raised))',
            border: `1px solid ${isBackingUp ? S.border : 'color-mix(in srgb, #16a34a 25%, var(--cq-border))'}`,
            borderRadius: '7px', fontSize: '0.78rem', fontFamily: S.font, fontWeight: 600,
            color: isBackingUp ? S.textMuted : '#15803d',
            cursor: isBackingUp ? 'wait' : 'pointer',
            opacity: isBackingUp ? 0.6 : 1, transition: 'all 0.12s',
          }}
        >
          <Archive size={13} />
          {isBackingUp ? 'Backing up…' : 'Backup Now'}
        </button>

        {/* Excel Export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={filteredBills.length === 0 || exporting}
          title="Export filtered results to Excel"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 13px',
            background: filteredBills.length === 0 ? S.surfaceRaised : S.accentBg,
            border: `1px solid ${filteredBills.length === 0 ? S.border : S.accentBorder}`,
            borderRadius: '7px', fontSize: '0.78rem', fontFamily: S.font, fontWeight: 600,
            color: filteredBills.length === 0 ? S.textMuted : S.accent,
            cursor: filteredBills.length === 0 ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          <Download size={13} />
          {exporting ? 'Exporting…' : 'Export'}
        </button>

        {/* Refresh */}
        <button
          type="button"
          onClick={loadBills}
          title="Refresh bill list"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', background: S.surfaceRaised,
            border: `1px solid ${S.border}`, borderRadius: '7px', cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} style={{ color: S.textMuted }} />
        </button>
      </div>

      {/* ── SEARCH + STATUS TABS BAR ────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px',
        borderBottom: `1px solid ${S.border}`,
        display: (openBill || showLedger) ? 'none' : 'flex', alignItems: 'center', gap: '10px',
        flexShrink: 0, background: S.surface,
      }}>
        {/* Fuzzy search input */}
        <div style={{ position: 'relative', flex: 1, maxWidth: '360px' }}>
          <Search size={14} style={{
            position: 'absolute', left: '10px', top: '50%',
            transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none',
          }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by party name, bill no., date, amount…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '8px 32px 8px 32px',
              fontFamily: S.font, fontSize: '0.82rem',
              color: S.text, background: S.surfaceRaised,
              border: `1.5px solid ${searchQuery ? S.accentBorder : S.border}`,
              borderRadius: '7px', outline: 'none',
              transition: 'border-color 0.15s',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: '8px', top: '50%',
                transform: 'translateY(-50%)', background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px', display: 'flex',
              }}
            >
              <X size={13} style={{ opacity: 0.5 }} />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {STATUS_TABS.map(tab => {
            const active = filters.statusFilter === tab.id
            const tabCfg = tab.id !== 'all' ? STATUS_CONFIG[tab.id as BillStatus] : null
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilters(prev => ({ ...prev, statusFilter: tab.id as HistoryFilters['statusFilter'] }))}
                style={{
                  padding: '6px 13px', fontFamily: S.font, fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  color: active ? (tabCfg ? tabCfg.color : S.accent) : S.textMuted,
                  background: active ? (tabCfg ? tabCfg.bg : S.accentBg) : 'transparent',
                  border: active
                    ? `1.5px solid ${tabCfg ? tabCfg.border : S.accentBorder}`
                    : `1px solid transparent`,
                  borderRadius: '6px', cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--cq-border) 30%, transparent)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setFilterPanelOpen(o => !o)}
          title="Amount and date range filters"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '7px 12px',
            background: filterPanelOpen || activeFilterCount > 0 ? S.accentBg : S.surfaceRaised,
            border: `1px solid ${filterPanelOpen || activeFilterCount > 0 ? S.accentBorder : S.border}`,
            borderRadius: '7px', fontSize: '0.78rem', fontFamily: S.font, fontWeight: 500,
            color: filterPanelOpen || activeFilterCount > 0 ? S.accent : S.textMuted,
            cursor: 'pointer', transition: 'all 0.12s',
          }}
        >
          <SlidersHorizontal size={13} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              padding: '1px 6px', background: S.accent, color: '#fff',
              borderRadius: '10px', fontSize: '0.65rem', fontWeight: 700, lineHeight: 1.4,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Clear all filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAllFilters}
            title="Clear all filters and search"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '7px 10px', background: 'transparent',
              border: `1px solid ${S.border}`, borderRadius: '7px',
              fontSize: '0.75rem', fontFamily: S.font, fontWeight: 500,
              color: S.textMuted, cursor: 'pointer',
            }}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* ── FILTER PANEL (expandable) ───────────────────────────────────────── */}
      {!openBill && !showLedger && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          visible={filterPanelOpen}
        />
      )}

      {/* ── Phase 7b: BULK ACTIONS BAR ──────────────────────────────────────── */}
      {!openBill && !showLedger && (
        <BulkActionsBar
          selectedCount={selectedIds.size}
          onClearSelection={clearSelection}
          onDeleteSelected={handleBulkDelete}
          onExportSelected={handleBulkExport}
          onChangeStatusSelected={handleBulkStatusChange}
          onBatchPdfSelected={handleBatchPdf}
        />
      )}

      {/* ── TABLE HEADER (sticky) ───────────────────────────────────────────── */}
      <div style={{
        display: (openBill || showLedger) ? 'none' : 'grid',
        gridTemplateColumns: '40px 160px 1fr 110px 90px 130px 90px',
        gap: '0',
        padding: '8px 20px',
        background: 'color-mix(in srgb, var(--cq-border) 35%, transparent)',
        borderBottom: `1px solid ${S.border}`,
        flexShrink: 0,
      }}>
        {/* Select-all checkbox */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input
            type="checkbox"
            title="Select all visible bills"
            checked={filteredBills.length > 0 && filteredBills.every(b => b.id != null && selectedIds.has(b.id!))}
            onChange={toggleSelectAll}
            style={{ accentColor: 'var(--cq-accent)', width: '14px', height: '14px', cursor: 'pointer' }}
          />
        </div>
        {[
          { label: 'Bill No.', align: 'left' },
          { label: 'Party', align: 'left' },
          { label: 'Date', align: 'left' },
          { label: 'Amount', align: 'right' },
          { label: 'Status', align: 'left' },
          { label: '', align: 'right' },
        ].map(({ label, align }) => (
          <div key={label} style={{
            fontSize: '0.67rem', fontWeight: 700, color: S.textMuted,
            letterSpacing: '0.07em', textTransform: 'uppercase',
            textAlign: align as React.CSSProperties['textAlign'],
            paddingRight: align === 'right' ? '16px' : '0',
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── BILL LIST ───────────────────────────────────────────────────────── */}
      <div style={{ flex: (openBill || showLedger) ? 0 : 1, overflowY: 'auto', display: (openBill || showLedger) ? 'none' : undefined }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: S.textMuted, fontSize: '0.875rem' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '12px', opacity: 0.3 }}>⏳</div>
            Loading bills…
          </div>
        ) : filteredBills.length === 0 ? (
          <EmptyState
            hasSearch={hasActiveFilters}
            totalBills={allBills.length}
            onClear={resetAllFilters}
          />
        ) : (
          groups.map(group => (
            <div key={group.key}>
              {/* Group header — only shown when grouping is active */}
              {groupingMode !== 'none' && (
                <GroupHeader
                  label={group.label}
                  sublabel={group.sublabel ?? ''}
                  count={group.bills.length}
                  collapsed={collapsedGroups.has(group.key)}
                  onToggle={() => toggleGroup(group.key)}
                />
              )}

              {/* Bill rows — hidden when group is collapsed */}
              {!collapsedGroups.has(group.key) && group.bills.map(bill => (
                <BillRow
                  key={bill.id ?? bill.billNumber}
                  bill={bill}
                  onStatusUpdate={handleStatusUpdate}
                  onOpen={setOpenBill}
                  selected={bill.id != null && selectedIds.has(bill.id)}
                  onToggleSelect={() => toggleSelectBill(bill.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* ── FOOTER STATUS BAR ──────────────────────────────────────────────── */}
      {!loading && allBills.length > 0 && !openBill && !showLedger && (
        <div style={{
          padding: '10px 24px',
          borderTop: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', gap: '20px',
          background: S.surfaceRaised, flexShrink: 0,
        }}>
          {/* Per-status counts */}
          {ALL_STATUSES.map(s => {
            const count = allBills.filter(b => b.status === s).length
            const cfg = STATUS_CONFIG[s]
            return (
              <div
                key={s}
                onClick={() => setFilters(prev => ({
                  ...prev,
                  statusFilter: prev.statusFilter === s ? 'all' : s,
                }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  cursor: 'pointer', opacity: 0.8,
                  transition: 'opacity 0.12s',
                }}
                title={`Show only ${cfg.label} bills`}
              >
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: cfg.color, flexShrink: 0,
                }} />
                <span style={{ fontSize: '0.72rem', color: S.textMuted }}>
                  {cfg.label}:
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: cfg.color }}>
                  {count}
                </span>
              </div>
            )
          })}

          <div style={{ flex: 1 }} />

          <div style={{ fontSize: '0.72rem', color: S.textMuted }}>
            {allBills.length} total · Click any row or Open → to edit a bill
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  hasSearch, totalBills, onClear,
}: {
  hasSearch: boolean; totalBills: number; onClear: () => void
}): React.ReactElement {
  if (totalBills === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '80px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ fontSize: '3rem', opacity: 0.2 }}>🗂</div>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--cq-text-muted)' }}>No bills yet</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', opacity: 0.7 }}>
          Save your first bill from the New Quote page
        </div>
      </div>
    )
  }

  return (
    <div style={{
      textAlign: 'center', padding: '60px 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    }}>
      <div style={{ fontSize: '2.5rem', opacity: 0.2 }}>🔍</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--cq-text-muted)' }}>
        No bills match your {hasSearch ? 'search or filters' : 'filters'}
      </div>
      <button
        type="button"
        onClick={onClear}
        style={{
          padding: '8px 18px', fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: '0.8rem', fontWeight: 600,
          color: 'var(--cq-accent)',
          background: 'color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))',
          border: '1px solid color-mix(in srgb, var(--cq-accent) 25%, var(--cq-border))',
          borderRadius: '7px', cursor: 'pointer',
        }}
      >
        Clear all filters
      </button>
    </div>
  )
}

// ─── Shared micro-style helpers ───────────────────────────────────────────────

const smallBtnStyle: React.CSSProperties = {
  padding: '6px 11px', fontFamily: '"Inter", system-ui, sans-serif',
  fontSize: '0.75rem', fontWeight: 500,
  color: 'var(--cq-text-muted)',
  background: 'var(--cq-surface-raised)',
  border: '1px solid var(--cq-border)',
  borderRadius: '6px', cursor: 'pointer',
}
