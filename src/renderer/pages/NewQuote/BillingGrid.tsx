/**
 * cQikly — BillingGrid
 * Phase 5a: Core grid — Free/GST format, navigation, F2 mode, TSV paste,
 *           row expansion, discount col, qty unit col, adjustments, grand total.
 * Phase 5b: Custom columns (+Col / -Col), Mark system, Show MKD dialog,
 *           grid-level Undo/Redo, row drag-to-reorder.
 * Phase 4a-i: Cell formatting (Bold+Highlight, Highlight Cell), color persist system.
 *             BillingGridImperative extended with applyBoldHighlight, highlightCell.
 *             CellFormatMap stored and restored with bill data.
 * Phase 4a-ii-B: Rate History Hint — ghost placeholder in Rate cell when cursor is
 *               in Rate and a fuzzy-matching item exists in bill history for that party.
 *               Insert key in Rate cell accepts the hint (column-context-aware, zero
 *               conflict with inventory Insert which only fires from Item Name cell).
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BillingRow,
  AdjustmentRow,
  BillFormat,
  BillTotals,
  GridCol,
  GridColumnToggles,
  CellAddress,
  CustomColumn,
  CustomColCell,
  CustomColData,
  GridSnapshot,
  CellFormatMap,
  CellFormat,
  DEFAULT_COLUMN_TOGGLES,
  FREE_FORMAT_NAV_COLS,
  GST_FORMAT_NAV_COLS,
  createEmptyRow,
  createEmptyAdjustment,
  emptyCell,
  recalcRow,
  calcSlNos,
  computeTotals,
  computeMkdGroups,
  parseNum,
} from './billingGrid.types'
import {
  Plus, Minus, ToggleLeft, ToggleRight,
  GripVertical, Undo2, Redo2,
  Columns, Tag, BarChart2, X,
} from 'lucide-react'
import { getRateHint } from '../../services/bill.service'
import { inventoryService, type InventoryItemFull } from '../../services/inventory.service'
import InventoryAutocomplete from './InventoryAutocomplete'

// ─── AddColumnDialog — replaces window.prompt (blocked in Electron sandbox) ───

function AddColumnDialog({ onConfirm, onCancel }: {
  onConfirm: (name: string) => void
  onCancel: () => void
}): React.ReactElement {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus the input on mount
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        }}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9991,
        background: 'var(--cq-surface-raised)',
        border: '1.5px solid var(--cq-border)',
        borderRadius: '12px',
        padding: '24px 28px',
        width: '340px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--cq-text-primary)' }}>
          New Column Header
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g. THREAD, SIZE, COLOUR CODE"
          style={{
            fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: '0.85rem',
            padding: '9px 12px',
            borderRadius: '7px',
            border: '1.5px solid var(--cq-border)',
            background: 'var(--cq-surface)',
            color: 'var(--cq-text-primary)',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box' as const,
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '7px 16px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 600,
              background: 'transparent', border: '1px solid var(--cq-border)',
              color: 'var(--cq-text-muted)', cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            style={{
              padding: '7px 18px', borderRadius: '7px', fontSize: '0.8rem', fontWeight: 700,
              background: 'var(--cq-accent)', border: 'none',
              color: 'var(--cq-surface)', cursor: 'pointer', fontFamily: '"Inter", system-ui, sans-serif',
            }}
          >
            Add Column
          </button>
        </div>
      </div>
    </>
  )
}

// ─── ID generator ──────────────────────────────────────────────────────────────

let _idCounter = 0
function newId(): string {
  return `r${++_idCounter}`
}

// ─── Initial rows ──────────────────────────────────────────────────────────────

function makeInitialRows(count = 20): BillingRow[] {
  return Array.from({ length: count }, () => createEmptyRow(newId()))
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
}

// ─── Column widths ─────────────────────────────────────────────────────────────

const COL_WIDTHS: Record<string, number> = {
  dragHandle:    28,
  slno:          40,
  itemName:     220,
  qtyUnit:       72,
  qty:           72,
  discountValue: 90,
  rate:          88,
  preTax:        90,
  gstPct:        72,
  gstAmt:        88,
  amount:       100,
  customCol:    120,
}

// ─── Cell ref management ───────────────────────────────────────────────────────

type CellRefMap = Map<string, HTMLInputElement>

function cellKey(rowIdx: number, col: string): string {
  return `${rowIdx}:${col}`
}

// ─── formatINR ─────────────────────────────────────────────────────────────────

function formatINR(n: number, decimals = 2): string {
  if (!Number.isFinite(n) || n === 0) return ''
  return n.toFixed(decimals)
}

// ─── DiscountToggleBtn ─────────────────────────────────────────────────────────

function DiscountToggleBtn({
  type,
  onToggle,
}: {
  type: 'pct' | 'flat'
  onToggle: () => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onToggle}
      title="Toggle discount type (% / flat)"
      style={{
        position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: S.textMuted, fontSize: '0.6rem', fontWeight: 700,
        padding: '2px 3px', borderRadius: '3px', lineHeight: 1, opacity: 0.7,
        userSelect: 'none',
      }}
    >
      {type === 'pct' ? '%' : '₹'}
    </button>
  )
}

// ─── BillingGrid props ─────────────────────────────────────────────────────────

export interface BillingGridProps {
  format: BillFormat
  onFormatChange?: (f: BillFormat) => void
  onChange?: (
    rows: BillingRow[],
    adjustments: AdjustmentRow[],
    totals: BillTotals,
    customCols: CustomColumn[],
    customColData: CustomColData,
    cellFormats: CellFormatMap,
  ) => void
  f2ModeEnabled?: boolean
  columnToggles?: GridColumnToggles
  onColumnTogglesChange?: (t: GridColumnToggles) => void
  initialRows?: BillingRow[]
  initialAdjustments?: AdjustmentRow[]
  initialCustomCols?: CustomColumn[]
  initialCustomColData?: CustomColData
  initialCellFormats?: CellFormatMap
  /** External imperative handles for toolbar buttons */
  imperativeRef?: React.MutableRefObject<BillingGridImperative | null>
  /** Party name — used for Rate History Hint fuzzy matching (Phase 4a-ii-B) */
  partyName?: string
  /** Inventory mode — when true, Item Name cell shows fuzzy autocomplete from inventory (Phase 9b-B-ii-A) */
  inventoryModeEnabled?: boolean
  rateHistoryHintEnabled?: boolean
  /** Current bill format — needed by inventory autocomplete to pick correct price field (Phase 9b-B-ii-A) */
  billFormatForInv?: BillFormat
}

export interface BillingGridImperative {
  addCustomColumn: () => void
  removeLastCustomColumn: () => void
  markActiveCustomCell: () => void
  showMkd: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  // Phase 4a-i
  applyBoldHighlight: (color: string) => void
  highlightCell: (color: string) => void
  getActiveInfo: () => { hasActiveCell: boolean; hasActiveCustomCell: boolean }
  clearCellFormat: () => void
  // Phase 4a-ii-A: snapshot for export, duplicate, templates
  getSnapshot: () => {
    rows: BillingRow[]
    adjustments: AdjustmentRow[]
    customCols: CustomColumn[]
    customColData: CustomColData
    cellFormats: CellFormatMap
  }
  loadSnapshot: (snap: {
    rows: BillingRow[]
    adjustments: AdjustmentRow[]
    customCols: CustomColumn[]
    customColData: CustomColData
    cellFormats: CellFormatMap
  }) => void
}

// ─── BillingGrid ───────────────────────────────────────────────────────────────

