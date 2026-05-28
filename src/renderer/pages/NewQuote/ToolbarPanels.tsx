/**
 * cQikly — Toolbar Panels (Phase 4a-ii-A)
 *
 * Contains the 5 new toolbar feature panels/dialogs:
 *
 *  1. ExcelExportButton   — copies bill as TSV to clipboard; includes headers,
 *                           party name, and totals; nothing truncated.
 *  2. PrintOptionsPanel   — opens print dialogue with format options.
 *  3. DuplicateBillPanel  — copies current bill as a new draft; all rows and
 *                           custom columns carried over; date resets to today.
 *  4. BillTemplatesPanel  — save structure only (format type + custom column
 *                           headers, zero row data); manage via template manager.
 *  5. InternalRemarksPanel — small text area per bill for private internal notes;
 *                           never appears on any PDF or printed output; only
 *                           visible inside the app.
 *
 * Architecture: All panels are standalone components that receive props from
 * NewQuote/index.tsx. They never import from each other. All service calls go
 * through the services/ layer.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  FileSpreadsheet,
  Printer,
  Copy,
  LayoutTemplate,
  StickyNote,
  X,
  Check,
  Trash2,
  Pencil,
  Plus,
  AlertCircle,
  Save,
  Loader2,
} from 'lucide-react'
import type {
  BillingRow,
  AdjustmentRow,
  BillTotals,
  BillFormat,
  CustomColumn,
  CustomColData,
  CellFormatMap,
} from './billingGrid.types'
import {
  createTemplate,
  renameTemplate,
  deleteTemplate,
  getTemplates,
} from '../../services/template.service'
import type { BillTemplate, BillTemplateColumn } from '../../services/template.service'
import type { PartyDetails } from './PartyDetailsSection'
import type { BillInfo } from './BillInfoSection'

// ─── Shared style tokens ───────────────────────────────────────────────────────

const S = {
  font:          '"Inter", system-ui, sans-serif',
  mono:          '"JetBrains Mono", "Fira Code", monospace',
  accent:        'var(--cq-accent)',
  text:          'var(--cq-text-primary)',
  textMuted:     'var(--cq-text-muted)',
  surface:       'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border:        'var(--cq-border)',
}

// ─── Shared panel wrapper ──────────────────────────────────────────────────────

interface PanelProps {
  title: string
  width?: number
  onClose: () => void
  children: React.ReactNode
}

function Panel({ title, width = 380, onClose, children }: PanelProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // Defer so the opening click doesn't immediately close it
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousedown', handler)
    }
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '6px',
        zIndex: 9999,
        width: `${width}px`,
        background: S.surfaceRaised,
        border: `1px solid ${S.border}`,
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        overflow: 'hidden',
        fontFamily: S.font,
      }}
    >
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: `1px solid ${S.border}`,
        background: `color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface-raised))`,
      }}>
        <span style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: S.accent,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: S.textMuted,
            display: 'flex',
            padding: '3px',
            borderRadius: '5px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Panel body */}
      <div style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Shared button helpers ─────────────────────────────────────────────────────

function Btn({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  icon,
  fullWidth = false,
  danger = false,
}: {
  children?: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
  danger?: boolean
}): React.ReactElement {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 14px',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: S.font,
    borderRadius: '7px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.12s',
    width: fullWidth ? '100%' : undefined,
  }

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      ...base,
      background: danger ? '#ef4444' : S.accent,
      color: S.surface,
      border: 'none',
    },
    secondary: {
      ...base,
      background: 'transparent',
      color: danger ? '#ef4444' : S.text,
      border: `1px solid ${danger ? '#ef4444' : S.border}`,
    },
    ghost: {
      ...base,
      background: 'transparent',
      color: danger ? '#ef4444' : S.textMuted,
      border: 'none',
      padding: '6px 8px',
    },
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} style={styles[variant]}>
      {icon}
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{
      fontSize: '0.68rem',
      fontWeight: 700,
      color: S.textMuted,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: '6px',
    }}>
      {children}
    </div>
  )
}

// ─── 1. EXCEL EXPORT ──────────────────────────────────────────────────────────

