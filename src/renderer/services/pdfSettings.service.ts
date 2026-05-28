/**
 * cQikly — PDF Settings Service
 * Phase 6b-A-ii: T&C, Bank Details, UPI ID, Format Memory
 * Phase 11a-ii: Default format, filename pattern, save location,
 *               PDF quality, watermark/DRAFT stamp
 *
 * All data stored in localStorage (falls back gracefully; in Electron
 * these are persisted to the config SQLite DB via IPC in later phases).
 */

import type { PdfFormat } from './pdf.service'

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_TC_TEXT        = (fmt: PdfFormat) => `cqikly:pdf:tc:text:${fmt}`
const KEY_TC_ENABLED     = (fmt: PdfFormat) => `cqikly:pdf:tc:enabled:${fmt}`
const KEY_BANK_TEXT      = (fmt: PdfFormat) => `cqikly:pdf:bank:text:${fmt}`
const KEY_BANK_ENABLED   = (fmt: PdfFormat) => `cqikly:pdf:bank:enabled:${fmt}`
const KEY_UPI_ID         = 'cqikly:pdf:upi:id'
const KEY_FORMAT_MEMORY  = 'cqikly:pdf:format_memory'
// Phase 11a-ii additions
const KEY_DEFAULT_FORMAT  = 'cqikly:pdf:default_format'
const KEY_FILENAME_PATTERN = 'cqikly:pdf:filename_pattern'
const KEY_SAVE_LOCATION   = 'cqikly:pdf:save_location'
const KEY_PDF_QUALITY     = 'cqikly:pdf:quality'
const KEY_WATERMARK       = 'cqikly:pdf:watermark_enabled'

// ─── T&C per format ───────────────────────────────────────────────────────────

export interface TcSettings {
  text:    string
  enabled: boolean
}

export const DEFAULT_TC: TcSettings = {
  text: [
    'Goods once sold will not be taken back.',
    'All disputes are subject to local jurisdiction.',
    'E. & O.E.',
  ].join('\n'),
  enabled: false,
}

export function getTcSettings(format: PdfFormat): TcSettings {
  try {
    const text    = localStorage.getItem(KEY_TC_TEXT(format))    ?? DEFAULT_TC.text
    const enabled = localStorage.getItem(KEY_TC_ENABLED(format)) ?? 'false'
    return { text, enabled: enabled === 'true' }
  } catch {
    return { ...DEFAULT_TC }
  }
}

export function saveTcSettings(format: PdfFormat, settings: TcSettings): void {
  try {
    localStorage.setItem(KEY_TC_TEXT(format),    settings.text)
    localStorage.setItem(KEY_TC_ENABLED(format), String(settings.enabled))
  } catch { /* non-fatal */ }
}

// ─── Bank details per format ──────────────────────────────────────────────────

export interface BankSettings {
  text:    string
  enabled: boolean
}

export const DEFAULT_BANK: BankSettings = {
  text: '',
  enabled: false,
}

export function getBankSettings(format: PdfFormat): BankSettings {
  try {
    const text    = localStorage.getItem(KEY_BANK_TEXT(format))    ?? DEFAULT_BANK.text
    const enabled = localStorage.getItem(KEY_BANK_ENABLED(format)) ?? 'false'
    return { text, enabled: enabled === 'true' }
  } catch {
    return { ...DEFAULT_BANK }
  }
}

export function saveBankSettings(format: PdfFormat, settings: BankSettings): void {
  try {
    localStorage.setItem(KEY_BANK_TEXT(format),    settings.text)
    localStorage.setItem(KEY_BANK_ENABLED(format), String(settings.enabled))
  } catch { /* non-fatal */ }
}

// ─── UPI ID (global — shared across all formats) ──────────────────────────────

export function getUpiId(): string {
  try { return localStorage.getItem(KEY_UPI_ID) ?? '' } catch { return '' }
}

export function saveUpiId(id: string): void {
  try { localStorage.setItem(KEY_UPI_ID, id) } catch { /* non-fatal */ }
}

// ─── PDF Format Memory per Party ─────────────────────────────────────────────

type FormatMemoryMap = Record<string, PdfFormat>

