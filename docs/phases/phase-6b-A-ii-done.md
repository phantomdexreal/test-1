# Phase 6b-A-ii — Done

## What Was Built

### 1. Detailed Professional PDF Format
- **File:** `src/renderer/services/pdf.service.ts` — `buildDetailedProfessionalPdfHtml()`, `saveDetailedProfessionalPdf()`, `decideDetailedPageSize()`
- **Header block:** Dark `#1a1a2e` company header bar with firm name (large), address, phones, GSTIN, email, website, logo (white-filtered so it shows on dark bg)
- **Customer block:** Light `#f8f8ff` "Bill To" block with party name, contact, address, GSTIN, state, PAN, transport
- **Page size logic (Hard Spec #15):** A5 ≤20 rows → A4 ≤40 rows → multi-page A4 as needed
- **Table:** Same rules as Simplified and Professional (long names wrap, empty rows skipped, grand total rounded, custom cols Free ≤4/GST none)
- **Headers repeat on each page** via CSS `thead { display: table-header-group }`
- **Totals only on last page** via natural document flow (tfoot after tbody)

### 2. Shared PDF Footer — Terms & Conditions
- **File:** `src/renderer/services/pdfSettings.service.ts`
- **Per-format independent toggle** — T&C on for Professional does NOT affect Simplified or Detailed Professional
- **Text configurable** in Settings → PDF Settings panel per format accordion
- **Stored in localStorage** (production: SQLite config DB in Phase 11)
- **Injected** into all 3 PDF HTML builds via `buildSharedPdfFooter()`

### 3. Shared PDF Footer — Bank Details
- **Per-format independent toggle** — same storage/toggle pattern as T&C
- **Multi-line text field** for account number, IFSC, bank name
- **Independently controllable** per format — bank details on Simplified off won't affect Pro

### 4. UPI QR Code
- **File:** `src/renderer/services/pdfSettings.service.ts` — `buildUpiQrHtml()`
- **UPI ID** stored globally (one ID used across all formats)
- **Never auto-included** — always prompted at print/copy time per spec
- **Prompt:** `UpiQrPrompt` dialog in `PdfActionDialogs.tsx` — "Include QR Code?" / "Skip QR"
- **If no UPI ID configured** — prompt is skipped entirely (no dialog shown)
- **QR URI format:** `upi://pay?pa={UPI_ID}&am={AMOUNT}&cu=INR&pn={FirmName}`
- **Fallback:** canvas placeholder if qrcodejs CDN unavailable (offline); in production Phase will embed lib locally

### 5. PDF Format Memory Per Party
- **File:** `src/renderer/services/pdfSettings.service.ts` — `getPartyPdfFormat()`, `setPartyPdfFormat()`
- **Stored per party name** (lowercase key) in localStorage
- **Auto-selects** format in PdfFormatSelector dialog when customer is loaded
- **Shows banner** "Auto-selected Professional — last used for ABC Traders" with ability to override
- **Overriding** for one bill does NOT permanently change memory (memory is set only on successful generation)
- **Format selector** is a clean modal with all 3 format options + descriptions

### 6. PDF Format Selector Dialog
- **File:** `src/renderer/pages/NewQuote/PdfActionDialogs.tsx` — `PdfFormatSelector`
- **Triggered** by the "🏢 Save PDF…" button (replaces the old "Pro PDF" button)
- **Shows all 3 formats** with icon + label + description
- **Memory banner** shown when a remembered format exists for the party
- **Cancel support** — dismissing returns user to bill without generating

### 7. Settings — PDF Settings Panel
- **File:** `src/renderer/pages/Settings/PdfSettingsPanel.tsx`
- **Wired into** Settings page below the Performance panel
- **UPI ID field** (global)
- **Per-format accordions** for T&C and Bank Details (each with toggle + textarea)
- **Live save** — changes persist to localStorage on every keystroke

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Promise-based dialog flow | Format selector and UPI prompt use `Promise` + `useState` to make async "prompt" feel like native `window.confirm()` — clean caller code |
| localStorage for Phase 6 | Full SQLite config DB integration is Phase 11; localStorage gives identical runtime behavior with zero DB changes now |
| Shared footer injected as HTML string | PDF generation is all string-based HTML; injecting CSS + HTML snippets is the cleanest approach for this architecture |
| Format selector replaces "Pro PDF" button | The old "Pro PDF" button only launched Professional. The new "Save PDF…" button launches the selector modal which covers all 3 formats. The old "Save PDF" button still generates Simplified directly for quick workflow. |

## Files Changed / Created

| File | Status | Description |
|---|---|---|
| `src/renderer/services/pdf.service.ts` | Modified | Added Detailed Professional builder + save function, shared footer injection in all 3 formats |
| `src/renderer/services/pdfSettings.service.ts` | **New** | T&C, bank details, UPI ID, format memory per party, shared footer builder, CSS |
| `src/renderer/pages/NewQuote/PdfActionDialogs.tsx` | **New** | UpiQrPrompt and PdfFormatSelector modal components |
| `src/renderer/pages/Settings/PdfSettingsPanel.tsx` | **New** | Per-format T&C + bank details settings + UPI ID global setting |
| `src/renderer/pages/Settings/index.tsx` | Modified | Imported and rendered PdfSettingsPanel |
| `src/renderer/pages/NewQuote/index.tsx` | Modified | Wired format selector, UPI prompt, format memory, Detailed Professional save |

## Known Issues / TODOs

- `// TODO: [QR-OFFLINE]` — QR code in PDF uses CDN qrcodejs. In Phase 11 this should be bundled locally for true offline operation. The canvas fallback always shows correctly offline.
- T&C and bank details are stored in localStorage for this phase. Phase 11 should migrate to SQLite config DB via `settings.handler.ts`.
- The `pdfSettings.service.ts` uses `localStorage` — in Electron this maps to the app's user data folder (persistent across restarts). This is production-correct behavior.

## Test Checklist

- [x] Detailed Professional with 20 rows → A5
- [x] Detailed Professional with 21 rows → A4
- [x] Detailed Professional with 41 rows → multi-page A4 (headers repeat, totals last page only)
- [x] T&C toggle off for Simplified → Simplified PDF has no T&C, Professional unaffected
- [x] Bank details toggle per format independently
- [x] "🏢 Save PDF…" button → format selector opens
- [x] Format memory banner shows for returning customer
- [x] UPI QR prompt appears only when UPI ID is configured
- [x] UPI QR prompt does NOT appear when UPI ID is blank
- [x] "Skip QR — Generate PDF" → PDF generated without QR
- [x] "Include QR Code" → PDF generated with QR in footer
- [x] Format memory set after successful generation
- [x] Overriding format in selector doesn't change memory until generation completes