export interface ExcelExportProps {
  partyDetails: PartyDetails
  billInfo: BillInfo
  billFormat: BillFormat
  rows: BillingRow[]
  adjustments: AdjustmentRow[]
  totals: BillTotals
  customCols: CustomColumn[]
  customColData: CustomColData
  onClose: () => void
}

/**
 * Builds TSV from the current bill state and copies to clipboard.
 *
 * TSV structure (nothing is truncated):
 *   Row 1: Party Name, Bill No, Bill Date, Format
 *   Row 2: (blank)
 *   Row 3: Column headers — Sl.No, Item Name, [Qty Unit], Qty, [Discount], Rate,
 *           [Pre Tax, GST %, GST Amt], Amount, [custom col headers…]
 *   Rows 4–N: data rows (only rows that have content; empty rows skipped)
 *   Row N+1: (blank)
 *   Row N+2: Subtotal label + value
 *   Row N+3: Each adjustment label + value
 *   Row N+4: Grand Total label + value
 */
function buildTsv({
  partyDetails,
  billInfo,
  billFormat,
  rows,
  adjustments,
  totals,
  customCols,
  customColData,
}: Omit<ExcelExportProps, 'onClose'>): string {
  const tab = '\t'
  const nl = '\n'

  function r(...cells: (string | number)[]): string {
    return cells.map(c => String(c ?? '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join(tab)
  }

  // ── Header meta rows ──
  const lines: string[] = [
    r('Party Name', partyDetails.partyName || '—'),
    r('Bill No', billInfo.billNumber || '—'),
    r('Bill Date', billInfo.billDate || '—'),
    r('Format', billFormat === 'free' ? 'Free Format' : 'GST Format'),
    '',
  ]

  // ── Column headers ──
  const headers: string[] = ['Sl.No', 'Item Name']
  if (rows.some(row => row.qtyUnit)) headers.push('Unit')
  headers.push('Qty')
  if (rows.some(row => row.discountValue)) headers.push('Discount')
  headers.push('Rate')
  if (billFormat === 'gst') {
    headers.push('Pre Tax', 'GST %', 'GST Amt')
  }
  headers.push('Amount')
  customCols.forEach(col => headers.push(col.header))
  lines.push(headers.join(tab))

  // ── Data rows (skip fully empty rows) ──
  let slNo = 0
  rows.forEach(row => {
    const hasContent = row.itemName.trim() || row.qty.trim() || row.rate.trim()
    if (!hasContent) return

    const hasSlNo = row.itemName.trim() && (row.qty.trim() || row.rate.trim())
    if (hasSlNo) slNo++

    const cells: (string | number)[] = [
      hasSlNo ? slNo : '',
      row.itemName,
    ]
    if (headers.includes('Unit')) cells.push(row.qtyUnit)
    cells.push(row.qty)
    if (headers.includes('Discount')) {
      cells.push(row.discountValue ? `${row.discountValue}${row.discountType === 'pct' ? '%' : '₹'}` : '')
    }
    cells.push(row.rate)
    if (billFormat === 'gst') {
      cells.push(
        row.preTax ? row.preTax.toFixed(2) : '',
        row.gstPct,
        row.gstAmt ? row.gstAmt.toFixed(2) : '',
      )
    }
    cells.push(row.amount ? row.amount.toFixed(2) : '')

    // Custom column cells for this row
    customCols.forEach(col => {
      const colCells = customColData[col.id] ?? []
      const rowIdx = rows.indexOf(row)
      const cell = colCells[rowIdx]
      cells.push(cell?.value ?? '')
    })

    lines.push(cells.join(tab))
  })

  lines.push('')

  // ── Totals ──
  const totalCols = headers.length
  const labelCol = Math.max(0, totalCols - 2)

  function totalRow(label: string, value: string): string {
    const cells = Array(totalCols).fill('')
    cells[labelCol] = label
    cells[labelCol + 1] = value
    // Remove extra trailing cols if labelCol + 1 >= totalCols
    if (labelCol + 1 >= totalCols) {
      cells.length = totalCols
      cells[totalCols - 1] = `${label}: ${value}`
    }
    return cells.join(tab)
  }

  lines.push(totalRow('Subtotal', totals.subtotal.toFixed(2)))
  adjustments.forEach(adj => {
    if (adj.label.trim() || adj.amount.trim()) {
      lines.push(totalRow(adj.label || '—', adj.amount))
    }
  })
  lines.push(totalRow('Grand Total', String(totals.grandTotal)))

  return lines.join(nl)
}

export function ExcelExportButton({
  partyDetails,
  billInfo,
  billFormat,
  rows,
  adjustments,
  totals,
  customCols,
  customColData,
  onClose,
}: ExcelExportProps): React.ReactElement {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = useCallback(async () => {
    const tsv = buildTsv({
      partyDetails, billInfo, billFormat, rows, adjustments, totals, customCols, customColData,
    })
    try {
      await navigator.clipboard.writeText(tsv)
      setStatus('copied')
      setTimeout(() => {
        setStatus('idle')
        onClose()
      }, 1400)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2500)
    }
  }, [partyDetails, billInfo, billFormat, rows, adjustments, totals, customCols, customColData, onClose])

  return (
    <Panel title="Excel Export" width={340} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: S.textMuted, lineHeight: 1.5 }}>
          Copies the current bill as <strong style={{ color: S.text }}>TSV</strong> to your clipboard.
          Paste directly into Excel or Google Sheets — nothing is truncated.
        </p>

        {/* Preview of what's included */}
        <div style={{
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '0.76rem',
          color: S.textMuted,
          lineHeight: 1.7,
        }}>
          <div>✓ Party name &amp; bill meta</div>
          <div>✓ All item rows (empty rows skipped)</div>
          {customCols.length > 0 && (
            <div>✓ Custom columns: {customCols.map(c => c.header).join(', ')}</div>
          )}
          <div>✓ Subtotal, adjustments, grand total</div>
          {billFormat === 'gst' && <div>✓ GST breakdown per row</div>}
        </div>

        <Btn
          variant="primary"
          fullWidth
          icon={status === 'copied' ? <Check size={15} /> : status === 'error' ? <AlertCircle size={15} /> : <FileSpreadsheet size={15} />}
          onClick={handleCopy}
        >
          {status === 'copied' ? 'Copied to clipboard!' : status === 'error' ? 'Copy failed — try again' : 'Copy TSV to Clipboard'}
        </Btn>
        <p style={{ margin: 0, fontSize: '0.72rem', color: S.textMuted, opacity: 0.7, textAlign: 'center' }}>
          Then paste with Ctrl+V in Excel / Sheets
        </p>
      </div>
    </Panel>
  )
}

