/**
 * cQikly — EditBillView
 * Phase 7a-B: Open any bill from History in a fully editable view.
 *
 * Design contract (MASTERPLAN Phase 7a-B):
 *   - Identical in behaviour to the New Quote page:
 *       same grid navigation, same F2 mode, same keyboard shortcuts,
 *       same toolbar, same format toggle (Alt+1/Alt+2)
 *   - Every field is editable: party name, phone, transport, bill date,
 *       address/GSTIN/notes, PO number (read-only on edit), all grid cells,
 *       custom column headers & entries, highlight colors, bold text,
 *       adjustments, bill status.
 *   - All data loads exactly as saved — custom cols, cell formats, adjustments,
 *       bill format (Free/GST) — all restored.
 *   - Bill status is editable directly from this view via a color-tagged selector.
 *   - Saving writes the updated bill back to DB via updateBill().
 *   - Unsaved changes guard: navigating away with edits prompts save or discard.
 *   - Phase 7b will add versioning on top of this save.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  ArrowLeft,
  Save, Bold, PaintBucket,
  Columns, Tag, BarChart2,
  Undo2, Redo2,
  Eye, EyeOff,
  X, ChevronDown,
  ToggleLeft, ToggleRight,
  GripVertical, MoveVertical,
  AlertTriangle,
  FileText, Image, Printer,
  FileSpreadsheet, Copy, LayoutTemplate, StickyNote,
} from 'lucide-react'

import PartyDetailsSection from '../NewQuote/PartyDetailsSection'
import BillInfoSection from '../NewQuote/BillInfoSection'
import BillingGrid, { BillingGridImperative } from '../NewQuote/BillingGrid'
import type { PartyDetails } from '../NewQuote/PartyDetailsSection'
import type { BillInfo } from '../NewQuote/BillInfoSection'
import { STATUS_CONFIG } from '../NewQuote/BillInfoSection'
import type {
  BillingRow, AdjustmentRow, BillTotals, BillFormat,
  CustomColumn, CustomColData, CellFormatMap,
} from '../NewQuote/billingGrid.types'
import {
  DEFAULT_COLUMN_TOGGLES,
  type GridColumnToggles,
} from '../NewQuote/billingGrid.types'
import type { BillRecord, BillStatus } from '../../services/db.service'
import { updateBill } from '../../services/bill.service'
import {
  saveSimplifiedPdf,
  saveProfessionalPdf, saveDetailedProfessionalPdf,
  copyBillAsImage, copyBillAsSimplifiedImage, quickPrintSilent,
} from '../../services/pdf.service'
import type { ProfessionalPdfInput, DetailedProfessionalPdfInput } from '../../services/pdf.service'
import type { PdfFormat } from '../../services/pdf.service'
import { getUpiId, getPartyPdfFormat, setPartyPdfFormat } from '../../services/pdfSettings.service'
import { UpiQrPrompt, PdfFormatSelector } from '../NewQuote/PdfActionDialogs'
import {
  ExcelExportButton,
  PrintOptionsPanel,
  DuplicateBillPanel,
  BillTemplatesPanel,
  InternalRemarksPanel,
} from '../NewQuote/ToolbarPanels'
import type { BillTemplateColumn } from '../../services/template.service'
import { useFlag } from '../../contexts/FeatureFlagContext'
import { useConfig } from '../../contexts/ConfigContext'
import { triggerWhatsAppShare } from '../../modules/whatsappShare'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface EditBillViewProps {
  bill: BillRecord
  onClose: () => void
  onSaved: (updatedBill: BillRecord) => void
}

// ─── Style tokens ──────────────────────────────────────────────────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
}

// ─── Preset colors ─────────────────────────────────────────────────────────────

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
  { hex: 'rgba(239,68,68,0.25)',   label: 'Light Red' },
  { hex: 'rgba(234,179,8,0.25)',   label: 'Light Yellow' },
  { hex: 'rgba(34,197,94,0.25)',   label: 'Light Green' },
  { hex: 'rgba(59,130,246,0.25)',  label: 'Light Blue' },
  { hex: 'rgba(251,191,36,0.45)', label: 'Amber' },
  { hex: 'rgba(167,243,208,0.5)', label: 'Mint' },
]

// ─── Color dropdown ─────────────────────────────────────────────────────────────

function ColorDropdown({ onSelect, onClose, title }: {
  onSelect: (color: string) => void
  onClose: () => void
  title: string
}): React.ReactElement {
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
    <div ref={ref} style={{
      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
      zIndex: 9999, background: S.surfaceRaised,
      border: `1px solid ${S.border}`, borderRadius: '10px',
      padding: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', minWidth: '220px',
    }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px', marginBottom: '10px' }}>
        {PRESET_COLORS.map(c => (
          <button key={c.hex} type="button" title={c.label}
            onClick={() => { onSelect(c.hex); onClose() }}
            style={{
              width: '30px', height: '30px', borderRadius: '6px',
              background: c.hex, border: '1.5px solid var(--cq-border)',
              cursor: 'pointer', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${S.border}` }}>
        <input type="color" value={customColor} onChange={e => setCustomColor(e.target.value)}
          style={{ width: '32px', height: '28px', border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: '4px' }} />
        <span style={{ fontSize: '0.72rem', color: S.textMuted, fontFamily: '"JetBrains Mono", monospace', flex: 1 }}>{customColor}</span>
        <button type="button" onClick={() => { onSelect(customColor); onClose() }}
          style={{ padding: '4px 10px', borderRadius: '5px', background: S.accent, color: S.surface, border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
          Apply
        </button>
      </div>
    </div>
  )
}

// ─── Toolbar button ─────────────────────────────────────────────────────────────

function tbtnStyle(active = false, disabled = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 10px', fontSize: '0.73rem', fontWeight: 600, fontFamily: S.font,
    border: `1px solid ${active ? S.accent : S.border}`, borderRadius: '7px',
    background: active ? 'color-mix(in srgb, var(--cq-accent) 14%, transparent)' : 'transparent',
    color: disabled ? S.textMuted : active ? S.accent : S.text,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1, whiteSpace: 'nowrap' as const,
    position: 'relative' as const, transition: 'all 0.12s',
  }
}

function ToolbarDivider(): React.ReactElement {
  return <div style={{ width: 1, height: 22, background: 'var(--cq-border)', margin: '0 3px', flexShrink: 0 }} />
}

function Kbd({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <kbd style={{
      padding: '2px 5px', background: 'var(--cq-surface-raised)',
      border: '1px solid var(--cq-border)', borderRadius: '3px',
      fontSize: '0.68rem', fontFamily: '"JetBrains Mono", monospace',
    }}>{children}</kbd>
  )
}

// ─── Status selector ────────────────────────────────────────────────────────────

function StatusSelector({ status, onChange }: {
  status: BillStatus
  onChange: (s: BillStatus) => void
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]
  const ALL: BillStatus[] = ['unpaid', 'paid', 'partial', 'cancelled']

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '5px 12px', fontFamily: S.font, fontSize: '0.78rem', fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          color: cfg.color, background: cfg.bg,
          border: `1.5px solid ${cfg.border}`, borderRadius: '20px',
          cursor: 'pointer', outline: 'none',
        }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
        {cfg.label}
        <ChevronDown size={11} style={{ opacity: 0.7 }} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0,
            background: S.surfaceRaised, border: `1.5px solid ${S.border}`,
            borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100, padding: '5px', minWidth: '150px',
          }}>
            {ALL.map(s => {
              const c = STATUS_CONFIG[s]
              const active = s === status
              return (
                <button key={s} type="button"
                  onClick={() => { onChange(s); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '8px 11px',
                    background: active ? c.bg : 'transparent',
                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: S.font, fontSize: '0.8rem',
                    fontWeight: active ? 700 : 500, color: c.color, textAlign: 'left',
                  }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
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

// ─── Toast hook ─────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }, [])
  return { toast, show }
}

// ─── Load bill snapshot into editable state ────────────────────────────────────

function buildPartyDetails(bill: BillRecord): PartyDetails {
  return {
    partyName: bill.partyName ?? '',
    phone: bill.partyPhone ?? '',
    transportName: bill.transportName ?? '',
    address: bill.partyAddress ?? '',
    gstin: bill.partyGstin ?? '',
    notes: bill.partyNotes ?? '',
    resolvedCustomerId: null,
  }
}

function buildBillInfo(bill: BillRecord): BillInfo {
  return {
    billNumber: bill.billNumber,
    billDate: bill.billDate,
    status: bill.status,
  }
}

/** Convert stored customColumns array back to typed CustomColumn[] + CustomColData */
function unpackCustomColumns(bill: BillRecord): {
  customCols: CustomColumn[]
  customColData: CustomColData
} {
  const stored = bill.customColumns as Array<{
    id: string
    header: string
    cells?: Array<{ value: string; marked: boolean }>
  }>
  if (!Array.isArray(stored) || stored.length === 0) return { customCols: [], customColData: {} }

  const customCols: CustomColumn[] = []
  const customColData: CustomColData = {}

  for (const col of stored) {
    customCols.push({ id: col.id, header: col.header })
    customColData[col.id] = (col.cells ?? []).map(c => ({
      value: c.value ?? '',
      marked: c.marked ?? false,
    }))
  }

  return { customCols, customColData }
}