function readFormatMemory(): FormatMemoryMap {
  try {
    const raw = localStorage.getItem(KEY_FORMAT_MEMORY)
    if (!raw) return {}
    return JSON.parse(raw) as FormatMemoryMap
  } catch {
    return {}
  }
}

function writeFormatMemory(map: FormatMemoryMap): void {
  try { localStorage.setItem(KEY_FORMAT_MEMORY, JSON.stringify(map)) } catch { /* non-fatal */ }
}

export function getPartyPdfFormat(partyName: string): PdfFormat | null {
  const key = partyName.trim().toLowerCase()
  if (!key) return null
  const map = readFormatMemory()
  return map[key] ?? null
}

export function setPartyPdfFormat(partyName: string, format: PdfFormat): void {
  const key = partyName.trim().toLowerCase()
  if (!key) return
  const map = readFormatMemory()
  map[key] = format
  writeFormatMemory(map)
}

// ─── Phase 11a-ii: New PDF Settings ──────────────────────────────────────────

/** Default PDF format for new bills */
export function getDefaultPdfFormat(): PdfFormat {
  const stored = localStorage.getItem(KEY_DEFAULT_FORMAT)
  if (stored === 'simplified' || stored === 'professional' || stored === 'detailed-professional') {
    return stored as PdfFormat
  }
  return 'professional'
}

export function saveDefaultPdfFormat(format: PdfFormat): void {
  try { localStorage.setItem(KEY_DEFAULT_FORMAT, format) } catch { /* non-fatal */ }
}

/** Filename pattern for saved PDFs. Tokens: {PartyName} {Date} {PONo} {Format} */
export const DEFAULT_FILENAME_PATTERN = '{PartyName}_{Date}_{PONo}'

export function getFilenamePattern(): string {
  try { return localStorage.getItem(KEY_FILENAME_PATTERN) ?? DEFAULT_FILENAME_PATTERN } catch { return DEFAULT_FILENAME_PATTERN }
}

export function saveFilenamePattern(pattern: string): void {
  try { localStorage.setItem(KEY_FILENAME_PATTERN, pattern) } catch { /* non-fatal */ }
}

/** Resolve a filename pattern with actual bill values */
export function resolveFilenamePattern(
  pattern: string,
  values: { partyName: string; date: string; poNo: string; format: string }
): string {
  return pattern
    .replace(/\{PartyName\}/g, values.partyName || 'Bill')
    .replace(/\{Date\}/g,      values.date       || '')
    .replace(/\{PONo\}/g,      values.poNo       || '')
    .replace(/\{Format\}/g,    values.format     || '')
    // Sanitise for file system
    .replace(/[/\\:*?"<>|]/g, '-')
    .trim()
}

/** Default save location (empty = let Electron show save dialog) */
export function getSaveLocation(): string {
  try { return localStorage.getItem(KEY_SAVE_LOCATION) ?? '' } catch { return '' }
}

export function saveSaveLocation(path: string): void {
  try { localStorage.setItem(KEY_SAVE_LOCATION, path) } catch { /* non-fatal */ }
}

/** PDF quality: 'screen' | 'print' | 'prepress' */
export type PdfQuality = 'screen' | 'print' | 'prepress'

export function getPdfQuality(): PdfQuality {
  const stored = localStorage.getItem(KEY_PDF_QUALITY)
  if (stored === 'screen' || stored === 'print' || stored === 'prepress') return stored as PdfQuality
  return 'print'
}

export function savePdfQuality(q: PdfQuality): void {
  try { localStorage.setItem(KEY_PDF_QUALITY, q) } catch { /* non-fatal */ }
}

/** Watermark / DRAFT stamp on unsaved-bill PDFs */
export function getWatermarkEnabled(): boolean {
  try { return (localStorage.getItem(KEY_WATERMARK) ?? 'true') === 'true' } catch { return true }
}

export function saveWatermarkEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY_WATERMARK, String(enabled)) } catch { /* non-fatal */ }
}

// ─── UPI QR code HTML builder ────────────────────────────────────────────────

