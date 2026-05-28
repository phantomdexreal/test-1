# Phase 6b-A-i — Professional PDF Format

## What was built

### Professional PDF HTML generator (`pdf.service.ts`)

Added `buildProfessionalPdfHtml()` and supporting types/functions:

**`CompanyInfo` interface**
- `firmName` — company/firm name (required)
- `address` — multi-line address (optional)
- `phones` — string or string[] of phone numbers (optional)
- `logoPath` — local file path or data-URL for logo (optional)

**`ProfessionalPdfInput` interface**
- Extends `SimplifiedPdfInput` with `company: CompanyInfo` and `poNumber?: string`

**`decideProfessionalPageSize(rowCount)`**
- Hard Spec #15: A5 ≤30 rows → A4 ≤60 rows → multi-page A4
- Returns `{ size: PdfPageSize; multiPage: boolean }`

**`buildProfessionalPdfHtml(input)`** — full HTML generator:
- **Company header block**: firm name (large, bold), address (multi-line), phone(s) with 📞 icon, logo image (right-aligned). Logo supports `data:` URLs, `http` URLs, and local `file:///` paths (for Electron hidden-window rendering).
- **Sub-header**: customer name (bold), contact number, transport name, bill/PO number, date — laid out in a tinted card with left/right split.
- **Table**: identical rules to Simplified — long item names wrap (never truncate), empty rows skipped, Sl.No auto-calculated, custom cols shown in Free format (≤4), excluded from GST format, per-cell formatting (bold/color/bg) applied.
- **Page size**: A5 or A4 based on row count (Hard Spec #15).
- **`thead` display: table-header-group`**: column headers repeat on every page via CSS.
- **Totals on last page only**: subtotal (only if adjustments exist) → adjustment rows → grand total (rounded). All in `<tfoot>` — natural document flow ensures they appear after all data rows.
- **DRAFT watermark**: rendered when `isDraft = true`.
- **Extra-cols warning**: shown if Free format has >4 custom cols.

**`saveProfessionalPdf(input, opts)`**
- Same flow as `saveSimplifiedPdf`: builds HTML → IPC → `pdf:generate` → printToPDF → save.
- Dev/browser fallback: opens in new window.
- `printDialog` mode: triggers OS print dialog.
- Opens containing folder after save.

### NewQuote page wiring (`pages/NewQuote/index.tsx`)

- Added `isSavingProfessionalPdf` state.
- Added `handleSaveProfessionalPdf` callback:
  - Reads company profile from SQLite via `ipc.db.query('SELECT firm_name, address, phone, logo_path FROM company_profile LIMIT 1')`.
  - Falls back to `{ firmName: 'My Company' }` if DB unavailable or table empty (non-fatal).
  - Builds `ProfessionalPdfInput` from current bill state + company info.
  - Calls `saveProfessionalPdf()`.
  - Shows toast: `✓ Professional PDF saved` (or DRAFT note if unsaved).
- Added **"Pro PDF"** button in the footer action bar, right after the simplified "Save PDF" button. Styled with a subtle accent tint to distinguish it visually from the simplified PDF button.

## Decisions made

- **Company info is fetched live at PDF-generation time** (not cached in component state). This ensures the PDF always reflects the current Settings values without any manual refresh step.
- **Raw SQL fallback**: since `ipc.db.getCompanyProfile()` is not exposed in the preload (that's a Phase 11 concern), we use `ipc.db.query()` directly — consistent with how bill.service.ts queries data.
- **Logo rendering**: Electron's hidden BrowserWindow supports `file://` protocol for local images, so we construct a proper `file:///` URI from the stored path. `data:` and `http:` URLs pass through unchanged.
- **Phones normalisation**: stored as a single `phone` TEXT column in DB; if multiple numbers are needed, they can be stored comma-separated. The PDF renders them joined with ` · `.
- **`tfoot` totals placement**: CSS ensures tfoot only renders after all tbody rows in natural flow — so on multi-page A4, totals appear on the last page only. No JavaScript splitting needed.
- **"Pro PDF" label**: short label fits the footer button without widening the toolbar uncomfortably. Tooltip is descriptive: "Professional PDF with company header, logo, and customer sub-header".
- **Optional footer additions** (terms & conditions, bank details, UPI QR) are Phase 6b-A-ii scope — stubbed as `// TODO` in the format spec comment. The HTML generator is structured to accept footer content easily.

## Known issues / handoff state

- Company profile must have a row in `company_profile` table (populated during onboarding) for the header to show real data. If onboarding was skipped, fallback `firmName = 'My Company'` shows.
- Logo image may not render if `logo_path` points to a file that no longer exists on disk — the `<img>` tag will silently fail (broken image placeholder). No error is thrown.
- `phone` column in DB only stores one phone number. Multiple phone numbers (as mentioned in masterplan) require a Phase 11 schema addition — the `CompanyInfo.phones: string | string[]` type is already future-ready for this.
- Terms & conditions, bank details, UPI QR footer blocks: stubbed for Phase 6b-A-ii.
- PDF format memory per party (remembers last used format) — Phase 6b-A-ii scope.

## Files changed

- `src/renderer/services/pdf.service.ts` — added `CompanyInfo`, `ProfessionalPdfInput`, `decideProfessionalPageSize`, `buildProfessionalPdfHtml`, `saveProfessionalPdf`
- `src/renderer/pages/NewQuote/index.tsx` — added import, state, handler, and "Pro PDF" footer button
- `docs/phases/phase-6b-A-i-done.md` — this file