// ─── Unsaved changes guard dialog ──────────────────────────────────────────────

function UnsavedGuardDialog({ onSave, onDiscard, onCancel }: {
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}): React.ReactElement {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 8000 }} onClick={onCancel} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 8001, background: S.surfaceRaised,
        border: `1.5px solid ${S.border}`, borderRadius: '14px',
        padding: '28px 32px', maxWidth: '400px', width: '90%',
        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        fontFamily: S.font,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: '1rem', fontWeight: 700, color: S.text }}>Unsaved Changes</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: S.textMuted, margin: '0 0 22px', lineHeight: 1.5 }}>
          You have unsaved changes to this bill. Do you want to save before closing?
        </p>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel}
            style={{ padding: '8px 16px', fontFamily: S.font, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', background: 'transparent', border: `1px solid ${S.border}`, borderRadius: '8px', color: S.textMuted }}>
            Cancel
          </button>
          <button type="button" onClick={onDiscard}
            style={{ padding: '8px 16px', fontFamily: S.font, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.35)', borderRadius: '8px', color: '#dc2626' }}>
            Discard Changes
          </button>
          <button type="button" onClick={onSave}
            style={{ padding: '8px 18px', fontFamily: S.font, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', background: S.accent, border: 'none', borderRadius: '8px', color: S.surface }}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main EditBillView ──────────────────────────────────────────────────────────

export default function EditBillView({ bill, onClose, onSaved }: EditBillViewProps): React.ReactElement {
  // ── Unpack existing bill into editable state ─────────────────────────────────
  const { customCols: initialCustomCols, customColData: initialCustomColData } = unpackCustomColumns(bill)

  const { config } = useConfig()
  const whatsappShareEnabled = useFlag('whatsappShare')

  const [partyDetails, setPartyDetails]         = useState<PartyDetails>(buildPartyDetails(bill))
  const [billInfo, setBillInfo]                 = useState<BillInfo>(buildBillInfo(bill))
  const [billFormat, setBillFormat]             = useState<BillFormat>(bill.format as BillFormat ?? 'free')
  const [billStatus, setBillStatus]             = useState<BillStatus>(bill.status)
  const [columnToggles, setColumnToggles]       = useState<GridColumnToggles>(DEFAULT_COLUMN_TOGGLES)
  const [internalRemarks, setInternalRemarks]   = useState(bill.internalRemarks ?? '')
  const [isSaving, setIsSaving]                 = useState(false)
  const [isDirty, setIsDirty]                   = useState(false)
  const [showUnsavedGuard, setShowUnsavedGuard] = useState(false)
  const pendingCloseRef                         = useRef<(() => void) | null>(null)

  const { toast, show: showToast } = useToast()

  // Grid imperative ref for toolbar actions
  const gridImperativeRef = useRef<BillingGridImperative | null>(null)

  // Grid state refs — updated via callbacks, read on save
  const gridRowsRef         = useRef<BillingRow[]>(bill.rows as BillingRow[] ?? [])
  const gridAdjustmentsRef  = useRef<AdjustmentRow[]>(bill.adjustments as AdjustmentRow[] ?? [])
  const gridTotalsRef       = useRef<BillTotals>({ subtotal: bill.subtotal ?? 0, adjustmentsTotal: 0, grandTotal: bill.grandTotal ?? 0 })
  const gridCustomColsRef   = useRef<CustomColumn[]>(initialCustomCols)
  const gridCustomColDataRef = useRef<CustomColData>(initialCustomColData)
  const gridCellFormatsRef  = useRef<CellFormatMap>((bill.cellFormats ?? {}) as CellFormatMap)

  // ── Toolbar state ─────────────────────────────────────────────────────────────
  const [toolbarVisible, setToolbarVisible]           = useState(true)
  const [boldPickerOpen, setBoldPickerOpen]           = useState(false)
  const [cellHighlightPickerOpen, setCellHighlightPickerOpen] = useState(false)
  const [undoLen, setUndoLen]                         = useState(0)
  const [redoLen, setRedoLen]                         = useState(0)

  // ── Panel state (matching NewQuote) ──────────────────────────────────────────
  const [excelExportOpen,   setExcelExportOpen]   = useState(false)
  const [printOptionsOpen,  setPrintOptionsOpen]  = useState(false)
  const [duplicateOpen,     setDuplicateOpen]     = useState(false)
  const [templatesOpen,     setTemplatesOpen]     = useState(false)
  const [remarksOpen,       setRemarksOpen]       = useState(false)
  const hasRemarks = internalRemarks.trim().length > 0

  // ── PDF / Print state ─────────────────────────────────────────────────────────
  const [isSavingPdf,              setIsSavingPdf]              = useState(false)
  const [isSavingProfessionalPdf,  setIsSavingProfessionalPdf]  = useState(false)
  const [isCopyingImage,           setIsCopyingImage]           = useState(false)
  const [isCopyingSimplifiedImage, setIsCopyingSimplifiedImage] = useState(false)
  const [isQuickPrinting,          setIsQuickPrinting]          = useState(false)
  const [quickPrintA4Warning,      setQuickPrintA4Warning]      = useState(false)

  // ── PDF format selector + UPI QR prompt ──────────────────────────────────────
  const [formatSelectorPending, setFormatSelectorPending] = useState<{
    resolve: (fmt: PdfFormat | null) => void
    initialFmt: PdfFormat
    hasMemory: boolean
  } | null>(null)
  const [upiQrPending, setUpiQrPending] = useState<{
    resolve: (include: boolean) => void
    grandTotal: number
  } | null>(null)

  // ── Load snapshot into grid on mount ─────────────────────────────────────────
  // We need to wait for the grid to be mounted before calling loadSnapshot.
  // We use a small effect that fires after the first render.
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    function attemptLoad() {
      if (hasLoadedRef.current) return
      const imp = gridImperativeRef.current
      if (!imp) return
      hasLoadedRef.current = true
      imp.loadSnapshot({
        rows:          bill.rows as BillingRow[],
        adjustments:   bill.adjustments as AdjustmentRow[],
        customCols:    initialCustomCols,
        customColData: initialCustomColData,
        cellFormats:   (bill.cellFormats ?? {}) as CellFormatMap,
      })
    }

    attemptLoad()
    // If imp wasn't ready yet (rare), retry after one animation frame
    if (!hasLoadedRef.current) {
      const raf = requestAnimationFrame(attemptLoad)
      return () => cancelAnimationFrame(raf)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track dirty state ────────────────────────────────────────────────────────
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
    // Refresh undo/redo counts
    const imp = gridImperativeRef.current
    if (imp) {
      setUndoLen(imp.canUndo() ? 1 : 0)
      setRedoLen(imp.canRedo() ? 1 : 0)
    }
    setIsDirty(true)
  }, [])

  // Mark dirty on party/status changes
  useEffect(() => { setIsDirty(true) }, [partyDetails, billInfo, billStatus])

  // ── PDF helpers (shared with NewQuote pattern) ────────────────────────────────
  const buildPdfInput = useCallback((isDraft: boolean) => ({
    partyName: partyDetails.partyName.trim() || 'Customer',
    partyContact: partyDetails.phone.trim() || undefined,
    transportName: partyDetails.transportName.trim() || undefined,
    billDate: billInfo.billDate || new Date().toISOString().split('T')[0],
    billNumber: bill.billNumber,
    billFormat,
    rows: gridRowsRef.current,
    adjustments: gridAdjustmentsRef.current,
    subtotal: gridTotalsRef.current.subtotal,
    grandTotal: gridTotalsRef.current.grandTotal,
    customCols: gridCustomColsRef.current,
    customColData: gridCustomColDataRef.current,
    cellFormats: gridCellFormatsRef.current,
    isDraft,
  }), [partyDetails, billInfo, billFormat, bill.billNumber])

  const promptPdfFormat = useCallback((partyName: string): Promise<PdfFormat | null> => {
    const memorized = getPartyPdfFormat(partyName)
    const initialFmt: PdfFormat = memorized ?? 'professional'
    const hasMemory = memorized !== null
    return new Promise(resolve => {
      setFormatSelectorPending({ resolve, initialFmt, hasMemory })
    })
  }, [])

  const promptUpiQr = useCallback((grandTotal: number): Promise<boolean> => {
    const upiId = getUpiId()
    if (!upiId.trim()) return Promise.resolve(false)
    return new Promise(resolve => {
      setUpiQrPending({ resolve, grandTotal })
    })
  }, [])

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

  const handleSavePdf = useCallback(async () => {
    if (isSavingPdf) return
    setIsSavingPdf(true)
    try {
      const input = buildPdfInput(false)
      const includeQr = await promptUpiQr(input.grandTotal)
      setUpiQrPending(null)
      const result = await saveSimplifiedPdf({ ...input, includeUpiQr: includeQr })
      setPartyPdfFormat(partyDetails.partyName, 'simplified')
      if (result.cancelled) { showToast('PDF save cancelled.', 'error') }
      else { showToast('✓ PDF saved', 'success') }
    } catch (err) {
      console.error('[EditBillView] Save PDF failed:', err)
      showToast('Failed to generate PDF.', 'error')
    } finally {
      setIsSavingPdf(false)
      setUpiQrPending(null)
    }
  }, [isSavingPdf, buildPdfInput, showToast, promptUpiQr, partyDetails.partyName])

  const handleSaveProfessionalPdf = useCallback(async () => {
    if (isSavingProfessionalPdf) return
    setIsSavingProfessionalPdf(true)
    try {
      const baseInput = buildPdfInput(false)
      const chosenFormat = await promptPdfFormat(partyDetails.partyName)
      setFormatSelectorPending(null)
      if (!chosenFormat) { showToast('PDF generation cancelled.', 'error'); return }
      const includeQr = await promptUpiQr(baseInput.grandTotal)
      setUpiQrPending(null)
      const company = await getCompanyProfile()

      if (chosenFormat === 'simplified') {
        const result = await saveSimplifiedPdf({ ...baseInput, includeUpiQr: includeQr })
        setPartyPdfFormat(partyDetails.partyName, 'simplified')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast('✓ Simplified PDF saved', 'success')
      } else if (chosenFormat === 'professional') {
        const proInput: ProfessionalPdfInput = { ...baseInput, company, poNumber: baseInput.billNumber, includeUpiQr: includeQr }
        const result = await saveProfessionalPdf(proInput)
        setPartyPdfFormat(partyDetails.partyName, 'professional')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast('✓ Professional PDF saved', 'success')
      } else if (chosenFormat === 'detailed-professional') {
        const detInput: DetailedProfessionalPdfInput = {
          ...baseInput, company, poNumber: baseInput.billNumber, includeUpiQr: includeQr,
          customerDetails: {
            partyName: partyDetails.partyName || 'Customer',
            contact: partyDetails.phone || undefined,
            address: partyDetails.address || undefined,
            gstin: partyDetails.gstin || undefined,
          },
        }
        const result = await saveDetailedProfessionalPdf(detInput)
        setPartyPdfFormat(partyDetails.partyName, 'detailed-professional')
        if (result.cancelled) { showToast('PDF save cancelled.', 'error'); return }
        showToast('✓ Detailed Professional PDF saved', 'success')
      }
    } catch (err) {
      console.error('[EditBillView] Save Professional PDF failed:', err)
      showToast('Failed to generate PDF.', 'error')
    } finally {
      setIsSavingProfessionalPdf(false)
      setFormatSelectorPending(null)
      setUpiQrPending(null)
    }
  }, [isSavingProfessionalPdf, buildPdfInput, showToast, promptPdfFormat, promptUpiQr, getCompanyProfile, partyDetails])

  const handleCopyProfessionalImage = useCallback(async () => {
    if (isCopyingImage) return
    setIsCopyingImage(true)
    try {
      const baseInput = buildPdfInput(false)
      const company = await getCompanyProfile()
      const proInput: ProfessionalPdfInput = { ...baseInput, company, poNumber: baseInput.billNumber, includeUpiQr: false }
      const result = await copyBillAsImage(proInput)
      if (result === 'copied') {
        showToast('✓ Bill copied to clipboard as image (Professional format)', 'success')
        if (whatsappShareEnabled && config.whatsappMethod) {
          const opened = triggerWhatsAppShare(config.whatsappMethod)
          if (opened) showToast('📱 WhatsApp opened — paste the bill image in your chat', 'success')
        }
      } else if (result === 'dev-fallback') {
        showToast('Bill HTML opened — image copy requires Electron build', 'success')
      } else {
        showToast('Failed to copy image to clipboard', 'error')
      }
    } catch (err) {
      console.error('[EditBillView] Copy image failed:', err)
      showToast('Failed to copy image to clipboard', 'error')
    } finally {
      setIsCopyingImage(false)
    }
  }, [isCopyingImage, buildPdfInput, getCompanyProfile, showToast, whatsappShareEnabled, config.whatsappMethod])

  const handleCopySimplifiedImage = useCallback(async () => {
    if (isCopyingSimplifiedImage) return
    setIsCopyingSimplifiedImage(true)
    try {
      const input = buildPdfInput(false)
      const result = await copyBillAsSimplifiedImage(input)
      if (result === 'copied') {
        showToast('✓ Bill copied to clipboard as image (Simplified format)', 'success')
        if (whatsappShareEnabled && config.whatsappMethod) {
          const opened = triggerWhatsAppShare(config.whatsappMethod)
          if (opened) showToast('📱 WhatsApp opened — paste the bill image in your chat', 'success')
        }
      } else if (result === 'dev-fallback') {
        showToast('Bill HTML opened — image copy requires Electron build', 'success')
      } else {
        showToast('Failed to copy image to clipboard', 'error')
      }
    } catch (err) {
      console.error('[EditBillView] Copy simplified image failed:', err)
      showToast('Failed to copy image to clipboard', 'error')
    } finally {
      setIsCopyingSimplifiedImage(false)
    }
  }, [isCopyingSimplifiedImage, buildPdfInput, showToast, whatsappShareEnabled, config.whatsappMethod])

  const handleQuickPrint = useCallback(async () => {
    if (isQuickPrinting) return
    setIsQuickPrinting(true)
    try {
      const input = buildPdfInput(false)
      const result = await quickPrintSilent(input, { alreadyWarnedA4: quickPrintA4Warning })
      if (result.a4Warning) {
        setQuickPrintA4Warning(true)
        showToast('⚠ This bill has > 40 rows — it will print on A4, not A5. Click Quick Print again to confirm.', 'error')
        return
      }
      if (result.printed) {
        setQuickPrintA4Warning(false)
        showToast('✓ Sent to printer (Simplified format)', 'success')
      } else {
        showToast('Print failed — please try again', 'error')
      }
    } catch (err) {
      console.error('[EditBillView] Quick print failed:', err)
      showToast('Print failed', 'error')
    } finally {
      setIsQuickPrinting(false)
    }
  }, [isQuickPrinting, buildPdfInput, quickPrintA4Warning, showToast])

  // ── Duplicate handler — opens as new draft in NewQuote ────────────────────────
  // We can't navigate directly from here; we just close back and let parent handle it.
  // Instead, we expose a "Duplicate" panel that informs the user to use History > Duplicate.
  const handleLoadTemplate = useCallback((format: BillFormat, customCols: BillTemplateColumn[]) => {
    setBillFormat(format)
    const imp = gridImperativeRef.current
    if (imp) {
      const snap = imp.getSnapshot()
      imp.loadSnapshot({
        ...snap,
        customCols: customCols.map(c => ({ id: c.id, header: c.header })),
        customColData: {},
        cellFormats: Object.fromEntries(
          Object.entries(snap.cellFormats).filter(([k]) => !k.startsWith('custom:'))
        ),
      })
    }
    showToast('Template loaded — format and columns applied', 'success')
  }, [showToast])

  // ── Save bill ────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!partyDetails.partyName.trim()) {
      showToast('Party Name is required to save.', 'error')
      return
    }
    if (!billInfo.billDate) {
      showToast('Bill date is required.', 'error')
      return
    }
    setIsSaving(true)
    try {
      const customColsSnapshot = gridCustomColsRef.current.map(col => ({
        id: col.id,
        header: col.header,
        cells: gridCustomColDataRef.current[col.id] ?? [],
      }))

      await updateBill({
        id: bill.id!,
        partyName: partyDetails.partyName.trim(),
        partyPhone: partyDetails.phone.trim() || undefined,
        transportName: partyDetails.transportName.trim() || undefined,
        partyAddress: partyDetails.address.trim() || undefined,
        partyGstin: partyDetails.gstin.trim() || undefined,
        partyNotes: partyDetails.notes.trim() || undefined,
        billDate: billInfo.billDate,
        format: billFormat,
        rows: gridRowsRef.current,
        customColumns: customColsSnapshot,
        adjustments: gridAdjustmentsRef.current,
        subtotal: gridTotalsRef.current.subtotal,
        grandTotal: gridTotalsRef.current.grandTotal,
        status: billStatus,
        internalRemarks: internalRemarks.trim() || undefined,
        cellFormats: gridCellFormatsRef.current as Record<string, unknown>,
      })

      setIsDirty(false)
      showToast(`✓ Bill ${bill.billNumber} saved`, 'success')

      // Build updated bill record for parent
      const updatedBill: BillRecord = {
        ...bill,
        partyName: partyDetails.partyName.trim(),
        partyPhone: partyDetails.phone.trim() || undefined,
        transportName: partyDetails.transportName.trim() || undefined,
        partyAddress: partyDetails.address.trim() || undefined,
        partyGstin: partyDetails.gstin.trim() || undefined,
        partyNotes: partyDetails.notes.trim() || undefined,
        billDate: billInfo.billDate,
        format: billFormat,
        rows: gridRowsRef.current,
        customColumns: customColsSnapshot,
        adjustments: gridAdjustmentsRef.current,
        subtotal: gridTotalsRef.current.subtotal,
        grandTotal: gridTotalsRef.current.grandTotal,
        status: billStatus,
        internalRemarks: internalRemarks.trim() || undefined,
        cellFormats: gridCellFormatsRef.current as Record<string, unknown>,
        updatedAt: new Date().toISOString(),
      }
      onSaved(updatedBill)
    } catch (err) {
      console.error('[EditBillView] Save failed:', err)
      showToast('Failed to save bill. Please try again.', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [partyDetails, billInfo, billFormat, billStatus, internalRemarks, bill, onSaved, showToast])

  // ── Close with unsaved guard ─────────────────────────────────────────────────
  const requestClose = useCallback(() => {
    if (!isDirty) {
      onClose()
      return
    }
    setShowUnsavedGuard(true)
  }, [isDirty, onClose])

  const handleGuardSave = useCallback(async () => {
    setShowUnsavedGuard(false)
    await handleSave()
    onClose()
  }, [handleSave, onClose])

  const handleGuardDiscard = useCallback(() => {
    setShowUnsavedGuard(false)
    setIsDirty(false)
    onClose()
  }, [onClose])

  const handleGuardCancel = useCallback(() => {
    setShowUnsavedGuard(false)
    pendingCloseRef.current = null
  }, [])

  // ── Keyboard shortcuts (identical to NewQuote) ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const imp = gridImperativeRef.current

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        if (!isSaving) handleSave()
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'b') {
        e.preventDefault()
        imp?.applyBoldHighlight('#ef4444')
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'p') {
        e.preventDefault()
        setPrintOptionsOpen(prev => !prev)
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'e') {
        e.preventDefault()
        setExcelExportOpen(prev => !prev)
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'd') {
        e.preventDefault()
        setDuplicateOpen(prev => !prev)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        handleCopyProfessionalImage()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'X') {
        e.preventDefault()
        handleCopySimplifiedImage()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        handleQuickPrint()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        setTemplatesOpen(prev => !prev)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault()
        setRemarksOpen(prev => !prev)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        setToolbarVisible(prev => !prev)
        return
      }
      if (e.altKey && e.key === '1') {
        e.preventDefault()
        setBillFormat('free')
        return
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault()
        setBillFormat('gst')
        return
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        setTimeout(() => {
          const imp = gridImperativeRef.current
          if (imp) { setUndoLen(imp.canUndo() ? 1 : 0); setRedoLen(imp.canRedo() ? 1 : 0) }
        }, 0)
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        setTimeout(() => {
          const imp = gridImperativeRef.current
          if (imp) { setUndoLen(imp.canUndo() ? 1 : 0); setRedoLen(imp.canRedo() ? 1 : 0) }
        }, 0)
        return
      }
      if (e.key === 'Escape' && !showUnsavedGuard) {
        requestClose()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isSaving, handleSave, requestClose, showUnsavedGuard, handleCopyProfessionalImage, handleCopySimplifiedImage, handleQuickPrint])

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: S.font, color: S.text, background: S.surface, overflow: 'hidden',
    }}>
      {/* Unsaved changes guard */}
      {showUnsavedGuard && (
        <UnsavedGuardDialog
          onSave={handleGuardSave}
          onDiscard={handleGuardDiscard}
          onCancel={handleGuardCancel}
        />
      )}

      {/* PDF Format Selector */}
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

      {/* UPI QR prompt */}
      {upiQrPending && (
        <UpiQrPrompt
          grandTotal={upiQrPending.grandTotal}
          onResult={include => {
            upiQrPending.resolve(include)
            setUpiQrPending(null)
          }}
        />
      )}

      {/* Toast */}
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
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Breadcrumb / header bar ───────────────────────────────────────────── */}
      <div style={{
        padding: '8px 20px', borderBottom: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '10px',
        background: 'color-mix(in srgb, var(--cq-accent) 6%, var(--cq-surface-raised))',
        flexShrink: 0,
      }}>
        <button type="button" onClick={requestClose}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', fontFamily: S.font, fontSize: '0.78rem', fontWeight: 600,
            color: S.textMuted, background: 'transparent',
            border: `1px solid ${S.border}`, borderRadius: '7px', cursor: 'pointer',
          }}>
          <ArrowLeft size={13} />
          Back to History
        </button>

        {/* Bill number badge */}
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.85rem', fontWeight: 700,
          color: S.accent, padding: '3px 10px',
          background: 'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface-raised))',
          border: `1px solid color-mix(in srgb, var(--cq-accent) 25%, var(--cq-border))`,
          borderRadius: '6px',
        }}>
          {bill.billNumber}
        </div>

        {/* Party name */}
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: S.text }}>
          {partyDetails.partyName || '—'}
        </div>

        {/* Dirty indicator */}
        {isDirty && (
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', opacity: 0.9 }}>
            ● Unsaved changes
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Status selector */}
        <StatusSelector status={billStatus} onChange={s => { setBillStatus(s); setIsDirty(true) }} />

        {/* Toolbar toggle */}
        <button type="button" onClick={() => setToolbarVisible(p => !p)}
          title={`${toolbarVisible ? 'Hide' : 'Show'} toolbar (Ctrl+Shift+H)`}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600,
            background: 'transparent', border: `1px solid ${S.border}`,
            borderRadius: '6px', color: S.textMuted, cursor: 'pointer',
          }}>
          {toolbarVisible ? <EyeOff size={13} /> : <Eye size={13} />}
          {toolbarVisible ? 'Hide Toolbar' : 'Show Toolbar'}
        </button>
      </div>

      {/* ── Toolbar strip (full parity with NewQuote) ───────────────────────── */}
      {toolbarVisible && (
        <div style={{
          padding: '8px 20px', borderBottom: `1px solid ${S.border}`,
          background: 'color-mix(in srgb, var(--cq-surface-raised) 60%, var(--cq-surface))',
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        }}>
          {/* Group 1: Text formatting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => { setBoldPickerOpen(p => !p); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(boldPickerOpen)} title="Bold + Text Color (Ctrl+B)">
                <Bold size={14} />
                <span>Bold+Color</span>
                <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: '1px' }} />
              </button>
              {boldPickerOpen && (
                <ColorDropdown title="Text Bold + Color"
                  onSelect={color => gridImperativeRef.current?.applyBoldHighlight(color)}
                  onClose={() => setBoldPickerOpen(false)} />
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => { setCellHighlightPickerOpen(p => !p); setBoldPickerOpen(false) }}
                style={tbtnStyle(cellHighlightPickerOpen)} title="Highlight Cell">
                <PaintBucket size={14} />
                <span>Highlight Cell</span>
                <ChevronDown size={11} style={{ opacity: 0.6, marginLeft: '1px' }} />
              </button>
              {cellHighlightPickerOpen && (
                <ColorDropdown title="Cell Highlight Color"
                  onSelect={color => gridImperativeRef.current?.highlightCell(color)}
                  onClose={() => setCellHighlightPickerOpen(false)} />
              )}
            </div>
          </div>

          <ToolbarDivider />

          {/* Group 2: Custom columns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button type="button" onClick={() => gridImperativeRef.current?.addCustomColumn()} style={tbtnStyle()} title="Add custom column">
              <Columns size={14} /><span>+Col</span>
            </button>
            <button type="button" onClick={() => gridImperativeRef.current?.removeLastCustomColumn()} style={tbtnStyle()} title="Remove last custom column">
              <Columns size={14} /><span>−Col</span>
            </button>
          </div>

          <ToolbarDivider />

          {/* Group 3: Mark & MKD */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button type="button" onClick={() => gridImperativeRef.current?.markActiveCustomCell()} style={tbtnStyle()} title="Mark cell as sub-group header">
              <Tag size={14} /><span>Mark</span>
            </button>
            <button type="button" onClick={() => gridImperativeRef.current?.showMkd()} style={tbtnStyle()} title="Show MKD qty totals">
              <BarChart2 size={14} /><span>Show MKD</span>
            </button>
          </div>

          <ToolbarDivider />

          {/* Group 4: Format toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            <button type="button" onClick={() => setBillFormat('free')}
              style={{ ...tbtnStyle(billFormat === 'free'), borderRadius: '7px 0 0 7px' }}
              title="Free Format (Alt+1)">
              {billFormat === 'free' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
              <span>Free</span>
              <span style={{ opacity: 0.55, fontSize: '0.62rem', marginLeft: '2px' }}>Alt+1</span>
            </button>
            <button type="button" onClick={() => setBillFormat('gst')}
              style={{ ...tbtnStyle(billFormat === 'gst'), borderRadius: '0 7px 7px 0', marginLeft: '-1px' }}
              title="GST Format (Alt+2)">
              {billFormat === 'gst' ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
              <span>GST</span>
              <span style={{ opacity: 0.55, fontSize: '0.62rem', marginLeft: '2px' }}>Alt+2</span>
            </button>
          </div>

          <ToolbarDivider />

          {/* Group 5: Row reorder indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', fontSize: '0.73rem', fontWeight: 600,
            border: '1px dashed var(--cq-border)', borderRadius: '7px',
            color: 'var(--cq-text-muted)', opacity: 0.65, userSelect: 'none', cursor: 'default',
          }} title="Grab the ⠿ grip on the left of any row to reorder">
            <GripVertical size={13} />
            <MoveVertical size={12} />
            <span>Row Reorder</span>
          </div>

          <ToolbarDivider />

          {/* Group 6: Undo / Redo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button type="button"
              onClick={() => { gridImperativeRef.current?.undo(); setTimeout(() => { const i = gridImperativeRef.current; if (i) { setUndoLen(i.canUndo() ? 1 : 0); setRedoLen(i.canRedo() ? 1 : 0) } }, 0) }}
              disabled={undoLen === 0} style={tbtnStyle(false, undoLen === 0)} title="Undo (Ctrl+Z)">
              <Undo2 size={14} /><span>Undo</span>
            </button>
            <button type="button"
              onClick={() => { gridImperativeRef.current?.redo(); setTimeout(() => { const i = gridImperativeRef.current; if (i) { setUndoLen(i.canUndo() ? 1 : 0); setRedoLen(i.canRedo() ? 1 : 0) } }, 0) }}
              disabled={redoLen === 0} style={tbtnStyle(false, redoLen === 0)} title="Redo (Ctrl+Y)">
              <Redo2 size={14} /><span>Redo</span>
            </button>
          </div>

          <div style={{ flex: 1 }} />

          {/* Group 7: Excel, Print, Duplicate, Templates, Remarks (matching NewQuote) */}
          <ToolbarDivider />
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>

            {/* Excel Export */}
            <div style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setExcelExportOpen(p => !p); setPrintOptionsOpen(false); setDuplicateOpen(false); setTemplatesOpen(false); setRemarksOpen(false); setBoldPickerOpen(false); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(excelExportOpen)} title="Copy bill as TSV — paste into Excel / Sheets (Ctrl+E)">
                <FileSpreadsheet size={14} /><span>Excel Export</span>
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

            {/* Print Options */}
            <div style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setPrintOptionsOpen(p => !p); setExcelExportOpen(false); setDuplicateOpen(false); setTemplatesOpen(false); setRemarksOpen(false); setBoldPickerOpen(false); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(printOptionsOpen)} title="Print with format options (Ctrl+P)">
                <Printer size={14} /><span>Print</span>
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

            {/* Duplicate */}
            <div style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setDuplicateOpen(p => !p); setExcelExportOpen(false); setPrintOptionsOpen(false); setTemplatesOpen(false); setRemarksOpen(false); setBoldPickerOpen(false); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(duplicateOpen)} title="Duplicate bill as new draft (Ctrl+D)">
                <Copy size={14} /><span>Duplicate</span>
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
                  onDuplicate={(_payload) => {
                    showToast('Bill duplicated — open New Quote to view the draft', 'success')
                    setDuplicateOpen(false)
                  }}
                  onClose={() => setDuplicateOpen(false)}
                />
              )}
            </div>

            {/* Templates */}
            <div style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setTemplatesOpen(p => !p); setExcelExportOpen(false); setPrintOptionsOpen(false); setDuplicateOpen(false); setRemarksOpen(false); setBoldPickerOpen(false); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(templatesOpen)} title="Bill templates (Ctrl+Shift+T)">
                <LayoutTemplate size={14} /><span>Templates</span>
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

            {/* Remarks */}
            <div style={{ position: 'relative' }}>
              <button type="button"
                onClick={() => { setRemarksOpen(p => !p); setExcelExportOpen(false); setPrintOptionsOpen(false); setDuplicateOpen(false); setTemplatesOpen(false); setBoldPickerOpen(false); setCellHighlightPickerOpen(false) }}
                style={tbtnStyle(remarksOpen || hasRemarks)} title="Internal remarks (Ctrl+Shift+R)">
                <StickyNote size={14} /><span>Remarks</span>
                {hasRemarks && (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#eab308', flexShrink: 0 }} />
                )}
              </button>
              {remarksOpen && (
                <InternalRemarksPanel
                  value={internalRemarks}
                  onChange={v => { setInternalRemarks(v); setIsDirty(true) }}
                  onClose={() => setRemarksOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Shortcut hints */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.55, fontSize: '0.68rem', color: S.textMuted, marginLeft: '6px' }}>
            <Kbd>Ctrl+S</Kbd> Save
            <Kbd>Ctrl+P</Kbd> Print
            <Kbd>Ctrl+B</Kbd> Bold
            <Kbd>Alt+1/2</Kbd> Format
            <Kbd>Ctrl+Z/Y</Kbd> Undo/Redo
            <Kbd>Esc</Kbd> Close
          </div>
        </div>
      )}

      {/* ── Scrollable content area ───────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Party Details */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Party Details
          </div>
          <PartyDetailsSection
            value={partyDetails}
            onChange={d => { setPartyDetails(d); setIsDirty(true) }}
            onCustomerSelect={() => {}}
          />
        </section>

        {/* Bill Info */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
            Bill Info
          </div>
          <BillInfoSection
            value={billInfo}
            onChange={i => { setBillInfo(i); setIsDirty(true) }}
            statusEditable={false}
          />
          <div style={{ marginTop: '10px', fontSize: '0.73rem', color: S.textMuted }}>
            Status is editable via the selector in the top bar.
          </div>
        </section>

        {/* Internal Remarks */}
        <section style={{ background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '12px', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: S.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Internal Remarks (private, never printed)
          </div>
          <textarea
            value={internalRemarks}
            onChange={e => { setInternalRemarks(e.target.value); setIsDirty(true) }}
            placeholder="Private notes about this bill…"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              fontFamily: S.font, fontSize: '0.82rem', color: S.text,
              background: S.surface, border: `1.5px solid ${S.border}`, borderRadius: '8px',
              padding: '9px 12px', resize: 'vertical', outline: 'none',
            }}
          />
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

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 24px', borderTop: `1px solid ${S.border}`,
        display: 'flex', alignItems: 'center', gap: '10px',
        background: S.surface, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Save Changes */}
        <button type="button" onClick={handleSave} disabled={isSaving}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '9px 22px', background: S.accent, color: S.surface,
            border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700,
            fontFamily: S.font, cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1, transition: 'opacity 0.15s',
          }}>
          <Save size={15} />
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* Save PDF (Simplified) */}
        <button type="button" onClick={handleSavePdf} disabled={isSavingPdf}
          title="Generate and save Simplified PDF"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: S.text, cursor: isSavingPdf ? 'not-allowed' : 'pointer',
            opacity: isSavingPdf ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
          <FileText size={14} />
          {isSavingPdf ? 'Generating…' : 'Save PDF'}
        </button>

        {/* Save PDF (format chooser) */}
        <button type="button" onClick={handleSaveProfessionalPdf} disabled={isSavingProfessionalPdf}
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
            opacity: isSavingProfessionalPdf ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
          <FileText size={14} />
          {isSavingProfessionalPdf ? 'Generating…' : '🏢 Save PDF…'}
        </button>

        {/* Copy Image (Professional) */}
        <button type="button" onClick={handleCopyProfessionalImage} disabled={isCopyingImage}
          title="Copy bill as image (Professional format)"
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
          }}>
          <Image size={14} />
          {isCopyingImage ? 'Copying…' : 'Copy Image'}
        </button>

        {/* Copy Simplified Image */}
        <button type="button" onClick={handleCopySimplifiedImage} disabled={isCopyingSimplifiedImage}
          title="Copy bill as image (Simplified format)"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
            background: S.surfaceRaised, border: `1px solid ${S.border}`, borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: isCopyingSimplifiedImage ? S.textMuted : S.text,
            cursor: isCopyingSimplifiedImage ? 'not-allowed' : 'pointer',
            opacity: isCopyingSimplifiedImage ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
          <Image size={14} />
          {isCopyingSimplifiedImage ? 'Copying…' : 'Copy Simple'}
        </button>

        {/* Quick Print */}
        <button type="button" onClick={handleQuickPrint} disabled={isQuickPrinting}
          title="Quick print — Simplified A5, silent; warns if A4 needed"
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
          }}>
          <Printer size={14} />
          {isQuickPrinting ? 'Printing…' : quickPrintA4Warning ? 'Confirm Print (A4)' : 'Quick Print'}
        </button>

        {/* Back button */}
        <button type="button" onClick={requestClose}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', background: S.surfaceRaised,
            border: `1px solid ${S.border}`, borderRadius: '8px',
            fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
            color: S.textMuted, cursor: 'pointer',
          }}>
          <ArrowLeft size={14} />
          Back to History
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: '0.7rem', color: S.textMuted, opacity: 0.6, display: 'flex', gap: '10px', alignItems: 'center' }}>
          Editing: <span style={{ fontFamily: '"JetBrains Mono", monospace', color: S.accent, fontWeight: 700 }}>{bill.billNumber}</span>
          <span><Kbd>Ctrl+S</Kbd> Save</span>
          <span><Kbd>Ctrl+P</Kbd> PDF/Print</span>
          <span><Kbd>Ctrl+Shift+C</Kbd> Copy Image</span>
          <span><Kbd>Ctrl+Shift+P</Kbd> Quick Print</span>
          <span><Kbd>Esc</Kbd> Close</span>
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
