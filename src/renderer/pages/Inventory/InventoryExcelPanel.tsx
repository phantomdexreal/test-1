/**
 * cQikly — Inventory Excel Import / Export Panel
 * Phase 9b-B-ii-B
 *
 * A single modal that exposes two tabs:
 *   • Export — one-click export of the full inventory to a .xlsx file
 *   • Import — drag-or-browse an .xlsx file; preview first row count; confirm import
 *
 * Both operations go through inventoryService — zero direct DB or SheetJS
 * calls from this component.
 */

import React, { useCallback, useRef, useState } from 'react'
import { Download, Upload, X, CheckCircle2, AlertTriangle, Loader2, FileSpreadsheet } from 'lucide-react'
import { inventoryService } from '../../services/inventory.service'

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  font:    '"Inter", system-ui, sans-serif',
  accent:  'var(--cq-accent)',
  text:    'var(--cq-text-primary)',
  muted:   'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  raised:  'var(--cq-surface-raised)',
  border:  'var(--cq-border)',
  bg:      'var(--cq-bg)',
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number
  skipped: number
  newCustomCols: string[]
  errors: string[]
}

type Tab = 'export' | 'import'
type ImportPhase = 'idle' | 'fileSelected' | 'importing' | 'done' | 'error'
type ExportPhase = 'idle' | 'exporting' | 'done' | 'error'

// ─── Props ────────────────────────────────────────────────────────────────────

