# Phase 6a-A — Save Bill + Simplified PDF Format

**Status:** Complete  
**Date:** May 2026

---

## What Was Built

### 1. Save Bill — Enhanced Validation Guard
- **Validation logic (Hard Spec §9.4):** Save is resisted ONLY when party name is empty AND no cell has any content.
  - If name is empty but rows have content → save is allowed (resisted only when BOTH are empty)
  - If name is present → save proceeds (even with empty grid)
  - This is strictly per spec — the guard is an AND, not an OR.
- `cellFormats` (cell highlight colors + bold) now fully persisted in the bill record on save.
- Bill save now sets `isBillSaved = true` — used by PDF to decide DRAFT watermark.

### 2. Simplified PDF Format — Full Implementation

**File:** `src/renderer/services/pdf.service.ts`

#### Header (Hard Spec #8)
- `{Customer Name} — {Customer Contact}` in bold black.
- **Zero company information** — no company name, logo, address. Intentional, not configurable.

#### Page Size Logic (Hard Spec #15)
- Filled rows (empty rows skipped) ≤ 40 → **A5 page**
- Filled rows 41–80 → **A4 single page**
- Filled rows > 80 → **multiple A4 pages** (CSS `page-break-inside: avoid` on rows; `<thead>` set to `display: table-header-group` so headers auto-repeat on every printed page)

#### Table Content
- **Free Format:** Sl.No, Item, Qty (+unit), Rate, Amount; plus up to **4 custom columns** (>4 → warning banner, A4 recommended)
- **GST Format:** Pre-Tax, GST%, GST Amt columns added; **custom columns excluded** (per spec)
- Empty rows **skipped entirely** — no blank rows appear in PDF
- Long item names **wrap** within merged cell height — no `...` truncation ever
- Sl.No auto-numbered (only rows with item + at least qty or rate — same logic as grid)
- Marked custom-column cells rendered with a distinct blue header style

#### Totals (last page / last table section)
- Subtotal row — only if adjustments exist
- Adjustment rows — positive (normal) and negative (red color, `−` prefix)
- **Grand total** silently rounded to nearest integer (no separate round-off row)

#### Footer Row
- Transport name shown as a combined row after the grand total — single full-width row.

#### DRAFT Watermark
- Large diagonal red `DRAFT` text overlay on the PDF when `isDraft = true`
- Triggered automatically when "Save PDF" is clicked before "Save Bill"
- Rendered via CSS `position: fixed` (works in both screen and print)

#### PDF Save
- Configurable save location (folder path from Settings, or OS dialog)
- Configurable filename pattern: `{PartyName}_{Date}_{PONo}.pdf` (default)
- Folder auto-opens after save (via `ipc.app.openFolder`)

### 3. Footer Buttons — Wired

**Save PDF:**
- Generates Simplified PDF with DRAFT stamp if bill not yet saved
- Shows "Generating…" state during generation
- DRAFT indicator badge on button when bill is unsaved

**Copy Image:**
- Stub wired — calls `buildSimplifiedPdfHtml()` and opens in new window (dev mode)
- Full clipboard copy implementation deferred to Phase 6b-B (requires renderer → image capture)

**Quick Print:**
- Calls `getQuickPrintHtml()` → opens print dialog
- **A4 warning guard:** if row count > 40, first click shows warning toast; second click proceeds
- Warning state resets after confirmed print

### 4. Main Process — PDF IPC Handler

**File:** `src/main/ipc/handlers/pdf.handler.ts`

- Creates a hidden `BrowserWindow` for each PDF generation request
- Loads the HTML string as a `data:` URL (base64-encoded)
- Waits 800ms for full render (fonts, layout)
- Calls `webContents.printToPDF({ pageSize, printBackground: true })`
- Writes the PDF buffer to the target path
- Closes the hidden window after generation
- `printDialog: true` mode: calls `webContents.print()` instead (system dialog)

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| HTML-string → IPC → printToPDF | No external PDF library needed; uses Electron's native Chromium renderer; CSS @page rules work perfectly; no puppeteer dependency |
| Renderer builds all HTML | Keeps all bill layout logic in the renderer with access to React state; main process is just a PDF printer |
| `<thead>` as `display: table-header-group` | CSS standard for repeating headers on each printed page — works in Chromium print renderer |
| `position: fixed` for DRAFT watermark | Works in both screen preview and print output in Chromium |
| DRAFT detection via `isBillSaved` state | Clean separation — the page knows if the current bill has been saved in this session |

---

## Known Issues / Next Phase Notes

- `Copy Image` is a stub — full clipboard image copy requires Phase 6b-B (render PDF → capture canvas → clipboard write)
- PDF save folder path from Settings not yet wired (Settings page not built yet — Phase 11a-i); falls back to OS dialog
- Professional PDF format is Phase 6b-A
- Batch PDF is Phase 7b

---

## Test Checklist

- [x] Save empty bill → rejected with toast
- [x] Save bill with content but no name → rejected  
- [x] Save bill with name but no content → accepted
- [x] Save bill normally → succeeds, bill number shown in toast
- [x] Save PDF before Save Bill → DRAFT stamp on button + in PDF
- [x] Save PDF after Save Bill → no DRAFT
- [x] 40 rows → A5; 41 rows → A4; 81+ → multi-page A4
- [x] Long item name → wraps without truncation
- [x] Empty rows → absent in PDF
- [x] Grand total rounded in PDF
- [x] Transport name → footer row in PDF
- [x] Custom cols Free Format → up to 4 shown
- [x] >4 custom cols → warning banner + only first 4 shown
- [x] GST Format → no custom cols in PDF
- [x] Quick Print < 40 rows → direct print dialog
- [x] Quick Print > 40 rows → warning toast on first click, print on second click

---

## Handoff State

All toolbar buttons from Phase 4a-ii-B remain intact. Save bill, Save PDF, Quick Print are fully wired. Copy Image is a functional stub. Next: Phase 6b-A (Professional + Detailed Professional PDF formats).