export default function BillingGrid({
  format,
  onFormatChange,
  onChange,
  f2ModeEnabled = false,
  columnToggles: externalToggles,
  onColumnTogglesChange,
  initialRows,
  initialAdjustments,
  initialCustomCols,
  initialCustomColData,
  initialCellFormats,
  imperativeRef,
  partyName = '',
  inventoryModeEnabled = false,
  rateHistoryHintEnabled = true,
  billFormatForInv,
}: BillingGridProps): React.ReactElement {

  // ── Core state ───────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<BillingRow[]>(() => initialRows ?? makeInitialRows(20))
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>(
    initialAdjustments ?? [createEmptyAdjustment(newId())]
  )
  const [columnToggles, setColumnToggles] = useState<GridColumnToggles>(
    externalToggles ?? DEFAULT_COLUMN_TOGGLES
  )

  // ── Custom column state ───────────────────────────────────────────────────────
  const [customCols, setCustomCols] = useState<CustomColumn[]>(initialCustomCols ?? [])
  const [customColData, setCustomColData] = useState<CustomColData>(initialCustomColData ?? {})
  const [showAddColDialog, setShowAddColDialog] = useState(false)
  const [activeCustomCell, setActiveCustomCell] = useState<{ colId: string; rowIdx: number } | null>(null)

  // ── Cell formatting state (Phase 4a-i) ───────────────────────────────────────
  const [cellFormats, setCellFormats] = useState<CellFormatMap>(initialCellFormats ?? {})

  // ── Undo/Redo stack ───────────────────────────────────────────────────────────
  const undoStack = useRef<GridSnapshot[]>([])
  const redoStack = useRef<GridSnapshot[]>([])
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  // ── MKD dialog ────────────────────────────────────────────────────────────────
  const [mkdOpen, setMkdOpen] = useState(false)
  const [mkdPos, setMkdPos] = useState({ x: 120, y: 120 })
  const mkdDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)

  // ── Drag-to-reorder ────────────────────────────────────────────────────────────
  const [dragRowIdx, setDragRowIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // ── Rate History Hint (Phase 4a-ii-B) ────────────────────────────────────────
  // hintMap: rowIdx → ghost rate string (from bill history for this party+item combo)
  const [rateHints, setRateHints] = useState<Record<number, string | null>>({})

  // ── Inventory Autocomplete state (Phase 9b-B-ii-A) ────────────────────────────
  const [invSuggestions, setInvSuggestions] = useState<InventoryItemFull[]>([])
  const [invSelectedIdx, setInvSelectedIdx] = useState(0)
  const [invAnchorRowIdx, setInvAnchorRowIdx] = useState<number | null>(null)
  const [invImageCache, setInvImageCache] = useState<Record<string, string | null>>({})
  const invSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Navigation ────────────────────────────────────────────────────────────────
  const [activeCell, setActiveCell] = useState<CellAddress | null>(null)
  const [f2Unlocked, setF2Unlocked] = useState(false)

  const cellRefs = useRef<CellRefMap>(new Map())
  const customCellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Sync external toggles
  useEffect(() => {
    if (externalToggles) setColumnToggles(externalToggles)
  }, [externalToggles])

  // ── Rate Hint computation ────────────────────────────────────────────────────
  // When partyName changes or rows change, recompute all available hints per row.
  // We store the hints map so each rate cell can show its ghost without re-querying on every focus.
  useEffect(() => {
    if (!partyName.trim()) {
      setRateHints({})
      return
    }
    const newHints: Record<number, string | null> = {}
    rows.forEach((row: BillingRow, idx: number) => {
      if (row.itemName.trim()) {
        newHints[idx] = getRateHint(partyName, row.itemName)
      } else {
        newHints[idx] = null
      }
    })
    setRateHints(newHints)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyName, rows.map((r: BillingRow) => r.itemName).join('\x00')])


  // ── Snapshot helpers (Undo/Redo) — defined before inv helpers so pushUndo is in scope ──

  const captureSnapshot = useCallback((): GridSnapshot => ({
    rows: rows.map((r: BillingRow) => ({ ...r })),
    customCols: customCols.map((c: CustomColumn) => ({ ...c })),
    customColData: Object.fromEntries(
      Object.entries(customColData).map(([k, cells]) => [k, (cells as CustomColCell[]).map((c: CustomColCell) => ({ ...c }))])
    ),
    adjustments: adjustments.map((a: AdjustmentRow) => ({ ...a })),
  }), [rows, customCols, customColData, adjustments])

  const pushUndo = useCallback(() => {
    undoStack.current.push(captureSnapshot())
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
    setUndoLen(undoStack.current.length)
    setRedoLen(0)
  }, [captureSnapshot])

  // ── Inventory Autocomplete helpers (Phase 9b-B-ii-A) ─────────────────────────

  /**
   * Close the inventory autocomplete dropdown and clear state.
   */
  const closeInvDropdown = useCallback(() => {
    setInvSuggestions([])
    setInvSelectedIdx(0)
    setInvAnchorRowIdx(null)
  }, [])

  /**
   * Trigger a fuzzy search after a short debounce.
   * Loads images for any suggestion that has an imagePath.
   */
  const triggerInvSearch = useCallback((query: string, rowIdx: number) => {
    if (invSearchTimerRef.current) clearTimeout(invSearchTimerRef.current)
    if (!inventoryModeEnabled || !query.trim()) {
      closeInvDropdown()
      return
    }
    invSearchTimerRef.current = setTimeout(() => {
      const matches = inventoryService.fuzzySearchItems(query, 8)
      setInvSuggestions(matches)
      setInvSelectedIdx(0)
      setInvAnchorRowIdx(rowIdx)

      // Load images for suggestions that have an imagePath but aren't cached yet
      matches.forEach(item => {
        if (item.imagePath && !(item.id in invImageCache)) {
          // Mark as loading to prevent re-fetch
          setInvImageCache(prev => ({ ...prev, [item.id]: null }))
          inventoryService.getItemImageDataUrl(item.id)
            .then(url => {
              setInvImageCache(prev => ({ ...prev, [item.id]: url }))
            })
            .catch(() => {/* ignore */})
        }
      })
    }, 80)
  }, [inventoryModeEnabled, closeInvDropdown, invImageCache])

  /**
   * Accept the currently highlighted inventory suggestion.
   * Fills the item name and the correct rate field based on the active format.
   * Returns true if a suggestion was accepted (caller should prevent default).
   */
  // ── Notify parent ─────────────────────────────────────────────────────────────

  const notifyChange = useCallback((
    r: BillingRow[],
    adj: AdjustmentRow[],
    cc: CustomColumn[],
    ccd: CustomColData,
    cf?: CellFormatMap,
  ) => {
    if (onChange) {
      const totals = computeTotals(r, adj)
      onChange(r, adj, totals, cc, ccd, cf ?? cellFormats)
    }
  }, [onChange, cellFormats])

  /**
   * Accept the currently highlighted inventory suggestion (hoisted notifyChange above).
   * Fills the item name and the correct rate field based on the active format.
   * Returns true if a suggestion was accepted (caller should prevent default).
   */
  const acceptInvSuggestion = useCallback((rowIdx: number): boolean => {
    if (!inventoryModeEnabled) return false
    if (invSuggestions.length === 0 || invAnchorRowIdx !== rowIdx) return false
    const item = invSuggestions[invSelectedIdx] ?? invSuggestions[0]
    if (!item) return false

    // Determine which price field to use based on the bill format
    const rateCfg = inventoryService.getRateSourceConfig()
    const activeFormat = billFormatForInv ?? format
    const fieldId = activeFormat === 'gst' ? rateCfg.gstFormat : rateCfg.freeFormat
    const rateValue = inventoryService.getPriceValue(item, fieldId)

    // Apply item name and rate — user can keep typing freely after insert
    pushUndo()
    setRows(prev => {
      const next = prev.map((r, i) => {
        if (i !== rowIdx) return r
        return recalcRow({ ...r, itemName: item.itemName, rate: rateValue }, activeFormat)
      })
      notifyChange(next, adjustments, customCols, customColData)
      return next
    })

    // Close dropdown — user can continue typing in the cell freely
    closeInvDropdown()
    return true
  }, [
    inventoryModeEnabled,
    invSuggestions,
    invSelectedIdx,
    invAnchorRowIdx,
    billFormatForInv,
    format,
    pushUndo,
    adjustments,
    customCols,
    customColData,
    notifyChange,
    closeInvDropdown,
  ])

  const applySnapshot = useCallback((snap: GridSnapshot) => {
    setRows(snap.rows.map(r => ({ ...r })))
    setCustomCols(snap.customCols.map(c => ({ ...c })))
    setCustomColData(Object.fromEntries(
      Object.entries(snap.customColData).map(([k, cells]) => [k, cells.map(c => ({ ...c }))])
    ))
    setAdjustments(snap.adjustments.map(a => ({ ...a })))
  }, [])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    redoStack.current.push(captureSnapshot())
    const snap = undoStack.current.pop()!
    applySnapshot(snap)
    setUndoLen(undoStack.current.length)
    setRedoLen(redoStack.current.length)
  }, [captureSnapshot, applySnapshot])

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    undoStack.current.push(captureSnapshot())
    const snap = redoStack.current.pop()!
    applySnapshot(snap)
    setUndoLen(undoStack.current.length)
    setRedoLen(redoStack.current.length)
  }, [captureSnapshot, applySnapshot])

  // ── Build navigable columns ──────────────────────────────────────────────────

  const navCols = useMemo((): GridCol[] => {
    const base = format === 'free'
      ? [...FREE_FORMAT_NAV_COLS]
      : [...GST_FORMAT_NAV_COLS]
    if (!columnToggles.showQtyUnit) {
      return base.filter(c => c !== 'qtyUnit') as GridCol[]
    }
    return base as GridCol[]
  }, [format, columnToggles.showQtyUnit])

  const allNavCols = useMemo((): GridCol[] => {
    if (!columnToggles.showDiscount) {
      return navCols.filter(c => c !== 'discountValue')
    }
    return navCols
  }, [navCols, columnToggles.showDiscount])

  // ── Recalculate helpers ───────────────────────────────────────────────────────

  const recalcAll = useCallback((r: BillingRow[], fmt: BillFormat): BillingRow[] => {
    return r.map(row => recalcRow({ ...row }, fmt))
  }, [])

  // ── Format switch (Alt+1 / Alt+2) ────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1' && format !== 'free') {
        e.preventDefault()
        onFormatChange?.('free')
      } else if (e.altKey && e.key === '2' && format !== 'gst') {
        e.preventDefault()
        onFormatChange?.('gst')
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.shiftKey && e.key === 'z' || e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [format, onFormatChange, undo, redo])

  // Recalc rows when format changes
  useEffect(() => {
    setRows(prev => {
      const next = recalcAll(prev, format)
      notifyChange(next, adjustments, customCols, customColData)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  // ── Cell registration (standard cols) ───────────────────────────────────────

  const registerCell = useCallback((rowIdx: number, col: GridCol, el: HTMLInputElement | null) => {
    const key = cellKey(rowIdx, col)
    if (el) cellRefs.current.set(key, el)
    else cellRefs.current.delete(key)
  }, [])

  const registerCustomCell = useCallback((rowIdx: number, colId: string, el: HTMLInputElement | null) => {
    const key = `custom:${colId}:${rowIdx}`
    if (el) customCellRefs.current.set(key, el)
    else customCellRefs.current.delete(key)
  }, [])

  // ── Focus management ─────────────────────────────────────────────────────────

  const focusCell = useCallback((rowIdx: number, col: GridCol, placeCursorAtEnd = true) => {
    const el = cellRefs.current.get(cellKey(rowIdx, col))
    if (!el) return
    el.focus()
    if (placeCursorAtEnd) {
      const len = el.value.length
      el.setSelectionRange(len, len)
    }
  }, [])

  const pendingFocusRef = useRef<CellAddress | null>(null)
  useLayoutEffect(() => {
    if (!pendingFocusRef.current) return
    const { rowIdx, col } = pendingFocusRef.current
    pendingFocusRef.current = null
    focusCell(rowIdx, col)
  }, [focusCell])

  const moveTo = useCallback((rowIdx: number, col: GridCol) => {
    setActiveCell({ rowIdx, col })
    setF2Unlocked(false)
    setActiveCustomCell(null)
    pendingFocusRef.current = { rowIdx, col }
  }, [])

  // ── Row expansion ────────────────────────────────────────────────────────────

  const addRow = useCallback(() => {
    setRows(prev => {
      const newRow = createEmptyRow(newId())
      const next = [...prev, newRow]
      setCustomColData(prevCcd => {
        const updated: CustomColData = {}
        for (const [colId, cells] of Object.entries(prevCcd)) {
          updated[colId] = [...cells, emptyCell()]
        }
        notifyChange(next, adjustments, customCols, updated)
        return updated
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustments, customCols, customColData, notifyChange])

  // ── Update a row field ───────────────────────────────────────────────────────

  const updateRowField = useCallback((rowIdx: number, field: keyof BillingRow, value: string) => {
    pushUndo()
    setRows(prev => {
      const next = prev.map((r, i) => {
        if (i !== rowIdx) return r
        const updated = { ...r, [field]: value }
        return recalcRow(updated, format)
      })
      notifyChange(next, adjustments, customCols, customColData)
      return next
    })
  }, [format, adjustments, customCols, customColData, notifyChange, pushUndo])

  // ── Toggle discount type ─────────────────────────────────────────────────────

  const toggleDiscountType = useCallback((rowIdx: number) => {
    setRows(prev => {
      const next = prev.map((r, i) => {
        if (i !== rowIdx) return r
        const updated = { ...r, discountType: r.discountType === 'pct' ? 'flat' : 'pct' as 'pct' | 'flat' }
        return recalcRow(updated, format)
      })
      notifyChange(next, adjustments, customCols, customColData)
      return next
    })
  }, [format, adjustments, customCols, customColData, notifyChange])

  // ── Custom column CRUD ────────────────────────────────────────────────────────

  const addCustomColumn = useCallback(() => {
    setShowAddColDialog(true)
  }, [])

  const handleAddColConfirm = useCallback((name: string) => {
    setShowAddColDialog(false)
    pushUndo()
    const col: CustomColumn = { id: newId(), header: name }
    const initialCells: CustomColCell[] = rows.map(() => emptyCell())

    setCustomCols(prev => {
      const next = [...prev, col]
      setCustomColData(prevCcd => {
        const updated = { ...prevCcd, [col.id]: initialCells }
        notifyChange(rows, adjustments, next, updated)
        return updated
      })
      return next
    })
  }, [rows, adjustments, notifyChange, pushUndo])

  const removeLastCustomColumn = useCallback(() => {
    if (customCols.length === 0) return
    pushUndo()
    const last = customCols[customCols.length - 1]
    setCustomCols(prev => {
      const next = prev.slice(0, -1)
      setCustomColData(prevCcd => {
        const updated = { ...prevCcd }
        delete updated[last.id]
        notifyChange(rows, adjustments, next, updated)
        return updated
      })
      return next
    })
  }, [customCols, rows, adjustments, notifyChange, pushUndo])

  const updateCustomCell = useCallback((colId: string, rowIdx: number, value: string) => {
    pushUndo()
    setCustomColData(prev => {
      const cells = [...(prev[colId] ?? [])]
      while (cells.length <= rowIdx) cells.push(emptyCell())
      cells[rowIdx] = { ...cells[rowIdx], value }
      const updated = { ...prev, [colId]: cells }
      notifyChange(rows, adjustments, customCols, updated)
      return updated
    })
  }, [rows, adjustments, customCols, notifyChange, pushUndo])

  // ── Mark system ───────────────────────────────────────────────────────────────

  const markActiveCustomCell = useCallback(() => {
    if (!activeCustomCell) return
    const { colId, rowIdx } = activeCustomCell
    pushUndo()
    setCustomColData(prev => {
      const cells = [...(prev[colId] ?? [])]
      while (cells.length <= rowIdx) cells.push(emptyCell())
      const current = cells[rowIdx]
      cells[rowIdx] = { ...current, marked: !current.marked }
      const updated = { ...prev, [colId]: cells }
      notifyChange(rows, adjustments, customCols, updated)
      return updated
    })
  }, [activeCustomCell, rows, adjustments, customCols, notifyChange, pushUndo])

  // ── Cell formatting (Phase 4a-i) ──────────────────────────────────────────────

  /**
   * Get the format key for the currently active cell.
   * Standard cell: "{rowId}:{colName}"
   * Custom cell:   "custom:{colId}:{rowId}"
   */
  const getActiveCellFormatKey = useCallback((): string | null => {
    if (activeCell) {
      const row = rows[activeCell.rowIdx]
      if (!row) return null
      return `${row.id}:${activeCell.col}`
    }
    if (activeCustomCell) {
      const row = rows[activeCustomCell.rowIdx]
      if (!row) return null
      return `custom:${activeCustomCell.colId}:${row.id}`
    }
    return null
  }, [activeCell, activeCustomCell, rows])

  /**
   * Apply bold + text color to the currently active cell.
   * Both bold and color are toggled together: if already same color, clears it.
   */
  const applyBoldHighlight = useCallback((color: string) => {
    const key = getActiveCellFormatKey()
    if (!key) return
    setCellFormats(prev => {
      const existing = prev[key] ?? {}
      const alreadyApplied = existing.bold && existing.textColor === color
      const next: CellFormatMap = {
        ...prev,
        [key]: alreadyApplied
          ? { ...existing, bold: false, textColor: undefined }
          : { ...existing, bold: true, textColor: color },
      }
      // Notify parent with new formats
      const totals = computeTotals(rows, adjustments)
      onChange?.(rows, adjustments, totals, customCols, customColData, next)
      return next
    })
  }, [getActiveCellFormatKey, rows, adjustments, customCols, customColData, onChange])

  /**
   * Apply background color to the currently active cell.
   */
  const highlightCell = useCallback((color: string) => {
    const key = getActiveCellFormatKey()
    if (!key) return
    setCellFormats(prev => {
      const existing = prev[key] ?? {}
      const alreadyApplied = existing.bgColor === color
      const next: CellFormatMap = {
        ...prev,
        [key]: alreadyApplied
          ? { ...existing, bgColor: undefined }
          : { ...existing, bgColor: color },
      }
      const totals = computeTotals(rows, adjustments)
      onChange?.(rows, adjustments, totals, customCols, customColData, next)
      return next
    })
  }, [getActiveCellFormatKey, rows, adjustments, customCols, customColData, onChange])

  /**
   * Clear all formatting from the currently active cell.
   */
  const clearCellFormat = useCallback(() => {
    const key = getActiveCellFormatKey()
    if (!key) return
    setCellFormats(prev => {
      const next = { ...prev }
      delete next[key]
      const totals = computeTotals(rows, adjustments)
      onChange?.(rows, adjustments, totals, customCols, customColData, next)
      return next
    })
  }, [getActiveCellFormatKey, rows, adjustments, customCols, customColData, onChange])

  /**
   * Get format for a standard cell by rowIdx and col.
   */
  const getCellFmt = useCallback((rowIdx: number, col: GridCol): CellFormat => {
    const row = rows[rowIdx]
    if (!row) return {}
    return cellFormats[`${row.id}:${col}`] ?? {}
  }, [rows, cellFormats])

  /**
   * Get format for a custom cell by colId and rowIdx.
   */
  const getCustomCellFmt = useCallback((colId: string, rowIdx: number): CellFormat => {
    const row = rows[rowIdx]
    if (!row) return {}
    return cellFormats[`custom:${colId}:${row.id}`] ?? {}
  }, [rows, cellFormats])

  // ── Keyboard navigation ──────────────────────────────────────────────────────

  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIdx: number,
    col: GridCol,
  ) => {
    const isLastRow = rowIdx === rows.length - 1
    const colIdx = allNavCols.indexOf(col)
    const isLastCol = colIdx === allNavCols.length - 1 && customCols.length === 0
    const isFirstCol = colIdx === 0

    // ── Insert key — column-context-aware (Phase 4a-ii-B + 9b-B-ii-A) ────────
    // In Item Name cell (inventory mode ON): Insert accepts inventory autocomplete.
    // In Rate cell: Insert accepts the rate history hint.
    // These are COMPLETELY INDEPENDENT — fire based on which column the cursor is in.
    // Zero conflict guaranteed.
    if (e.key === 'Insert') {
      if (col === 'itemName') {
        // Inventory autocomplete accept — only fires if dropdown is open for this row
        const accepted = acceptInvSuggestion(rowIdx)
        if (accepted) {
          e.preventDefault()
          // Cursor stays in item name cell; user can keep typing freely
          setTimeout(() => {
            const el = cellRefs.current.get(`${rowIdx}:itemName`)
            if (el) {
              const len = el.value.length
              el.setSelectionRange(len, len)
            }
          }, 0)
        }
        // If no dropdown was open, Insert does nothing in item name cell
        return
      }

      if (col === 'rate') {
        // Rate history hint accept (Phase 4a-ii-B)
        e.preventDefault()
        const hint = rateHints[rowIdx]
        if (hint) {
          updateRowField(rowIdx, 'rate', hint)
        }
        return
      }

      // Insert does nothing in any other column
      return
    }

    // ── ArrowUp / ArrowDown in Item Name — navigate inventory suggestions ─────
    // When the inventory dropdown is open, Up/Down navigate it instead of moving rows.
    if (col === 'itemName' && inventoryModeEnabled && invSuggestions.length > 0 && invAnchorRowIdx === rowIdx) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setInvSelectedIdx(prev => Math.min(prev + 1, invSuggestions.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setInvSelectedIdx(prev => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeInvDropdown()
        return
      }
    }

    if (e.key === 'F2') {
      e.preventDefault()
      setF2Unlocked(true)
      const el = e.currentTarget
      el.setSelectionRange(el.value.length, el.value.length)
      return
    }

    if (f2ModeEnabled && !f2Unlocked) {
      const navKeys = ['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                       'Escape', 'F2', 'Home', 'End', 'PageUp', 'PageDown']
      if (!navKeys.includes(e.key)) {
        e.preventDefault()
        return
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (col === 'itemName') closeInvDropdown()
      if (e.shiftKey) {
        if (!isFirstCol) moveTo(rowIdx, allNavCols[colIdx - 1])
        else if (rowIdx > 0) moveTo(rowIdx - 1, allNavCols[allNavCols.length - 1])
      } else {
        if (!isLastCol) {
          moveTo(rowIdx, allNavCols[colIdx + 1])
        } else if (customCols.length > 0) {
          setActiveCustomCell({ colId: customCols[0].id, rowIdx })
          setActiveCell(null)
          setTimeout(() => {
            customCellRefs.current.get(`custom:${customCols[0].id}:${rowIdx}`)?.focus()
          }, 0)
        } else if (rowIdx < rows.length - 1) {
          moveTo(rowIdx + 1, allNavCols[0])
        }
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (col === 'itemName') closeInvDropdown()
      if (isLastRow) {
        addRow()
        pendingFocusRef.current = { rowIdx: rowIdx + 1, col }
        setActiveCell({ rowIdx: rowIdx + 1, col })
        setF2Unlocked(false)
      } else {
        moveTo(rowIdx + 1, col)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (col === 'itemName') closeInvDropdown()
      if (isLastRow) {
        addRow()
        pendingFocusRef.current = { rowIdx: rowIdx + 1, col }
        setActiveCell({ rowIdx: rowIdx + 1, col })
        setF2Unlocked(false)
      } else {
        moveTo(rowIdx + 1, col)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) moveTo(rowIdx - 1, col)
      return
    }

    if (e.key === 'ArrowLeft') {
      const el = e.currentTarget
      if (el.selectionStart === 0 && el.selectionEnd === 0 && !isFirstCol) {
        e.preventDefault()
        moveTo(rowIdx, allNavCols[colIdx - 1])
      }
      return
    }

    if (e.key === 'ArrowRight') {
      const el = e.currentTarget
      const end = el.value.length
      if (el.selectionStart === end && el.selectionEnd === end && !isLastCol) {
        e.preventDefault()
        moveTo(rowIdx, allNavCols[colIdx + 1])
      }
      return
    }
  }, [
    rows.length, allNavCols, customCols, f2ModeEnabled, f2Unlocked, moveTo, addRow,
    rateHints, updateRowField,
    inventoryModeEnabled, invSuggestions, invAnchorRowIdx,
    acceptInvSuggestion, closeInvDropdown, cellRefs,
  ])

  // Custom cell key nav (vertical only for simplicity)
  const handleCustomCellKeyDown = useCallback((
    e: React.KeyboardEvent<HTMLInputElement>,
    colId: string,
    colIdx: number,
    rowIdx: number,
  ) => {
    const isLastRow = rowIdx === rows.length - 1
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (isLastRow) {
        addRow()
        setTimeout(() => {
          customCellRefs.current.get(`custom:${colId}:${rowIdx + 1}`)?.focus()
        }, 30)
      } else {
        setActiveCustomCell({ colId, rowIdx: rowIdx + 1 })
        setTimeout(() => {
          customCellRefs.current.get(`custom:${colId}:${rowIdx + 1}`)?.focus()
        }, 0)
      }
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) {
        setActiveCustomCell({ colId, rowIdx: rowIdx - 1 })
        setTimeout(() => {
          customCellRefs.current.get(`custom:${colId}:${rowIdx - 1}`)?.focus()
        }, 0)
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextColIdx = colIdx + 1
      if (!e.shiftKey && nextColIdx < customCols.length) {
        const nextColId = customCols[nextColIdx].id
        setActiveCustomCell({ colId: nextColId, rowIdx })
        setTimeout(() => {
          customCellRefs.current.get(`custom:${nextColId}:${rowIdx}`)?.focus()
        }, 0)
      } else if (!e.shiftKey) {
        if (rowIdx < rows.length - 1) moveTo(rowIdx + 1, allNavCols[0])
      } else {
        if (colIdx > 0) {
          const prevColId = customCols[colIdx - 1].id
          setActiveCustomCell({ colId: prevColId, rowIdx })
          setTimeout(() => {
            customCellRefs.current.get(`custom:${prevColId}:${rowIdx}`)?.focus()
          }, 0)
        } else {
          moveTo(rowIdx, allNavCols[allNavCols.length - 1])
        }
      }
    }
  }, [rows.length, customCols, allNavCols, moveTo, addRow])

  // ── TSV paste ────────────────────────────────────────────────────────────────

  const handlePaste = useCallback((
    e: React.ClipboardEvent<HTMLInputElement>,
    rowIdx: number,
    col: GridCol,
  ) => {
    const text = e.clipboardData.getData('text/plain')
    if (!text.includes('\t') && !text.includes('\n')) return

    e.preventDefault()
    const pasteLines = text.split('\n').filter(l => l !== '')

    setRows(prev => {
      let next = [...prev]
      let currentRow = rowIdx
      const colIdx = allNavCols.indexOf(col)

      for (const line of pasteLines) {
        const values = line.split('\t')
        if (currentRow >= next.length) {
          while (next.length <= currentRow) {
            next = [...next, createEmptyRow(newId())]
          }
        }
        values.forEach((val, vi) => {
          const targetColIdx = colIdx + vi
          if (targetColIdx >= allNavCols.length) return
          const targetCol = allNavCols[targetColIdx]
          const row = { ...next[currentRow], [targetCol]: val.trim() }
          next[currentRow] = recalcRow(row, format)
        })
        currentRow++
      }
      notifyChange(next, adjustments, customCols, customColData)
      return next
    })
  }, [allNavCols, format, adjustments, customCols, customColData, notifyChange])

  // ── Adjustment handlers ──────────────────────────────────────────────────────

  const updateAdjustment = useCallback((idx: number, field: 'label' | 'amount', val: string) => {
    setAdjustments(prev => {
      const next = prev.map((a, i) => i === idx ? { ...a, [field]: val } : a)
      notifyChange(rows, next, customCols, customColData)
      return next
    })
  }, [rows, customCols, customColData, notifyChange])

  const addAdjustment = useCallback(() => {
    setAdjustments(prev => {
      const next = [...prev, createEmptyAdjustment(newId())]
      notifyChange(rows, next, customCols, customColData)
      return next
    })
  }, [rows, customCols, customColData, notifyChange])

  const removeAdjustment = useCallback((idx: number) => {
    setAdjustments(prev => {
      const next = prev.filter((_, i) => i !== idx)
      notifyChange(rows, next, customCols, customColData)
      return next
    })
  }, [rows, customCols, customColData, notifyChange])

  // ── Column toggle handlers ───────────────────────────────────────────────────

  const toggleColumn = useCallback((key: keyof GridColumnToggles) => {
    setColumnToggles(prev => {
      const next = { ...prev, [key]: !prev[key] }
      onColumnTogglesChange?.(next)
      return next
    })
  }, [onColumnTogglesChange])

  // ── Drag-to-reorder ───────────────────────────────────────────────────────────

  const handleDragStart = useCallback((rowIdx: number) => {
    setDragRowIdx(rowIdx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, rowIdx: number) => {
    e.preventDefault()
    setDragOverIdx(rowIdx)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (dragRowIdx === null || dragRowIdx === targetIdx) {
      setDragRowIdx(null)
      setDragOverIdx(null)
      return
    }
    pushUndo()
    setRows(prev => {
      const next = [...prev]
      const [dragged] = next.splice(dragRowIdx, 1)
      next.splice(targetIdx, 0, dragged)
      setCustomColData(prevCcd => {
        const updated: CustomColData = {}
        for (const [colId, cells] of Object.entries(prevCcd)) {
          const newCells = [...cells]
          const [draggedCell] = newCells.splice(dragRowIdx, 1)
          newCells.splice(targetIdx, 0, draggedCell ?? emptyCell())
          updated[colId] = newCells
        }
        notifyChange(next, adjustments, customCols, updated)
        return updated
      })
      return next
    })
    setDragRowIdx(null)
    setDragOverIdx(null)
  }, [dragRowIdx, adjustments, customCols, notifyChange, pushUndo])

  const handleDragEnd = useCallback(() => {
    setDragRowIdx(null)
    setDragOverIdx(null)
  }, [])

  // ── MKD dialog drag ────────────────────────────────────────────────────────────

  const startMkdDrag = useCallback((e: React.MouseEvent) => {
    mkdDragRef.current = {
      startX: e.clientX, startY: e.clientY,
      origX: mkdPos.x, origY: mkdPos.y,
    }
    const onMove = (ev: MouseEvent) => {
      if (!mkdDragRef.current) return
      setMkdPos({
        x: mkdDragRef.current.origX + (ev.clientX - mkdDragRef.current.startX),
        y: mkdDragRef.current.origY + (ev.clientY - mkdDragRef.current.startY),
      })
    }
    const onUp = () => {
      mkdDragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [mkdPos])

  // ── Sl.No, totals ─────────────────────────────────────────────────────────────

  const slNos = useMemo(() => calcSlNos(rows), [rows])
  const totals = useMemo(() => computeTotals(rows, adjustments), [rows, adjustments])

  // ── Table total width ─────────────────────────────────────────────────────────

  const tableWidth = useMemo(() => {
    let w = COL_WIDTHS.dragHandle + COL_WIDTHS.slno + COL_WIDTHS.itemName + COL_WIDTHS.qty + COL_WIDTHS.rate + COL_WIDTHS.amount
    if (columnToggles.showQtyUnit) w += COL_WIDTHS.qtyUnit
    if (columnToggles.showDiscount) w += COL_WIDTHS.discountValue
    if (format === 'gst') w += COL_WIDTHS.preTax + COL_WIDTHS.gstPct + COL_WIDTHS.gstAmt
    w += customCols.length * COL_WIDTHS.customCol
    return w
  }, [format, columnToggles, customCols.length])

  // ── Expose imperative handle ─────────────────────────────────────────────────

  useEffect(() => {
    if (!imperativeRef) return
    imperativeRef.current = {
      addCustomColumn,
      removeLastCustomColumn,
      markActiveCustomCell,
      showMkd: () => setMkdOpen(true),
      undo,
      redo,
      canUndo: () => undoStack.current.length > 0,
      canRedo: () => redoStack.current.length > 0,
      applyBoldHighlight,
      highlightCell,
      clearCellFormat,
      getActiveInfo: () => ({
        hasActiveCell: !!activeCell,
        hasActiveCustomCell: !!activeCustomCell,
      }),
      getSnapshot: () => ({
        rows: rows.map(r => ({ ...r })),
        adjustments: adjustments.map(a => ({ ...a })),
        customCols: customCols.map(c => ({ ...c })),
        customColData: Object.fromEntries(
          Object.entries(customColData).map(([k, v]) => [k, v.map(cell => ({ ...cell }))])
        ),
        cellFormats: { ...cellFormats },
      }),
      loadSnapshot: (snap: {
        rows: BillingRow[]
        adjustments: AdjustmentRow[]
        customCols: CustomColumn[]
        customColData: CustomColData
        cellFormats: CellFormatMap
      }) => {
        setRows(snap.rows)
        setAdjustments(snap.adjustments)
        setCustomCols(snap.customCols)
        setCustomColData(snap.customColData)
        setCellFormats(snap.cellFormats)
      },
    }
  }, [
    imperativeRef,
    addCustomColumn,
    removeLastCustomColumn,
    markActiveCustomCell,
    undo,
    redo,
    applyBoldHighlight,
    highlightCell,
    clearCellFormat,
    rows,
    adjustments,
    customCols,
    customColData,
    cellFormats,
  ])

  // ── MKD data ─────────────────────────────────────────────────────────────────

  const mkdData = useMemo(() => {
    return customCols.map(col => ({
      col,
      groups: computeMkdGroups(col.header, customColData[col.id] ?? []),
    }))
  }, [customCols, customColData])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: S.font, display: 'flex', flexDirection: 'column', gap: '0', position: 'relative' }}>

      {/* Add Column Dialog */}
      {showAddColDialog && (
        <AddColumnDialog
          onConfirm={handleAddColConfirm}
          onCancel={() => setShowAddColDialog(false)}
        />
      )}

      {/* ── Toolbar row: Format toggle, column toggles, +Col/-Col, Mark, MKD, Undo/Redo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        paddingBottom: '10px', flexWrap: 'wrap',
      }}>
        {/* Format toggle */}
        <div style={{
          display: 'flex', background: S.surfaceRaised,
          border: `1px solid ${S.border}`, borderRadius: '8px', overflow: 'hidden',
        }}>
          {(['free', 'gst'] as BillFormat[]).map((f, fi) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormatChange?.(f)}
              title={fi === 0 ? 'Alt+1' : 'Alt+2'}
              style={{
                padding: '5px 14px',
                fontSize: '0.75rem', fontWeight: 700, fontFamily: S.font,
                border: 'none', cursor: 'pointer',
                background: format === f ? S.accent : 'transparent',
                color: format === f ? S.surface : S.textMuted,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {f === 'free' ? 'Free Format' : 'GST Format'}
              <span style={{ marginLeft: '5px', opacity: 0.55, fontSize: '0.65rem' }}>{fi === 0 ? 'Alt+1' : 'Alt+2'}</span>
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: S.border }} />

        {/* Discount toggle */}
        <button
          type="button"
          onClick={() => toggleColumn('showDiscount')}
          style={toggleBtnStyle(columnToggles.showDiscount)}
        >
          {columnToggles.showDiscount ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          Discount
        </button>

        {/* Qty Unit toggle */}
        <button
          type="button"
          onClick={() => toggleColumn('showQtyUnit')}
          style={toggleBtnStyle(columnToggles.showQtyUnit)}
        >
          {columnToggles.showQtyUnit ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          Qty Unit
        </button>

        <div style={{ width: 1, height: 20, background: S.border }} />

        {/* +Col button */}
        <button
          type="button"
          onClick={addCustomColumn}
          title="Add custom column (+Col)"
          style={iconBtnStyle(false)}
        >
          <Columns size={13} />
          +Col
        </button>

        {/* -Col button */}
        <button
          type="button"
          onClick={removeLastCustomColumn}
          disabled={customCols.length === 0}
          title="Remove last custom column (-Col)"
          style={iconBtnStyle(false, customCols.length === 0)}
        >
          <Columns size={13} />
          -Col
        </button>

        {/* Mark button */}
        <button
          type="button"
          onClick={markActiveCustomCell}
          disabled={!activeCustomCell}
          title="Mark cell as sub-group header (Mark)"
          style={iconBtnStyle(
            !!(activeCustomCell && customColData[activeCustomCell.colId]?.[activeCustomCell.rowIdx]?.marked),
            !activeCustomCell
          )}
        >
          <Tag size={13} />
          Mark
        </button>

        {/* Show MKD button */}
        <button
          type="button"
          onClick={() => setMkdOpen(true)}
          disabled={customCols.length === 0}
          title="Show MKD totals (Show MKD)"
          style={iconBtnStyle(mkdOpen, customCols.length === 0)}
        >
          <BarChart2 size={13} />
          MKD
        </button>

        <div style={{ width: 1, height: 20, background: S.border }} />

        {/* Undo */}
        <button
          type="button"
          onClick={undo}
          disabled={undoLen === 0}
          title={`Undo (Ctrl+Z) — ${undoLen} step${undoLen !== 1 ? 's' : ''}`}
          style={iconBtnStyle(false, undoLen === 0)}
        >
          <Undo2 size={13} />
          Undo
        </button>

        {/* Redo */}
        <button
          type="button"
          onClick={redo}
          disabled={redoLen === 0}
          title={`Redo (Ctrl+Y / Ctrl+Shift+Z) — ${redoLen} step${redoLen !== 1 ? 's' : ''}`}
          style={iconBtnStyle(false, redoLen === 0)}
        >
          <Redo2 size={13} />
          Redo
        </button>

        {f2ModeEnabled && (
          <span style={{
            marginLeft: 'auto', fontSize: '0.68rem', color: S.textMuted,
            padding: '3px 8px', border: `1px solid ${S.border}`, borderRadius: '4px',
            opacity: 0.7,
          }}>
            F2 Mode ON
          </span>
        )}
      </div>

      {/* ── Grid Table ── */}
      <div style={{
        overflowX: 'auto',
        border: `1px solid ${S.border}`,
        borderRadius: '10px',
        background: S.surfaceRaised,
      }}>
        <table style={{
          width: '100%',
          minWidth: `${tableWidth}px`,
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}>
          <colgroup>
            <col style={{ width: COL_WIDTHS.dragHandle }} />
            <col style={{ width: COL_WIDTHS.slno }} />
            <col style={{ width: COL_WIDTHS.itemName }} />
            {columnToggles.showQtyUnit && <col style={{ width: COL_WIDTHS.qtyUnit }} />}
            <col style={{ width: COL_WIDTHS.qty }} />
            {columnToggles.showDiscount && <col style={{ width: COL_WIDTHS.discountValue }} />}
            <col style={{ width: COL_WIDTHS.rate }} />
            {format === 'gst' && <>
              <col style={{ width: COL_WIDTHS.preTax }} />
              <col style={{ width: COL_WIDTHS.gstPct }} />
              <col style={{ width: COL_WIDTHS.gstAmt }} />
            </>}
            <col style={{ width: COL_WIDTHS.amount }} />
            {customCols.map(cc => (
              <col key={cc.id} style={{ width: COL_WIDTHS.customCol }} />
            ))}
          </colgroup>

          {/* ── Header ── */}
          <thead>
            <tr style={{ background: `color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))` }}>
              <th style={thStyle('center')} />

              {[
                { label: '#',         key: 'slno',         align: 'center' },
                { label: 'Item Name', key: 'itemName',     align: 'left'   },
                ...(columnToggles.showQtyUnit ? [{ label: 'Unit', key: 'qtyUnit', align: 'center' }] : []),
                { label: 'Qty',       key: 'qty',          align: 'right'  },
                ...(columnToggles.showDiscount ? [{ label: 'Disc.', key: 'discountValue', align: 'right' }] : []),
                { label: 'Rate',      key: 'rate',         align: 'right'  },
                ...(format === 'gst' ? [
                  { label: 'Pre Tax', key: 'preTax',  align: 'right' },
                  { label: 'GST %',   key: 'gstPct',  align: 'right' },
                  { label: 'GST Amt', key: 'gstAmt',  align: 'right' },
                ] : []),
                { label: 'Amount',    key: 'amount',       align: 'right'  },
              ].map(col => (
                <th key={col.key} style={thStyle(col.align as 'left' | 'right' | 'center')}>
                  {col.label}
                </th>
              ))}

              {customCols.map(cc => (
                <th key={cc.id} style={thStyle('left')}>
                  <span style={{ color: 'var(--cq-accent)', fontFamily: S.font }}>
                    {cc.header}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {rows.map((row, rowIdx) => {
              const isActive = activeCell?.rowIdx === rowIdx
              const slNo = slNos[rowIdx]
              const isDragging = dragRowIdx === rowIdx
              const isDragOver = dragOverIdx === rowIdx

              const rowBg = isDragOver
                ? `color-mix(in srgb, var(--cq-accent) 15%, var(--cq-surface-raised))`
                : isActive
                  ? `color-mix(in srgb, var(--cq-accent) 5%, var(--cq-surface-raised))`
                  : rowIdx % 2 === 0 ? S.surfaceRaised : `color-mix(in srgb, var(--cq-surface) 60%, var(--cq-surface-raised))`

              return (
                <tr
                  key={row.id}
                  draggable
                  onDragStart={() => handleDragStart(rowIdx)}
                  onDragOver={e => handleDragOver(e, rowIdx)}
                  onDrop={e => handleDrop(e, rowIdx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    background: rowBg,
                    transition: 'background 0.1s',
                    opacity: isDragging ? 0.45 : 1,
                    cursor: 'default',
                  }}
                >
                  {/* Drag handle */}
                  <td style={{
                    padding: '3px 4px',
                    textAlign: 'center',
                    borderBottom: `1px solid ${S.border}`,
                    cursor: 'grab',
                    color: S.textMuted,
                    opacity: 0.4,
                  }}>
                    <GripVertical size={13} />
                  </td>

                  {/* Sl.No */}
                  <td style={{
                    textAlign: 'center', padding: '4px 4px',
                    fontSize: '0.72rem', color: S.textMuted, fontFamily: S.mono,
                    borderBottom: `1px solid ${S.border}`,
                    userSelect: 'none',
                  }}>
                    {slNo > 0 ? slNo : ''}
                  </td>

                  {/* Item Name */}
                  <GridCell
                    rowIdx={rowIdx} col="itemName" value={row.itemName}
                    isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'itemName'}
                    f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                    align="left"
                    fmt={getCellFmt(rowIdx, 'itemName')}
                    registerCell={registerCell}
                    onFocus={() => {
                      setActiveCell({ rowIdx, col: 'itemName' })
                      setActiveCustomCell(null)
                      setF2Unlocked(false)
                      // Re-trigger search if there's already text (re-focusing the cell)
                      if (inventoryModeEnabled && row.itemName.trim()) {
                        triggerInvSearch(row.itemName, rowIdx)
                      }
                    }}
                    onChange={v => {
                      updateRowField(rowIdx, 'itemName', v)
                      // Trigger inventory autocomplete on every keystroke
                      if (inventoryModeEnabled) triggerInvSearch(v, rowIdx)
                    }}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 'itemName')}
                    onPaste={e => handlePaste(e, rowIdx, 'itemName')}
                    onBlur={() => {
                      // Close dropdown with a small delay so click-to-select still works
                      setTimeout(() => {
                        setInvAnchorRowIdx(prev => {
                          if (prev === rowIdx) {
                            setInvSuggestions([])
                            setInvSelectedIdx(0)
                            return null
                          }
                          return prev
                        })
                      }, 120)
                    }}
                  />

                  {/* Qty Unit */}
                  {columnToggles.showQtyUnit && (
                    <GridCell
                      rowIdx={rowIdx} col="qtyUnit" value={row.qtyUnit}
                      isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'qtyUnit'}
                      f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                      align="center"
                      fmt={getCellFmt(rowIdx, 'qtyUnit')}
                      registerCell={registerCell}
                      onFocus={() => { setActiveCell({ rowIdx, col: 'qtyUnit' }); setActiveCustomCell(null); setF2Unlocked(false) }}
                      onChange={v => updateRowField(rowIdx, 'qtyUnit', v)}
                      onKeyDown={e => handleCellKeyDown(e, rowIdx, 'qtyUnit')}
                      onPaste={e => handlePaste(e, rowIdx, 'qtyUnit')}
                    />
                  )}

                  {/* Qty */}
                  <GridCell
                    rowIdx={rowIdx} col="qty" value={row.qty}
                    isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'qty'}
                    f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                    align="right" numeric
                    fmt={getCellFmt(rowIdx, 'qty')}
                    registerCell={registerCell}
                    onFocus={() => { setActiveCell({ rowIdx, col: 'qty' }); setActiveCustomCell(null); setF2Unlocked(false) }}
                    onChange={v => updateRowField(rowIdx, 'qty', v)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 'qty')}
                    onPaste={e => handlePaste(e, rowIdx, 'qty')}
                  />

                  {/* Discount */}
                  {columnToggles.showDiscount && (
                    <GridCell
                      rowIdx={rowIdx} col="discountValue" value={row.discountValue}
                      isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'discountValue'}
                      f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                      align="right" numeric
                      fmt={getCellFmt(rowIdx, 'discountValue')}
                      rightAdornment={
                        <DiscountToggleBtn type={row.discountType} onToggle={() => toggleDiscountType(rowIdx)} />
                      }
                      registerCell={registerCell}
                      onFocus={() => { setActiveCell({ rowIdx, col: 'discountValue' }); setActiveCustomCell(null); setF2Unlocked(false) }}
                      onChange={v => updateRowField(rowIdx, 'discountValue', v)}
                      onKeyDown={e => handleCellKeyDown(e, rowIdx, 'discountValue')}
                      onPaste={e => handlePaste(e, rowIdx, 'discountValue')}
                    />
                  )}

                  {/* Rate */}
                  <GridCell
                    rowIdx={rowIdx} col="rate" value={row.rate}
                    isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'rate'}
                    f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                    align="right" numeric
                    fmt={getCellFmt(rowIdx, 'rate')}
                    rateHint={rateHistoryHintEnabled && row.rate === '' ? (rateHints[rowIdx] ?? null) : null}
                    registerCell={registerCell}
                    onFocus={() => {
                      setActiveCell({ rowIdx, col: 'rate' })
                      setActiveCustomCell(null)
                      setF2Unlocked(false)
                    }}
                    onChange={v => updateRowField(rowIdx, 'rate', v)}
                    onKeyDown={e => handleCellKeyDown(e, rowIdx, 'rate')}
                    onPaste={e => handlePaste(e, rowIdx, 'rate')}
                  />

                  {/* GST cols */}
                  {format === 'gst' && <>
                    <ReadOnlyCell value={row.preTax > 0 ? formatINR(row.preTax) : ''} border={S.border} />
                    <GridCell
                      rowIdx={rowIdx} col="gstPct" value={row.gstPct}
                      isActive={activeCell?.rowIdx === rowIdx && activeCell.col === 'gstPct'}
                      f2ModeEnabled={f2ModeEnabled} f2Unlocked={f2Unlocked}
                      align="right" numeric
                      fmt={getCellFmt(rowIdx, 'gstPct')}
                      registerCell={registerCell}
                      onFocus={() => { setActiveCell({ rowIdx, col: 'gstPct' }); setActiveCustomCell(null); setF2Unlocked(false) }}
                      onChange={v => updateRowField(rowIdx, 'gstPct', v)}
                      onKeyDown={e => handleCellKeyDown(e, rowIdx, 'gstPct')}
                      onPaste={e => handlePaste(e, rowIdx, 'gstPct')}
                    />
                    <ReadOnlyCell value={row.gstAmt > 0 ? formatINR(row.gstAmt) : ''} border={S.border} />
                  </>}

                  {/* Amount */}
                  <ReadOnlyCell value={row.amount > 0 ? formatINR(row.amount) : ''} border={S.border} bold />

                  {/* Custom cells */}
                  {customCols.map((cc, colIdx) => {
                    const cells = customColData[cc.id] ?? []
                    const cell = cells[rowIdx] ?? emptyCell()
                    const isCustomActive = activeCustomCell?.colId === cc.id && activeCustomCell.rowIdx === rowIdx
                    const cFmt = getCustomCellFmt(cc.id, rowIdx)
                    return (
                      <CustomCell
                        key={cc.id}
                        colId={cc.id}
                        colIdx={colIdx}
                        rowIdx={rowIdx}
                        cell={cell}
                        fmt={cFmt}
                        isActive={isCustomActive}
                        border={S.border}
                        registerCell={registerCustomCell}
                        onFocus={() => { setActiveCustomCell({ colId: cc.id, rowIdx }); setActiveCell(null) }}
                        onChange={v => updateCustomCell(cc.id, rowIdx, v)}
                        onKeyDown={e => handleCustomCellKeyDown(e, cc.id, colIdx, rowIdx)}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Adjustments & Totals ── */}
      <div style={{
        marginTop: '12px', display: 'flex', flexDirection: 'column',
        gap: '0', alignSelf: 'flex-end', minWidth: '320px', maxWidth: '400px',
      }}>
        {totals.subtotal > 0 && adjustments.some(a => parseNum(a.amount) !== 0) && (
          <TotalsRow label="Subtotal" value={totals.subtotal}
            labelStyle={{ fontSize: '0.8rem', color: S.textMuted }}
            valueStyle={{ fontSize: '0.85rem', color: S.text }} />
        )}

        {adjustments.map((adj, idx) => (
          <AdjustmentRowEditor
            key={adj.id}
            adj={adj} idx={idx}
            onLabelChange={v => updateAdjustment(idx, 'label', v)}
            onAmountChange={v => updateAdjustment(idx, 'amount', v)}
            onRemove={() => removeAdjustment(idx)}
            border={S.border} surfaceRaised={S.surfaceRaised}
            textMuted={S.textMuted} font={S.font} mono={S.mono} text={S.text}
          />
        ))}

        <button type="button" onClick={addAdjustment} style={{
          alignSelf: 'flex-start', marginTop: '4px',
          background: 'none', border: `1px dashed ${S.border}`, borderRadius: '5px',
          padding: '3px 10px', fontSize: '0.72rem', color: S.textMuted,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          <Plus size={11} />
          Add Adjustment
        </button>

        <div style={{ height: '1px', background: S.border, margin: '8px 0' }} />

        <TotalsRow
          label="Grand Total"
          value={totals.grandTotal}
          note="(rounded)"
          labelStyle={{ fontSize: '0.95rem', fontWeight: 700, color: S.text }}
          valueStyle={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--cq-accent)' }}
        />
      </div>

      {/* ── MKD Dialog ── */}
      {mkdOpen && (
        <div style={{
          position: 'fixed',
          left: mkdPos.x,
          top: mkdPos.y,
          zIndex: 8000,
          background: S.surfaceRaised,
          border: `1px solid ${S.border}`,
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          minWidth: '240px',
          maxWidth: '320px',
          overflow: 'hidden',
          userSelect: 'none',
        }}>
          {/* Drag handle */}
          <div
            onMouseDown={startMkdDrag}
            style={{
              padding: '8px 12px 6px',
              background: `color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface-raised))`,
              borderBottom: `1px solid ${S.border}`,
              cursor: 'move',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--cq-accent)', letterSpacing: '0.08em' }}>
              MKD — QTY TOTALS
            </span>
            <button
              type="button"
              onClick={() => setMkdOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textMuted, padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '10px 12px', maxHeight: '340px', overflowY: 'auto' }}>
            {mkdData.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: S.textMuted, fontStyle: 'italic' }}>
                No custom columns yet.
              </div>
            ) : mkdData.map(({ col, groups }) => (
              <div key={col.id} style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '0.68rem', fontWeight: 800, color: 'var(--cq-accent)',
                  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px',
                  paddingBottom: '3px', borderBottom: `1px solid ${S.border}`,
                }}>
                  Column: {col.header}
                </div>
                {groups.map((g, gi) => (
                  <div key={gi} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    padding: '2px 0',
                    borderBottom: gi < groups.length - 1 ? `1px dashed ${S.border}` : 'none',
                  }}>
                    <span style={{ fontSize: '0.78rem', color: S.text, fontFamily: S.font }}>
                      {g.groupName}
                    </span>
                    <span style={{
                      fontSize: '0.82rem', fontFamily: S.mono, fontWeight: 600,
                      color: g.total > 0 ? 'var(--cq-accent)' : S.textMuted,
                    }}>
                      {g.total}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Inventory Autocomplete dropdown (Phase 9b-B-ii-A) ── */}
      {inventoryModeEnabled && invSuggestions.length > 0 && invAnchorRowIdx !== null && (
        <InventoryAutocomplete
          items={invSuggestions}
          selectedIdx={invSelectedIdx}
          anchorEl={
            invAnchorRowIdx !== null
              ? (cellRefs.current.get(`${invAnchorRowIdx}:itemName`) ?? null)
              : null
          }
          onSelect={item => {
            if (invAnchorRowIdx !== null) {
              // Accept directly by clicking
              const rowIdx = invAnchorRowIdx
              const rateCfg = inventoryService.getRateSourceConfig()
              const activeFormat = billFormatForInv ?? format
              const fieldId = activeFormat === 'gst' ? rateCfg.gstFormat : rateCfg.freeFormat
              const rateValue = inventoryService.getPriceValue(item, fieldId)
              pushUndo()
              setRows(prev => {
                const next = prev.map((r, i) => {
                  if (i !== rowIdx) return r
                  return recalcRow({ ...r, itemName: item.itemName, rate: rateValue }, activeFormat)
                })
                notifyChange(next, adjustments, customCols, customColData)
                return next
              })
              closeInvDropdown()
              // Re-focus the item name cell so user can keep typing
              setTimeout(() => {
                const el = cellRefs.current.get(`${rowIdx}:itemName`)
                if (el) { el.focus(); const len = el.value.length; el.setSelectionRange(len, len) }
              }, 0)
            }
          }}
          imageCache={invImageCache}
        />
      )}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function thStyle(align: 'left' | 'right' | 'center'): React.CSSProperties {
  return {
    padding: '6px 8px', textAlign: align,
    fontSize: '0.7rem', fontWeight: 700, fontFamily: '"Inter", system-ui, sans-serif',
    color: 'var(--cq-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase',
    borderBottom: `2px solid var(--cq-border)`,
    userSelect: 'none',
  }
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '5px 10px',
    fontSize: '0.73rem', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif',
    border: `1px solid ${active ? 'var(--cq-accent)' : 'var(--cq-border)'}`,
    borderRadius: '6px',
    background: active ? 'color-mix(in srgb, var(--cq-accent) 12%, transparent)' : 'transparent',
    color: active ? 'var(--cq-accent)' : 'var(--cq-text-muted)',
    cursor: 'pointer',
  }
}

function iconBtnStyle(active: boolean, disabled = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '4px',
    padding: '5px 9px',
    fontSize: '0.72rem', fontWeight: 600, fontFamily: '"Inter", system-ui, sans-serif',
    border: `1px solid ${active ? 'var(--cq-accent)' : 'var(--cq-border)'}`,
    borderRadius: '6px',
    background: active ? 'color-mix(in srgb, var(--cq-accent) 12%, transparent)' : 'transparent',
    color: disabled ? 'var(--cq-text-muted)' : active ? 'var(--cq-accent)' : 'var(--cq-text-muted)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}

// ─── GridCell ─────────────────────────────────────────────────────────────────

interface GridCellProps {
  rowIdx: number
  col: GridCol
  value: string
  isActive: boolean
  f2ModeEnabled: boolean
  f2Unlocked: boolean
  align: 'left' | 'right' | 'center'
  numeric?: boolean
  rightAdornment?: React.ReactNode
  fmt: CellFormat
  /** Rate History Hint ghost text (Phase 4a-ii-B) — only passed to Rate cells */
  rateHint?: string | null
  registerCell: (rowIdx: number, col: GridCol, el: HTMLInputElement | null) => void
  onFocus: () => void
  onChange: (val: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void
  /** Optional blur handler — used by Item Name cell for inventory autocomplete close */
  onBlur?: () => void
}

function GridCell({
  rowIdx, col, value, isActive, f2ModeEnabled, f2Unlocked,
  align, numeric, rightAdornment, fmt, rateHint,
  registerCell, onFocus, onChange, onKeyDown, onPaste, onBlur,
}: GridCellProps): React.ReactElement {
  const locked = f2ModeEnabled && !f2Unlocked && isActive
  // Show hint ghost when: value is empty, hint exists, cell is active (focused)
  const showHintGhost = !!(rateHint && value === '' && isActive)

  return (
    <td style={{
      padding: '2px 3px',
      borderBottom: `1px solid var(--cq-border)`,
      position: 'relative',
      background: fmt.bgColor ?? 'transparent',
      transition: 'background 0.1s',
    }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={el => registerCell(rowIdx, col, el)}
          className="cq-grid-cell"
          type="text"
          inputMode={numeric ? 'decimal' : 'text'}
          value={value}
          onFocus={onFocus}
          onBlur={onBlur}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          readOnly={locked}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: rightAdornment ? '4px 22px 4px 6px' : '4px 6px',
            fontSize: '0.82rem',
            fontFamily: numeric ? '"JetBrains Mono", "Fira Code", monospace' : '"Inter", system-ui, sans-serif',
            textAlign: align,
            color: fmt.textColor ?? 'var(--cq-text-primary)',
            fontWeight: fmt.bold ? 700 : 400,
            background: locked ? 'color-mix(in srgb, var(--cq-text-muted) 6%, transparent)' : 'transparent',
            border: `1.5px solid ${isActive ? 'var(--cq-accent)' : 'transparent'}`,
            borderRadius: '5px', outline: 'none',
            transition: 'border-color 0.1s, background 0.1s',
            cursor: locked ? 'default' : 'text',
          }}
        />
        {/* Rate History Hint — ghost placeholder (Phase 4a-ii-B) */}
        {showHintGhost && (
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            padding: '4px 6px',
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: '0.82rem',
            color: 'var(--cq-text-muted)',
            opacity: 0.45,
            userSelect: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            {rateHint}
          </div>
        )}
        {/* Hint badge — shows "↵ Insert" hint when ghost is visible */}
        {showHintGhost && (
          <div style={{
            position: 'absolute',
            top: '-18px',
            right: 0,
            pointerEvents: 'none',
            background: 'color-mix(in srgb, var(--cq-accent) 12%, var(--cq-surface-raised))',
            border: '1px solid var(--cq-accent)',
            borderRadius: '4px',
            padding: '1px 5px',
            fontSize: '0.6rem',
            color: 'var(--cq-accent)',
            fontWeight: 700,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
            zIndex: 10,
            opacity: 0.85,
          }}>
            Insert to accept ↑
          </div>
        )}
        {rightAdornment}
      </div>
    </td>
  )
}

// ─── CustomCell ────────────────────────────────────────────────────────────────

interface CustomCellProps {
  colId: string
  colIdx: number
  rowIdx: number
  cell: CustomColCell
  fmt: CellFormat
  isActive: boolean
  border: string
  registerCell: (rowIdx: number, colId: string, el: HTMLInputElement | null) => void
  onFocus: () => void
  onChange: (val: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

function CustomCell({
  colId, rowIdx, cell, fmt, isActive, border, registerCell, onFocus, onChange, onKeyDown,
}: CustomCellProps): React.ReactElement {
  const isMarked = cell.marked

  return (
    <td style={{
      padding: '2px 3px',
      borderBottom: `1px solid ${border}`,
      borderLeft: `1px solid ${border}`,
      position: 'relative',
      background: fmt.bgColor ?? (isMarked
        ? 'color-mix(in srgb, var(--cq-accent) 14%, var(--cq-surface-raised))'
        : 'transparent'),
      transition: 'background 0.1s',
    }}>
      {isMarked && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: '3px',
          background: 'var(--cq-accent)',
        }} />
      )}
      <input
        ref={el => registerCell(rowIdx, colId, el)}
        className="cq-custom-cell"
        type="text"
        value={cell.value}
        onFocus={onFocus}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '4px 6px 4px 8px',
          fontSize: '0.82rem',
          fontFamily: '"Inter", system-ui, sans-serif',
          color: fmt.textColor ?? (isMarked ? 'var(--cq-accent)' : 'var(--cq-text-primary)'),
          fontWeight: fmt.bold ? 700 : (isMarked ? 700 : 400),
          background: 'transparent',
          border: `1.5px solid ${isActive ? 'var(--cq-accent)' : 'transparent'}`,
          borderRadius: '5px', outline: 'none',
          cursor: 'text',
        }}
        title={isMarked ? '▶ Group header (Mark)' : undefined}
      />
      {isMarked && (
        <span style={{
          position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '0.55rem', color: 'var(--cq-accent)', opacity: 0.7,
          fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none',
        }}>
          MKD
        </span>
      )}
    </td>
  )
}

// ─── ReadOnlyCell ─────────────────────────────────────────────────────────────

function ReadOnlyCell({ value, border, bold = false }: {
  value: string; border: string; bold?: boolean
}): React.ReactElement {
  return (
    <td style={{
      padding: '4px 8px', textAlign: 'right',
      fontSize: '0.82rem',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontWeight: bold ? 700 : 400,
      color: value ? 'var(--cq-text-primary)' : 'transparent',
      borderBottom: `1px solid ${border}`,
      background: value ? 'color-mix(in srgb, var(--cq-accent) 4%, transparent)' : 'transparent',
      userSelect: 'all',
    }}>
      {value || '·'}
    </td>
  )
}

// ─── TotalsRow ────────────────────────────────────────────────────────────────

function TotalsRow({ label, value, labelStyle, valueStyle, note }: {
  label: string; value: number;
  labelStyle?: React.CSSProperties; valueStyle?: React.CSSProperties; note?: string
}): React.ReactElement {
  const display = value !== 0
    ? `₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`
    : '₹ 0'
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '5px 4px' }}>
      <span style={{ fontFamily: '"Inter", system-ui, sans-serif', ...labelStyle }}>
        {label}
        {note && <span style={{ marginLeft: '6px', fontSize: '0.65rem', opacity: 0.5 }}>{note}</span>}
      </span>
      <span style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', ...valueStyle }}>
        {display}
      </span>
    </div>
  )
}

// ─── AdjustmentRowEditor ──────────────────────────────────────────────────────

function AdjustmentRowEditor({ adj, onLabelChange, onAmountChange, onRemove, border, surfaceRaised, textMuted, font, mono, text }: {
  adj: AdjustmentRow; idx: number;
  onLabelChange: (v: string) => void; onAmountChange: (v: string) => void; onRemove: () => void;
  border: string; surfaceRaised: string; textMuted: string; font: string; mono: string; text: string
}): React.ReactElement {
  const amt = parseNum(adj.amount)
  const isNeg = amt < 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 4px' }}>
      <input type="text" value={adj.label} onChange={e => onLabelChange(e.target.value)}
        placeholder="Label (e.g. Freight)"
        style={{ flex: 1, padding: '4px 8px', fontSize: '0.78rem', fontFamily: font, color: text, background: surfaceRaised, border: `1px solid ${border}`, borderRadius: '5px', outline: 'none' }}
      />
      <input type="text" value={adj.amount} onChange={e => onAmountChange(e.target.value)}
        placeholder="0"
        style={{ width: '90px', padding: '4px 8px', fontSize: '0.82rem', fontFamily: mono, textAlign: 'right', color: isNeg ? '#ef4444' : text, background: surfaceRaised, border: `1px solid ${border}`, borderRadius: '5px', outline: 'none' }}
      />
      <button type="button" onClick={onRemove} title="Remove adjustment"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: textMuted, padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center', opacity: 0.6 }}
      >
        <Minus size={13} />
      </button>
    </div>
  )
}
