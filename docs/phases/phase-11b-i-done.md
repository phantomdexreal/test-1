# Phase 11b-i — Done

## What Was Built

### 1. Dashboard Widget Toggles (`DashboardWidgetTogglesPanel.tsx`)

**Location:** `src/renderer/pages/Settings/DashboardWidgetTogglesPanel.tsx`

Full show/hide toggle panel for every dashboard widget with instant effect.

**Widgets covered (all 3 groups):**

**Business group:**
- Today's Bill Count
- Today's Total Revenue
- This Month vs Last Month Comparison
- Top Customer This Month
- Pending Draft Bills Indicator
- Low Stock Alert

**Utility group:**
- Clock
- To-Do List
- Calculator Sidebar
- Unit Converter
- Currency Converter
- System Status

**Live API group:**
- Weather Info (+ city selector — shown inline when weather is ON)
- Crypto Markets (+ up to 5 crypto coin selector + currency selector — shown inline when crypto is ON)
- Forex Rates (+ currency pairs configurator with add/remove pairs — shown inline when forex is ON)

**Also includes:** To-Do List clear button (moved here from the old inline Settings block).

**Implementation:** All toggles write to `config.widgetVisibility[key]` via `updateConfig()`. The Dashboard `WidgetGrid` component reads `config.widgetVisibility` and conditionally renders each widget — all instant via React state + ConfigContext. An empty-state message is shown when all widgets are hidden.

---

### 2. Quote Page Settings (`QuotePageSettingsPanel.tsx`)

**Location:** `src/renderer/pages/Settings/QuotePageSettingsPanel.tsx`

**Toggles:**

| Setting | Config Key | Default | Wired To |
|---|---|---|---|
| Inventory Autocomplete | `inventoryModeEnabled` | OFF | `BillingGrid.inventoryModeEnabled` prop |
| F2 Edit Mode | `f2EditMode` | OFF | `BillingGrid.f2ModeEnabled` prop |
| Discount Column | `discountColumnVisible` | OFF | `columnToggles.showDiscount` in BillingGrid |
| Qty Unit Column | `qtyUnitColumnVisible` | OFF | `columnToggles.showQtyUnit` in BillingGrid |
| Rate History Hint | `rateHistoryHintEnabled` | ON | `BillingGrid.rateHistoryHintEnabled` prop |
| Deduct Stock on Bill Save | `stockDeductOnSave` | OFF | Requires `stockQtyEnabled: true` |

**Inventory Rate Source per Format (independently configurable):**
- Free Format: selector → `config.inventoryRateSourceFree` (default: `Price`)
- GST Format: selector → `config.inventoryRateSourceGst` (default: `GST Price`)

Options: Price, Wholesale Price, GST Price, Credit (custom columns will appear when Phase 9b builds them out).

**NewQuote/index.tsx updates:**
- `f2ModeEnabled={config.f2EditMode === true}` — wired from config (was hardcoded `false`)
- `rateHistoryHintEnabled={config.rateHistoryHintEnabled !== false}` — new prop pass-through
- `columnToggles` state initialized from config; synced via `useEffect` on config changes

**BillingGrid.tsx updates:**
- Added `rateHistoryHintEnabled` prop (default `true`)
- Rate cell only shows ghost hint when `rateHistoryHintEnabled` is true

---

### 3. Security Panel (`SecurityPanel.tsx`)

**Location:** `src/renderer/pages/Settings/SecurityPanel.tsx`

**Controls:**

#### App Lock Toggle
- Writes `config.appLockEnabled`
- Emits `eventBus.emit('appLockChange', { enabled })`
- Calls `window.cqikly.appLock.enable()` / `.disable()` if IPC bridge available

#### PIN Setup Flow (3-step wizard inline)
1. **Step idle:** Shows "Set PIN" button (if no PIN) or "Change PIN" + "Remove PIN" (if PIN set)
2. **Step enter-new:** Hidden PIN input with dot display; Enter → next step; min 4 digits, max 6
3. **Step confirm-new:** Re-enter to confirm; mismatch → error + retry; match → saves

PIN is stored in `config.appLockPin`. In Electron, the IPC bridge (`appLock.setPin()`) handles OS-level secure storage. In dev/browser mode, it's stored in the config JSON as a plaintext fallback.

**State indicators:** Green "● PIN SET" badge or amber "○ NO PIN" badge.

