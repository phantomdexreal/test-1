# cQikly — Known Limitations
**Version:** 1.0.0 | **Date:** May 2026

This document lists all known limitations as of the v1.0.0 release. These are intentional constraints or known gaps — none are bugs.

---

## Platform

1. **Windows only.** macOS and Linux are explicitly out of scope for v1.x (Hard Spec #13). The Vite config, IPC handlers, and installer config are Windows-first.

## Deployment

2. **No code signing.** The installer is unsigned. Windows SmartScreen will display "Unknown Publisher". Users must click "More info → Run anyway". Code signing requires an EV/OV certificate and is a deployment-time step outside the development phase system.

3. **No auto-update server.** electron-updater is integrated in the app but the `publish` target in `electron-builder.config.js` is `null`. Update checks gracefully no-op. Configure `publish` in electron-builder config when a GitHub Releases or S3 bucket is available.

## Feature Stubs

4. **All 9 feature modules are placeholder stubs.** Reports, Expense Tracker, Multi-User / Operator Profiles, Branch Sync, Branch Activity Monitor, Customer DB Sync, and Price List Sync show polished placeholder pages only. Full implementations are future phases.

5. **Command palette (Ctrl+K) searches in-memory data only.** For datasets with thousands of bills or customers, results may be incomplete until the service layer has fully loaded the dataset into the search index.

## Integrations

6. **WhatsApp deep link (`whatsapp://`) requires WhatsApp Desktop installed.** If not installed, the OS may show a "no application registered" error. Use "WhatsApp Web" method in Settings as the fallback.

7. **WhatsApp Web opens via `window.open`.** In some Electron builds, this may open inside the app window rather than the system browser. The main process `shell.openExternal` path is wired for production; test with your specific Electron version.

8. **Dashboard API widgets depend on free public APIs.** Weather (OpenMeteo), Crypto (CoinGecko), and Forex (ExchangeRate-API) are free-tier APIs with rate limits and no SLA. Widgets degrade gracefully (last known value or "—") when APIs are unavailable.

## Data

9. **Crash recovery stores only the single most recent draft** (Hard Spec #7). If the app crashes while multiple bills are in progress across sessions, only the last draft is recoverable.

10. **Bill edit versioning has no archival limit** (Hard Spec #10). Every single edit creates a version. For high-volume users editing hundreds of bills daily, the version table will grow unboundedly. A pruning policy should be added in a future phase.

11. **Inventory images stored as file paths, not blobs.** If the user moves or deletes an image file externally, the reference breaks silently. A future improvement would copy images into the app's data directory on assignment.

12. **MKD group names are snapshot at entry time.** If a column header is renamed after MKD entries exist, historical MKD records will show the old header name. There is no retroactive rename.

## Development

13. **`npm install` triggers `electron-rebuild` for better-sqlite3.** First-time install takes 2–5 minutes. If the Electron version is updated, `npm run rebuild` must be re-run manually.

14. **DevTools auto-open in dev mode.** This is intentional for development. To suppress, set the `IS_DEV` guard to false in `src/main/index.ts` when testing production behaviour without packaging.
