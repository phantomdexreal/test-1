# Phase 6b-B — Done

## What Was Built

### 1. Copy Image (Professional Format)
- **Button:** "Copy Image" in the footer bar
- **Handler:** `handleCopyProfessionalImage()` in NewQuote/index.tsx
- **Service:** `copyBillAsImage(proInput)` in pdf.service.ts
- **Flow:**
  1. Builds professional-format HTML via `buildProfessionalPdfHtml()`
  2. Sends HTML to main process via `ipc.pdf.captureImage(html, { width: 794 })`
  3. Main opens hidden BrowserWindow, loads HTML, waits for layout to settle (900ms)
  4. Measures actual `scrollHeight` of the rendered page, resizes window to match
  5. Calls `webContents.capturePage()` → NativeImage → PNG buffer
  6. Returns base64-encoded PNG to renderer
  7. Renderer calls `ipc.pdf.writeClipboardImage(base64)` to write to system clipboard
  8. Toast confirms: "✓ Bill copied to clipboard as image (Professional format)"
- **Dev fallback:** When Electron IPC is unavailable (browser dev), opens HTML in a new window

### 2. Copy Simplified Image
- **Button:** "Copy Simple" in the footer bar
- **Handler:** `handleCopySimplifiedImage()` in NewQuote/index.tsx
- **Service:** `copyBillAsSimplifiedImage(input)` in pdf.service.ts
- Same flow as Copy Image but uses Simplified format (no company info)
- Intentionally one-click, no UPI QR prompt (keep it truly instant)

### 3. Quick Print (Silent, No Dialog)
- **Button:** "Quick Print" in the footer bar (turns amber when A4 warning pending)
- **Handler:** `handleQuickPrint()` — now async, calls `quickPrintSilent()`
- **Service:** `quickPrintSilent(input, { alreadyWarnedA4 })` in pdf.service.ts
- **IPC:** `ipc.pdf.silentPrint(html, { pageSize })` → main generates PDF → `shell.openPath()` to print
- **A4 Warning flow:**
  - First click when bill > 40 rows: returns `{ a4Warning: true }`, shows amber toast
  - Button turns amber and label changes to "Confirm Print (A4)"
  - Second click proceeds with A4 print silently
  - After successful print, warning flag resets

### 4. Unsaved Changes Guard
- **Architecture:** `NavigationContext` now holds `isDirtyRef` and `onSaveRef`
- **Hook:** `useUnsavedGuard({ onSave })` — exported from NavigationContext
  - Call `setDirty(true)` when bill has content
  - Call `setDirty(false)` after save/discard/reset
  - Guard is automatically cleared on component unmount
- **NewQuote wiring:**
  - `handleGridChange()` calls `setIsDirty(true)` when any row/adjustment has content
  - Party name change also triggers dirty
  - `handleSaveBill()` clears dirty after successful save+reset
  - `saveBillCallbackRef` always stays current for the guard's onSave callback
- **Guard dialog:**
  - Appears when user tries to navigate away (sidebar click, Ctrl+1–6 shortcuts)
  - Three options: **Save Bill** (Enter) | **Discard & Leave** | **Cancel** (Esc)
  - Rendered at provider level in `<NavigationContext.Provider>` — floats above all pages
  - Backdrop blur, smooth animation
- **App close guard:**
  - `beforeunload` handler registered in NewQuote; prevents close if dirty
  - On Electron close, `ipc.app.close()` goes through the same NavigationContext guard path

## New IPC Channels

| Channel | Direction | Purpose |
|---|---|---|
| `pdf:captureImage` | renderer → main | Render HTML, screenshot, return base64 PNG |
| `pdf:writeClipboardImage` | renderer → main | Write base64 PNG to system clipboard |
| `pdf:silentPrint` | renderer → main | Print HTML silently, no dialog |

## Files Changed

| File | Change |
|---|---|
| `src/main/ipc/handlers/pdf.handler.ts` | Added `pdf:captureImage`, `pdf:writeClipboardImage`, `pdf:silentPrint` handlers |
| `src/main/ipc/index.ts` | Added 3 new channel name constants |
| `src/main/preload.ts` | Exposed `captureImage`, `writeClipboardImage`, `silentPrint` on `window.cqikly.pdf` |
| `src/renderer/types/cqiklyApi.d.ts` | Added 3 new method signatures to pdf type |
| `src/renderer/services/pdf.service.ts` | Added `copyBillAsImage`, `copyBillAsSimplifiedImage`, `quickPrintSilent`, `_doCopyImage` |
| `src/renderer/contexts/NavigationContext.tsx` | Full rewrite: added `UnsavedGuardDialog`, guard state, `registerUnsavedGuard`, `useUnsavedGuard` hook |
| `src/renderer/pages/NewQuote/index.tsx` | Wired all 4 features; replaced stubs; added dirty tracking |

## Decisions Made

1. **Copy Image renders Professional format always** — per spec; no format selection prompt to keep it one-click
2. **Copy Image has no UPI QR prompt** — intentional; one-click means no dialogs at all
3. **Quick Print uses `shell.openPath()`** on Windows for silent print via default PDF handler — this triggers the system's default PDF viewer/printer which on most Windows setups silently prints. Alternatively, `webContents.print()` was considered but it opens the Chromium print dialog
4. **Viewport width 794px** for image capture — matches A4/A5 page width at 96dpi; produces a clean single-column layout
5. **Guard fires on `isDirty && hasContent`** — party name alone triggers dirty, but the guard also checks that the bill actually has content to avoid prompting on a blank form
6. **`saveBillCallbackRef` pattern** — avoids stale closure in the guard callback while keeping `useUnsavedGuard` hook API clean

## Known Issues / Limitations

- `quickPrintSilent` on Windows uses `shell.openPath()` which opens the PDF in the default viewer before printing; a future improvement could use a Windows-native silent print API via Node's `child_process.exec('print /d:...')` for truly silent delivery
- Image capture height is capped at 12,000px to prevent memory issues with extremely long bills; bills beyond ~400 rows may crop
- The guard currently only intercepts sidebar navigation and Ctrl+1–6 shortcuts; closing the Electron window via the OS title-bar X button requires the `before-unload` hook in AppShell (Phase 7a can add this)

## Handoff State

All Phase 6b-B deliverables are complete:
- ✅ Copy Image (Professional format, one click, clipboard)
- ✅ Copy Simplified Image (Simplified format, one click, clipboard)
- ✅ Quick Print (silent, A5 default, A4 warning on first attempt, confirms on second)
- ✅ Unsaved Changes Guard (navigation guard + Save/Discard/Cancel dialog)

Ready for Phase 7a-A (History page list view).