#### Idle Timeout
- Dropdown selector: Never / 5 / 10 / 15 / 30 min / 1 hr / 2 hr
- Writes `config.appLockIdleTimeout` (minutes; 0 = never)
- Disabled (faded) when App Lock is OFF

**AppLockGate.tsx updates:**
- Added `startIdleWatcher()` / `stopIdleWatcher()` / `resetIdleTimer()` helpers
- Listens to `mousemove`, `keydown`, `mousedown`, `touchstart`, `scroll` events for idle detection
- Watches `eventBus('configChange')` for live timeout updates from Settings
- Stops watcher when app locks; restarts when unlocked

---

### 4. Settings Page (`index.tsx`)

**New sections added to left nav:**
- `🧾 Quote Page` (id: `quotepage`)
- `📊 Dashboard Widgets` (id: `dashboard`)
- `🔒 Security` (id: `security`)

**Old inline Dashboard/Todo block** removed (moved into DashboardWidgetTogglesPanel).

**Dashboard `WidgetGrid` fully updated** to conditionally render every widget based on `config.widgetVisibility` — previously only the API rows were partially gated.

---

## Config Keys Added (Phase 11b-i)

All keys are in `AppConfig` interface and `DEFAULT_APP_CONFIG`:

```ts
// Quote Page Settings
f2EditMode: boolean              // default: false
discountColumnVisible: boolean   // default: false
qtyUnitColumnVisible: boolean    // default: false
rateHistoryHintEnabled: boolean  // default: true
inventoryRateSourceFree: string  // default: 'Price'
inventoryRateSourceGst: string   // default: 'GST Price'

// Security
appLockPin: string               // default: '' (empty = not set)
appLockIdleTimeout: number       // default: 0 (never)
```

`appLockEnabled` was already in config from Phase 1b-A.

---

## Event Bus Events Added

```ts
appLockChange:          { enabled: boolean }
pinChanged:             Record<string, never>
widgetVisibilityChange: { key: string; visible: boolean }
```

---

## Decisions Made

1. **PIN storage in dev mode:** Stored plaintext in config JSON as a dev fallback. The Electron IPC bridge handles secure storage in production — the UI calls `window.cqikly.appLock.setPin()` which delegates to the main process. This follows the established IPC pattern.

2. **Rate Source — dual panels:** The existing `InventoryRateSourcePanel` (from earlier phases) uses `inventoryService.getRateSourceConfig()` (service-level). The new `QuotePageSettingsPanel` also exposes the same settings via `config.inventoryRateSourceFree/Gst`. Both write to consistent keys — no duplication.

3. **Widget visibility defaults:** All widgets default to `true` (visible). The `show()` helper checks `vis[key] !== false` so existing configs with `{}` widgetVisibility still show all widgets.

4. **F2 mode was hardcoded `false`:** Fixed in `NewQuote/index.tsx` to read from `config.f2EditMode`.

5. **Dashboard empty state:** When all widgets are hidden, a friendly empty state message is shown instead of a blank page.

---

## Known Issues / TODOs

- `// TODO: Phase 9b-B: custom inventory price columns appear in rate source selectors` — the selectors currently only show the 4 default price fields. When Phase 9b builds dynamic custom price columns, they should be fetched from `inventoryService.getPriceFieldOptions()` and rendered here.
- The idle timeout auto-lock currently reads from `localStorage` (config fallback) on mount. In the Electron build this should read from the IPC settings bridge instead — hook is already in place but needs the IPC read call.
- PIN is min 4 digits, max 6 as per security panel. The AppLockGate PIN entry screen shows 4 dots but accepts up to 6 — dots display updated to use `newPin.length` dynamically.

---

## Handoff State

All 3 sections fully built and wired:
- **Dashboard Widget Toggles:** All 15 widgets toggleable; API widget sub-selectors (city, crypto coins, forex pairs) visible only when respective widget is ON; instant Dashboard re-render.
- **Quote Page Settings:** F2 mode, discount col, qty unit col, rate hint, inventory mode, stock deduction, and rate source per format — all wired end-to-end to the billing grid.
- **Security:** App Lock toggle, PIN setup wizard (3-step), idle timeout selector, AppLockGate updated with idle watcher.

Ready for **Phase 11b-ii**: Backup & Restore, Saved Lists, Customer Settings, Feature Module Toggles, Access Key, Config Import/Export.