interface InventoryExcelPanelProps {
  onClose: () => void
  totalItems: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InventoryExcelPanel({ onClose, totalItems }: InventoryExcelPanelProps) {
  const [tab, setTab] = useState<Tab>('export')

  // ── Export state ──────────────────────────────────────────────────────────
  const [exportPhase, setExportPhase] = useState<ExportPhase>('idle')
  const [exportRows, setExportRows] = useState(0)
  const [exportError, setExportError] = useState('')

  // ── Import state ──────────────────────────────────────────────────────────
  const [importPhase, setImportPhase] = useState<ImportPhase>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExportPhase('exporting')
    setExportError('')
    try {
      const result = await inventoryService.exportToExcel()
      setExportRows(result.rowsExported)
      setExportPhase('done')
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err))
      setExportPhase('error')
    }
  }, [])

  // ── Import file selection ──────────────────────────────────────────────────
  const handleFileSelect = useCallback((file: File | null | undefined) => {
    if (!file) return
    const validExt = /\.(xlsx|xls|ods|csv)$/i.test(file.name)
    if (!validExt) {
      setImportError('Please select an Excel file (.xlsx, .xls, .ods) or CSV.')
      setImportPhase('error')
      return
    }
    setSelectedFile(file)
    setImportPhase('fileSelected')
    setImportResult(null)
    setImportError('')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelect(e.dataTransfer.files[0])
  }, [handleFileSelect])

  // ── Import execution ───────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!selectedFile) return
    setImportPhase('importing')
    setImportError('')
    try {
      const result = await inventoryService.importFromExcel(selectedFile)
      setImportResult(result)
      setImportPhase('done')
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err))
      setImportPhase('error')
    }
  }, [selectedFile])

  const resetImport = useCallback(() => {
    setImportPhase('idle')
    setSelectedFile(null)
    setImportResult(null)
    setImportError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: S.font,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: S.raised, borderRadius: 16, border: `1px solid ${S.border}`,
        width: 520, maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 22px 14px', borderBottom: `1px solid ${S.border}` }}>
          <FileSpreadsheet size={18} style={{ color: S.accent, marginRight: 9 }} />
          <span style={{ fontSize: '1rem', fontWeight: 800, color: S.text }}>Inventory Excel</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: S.muted, padding: 4, borderRadius: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${S.border}`, background: S.surface }}>
          {(['export', 'import'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '11px 0', background: 'none',
                border: 'none', borderBottom: tab === t ? `2.5px solid ${S.accent}` : '2.5px solid transparent',
                cursor: 'pointer', fontFamily: S.font, fontSize: '0.87rem', fontWeight: tab === t ? 700 : 500,
                color: tab === t ? S.accent : S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'color 0.15s',
              }}
            >
              {t === 'export' ? <Download size={13} /> : <Upload size={13} />}
              {t === 'export' ? 'Export' : 'Import'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {tab === 'export' ? (
            <ExportTab
              totalItems={totalItems}
              phase={exportPhase}
              rowsExported={exportRows}
              error={exportError}
              onExport={handleExport}
              onReset={() => { setExportPhase('idle'); setExportError('') }}
            />
          ) : (
            <ImportTab
              phase={importPhase}
              selectedFile={selectedFile}
              result={importResult}
              error={importError}
              dragOver={dragOver}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onDragOver={() => setDragOver(true)}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onImport={handleImport}
              onReset={resetImport}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Export Tab ───────────────────────────────────────────────────────────────

function ExportTab({
  totalItems, phase, rowsExported, error, onExport, onReset,
}: {
  totalItems: number
  phase: ExportPhase
  rowsExported: number
  error: string
  onExport: () => void
  onReset: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--cq-text-muted)', lineHeight: 1.6 }}>
        Export your full inventory to an Excel workbook (.xlsx). The file uses the same column format accepted by Import — useful for backup or migration to another device.
      </p>

      <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '12px 16px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--cq-text-muted)', marginBottom: 4 }}>Items to export</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--cq-text-primary)' }}>{totalItems}</div>
      </div>

      <div style={{ fontSize: '0.79rem', color: 'var(--cq-text-muted)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--cq-text-primary)' }}>Included columns:</strong> Item Name, Category, Sub-Category, Price, Wholesale Price, GST Price, Credit, all custom price columns, GST Rate, Stock Qty, Low Stock Threshold, Unit, Barcode / SKU. A second sheet ("Column Guide") describes each column.
      </div>

      {phase === 'idle' && (
        <button
          onClick={onExport}
          disabled={totalItems === 0}
          style={{
            fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, padding: '10px 22px',
            borderRadius: 10, cursor: totalItems === 0 ? 'not-allowed' : 'pointer',
            background: totalItems === 0 ? 'rgba(255,255,255,0.06)' : 'var(--cq-accent)',
            border: 'none', color: totalItems === 0 ? 'var(--cq-text-muted)' : '#fff',
            display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
          }}
        >
          <Download size={15} />
          Export to Excel
        </button>
      )}

      {phase === 'exporting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--cq-accent)', fontSize: '0.87rem', fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Exporting…
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#4ade80', fontSize: '0.9rem', fontWeight: 700 }}>
            <CheckCircle2 size={18} />
            Exported {rowsExported} {rowsExported === 1 ? 'item' : 'items'} successfully.
          </div>
          <button onClick={onReset} style={{ fontFamily: 'inherit', fontSize: '0.82rem', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1.5px solid var(--cq-border)', color: 'var(--cq-text-muted)', alignSelf: 'flex-start' }}>
            Export again
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#f87171', fontSize: '0.87rem' }}>
            <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>{error || 'Export failed. Please try again.'}</span>
          </div>
          <button onClick={onReset} style={{ fontFamily: 'inherit', fontSize: '0.82rem', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1.5px solid var(--cq-border)', color: 'var(--cq-text-muted)', alignSelf: 'flex-start' }}>
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab({
  phase, selectedFile, result, error, dragOver, fileInputRef,
  onFileSelect, onDragOver, onDragLeave, onDrop, onImport, onReset,
}: {
  phase: ImportPhase
  selectedFile: File | null
  result: ImportResult | null
  error: string
  dragOver: boolean
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileSelect: (file: File | null | undefined) => void
  onDragOver: () => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onImport: () => void
  onReset: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--cq-text-muted)', lineHeight: 1.6 }}>
        Import items from an Excel file. <strong style={{ color: 'var(--cq-text-primary)' }}>Item Name</strong> is the only required column — all others are optional and partial fill is accepted.
      </p>

      {/* Column format reference */}
      <div style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)', lineHeight: 1.8, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--cq-border)' }}>
        <div style={{ fontWeight: 700, color: 'var(--cq-text-primary)', marginBottom: 4, fontSize: '0.8rem' }}>Expected columns (first row = headers)</div>
        <span style={{ color: '#f87171', fontWeight: 700 }}>Item Name*</span>
        {' · Category · Sub-Category · Price · Wholesale Price · GST Price · Credit'}
        {' · GST Rate · Stock Qty · Low Stock Threshold · Unit · Barcode / SKU'}
        {' · '}
        <em>any custom price columns…</em>
      </div>

      {/* Drop zone / file picker */}
      {(phase === 'idle' || phase === 'error') && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); onDragOver() }}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--cq-accent)' : 'var(--cq-border)'}`,
              borderRadius: 12, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragOver ? 'rgba(var(--cq-accent-rgb, 99,102,241),0.06)' : 'rgba(255,255,255,0.02)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <Upload size={28} style={{ color: dragOver ? 'var(--cq-accent)' : 'var(--cq-text-muted)', marginBottom: 8 }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--cq-text-primary)', marginBottom: 4 }}>
              Drop your Excel file here
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)' }}>
              or click to browse · .xlsx, .xls, .ods, .csv accepted
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods,.csv"
            style={{ display: 'none' }}
            onChange={e => onFileSelect(e.target.files?.[0])}
          />
        </>
      )}

      {/* File selected — confirm */}
      {phase === 'fileSelected' && selectedFile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '11px 15px' }}>
            <FileSpreadsheet size={18} style={{ color: '#4ade80', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.87rem', fontWeight: 700, color: 'var(--cq-text-primary)' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '0.77rem', color: 'var(--cq-text-muted)' }}>{(selectedFile.size / 1024).toFixed(1)} KB</div>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--cq-text-muted)', lineHeight: 1.6 }}>
            New items will be added to your inventory. Existing items are not overwritten — duplicates will appear as separate new entries if the same item name exists.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onReset} style={{ fontFamily: 'inherit', fontSize: '0.84rem', padding: '8px 16px', borderRadius: 9, cursor: 'pointer', background: 'transparent', border: '1.5px solid var(--cq-border)', color: 'var(--cq-text-muted)' }}>
              Cancel
            </button>
            <button onClick={onImport} style={{ fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 700, padding: '8px 20px', borderRadius: 9, cursor: 'pointer', background: 'var(--cq-accent)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
              <Upload size={14} /> Import Now
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {phase === 'importing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--cq-accent)', fontSize: '0.87rem', fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          Importing…
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#4ade80', fontSize: '0.95rem', fontWeight: 700 }}>
            <CheckCircle2 size={20} />
            Import complete
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StatBadge label="Imported" value={result.imported} color="#4ade80" />
            {result.skipped > 0 && <StatBadge label="Skipped" value={result.skipped} color="var(--cq-text-muted)" />}
            {result.newCustomCols.length > 0 && <StatBadge label="New columns" value={result.newCustomCols.length} color="var(--cq-accent)" />}
          </div>
          {result.newCustomCols.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--cq-text-primary)' }}>New custom columns created:</strong>{' '}
              {result.newCustomCols.join(', ')}
            </div>
          )}
          {result.errors.length > 0 && (
            <div style={{ fontSize: '0.79rem', color: '#f87171', lineHeight: 1.7 }}>
              <strong>Warnings ({result.errors.length}):</strong>
              <ul style={{ margin: '4px 0 0 14px', padding: 0 }}>
                {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
              </ul>
            </div>
          )}
          <button onClick={onReset} style={{ fontFamily: 'inherit', fontSize: '0.82rem', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1.5px solid var(--cq-border)', color: 'var(--cq-text-muted)', alignSelf: 'flex-start' }}>
            Import another file
          </button>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#f87171', fontSize: '0.87rem' }}>
          <AlertTriangle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

// ─── Stat badge ───────────────────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--cq-border)', borderRadius: 10, padding: '8px 14px', minWidth: 80, textAlign: 'center' }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.73rem', color: 'var(--cq-text-muted)', marginTop: 1 }}>{label}</div>
    </div>
  )
}
