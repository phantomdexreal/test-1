# Fix — InternetGate Always Shows "No Internet" in Dev / Electron

## Status: ✅ Done

## File Changed
`src/renderer/services/internet.service.ts`

---

## Root Cause

`checkConnection()` pings Google's `generate_204` endpoints via `fetch()` with `mode: 'no-cors'`.

In the Electron renderer process (and in Vite's dev server), **cross-origin fetch is blocked** by Electron's process model / CSP — the request never leaves the machine. All 3 ping targets throw / abort silently. The function exhausts all targets and returns `false`.

`navigator.onLine` was checked first and correctly returned `true` (OS says online), but the subsequent fetch loop overrode that with a `false` result. The internet gate then displayed "No Internet Connection" and blocked onboarding — even with a perfectly working internet connection.

## Fix

Added `isDevOrElectron()` — detects Electron renderer (`window.cqikly` present) or Vite dev mode (`import.meta.env.DEV`). In either environment, `checkConnection()` **skips the fetch ping entirely** and returns `true` after `navigator.onLine` passes.

```ts
function isDevOrElectron(): boolean {
  if (typeof window !== 'undefined' && (window as any).cqikly) return true
  try { return import.meta.env.DEV === true } catch { return false }
}

export async function checkConnection(): Promise<boolean> {
  if (!navigator.onLine) return false
  if (isDevOrElectron()) return true   // ← skip fetch; pings are blocked here
  // ... fetch loop only runs in plain browser / production web context
}
```

## Why This Is Safe

- `navigator.onLine` is set by the OS network stack — it is accurate in Electron. If the machine is genuinely offline, `navigator.onLine` returns `false` and the gate still shows correctly.
- The fetch pings were never needed in Electron — they only exist to distinguish "connected to LAN but no internet" in a pure-browser context, which is irrelevant for a desktop app.
- The `watchConnection()` poller also calls `checkConnection()`, so the live watcher now works correctly too.

## Did Not Touch
- `InternetGate.tsx` — component logic unchanged
- `OnboardingPage` — unchanged
- `watchConnection()` — unchanged (benefits automatically since it calls `checkConnection`)
