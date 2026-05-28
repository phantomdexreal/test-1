# Phase 3b-i — Live API Widgets + Calculator Sidebar

**Status:** Complete  
**Date:** May 2026  
**Built by:** Claude Sonnet 4.x

---

## What Was Built

### 1. Weather Widget (`WeatherWidget.tsx`)
- **API:** Open-Meteo (100% free, no API key required)
  - Geocoding: `geocoding-api.open-meteo.com`
  - Weather: `api.open-meteo.com`
  - AQI: `air-quality-api.open-meteo.com`
- **Data shown:** Temperature (°C), Feels Like, Humidity (%), Wind Speed (km/h), AQI (European), Condition + emoji icon
- **City source:** `config.weatherCity` (set in Settings, defaults to "Mumbai")
- **Polling:** Respects `PerformanceContext.apiPollingEnabled` and `apiPollingInterval`
  - Lite mode: single fetch only (no polling), shows "Polling paused" label
  - Balanced: 2-minute polling interval
  - Ultra: 30-second polling interval
- **Graceful degradation:** Shows friendly error if city not found or no internet
- **Hot-swap:** City change in Settings triggers immediate re-fetch

### 2. Crypto Markets Widget (`CryptoWidget.tsx`)
- **API:** CoinGecko public API (free, no key required)
  - Endpoint: `api.coingecko.com/api/v3/simple/price`
- **Data shown:** Up to 5 coins — price in configured currency + 24h % change (▲/▼ coloured)
- **Currency source:** `config.cryptoCurrency` (default: "inr")
- **Coins source:** `config.cryptoIds` (default: bitcoin, ethereum, solana, binancecoin, ripple)
- **Default 5 coins:** BTC, ETH, SOL, BNB, XRP
- **Polling:** Same performance tier system as Weather widget

### 3. Forex Rates Widget (`ForexWidget.tsx`)
- **API:** Frankfurter (free, ECB data, no key required)
  - Endpoint: `api.frankfurter.app/latest`
- **Data shown:** Configured currency pairs with live rates
- **Pairs source:** `config.forexPairs` (default: USD/INR, EUR/INR, GBP/INR, USD/EUR, AED/INR)
- **Shared rates:** Exposes `getSharedForexRates()` and `subscribeForexRates()` for CurrencyConverter
- **Polling:** Same performance tier system

### 4. Unit Converter Widget (`UnitConverterWidget.tsx`)
- **Offline** — no API required
- **Categories:** Weight (7 units), Length (7 units), Area (6 units incl. Indian units: Cent, Gunta), Volume (4 units), Temperature (°C/°F/K)
- **Features:** Category tab bar, swap button (⇌), live result preview, number input
- **Indian focus:** Quintal, Tonne, Gunta, Cent for SMB use cases

### 5. Currency Converter Widget (`CurrencyConverterWidget.tsx`)
- **Powered by** Forex rates from ForexWidget's shared rates cache (no double-fetch)
- **Falls back** to live Frankfurter fetch if rates not yet cached
- **16 currencies:** INR, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, CHF, CNY, SAR, QAR, KWD, MYR, THB
- **Auto-converts** on every change
- **Swap button** (⇌) swaps from/to currencies

### 6. Calculator Sidebar (`CalculatorSidebar.tsx`)
- **Shortcut:** `Alt+N` — confirmed no conflict with any existing shortcut
  - Alt+1 = Free Format, Alt+2 = GST Format — different keys, no conflict
- **Position:** Slides up from bottom of screen
- **Keyboard-only operation:**
  - Type expression directly in input bar
  - `Enter` → evaluates and appends row to history
  - `↑/↓` → navigate history rows
  - `Esc` → close
  - `Ctrl+Delete` → clear all history
  - `Backspace` → delete last char
- **History:** Persistent across sessions via `localStorage` key `cq:calc-history`
- **Editable rows:** Click or arrow-navigate to any history row → edit → Enter or blur → re-evaluates
- **Safe evaluator:** No `eval()` — uses `Function` constructor with strict whitelist (digits, operators, parens). Supports `^` (power), `%` (percentage as /100)
- **Live preview:** Shows result inline as you type in the new-expression bar

---

## Architecture Decisions

### API choices (all free, no key required)
| Widget | API | Reason |
|---|---|---|
| Weather | Open-Meteo | Truly free, no key, high quality, includes AQI |
| Crypto | CoinGecko | Industry standard, free tier, 50 calls/min |
| Forex | Frankfurter | ECB data, completely free, no key, highly reliable |

### Shared forex rates atom
`ForexWidget.tsx` exports `getSharedForexRates()` and `subscribeForexRates()` — a simple module-level pub/sub. This means `CurrencyConverterWidget` gets rates for free without a second API call. Both components can be rendered independently with no coupling.

### Performance mode compliance (Hard Spec #12)
- `apiPollingEnabled` from `PerformanceContext` is `false` in Lite mode
- All three API widgets check this flag: in Lite they do a single one-time fetch (on mount) only — no `setInterval` at all
- Widgets show "Polling paused (Lite mode)" label so user knows why data isn't auto-refreshing

### Calculator shortcut (Alt+N)
- Verified against all shortcuts in Section 15: Alt is used for Alt+1, Alt+2 (format toggle) only. `N` is not used with Alt anywhere. Zero conflict.
- History in `localStorage` survives app restart (Electron dev mode) — in production will also survive since Electron persists localStorage to AppData.

---

## Config fields added to `AppConfig`

```typescript
weatherCity:    string   // default: 'Mumbai'
cryptoCurrency: string   // default: 'inr'
cryptoIds:      string[] // default: 5 coins
forexPairs:     Array<{ from: string; to: string }> // default: 5 pairs
```

---

## Known Issues / Notes

- **CoinGecko rate limit:** The free tier allows ~50 calls/min. With 5 coins per call, this is effectively unlimited for our polling intervals (30s minimum). No key needed unless the app sees extremely heavy usage.
- **Open-Meteo AQI:** Uses European AQI (EAQI) scale. Indian AQI (NAQI) scale is different. This is acceptable for the dashboard overview; the label makes the scale clear.
- **Frankfurter gap:** Frankfurter is ECB-backed and doesn't include some exotic currency pairs (e.g. direct PKR, BDT). The 5 defaults (USD/INR, EUR/INR, GBP/INR, USD/EUR, AED/INR) all work perfectly.
- **Calculator history in Electron:** `localStorage` persists in Electron's renderer process (Chromium). This is safe and survives restarts. In the future, if needed, can migrate to IPC-based storage.

---

## Handoff State

All Phase 3a-B DB widgets remain untouched and fully working.  
Phase 3b-i is additive only — no existing file was broken.  
All widgets self-hide if `widgetVisibility[key] === false` in Settings.  
Performance mode respected across all 3 API widgets.

**Next phase:** 3b-ii (additional dashboard features per masterplan)
