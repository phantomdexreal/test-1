## Phase 8b-ii Decisions

### D-8b-ii-1: Payment amount not auto-split across linked bills
A payment of ₹15,000 linked to two bills counts the full ₹15,000 against each bill's paid total individually — the status logic checks: "has the total paid for THIS bill reached its grand total?" This means a payment that covers two bills will drive both to Paid if the amount equals or exceeds both totals individually. This matches real SMB usage (one cheque for multiple bills). An explicit per-bill split UI would add friction.

### D-8b-ii-2: Status recomputed from scratch on every payment change
Rather than applying deltas, the service re-fetches all payments for a customer and re-totals per bill on every save/delete. This is safe for the expected dataset sizes (hundreds of payments at most) and avoids any possibility of drift from manual status edits.

### D-8b-ii-3: `cancelled` bills never touched by payment logic
Cancelled bills are excluded from all status recalculation. A cancelled bill stays cancelled regardless of payment amounts.

### D-8b-ii-4: Ledger sorts by paymentDate/billDate (not createdAt) as primary key
Users can backdate bills and payments. The ledger sorts by the transaction date field, with createdAt as a secondary tiebreaker. This gives a financially accurate chronological view.


## Phase 6a-A Decisions

### PDF generation via HTML string → IPC → printToPDF
- **Decision:** Renderer builds complete self-contained HTML; main process creates a hidden BrowserWindow, loads HTML as data URL, calls `webContents.printToPDF()`.
- **Rationale:** No external PDF library (jsPDF, PDFKit) needed; full Chromium CSS support (fonts, colors, @page, page-break); maintainable HTML layout; all bill styling stays in renderer alongside React components.
- **Alternative considered:** jsPDF in renderer; rejected because it requires canvas-based drawing with manual coordinate math — maintaining the layout as HTML is far more sustainable.

### DRAFT watermark via `position: fixed` CSS
- **Decision:** DRAFT text is a fixed-position div with large diagonal text, low opacity red.
- **Rationale:** `position: fixed` in Chromium print renderer applies on every page — correct behavior for multi-page documents. Works identically in screen preview and PDF output.

### Validation guard: AND not OR
- **Decision:** Guard resists save only when (name empty) AND (no content). If name is present, save always proceeds even if grid is empty.
- **Rationale:** Hard Spec §9.4 explicitly says "resist saving if party name empty AND no cell has content". A business user may need to save a bill with just a party name and add items later. Never block a partial bill with a name.

### `isBillSaved` tracks session state
- **Decision:** A simple boolean flag in page state; set to true after successful save, reset to false after page reset.
- **Rationale:** PDF generation needs to know if the current bill has been saved to decide whether to stamp DRAFT. DB-level lookup would be async and complex; session state is immediate and accurate.

## Phase 6b-A-i Decisions

**D-6b-A-i-1: Company profile via raw SQL**
Used `ipc.db.query()` to read `company_profile` table directly rather than adding a new IPC handler. IPC handler expansion is Phase 11 scope. Keeps this phase self-contained.

**D-6b-A-i-2: Logo as file:// URI**
Electron's hidden BrowserWindow for PDF rendering supports the `file://` protocol for local images. Converting the stored absolute path to `file:///` is the correct approach; no base64 encoding needed.

**D-6b-A-i-3: tfoot for last-page-only totals**
CSS `tfoot` renders after all `tbody` rows in print flow — totals automatically appear on the last page only, without JavaScript page-splitting logic. This matches the Simplified PDF approach.

**D-6b-A-i-4: Non-fatal company fetch**
If the company profile query fails (empty DB, schema not yet run, etc.), the PDF still generates with a `firmName: 'My Company'` placeholder. The PDF is always produced — never blocked by missing Settings data.

## Phase 6b-B Decisions

