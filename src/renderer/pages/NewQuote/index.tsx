/**
 * cQikly — NewQuote Page
 * Phase 4b-i:  Party Details section
 * Phase 4b-ii: Bill numbering engine, bill date, bill status, silent auto-create customer
 * Phase 5a:    Core billing grid — Free/GST format, F2 mode, adjustments, grand total
 * Phase 5b:    Custom columns, Mark system, Show MKD, Undo/Redo, drag-to-reorder
 * Phase 4a-i:  Full toolbar strip — Bold+Highlight, Highlight Cell, +Col, -Col, Mark,
 *              Show MKD, toolbar visibility toggle, color persist system.
 *              Toolbar buttons wire into the grid via BillingGridImperative.
 *              All toolbar keyboard shortcuts fire even when toolbar is hidden.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  Save, FileText, Image, Printer, ChevronRight,
  Bold, PaintBucket,
  Columns, Tag, BarChart2,
  Undo2, Redo2,
  Eye, EyeOff,
  X,
  ChevronDown,
  FileSpreadsheet,
  Copy,
  LayoutTemplate,
  StickyNote,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  MoveVertical,
} from 'lucide-react'
import PartyDetailsSection, { EMPTY_PARTY_DETAILS } from './PartyDetailsSection'
import BillInfoSection, { createDefaultBillInfo } from './BillInfoSection'
import BillingGrid, { BillingGridImperative } from './BillingGrid'
import type { PartyDetails } from './PartyDetailsSection'
import type { BillInfo } from './BillInfoSection'
import type {
  BillingRow, AdjustmentRow, BillTotals, BillFormat,
  CustomColumn, CustomColData, CellFormatMap,
} from './billingGrid.types'
import { GridColumnToggles } from './billingGrid.types'
import { saveBill, peekNextBillNumber, getBills } from '../../services/bill.service'
import { findDuplicates } from '../../services/duplicate.service'
import type { DuplicateCandidate } from '../../services/duplicate.service'
import { wouldExceedCreditLimit, computeCustomerStats, getAllCustomers } from '../../services/customer.service'
import {
  saveSimplifiedPdf,
  saveProfessionalPdf, saveDetailedProfessionalPdf,
  copyBillAsImage, copyBillAsSimplifiedImage, quickPrintSilent,
} from '../../services/pdf.service'
import type { ProfessionalPdfInput, DetailedProfessionalPdfInput } from '../../services/pdf.service'
import type { CustomerRecord } from '../../services/db.service'
import type { BillTemplateColumn } from '../../services/template.service'
import { getUpiId, getPartyPdfFormat, setPartyPdfFormat } from '../../services/pdfSettings.service'
import type { PdfFormat } from '../../services/pdf.service'
import { UpiQrPrompt, PdfFormatSelector } from './PdfActionDialogs'
import {
  ExcelExportButton,
  PrintOptionsPanel,
  DuplicateBillPanel,
  BillTemplatesPanel,
  InternalRemarksPanel,
} from './ToolbarPanels'
import { useUnsavedGuard } from '../../contexts/NavigationContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useFlag } from '../../contexts/FeatureFlagContext'
import { triggerWhatsAppShare } from '../../modules/whatsappShare'
import { eventBus } from '../../utils/eventBus'

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
}

// ─── Toast hook ───────────────────────────────────────────────────────────────

function useSaveToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])
  return { toast, show }
}

// ─── Preset colors for toolbar pickers ────────────────────────────────────────

const PRESET_COLORS = [
  { hex: '#000000', label: 'Black' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#f97316', label: 'Orange' },
  { hex: '#eab308', label: 'Yellow' },
  { hex: '#22c55e', label: 'Green' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#8b5cf6', label: 'Violet' },
  { hex: '#ec4899', label: 'Pink' },
  { hex: '#ffffff', label: 'White' },
  // Translucent highlights
  { hex: 'rgba(239,68,68,0.25)',  label: 'Light Red' },
  { hex: 'rgba(234,179,8,0.25)', label: 'Light Yellow' },
  { hex: 'rgba(34,197,94,0.25)', label: 'Light Green' },
  { hex: 'rgba(59,130,246,0.25)', label: 'Light Blue' },
  { hex: 'rgba(251,191,36,0.45)', label: 'Amber' },
  { hex: 'rgba(167,243,208,0.5)', label: 'Mint' },
]

// ─── Color dropdown component ─────────────────────────────────────────────────

interface ColorDropdownProps {
  onSelect: (color: string) => void
  onClose: () => void
  title: string
}

function ColorDropdown({ onSelect, onClose, title }: ColorDropdownProps): React.ReactElement {
  const [customColor, setCustomColor] = useState('#3b82f6')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => window.addEventListener('mousedown', handler), 0)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute', top: '100%', left: 0, marginTop: '4px',
        zIndex: 9999,
        background: S.surfaceRaised,
        border: `1px solid ${S.border}`,
        borderRadius: '10px',
        padding: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        minWidth: '220px',
      }}
    >
      <div style={{
        fontSize: '0.68rem', fontWeight: 700, color: S.textMuted,
        marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {title}
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.textMuted, padding: '2px', display: 'flex' }}>
          <X size={12} />
        </button>
      </div>

      {/* Preset swatches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px', marginBottom: '10px' }}>
        {PRESET_COLORS.map(c => (
          <button
            key={c.hex}
            type="button"
            title={c.label}
            onClick={() => { onSelect(c.hex); onClose() }}
            style={{
              width: '30px', height: '30px', borderRadius: '6px',
              background: c.hex,
              border: '1.5px solid var(--cq-border)',
              cursor: 'pointer',
              transition: 'transform 0.1s, box-shadow 0.1s',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.transform = 'scale(1.15)' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.transform = 'scale(1)' }}
          />
        ))}
      </div>

      {/* Custom color row */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${S.border}` }}>
        <input
          type="color"
          value={customColor}
          onChange={e => setCustomColor(e.target.value)}
          style={{ width: '32px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: '4px' }}
        />
        <span style={{ fontSize: '0.72rem', color: S.textMuted, fontFamily: '"JetBrains Mono", monospace', flex: 1 }}>
          {customColor}
        </span>
        <button
          type="button"
          onClick={() => { onSelect(customColor); onClose() }}
          style={{
            padding: '4px 10px', borderRadius: '5px',
            background: S.accent, color: S.surface, border: 'none',
            fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

// ─── Toolbar button style ─────────────────────────────────────────────────────

function tbtnStyle(active = false, disabled = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 10px',
    fontSize: '0.73rem', fontWeight: 600,
    fontFamily: S.font,
    border: `1px solid ${active ? S.accent : S.border}`,
    borderRadius: '7px',
    background: active
      ? 'color-mix(in srgb, var(--cq-accent) 14%, transparent)'
      : 'transparent',
    color: disabled ? S.textMuted : active ? S.accent : S.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    transition: 'all 0.12s',
  }
}

// ─── Main NewQuote Page ───────────────────────────────────────────────────────

export default function NewQuotePage(): React.ReactElement {
  const { config } = useConfig()
  // Phase 13: WhatsApp Quick Share — wired to bill image copy
  const whatsappShareEnabled = useFlag('whatsappShare')
  const [partyDetails, setPartyDetails] = useState<PartyDetails>(EMPTY_PARTY_DETAILS)
  const [billInfo, setBillInfo] = useState<BillInfo>(createDefaultBillInfo())
  const [billFormat, setBillFormat] = useState<BillFormat>('free')
  // Phase 11b-i: column toggles driven by config (with local override for toolbar buttons)
  const [columnToggles, setColumnToggles] = useState<GridColumnToggles>(() => ({
    showQtyUnit: config.qtyUnitColumnVisible === true,
    showDiscount: config.discountColumnVisible === true,
  }))

  // Keep column toggles in sync with config changes (instant from Settings)
  React.useEffect(() => {
    setColumnToggles({
      showQtyUnit: config.qtyUnitColumnVisible === true,
      showDiscount: config.discountColumnVisible === true,
    })
  }, [config.qtyUnitColumnVisible, config.discountColumnVisible])
  const [isSaving, setIsSaving] = useState(false)
  const { toast, show: showToast } = useSaveToast()
  const selectedCustomerRef = useRef<CustomerRecord | null>(null)
  const gridImperativeRef = useRef<BillingGridImperative | null>(null)

  // ── Toolbar visibility (Phase 4a-i) ──────────────────────────────────────────
  const [toolbarVisible, setToolbarVisible] = useState(true)

  // ── Color picker state ────────────────────────────────────────────────────────
  const [boldPickerOpen, setBoldPickerOpen] = useState(false)
  const [cellHighlightPickerOpen, setCellHighlightPickerOpen] = useState(false)

  // ── Phase 4a-ii-A: new toolbar panel state ────────────────────────────────────
  const [excelExportOpen,    setExcelExportOpen]    = useState(false)
  const [printOptionsOpen,   setPrintOptionsOpen]   = useState(false)
  const [duplicateOpen,      setDuplicateOpen]      = useState(false)
  const [templatesOpen,      setTemplatesOpen]      = useState(false)
  const [remarksOpen,        setRemarksOpen]        = useState(false)
  const [internalRemarks,    setInternalRemarks]    = useState('')

  // Has a remark badge visible on the button
  const hasRemarks = internalRemarks.trim().length > 0

  // ── Phase 8a: credit limit warning ──────────────────────────────────────────
  const [creditLimitWarning, setCreditLimitWarning] = useState<{ limit: number; projected: number } | null>(null)
  const [creditLimitPendingSave, setCreditLimitPendingSave] = useState(false)

  // ── Phase 7b: duplicate detection warning ────────────────────────────────────
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCandidate[]>([])
  const [duplicatePendingSave, setDuplicatePendingSave] = useState(false)

  // ── Phase 6a-A: PDF & save state ─────────────────────────────────────────────
  const [isSavingPdf, setIsSavingPdf] = useState(false)
  const [isSavingProfessionalPdf, setIsSavingProfessionalPdf] = useState(false)
  const [lastSavedBillNumber, setLastSavedBillNumber] = useState<string | null>(null)
  const [isBillSaved, setIsBillSaved] = useState(false)
  const [quickPrintA4Warning, setQuickPrintA4Warning] = useState(false)

  // ── Phase 6b-B: Copy image state ─────────────────────────────────────────────
  const [isCopyingImage, setIsCopyingImage] = useState(false)
  const [isCopyingSimplifiedImage, setIsCopyingSimplifiedImage] = useState(false)
  const [isQuickPrinting, setIsQuickPrinting] = useState(false)

  // ── Phase 6b-B: Unsaved changes guard ────────────────────────────────────────
  // Track whether the bill has meaningful content that hasn't been saved yet.
  // We consider "dirty" = has any content AND has NOT just been saved.
  const [isDirty, setIsDirty] = useState(false)

  // ── Phase 6b-A-ii: PDF format selector + UPI QR prompt ───────────────────────
  // formatSelectorPending: if non-null, we're awaiting user's format choice
  const [formatSelectorPending, setFormatSelectorPending] = useState<{
    resolve: (fmt: PdfFormat | null) => void
    initialFmt: PdfFormat
    hasMemory: boolean
  } | null>(null)
  // upiQrPending: if non-null, we're awaiting user's decision on QR inclusion
  const [upiQrPending, setUpiQrPending] = useState<{
    resolve: (include: boolean) => void
    grandTotal: number
  } | null>(null)

  // ── Phase 4a-ii-B: undo/redo reactive counts, format toggle state ─────────────
  // These are updated via imperative callbacks from the grid so the toolbar
  // can show enabled/disabled state in real-time.
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  // ── Grid state refs (controlled via callbacks) ────────────────────────────────
  const gridRowsRef = useRef<BillingRow[]>([])
  const gridAdjustmentsRef = useRef<AdjustmentRow[]>([])
  const gridTotalsRef = useRef<BillTotals>({ subtotal: 0, adjustmentsTotal: 0, grandTotal: 0 })
  const gridCustomColsRef = useRef<CustomColumn[]>([])
  const gridCustomColDataRef = useRef<CustomColData>({})
  const gridCellFormatsRef = useRef<CellFormatMap>({})

  // ── Phase 6b-B: Wire the unsaved-changes guard ───────────────────────────────
  // handleSaveBill is defined below — we'll forward it via a ref so the guard
  // can call it even before the function is defined in closure order.
  const saveBillCallbackRef = useRef<() => void>(() => {})
  const { setDirty: setGuardDirty } = useUnsavedGuard({
    onSave: () => saveBillCallbackRef.current(),
  })

  // Sync isDirty → guard whenever it changes
  useEffect(() => {
    setGuardDirty(isDirty)
    // Also expose on window so WindowCloseGuard (AppShell) can read it
    // without needing context access inside the beforeunload handler
    ;(window as Window & { __cqIsDirty?: boolean }).__cqIsDirty = isDirty
  }, [isDirty, setGuardDirty])

  // Clean up the global flag on unmount
  useEffect(() => {
    return () => {
      ;(window as Window & { __cqIsDirty?: boolean }).__cqIsDirty = false
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────

  const handleGridChange = useCallback((
    rows: BillingRow[],
    adjustments: AdjustmentRow[],
    totals: BillTotals,
    customCols: CustomColumn[],
    customColData: CustomColData,
    cellFormats: CellFormatMap,
  ) => {
    gridRowsRef.current = rows
    gridAdjustmentsRef.current = adjustments
    gridTotalsRef.current = totals
    gridCustomColsRef.current = customCols
    gridCustomColDataRef.current = customColData
    gridCellFormatsRef.current = cellFormats
    // Refresh undo/redo counts for toolbar button states
    const imp = gridImperativeRef.current
    if (imp) {
      setUndoLen(imp.canUndo() ? 1 : 0)
      setRedoLen(imp.canRedo() ? 1 : 0)
    }
    // Mark bill as dirty when any grid content exists; clear when fully empty
    const hasContent = rows.some(r => r.itemName.trim() || r.qty.trim() || r.rate.trim())
      || adjustments.some(a => a.label.trim() || a.amount.trim())
    setIsDirty(hasContent)
  }, [])

  useEffect(() => {
    setPartyDetails(EMPTY_PARTY_DETAILS)
    setBillInfo(createDefaultBillInfo())
    setBillFormat('free')
    setColumnToggles({
      showQtyUnit:  config.qtyUnitColumnVisible === true,
      showDiscount: config.discountColumnVisible === true,
    })
    selectedCustomerRef.current = null
    gridRowsRef.current = []
    gridAdjustmentsRef.current = []
    gridTotalsRef.current = { subtotal: 0, adjustmentsTotal: 0, grandTotal: 0 }
    gridCustomColsRef.current = []
    gridCustomColDataRef.current = {}
    gridCellFormatsRef.current = {}
    // Bug fix: populate upcoming bill number on mount so it shows immediately
    peekNextBillNumber().then(nextNum => {
      setBillInfo(prev => ({ ...prev, billNumber: nextNum }))
    }).catch(() => {})
  }, [])

  // ── Grid-level keyboard shortcuts (fire even when toolbar is hidden) ──────────
  // Phase 12a: Ctrl+S, Ctrl+P, Ctrl+D now also come from the global eventBus
  // (emitted by useGlobalShortcuts in AppShell). We subscribe to those events
  // here so the shortcuts work identically whether triggered by eventBus or by
  // the local keydown listener below.
  //
  // Ctrl+H is now the global "Open History" shortcut (per masterplan Section 15).
  // The previous informal Ctrl+H → highlight-cell shortcut is removed to resolve
  // the conflict. Highlight Cell remains accessible via the toolbar button.
  //
  // Ctrl+Shift+C / Ctrl+Shift+X / Ctrl+Shift+P are now fully wired here.
  useEffect(() => {
    const unsubs = [
      eventBus.on('shortcutSaveBill',      () => { if (!isSaving) handleSaveBill() }),
      eventBus.on('shortcutSavePdf',       () => { setPrintOptionsOpen(prev => !prev) }),
      eventBus.on('shortcutCopyImage',     () => { handleCopyProfessionalImage() }),
      eventBus.on('shortcutCopySimplified',() => { handleCopySimplifiedImage() }),
      eventBus.on('shortcutQuickPrint',    () => { handleQuickPrint() }),
      eventBus.on('shortcutDuplicateBill', () => { setDuplicateOpen(prev => !prev) }),
    ]
    return () => unsubs.forEach(u => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const imp = gridImperativeRef.current

      // Ctrl+S — save bill
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 's') {
        e.preventDefault()
        if (!isSaving) handleSaveBill()
        return
      }

      // Ctrl+B — Toggle Bold+Highlight with last used / default color
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'b') {
        e.preventDefault()
        imp?.applyBoldHighlight('#ef4444')
        return
      }

      // Ctrl+Shift+H — Hide/show toolbar (Ctrl+H is now global → History)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        setToolbarVisible(prev => !prev)
        return
      }

      // Ctrl+E — Excel export
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
        e.preventDefault()
        setExcelExportOpen(prev => !prev)
        return
      }

      // Ctrl+P — Save PDF / print options panel
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'p') {
        e.preventDefault()
        setPrintOptionsOpen(prev => !prev)
        return
      }

      // Ctrl+Shift+C — Copy image (Professional format)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'C') {
        e.preventDefault()
        handleCopyProfessionalImage()
        return
      }

      // Ctrl+Shift+X — Copy simplified image
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'X') {
        e.preventDefault()
        handleCopySimplifiedImage()
        return
      }

      // Ctrl+Shift+P — Quick print
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'P') {
        e.preventDefault()
        handleQuickPrint()
        return
      }

      // Ctrl+D — Duplicate bill
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
        e.preventDefault()
        setDuplicateOpen(prev => !prev)
        return
      }

      // Ctrl+Shift+T — Bill templates
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        setTemplatesOpen(prev => !prev)
        return
      }

      // Ctrl+Shift+R — Internal remarks
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        setRemarksOpen(prev => !prev)
        return
      }

      // Alt+1 / Alt+2 — Format toggle (also handled in BillingGrid, this is the page-level hook)
      if (e.altKey && !e.ctrlKey && e.key === '1') {
        e.preventDefault()
        setBillFormat('free')
        return
      }
      if (e.altKey && !e.ctrlKey && e.key === '2') {
        e.preventDefault()
        setBillFormat('gst')
        return
      }

      // Ctrl+Z / Ctrl+Y — Undo/Redo (also handled in BillingGrid; update counts here)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        // BillingGrid handles the actual undo; just refresh counts after
        setTimeout(() => {
          const i = gridImperativeRef.current
          if (i) { setUndoLen(i.canUndo() ? 1 : 0); setRedoLen(i.canRedo() ? 1 : 0) }
        }, 0)
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        setTimeout(() => {
          const i = gridImperativeRef.current
          if (i) { setUndoLen(i.canUndo() ? 1 : 0); setRedoLen(i.canRedo() ? 1 : 0) }
        }, 0)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaving, partyDetails, billInfo])

  const handleCustomerSelect = useCallback((customer: CustomerRecord) => {
    selectedCustomerRef.current = customer
  }, [])

  // ── Duplicate bill (Phase 4a-ii-A) ────────────────────────────────────────────
  const handleDuplicate = useCallback((payload: {
    partyDetails: PartyDetails
    billFormat: BillFormat
    rows: BillingRow[]
    adjustments: AdjustmentRow[]
    customCols: CustomColumn[]
    customColData: CustomColData
    cellFormats: CellFormatMap
  }) => {
    // Load the duplicated data into the page (party + format + grid snapshot)
    setPartyDetails(payload.partyDetails)
    setBillFormat(payload.billFormat)
    setBillInfo(createDefaultBillInfo()) // date resets to today, new bill number on save
    setInternalRemarks('') // internal remarks are NOT duplicated (private to original bill)

    // Push the duplicated rows into the grid via imperative ref
    const imp = gridImperativeRef.current
    if (imp) {
      imp.loadSnapshot({
        rows: payload.rows,
        adjustments: payload.adjustments,
        customCols: payload.customCols,
        customColData: payload.customColData,
        cellFormats: payload.cellFormats,
      })
    }

    showToast('Bill duplicated as new draft — date reset to today', 'success')
  }, [showToast])

  // ── Load template (Phase 4a-ii-A) ─────────────────────────────────────────────
  const handleLoadTemplate = useCallback((format: BillFormat, customCols: BillTemplateColumn[]) => {
    // Template applies: format + custom column structure only; zero row data
    setBillFormat(format)

    const imp = gridImperativeRef.current
    if (imp) {
      // Get current snapshot so we only replace structure, not row content
      // (Template loading resets custom columns but keeps existing row data)
      const snap = imp.getSnapshot()
      imp.loadSnapshot({
        ...snap,
        customCols: customCols.map(c => ({ id: c.id, header: c.header })),
        // customColData is cleared for the new columns (they start empty)
        customColData: {},
        // Cell formats for standard cols are kept; custom-col formats cleared
        cellFormats: Object.fromEntries(
          Object.entries(snap.cellFormats).filter(([k]) => !k.startsWith('custom:'))
        ),
      })
    }

    showToast(`Template loaded — format and columns applied`, 'success')
  }, [showToast])

  // ── Phase 6a-A: Check if bill has any content (for validation guard) ──────────
  const billHasContent = useCallback((): boolean => {
    const rows = gridRowsRef.current
    const hasRow = rows.some(r =>
      r.itemName.trim() || r.qty.trim() || r.rate.trim()
    )
    const hasAdjustment = gridAdjustmentsRef.current.some(a =>
      a.label.trim() || a.amount.trim()
    )
    return hasRow || hasAdjustment
  }, [])

  // ── Build PDF input from current state ────────────────────────────────────────
  const buildPdfInput = useCallback((isDraft: boolean) => ({
    partyName: partyDetails.partyName.trim() || 'Customer',
    partyContact: partyDetails.phone.trim() || undefined,
    transportName: partyDetails.transportName.trim() || undefined,
    billDate: billInfo.billDate || new Date().toISOString().split('T')[0],
    billNumber: lastSavedBillNumber ?? billInfo.billNumber,
    billFormat,
    rows: gridRowsRef.current,
    adjustments: gridAdjustmentsRef.current,
    subtotal: gridTotalsRef.current.subtotal,
    grandTotal: gridTotalsRef.current.grandTotal,
    customCols: gridCustomColsRef.current,
    customColData: gridCustomColDataRef.current,
    cellFormats: gridCellFormatsRef.current,
    isDraft,
  }), [partyDetails, billInfo, billFormat, lastSavedBillNumber])

  const handleSaveBill = useCallback(async () => {
    // Hard Spec validation guard:
    // Resist saving ONLY when party name IS empty AND no cell has any content.
    const nameEmpty = !partyDetails.partyName.trim()
    const noContent = !billHasContent()

    if (nameEmpty && noContent) {
      showToast('Nothing to save — add a party name or item rows.', 'error')
      return
    }
    if (nameEmpty) {
      showToast('Party Name is required to save.', 'error')
      return
    }
    if (!billInfo.billDate) {
      showToast('Bill date is required.', 'error')
      return
    }

    setIsSaving(true)
    try {
      const totals = gridTotalsRef.current

      // ── Phase 7b: Duplicate detection check ───────────────────────────────
      // Only run if not already proceeding past a duplicate warning
      if (!duplicatePendingSave) {
        const allBills = await getBills()
        const dupes = findDuplicates(allBills, {
          partyName: partyDetails.partyName.trim(),
          billDate: billInfo.billDate,
          grandTotal: totals.grandTotal,
        })
        if (dupes.length > 0) {
          setDuplicateWarning(dupes)
          setIsSaving(false)
          return   // Show warning modal; user must confirm or cancel
        }
      }
      setDuplicatePendingSave(false)  // Reset after proceeding

      // ── Phase 8a: Credit limit check ─────────────────────────────────────
      if (!creditLimitPendingSave) {
        try {
          const allBills = await getBills()
          const statsMap = computeCustomerStats(allBills)
          const customerKey = partyDetails.partyName.trim().toLowerCase()
          const stats = statsMap.get(customerKey)
          const customerRecord = getAllCustomers().find(c => (c.partyName ?? '').toLowerCase() === customerKey)
          if (customerRecord) {
            const check = wouldExceedCreditLimit(customerRecord, stats?.outstandingBalance ?? 0, totals.grandTotal)
            if (check.exceeds) {
              setCreditLimitWarning({ limit: check.limit, projected: check.projected })
              setIsSaving(false)
              return
            }
          }
        } catch { /* non-blocking — proceed without check */ }
      }
      setCreditLimitPendingSave(false)
      const customColsSnapshot = gridCustomColsRef.current.map(col => ({
        id: col.id,
        header: col.header,
        cells: gridCustomColDataRef.current[col.id] ?? [],
      }))

      const result = await saveBill({
        partyName: partyDetails.partyName.trim(),
        partyPhone: partyDetails.phone.trim() || undefined,
        transportName: partyDetails.transportName.trim() || undefined,
        partyAddress: partyDetails.address.trim() || undefined,
        partyGstin: partyDetails.gstin.trim() || undefined,
        partyNotes: partyDetails.notes.trim() || undefined,
        billDate: billInfo.billDate,
        format: billFormat,
        rows: gridRowsRef.current,
        customColumns: customColsSnapshot as never,
        adjustments: gridAdjustmentsRef.current,
        subtotal: totals.subtotal,
        grandTotal: totals.grandTotal,
        cellFormats: gridCellFormatsRef.current,
        internalRemarks: internalRemarks.trim() || undefined,
      })

      setLastSavedBillNumber(result.billNumber)
      showToast(`✓ Bill ${result.billNumber} saved for ${partyDetails.partyName}`, 'success')

      // Reset for a fresh new bill
      setPartyDetails(EMPTY_PARTY_DETAILS)
      const freshBillInfo = createDefaultBillInfo()
      setBillInfo(freshBillInfo)
      setBillFormat('free')
      setColumnToggles({
      showQtyUnit:  config.qtyUnitColumnVisible === true,
      showDiscount: config.discountColumnVisible === true,
    })
      setInternalRemarks('')
      setLastSavedBillNumber(null)
      setIsBillSaved(false)
      setIsDirty(false)           // ← Phase 6b-B: clear dirty after save
      setQuickPrintA4Warning(false) // ← Bug fix: reset A4 warning so next bill starts fresh
      selectedCustomerRef.current = null

      // Bug fix: re-peek the next bill number so it shows in BillInfoSection immediately
      peekNextBillNumber().then(nextNum => {
        setBillInfo(prev => ({ ...prev, billNumber: nextNum }))
      }).catch(() => {})
    } catch (err) {
      console.error('[NewQuote] Save failed:', err)
      showToast('Failed to save bill. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [partyDetails, billInfo, billFormat, showToast, billHasContent, duplicatePendingSave, internalRemarks, config])

  // ── Phase 7b: confirm save despite duplicate warning ─────────────────────────
  const handleConfirmDespiteDuplicate = useCallback(() => {
    setDuplicateWarning([])
    setDuplicatePendingSave(true)
  }, [])

  // ── When creditLimitPendingSave flips true, re-trigger save ────────────────
  useEffect(() => {
    if (creditLimitPendingSave) {
      handleSaveBill()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditLimitPendingSave])

  // ── When duplicatePendingSave flips true, re-trigger save ─────────────────────
  useEffect(() => {
    if (duplicatePendingSave) {
      handleSaveBill()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicatePendingSave])

  // ── Phase 6b-B: Keep the guard's save callback ref current ──────────────────
  useEffect(() => {
    saveBillCallbackRef.current = handleSaveBill
  }, [handleSaveBill])

  // Mark dirty when party details are edited — but only if there is also
  // grid content, so that typing a party name alone (no rows) doesn't
  // trigger the guard and then fail validation when the user tries to leave.
  useEffect(() => {
    if (partyDetails.partyName.trim() && billHasContent()) setIsDirty(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyDetails.partyName])

  // ── Phase 6b-A-ii: Helper: prompt user for PDF format ────────────────────────
  const promptPdfFormat = useCallback((partyName: string): Promise<PdfFormat | null> => {
    const memorized = getPartyPdfFormat(partyName)
    const initialFmt: PdfFormat = memorized ?? 'professional'
    const hasMemory = memorized !== null

    return new Promise(resolve => {
      setFormatSelectorPending({ resolve, initialFmt, hasMemory })
    })
  }, [])

  // ── Phase 6b-A-ii: Helper: prompt user for UPI QR inclusion ──────────────────
  const promptUpiQr = useCallback((grandTotal: number): Promise<boolean> => {
    const upiId = getUpiId()
    if (!upiId.trim()) return Promise.resolve(false)  // No UPI ID configured — skip dialog

    return new Promise(resolve => {
      setUpiQrPending({ resolve, grandTotal })
    })
  }, [])

  // ── Phase 6b-A-ii: Read company profile from IPC (shared helper) ─────────────
  const getCompanyProfile = useCallback(async () => {
    try {
      const ipc = (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
      if (!ipc) return { firmName: 'My Company' }
      const result = await ipc.db.query(
        'SELECT firm_name, address, phone, logo_path, gstin, email, website FROM company_profile LIMIT 1'
      ) as Array<{
        firm_name: string; address: string | null; phone: string | null
        logo_path: string | null; gstin: string | null; email: string | null; website: string | null
      }>
      if (result && result.length > 0) {
        const row = result[0]
        return {
          firmName: row.firm_name || 'My Company',
          address:  row.address   || undefined,
          phones:   row.phone     ? [row.phone] : undefined,
          logoPath: row.logo_path || undefined,
          gstin:    row.gstin     || undefined,
          email:    row.email     || undefined,
          website:  row.website   || undefined,
        }
      }
    } catch { /* non-fatal */ }
    return { firmName: 'My Company' }
  }, [])

  // ── Phase 6a-A: Save PDF ──────────────────────────────────────────────────────
  const handleSavePdf = useCallback(async () => {
    if (isSavingPdf) return
    setIsSavingPdf(true)
    try {
      const isDraft = !isBillSaved
      const input = buildPdfInput(isDraft)

      // Prompt for QR
      const includeQr = await promptUpiQr(input.grandTotal)
      if (upiQrPending) setUpiQrPending(null) // resolved

      const result = await saveSimplifiedPdf({ ...input, includeUpiQr: includeQr })

      // Remember format for this party
      setPartyPdfFormat(partyDetails.partyName, 'simplified')

      if (result.cancelled) {
        showToast('PDF save cancelled.', 'error')
      } else if (result.savedPath) {
        showToast(`✓ PDF saved${isDraft ? ' (DRAFT)' : ''}`, 'success')
      } else {
        showToast('PDF opened in preview window.', 'success')
      }
    } catch (err) {
      console.error('[NewQuote] Save PDF failed:', err)
      showToast('Failed to generate PDF. Please try again.', 'error')
    } finally {
      setIsSavingPdf(false)
      setUpiQrPending(null)
    }
  }, [isSavingPdf, isBillSaved, buildPdfInput, showToast, promptUpiQr, partyDetails.partyName])

  // ── Phase 6b-A-i+ii: Save Professional / Detailed Professional PDF ────────────
  const handleSaveProfessionalPdf = useCallback(async () => {
    if (isSavingProfessionalPdf) return
    setIsSavingProfessionalPdf(true)
    try {
      const isDraft = !isBillSaved
      const baseInput = buildPdfInput(isDraft)

      // 1. Prompt user to choose format (with memory auto-select)
      const chosenFormat = await promptPdfFormat(partyDetails.partyName)
      setFormatSelectorPending(null)
      if (!chosenFormat) {
        // User cancelled format selection
        showToast('PDF generation cancelled.', 'error')
        return
      }

      // 2. Prompt for UPI QR (only if UPI ID is configured)
      const includeQr = await promptUpiQr(baseInput.grandTotal)
      setUpiQrPending(null)

      // 3. Get company profile
      const company = await getCompanyProfile()

      // 4. Generate based on chosen format
      if (chosenFormat === 'simplified') {
        const result = await saveSimplifiedPdf({ ...baseInput, includeUpiQr: includeQr })
        setPartyPdfFormat(partyDetails.partyName, 'simplified')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast(`✓ Simplified PDF saved${isDraft ? ' (DRAFT)' : ''}`, 'success')

      } else if (chosenFormat === 'professional') {
        const proInput: ProfessionalPdfInput = {
          ...baseInput,
          company,
          poNumber: baseInput.billNumber,
          includeUpiQr: includeQr,
        }
        const result = await saveProfessionalPdf(proInput)
        setPartyPdfFormat(partyDetails.partyName, 'professional')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast(`✓ Professional PDF saved${isDraft ? ' (DRAFT)' : ''}`, 'success')

      } else if (chosenFormat === 'detailed-professional') {
        const detInput: DetailedProfessionalPdfInput = {
          ...baseInput,
          company,
          poNumber: baseInput.billNumber,
          includeUpiQr: includeQr,
          customerDetails: {
            partyName: partyDetails.partyName || 'Customer',
            contact:   partyDetails.phone     || undefined,
            address:   partyDetails.address   || undefined,
            gstin:     partyDetails.gstin     || undefined,
          },
        }
        const result = await saveDetailedProfessionalPdf(detInput)
        setPartyPdfFormat(partyDetails.partyName, 'detailed-professional')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast(`✓ Detailed Professional PDF saved${isDraft ? ' (DRAFT)' : ''}`, 'success')
      }

      if (!chosenFormat) {
        showToast('PDF opened in preview window.', 'success')
      }
    } catch (err) {
      console.error('[NewQuote] Save Professional PDF failed:', err)
      showToast('Failed to generate PDF. Please try again.', 'error')
    } finally {
      setIsSavingProfessionalPdf(false)
      setFormatSelectorPending(null)
      setUpiQrPending(null)
    }
  }, [
    isSavingProfessionalPdf, isBillSaved, buildPdfInput, showToast,
    promptPdfFormat, promptUpiQr, getCompanyProfile, partyDetails,
  ])

  // ── Phase 6b-B: Copy Image (Professional format) ──────────────────────────
  const handleCopyProfessionalImage = useCallback(async () => {
    if (isCopyingImage) return
    setIsCopyingImage(true)
    try {
      const isDraft = !isBillSaved
      const baseInput = buildPdfInput(isDraft)
      const company = await getCompanyProfile()

      const proInput: ProfessionalPdfInput = {
        ...baseInput,
        company,
        poNumber: baseInput.billNumber,
        includeUpiQr: false,   // No QR prompt for copy-image (keep it one-click)
      }

      const result = await copyBillAsImage(proInput)
      if (result === 'copied') {
        showToast('✓ Bill copied to clipboard as image (Professional format)', 'success')
        // Phase 13: WhatsApp Quick Share — trigger if enabled
        if (whatsappShareEnabled && config.whatsappMethod) {
          const opened = triggerWhatsAppShare(config.whatsappMethod)
          if (opened) {
            showToast('📱 WhatsApp opened — paste the bill image in your chat', 'success')
          }
        }
      } else if (result === 'dev-fallback') {
        showToast('Bill HTML opened — image copy requires Electron build', 'success')
      } else {
        showToast('Failed to copy image to clipboard', 'error')
      }
    } catch (err) {
      console.error('[NewQuote] Copy image failed:', err)
      showToast('Failed to copy image to clipboard', 'error')
    } finally {
      setIsCopyingImage(false)
    }
  }, [isCopyingImage, isBillSaved, buildPdfInput, getCompanyProfile, showToast])

  // ── Phase 6b-B: Copy Simplified Image ─────────────────────────────────────
  const handleCopySimplifiedImage = useCallback(async () => {
    if (isCopyingSimplifiedImage) return
    setIsCopyingSimplifiedImage(true)
    try {
      const input = buildPdfInput(!isBillSaved)
      const result = await copyBillAsSimplifiedImage(input)
      if (result === 'copied') {
        showToast('✓ Bill copied to clipboard as image (Simplified format)', 'success')
        // Phase 13: WhatsApp Quick Share — trigger if enabled
        if (whatsappShareEnabled && config.whatsappMethod) {
          const opened = triggerWhatsAppShare(config.whatsappMethod)
          if (opened) {
            showToast('📱 WhatsApp opened — paste the bill image in your chat', 'success')
          }
        }
      } else if (result === 'dev-fallback') {
        showToast('Bill HTML opened — image copy requires Electron build', 'success')
      } else {
        showToast('Failed to copy image to clipboard', 'error')
      }
    } catch (err) {
      console.error('[NewQuote] Copy simplified image failed:', err)
      showToast('Failed to copy image to clipboard', 'error')
    } finally {
      setIsCopyingSimplifiedImage(false)
    }
  }, [isCopyingSimplifiedImage, isBillSaved, buildPdfInput, showToast])

  // ── Phase 6b-B: Quick Print — Simplified A5, silent, no dialog ───────────────
  const handleQuickPrint = useCallback(async () => {
    if (isQuickPrinting) return
    setIsQuickPrinting(true)
    try {
      const input = buildPdfInput(!isBillSaved)
      const result = await quickPrintSilent(input, { alreadyWarnedA4: quickPrintA4Warning })

      if (result.a4Warning) {
        // First attempt — warn the user, wait for second click to confirm
        setQuickPrintA4Warning(true)
        showToast(
          '⚠ This bill has > 40 rows — it will print on A4, not A5. Click Quick Print again to confirm.',
          'error'
        )
        return
      }

      if (result.printed) {
        setQuickPrintA4Warning(false)
        showToast('✓ Sent to printer (Simplified format)', 'success')
      } else {
        showToast('Print failed — please try again', 'error')
      }
    } catch (err) {
      console.error('[NewQuote] Quick print failed:', err)
      showToast('Print failed', 'error')
    } finally {
      setIsQuickPrinting(false)
    }
  }, [isQuickPrinting, isBillSaved, buildPdfInput, quickPrintA4Warning, showToast])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: S.font, color: S.text, background: S.surface, overflow: 'hidden',
    }}>
      {/* ── Phase 8a: Credit limit warning modal ───────────────────────────── */}
      {creditLimitWarning && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div style={{ background: '#1e1e2a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <h3 style={{ color: '#f87171', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Credit Limit Exceeded</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              Saving this bill for <strong style={{ color: '#fff' }}>{partyDetails.partyName}</strong> would push their outstanding balance to{' '}
              <strong style={{ color: '#f87171' }}>₹{creditLimitWarning.projected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>,
              which exceeds their credit limit of{' '}
              <strong style={{ color: '#fbbf24' }}>₹{creditLimitWarning.limit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCreditLimitWarning(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={() => { setCreditLimitWarning(null); setCreditLimitPendingSave(true) }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#f87171', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Phase 7b: Duplicate bill warning modal ──────────────────────────── */}
      {duplicateWarning.length > 0 && (
        <DuplicateBillWarning
          candidates={duplicateWarning}
          onProceed={handleConfirmDespiteDuplicate}
          onCancel={() => setDuplicateWarning([])}
        />
      )}
      {/* ── Phase 6b-A-ii: PDF Format Selector dialog ─────────────────────────── */}
      {formatSelectorPending && (
        <PdfFormatSelector
          initialFormat={formatSelectorPending.initialFmt}
          partyName={partyDetails.partyName}
          hasMemory={formatSelectorPending.hasMemory}
          onResult={fmt => {
            formatSelectorPending.resolve(fmt)
            setFormatSelectorPending(null)
          }}
        />
      )}

      {/* ── Phase 6b-A-ii: UPI QR prompt dialog ──────────────────────────────── */}
      {upiQrPending && (
        <UpiQrPrompt
          grandTotal={upiQrPending.grandTotal}
          onResult={include => {
            upiQrPending.resolve(include)
            setUpiQrPending(null)
          }}
        />
      )}

      {/* Save toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '24px', zIndex: 9999,
          padding: '10px 18px', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600,
          background: toast.type === 'success'
            ? 'color-mix(in srgb, var(--cq-accent) 20%, var(--cq-surface-raised))'
            : 'color-mix(in srgb, #ef4444 20%, var(--cq-surface-raised))',
          border: `1.5px solid ${toast.type === 'success' ? 'var(--cq-accent)' : '#ef4444'}`,
          color: toast.type === 'success' ? S.accent : '#ef4444',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'slideInRight 0.2s ease',
          maxWidth: '340px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Breadcrumb bar (always visible) ───────────────────────────────────── */}
      <div style={{
        padding: '8px 20px',
        borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '8px',
        background: S.surface, flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          New Quote
        </div>
        <ChevronRight size={12} style={{ color: S.textMuted, opacity: 0.5 }} />
        <div style={{ fontSize: '0.8rem', color: S.textMuted, opacity: 0.7 }}>
          {partyDetails.partyName || 'New Bill'}
        </div>
        <div style={{ flex: 1 }} />

        {/* Toolbar visibility toggle */}
        <button
          type="button"
          onClick={() => setToolbarVisible(prev => !prev)}
          title={`${toolbarVisible ? 'Hide' : 'Show'} toolbar (Ctrl+Shift+H)`}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px',
            fontSize: '0.7rem', fontWeight: 600,
            background: 'transparent',
            border: `1px solid ${S.border}`,
            borderRadius: '6px',
            color: S.textMuted, cursor: 'pointer',
          }}
        >
          {toolbarVisible ? <EyeOff size={13} /> : <Eye size={13} />}
          {toolbarVisible ? 'Hide Toolbar' : 'Show Toolbar'}
        </button>
      </div>

      {/* ── Main toolbar strip (toggleable) ────────────────────────────────────── */}
      {toolbarVisible && (
        <div style={{
          padding: '8px 20px',
          borderBottom: `1px solid ${S.border}`,
          background: `color-mix(in srgb, var(--cq-surface-raised) 60%, var(--cq-surface))`,
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        }}>

          {/* ── Group 1: Text / Cell formatting ────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {/* Bold + Highlight button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setBoldPickerOpen(prev => !prev)
                  setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(boldPickerOpen)}
                title="Bold + Text Color (Ctrl+B for quick apply)"
              >
                <Bold size={14} />
                <span>Bold+Color</span>
                <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: '1px' }} />
              </button>
              {boldPickerOpen && (
                <ColorDropdown
                  title="Text Bold + Color"
                  onSelect={color => gridImperativeRef.current?.applyBoldHighlight(color)}
                  onClose={() => setBoldPickerOpen(false)}
                />
              )}
            </div>

            {/* Highlight Cell button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setCellHighlightPickerOpen(prev => !prev)
                  setBoldPickerOpen(false)
                }}
                style={tbtnStyle(cellHighlightPickerOpen)}
                title="Highlight Cell background (toolbar button — Ctrl+H is now global History nav)"
              >
                <PaintBucket size={14} />
                <span>Highlight Cell</span>
                <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: '1px' }} />
              </button>
              {cellHighlightPickerOpen && (
                <ColorDropdown
                  title="Cell Highlight Color"
                  onSelect={color => gridImperativeRef.current?.highlightCell(color)}
                  onClose={() => setCellHighlightPickerOpen(false)}
                />
              )}
            </div>
          </div>

          <ToolbarDivider />

          {/* ── Group 2: Custom columns ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              onClick={() => gridImperativeRef.current?.addCustomColumn()}
              style={tbtnStyle()}
              title="Add custom column"
            >
              <Columns size={14} />
              +Col
            </button>
            <button
              type="button"
              onClick={() => gridImperativeRef.current?.removeLastCustomColumn()}
              style={tbtnStyle()}
              title="Remove last custom column"
            >
              <Columns size={14} />
              −Col
            </button>
          </div>

          <ToolbarDivider />

          {/* ── Group 3: Mark & MKD ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              onClick={() => gridImperativeRef.current?.markActiveCustomCell()}
              style={tbtnStyle()}
              title="Mark active cell as sub-group header"
            >
              <Tag size={14} />
              Mark
            </button>
            <button
              type="button"
              onClick={() => gridImperativeRef.current?.showMkd()}
              style={tbtnStyle()}
              title="Show MKD qty totals dialog"
            >
              <BarChart2 size={14} />
              Show MKD
            </button>
          </div>

          <ToolbarDivider />

          {/* ── Group 4: Format Toggle (Phase 4a-ii-B) ──────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <button
              type="button"
              onClick={() => setBillFormat('free')}
              style={{
                ...tbtnStyle(billFormat === 'free'),
                borderRadius: '7px 0 0 7px',
              }}
              title="Free Format — basic billing (Alt+1)"
            >
              {billFormat === 'free' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
              <span>Free</span>
              <span style={{ opacity: 0.55, fontSize: '0.62rem', marginLeft: '2px' }}>Alt+1</span>
            </button>
            <button
              type="button"
              onClick={() => setBillFormat('gst')}
              style={{
                ...tbtnStyle(billFormat === 'gst'),
                borderRadius: '0 7px 7px 0',
                marginLeft: '-1px',
              }}
              title="GST Format — with tax columns (Alt+2)"
            >
              {billFormat === 'gst' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
              <span>GST</span>
              <span style={{ opacity: 0.55, fontSize: '0.62rem', marginLeft: '2px' }}>Alt+2</span>
            </button>
          </div>

          <ToolbarDivider />

          {/* ── Group 5: Row Reorder (Phase 4a-ii-B) ────────────────────────── */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '5px 10px',
              fontSize: '0.73rem', fontWeight: 600,
              border: `1px dashed var(--cq-border)`,
              borderRadius: '7px',
              color: 'var(--cq-text-muted)',
              opacity: 0.65,
              userSelect: 'none',
              cursor: 'default',
            }}
            title="Grab the ⠿ grip handle on the left of any row and drag to reorder"
          >
            <GripVertical size={13} />
            <MoveVertical size={12} />
            <span>Row Reorder</span>
          </div>

          <ToolbarDivider />

          {/* ── Group 6: Undo / Redo ─────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button
              type="button"
              onClick={() => {
                gridImperativeRef.current?.undo()
                setTimeout(() => {
                  const imp = gridImperativeRef.current
                  if (imp) { setUndoLen(imp.canUndo() ? 1 : 0); setRedoLen(imp.canRedo() ? 1 : 0) }
                }, 0)
              }}
              disabled={undoLen === 0}
              style={tbtnStyle(false, undoLen === 0)}
              title="Undo last grid change (Ctrl+Z)"
            >
              <Undo2 size={14} />
              Undo
            </button>
            <button
              type="button"
              onClick={() => {
                gridImperativeRef.current?.redo()
                setTimeout(() => {
                  const imp = gridImperativeRef.current
                  if (imp) { setUndoLen(imp.canUndo() ? 1 : 0); setRedoLen(imp.canRedo() ? 1 : 0) }
                }, 0)
              }}
              disabled={redoLen === 0}
              style={tbtnStyle(false, redoLen === 0)}
              title="Redo last undone change (Ctrl+Y)"
            >
              <Redo2 size={14} />
              Redo
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* ── Group 5: Excel Export ──────────────────────────────────────── */}
          <ToolbarDivider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setExcelExportOpen(prev => !prev)
                  setPrintOptionsOpen(false); setDuplicateOpen(false)
                  setTemplatesOpen(false); setRemarksOpen(false)
                  setBoldPickerOpen(false); setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(excelExportOpen)}
                title="Copy bill as TSV — paste into Excel / Sheets (Ctrl+E)"
              >
                <FileSpreadsheet size={14} />
                <span>Excel Export</span>
              </button>
              {excelExportOpen && (
                <ExcelExportButton
                  partyDetails={partyDetails}
                  billInfo={billInfo}
                  billFormat={billFormat}
                  rows={gridRowsRef.current}
                  adjustments={gridAdjustmentsRef.current}
                  totals={gridTotalsRef.current}
                  customCols={gridCustomColsRef.current}
                  customColData={gridCustomColDataRef.current}
                  onClose={() => setExcelExportOpen(false)}
                />
              )}
            </div>

            {/* ── Print Options ─────────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setPrintOptionsOpen(prev => !prev)
                  setExcelExportOpen(false); setDuplicateOpen(false)
                  setTemplatesOpen(false); setRemarksOpen(false)
                  setBoldPickerOpen(false); setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(printOptionsOpen)}
                title="Print with format options (Ctrl+P)"
              >
                <Printer size={14} />
                <span>Print</span>
              </button>
              {printOptionsOpen && (
                <PrintOptionsPanel
                  partyDetails={partyDetails}
                  billInfo={billInfo}
                  billFormat={billFormat}
                  rows={gridRowsRef.current}
                  adjustments={gridAdjustmentsRef.current}
                  totals={gridTotalsRef.current}
                  onClose={() => setPrintOptionsOpen(false)}
                />
              )}
            </div>

            {/* ── Duplicate Bill ────────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setDuplicateOpen(prev => !prev)
                  setExcelExportOpen(false); setPrintOptionsOpen(false)
                  setTemplatesOpen(false); setRemarksOpen(false)
                  setBoldPickerOpen(false); setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(duplicateOpen)}
                title="Duplicate bill as new draft (Ctrl+D)"
              >
                <Copy size={14} />
                <span>Duplicate</span>
              </button>
              {duplicateOpen && (
                <DuplicateBillPanel
                  partyDetails={partyDetails}
                  billInfo={billInfo}
                  billFormat={billFormat}
                  rows={gridRowsRef.current}
                  adjustments={gridAdjustmentsRef.current}
                  customCols={gridCustomColsRef.current}
                  customColData={gridCustomColDataRef.current}
                  cellFormats={gridCellFormatsRef.current}
                  onDuplicate={handleDuplicate}
                  onClose={() => setDuplicateOpen(false)}
                />
              )}
            </div>

            {/* ── Bill Templates ────────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setTemplatesOpen(prev => !prev)
                  setExcelExportOpen(false); setPrintOptionsOpen(false)
                  setDuplicateOpen(false); setRemarksOpen(false)
                  setBoldPickerOpen(false); setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(templatesOpen)}
                title="Bill templates — save structure, load in one click (Ctrl+Shift+T)"
              >
                <LayoutTemplate size={14} />
                <span>Templates</span>
              </button>
              {templatesOpen && (
                <BillTemplatesPanel
                  currentFormat={billFormat}
                  currentCustomCols={gridCustomColsRef.current}
                  onLoadTemplate={handleLoadTemplate}
                  onClose={() => setTemplatesOpen(false)}
                />
              )}
            </div>

            {/* ── Internal Remarks ──────────────────────────────────────────── */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => {
                  setRemarksOpen(prev => !prev)
                  setExcelExportOpen(false); setPrintOptionsOpen(false)
                  setDuplicateOpen(false); setTemplatesOpen(false)
                  setBoldPickerOpen(false); setCellHighlightPickerOpen(false)
                }}
                style={tbtnStyle(remarksOpen || hasRemarks)}
                title="Internal remarks — private note, never printed (Ctrl+Shift+R)"
              >
                <StickyNote size={14} />
                <span>Remarks</span>
                {hasRemarks && (
                  <span style={{
                    width: '7px', height: '7px',
                    borderRadius: '50%',
                    background: '#eab308',
                    flexShrink: 0,
                  }} />
                )}
              </button>
              {remarksOpen && (
                <InternalRemarksPanel
                  value={internalRemarks}
                  onChange={setInternalRemarks}
                  onClose={() => setRemarksOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Shortcut hints */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.55, fontSize: '0.68rem', color: S.textMuted }}>
            <Kbd>Ctrl+B</Kbd> Bold
            <Kbd>Ctrl+Shift+H</Kbd> Toolbar
            <Kbd>Alt+1/2</Kbd> Format
            <Kbd>Ctrl+Z/Y</Kbd> Undo/Redo
            <Kbd>Ctrl+E</Kbd> Export
          </div>
        </div>
      )}

      {/* ── Main scrollable area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Party Details */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Party Details
          </div>
          <PartyDetailsSection value={partyDetails} onChange={setPartyDetails} onCustomerSelect={handleCustomerSelect} />
        </section>

        {/* Bill Info */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Bill Info
          </div>
          <BillInfoSection value={billInfo} onChange={setBillInfo} statusEditable={false} />
        </section>

        {/* Billing Grid */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Bill Items
          </div>
          <BillingGrid
            format={billFormat}
            onFormatChange={setBillFormat}
            onChange={handleGridChange}
            f2ModeEnabled={config.f2EditMode === true}
            columnToggles={columnToggles}
            onColumnTogglesChange={setColumnToggles}
            imperativeRef={gridImperativeRef}
            partyName={partyDetails.partyName}
            inventoryModeEnabled={config.inventoryModeEnabled === true}
            rateHistoryHintEnabled={config.rateHistoryHintEnabled !== false}
            billFormatForInv={billFormat}
          />
        </section>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 24px', borderTop: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '10px',
        background: S.surface, flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={handleSaveBill}
          disabled={isSaving}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 20px',
            background: 'var(--cq-accent)', color: 'var(--cq-surface)',
            border: 'none', borderRadius: '8px',
            fontSize: '0.875rem', fontWeight: 700, fontFamily: S.font,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1, transition: 'opacity 0.15s',
          }}
        >
          <Save size={15} />
          {isSaving ? 'Saving…' : 'Save Bill'}
        </button>

        <button
          type="button"
          onClick={handleSavePdf}
          disabled={isSavingPdf}
          title="Generate and save Simplified PDF (DRAFT stamp if unsaved)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: S.text, cursor: isSavingPdf ? 'not-allowed' : 'pointer',
            opacity: isSavingPdf ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <FileText size={14} />
          {isSavingPdf ? 'Generating…' : 'Save PDF'}
          {!isBillSaved && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#c00', letterSpacing: '0.05em' }}>
              DRAFT
            </span>
          )}
        </button>

        {/* Phase 6b-A-i/ii: PDF format selector button — chooses between all 3 formats */}
        <button
          type="button"
          onClick={handleSaveProfessionalPdf}
          disabled={isSavingProfessionalPdf}
          title="Choose PDF format: Simplified / Professional / Detailed Professional"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: isSavingProfessionalPdf
              ? S.surfaceRaised
              : 'color-mix(in srgb, var(--cq-accent) 12%, var(--cq-surface-raised))',
            border: `1px solid color-mix(in srgb, var(--cq-accent) 35%, ${S.border})`,
            borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: S.text, cursor: isSavingProfessionalPdf ? 'not-allowed' : 'pointer',
            opacity: isSavingProfessionalPdf ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <FileText size={14} />
          {isSavingProfessionalPdf ? 'Generating…' : '🏢 Save PDF…'}
          {!isBillSaved && (
            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#c00', letterSpacing: '0.05em' }}>
              DRAFT
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleCopyProfessionalImage}
          disabled={isCopyingImage}
          title="Copy bill as image to clipboard (Professional format) — one click, no dialogs"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: isCopyingImage
              ? S.surfaceRaised
              : 'color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))',
            border: `1px solid ${isCopyingImage ? S.border : 'color-mix(in srgb, var(--cq-accent) 28%, var(--cq-border))'}`,
            borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: isCopyingImage ? S.textMuted : S.text,
            cursor: isCopyingImage ? 'not-allowed' : 'pointer',
            opacity: isCopyingImage ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          <Image size={14} />
          {isCopyingImage ? 'Copying…' : 'Copy Image'}
        </button>

        <button
          type="button"
          onClick={handleCopySimplifiedImage}
          disabled={isCopyingSimplifiedImage}
          title="Copy bill as image to clipboard (Simplified format — no company info)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: isCopyingSimplifiedImage ? S.textMuted : S.text,
            cursor: isCopyingSimplifiedImage ? 'not-allowed' : 'pointer',
            opacity: isCopyingSimplifiedImage ? 0.6 : 1, transition: 'opacity 0.15s',
          }}
        >
          <Image size={14} />
          {isCopyingSimplifiedImage ? 'Copying…' : 'Copy Simple'}
        </button>

        <button
          type="button"
          onClick={handleQuickPrint}
          disabled={isQuickPrinting}
          title="Quick print — Simplified A5, silent, no print dialogue; warns if A4 needed"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: quickPrintA4Warning
              ? 'color-mix(in srgb, #f59e0b 15%, var(--cq-surface-raised))'
              : S.surfaceRaised,
            border: `1px solid ${quickPrintA4Warning ? '#f59e0b' : S.border}`,
            borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: quickPrintA4Warning ? '#d97706' : S.text,
            cursor: isQuickPrinting ? 'not-allowed' : 'pointer',
            opacity: isQuickPrinting ? 0.6 : 1, transition: 'all 0.15s',
          }}
        >
          <Printer size={14} />
          {isQuickPrinting ? 'Printing…' : quickPrintA4Warning ? 'Confirm Print (A4)' : 'Quick Print'}
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: '0.7rem', color: S.textMuted, opacity: 0.6, display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span><Kbd>Ctrl+S</Kbd> Save</span>
          <span><Kbd>Ctrl+P</Kbd> PDF</span>
          <span><Kbd>Ctrl+Shift+C</Kbd> Copy Image</span>
          <span><Kbd>Ctrl+Shift+X</Kbd> Copy Simple</span>
          <span><Kbd>Ctrl+Shift+P</Kbd> Quick Print</span>
          <span><Kbd>Ctrl+D</Kbd> Duplicate</span>
          <span><Kbd>Alt+1/2</Kbd> Format</span>
          <span><Kbd>Ctrl+Z/Y</Kbd> Undo/Redo</span>
          <span><Kbd>Insert</Kbd> Accept hint</span>
          <span><Kbd>Ctrl+/</Kbd> Shortcuts</span>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ToolbarDivider(): React.ReactElement {
  return (
    <div style={{ width: 1, height: 22, background: 'var(--cq-border)', margin: '0 3px', flexShrink: 0 }} />
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd style={{
      padding: '2px 5px',
      background: 'var(--cq-surface-raised)',
      border: '1px solid var(--cq-border)',
      borderRadius: '3px',
      fontSize: '0.68rem',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {children}
    </kbd>
  )
}

// ─── DuplicateBillWarning modal (Phase 7b) ────────────────────────────────────

function DuplicateBillWarning({
  candidates,
  onProceed,
  onCancel,
}: {
  candidates: import('../../services/duplicate.service').DuplicateCandidate[]
  onProceed: () => void
  onCancel: () => void
}): React.ReactElement {
  const font = '"Inter", system-ui, sans-serif'

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      }} onClick={onCancel} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 9999,
        width: '460px', maxWidth: '90vw',
        background: 'var(--cq-surface-raised)',
        border: '1.5px solid color-mix(in srgb, #f59e0b 40%, var(--cq-border))',
        borderRadius: '12px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        padding: '28px',
        fontFamily: font,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            fontSize: '1.6rem', lineHeight: 1,
            flexShrink: 0, marginTop: '2px',
          }}>⚠️</div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cq-text-primary)', marginBottom: '4px' }}>
              Possible Duplicate Bill
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', lineHeight: 1.5 }}>
              {candidates.length === 1
                ? 'A similar bill already exists for this party and date.'
                : `${candidates.length} similar bills already exist for this party and date.`}
            </div>
          </div>
        </div>

        {/* Matching bills */}
        <div style={{
          background: 'color-mix(in srgb, #f59e0b 8%, var(--cq-surface))',
          border: '1px solid color-mix(in srgb, #f59e0b 25%, var(--cq-border))',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '20px',
        }}>
          {candidates.map((c, i) => (
            <div key={c.bill.id ?? i} style={{
              padding: '10px 14px',
              borderBottom: i < candidates.length - 1
                ? '1px solid color-mix(in srgb, #f59e0b 15%, var(--cq-border))'
                : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '0.75rem', fontWeight: 700,
                  color: 'var(--cq-accent)',
                }}>
                  {c.bill.billNumber}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)' }}>
                  · {c.bill.partyName}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cq-text-primary)' }}>
                  ₹{Math.round(c.bill.grandTotal ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '3px' }}>
                {c.reason}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '9px 20px', fontFamily: font, fontSize: '0.83rem', fontWeight: 600,
              color: 'var(--cq-text-primary)',
              background: 'var(--cq-surface)',
              border: '1px solid var(--cq-border)',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            Cancel — Don't Save
          </button>
          <button
            type="button"
            onClick={onProceed}
            style={{
              padding: '9px 20px', fontFamily: font, fontSize: '0.83rem', fontWeight: 700,
              color: '#fff',
              background: '#d97706',
              border: '1px solid #b45309',
              borderRadius: '8px', cursor: 'pointer',
            }}
          >
            Save Anyway
          </button>
        </div>
      </div>
    </>
  )
}