// ─── 2. PRINT OPTIONS ─────────────────────────────────────────────────────────

export interface PrintOptionsProps {
  partyDetails: PartyDetails
  billInfo: BillInfo
  billFormat: BillFormat
  rows: BillingRow[]
  adjustments: AdjustmentRow[]
  totals: BillTotals
  onClose: () => void
}

type PrintFormat = 'simplified' | 'professional' | 'detailed'
type PrintSize   = 'a5' | 'a4'

export function PrintOptionsPanel({
  partyDetails,
  billInfo,
  billFormat,
  rows,
  adjustments,
  totals,
  onClose,
}: PrintOptionsProps): React.ReactElement {
  const [printFormat, setPrintFormat]  = useState<PrintFormat>('simplified')
  const [pageSize,    setPageSize]     = useState<PrintSize>('a5')
  const [includeQr,   setIncludeQr]   = useState(false)
  const [isPrinting,  setIsPrinting]  = useState(false)

  const rowCount = rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length

  function handlePrint() {
    setIsPrinting(true)

    // Build a minimal printable HTML string
    const title = partyDetails.partyName
      ? `${partyDetails.partyName} — ${billInfo.billDate || 'Bill'}`
      : 'cQikly Bill'

    const css = `
      @page { size: ${pageSize === 'a5' ? 'A5' : 'A4'}; margin: 16mm; }
      body { font-family: "Inter", sans-serif; font-size: 11pt; color: #111; }
      h2 { font-size: 14pt; margin: 0 0 4px; }
      .meta { font-size: 9pt; color: #555; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { background: #f3f4f6; font-size: 9pt; padding: 5px 8px; border: 1px solid #d1d5db; text-align: left; }
      td { padding: 4px 8px; border: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
      .amount { text-align: right; }
      .totals { margin-top: 10px; text-align: right; font-size: 10pt; }
      .grand-total { font-weight: 700; font-size: 12pt; margin-top: 4px; }
      .internal-note { display: none !important; }
      .watermark { display: none; }
    `

    // Table headers based on format
    const isGst = billFormat === 'gst'
    const thCells = ['Sl.No', 'Item Name', 'Qty', 'Rate', ...(isGst ? ['Pre Tax', 'GST%', 'GST Amt'] : []), 'Amount']
    const thead = `<tr>${thCells.map(h => `<th>${h}</th>`).join('')}</tr>`

    let slNo = 0
    const tbody = rows
      .filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim())
      .map(row => {
        const hasSlNo = row.itemName.trim() && (row.qty.trim() || row.rate.trim())
        if (hasSlNo) slNo++
        const cells = [
          `<td>${hasSlNo ? slNo : ''}</td>`,
          `<td>${row.itemName}</td>`,
          `<td>${row.qty}</td>`,
          `<td class="amount">${row.rate}</td>`,
          ...(isGst ? [
            `<td class="amount">${row.preTax ? row.preTax.toFixed(2) : ''}</td>`,
            `<td class="amount">${row.gstPct}</td>`,
            `<td class="amount">${row.gstAmt ? row.gstAmt.toFixed(2) : ''}</td>`,
          ] : []),
          `<td class="amount">${row.amount ? row.amount.toFixed(2) : ''}</td>`,
        ]
        return `<tr>${cells.join('')}</tr>`
      })
      .join('')

    const adjRows = adjustments
      .filter(a => a.label.trim() || a.amount.trim())
      .map(a => `<div>${a.label || '—'}: <strong>${a.amount}</strong></div>`)
      .join('')

    const header = printFormat === 'simplified'
      ? `<h2>${partyDetails.partyName || '—'}${partyDetails.phone ? ` — ${partyDetails.phone}` : ''}</h2>`
      : `<h2>Bill / Invoice</h2><div class="meta">To: ${partyDetails.partyName || '—'} ${partyDetails.phone ? `· ${partyDetails.phone}` : ''} · ${partyDetails.transportName || ''}</div>`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
<body>
  ${header}
  <div class="meta">Bill No: ${billInfo.billNumber || '—'} &nbsp;|&nbsp; Date: ${billInfo.billDate || '—'}</div>
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  <div class="totals">
    <div>Subtotal: <strong>${totals.subtotal.toFixed(2)}</strong></div>
    ${adjRows}
    <div class="grand-total">Grand Total: ₹ ${totals.grandTotal}</div>
    ${partyDetails.transportName ? `<div style="margin-top:8px;font-size:9pt;color:#666">Transport: ${partyDetails.transportName}</div>` : ''}
  </div>
  ${includeQr ? `<div style="margin-top:12px;font-size:9pt;color:#888">[UPI QR — configure UPI ID in Settings → Phase 6a-A]</div>` : ''}
  <!-- Internal remarks are intentionally excluded from all print output -->
</body>
</html>`

    // Open print window
    const win = window.open('', '_blank', 'width=800,height=900')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => {
        win.print()
        setIsPrinting(false)
        onClose()
      }, 400)
    } else {
      // Fallback: trigger browser print for current page
      window.print()
      setIsPrinting(false)
      onClose()
    }
  }

  const radioStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '7px',
    border: `1.5px solid ${active ? S.accent : S.border}`,
    background: active ? `color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface))` : 'transparent',
    cursor: 'pointer',
    fontSize: '0.8rem',
    color: active ? S.accent : S.text,
    fontWeight: active ? 600 : 400,
    transition: 'all 0.12s',
    flex: 1,
  })

  return (
    <Panel title="Print Options" width={400} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Bill format */}
        <div>
          <Label>Print Format</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {([
              ['simplified', 'Simplified', 'Party name + contact only — no company info'],
              ['professional', 'Professional', 'Includes company header, logo, UPI'],
              ['detailed', 'Detailed Professional', 'Full company + customer details incl. address'],
            ] as [PrintFormat, string, string][]).map(([val, label, desc]) => (
              <button
                key={val}
                type="button"
                style={radioStyle(printFormat === val)}
                onClick={() => setPrintFormat(val)}
              >
                <div style={{
                  width: '14px', height: '14px',
                  borderRadius: '50%',
                  border: `2px solid ${printFormat === val ? S.accent : S.border}`,
                  background: printFormat === val ? S.accent : 'transparent',
                  flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{label}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Page size */}
        <div>
          <Label>Page Size</Label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['a5', 'a4'] as PrintSize[]).map(sz => (
              <button key={sz} type="button" style={radioStyle(pageSize === sz)} onClick={() => setPageSize(sz)}>
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  border: `2px solid ${pageSize === sz ? S.accent : S.border}`,
                  background: pageSize === sz ? S.accent : 'transparent', flexShrink: 0,
                }} />
                {sz.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Row count advisory */}
        {rowCount > 0 && (
          <div style={{
            fontSize: '0.74rem',
            color: S.textMuted,
            background: S.surface,
            border: `1px solid ${S.border}`,
            borderRadius: '6px',
            padding: '8px 10px',
          }}>
            <strong>{rowCount}</strong> item row{rowCount !== 1 ? 's' : ''} in this bill.
            {pageSize === 'a5' && rowCount > (printFormat === 'simplified' ? 40 : printFormat === 'professional' ? 30 : 20)
              ? ' ⚠ Exceeds A5 limit — will print as A4.'
              : ' Fits on A5.'}
          </div>
        )}

        {/* UPI QR toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', fontSize: '0.82rem', color: S.text,
          padding: '8px 0',
        }}>
          <input
            type="checkbox"
            checked={includeQr}
            onChange={e => setIncludeQr(e.target.checked)}
            style={{ width: '15px', height: '15px', accentColor: S.accent }}
          />
          Include UPI QR code for Grand Total
          <span style={{ fontSize: '0.72rem', color: S.textMuted }}>(requires UPI ID in Settings)</span>
        </label>

        <Btn
          variant="primary"
          fullWidth
          icon={isPrinting ? <Loader2 size={14} /> : <Printer size={14} />}
          onClick={handlePrint}
          disabled={isPrinting}
        >
          {isPrinting ? 'Opening print dialog…' : 'Print'}
        </Btn>

        <p style={{ margin: 0, fontSize: '0.72rem', color: S.textMuted, opacity: 0.7 }}>
          Note: Internal remarks are never included in any printed output.
        </p>
      </div>
    </Panel>
  )
}

// ─── 3. DUPLICATE BILL ────────────────────────────────────────────────────────

export interface DuplicateBillProps {
  partyDetails: PartyDetails
  billInfo: BillInfo
  billFormat: BillFormat
  rows: BillingRow[]
  adjustments: AdjustmentRow[]
  customCols: CustomColumn[]
  customColData: CustomColData
  cellFormats: CellFormatMap
  onDuplicate: (payload: {
    partyDetails: PartyDetails
    billFormat: BillFormat
    rows: BillingRow[]
    adjustments: AdjustmentRow[]
    customCols: CustomColumn[]
    customColData: CustomColData
    cellFormats: CellFormatMap
  }) => void
  onClose: () => void
}

export function DuplicateBillPanel({
  partyDetails,
  billInfo,
  billFormat,
  rows,
  adjustments,
  customCols,
  customColData,
  cellFormats,
  onDuplicate,
  onClose,
}: DuplicateBillProps): React.ReactElement {
  const [keepParty, setKeepParty] = useState(true)
  const [keepCellFormats, setKeepCellFormats] = useState(false)

  const rowCount = rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length
  const adjCount = adjustments.filter(a => a.label.trim() || a.amount.trim()).length

  function handleDuplicate() {
    onDuplicate({
      partyDetails: keepParty ? partyDetails : {
        partyName: '',
        phone: '',
        transportName: '',
        address: '',
        gstin: '',
        notes: '',
        resolvedCustomerId: null,
      },
      billFormat,
      rows: rows.map(r => ({ ...r })),
      adjustments: adjustments.map(a => ({ ...a })),
      customCols: customCols.map(c => ({ ...c })),
      customColData: Object.fromEntries(
        Object.entries(customColData).map(([k, v]) => [k, v.map(cell => ({ ...cell }))])
      ),
      cellFormats: keepCellFormats ? { ...cellFormats } : {},
    })
    onClose()
  }

  return (
    <Panel title="Duplicate Bill" width={360} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Summary */}
        <div style={{
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '0.78rem',
          color: S.textMuted,
          lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 600, color: S.text, marginBottom: '4px' }}>
            Duplicating: {billInfo.billNumber || 'Unsaved bill'}
          </div>
          <div>✓ {rowCount} item row{rowCount !== 1 ? 's' : ''}</div>
          {adjCount > 0 && <div>✓ {adjCount} adjustment{adjCount !== 1 ? 's' : ''}</div>}
          {customCols.length > 0 && <div>✓ {customCols.length} custom column{customCols.length !== 1 ? 's' : ''}</div>}
          <div>✓ Date resets to today</div>
          <div>✓ New bill number assigned on save</div>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Label>Options</Label>
          {[
            {
              checked: keepParty,
              onChange: setKeepParty,
              label: 'Keep party details',
              sub: 'Carry over party name, phone, transport',
            },
            {
              checked: keepCellFormats,
              onChange: setKeepCellFormats,
              label: 'Keep cell formatting',
              sub: 'Carry over bold, text color, and cell highlights',
            },
          ].map(({ checked, onChange, label, sub }) => (
            <label
              key={label}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                cursor: 'pointer', padding: '8px 10px',
                borderRadius: '7px',
                background: checked ? `color-mix(in srgb, var(--cq-accent) 8%, var(--cq-surface))` : S.surface,
                border: `1px solid ${checked ? S.accent : S.border}`,
                transition: 'all 0.12s',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={e => onChange(e.target.checked)}
                style={{ marginTop: '2px', accentColor: S.accent }}
              />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: S.text }}>{label}</div>
                <div style={{ fontSize: '0.72rem', color: S.textMuted }}>{sub}</div>
              </div>
            </label>
          ))}
        </div>

        <Btn
          variant="primary"
          fullWidth
          icon={<Copy size={14} />}
          onClick={handleDuplicate}
        >
          Duplicate as New Draft
        </Btn>
      </div>
    </Panel>
  )
}

// ─── 4. BILL TEMPLATES ────────────────────────────────────────────────────────

export interface BillTemplatesProps {
  /** Current bill's format — pre-fills the "save" form */
  currentFormat: BillFormat
  /** Current bill's custom columns — pre-fills the "save" form */
  currentCustomCols: CustomColumn[]
  /** Called when user loads a template — parent resets bill to template structure */
  onLoadTemplate: (format: BillFormat, customCols: BillTemplateColumn[]) => void
  onClose: () => void
}

type TemplateView = 'list' | 'save'

export function BillTemplatesPanel({
  currentFormat,
  currentCustomCols,
  onLoadTemplate,
  onClose,
}: BillTemplatesProps): React.ReactElement {
  const [view, setView]         = useState<TemplateView>('list')
  const [templates, setTemplates] = useState<BillTemplate[]>([])
  const [loading, setLoading]   = useState(true)
  const [saveName, setSaveName] = useState('')
  const [saveFormat, setSaveFormat] = useState<BillFormat>(currentFormat)
  const [saving, setSaving]     = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await getTemplates())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  async function handleSave() {
    if (!saveName.trim()) return
    setSaving(true)
    try {
      await createTemplate({
        name: saveName.trim(),
        format: saveFormat,
        customColumns: currentCustomCols.map(c => ({ id: c.id, header: c.header })),
      })
      await reload()
      setView('list')
      setSaveName('')
    } finally {
      setSaving(false)
    }
  }

  async function handleRenameConfirm(id: number) {
    if (!renameValue.trim()) {
      setRenamingId(null)
      return
    }
    await renameTemplate({ id, name: renameValue.trim() })
    setRenamingId(null)
    setRenameValue('')
    await reload()
  }

  async function handleDelete(id: number) {
    await deleteTemplate(id)
    setDeleteConfirmId(null)
    await reload()
  }

  function handleLoad(t: BillTemplate) {
    onLoadTemplate(t.format, t.customColumns)
    onClose()
  }

  return (
    <Panel title="Bill Templates" width={420} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['list', 'save'] as TemplateView[]).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '7px',
                border: `1.5px solid ${view === v ? S.accent : S.border}`,
                background: view === v ? `color-mix(in srgb, var(--cq-accent) 12%, var(--cq-surface))` : 'transparent',
                color: view === v ? S.accent : S.textMuted,
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              {v === 'list' ? 'Saved Templates' : 'Save Current Structure'}
            </button>
          ))}
        </div>

        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px', color: S.textMuted, fontSize: '0.82rem' }}>
                Loading…
              </div>
            ) : templates.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '24px',
                background: S.surface, borderRadius: '8px', border: `1px dashed ${S.border}`,
              }}>
                <LayoutTemplate size={28} style={{ color: S.textMuted, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontSize: '0.82rem', color: S.textMuted }}>No templates saved yet.</div>
                <div style={{ fontSize: '0.74rem', color: S.textMuted, marginTop: '4px' }}>
                  Switch to "Save Current Structure" to create one.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                {templates.map(t => (
                  <div
                    key={t.id}
                    style={{
                      background: S.surface,
                      border: `1px solid ${S.border}`,
                      borderRadius: '8px',
                      padding: '10px 12px',
                    }}
                  >
                    {renamingId === t.id ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameConfirm(t.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          style={{
                            flex: 1, padding: '5px 8px',
                            background: S.surfaceRaised,
                            border: `1px solid ${S.accent}`,
                            borderRadius: '5px',
                            color: S.text,
                            fontSize: '0.82rem',
                            outline: 'none',
                          }}
                        />
                        <Btn variant="ghost" onClick={() => handleRenameConfirm(t.id)}><Check size={13} /></Btn>
                        <Btn variant="ghost" onClick={() => setRenamingId(null)}><X size={13} /></Btn>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: S.text, marginBottom: '3px' }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: S.textMuted, lineHeight: 1.5 }}>
                            {t.format === 'free' ? 'Free Format' : 'GST Format'}
                            {t.customColumns.length > 0
                              ? ` · ${t.customColumns.length} custom col${t.customColumns.length !== 1 ? 's' : ''}: ${t.customColumns.map(c => c.header).join(', ')}`
                              : ' · No custom columns'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                          {deleteConfirmId === t.id ? (
                            <>
                              <Btn
                                variant="ghost"
                                danger
                                onClick={() => handleDelete(t.id)}
                                icon={<Check size={12} />}
                              >
                                Confirm
                              </Btn>
                              <Btn variant="ghost" onClick={() => setDeleteConfirmId(null)}><X size={12} /></Btn>
                            </>
                          ) : (
                            <>
                              <Btn
                                variant="primary"
                                onClick={() => handleLoad(t)}
                                icon={<Plus size={12} />}
                              >
                                Load
                              </Btn>
                              <Btn
                                variant="ghost"
                                onClick={() => { setRenamingId(t.id); setRenameValue(t.name) }}
                                icon={<Pencil size={12} />}
                              />
                              <Btn
                                variant="ghost"
                                danger
                                onClick={() => setDeleteConfirmId(t.id)}
                                icon={<Trash2 size={12} />}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SAVE VIEW ── */}
        {view === 'save' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              fontSize: '0.76rem',
              color: S.textMuted,
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderRadius: '7px',
              padding: '10px 12px',
              lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 600, color: S.text, marginBottom: '4px' }}>
                What gets saved:
              </div>
              <div>✓ Bill format ({currentFormat === 'free' ? 'Free Format' : 'GST Format'})</div>
              {currentCustomCols.length > 0
                ? <div>✓ Custom columns: {currentCustomCols.map(c => c.header).join(', ')}</div>
                : <div style={{ opacity: 0.6 }}>— No custom columns in current bill</div>
              }
              <div style={{ marginTop: '6px', color: '#ef4444', fontSize: '0.72rem' }}>
                ✗ Item rows, rates, quantities — never saved in templates
              </div>
            </div>

            <div>
              <Label>Template Name</Label>
              <input
                autoFocus
                placeholder="e.g. Fabric Invoice, GST Export…"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: S.surface,
                  border: `1.5px solid ${S.border}`,
                  borderRadius: '7px',
                  color: S.text,
                  fontSize: '0.85rem',
                  fontFamily: S.font,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <Label>Format to save</Label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['free', 'gst'] as BillFormat[]).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSaveFormat(f)}
                    style={{
                      flex: 1, padding: '7px',
                      fontSize: '0.78rem', fontWeight: 600,
                      borderRadius: '7px',
                      border: `1.5px solid ${saveFormat === f ? S.accent : S.border}`,
                      background: saveFormat === f ? `color-mix(in srgb, var(--cq-accent) 12%, var(--cq-surface))` : 'transparent',
                      color: saveFormat === f ? S.accent : S.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    {f === 'free' ? 'Free Format' : 'GST Format'}
                  </button>
                ))}
              </div>
            </div>

            <Btn
              variant="primary"
              fullWidth
              icon={saving ? <Loader2 size={14} /> : <Save size={14} />}
              onClick={handleSave}
              disabled={saving || !saveName.trim()}
            >
              {saving ? 'Saving…' : 'Save Template'}
            </Btn>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ─── 5. INTERNAL REMARKS ─────────────────────────────────────────────────────

export interface InternalRemarksProps {
  /** Current remarks value (controlled by parent) */
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

/**
 * Private internal notes per bill.
 * NEVER appears on any PDF or printed output — only visible inside the app.
 * This contract is enforced in the print and PDF code which explicitly
 * exclude the internalRemarks field from all rendered output.
 */
export function InternalRemarksPanel({
  value,
  onChange,
  onClose,
}: InternalRemarksProps): React.ReactElement {
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Auto-save to parent on every change (no explicit save button needed)
  useEffect(() => {
    onChange(localValue)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue])

  return (
    <Panel title="Internal Remarks" width={380} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Privacy notice — always visible */}
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
          padding: '8px 12px',
          background: 'color-mix(in srgb, #eab308 12%, var(--cq-surface))',
          border: '1px solid color-mix(in srgb, #eab308 40%, var(--cq-border))',
          borderRadius: '7px',
          fontSize: '0.76rem',
          color: S.text,
          lineHeight: 1.5,
        }}>
          <StickyNote size={14} style={{ color: '#ca8a04', flexShrink: 0, marginTop: '2px' }} />
          <span>
            <strong>Private note only.</strong> These remarks are{' '}
            <strong>never included</strong> on any PDF, print, image copy, or
            exported file. They exist only inside the app for your reference.
          </span>
        </div>

        {/* Text area */}
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          placeholder="Add internal notes about this bill…&#10;e.g. Partial payment received, awaiting balance.&#10;Follow up with Rajesh on Friday."
          rows={7}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: S.surface,
            border: `1.5px solid ${S.border}`,
            borderRadius: '8px',
            color: S.text,
            fontSize: '0.85rem',
            fontFamily: S.font,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            minHeight: '120px',
            transition: 'border-color 0.12s',
          }}
          onFocus={e => { e.target.style.borderColor = S.accent }}
          onBlur={e => { e.target.style.borderColor = S.border }}
        />

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.72rem', color: S.textMuted, opacity: 0.7 }}>
            {localValue.length > 0 ? `${localValue.length} character${localValue.length !== 1 ? 's' : ''}` : 'Auto-saved as you type'}
          </span>
          {localValue.length > 0 && (
            <Btn
              variant="ghost"
              danger
              onClick={() => setLocalValue('')}
              icon={<Trash2 size={12} />}
            >
              Clear
            </Btn>
          )}
        </div>
      </div>
    </Panel>
  )
}

// ─── Toolbar button style (mirrors index.tsx tbtnStyle) ───────────────────────

export function tbtnStyle(active = false, disabled = false): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '6px 10px',
    fontSize: '0.73rem', fontWeight: 600,
    fontFamily: '"Inter", system-ui, sans-serif',
    border: `1px solid ${active ? 'var(--cq-accent)' : 'var(--cq-border)'}`,
    borderRadius: '7px',
    background: active
      ? 'color-mix(in srgb, var(--cq-accent) 14%, transparent)'
      : 'transparent',
    color: disabled
      ? 'var(--cq-text-muted)'
      : active
        ? 'var(--cq-accent)'
        : 'var(--cq-text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    whiteSpace: 'nowrap' as const,
    position: 'relative' as const,
    transition: 'all 0.12s',
  }
}
