/**
 * cQikly — PDF Service
 * Phase 6a-A: Simplified PDF format — full implementation.
 * Phase 6b-A-i: Professional PDF format.
 * Phase 6b-A-ii: Detailed Professional PDF format + shared PDF features
 *   (T&C, bank details, UPI QR, PDF format memory per party).
 *
 * Architecture:
 *   - All PDF generation is done in the renderer via HTML string → IPC → main (printToPDF).
 *   - The renderer builds a complete self-contained HTML page and passes it to main.
 *   - Main opens a hidden BrowserWindow, loads the HTML, calls webContents.printToPDF.
 *   - Result is saved to a configurable path (or returned as buffer for copy-image).
 *
 * Hard Specs referenced:
 *   #8  — Simplified format: zero company info; header = "{Name} - {Contact}" only.
 *   #15 — Page split logic per format:
 *         Simplified:           A5 ≤40 → A4 ≤80 → multi-page A4.
 *         Professional:         A5 ≤30 → A4 ≤60 → multi-page A4.
 *         Detailed Professional: A5 ≤20 → A4 ≤40 → multi-page A4.
 *
 * PDF filename pattern default: {PartyName}_{Date}_{PONo}.pdf
 * Save location: configurable from Settings (falls back to Downloads).
 * DRAFT watermark: shown for unsaved bills (Settings toggle — default on).
 */

import type { BillingRow, AdjustmentRow, CustomColumn, CustomColData, CellFormatMap } from '../pages/NewQuote/billingGrid.types'
import { calcSlNos, parseNum } from '../pages/NewQuote/billingGrid.types'
import type { BillFormat } from '../pages/NewQuote/billingGrid.types'
import { buildSharedPdfFooter, SHARED_PDF_FOOTER_CSS } from './pdfSettings.service'

export type PdfFormat = 'simplified' | 'professional' | 'detailed-professional'
export type PdfPageSize = 'A5' | 'A4'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimplifiedPdfInput {
  /** Party name — appears in header */
  partyName: string
  /** Party contact (phone) — appears in header */
  partyContact?: string
  /** Transport name — shown in footer row */
  transportName?: string
  /** Bill date (ISO) */
  billDate: string
  /** PO / bill number */
  billNumber?: string
  /** Bill format (free / gst) */
  billFormat: BillFormat
  /** All rows (empty rows will be skipped in PDF) */
  rows: BillingRow[]
  /** Adjustments below subtotal */
  adjustments: AdjustmentRow[]
  /** Subtotal */
  subtotal: number
  /** Grand total (will be silently rounded) */
  grandTotal: number
  /** Custom columns — included in Free format (up to 4); excluded from GST format */
  customCols?: CustomColumn[]
  /** Custom column cell data */
  customColData?: CustomColData
  /** Per-cell formatting (colors, bold) */
  cellFormats?: CellFormatMap
  /** True = render DRAFT watermark across PDF */
  isDraft?: boolean
  /** Configurable save path (folder); null = show OS dialog */
  saveFolderPath?: string | null
  /** Filename pattern. Tokens: {PartyName} {Date} {PONo} */
  filenamePattern?: string
  /** True = include UPI QR code in footer (prompted at print time) */
  includeUpiQr?: boolean
}

export interface PdfSaveResult {
  /** Full path where PDF was saved */
  savedPath: string | null
  /** True if user cancelled the save dialog */
  cancelled?: boolean
}

// ─── Page-size decision (Hard Spec #15) ──────────────────────────────────────

/**
 * Decide page size for Simplified format.
 * A5 → up to 40 item rows.
 * A4 single page → up to 80 item rows.
 * Multi-page A4 → any number beyond 80 (split handled in HTML via page-break-inside).
 */
export function decideSimplifiedPageSize(rowCount: number): { size: PdfPageSize; multiPage: boolean } {
  if (rowCount <= 40) return { size: 'A5', multiPage: false }
  if (rowCount <= 80) return { size: 'A4', multiPage: false }
  return { size: 'A4', multiPage: true }
}

// ─── Filename builder ─────────────────────────────────────────────────────────

export function buildPdfFilename(
  pattern: string,
  partyName: string,
  date: string,
  poNo: string,
): string {
  const safeName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Bill'
  return pattern
    .replace(/{PartyName}/gi, safeName(partyName))
    .replace(/{Date}/gi, date.replace(/-/g, ''))
    .replace(/{PONo}/gi, safeName(poNo))
}

// ─── HTML Bill Generator — Simplified Format ──────────────────────────────────

/**
 * Generates a complete HTML string that renders as the Simplified PDF.
 *
 * Design rules:
 *   - Header: "{PartyName} - {Contact}" bold black, no company info
 *   - Table: simple Excel-like, Free Format includes ≤4 custom cols, GST excludes custom cols
 *   - Empty rows skipped
 *   - Long names wrap, never truncate
 *   - Sl.No auto-numbered (only rows with item + qty or rate)
 *   - Totals (subtotal, adjustments, grand total) at bottom — on last page only
 *   - Footer row: transport name after totals
 *   - Headers repeat on each page (CSS print-friendly thead)
 *   - Grand total silently rounded to nearest integer
 *   - DRAFT watermark when isDraft = true
 */