export function buildUpiQrHtml(upiId: string, amount: number, recipientName?: string): string {
  if (!upiId?.trim()) return ''

  const rounded = Math.round(amount)
  const upiUri  = `upi://pay?pa=${encodeURIComponent(upiId)}`
    + `&am=${rounded}`
    + `&cu=INR`
    + (recipientName ? `&pn=${encodeURIComponent(recipientName)}` : '')

  return `
  <div class="upi-qr-block">
    <div class="upi-qr-label">Scan to Pay · UPI</div>
    <canvas id="upi-qr-canvas" width="120" height="120"></canvas>
    <div class="upi-qr-amount">₹${rounded.toLocaleString('en-IN')}</div>
    <div class="upi-qr-id">${escHtml(upiId)}</div>
  </div>
  <script>
    (function() {
      var canvas = document.getElementById('upi-qr-canvas');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 120, 120);
      ctx.fillStyle = '#1a1a2e';
      ctx.font = '5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('UPI QR', 60, 55);
      ctx.font = '4px monospace';
      ctx.fillText('${escHtml(upiId)}', 60, 65);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 112, 112);
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = function() {
        try {
          canvas.width = 120; canvas.height = 120;
          new QRCode(canvas, {
            text: '${upiUri.replace(/'/g, "\\'")}',
            width: 120, height: 120,
            colorDark: '#1a1a2e', colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        } catch(e) {}
      };
      document.head.appendChild(script);
    })();
  </script>`
}

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ─── Shared PDF footer ────────────────────────────────────────────────────────

export interface SharedPdfFooterOptions {
  format:       PdfFormat
  grandTotal:   number
  includeQr:    boolean
  firmName?:    string
}

export function buildSharedPdfFooter(opts: SharedPdfFooterOptions): string {
  const { format, grandTotal, includeQr, firmName } = opts

  const tc   = getTcSettings(format)
  const bank = getBankSettings(format)
  const upiId = getUpiId()

  const tcHtml = (tc.enabled && tc.text.trim()) ? `
    <div class="pdf-footer-section pdf-tc">
      <div class="pdf-footer-label">Terms &amp; Conditions</div>
      <div class="pdf-footer-text">${escHtml(tc.text).replace(/\n/g, '<br>')}</div>
    </div>` : ''

  const bankHtml = (bank.enabled && bank.text.trim()) ? `
    <div class="pdf-footer-section pdf-bank">
      <div class="pdf-footer-label">Bank Details</div>
      <div class="pdf-footer-text">${escHtml(bank.text).replace(/\n/g, '<br>')}</div>
    </div>` : ''

  const qrHtml = (includeQr && upiId.trim()) ? `
    <div class="pdf-footer-section pdf-qr">
      ${buildUpiQrHtml(upiId, grandTotal, firmName)}
    </div>` : ''

  if (!tcHtml && !bankHtml && !qrHtml) return ''

  return `
  <div class="pdf-shared-footer">
    <div class="pdf-footer-inner">
      ${tcHtml}
      ${bankHtml}
      ${qrHtml}
    </div>
  </div>`
}

export const SHARED_PDF_FOOTER_CSS = `
  .pdf-shared-footer {
    margin-top: 4mm;
    border-top: 1px solid #ccc;
    padding-top: 3mm;
    page-break-inside: avoid;
  }
  .pdf-footer-inner {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
    align-items: flex-start;
  }
  .pdf-footer-section {
    flex: 1 1 auto;
    min-width: 40mm;
  }
  .pdf-footer-label {
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #555;
    margin-bottom: 1.5mm;
    border-bottom: 0.5px solid #ddd;
    padding-bottom: 0.5mm;
  }
  .pdf-footer-text {
    font-size: 6.5pt;
    color: #444;
    line-height: 1.55;
    white-space: pre-wrap;
  }
  .pdf-qr {
    flex: 0 0 auto;
    text-align: center;
    min-width: 28mm;
  }
  .upi-qr-block {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 1mm;
  }
  .upi-qr-label {
    font-size: 6pt;
    font-weight: 700;
    color: #333;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .upi-qr-amount {
    font-size: 7pt;
    font-weight: 700;
    color: #1a1a2e;
  }
  .upi-qr-id {
    font-size: 5.5pt;
    color: #555;
  }
`
