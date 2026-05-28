/**
 * cQikly — Inventory Page
 * Phase 9a-A: Full item table, categories/sub-categories, tabular free-navigation editing.
 * Phase 9a-B: Stock tracking, thresholds, deduction, low stock alerts, unit of measurement.
 * Phase 9b-A: Price change history, product usage history, bulk price update,
 *             barcode/SKU field (searchable, scanner auto-detected).
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react'
import {
  Plus, Trash2, PenLine, ChevronDown, ChevronRight,
  FolderPlus, X, AlertTriangle, CheckSquare, Square,
  Tag, BarChart3, FileDown, FileUp,
} from 'lucide-react'
import {
  inventoryService,
  type InventoryItemFull,
  type CustomPriceColumn,
  type InventoryCategory,
} from '../../services/inventory.service'
import { eventBus } from '../../utils/eventBus'
import { useConfig } from '../../contexts/ConfigContext'
import BulkPriceUpdateModal from './BulkPriceUpdateModal'
import ItemDetailPanel from './ItemDetailPanel'
import ItemImageCell from './ItemImageCell'
import InventoryExcelPanel from './InventoryExcelPanel'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  font:    '"Inter", system-ui, sans-serif',
  accent:  'var(--cq-accent)',
  text:    'var(--cq-text-primary)',
  muted:   'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  raised:  'var(--cq-surface-raised)',
  border:  'var(--cq-border)',
}

// ─── Fixed column definitions ─────────────────────────────────────────────────

const FIXED_COLS: Array<{ id: string; label: string; width: number; numeric?: boolean }> = [
  { id: 'itemName',       label: 'Item Name',       width: 200 },
  { id: 'barcode',        label: 'Barcode / SKU',   width: 130 },
  { id: 'category',       label: 'Category',        width: 130 },
  { id: 'subCategory',    label: 'Sub-Category',    width: 130 },
  { id: 'price',          label: 'Price',           width: 90,  numeric: true },
  { id: 'wholesalePrice', label: 'Wholesale Price', width: 110, numeric: true },
  { id: 'gstPrice',       label: 'GST Price',       width: 90,  numeric: true },
  { id: 'creditPrice',    label: 'Credit',          width: 90,  numeric: true },
]

const TAIL_COLS: Array<{ id: string; label: string; width: number; numeric?: boolean }> = [
  { id: 'gstRate', label: 'GST Rate %', width: 90, numeric: true },
]

function cellKey(rowIdx: number, colId: string): string {
  return `${rowIdx}:${colId}`
}

// ─── useInventoryData hook ─────────────────────────────────────────────────────

function useInventoryData() {
  const [items, setItems] = useState<InventoryItemFull[]>([])
  const [cols, setCols]   = useState<CustomPriceColumn[]>([])
  const [cats, setCats]   = useState<InventoryCategory[]>([])

  const reload = useCallback(() => {
    setItems(inventoryService.getItems())
    setCols(inventoryService.getCustomColumns())
    setCats(inventoryService.getCategories())
  }, [])

  useEffect(() => {
    reload()
    const unsub = eventBus.on('inventoryChanged', reload)
    return () => unsub()
  }, [reload])

  return { items, cols, cats, reload }
}

// ─── Barcode scanner detection ────────────────────────────────────────────────
//
// Hardware barcode scanners type a full barcode string very rapidly
// (typically 50-300ms for the whole string) followed by Enter.
// We detect this by tracking keystroke timing in the global search/barcode field.
//
// Strategy: When the barcode input is focused:
//   - If characters arrive <50ms apart → treat as scanner input
//   - On Enter → fire barcode lookup
//   - On any other focus state → treat as normal typing

function useBarcodeScanner(onScanned: (code: string) => void) {
  const lastKeyTime = useRef<number>(0)
  const buffer = useRef<string>('')
  const scannerMode = useRef<boolean>(false)

  const handleBarcodeKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now()
    const gap = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      if (scannerMode.current && buffer.current.length > 0) {
        onScanned(buffer.current)
        e.preventDefault()
      }
      buffer.current = ''
      scannerMode.current = false
      return
    }

    if (e.key.length === 1) {
      // Very fast consecutive keystrokes = scanner
      if (gap < 50) {
        scannerMode.current = true
      } else if (gap > 500) {
        // Long gap → reset — probably manual typing
        buffer.current = ''
        scannerMode.current = false
      }
      buffer.current += e.key
    }
  }, [onScanned])

  return { handleBarcodeKeyDown, isScannerMode: () => scannerMode.current }
}

// ─── DeleteConfirm ────────────────────────────────────────────────────────────

function DeleteConfirm({ label, onConfirm, onCancel }: {
  label: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: S.raised, borderRadius: 14, border: `1px solid ${S.border}`, padding: '28px 32px', minWidth: 340, fontFamily: S.font, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: S.text, marginBottom: 8 }}>Delete?</div>
        <div style={{ fontSize: '0.85rem', color: S.muted, marginBottom: 24 }}><strong style={{ color: S.text }}>{label}</strong> will be permanently removed.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 600, padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${S.border}`, color: S.muted }}>Cancel</button>
          <button onClick={onConfirm} style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: '#ef4444', border: 'none', color: '#fff' }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ─── AddColumnModal ───────────────────────────────────────────────────────────

function AddColumnModal({ onAdd, onClose }: { onAdd: (label: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: S.raised, borderRadius: 14, border: `1px solid ${S.border}`, padding: '28px 32px', minWidth: 360, fontFamily: S.font, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: S.text, marginBottom: 16 }}>Add Custom Price Column</div>
        <input ref={inputRef} value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { const t = label.trim(); if (t) { onAdd(t); onClose() } } if (e.key === 'Escape') onClose() }}
          placeholder="e.g. Export Price, B2B Rate"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: S.font, fontSize: '0.9rem', padding: '8px 12px', borderRadius: 8, background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, outline: 'none' }}
        />
        <div style={{ fontSize: '0.75rem', color: S.muted, marginTop: 6 }}>Appears on all items and in the Inventory Rate Source selector in Settings.</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
          <button onClick={onClose} style={{ fontFamily: S.font, fontSize: '0.82rem', padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${S.border}`, color: S.muted }}>Cancel</button>
          <button onClick={() => { const t = label.trim(); if (t) { onAdd(t); onClose() } }} style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '7px 18px', borderRadius: 8, cursor: 'pointer', background: S.accent, border: 'none', color: '#fff' }}>Add Column</button>
        </div>
      </div>
    </div>
  )
}

// ─── CategorySidebar ──────────────────────────────────────────────────────────

function CategorySidebar({ cats, selectedCatId, selectedSubCat, onSelectCat, onSelectSubCat }: {
  cats: InventoryCategory[]
  selectedCatId: string | null
  selectedSubCat: string | null
  onSelectCat: (id: string | null) => void
  onSelectSubCat: (sub: string | null) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [addingCat, setAddingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')

  const pill = (active: boolean) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 5,
    padding: '5px 9px', borderRadius: 7, cursor: 'pointer' as const,
    background: active ? `${S.accent}22` : 'transparent',
    border: `1.5px solid ${active ? `${S.accent}55` : 'transparent'}`,
    color: active ? S.accent : S.text,
    fontSize: '0.82rem', fontWeight: active ? 700 : 500,
    transition: 'all 0.13s', userSelect: 'none' as const, marginBottom: 1,
  })

  const handleAddCat = () => {
    const n = newCatName.trim(); if (!n) return
    inventoryService.addCategory(n); setNewCatName(''); setAddingCat(false)
  }
  const handleAddSub = (catId: string) => {
    const n = newSubName.trim(); if (!n) return
    inventoryService.addSubCategory(catId, n); setNewSubName(''); setAddingSubFor(null)
  }

  return (
    <div style={{ width: 196, minWidth: 196, flexShrink: 0, borderRight: `1px solid ${S.border}`, padding: '14px 8px', overflowY: 'auto', fontFamily: S.font }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: S.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>Categories</div>
      <div style={pill(selectedCatId === null)} onClick={() => { onSelectCat(null); onSelectSubCat(null) }}>📦 All Items</div>
      {cats.map(cat => {
        const isExpanded = expanded.has(cat.id)
        const isActive = selectedCatId === cat.id && selectedSubCat === null
        return (
          <div key={cat.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{ ...pill(isActive), flex: 1 }} onClick={() => { onSelectCat(cat.id); onSelectSubCat(null) }}>📁 {cat.name}</div>
              <button onClick={e => { e.stopPropagation(); setExpanded(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n }) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '2px 3px', borderRadius: 3 }}>
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            </div>
            {isExpanded && (
              <div style={{ paddingLeft: 10 }}>
                {cat.subCategories.map(sub => (
                  <div key={sub} style={pill(selectedCatId === cat.id && selectedSubCat === sub)} onClick={() => { onSelectCat(cat.id); onSelectSubCat(sub) }}>└ {sub}</div>
                ))}
                {addingSubFor === cat.id ? (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddSub(cat.id); if (e.key === 'Escape') { setAddingSubFor(null); setNewSubName('') } }}
                      placeholder="Sub-category" style={{ flex: 1, fontFamily: S.font, fontSize: '0.77rem', padding: '3px 6px', borderRadius: 5, background: S.surface, border: `1px solid ${S.border}`, color: S.text, outline: 'none' }} />
                    <button onClick={() => handleAddSub(cat.id)} style={{ background: S.accent, border: 'none', color: '#fff', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: '0.75rem' }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingSubFor(cat.id); setNewSubName('') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: 3, padding: '2px 5px' }}>
                    <Plus size={10} /> sub-category
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {addingCat ? (
        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddCat(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName('') } }}
            placeholder="Category name" style={{ flex: 1, fontFamily: S.font, fontSize: '0.8rem', padding: '5px 7px', borderRadius: 6, background: S.surface, border: `1px solid ${S.border}`, color: S.text, outline: 'none' }} />
          <button onClick={handleAddCat} style={{ background: S.accent, border: 'none', color: '#fff', borderRadius: 5, padding: '3px 7px', cursor: 'pointer' }}>+</button>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)}
          style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: `1px dashed ${S.border}`, color: S.muted, borderRadius: 7, padding: '5px 9px', cursor: 'pointer', fontSize: '0.79rem', width: '100%' }}>
          <FolderPlus size={13} /> Add category
        </button>
      )}
    </div>
  )
}

// ─── InventoryPage ─────────────────────────────────────────────────────────────

export default function InventoryPage(): React.ReactElement {
  const { items, cols, cats } = useInventoryData()
  const { config } = useConfig()
  const stockEnabled = config.stockQtyEnabled === true

  const [selectedCatId, setSelectedCatId]   = useState<string | null>(null)
  const [selectedSubCat, setSelectedSubCat] = useState<string | null>(null)
  const [search, setSearch]                 = useState('')
  const [activeCell, setActiveCell]         = useState<{ rowIdx: number; colId: string } | null>(null)
  const [f2Mode, setF2Mode]                 = useState(false)
  const [f2Unlocked, setF2Unlocked]         = useState(false)

  // Phase 9b-A: bulk select & price update
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal]   = useState(false)
  const [detailItem, setDetailItem]         = useState<InventoryItemFull | null>(null)

  // Phase 9b-B-i: row hover (for image action buttons)
  const [hoveredRowId, setHoveredRowId]     = useState<string | null>(null)

  const [showAddCol, setShowAddCol]           = useState(false)
  const [deleteItemId, setDeleteItemId]       = useState<string | null>(null)
  const [deletingColId, setDeletingColId]     = useState<string | null>(null)
  const [renamingColId, setRenamingColId]     = useState<string | null>(null)
  const [renameVal, setRenameVal]             = useState('')
  const [showExcelPanel, setShowExcelPanel]   = useState(false)

  // Local edits (per item.id::colId) — flushed on blur
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // Barcode scanner detection — fires when Enter is pressed after scanner-speed input
  const { handleBarcodeKeyDown } = useBarcodeScanner((code) => {
    // On scanner input, find item by barcode and highlight it
    const found = inventoryService.findByBarcode(code)
    if (found) {
      setSearch(code)
      setDetailItem(found)
    }
  })

  const registerCell = (rowIdx: number, colId: string, el: HTMLInputElement | null) => {
    const k = cellKey(rowIdx, colId)
    if (el) cellRefs.current.set(k, el)
    else cellRefs.current.delete(k)
  }

  // Stock columns
  const STOCK_COLS: Array<{ id: string; label: string; width: number; numeric?: boolean }> = stockEnabled
    ? [
        { id: 'stockQty',          label: 'Stock Qty', width: 90,  numeric: true },
        { id: 'lowStockThreshold', label: 'Min Stock', width: 90,  numeric: true },
        { id: 'unit',              label: 'Unit',      width: 70  },
      ]
    : []

  const allCols = useMemo(() => [
    ...FIXED_COLS,
    ...STOCK_COLS,
    ...cols.map(c => ({ id: c.id, label: c.label, width: 110, numeric: true })),
    ...TAIL_COLS,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [cols, stockEnabled])

  const displayedItems = useMemo(() => {
    let list = items
    if (selectedCatId !== null) {
      list = list.filter(i => i.category === selectedCatId)
      if (selectedSubCat !== null) list = list.filter(i => i.subCategory === selectedSubCat)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(i =>
        i.itemName.toLowerCase().includes(q) ||
        i.barcode.toLowerCase().includes(q)
      )
    }
    return list
  }, [items, selectedCatId, selectedSubCat, search])

  // Keep detailItem in sync when items reload
  useEffect(() => {
    if (detailItem) {
      const fresh = items.find(i => i.id === detailItem.id)
      if (fresh) setDetailItem(fresh)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Phase 12b: navigate-to-inventory-item from command palette
  useEffect(() => {
    return eventBus.on('navigateToInventoryItem', ({ itemId }) => {
      const item = items.find(i => i.id === itemId)
      if (item) {
        setSearch(item.itemName)
        setDetailItem(item)
      }
    })
  }, [items])

  function isLowStock(item: InventoryItemFull): boolean {
    if (!stockEnabled) return false
    const qty = parseFloat(item.stockQty)
    const min = parseFloat(item.lowStockThreshold)
    if (!Number.isFinite(min) || item.lowStockThreshold === '') return false
    if (!Number.isFinite(qty)) return true
    return qty < min
  }

  function getCellValue(item: InventoryItemFull, colId: string): string {
    switch (colId) {
      case 'itemName':       return item.itemName
      case 'barcode':        return item.barcode
      case 'category': {
        const cat = cats.find(c => c.id === item.category)
        return cat?.name ?? item.category
      }
      case 'subCategory':    return item.subCategory
      case 'price':          return item.price
      case 'wholesalePrice': return item.wholesalePrice
      case 'gstPrice':       return item.gstPrice
      case 'creditPrice':    return item.creditPrice
      case 'gstRate':        return item.gstRate
      case 'stockQty':       return item.stockQty
      case 'lowStockThreshold': return item.lowStockThreshold
      case 'unit':           return item.unit
      default:               return item.customPrices[colId] ?? ''
    }
  }

  function setCellValue(item: InventoryItemFull, colId: string, value: string): void {
    let patch: Partial<InventoryItemFull> = {}
    switch (colId) {
      case 'itemName':       patch = { itemName: value }; break
      case 'barcode':        patch = { barcode: value }; break
      case 'category': {
        const cat = cats.find(c => c.name.toLowerCase() === value.toLowerCase())
        patch = { category: cat?.id ?? value, subCategory: '' }; break
      }
      case 'subCategory':    patch = { subCategory: value }; break
      case 'price':          patch = { price: value }; break
      case 'wholesalePrice': patch = { wholesalePrice: value }; break
      case 'gstPrice':       patch = { gstPrice: value }; break
      case 'creditPrice':    patch = { creditPrice: value }; break
      case 'gstRate':        patch = { gstRate: value }; break
      case 'stockQty':       patch = { stockQty: value }; break
      case 'lowStockThreshold': patch = { lowStockThreshold: value }; break
      case 'unit':           patch = { unit: value }; break
      default: patch = { customPrices: { ...item.customPrices, [colId]: value } }; break
    }
    inventoryService.updateItem(item.id, patch)
  }

  const eKey = (itemId: string, colId: string) => `${itemId}::${colId}`
  const getLocal = (itemId: string, colId: string, fallback: string) => {
    const k = eKey(itemId, colId); return k in localEdits ? localEdits[k] : fallback
  }
  const setLocal = (itemId: string, colId: string, value: string) => {
    setLocalEdits(prev => ({ ...prev, [eKey(itemId, colId)]: value }))
  }
  const flushLocal = (item: InventoryItemFull, colId: string) => {
    const k = eKey(item.id, colId)
    if (!(k in localEdits)) return
    setCellValue(item, colId, localEdits[k])
    setLocalEdits(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  useEffect(() => {
    const ids = new Set(items.map(i => i.id))
    setLocalEdits(prev => {
      const n = { ...prev }
      Object.keys(n).forEach(k => { if (!ids.has(k.split('::')[0])) delete n[k] })
      return n
    })
  }, [items])

  const focusCell = useCallback((rowIdx: number, colId: string) => {
    const el = cellRefs.current.get(cellKey(rowIdx, colId))
    if (!el) return
    el.focus()
    try { const len = el.value.length; el.setSelectionRange(len, len) } catch { /* ok */ }
  }, [])

  const handleAddItem = useCallback(async () => {
    await inventoryService.addItem({ category: selectedCatId ?? '', subCategory: selectedSubCat ?? '' })
    requestAnimationFrame(() => { focusCell(displayedItems.length, 'itemName') })
  }, [selectedCatId, selectedSubCat, displayedItems.length, focusCell])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colId: string) => {
    const colOrder = allCols.map(c => c.id)
    const colIdx = colOrder.indexOf(colId)
    const totalRows = displayedItems.length

    if (f2Mode && !f2Unlocked) {
      const navKeys = ['Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape', 'F2']
      if (!navKeys.includes(e.key)) { e.preventDefault(); return }
    }

    if (e.key === 'F2') { e.preventDefault(); setF2Unlocked(true); return }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (!e.shiftKey) {
        if (colIdx < colOrder.length - 1) focusCell(rowIdx, colOrder[colIdx + 1])
        else if (rowIdx < totalRows - 1) focusCell(rowIdx + 1, colOrder[0])
      } else {
        if (colIdx > 0) focusCell(rowIdx, colOrder[colIdx - 1])
        else if (rowIdx > 0) focusCell(rowIdx - 1, colOrder[colOrder.length - 1])
      }
      setF2Unlocked(false); return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (rowIdx < totalRows - 1) focusCell(rowIdx + 1, colId)
      else handleAddItem()
      setF2Unlocked(false); return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (rowIdx < totalRows - 1) focusCell(rowIdx + 1, colId)
      else handleAddItem()
      setF2Unlocked(false); return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (rowIdx > 0) focusCell(rowIdx - 1, colId)
      setF2Unlocked(false); return
    }
    if (e.key === 'ArrowRight' && !f2Unlocked) {
      if (colIdx < colOrder.length - 1) { e.preventDefault(); focusCell(rowIdx, colOrder[colIdx + 1]) }
      return
    }
    if (e.key === 'ArrowLeft' && !f2Unlocked) {
      if (colIdx > 0) { e.preventDefault(); focusCell(rowIdx, colOrder[colIdx - 1]) }
      return
    }
  }, [f2Mode, f2Unlocked, allCols, displayedItems.length, focusCell, handleAddItem])

  // ── Bulk selection helpers ──────────────────────────────────────────────────

  const allDisplayedSelected = displayedItems.length > 0 && displayedItems.every(i => selectedIds.has(i.id))
  const someSelected = selectedIds.size > 0

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      setSelectedIds(prev => { const n = new Set(prev); displayedItems.forEach(i => n.delete(i.id)); return n })
    } else {
      setSelectedIds(prev => { const n = new Set(prev); displayedItems.forEach(i => n.add(i.id)); return n })
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  const selectedItemObjects = useMemo(() =>
    items.filter(i => selectedIds.has(i.id)),
    [items, selectedIds]
  )

  const tableWidth = allCols.reduce((s, c) => s + c.width, 0) + 44 + 40 + 50 // +40 for select col

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: S.font, color: S.text }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px 10px', borderBottom: `1px solid ${S.border}`, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.08rem', fontWeight: 800, color: S.text }}>📦 Inventory</div>
        {stockEnabled && (
          <span style={{ fontSize: '0.71rem', fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80', letterSpacing: '0.03em' }}>
            Stock Tracking ON
          </span>
        )}
        <div style={{ flex: 1 }} />

        {/* Bulk price update button — visible when items selected */}
        {someSelected && (
          <button onClick={() => setShowBulkModal(true)}
            style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', background: `${S.accent}22`, border: `1.5px solid ${S.accent}55`, color: S.accent, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Tag size={13} /> Bulk Price Update ({selectedIds.size})
          </button>
        )}

        {/* Search — doubles as barcode scanner input */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          placeholder="Search or scan barcode…"
          title="Type to search by name or SKU. Connect a barcode scanner — scan auto-detects."
          style={{ fontFamily: S.font, fontSize: '0.83rem', padding: '6px 11px', borderRadius: 8, width: 210, background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, outline: 'none' }}
        />

        <button onClick={() => { setF2Mode(p => !p); setF2Unlocked(false) }}
          style={{ fontFamily: S.font, fontSize: '0.77rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', background: f2Mode ? `${S.accent}33` : S.surface, border: `1.5px solid ${f2Mode ? S.accent : S.border}`, color: f2Mode ? S.accent : S.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
          F2 {f2Mode ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => setShowAddCol(true)}
          style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Custom Column
        </button>

        {/* ── Excel Import / Export ── */}
        <button
          onClick={() => setShowExcelPanel(true)}
          title="Import from Excel or Export to Excel"
          style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, display: 'flex', alignItems: 'center', gap: 5 }}>
          <FileDown size={13} />
          <FileUp size={13} />
          Excel
        </button>

        <button onClick={handleAddItem}
          style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '6px 15px', borderRadius: 8, cursor: 'pointer', background: S.accent, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Add Item
        </button>
      </div>

      {/* Body: sidebar + table + optional detail panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <CategorySidebar cats={cats} selectedCatId={selectedCatId} selectedSubCat={selectedSubCat} onSelectCat={setSelectedCatId} onSelectSubCat={setSelectedSubCat} />

        {/* Table */}
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative', minWidth: 0 }}>
          <table style={{ borderCollapse: 'collapse', width: tableWidth, minWidth: '100%', fontFamily: S.font, fontSize: '0.82rem', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: S.raised }}>
                {/* Select-all checkbox */}
                <th style={{ width: 40, padding: '8px 6px', textAlign: 'center', borderBottom: `2px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 10, background: S.raised, cursor: 'pointer' }}
                  onClick={toggleSelectAll} title={allDisplayedSelected ? 'Deselect all' : 'Select all'}>
                  {allDisplayedSelected
                    ? <CheckSquare size={14} color={S.accent} />
                    : <Square size={14} color={S.muted} />
                  }
                </th>
                <th style={{ width: 44, padding: '8px 6px', textAlign: 'center', color: S.muted, fontWeight: 600, fontSize: '0.7rem', borderBottom: `2px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 10, background: S.raised }}>#</th>
                {allCols.map(col => (
                  <th key={col.id} style={{ width: col.width, padding: '8px 7px', textAlign: col.numeric ? 'right' : 'left', color: S.muted, fontWeight: 600, fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `2px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 10, background: S.raised, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: col.numeric ? 'flex-end' : 'flex-start' }}>
                      {col.label}
                      {cols.some(c => c.id === col.id) && (
                        <span style={{ display: 'flex', gap: 2, marginLeft: 2 }}>
                          <button onClick={() => { setRenamingColId(col.id); setRenameVal(col.label) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: '0 1px', lineHeight: 1 }} title="Rename"><PenLine size={9} /></button>
                          <button onClick={() => setDeletingColId(col.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0 1px', lineHeight: 1 }} title="Delete column"><X size={9} /></button>
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th style={{ width: 50, padding: '8px 6px', textAlign: 'center', color: S.muted, fontWeight: 600, fontSize: '0.7rem', borderBottom: `2px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 10, background: S.raised }}>⋯</th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={allCols.length + 3} style={{ padding: '60px 20px', textAlign: 'center', color: S.muted }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>📦</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No items yet</div>
                    <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Click "Add Item" or press Enter on the last row.</div>
                  </td>
                </tr>
              ) : displayedItems.map((item, rowIdx) => {
                const isActiveRow = activeCell?.rowIdx === rowIdx
                const lowStock = isLowStock(item)
                const isSelected = selectedIds.has(item.id)
                const isDetailOpen = detailItem?.id === item.id

                return (
                  <tr key={item.id} style={{
                    background: isDetailOpen
                      ? `${S.accent}18`
                      : (lowStock ? 'rgba(239,68,68,0.06)' : (isSelected ? `${S.accent}0a` : (isActiveRow ? `${S.accent}0d` : (rowIdx % 2 === 0 ? 'transparent' : `${S.surface}55`)))),
                    transition: 'background 0.1s',
                    outline: isDetailOpen ? `1px solid ${S.accent}44` : undefined,
                  }}
                    onMouseEnter={() => setHoveredRowId(item.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    {/* Checkbox */}
                    <td style={{ width: 40, padding: '1px 6px', textAlign: 'center', borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}
                      onClick={() => toggleSelectItem(item.id)}>
                      {isSelected
                        ? <CheckSquare size={13} color={S.accent} />
                        : <Square size={13} color={S.muted} style={{ opacity: 0.4 }} />
                      }
                    </td>
                    {/* Row number / low stock indicator */}
                    <td style={{ width: 44, padding: '1px 6px', textAlign: 'center', color: S.muted, fontSize: '0.73rem', borderBottom: `1px solid ${S.border}` }}>
                      {lowStock
                        ? <AlertTriangle size={12} color="#ef4444" aria-label="Low stock" />
                        : rowIdx + 1
                      }
                    </td>
                    {/* Data cells */}
                    {allCols.map(col => {
                      const rawVal = getCellValue(item, col.id)
                      const dispVal = getLocal(item.id, col.id, rawVal)
                      const isActive = activeCell?.rowIdx === rowIdx && activeCell?.colId === col.id
                      const stockQtyLow = lowStock && col.id === 'stockQty'
                      const isNameCol = col.id === 'itemName'
                      const rowHov = hoveredRowId === item.id
                      return (
                        <td key={col.id} style={{ width: col.width, padding: '1px 2px', borderBottom: `1px solid ${S.border}`, borderRight: `1px solid ${S.border}22` }}>
                          {isNameCol ? (
                            // Item Name column: image cell + text input side by side
                            <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                              <ItemImageCell
                                itemId={item.id}
                                imagePath={item.imagePath}
                                rowHovered={rowHov}
                              />
                              <input
                                ref={el => registerCell(rowIdx, col.id, el)}
                                type="text"
                                value={dispVal}
                                onChange={e => setLocal(item.id, col.id, e.target.value)}
                                onFocus={() => { setActiveCell({ rowIdx, colId: col.id }); setF2Unlocked(false) }}
                                onBlur={() => flushLocal(item, col.id)}
                                onKeyDown={e => handleKeyDown(e, rowIdx, col.id)}
                                style={{
                                  flex: 1, minWidth: 0, boxSizing: 'border-box',
                                  fontFamily: S.font, fontSize: '0.82rem',
                                  padding: '5px 7px',
                                  background: isActive ? `${S.accent}18` : 'transparent',
                                  border: isActive ? `1.5px solid ${S.accent}` : '1.5px solid transparent',
                                  borderRadius: 5, outline: 'none',
                                  color: S.text,
                                  caretColor: (f2Mode && !f2Unlocked && !isActive) ? 'transparent' : undefined,
                                  pointerEvents: (f2Mode && !f2Unlocked && !isActive) ? 'none' : undefined,
                                }}
                              />
                            </div>
                          ) : (
                            <input
                              ref={el => registerCell(rowIdx, col.id, el)}
                              type="text"
                              value={dispVal}
                              onChange={e => setLocal(item.id, col.id, e.target.value)}
                              onFocus={() => { setActiveCell({ rowIdx, colId: col.id }); setF2Unlocked(false) }}
                              onBlur={() => flushLocal(item, col.id)}
                              onKeyDown={e => handleKeyDown(e, rowIdx, col.id)}
                              style={{
                                width: '100%', boxSizing: 'border-box',
                                fontFamily: S.font, fontSize: '0.82rem',
                                padding: '5px 7px',
                                background: isActive ? `${S.accent}18` : 'transparent',
                                border: isActive ? `1.5px solid ${S.accent}` : (stockQtyLow ? '1.5px solid rgba(239,68,68,0.4)' : '1.5px solid transparent'),
                                borderRadius: 5, outline: 'none',
                                color: stockQtyLow ? '#ef4444' : S.text,
                                fontWeight: stockQtyLow ? 700 : undefined,
                                textAlign: col.numeric ? 'right' : 'left',
                                caretColor: (f2Mode && !f2Unlocked && !isActive) ? 'transparent' : undefined,
                                pointerEvents: (f2Mode && !f2Unlocked && !isActive) ? 'none' : undefined,
                              }}
                            />
                          )}
                        </td>
                      )
                    })}
                    {/* Actions */}
                    <td style={{ width: 50, padding: '1px 4px', textAlign: 'center', borderBottom: `1px solid ${S.border}` }}>
                      <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        {/* History/detail button */}
                        <button
                          onClick={() => setDetailItem(isDetailOpen ? null : item)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDetailOpen ? S.accent : S.muted, padding: '4px 3px', borderRadius: 4, opacity: isDetailOpen ? 1 : 0.5, transition: 'opacity 0.15s' }}
                          title="Price & usage history"
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = isDetailOpen ? '1' : '0.5')}
                        ><BarChart3 size={12} /></button>
                        <button onClick={() => setDeleteItemId(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px 3px', borderRadius: 4, opacity: 0.5, transition: 'opacity 0.15s' }}
                          title="Delete item"
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.5')}
                        ><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Status bar */}
          <div style={{ position: 'sticky', bottom: 0, background: S.raised, borderTop: `1px solid ${S.border}`, padding: '5px 14px', display: 'flex', gap: 14, alignItems: 'center', fontSize: '0.73rem', color: S.muted }}>
            <span>{displayedItems.length} item{displayedItems.length !== 1 ? 's' : ''}</span>
            {someSelected && (
              <span style={{ color: S.accent, fontWeight: 700 }}>{selectedIds.size} selected</span>
            )}
            {stockEnabled && (() => {
              const lowCount = displayedItems.filter(isLowStock).length
              return lowCount > 0
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', fontWeight: 700 }}><AlertTriangle size={11} /> {lowCount} low stock</span>
                : <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ Stock OK</span>
            })()}
            {selectedCatId && (
              <span style={{ color: S.accent }}>
                {cats.find(c => c.id === selectedCatId)?.name ?? selectedCatId}{selectedSubCat ? ` › ${selectedSubCat}` : ''}
                <button onClick={() => { setSelectedCatId(null); setSelectedSubCat(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, marginLeft: 4 }}>✕</button>
              </span>
            )}
            {f2Mode && <span style={{ color: '#f59e0b', fontWeight: 700 }}>F2 Mode ON — press F2 to unlock cell</span>}
            <span style={{ marginLeft: 'auto', opacity: 0.5 }}>Enter/↓↑/Tab · ☑ select rows · 📊 view history · scan barcode to find</span>
          </div>
        </div>

        {/* Item detail panel (price + usage history) */}
        {detailItem && (
          <ItemDetailPanel
            item={detailItem}
            onClose={() => setDetailItem(null)}
          />
        )}
      </div>

      {/* Modals */}
      {deleteItemId && (
        <DeleteConfirm
          label={items.find(i => i.id === deleteItemId)?.itemName || 'this item'}
          onConfirm={() => { inventoryService.deleteItem(deleteItemId); setDeleteItemId(null); if (detailItem?.id === deleteItemId) setDetailItem(null) }}
          onCancel={() => setDeleteItemId(null)}
        />
      )}
      {showAddCol && <AddColumnModal onAdd={label => inventoryService.addCustomColumn(label)} onClose={() => setShowAddCol(false)} />}
      {deletingColId && <DeleteConfirm label={`"${cols.find(c => c.id === deletingColId)?.label}" column (all data lost)`} onConfirm={() => { inventoryService.deleteCustomColumn(deletingColId); setDeletingColId(null) }} onCancel={() => setDeletingColId(null)} />}
      {renamingColId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: S.raised, borderRadius: 14, border: `1px solid ${S.border}`, padding: '26px 30px', minWidth: 340, fontFamily: S.font, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: S.text, marginBottom: 14 }}>Rename Column</div>
            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { inventoryService.renameCustomColumn(renamingColId, renameVal.trim()); setRenamingColId(null) } if (e.key === 'Escape') setRenamingColId(null) }}
              style={{ width: '100%', boxSizing: 'border-box', fontFamily: S.font, fontSize: '0.9rem', padding: '8px 12px', borderRadius: 8, background: S.surface, border: `1.5px solid ${S.border}`, color: S.text, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
              <button onClick={() => setRenamingColId(null)} style={{ fontFamily: S.font, fontSize: '0.82rem', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: `1.5px solid ${S.border}`, color: S.muted }}>Cancel</button>
              <button onClick={() => { inventoryService.renameCustomColumn(renamingColId, renameVal.trim()); setRenamingColId(null) }} style={{ fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, padding: '7px 16px', borderRadius: 8, cursor: 'pointer', background: S.accent, border: 'none', color: '#fff' }}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Update Modal */}
      {showBulkModal && selectedItemObjects.length > 0 && (
        <BulkPriceUpdateModal
          selectedItems={selectedItemObjects}
          onClose={() => setShowBulkModal(false)}
          onApplied={() => { /* items reload via inventoryChanged event */ }}
        />
      )}

      {/* Excel Import / Export Modal */}
      {showExcelPanel && (
        <InventoryExcelPanel
          totalItems={items.length}
          onClose={() => setShowExcelPanel(false)}
        />
      )}
    </div>
  )
}