export function buildSimplifiedPdfHtml(input: SimplifiedPdfInput): string {
  const {
    partyName, partyContact, transportName,
    billDate, billNumber, billFormat,
    rows, adjustments, subtotal, grandTotal,
    customCols = [], customColData = {},
    cellFormats = {},
    isDraft = false,
    includeUpiQr = false,
  } = input

  // Filter empty rows (skip if itemName empty AND qty/rate empty)
  const filledRows = rows.filter(r =>
    r.itemName.trim() !== '' || r.qty.trim() !== '' || r.rate.trim() !== ''
  )

  // Sl.No calculation on filled rows only
  const slNos = calcSlNos(filledRows)

  // Custom cols: Free format includes up to 4; GST excludes all
  const visibleCustomCols = billFormat === 'free'
    ? customCols.slice(0, 4)
    : []

  // Page size decision based on filled row count
  const { size } = decideSimplifiedPageSize(filledRows.length)

  // Grand total rounded (Hard Spec #9.3)
  const roundedGrandTotal = Math.round(grandTotal)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fmtNum(n: number): string {
    if (!Number.isFinite(n) || n === 0) return ''
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }

  function fmtTotal(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  function cellStyle(rowId: string, col: string): string {
    const key = `${rowId}:${col}`
    const fmt = cellFormats[key]
    if (!fmt) return ''
    const parts: string[] = []
    if (fmt.bold) parts.push('font-weight:700')
    if (fmt.textColor) parts.push(`color:${fmt.textColor}`)
    if (fmt.bgColor) parts.push(`background:${fmt.bgColor}`)
    return parts.join(';')
  }

  function customCellStyle(colId: string, rowId: string): string {
    const key = `custom:${colId}:${rowId}`
    const fmt = cellFormats[key]
    if (!fmt) return ''
    const parts: string[] = []
    if (fmt.bold) parts.push('font-weight:700')
    if (fmt.textColor) parts.push(`color:${fmt.textColor}`)
    if (fmt.bgColor) parts.push(`background:${fmt.bgColor}`)
    return parts.join(';')
  }

  // ── Page dimensions ────────────────────────────────────────────────────────
  // A5 = 148×210mm, A4 = 210×297mm
  const pageW = size === 'A5' ? '148mm' : '210mm'
  const bodyFontSize = size === 'A5' ? '7.5pt' : '8.5pt'
  const headerFontSize = size === 'A5' ? '11pt' : '13pt'

  // ── Column headers ─────────────────────────────────────────────────────────
  const gstFormat = billFormat === 'gst'

  // ── Table rows HTML ────────────────────────────────────────────────────────
  let rowsHtml = ''
  for (let i = 0; i < filledRows.length; i++) {
    const row = filledRows[i]
    const slNo = slNos[i]
    const rowOrigIdx = rows.indexOf(row) // for original index ref (not needed for PDF, use i)

    // Find custom col data for this row (aligned by original row index in `rows` array)
    const origIdx = rows.findIndex(r => r.id === row.id)

    const itemStyle = cellStyle(row.id, 'itemName')
    const qtyStyle = cellStyle(row.id, 'qty')
    const rateStyle = cellStyle(row.id, 'rate')
    const amtStyle = cellStyle(row.id, 'amount')

    rowsHtml += `
      <tr>
        <td class="tc sl" style="${cellStyle(row.id, 'slNo')}">${slNo > 0 ? slNo : ''}</td>
        <td class="tl wrap" style="${itemStyle}">${esc(row.itemName)}</td>
        <td class="tc" style="${qtyStyle}">${esc(row.qty)}${row.qtyUnit ? ' ' + esc(row.qtyUnit) : ''}</td>
        <td class="tr" style="${rateStyle}">${fmtNum(parseNum(row.rate))}</td>
        ${gstFormat ? `
          <td class="tr">${fmtNum(row.preTax)}</td>
          <td class="tc">${esc(row.gstPct)}</td>
          <td class="tr">${fmtNum(row.gstAmt)}</td>
        ` : ''}
        <td class="tr bold" style="${amtStyle}">${fmtNum(row.amount)}</td>
        ${visibleCustomCols.map(col => {
          const cell = (customColData[col.id] ?? [])[origIdx]
          const val = cell?.value ?? ''
          const isMarked = cell?.marked ?? false
          const cs = customCellStyle(col.id, row.id)
          return `<td class="tc${isMarked ? ' marked-cell' : ''}" style="${cs}">${esc(val)}</td>`
        }).join('')}
      </tr>`
    void rowOrigIdx
  }

  // ── Totals block ───────────────────────────────────────────────────────────
  const totalColSpan = gstFormat
    ? 4 + visibleCustomCols.length  // Sl + Name + Qty + Rate + PreTax + GST% + GSTAmt = 7; Amount = last
    : 3 + visibleCustomCols.length  // Sl + Name + Qty + Rate = 4; Amount = last

  const hasAdjustments = adjustments.some(a => a.label.trim() || a.amount.trim())

  let totalsHtml = ''
  // Subtotal row (only if there are adjustments)
  if (hasAdjustments) {
    totalsHtml += `
      <tr class="total-row">
        <td colspan="${totalColSpan + 1 + (gstFormat ? 3 : 0)}" class="tr total-label">Subtotal</td>
        <td class="tr bold">${fmtTotal(subtotal)}</td>
        ${visibleCustomCols.map(() => '<td></td>').join('')}
      </tr>`
    // Adjustment rows
    for (const adj of adjustments) {
      if (!adj.label.trim() && !adj.amount.trim()) continue
      const adjAmt = parseNum(adj.amount)
      totalsHtml += `
        <tr class="adj-row">
          <td colspan="${totalColSpan + 1 + (gstFormat ? 3 : 0)}" class="tr adj-label">${esc(adj.label || '—')}</td>
          <td class="tr ${adjAmt < 0 ? 'neg' : ''}">${adjAmt < 0 ? '−' : ''}${fmtTotal(Math.abs(adjAmt))}</td>
          ${visibleCustomCols.map(() => '<td></td>').join('')}
        </tr>`
    }
  }

  // Grand total row
  totalsHtml += `
    <tr class="grand-total-row">
      <td colspan="${totalColSpan + 1 + (gstFormat ? 3 : 0)}" class="tr grand-label">Grand Total</td>
      <td class="tr grand-value">${fmtTotal(roundedGrandTotal)}</td>
      ${visibleCustomCols.map(() => '<td></td>').join('')}
    </tr>`

  // Transport footer row
  if (transportName?.trim()) {
    totalsHtml += `
      <tr class="transport-row">
        <td colspan="${2 + (gstFormat ? 3 : 0) + visibleCustomCols.length + (gstFormat ? 4 : 4)}" class="tl transport-label">
          Transport: <strong>${esc(transportName)}</strong>
        </td>
      </tr>`
  }

  // ── More-than-4-custom-cols warning ────────────────────────────────────────
  const extraColsWarning = (billFormat === 'free' && customCols.length > 4)
    ? `<div class="warning-banner">⚠ This bill has ${customCols.length} custom columns — only first 4 are shown. Switch to A4 for all columns (see print settings).</div>`
    : ''

  // ── Draft watermark overlay ────────────────────────────────────────────────
  const draftWatermark = isDraft
    ? `<div class="draft-watermark">DRAFT</div>`
    : ''

  // ── Build <thead> HTML (repeated on each page) ─────────────────────────────
  const theadHtml = `
    <thead>
      <tr class="col-header">
        <th class="tc sl">Sl.</th>
        <th class="tl">Item</th>
        <th class="tc">Qty</th>
        <th class="tr">Rate</th>
        ${gstFormat ? `
          <th class="tr">Pre-Tax</th>
          <th class="tc">GST%</th>
          <th class="tr">GST Amt</th>
        ` : ''}
        <th class="tr">Amount</th>
        ${visibleCustomCols.map(col => `<th class="tc">${esc(col.header)}</th>`).join('')}
      </tr>
    </thead>`

  // ── Assemble full HTML ─────────────────────────────────────────────────────
  const formattedDate = new Date(billDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bill — ${esc(partyName)}</title>
<style>
  /* ── Reset & base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Arial', sans-serif;
    font-size: ${bodyFontSize};
    color: #111;
    background: #fff;
    width: ${pageW};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page setup ── */
  @page {
    size: ${size};
    margin: 8mm 10mm 8mm 10mm;
  }

  /* ── Wrapper ── */
  .page-wrap {
    width: 100%;
    position: relative;
    padding: 6mm 8mm;
  }

  /* ── Header ── */
  .bill-header {
    margin-bottom: 4mm;
    border-bottom: 2px solid #111;
    padding-bottom: 2mm;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .header-name {
    font-size: ${headerFontSize};
    font-weight: 700;
    color: #111;
    line-height: 1.2;
  }
  .header-meta {
    font-size: ${bodyFontSize};
    color: #444;
    text-align: right;
    line-height: 1.5;
  }

  /* ── Warning banner ── */
  .warning-banner {
    background: #fff3cd;
    border: 1px solid #ffc107;
    padding: 2mm 3mm;
    font-size: 7pt;
    color: #856404;
    margin-bottom: 3mm;
    border-radius: 2px;
  }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
  }
  th, td {
    border: 0.5px solid #bbb;
    padding: 1.5mm 2mm;
    vertical-align: top;
    word-break: break-word;
    white-space: normal;
  }
  thead { display: table-header-group; }
  .col-header th {
    background: #1a1a2e;
    color: #fff;
    font-weight: 700;
    font-size: ${bodyFontSize};
    white-space: nowrap;
  }

  /* ── Alignment helpers ── */
  .tl  { text-align: left; }
  .tc  { text-align: center; }
  .tr  { text-align: right; }
  .wrap { word-break: break-word; min-width: 30mm; }
  .bold { font-weight: 700; }
  .sl { width: 6mm; min-width: 6mm; max-width: 8mm; }
  .neg { color: #c00; }

  /* ── Marked cells (custom col group headers) ── */
  .marked-cell {
    background: #e8f0fe;
    font-weight: 700;
    font-style: italic;
    color: #1a56db;
    border-top: 1.5px solid #1a56db;
  }

  /* ── Total rows ── */
  .total-row td    { background: #f5f5f5; font-size: ${bodyFontSize}; border-top: 1px solid #888; }
  .adj-row td      { font-size: ${bodyFontSize}; }
  .total-label     { font-weight: 600; }
  .adj-label       { font-style: italic; color: #444; }
  .grand-total-row td { background: #1a1a2e; color: #fff; font-weight: 700; border-top: 2px solid #000; }
  .grand-label     { font-weight: 700; font-size: 9pt; }
  .grand-value     { font-weight: 700; font-size: 9pt; }
  .transport-row td { background: #f0f4ff; font-size: ${bodyFontSize}; border-top: 1px dashed #888; color: #333; }
  .transport-label { padding: 1.5mm 2mm; }

  /* ── Page breaks for multi-page ── */
  tbody tr { page-break-inside: avoid; }

  /* ── DRAFT watermark ── */
  .draft-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 80pt;
    font-weight: 900;
    color: rgba(200, 30, 30, 0.14);
    pointer-events: none;
    z-index: 9999;
    user-select: none;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }

  /* ── Print media ── */
  @media print {
    html, body { background: #fff; }
    .draft-watermark { position: fixed; }
  }
  ${SHARED_PDF_FOOTER_CSS}
</style>
</head>
<body>
${draftWatermark}
<div class="page-wrap">
  <!-- Bill header: Customer Name - Contact ONLY; zero company info (Hard Spec #8) -->
  <div class="bill-header">
    <div>
      <div class="header-name">${esc(partyName)}${partyContact?.trim() ? ` — ${esc(partyContact)}` : ''}</div>
    </div>
    <div class="header-meta">
      ${billNumber ? `<div><strong>Bill #:</strong> ${esc(billNumber)}</div>` : ''}
      <div><strong>Date:</strong> ${formattedDate}</div>
    </div>
  </div>

  ${extraColsWarning}

  <!-- Billing table -->
  <table>
    ${theadHtml}
    <tbody>
      ${rowsHtml}
    </tbody>
    <!-- Totals: only visible on last page via natural flow -->
    <tfoot>
      ${totalsHtml}
    </tfoot>
  </table>

  <!-- Shared footer: T&C + Bank Details + UPI QR -->
  ${buildSharedPdfFooter({ format: 'simplified', grandTotal: roundedGrandTotal, includeQr: includeUpiQr })}
</div>
</body>
</html>`
}

// ─── HTML escape helper ───────────────────────────────────────────────────────

function esc(s: string | undefined | null): string {
  if (!s) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── IPC layer — generate & save PDF ─────────────────────────────────────────

function getIpc(): Window['cqikly'] | null {
  if (typeof window === 'undefined') return null
  return (window as Window).cqikly ?? null
}

const DEFAULT_FILENAME_PATTERN = '{PartyName}_{Date}_{PONo}.pdf'

/**
 * Generate the Simplified PDF and save to disk.
 *
 * Flow:
 *   1. Build HTML string.
 *   2. Send to main via IPC (pdf:generate) with page-size metadata.
 *   3. Main opens hidden BrowserWindow → loads HTML → printToPDF.
 *   4. Main saves to savePath (or shows dialog if null).
 *   5. Returns saved path.
 *
 * In dev/browser mode (no IPC): opens a new window with the HTML for preview.
 */
export async function saveSimplifiedPdf(
  input: SimplifiedPdfInput,
  opts: {
    /** Override save folder path. null = use dialog. */
    saveFolderPath?: string | null
    /** Filename pattern. Default: {PartyName}_{Date}_{PONo}.pdf */
    filenamePattern?: string
    /** True = just show print dialog instead of auto-saving */
    printDialog?: boolean
    /** True = don't save, just return HTML for copy-image */
    htmlOnly?: boolean
  } = {}
): Promise<PdfSaveResult> {
  const html = buildSimplifiedPdfHtml(input)

  if (opts.htmlOnly) {
    // Return early (used by Copy Image path)
    return { savedPath: null }
  }

  const { size } = decideSimplifiedPageSize(
    input.rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length
  )

  const pattern = opts.filenamePattern ?? DEFAULT_FILENAME_PATTERN
  const filename = buildPdfFilename(
    pattern,
    input.partyName,
    input.billDate,
    input.billNumber ?? 'draft'
  )

  const ipc = getIpc()

  if (!ipc) {
    // Dev/browser fallback: open in new window for preview/print
    const win = window.open('', '_blank', 'width=800,height=700,scrollbars=yes')
    if (win) {
      win.document.write(html)
      win.document.close()
      if (opts.printDialog) setTimeout(() => win.print(), 500)
    }
    return { savedPath: null }
  }

  try {
    // 1. Ask main to choose save path if needed
    let savePath: string | null = null

    if (opts.printDialog) {
      // Just trigger print dialog via IPC — don't save
      const savedPath = await ipc.pdf.generate(html, 'simplified', {
        pageSize: size,
        printDialog: true,
        filename,
      })
      return { savedPath: savedPath as string }
    }

    if (opts.saveFolderPath) {
      // Construct full path from folder + filename
      savePath = `${opts.saveFolderPath}\\${filename}`.replace(/\\/g, '\\')
    } else {
      // Show OS save dialog
      savePath = await ipc.pdf.chooseSavePath(filename)
      if (!savePath) return { savedPath: null, cancelled: true }
    }

    // 2. Generate PDF via IPC
    const result = await ipc.pdf.generate(html, 'simplified', {
      pageSize: size,
      savePath,
      filename,
    })

    // 3. Open folder after save
    if (result && typeof result === 'string') {
      const folderPath = (result as string).replace(/[^/\\]*$/, '')
      try { await ipc.app.openFolder(folderPath) } catch { /* non-fatal */ }
    }

    return { savedPath: result as string | null }
  } catch (err) {
    console.error('[PdfService] saveSimplifiedPdf failed:', err)
    throw err
  }
}

/**
 * Generate the Simplified PDF HTML string for quick print (A5 silent).
 * If row count > 40 (A4 required), returns a warning first.
 */
export function getQuickPrintHtml(input: SimplifiedPdfInput): {
  html: string
  requiresA4: boolean
} {
  const filledCount = input.rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length
  const requiresA4 = filledCount > 40
  const html = buildSimplifiedPdfHtml({ ...input, isDraft: false })
  return { html, requiresA4 }
}

// ─── Batch PDF stub (Phase 7) ─────────────────────────────────────────────────
// TODO: [BATCH-PDF] — Phase 7b: generate combined PDF for multiple selected bills from History page.
export async function generateBatchPdf(_billIds: number[], _format: PdfFormat): Promise<string | null> {
  console.warn('[PdfService] Batch PDF generation implemented in Phase 7b')
  return null
}

// ─── Phase 6b-A-i: Professional PDF Format ────────────────────────────────────

/**
 * Decide page size for Professional format.
 * Hard Spec #15: A5 ≤30 rows → A4 single page ≤60 rows → multi-page A4.
 */
export function decideProfessionalPageSize(rowCount: number): { size: PdfPageSize; multiPage: boolean } {
  if (rowCount <= 30) return { size: 'A5', multiPage: false }
  if (rowCount <= 60) return { size: 'A4', multiPage: false }
  return { size: 'A4', multiPage: true }
}

export interface CompanyInfo {
  /** Company / firm name */
  firmName: string
  /** Address (multi-line OK — shown as-is) */
  address?: string
  /** One or more phone numbers, comma-separated or array */
  phones?: string | string[]
  /** Optional local file path or data-URL for logo image */
  logoPath?: string
}

export interface ProfessionalPdfInput extends SimplifiedPdfInput {
  /** Company info sourced from Settings / company profile */
  company: CompanyInfo
  /** PO number (bill number already in parent, but shown in sub-header explicitly) */
  poNumber?: string
  /** True = include UPI QR code in footer (prompted at print time) */
  includeUpiQr?: boolean
}

/**
 * Builds complete HTML for the Professional PDF format.
 *
 * Header block  : company name · address · phone(s) · logo
 * Sub-header    : customer name · contact · transport · PO number
 * Table         : same rules as Simplified (long names wrap, empty rows skipped,
 *                 grand total rounded, custom cols in Free ≤4, excluded from GST)
 * Page size     : A5 ≤30 rows → A4 ≤60 → multi-page A4
 * Headers       : repeat on each page via CSS thead
 * Totals        : only on last page (natural document flow)
 * Optional footer: terms, bank details (stubbed — Phase 6b-A-ii)
 */
export function buildProfessionalPdfHtml(input: ProfessionalPdfInput): string {
  const {
    partyName, partyContact, transportName,
    billDate, billNumber, billFormat,
    rows, adjustments, subtotal, grandTotal,
    customCols = [], customColData = {},
    cellFormats = {},
    isDraft = false,
    company,
    poNumber,
  } = input

  // Filter empty rows
  const filledRows = rows.filter(r =>
    r.itemName.trim() !== '' || r.qty.trim() !== '' || r.rate.trim() !== ''
  )

  const slNos = calcSlNos(filledRows)

  // Custom cols: Free format ≤4; GST excludes all
  const visibleCustomCols = billFormat === 'free'
    ? customCols.slice(0, 4)
    : []

  const { size } = decideProfessionalPageSize(filledRows.length)
  const roundedGrandTotal = Math.round(grandTotal)
  const gstFormat = billFormat === 'gst'

  // Page dimensions
  const pageW          = size === 'A5' ? '148mm' : '210mm'
  const bodyFontSize   = size === 'A5' ? '7.5pt' : '8.5pt'
  const headerFontSize = size === 'A5' ? '13pt' : '15pt'
  const subFontSize    = size === 'A5' ? '8pt'  : '9pt'

  // ── Helpers ────────────────────────────────────────────────────────────
  function fmtNum(n: number): string {
    if (!Number.isFinite(n) || n === 0) return ''
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }
  function fmtTotal(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }
  function cellStyle(rowId: string, col: string): string {
    const fmt = cellFormats[`${rowId}:${col}`]
    if (!fmt) return ''
    const p: string[] = []
    if (fmt.bold)       p.push('font-weight:700')
    if (fmt.textColor)  p.push(`color:${fmt.textColor}`)
    if (fmt.bgColor)    p.push(`background:${fmt.bgColor}`)
    return p.join(';')
  }
  function customCellStyle(colId: string, rowId: string): string {
    const fmt = cellFormats[`custom:${colId}:${rowId}`]
    if (!fmt) return ''
    const p: string[] = []
    if (fmt.bold)       p.push('font-weight:700')
    if (fmt.textColor)  p.push(`color:${fmt.textColor}`)
    if (fmt.bgColor)    p.push(`background:${fmt.bgColor}`)
    return p.join(';')
  }

  // Phone string normalisation
  const phoneStr = Array.isArray(company.phones)
    ? company.phones.join(' · ')
    : (company.phones ?? '')

  // ── Company header block HTML ───────────────────────────────────────────
  // Logo: if logoPath starts with data: or http use as-is; otherwise it's a
  // local file path — Electron file:// protocol handles this in hidden window.
  const logoSrc = company.logoPath
    ? (company.logoPath.startsWith('data:') || company.logoPath.startsWith('http')
        ? company.logoPath
        : `file:///${company.logoPath.replace(/\\/g, '/')}`)
    : null

  const companyHeaderHtml = `
    <div class="company-header">
      <div class="company-left">
        <div class="company-name">${esc(company.firmName)}</div>
        ${company.address?.trim()
          ? `<div class="company-address">${esc(company.address).replace(/\n/g, '<br>')}</div>`
          : ''}
        ${phoneStr.trim()
          ? `<div class="company-phones">📞 ${esc(phoneStr)}</div>`
          : ''}
      </div>
      ${logoSrc
        ? `<div class="company-logo-wrap"><img class="company-logo" src="${logoSrc}" alt="Logo" /></div>`
        : ''}
    </div>`

  // ── Sub-header: customer details ────────────────────────────────────────
  const formattedDate = new Date(billDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const effectivePO = poNumber ?? billNumber ?? ''

  const subHeaderHtml = `
    <div class="sub-header">
      <div class="sub-left">
        <div class="sub-customer">${esc(partyName)}</div>
        ${partyContact?.trim()
          ? `<div class="sub-detail"><span class="sub-lbl">Contact:</span> ${esc(partyContact)}</div>`
          : ''}
        ${transportName?.trim()
          ? `<div class="sub-detail"><span class="sub-lbl">Transport:</span> ${esc(transportName)}</div>`
          : ''}
      </div>
      <div class="sub-right">
        ${effectivePO ? `<div class="sub-detail"><span class="sub-lbl">Bill #:</span> <strong>${esc(effectivePO)}</strong></div>` : ''}
        <div class="sub-detail"><span class="sub-lbl">Date:</span> ${formattedDate}</div>
      </div>
    </div>`

  // ── Table rows ──────────────────────────────────────────────────────────
  let rowsHtml = ''
  for (let i = 0; i < filledRows.length; i++) {
    const row = filledRows[i]
    const slNo = slNos[i]
    const origIdx = rows.findIndex(r => r.id === row.id)

    rowsHtml += `
      <tr>
        <td class="tc sl" style="${cellStyle(row.id, 'slNo')}">${slNo > 0 ? slNo : ''}</td>
        <td class="tl wrap" style="${cellStyle(row.id, 'itemName')}">${esc(row.itemName)}</td>
        <td class="tc" style="${cellStyle(row.id, 'qty')}">${esc(row.qty)}${row.qtyUnit ? ' ' + esc(row.qtyUnit) : ''}</td>
        <td class="tr" style="${cellStyle(row.id, 'rate')}">${fmtNum(parseNum(row.rate))}</td>
        ${gstFormat ? `
          <td class="tr">${fmtNum(row.preTax)}</td>
          <td class="tc">${esc(row.gstPct)}</td>
          <td class="tr">${fmtNum(row.gstAmt)}</td>
        ` : ''}
        <td class="tr bold" style="${cellStyle(row.id, 'amount')}">${fmtNum(row.amount)}</td>
        ${visibleCustomCols.map(col => {
          const cell = (customColData[col.id] ?? [])[origIdx]
          const val = cell?.value ?? ''
          const isMarked = cell?.marked ?? false
          const cs = customCellStyle(col.id, row.id)
          return `<td class="tc${isMarked ? ' marked-cell' : ''}" style="${cs}">${esc(val)}</td>`
        }).join('')}
      </tr>`
  }

  // ── Totals block ────────────────────────────────────────────────────────
  const midColCount = gstFormat ? 3 : 0  // preTax + gst% + gstAmt
  const totalColSpan = 3 + midColCount + visibleCustomCols.length  // sl+item+qty+rate+[gst cols]

  const hasAdjustments = adjustments.some(a => a.label.trim() || a.amount.trim())
  let totalsHtml = ''
  if (hasAdjustments) {
    totalsHtml += `
      <tr class="total-row">
        <td colspan="${totalColSpan + 1}" class="tr total-label">Subtotal</td>
        <td class="tr bold">${fmtTotal(subtotal)}</td>
        ${visibleCustomCols.map(() => '<td></td>').join('')}
      </tr>`
    for (const adj of adjustments) {
      if (!adj.label.trim() && !adj.amount.trim()) continue
      const adjAmt = parseNum(adj.amount)
      totalsHtml += `
        <tr class="adj-row">
          <td colspan="${totalColSpan + 1}" class="tr adj-label">${esc(adj.label || '—')}</td>
          <td class="tr ${adjAmt < 0 ? 'neg' : ''}">${adjAmt < 0 ? '−' : ''}${fmtTotal(Math.abs(adjAmt))}</td>
          ${visibleCustomCols.map(() => '<td></td>').join('')}
        </tr>`
    }
  }

  totalsHtml += `
    <tr class="grand-total-row">
      <td colspan="${totalColSpan + 1}" class="tr grand-label">Grand Total</td>
      <td class="tr grand-value">${fmtTotal(roundedGrandTotal)}</td>
      ${visibleCustomCols.map(() => '<td></td>').join('')}
    </tr>`

  // ── Column headers (repeated per page) ─────────────────────────────────
  const theadHtml = `
    <thead>
      <tr class="col-header">
        <th class="tc sl">Sl.</th>
        <th class="tl">Item</th>
        <th class="tc">Qty</th>
        <th class="tr">Rate</th>
        ${gstFormat ? `
          <th class="tr">Pre-Tax</th>
          <th class="tc">GST%</th>
          <th class="tr">GST Amt</th>
        ` : ''}
        <th class="tr">Amount</th>
        ${visibleCustomCols.map(col => `<th class="tc">${esc(col.header)}</th>`).join('')}
      </tr>
    </thead>`

  // ── Extra-cols warning ──────────────────────────────────────────────────
  const extraColsWarning = (billFormat === 'free' && customCols.length > 4)
    ? `<div class="warning-banner">⚠ ${customCols.length} custom columns — only first 4 shown.</div>`
    : ''

  // ── Draft watermark ─────────────────────────────────────────────────────
  const draftWatermark = isDraft
    ? `<div class="draft-watermark">DRAFT</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bill — ${esc(partyName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Arial', sans-serif;
    font-size: ${bodyFontSize};
    color: #111;
    background: #fff;
    width: ${pageW};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page {
    size: ${size};
    margin: 8mm 10mm 8mm 10mm;
  }
  .page-wrap { width: 100%; position: relative; padding: 4mm 6mm; }

  /* ── Company Header ── */
  .company-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px double #1a1a2e;
    padding-bottom: 3mm;
    margin-bottom: 3mm;
  }
  .company-name {
    font-size: ${headerFontSize};
    font-weight: 800;
    color: #1a1a2e;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .company-address {
    font-size: ${bodyFontSize};
    color: #444;
    margin-top: 1mm;
    line-height: 1.4;
  }
  .company-phones {
    font-size: ${bodyFontSize};
    color: #333;
    margin-top: 1mm;
  }
  .company-logo-wrap {
    flex-shrink: 0;
    margin-left: 4mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .company-logo {
    max-height: ${size === 'A5' ? '14mm' : '18mm'};
    max-width: ${size === 'A5' ? '30mm' : '40mm'};
    object-fit: contain;
  }

  /* ── Sub-header ── */
  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: #f5f7ff;
    border: 1px solid #d0d7f0;
    border-radius: 3px;
    padding: 2mm 3mm;
    margin-bottom: 3mm;
  }
  .sub-customer {
    font-size: ${subFontSize};
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 1mm;
  }
  .sub-detail {
    font-size: ${bodyFontSize};
    color: #333;
    line-height: 1.5;
  }
  .sub-lbl { color: #666; }
  .sub-right { text-align: right; }

  /* ── Warning ── */
  .warning-banner {
    background: #fff3cd; border: 1px solid #ffc107;
    padding: 1.5mm 3mm; font-size: 7pt; color: #856404;
    margin-bottom: 2mm; border-radius: 2px;
  }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  th, td {
    border: 0.5px solid #bbb;
    padding: 1.5mm 2mm;
    vertical-align: top;
    word-break: break-word;
    white-space: normal;
  }
  thead { display: table-header-group; }
  .col-header th {
    background: #1a1a2e;
    color: #fff;
    font-weight: 700;
    font-size: ${bodyFontSize};
    white-space: nowrap;
  }

  /* ── Alignment helpers ── */
  .tl  { text-align: left; }
  .tc  { text-align: center; }
  .tr  { text-align: right; }
  .wrap { word-break: break-word; min-width: 30mm; }
  .bold { font-weight: 700; }
  .sl { width: 6mm; min-width: 6mm; max-width: 8mm; }
  .neg { color: #c00; }
  .marked-cell {
    background: #e8f0fe; font-weight: 700;
    font-style: italic; color: #1a56db;
    border-top: 1.5px solid #1a56db;
  }

  /* ── Totals ── */
  .total-row td    { background: #f5f5f5; font-size: ${bodyFontSize}; border-top: 1px solid #888; }
  .adj-row td      { font-size: ${bodyFontSize}; }
  .total-label     { font-weight: 600; }
  .adj-label       { font-style: italic; color: #444; }
  .grand-total-row td {
    background: #1a1a2e; color: #fff;
    font-weight: 700; border-top: 2px solid #000;
  }
  .grand-label { font-weight: 700; font-size: 9pt; }
  .grand-value { font-weight: 700; font-size: 9pt; }

  /* ── Page breaks ── */
  tbody tr { page-break-inside: avoid; }

  /* ── DRAFT watermark ── */
  .draft-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 80pt; font-weight: 900;
    color: rgba(200, 30, 30, 0.14);
    pointer-events: none; z-index: 9999;
    user-select: none; letter-spacing: 0.1em; white-space: nowrap;
  }
  @media print {
    html, body { background: #fff; }
    .draft-watermark { position: fixed; }
  }
  ${SHARED_PDF_FOOTER_CSS}
</style>
</head>
<body>
${draftWatermark}
<div class="page-wrap">
  ${companyHeaderHtml}
  ${subHeaderHtml}
  ${extraColsWarning}
  <table>
    ${theadHtml}
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      ${totalsHtml}
    </tfoot>
  </table>

  <!-- Shared footer: T&C + Bank Details + UPI QR -->
  ${buildSharedPdfFooter({
    format: 'professional',
    grandTotal: roundedGrandTotal,
    includeQr: (input as ProfessionalPdfInput).includeUpiQr ?? false,
    firmName: company.firmName,
  })}
</div>
</body>
</html>`
}

// ─── IPC: Save Professional PDF ───────────────────────────────────────────────

/**
 * Generate the Professional PDF and save to disk.
 * Flow mirrors saveSimplifiedPdf — builds HTML → IPC → main → printToPDF → save.
 */
export async function saveProfessionalPdf(
  input: ProfessionalPdfInput,
  opts: {
    saveFolderPath?: string | null
    filenamePattern?: string
    printDialog?: boolean
    htmlOnly?: boolean
  } = {}
): Promise<PdfSaveResult> {
  const html = buildProfessionalPdfHtml(input)

  if (opts.htmlOnly) return { savedPath: null }

  const { size } = decideProfessionalPageSize(
    input.rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length
  )

  const pattern = opts.filenamePattern ?? DEFAULT_FILENAME_PATTERN
  const filename = buildPdfFilename(
    pattern,
    input.partyName,
    input.billDate,
    input.billNumber ?? input.poNumber ?? 'draft'
  )

  const ipc = getIpc()

  if (!ipc) {
    const win = window.open('', '_blank', 'width=800,height=700,scrollbars=yes')
    if (win) {
      win.document.write(html)
      win.document.close()
      if (opts.printDialog) setTimeout(() => win.print(), 500)
    }
    return { savedPath: null }
  }

  try {
    if (opts.printDialog) {
      const savedPath = await ipc.pdf.generate(html, 'professional', {
        pageSize: size,
        printDialog: true,
        filename,
      })
      return { savedPath: savedPath as string }
    }

    let savePath: string | null = null
    if (opts.saveFolderPath) {
      savePath = `${opts.saveFolderPath}\\${filename}`
    } else {
      savePath = await ipc.pdf.chooseSavePath(filename)
      if (!savePath) return { savedPath: null, cancelled: true }
    }

    const result = await ipc.pdf.generate(html, 'professional', {
      pageSize: size,
      savePath,
      filename,
    })

    if (result && typeof result === 'string') {
      const folderPath = (result as string).replace(/[^/\\]*$/, '')
      try { await ipc.app.openFolder(folderPath) } catch { /* non-fatal */ }
    }

    return { savedPath: result as string | null }
  } catch (err) {
    console.error('[PdfService] saveProfessionalPdf failed:', err)
    throw err
  }
}

// ─── Phase 6b-A-ii: Detailed Professional PDF Format ─────────────────────────

/**
 * Decide page size for Detailed Professional format.
 * Hard Spec #15: A5 ≤20 rows → A4 single page ≤40 rows → multi-page A4.
 */
export function decideDetailedPageSize(rowCount: number): { size: PdfPageSize; multiPage: boolean } {
  if (rowCount <= 20) return { size: 'A5', multiPage: false }
  if (rowCount <= 40) return { size: 'A4', multiPage: false }
  return { size: 'A4', multiPage: true }
}

/** Customer address and extra fields shown in Detailed Professional header */
export interface CustomerDetailedInfo {
  partyName:       string
  contact?:        string
  address?:        string
  gstin?:          string
  email?:          string
  pincode?:        string
  state?:          string
  panNo?:          string
}

export interface DetailedProfessionalPdfInput extends SimplifiedPdfInput {
  /** Company info (all details) */
  company: CompanyInfo & {
    gstin?:   string
    email?:   string
    website?: string
  }
  /** All customer details including address */
  customerDetails?: CustomerDetailedInfo
  /** PO number */
  poNumber?: string
  /** True = include UPI QR code in footer */
  includeUpiQr?: boolean
}

/**
 * Builds complete HTML for the Detailed Professional PDF format.
 *
 * Header block  : all company details (name · address · phones · GSTIN · logo)
 * Customer block: all customer details (name · contact · address · GSTIN · state)
 * Table         : same rules as Simplified and Professional
 * Page size     : A5 ≤20 rows → A4 ≤40 → multi-page A4
 * Headers       : repeat on each page via CSS thead
 * Totals        : only on last page (natural document flow)
 */
export function buildDetailedProfessionalPdfHtml(input: DetailedProfessionalPdfInput): string {
  const {
    partyName, partyContact, transportName,
    billDate, billNumber, billFormat,
    rows, adjustments, subtotal, grandTotal,
    customCols = [], customColData = {},
    cellFormats = {},
    isDraft = false,
    company,
    customerDetails,
    poNumber,
    includeUpiQr = false,
  } = input

  // Filter empty rows
  const filledRows = rows.filter(r =>
    r.itemName.trim() !== '' || r.qty.trim() !== '' || r.rate.trim() !== ''
  )

  const slNos = calcSlNos(filledRows)

  // Custom cols: Free ≤4; GST excludes all
  const visibleCustomCols = billFormat === 'free'
    ? customCols.slice(0, 4)
    : []

  const { size } = decideDetailedPageSize(filledRows.length)
  const roundedGrandTotal = Math.round(grandTotal)
  const gstFormat = billFormat === 'gst'

  // Page dimensions
  const pageW          = size === 'A5' ? '148mm' : '210mm'
  const bodyFontSize   = size === 'A5' ? '7pt'   : '8pt'
  const headerFontSize = size === 'A5' ? '12pt'  : '14pt'
  const subFontSize    = size === 'A5' ? '7.5pt' : '8.5pt'

  // ── Helpers ────────────────────────────────────────────────────────────
  function fmtNum(n: number): string {
    if (!Number.isFinite(n) || n === 0) return ''
    return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  }
  function fmtTotal(n: number): string {
    return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }
  function cellStyle(rowId: string, col: string): string {
    const fmt = cellFormats[`${rowId}:${col}`]
    if (!fmt) return ''
    const p: string[] = []
    if (fmt.bold)       p.push('font-weight:700')
    if (fmt.textColor)  p.push(`color:${fmt.textColor}`)
    if (fmt.bgColor)    p.push(`background:${fmt.bgColor}`)
    return p.join(';')
  }
  function customCellStyle(colId: string, rowId: string): string {
    const fmt = cellFormats[`custom:${colId}:${rowId}`]
    if (!fmt) return ''
    const p: string[] = []
    if (fmt.bold)       p.push('font-weight:700')
    if (fmt.textColor)  p.push(`color:${fmt.textColor}`)
    if (fmt.bgColor)    p.push(`background:${fmt.bgColor}`)
    return p.join(';')
  }

  const phoneStr = Array.isArray(company.phones)
    ? company.phones.join(' · ')
    : (company.phones ?? '')

  const logoSrc = company.logoPath
    ? (company.logoPath.startsWith('data:') || company.logoPath.startsWith('http')
        ? company.logoPath
        : `file:///${company.logoPath.replace(/\\/g, '/')}`)
    : null

  // ── Company header (full details) ───────────────────────────────────────
  const companyHeaderHtml = `
    <div class="dp-company-header">
      <div class="dp-company-left">
        <div class="dp-company-name">${esc(company.firmName)}</div>
        ${company.address?.trim()
          ? `<div class="dp-company-line">${esc(company.address).replace(/\n/g, '<br>')}</div>`
          : ''}
        ${phoneStr.trim()
          ? `<div class="dp-company-line">📞 ${esc(phoneStr)}</div>`
          : ''}
        ${company.gstin?.trim()
          ? `<div class="dp-company-line">GSTIN: <strong>${esc(company.gstin)}</strong></div>`
          : ''}
        ${company.email?.trim()
          ? `<div class="dp-company-line">✉ ${esc(company.email)}</div>`
          : ''}
        ${company.website?.trim()
          ? `<div class="dp-company-line">🌐 ${esc(company.website)}</div>`
          : ''}
      </div>
      ${logoSrc
        ? `<div class="dp-logo-wrap"><img class="dp-logo" src="${logoSrc}" alt="Logo" /></div>`
        : ''}
    </div>`

  // ── Customer block (all details) ────────────────────────────────────────
  const formattedDate = new Date(billDate).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
  const effectivePO  = poNumber ?? billNumber ?? ''
  // Use customerDetails if provided, otherwise fall back to partyDetails from input
  const custName     = customerDetails?.partyName ?? partyName
  const custContact  = customerDetails?.contact   ?? partyContact
  const custAddress  = customerDetails?.address
  const custGstin    = customerDetails?.gstin
  const custState    = customerDetails?.state
  const custPan      = customerDetails?.panNo

  const customerBlockHtml = `
    <div class="dp-customer-block">
      <div class="dp-customer-left">
        <div class="dp-customer-section-label">Bill To</div>
        <div class="dp-customer-name">${esc(custName)}</div>
        ${custContact?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">Contact:</span> ${esc(custContact)}</div>`
          : ''}
        ${custAddress?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">Address:</span> ${esc(custAddress).replace(/\n/g, '<br>')}</div>`
          : ''}
        ${custGstin?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">GSTIN:</span> ${esc(custGstin)}</div>`
          : ''}
        ${custState?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">State:</span> ${esc(custState)}</div>`
          : ''}
        ${custPan?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">PAN:</span> ${esc(custPan)}</div>`
          : ''}
        ${transportName?.trim()
          ? `<div class="dp-customer-line"><span class="dp-lbl">Transport:</span> ${esc(transportName)}</div>`
          : ''}
      </div>
      <div class="dp-bill-meta">
        <div class="dp-customer-section-label">Bill Details</div>
        ${effectivePO
          ? `<div class="dp-meta-row"><span class="dp-lbl">Bill #:</span> <strong>${esc(effectivePO)}</strong></div>`
          : ''}
        <div class="dp-meta-row"><span class="dp-lbl">Date:</span> ${formattedDate}</div>
      </div>
    </div>`

  // ── Table rows ──────────────────────────────────────────────────────────
  let rowsHtml = ''
  for (let i = 0; i < filledRows.length; i++) {
    const row = filledRows[i]
    const slNo = slNos[i]
    const origIdx = rows.findIndex(r => r.id === row.id)

    rowsHtml += `
      <tr>
        <td class="tc sl" style="${cellStyle(row.id, 'slNo')}">${slNo > 0 ? slNo : ''}</td>
        <td class="tl wrap" style="${cellStyle(row.id, 'itemName')}">${esc(row.itemName)}</td>
        <td class="tc" style="${cellStyle(row.id, 'qty')}">${esc(row.qty)}${row.qtyUnit ? ' ' + esc(row.qtyUnit) : ''}</td>
        <td class="tr" style="${cellStyle(row.id, 'rate')}">${fmtNum(parseNum(row.rate))}</td>
        ${gstFormat ? `
          <td class="tr">${fmtNum(row.preTax)}</td>
          <td class="tc">${esc(row.gstPct)}</td>
          <td class="tr">${fmtNum(row.gstAmt)}</td>
        ` : ''}
        <td class="tr bold" style="${cellStyle(row.id, 'amount')}">${fmtNum(row.amount)}</td>
        ${visibleCustomCols.map(col => {
          const cell = (customColData[col.id] ?? [])[origIdx]
          const val = cell?.value ?? ''
          const isMarked = cell?.marked ?? false
          const cs = customCellStyle(col.id, row.id)
          return `<td class="tc${isMarked ? ' marked-cell' : ''}" style="${cs}">${esc(val)}</td>`
        }).join('')}
      </tr>`
  }

  // ── Totals block ────────────────────────────────────────────────────────
  const midColCount  = gstFormat ? 3 : 0
  const totalColSpan = 3 + midColCount + visibleCustomCols.length

  const hasAdjustments = adjustments.some(a => a.label.trim() || a.amount.trim())
  let totalsHtml = ''
  if (hasAdjustments) {
    totalsHtml += `
      <tr class="total-row">
        <td colspan="${totalColSpan + 1}" class="tr total-label">Subtotal</td>
        <td class="tr bold">${fmtTotal(subtotal)}</td>
        ${visibleCustomCols.map(() => '<td></td>').join('')}
      </tr>`
    for (const adj of adjustments) {
      if (!adj.label.trim() && !adj.amount.trim()) continue
      const adjAmt = parseNum(adj.amount)
      totalsHtml += `
        <tr class="adj-row">
          <td colspan="${totalColSpan + 1}" class="tr adj-label">${esc(adj.label || '—')}</td>
          <td class="tr ${adjAmt < 0 ? 'neg' : ''}">${adjAmt < 0 ? '−' : ''}${fmtTotal(Math.abs(adjAmt))}</td>
          ${visibleCustomCols.map(() => '<td></td>').join('')}
        </tr>`
    }
  }

  totalsHtml += `
    <tr class="grand-total-row">
      <td colspan="${totalColSpan + 1}" class="tr grand-label">Grand Total</td>
      <td class="tr grand-value">${fmtTotal(roundedGrandTotal)}</td>
      ${visibleCustomCols.map(() => '<td></td>').join('')}
    </tr>`

  // ── Column headers ──────────────────────────────────────────────────────
  const theadHtml = `
    <thead>
      <tr class="col-header">
        <th class="tc sl">Sl.</th>
        <th class="tl">Item</th>
        <th class="tc">Qty</th>
        <th class="tr">Rate</th>
        ${gstFormat ? `
          <th class="tr">Pre-Tax</th>
          <th class="tc">GST%</th>
          <th class="tr">GST Amt</th>
        ` : ''}
        <th class="tr">Amount</th>
        ${visibleCustomCols.map(col => `<th class="tc">${esc(col.header)}</th>`).join('')}
      </tr>
    </thead>`

  const extraColsWarning = (billFormat === 'free' && customCols.length > 4)
    ? `<div class="warning-banner">⚠ ${customCols.length} custom columns — only first 4 shown.</div>`
    : ''

  const draftWatermark = isDraft
    ? `<div class="draft-watermark">DRAFT</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bill — ${esc(partyName)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Arial', sans-serif;
    font-size: ${bodyFontSize};
    color: #111;
    background: #fff;
    width: ${pageW};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: ${size}; margin: 7mm 9mm 7mm 9mm; }
  .page-wrap { width: 100%; position: relative; padding: 3mm 5mm; }

  /* ── Detailed Professional — Company Header ── */
  .dp-company-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: #1a1a2e;
    color: #fff;
    padding: 3mm 4mm;
    border-radius: 2px 2px 0 0;
    margin-bottom: 0;
  }
  .dp-company-name {
    font-size: ${headerFontSize};
    font-weight: 800;
    letter-spacing: -0.01em;
    line-height: 1.2;
    margin-bottom: 1.5mm;
  }
  .dp-company-line {
    font-size: ${bodyFontSize};
    color: rgba(255,255,255,0.82);
    line-height: 1.5;
    margin-top: 0.5mm;
  }
  .dp-logo-wrap {
    flex-shrink: 0;
    margin-left: 4mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dp-logo {
    max-height: ${size === 'A5' ? '14mm' : '18mm'};
    max-width:  ${size === 'A5' ? '28mm' : '36mm'};
    object-fit: contain;
    filter: brightness(0) invert(1);
  }

  /* ── Detailed Professional — Customer Block ── */
  .dp-customer-block {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border: 1px solid #1a1a2e;
    border-top: none;
    padding: 2.5mm 4mm;
    margin-bottom: 3mm;
    background: #f8f8ff;
  }
  .dp-customer-section-label {
    font-size: 6pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7c6aab;
    margin-bottom: 1.5mm;
  }
  .dp-customer-name {
    font-size: ${subFontSize};
    font-weight: 800;
    color: #1a1a2e;
    margin-bottom: 1mm;
    line-height: 1.3;
  }
  .dp-customer-line {
    font-size: ${bodyFontSize};
    color: #333;
    line-height: 1.5;
    margin-top: 0.5mm;
  }
  .dp-lbl { color: #777; }
  .dp-bill-meta { text-align: right; }
  .dp-meta-row {
    font-size: ${bodyFontSize};
    color: #333;
    line-height: 1.6;
  }

  /* ── Warning banner ── */
  .warning-banner {
    background: #fff3cd; border: 1px solid #ffc107;
    padding: 1.5mm 3mm; font-size: 7pt; color: #856404;
    margin-bottom: 2mm; border-radius: 2px;
  }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
  th, td {
    border: 0.5px solid #bbb;
    padding: 1.5mm 2mm;
    vertical-align: top;
    word-break: break-word;
    white-space: normal;
  }
  thead { display: table-header-group; }
  .col-header th {
    background: #1a1a2e; color: #fff;
    font-weight: 700; font-size: ${bodyFontSize};
    white-space: nowrap;
  }

  /* ── Alignment helpers ── */
  .tl  { text-align: left; }
  .tc  { text-align: center; }
  .tr  { text-align: right; }
  .wrap { word-break: break-word; min-width: 28mm; }
  .bold { font-weight: 700; }
  .sl { width: 5mm; min-width: 5mm; max-width: 7mm; }
  .neg { color: #c00; }
  .marked-cell { background: #e8f0fe; font-weight: 700; font-style: italic; color: #1a56db; border-top: 1.5px solid #1a56db; }

  /* ── Totals ── */
  .total-row td    { background: #f5f5f5; font-size: ${bodyFontSize}; border-top: 1px solid #888; }
  .adj-row td      { font-size: ${bodyFontSize}; }
  .total-label     { font-weight: 600; }
  .adj-label       { font-style: italic; color: #444; }
  .grand-total-row td { background: #1a1a2e; color: #fff; font-weight: 700; border-top: 2px solid #000; }
  .grand-label     { font-weight: 700; font-size: 8.5pt; }
  .grand-value     { font-weight: 700; font-size: 8.5pt; }

  /* ── Page breaks ── */
  tbody tr { page-break-inside: avoid; }

  /* ── DRAFT watermark ── */
  .draft-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 80pt; font-weight: 900;
    color: rgba(200, 30, 30, 0.14);
    pointer-events: none; z-index: 9999;
    user-select: none; letter-spacing: 0.1em; white-space: nowrap;
  }
  @media print {
    html, body { background: #fff; }
    .draft-watermark { position: fixed; }
  }
  ${SHARED_PDF_FOOTER_CSS}
</style>
</head>
<body>
${draftWatermark}
<div class="page-wrap">
  ${companyHeaderHtml}
  ${customerBlockHtml}
  ${extraColsWarning}
  <table>
    ${theadHtml}
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      ${totalsHtml}
    </tfoot>
  </table>

  <!-- Shared footer: T&C + Bank Details + UPI QR -->
  ${buildSharedPdfFooter({
    format: 'detailed-professional',
    grandTotal: roundedGrandTotal,
    includeQr: includeUpiQr,
    firmName: company.firmName,
  })}
</div>
</body>
</html>`
}

// ─── IPC: Save Detailed Professional PDF ─────────────────────────────────────

/**
 * Generate the Detailed Professional PDF and save to disk.
 */
export async function saveDetailedProfessionalPdf(
  input: DetailedProfessionalPdfInput,
  opts: {
    saveFolderPath?: string | null
    filenamePattern?: string
    printDialog?: boolean
    htmlOnly?: boolean
  } = {}
): Promise<PdfSaveResult> {
  const html = buildDetailedProfessionalPdfHtml(input)

  if (opts.htmlOnly) return { savedPath: null }

  const { size } = decideDetailedPageSize(
    input.rows.filter(r => r.itemName.trim() || r.qty.trim() || r.rate.trim()).length
  )

  const pattern = opts.filenamePattern ?? DEFAULT_FILENAME_PATTERN
  const filename = buildPdfFilename(
    pattern,
    input.partyName,
    input.billDate,
    input.billNumber ?? input.poNumber ?? 'draft'
  )

  const ipc = getIpc()

  if (!ipc) {
    const win = window.open('', '_blank', 'width=800,height=700,scrollbars=yes')
    if (win) {
      win.document.write(html)
      win.document.close()
      if (opts.printDialog) setTimeout(() => win.print(), 500)
    }
    return { savedPath: null }
  }

  try {
    if (opts.printDialog) {
      const savedPath = await ipc.pdf.generate(html, 'detailed-professional' as 'professional', {
        pageSize: size,
        printDialog: true,
        filename,
      })
      return { savedPath: savedPath as string }
    }

    let savePath: string | null = null
    if (opts.saveFolderPath) {
      savePath = `${opts.saveFolderPath}\\${filename}`
    } else {
      savePath = await ipc.pdf.chooseSavePath(filename)
      if (!savePath) return { savedPath: null, cancelled: true }
    }

    const result = await ipc.pdf.generate(html, 'detailed-professional' as 'professional', {
      pageSize: size,
      savePath,
      filename,
    })

    if (result && typeof result === 'string') {
      const folderPath = (result as string).replace(/[^/\\]*$/, '')
      try { await ipc.app.openFolder(folderPath) } catch { /* non-fatal */ }
    }

    return { savedPath: result as string | null }
  } catch (err) {
    console.error('[PdfService] saveDetailedProfessionalPdf failed:', err)
    throw err
  }
}

// ─── Phase 6b-B: Copy Image to Clipboard ─────────────────────────────────────

/**
 * Renders the bill in Professional format, captures as a PNG image,
 * and writes it to the system clipboard — one click, no dialogs.
 *
 * In dev (no Electron): falls back to opening the HTML in a new window
 * and notifying the user that clipboard copy requires Electron.
 *
 * Returns: 'copied' | 'dev-fallback' | 'error'
 */
export async function copyBillAsImage(input: ProfessionalPdfInput): Promise<'copied' | 'dev-fallback' | 'error'> {
  const html = buildProfessionalPdfHtml({ ...input, isDraft: false })
  return _doCopyImage(html)
}

/**
 * Renders the bill in Simplified format, captures as a PNG image,
 * and writes it to the system clipboard — one click, no dialogs.
 *
 * Returns: 'copied' | 'dev-fallback' | 'error'
 */
export async function copyBillAsSimplifiedImage(input: SimplifiedPdfInput): Promise<'copied' | 'dev-fallback' | 'error'> {
  const html = buildSimplifiedPdfHtml({ ...input, isDraft: false })
  return _doCopyImage(html)
}

/** Internal: performs the actual capture + clipboard write. */
async function _doCopyImage(html: string): Promise<'copied' | 'dev-fallback' | 'error'> {
  const ipc = (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null

  if (!ipc) {
    // Dev fallback: open in a new window so developer can see it
    const win = window.open('', '_blank', 'width=800,height=1100')
    if (win) { win.document.write(html); win.document.close() }
    return 'dev-fallback'
  }

  try {
    // Width = 794px (A4/A5 page at 96 dpi — good for bill rendering)
    const base64Png = await ipc.pdf.captureImage(html, { width: 794 })
    if (!base64Png) return 'error'

    const ok = await ipc.pdf.writeClipboardImage(base64Png)
    return ok ? 'copied' : 'error'
  } catch (err) {
    console.error('[PdfService] copyBillAsImage failed:', err)
    return 'error'
  }
}

// ─── Phase 6b-B: Silent Quick Print ──────────────────────────────────────────

/**
 * Prints the Simplified bill silently — no print dialog.
 * Page size is A5 unless the bill needs A4 (> 40 rows).
 *
 * Returns: { printed: true } | { a4Warning: true } when called on first call
 * with A4 rule needed and `warnedAboutA4` is false.
 *
 * Caller must track whether the A4 warning has already been shown:
 *   - First call with A4 rule → returns { a4Warning: true } without printing.
 *   - Second call (user confirmed) → proceeds and returns { printed: true }.
 */
export async function quickPrintSilent(
  input: SimplifiedPdfInput,
  opts: { alreadyWarnedA4: boolean }
): Promise<{ printed: boolean; a4Warning: boolean }> {
  const { html, requiresA4 } = getQuickPrintHtml(input)

  // Show A4 warning on first attempt if needed
  if (requiresA4 && !opts.alreadyWarnedA4) {
    return { printed: false, a4Warning: true }
  }

  const pageSize: 'A5' | 'A4' = requiresA4 ? 'A4' : 'A5'

  const ipc = (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null

  if (!ipc) {
    // Dev fallback: open print dialog in new window
    const win = window.open('', '_blank', `width=700,height=${requiresA4 ? 1100 : 800}`)
    if (win) {
      win.document.write(html)
      win.document.close()
      setTimeout(() => win.print(), 600)
    }
    return { printed: true, a4Warning: false }
  }

  try {
    await ipc.pdf.silentPrint(html, { pageSize })
    return { printed: true, a4Warning: false }
  } catch (err) {
    console.error('[PdfService] quickPrintSilent failed:', err)
    return { printed: false, a4Warning: false }
  }
}
