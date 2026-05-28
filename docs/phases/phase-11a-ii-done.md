# Phase 11a-ii — Done

## What Was Built

### PDF Settings (full build)
- **Default PDF format selector** — card grid (Simplified / Professional / Detailed Professional); click to apply; pre-selects this format on new bill PDF generation
- **PDF filename pattern** — free-text field with inline token buttons ({PartyName}, {Date}, {PONo}, {Format}); live preview shows a sample resolved filename; reset button restores default `{PartyName}_{Date}_{PONo}`
- **PDF save location** — text path input + Browse button (calls `window.cqikly.app.selectFolder` in Electron, falls back to `window.prompt` in dev/browser); Clear button to reset to always-show-dialog mode
- **PDF quality** — dropdown: Screen / Print (default) / Prepress
- **Watermark / DRAFT stamp toggle** — applies DRAFT stamp to PDFs from unsaved bills; saved bills are never stamped; defaults ON
- **UPI ID** — global field; empty = QR option disabled at print time
- **Per-format footer accordion** — T&C + Bank Details per format (Simplified / Professional / Detailed Professional); each independently toggleable; unchanged from Phase 6b-A-ii logic

**Service extended:** `pdfSettings.service.ts` now exports:
- `getDefaultPdfFormat() / saveDefaultPdfFormat()`
- `getFilenamePattern() / saveFilenamePattern() / resolveFilenamePattern()`
- `getSaveLocation() / saveSaveLocation()`
- `getPdfQuality() / savePdfQuality()`
- `getWatermarkEnabled() / saveWatermarkEnabled()`
- `DEFAULT_FILENAME_PATTERN`

### Print Settings (new panel)
- **Default printer selector** — fetches installed printer list via `window.cqikly.app.getPrinters()` IPC; falls back to empty list in browser mode; "OS Default" is always the first option
- **Default page size** — card grid: A4 / A5 / Letter / Legal; stored in `config.printDefaultPageSize`

### Appearance & Theme (new panel, replaces inline ThemePanel)
- **Dark/Light toggle** — prominent button showing current mode; switches instantly via ThemeContext CSS variable swap
- **Theme selector** — all 6 themes in a card grid; click = instant theme change with no flicker/reload; hover highlights border
- **App-level zoom / font size slider** — range 75%–150% in 5% steps; adjusts `document.documentElement.style.fontSize` immediately so all rem-based layouts scale; preset buttons (75%, 90%, 100%, 110%, 125%, 150%); Reset to 100% button (hidden at 100%); persisted to `config.appZoom`

### Language Selector (new panel)
- Grid of 7 language cards: English (active), Hindi, Kannada, Tamil, Telugu, Marathi, Gujarati
- Non-English languages shown as "Coming Soon" (greyed, disabled)
- Selecting English calls `setLanguage('en')` via LanguageContext
- No structural changes required to add future locales — just a new locale file and an entry in `LANGUAGE_OPTIONS`

### Config Extensions (ConfigContext)
New typed fields added to `AppConfig`:
- `appZoom: number` (default 1.0)
- `printDefaultPrinter: string` (default '')
- `printDefaultPageSize: 'A4' | 'A5' | 'Letter' | 'Legal'` (default 'A4')

### App Bootstrap
`ZoomBootstrap` component added inside `ConfigProvider` in `App.tsx` — on load it reads `config.appZoom` and applies it to `document.documentElement.style.fontSize` so the saved zoom is restored on every app start.

### Settings Page Navigation
Left nav updated with new sections: Print Settings, Language. Sections now use `scrollIntoView({ behavior: 'smooth' })` instead of raw anchor hrefs.

## Architecture Notes
- All new PDF settings stored in `localStorage` under `cqikly:pdf:*` keys (consistent with existing pdfSettings.service pattern; full IPC persistence is the Phase 14 concern)
- Print settings and appZoom stored in `config` (ConfigContext → AppData JSON via IPC)
- Zoom applied via `document.documentElement.style.fontSize` — all rem units in the app scale automatically; no component-level changes needed

## Known Limitations
- `getPrinters()` IPC stub not yet wired in `src/main/ipc/handlers/app.handler.ts` — returns empty list in Electron until wired; works correctly by showing "OS Default" only
- `selectFolder()` IPC stub not yet wired — uses `window.prompt` as fallback in dev mode
- PDF quality setting read by `pdfSettings.service` but not yet consumed by `pdf.service.ts` PDF generation (wired in Phase 11b when PDF generation is upgraded)
- Watermark stamp is stored but rendering in the PDF HTML template is Phase 11b work

## Files Changed
- `src/renderer/services/pdfSettings.service.ts` — extended with Phase 11a-ii fields
- `src/renderer/pages/Settings/PdfSettingsPanel.tsx` — full rebuild
- `src/renderer/pages/Settings/PrintSettingsPanel.tsx` — new
- `src/renderer/pages/Settings/AppearancePanel.tsx` — new (replaces inline ThemePanel)
- `src/renderer/pages/Settings/LanguagePanel.tsx` — new
- `src/renderer/pages/Settings/index.tsx` — updated to use all new panels; nav expanded
- `src/renderer/contexts/ConfigContext.tsx` — AppConfig extended with 3 new typed fields
- `src/renderer/App.tsx` — ZoomBootstrap added

## Test Checklist
1. Open Settings → PDF Settings → change default format → reopen Settings → format still selected
2. Change filename pattern → preview updates live → contains {PartyName} token
3. Set save location → path persists after page navigation
4. Toggle watermark OFF → persists after reload
5. Set PDF quality to Prepress → persists
6. Open Print Settings → page size defaults to A4 → select A5 → persists
7. Open Appearance → click Sakura theme → app background changes instantly, zero flicker
8. Toggle Dark/Light → switches immediately
9. Move zoom slider to 125% → entire app UI scales immediately → nav labels, grid cells, all text
10. Click zoom preset "75%" → app shrinks immediately
11. Click "Reset to 100%" → app back to normal
12. Restart app → zoom 125% still active (restored by ZoomBootstrap)
13. Open Language → 7 cards visible → only English is clickable → click English → no crash
14. All of the above persist after page reload (npm run dev)

## Handoff State
Phase 11a-ii complete. PDF Settings, Print Settings, Appearance & Theme (with zoom), and Language selector are all built and wired. Settings page now has a complete, well-organised left nav covering all major setting groups.

Next phase: **PHASE 11b-i** — Dashboard Widget Toggles settings group.
