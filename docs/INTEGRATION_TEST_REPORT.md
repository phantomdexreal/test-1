# cQikly — Integration Test Report
**Phase:** 14 (Final) | **Version:** 1.0.0 | **Date:** May 2026

---

## Test Summary

| Category | Tests | Passed | Failed |
|---|---|---|---|
| Onboarding | 4 | 4 | 0 |
| New Quote | 22 | 22 | 0 |
| History | 5 | 5 | 0 |
| Customer Details | 4 | 4 | 0 |
| Inventory | 6 | 6 | 0 |
| Loose Inventory History | 1 | 1 | 0 |
| Settings | 6 | 6 | 0 |
| Dashboard | 3 | 3 | 0 |
| Global UX | 12 | 12 | 0 |
| **Total** | **63** | **63** | **0** |

---

## Hard Spec Compliance

| # | Hard Spec | Verified |
|---|---|---|
| 1 | MKD: only `-` and `=` are separators; `+` is plain text | ✅ |
| 2 | MKD group names from actual column header names | ✅ |
| 3 | Bill number resets to 1 on year reset; starting number is one-time only | ✅ |
| 4 | Auto-create customer from quote page on first bill save | ✅ |
| 5 | F2 mode: F2 unlocks cell with cursor inside content | ✅ |
| 6 | Sl.No column never editable | ✅ |
| 7 | Single most recent crash draft recoverable | ✅ |
| 8 | Simplified PDF: no company info; header = name + contact | ✅ |
| 9 | Separate SQLite file per company profile | ✅ |
| 10 | Every bill edit creates a version (no exceptions) | ✅ |
| 11 | WhatsApp method (Desktop vs Web) is user-configurable | ✅ |
| 12 | Lite = no animations + no polling; billing always full speed | ✅ |
| 13 | Windows only | ✅ |
| 14 | New rows: Enter or Down only (not Tab) | ✅ |
| 15 | PDF page split per format row limits | ✅ |

All 15 hard specs pass.

---

## Rollback Test

Each major module was tested for rollback safety:
- Toggling any feature module flag OFF restores the pre-flag app state instantly
- Performance mode can be switched live without reload; previous state fully restored
- Disabling inventory mode on the Quote page reverts all grid behaviour immediately
- Disabling F2 lock mode reverts cell navigation immediately
- Crash recovery draft can be dismissed (not recovered); next launch has no prompt

No rollback test produced a broken UI state or console error.

---

## Performance Smoke Test (Lite Mode)

Test procedure: Switch to Lite mode → navigate all pages → create and save a bill → generate PDF → copy as image.

Results:
- All 6 core pages rendered correctly with no animation delays
- No Three.js context created
- No Framer Motion transitions played
- No weather/crypto/forex API calls made (verified via DevTools Network tab)
- Bill save: ~40ms (SQLite write)
- PDF generation: ~180ms (hidden BrowserWindow render + printToPDF)
- Copy as image: ~90ms (capturePage)

All operations match Balanced/Ultra speeds. Performance Lite mode adds zero overhead to billing.

---

*Full test details in `docs/phases/phase-14-done.md`.*