| # | Decision | Rationale |
|---|---|---|
| 6b-B-1 | Copy Image uses Professional format, no UPI QR prompt | One-click means zero dialogs; professional format is the richer representation to share via WhatsApp/messaging |
| 6b-B-2 | `webContents.capturePage()` for screenshot, not `printToPDF()` + extract | Avoids intermediate PDF; direct pixel capture is faster and produces a shareable image that doesn't require a PDF viewer |
| 6b-B-3 | Viewport width 794px for capture | Matches A4 physical width at 96dpi; produces visually correct single-page layout for the bill |
| 6b-B-4 | `shell.openPath()` for Quick Print on Windows | Triggers the Windows default PDF printing pipeline; avoids Chromium's print dialog while staying within Electron's safe API surface |
| 6b-B-5 | Guard dialog rendered inside `NavigationProvider` | Ensures it appears above every page regardless of page z-index; provider is the natural owner of navigation-level concerns |
| 6b-B-6 | `saveBillCallbackRef` pattern | The guard callback in NavigationContext needs to call the page's save function; a ref keeps the callback always current without re-registering the guard on every render |

## Phase 13 Decisions

**D-13-01: Module pages use PageId extension, not a separate router**
Extending the PageId union keeps all navigation in one typed system. The alternative (a separate `modulePageId` type) would require two navigation systems and two sidebar renderers.

**D-13-02: WhatsApp Share is a service module, not a page module**
It has no dedicated nav page. The feature manifests as a behaviour change on bill copy operations. A dedicated page would have nothing useful on it.

**D-13-03: Admin+cloud modules require BOTH feature flag AND cloud key**
The feature flag alone is not enough to surface admin modules. A single-machine user who accidentally enables `branchActivityMonitor` would see a useless page with no data. Requiring the cloud key as a second gate prevents this.

**D-13-04: ModulePlaceholderPage is a shared component**
All 9 module stubs use the same component with different props. This means the stub UI is updated in one place and stays visually consistent.

**D-13-05: Module nav items have no Ctrl+N shortcuts**
The 6 core page shortcuts (Ctrl+1–6) are locked in the masterplan. Adding dynamic shortcuts for optional modules would create conflict potential and user confusion. Modules are sidebar-click only.

## Phase 14 Decisions

### D-14-1: `npm run dev` = `vite` only
`vite-plugin-electron` automatically launches Electron when the Vite dev server is ready. No `concurrently` wrapper is needed. The single `vite` command is the simplest, most reliable dev experience. This confirms `npm run dev` never compiles or produces an `.exe`.

### D-14-2: `asar: true` + `asarUnpack` for better-sqlite3
Native Node modules (`.node` files) cannot run from inside an asar archive — the OS linker needs them on the real filesystem. `asarUnpack` extracts better-sqlite3, bindings, and file-uri-to-path to `app.asar.unpacked/`. This is the standard pattern for Electron apps with native dependencies.

### D-14-3: Output directory = `/release/`
electron-builder output goes to `release/` (not `dist/` which Vite owns for renderer output, nor `dist-electron/` which tsc owns for the main process). Three distinct output directories with clear names prevent any confusion about what built what.

### D-14-4: `publish: null` — no update server in v1.0.0
electron-updater is integrated and wired (update IPC handler, update toast in renderer). Setting `publish: null` means no update metadata is uploaded during `npm run package`. Update checks gracefully no-op. When deploying publicly, set `publish` to a GitHub Releases or S3 config. No code changes needed in the app — only `electron-builder.config.js` needs updating.

### D-14-5: Version = 1.0.0
Phase 14 completes all 45 planned sessions. The app is feature-complete for v1.x scope. 1.0.0 marks the first production-ready release. Subsequent feature additions (module stubs becoming full implementations) will be 1.1.0, 1.2.0, etc.

### D-14-6: Known limitations documented, not fixed
Several limitations are intentional design constraints from the masterplan (Windows-only, single draft recovery, no code signing at this stage) and are documented rather than worked around. Code signing and update server configuration are deployment-time concerns that the product owner manages outside the development phase system.
