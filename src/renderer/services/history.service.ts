/**
 * cQikly — History Service
 * Built in: Phase 7a-A
 *
 * Responsibilities:
 *   - Bill grouping (monthly / periodical / financial year)
 *   - Excel export of filtered bill lists (SheetJS)
 *   - Amount / date / status filtering (pure functions — no side effects)
 *
 * Architecture: Service layer only — no direct component coupling.
 * All components import from here; never import SheetJS directly.
 */

import type { BillRecord } from './db.service'

// ─── Grouping ─────────────────────────────────────────────────────────────────

export type GroupingMode = 'monthly' | 'yearly' | 'financial-year' | 'none'

export interface BillGroup {
  key: string        // "May 2026", "2025-26", "2026", "All Bills"
  label: string      // Display label
  sublabel?: string  // e.g. "12 bills · ₹2,43,500"
  bills: BillRecord[]
}

/**
 * Group a flat list of bills into labelled groups based on grouping mode.
 * Within each group, bills are sorted newest first.
 */
export function groupBills(bills: BillRecord[], mode: GroupingMode): BillGroup[] {
  if (mode === 'none') {
    return [{ key: 'all', label: 'All Bills', bills: [...bills] }]
  }

  const map = new Map<string, { label: string; bills: BillRecord[] }>()

  for (const bill of bills) {
    const dateStr = bill.billDate || bill.createdAt || ''
    const date = new Date(dateStr)
    let key: string
    let label: string

    if (mode === 'monthly') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      label = date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    } else if (mode === 'yearly') {
      key = String(date.getFullYear())
      label = String(date.getFullYear())
    } else {
      // financial-year: Apr–Mar grouping
      const yr = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
      key = `${yr}-${yr + 1}`
      label = `FY ${yr}–${String(yr + 1).slice(-2)}`
    }

    if (!map.has(key)) map.set(key, { label, bills: [] })
    map.get(key)!.bills.push(bill)
  }

  // Sort groups newest first
  const sorted = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  return sorted.map(([key, { label, bills: groupBills }]) => {
    const total = groupBills.reduce((s, b) => s + (b.grandTotal ?? 0), 0)
    return {
      key,
      label,
      sublabel: `${groupBills.length} bill${groupBills.length !== 1 ? 's' : ''} · ${formatAmountCompact(total)}`,
      bills: groupBills,
    }
  })
}

// ─── Filtering helpers (pure) ─────────────────────────────────────────────────

export interface HistoryFilters {
  statusFilter: 'all' | 'unpaid' | 'paid' | 'partial' | 'cancelled'
  amountMin: string
  amountMax: string
  dateFrom: string
  dateTo: string
}

/**
 * Apply amount + date + status filters to a bill list.
 * Fuzzy search filtering is done at the component level with Fuse.js.
 */
export function applyFilters(bills: BillRecord[], filters: HistoryFilters): BillRecord[] {
  let result = [...bills]

  // Status
  if (filters.statusFilter !== 'all') {
    result = result.filter(b => b.status === filters.statusFilter)
  }

  // Amount range
  const minAmt = parseFloat(filters.amountMin)
  const maxAmt = parseFloat(filters.amountMax)
  if (!isNaN(minAmt)) result = result.filter(b => (b.grandTotal ?? 0) >= minAmt)
  if (!isNaN(maxAmt)) result = result.filter(b => (b.grandTotal ?? 0) <= maxAmt)

  // Date range
  if (filters.dateFrom) {
    result = result.filter(b => {
      const d = (b.billDate || b.createdAt || '').slice(0, 10)
      return d >= filters.dateFrom
    })
  }
  if (filters.dateTo) {
    result = result.filter(b => {
      const d = (b.billDate || b.createdAt || '').slice(0, 10)
      return d <= filters.dateTo
    })
  }

  return result
}

// ─── Excel export ─────────────────────────────────────────────────────────────

/**
 * Export a list of bills to an Excel (.xlsx) file and trigger download.
 * Uses SheetJS (xlsx) — already in package.json.
 * Called from History page Excel export button.
 */
export async function exportBillsToExcel(bills: BillRecord[], filename?: string): Promise<void> {
  // Dynamic import so SheetJS is code-split
  const XLSX = await import('xlsx')

  const rows = bills.map((b, i) => ({
    'Sr No': i + 1,
    'Bill No.': b.billNumber,
    'Party Name': b.partyName,
    'Phone': b.partyPhone ?? '',
    'Date': b.billDate ? formatDateDisplay(b.billDate) : '',
    'Transport': b.transportName ?? '',
    'Format': b.format === 'gst' ? 'GST' : 'Free',
    'Subtotal (₹)': b.subtotal ?? 0,
    'Grand Total (₹)': Math.round(b.grandTotal ?? 0),
    'Status': capitalise(b.status),
    'Internal Remarks': b.internalRemarks ?? '',
    'Created At': b.createdAt ? formatDateDisplay(b.createdAt) : '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 6 },   // Sr No
    { wch: 18 },  // Bill No.
    { wch: 24 },  // Party Name
    { wch: 14 },  // Phone
    { wch: 14 },  // Date
    { wch: 22 },  // Transport
    { wch: 8 },   // Format
    { wch: 14 },  // Subtotal
    { wch: 14 },  // Grand Total
    { wch: 12 },  // Status
    { wch: 28 },  // Remarks
    { wch: 14 },  // Created At
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bills')

  const name = filename ?? `cQikly_History_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, name)
}

// ─── Bulk Excel export ────────────────────────────────────────────────────────

/**
 * Export selected bills to Excel (same format as exportBillsToExcel).
 * Used by bulk actions on History page.
 */
export async function exportSelectedBillsToExcel(
  bills: BillRecord[],
  filename?: string,
): Promise<void> {
  return exportBillsToExcel(bills, filename ?? `cQikly_Selected_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─── Batch PDF generation ─────────────────────────────────────────────────────

export interface BatchPdfResult {
  success: boolean
  path?: string
  filename?: string
  failedCount?: number
  error?: string
}

/**
 * Generate a single combined PDF from multiple selected bills.
 * Each bill becomes its own section (separated by page break) in one PDF.
 *
 * In Electron: passes bill data to pdf.handler via IPC.
 * In browser/dev mode: simulates a download using a placeholder.
 */
export async function generateBatchPdf(bills: BillRecord[]): Promise<BatchPdfResult> {
  if (bills.length === 0) return { success: false, error: 'No bills selected' }

  // ── Electron IPC path ────────────────────────────────────────────────────
  const ipc = (typeof window !== 'undefined') ? (window as Window).cqikly ?? null : null

  if (ipc && typeof (ipc as any).pdf?.generateBatch === 'function') {
    try {
      const result = await (ipc as any).pdf.generateBatch(bills)
      return result as BatchPdfResult
    } catch (err) {
      console.error('[HistoryService] Batch PDF IPC failed:', err)
      return { success: false, error: String(err) }
    }
  }

  // ── Browser/dev mode: build a combined HTML → Blob → download ───────────
  await new Promise(r => setTimeout(r, 600 + bills.length * 80))

  const html = buildBatchPdfHtml(bills)
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const filename = `cQikly_Batch_${bills.length}bills_${new Date().toISOString().slice(0, 10)}.html`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return { success: true, filename }
}

/**
 * Build a self-contained HTML string for batch PDF (one section per bill).
 * This is the browser/dev fallback; Electron main uses printToPDF on hidden BrowserWindow.
 */
function buildBatchPdfHtml(bills: BillRecord[]): string {
  const sections = bills.map((bill, idx) => {
    const total = Math.round(bill.grandTotal ?? 0)
    const rows = (bill.rows as Array<{ itemName?: string; qty?: string; rate?: string; amount?: number }>) ?? []
    const rowsHtml = rows
      .filter(r => r.itemName?.trim())
      .map((r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.itemName ?? ''}</td>
          <td>${r.qty ?? ''}</td>
          <td>${r.rate ?? ''}</td>
          <td style="text-align:right">₹${Math.round(r.amount ?? 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')

    return `
      <div class="bill-section" style="${idx > 0 ? 'page-break-before:always' : ''}">
        <h2 style="margin:0 0 4px;font-size:14px">${bill.partyName}${bill.partyPhone ? ` — ${bill.partyPhone}` : ''}</h2>
        <p style="margin:0 0 8px;font-size:11px;color:#666">
          Bill No: ${bill.billNumber} &nbsp;|&nbsp; Date: ${formatDateDisplay(bill.billDate)}
          ${bill.transportName ? ` &nbsp;|&nbsp; Transport: ${bill.transportName}` : ''}
        </p>
        <table border="1" cellpadding="4" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#f5f5f5">
              <th>Sl.No</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="font-weight:bold">
              <td colspan="4" style="text-align:right">Grand Total</td>
              <td style="text-align:right">₹${total.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>cQikly Batch PDF — ${bills.length} bills</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
    .bill-section { margin-bottom: 40px; }
    table { border: 1px solid #ccc; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; }
    @media print { .bill-section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <p style="color:#888;font-size:10px;margin-bottom:16px">
    Generated by cQikly · ${bills.length} bills · ${new Date().toLocaleDateString('en-IN')}
  </p>
  ${sections}
</body>
</html>`
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatAmountINR(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatAmountCompact(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n)}`
}

export function formatDateDisplay(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
