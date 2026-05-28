# Phase 1b-B — Sidebar Navigation Shell

**Built:** May 2026  
**Session:** 6 of 38  
**Status:** ✅ Complete

---

## What Was Built

### NavigationContext (`src/renderer/contexts/NavigationContext.tsx`)
- Central navigation state with `activePage: PageId` and `setActivePage()`
- `ALL_PAGES` array defines all 6 pages with id, label, shortcut key, icon, and phase
- **Ctrl+1–6 global keyboard shortcuts** wired via `window.addEventListener('keydown')` — active from anywhere in the app; no component needs to wire this separately
- `useNavigation()` hook for clean consumption
- Provider wraps NavigationProvider inside FeatureFlagProvider, outside AppShell

### Sidebar (`src/renderer/components/Sidebar.tsx`)
- Fixed 220px left sidebar; height: 100vh
- **cQikly** branding header with accent color
- 6 navigation buttons with:
  - SVG icon (custom, no extra deps)
  - Label text
  - `^N` shortcut hint (right-aligned, muted)
  - Active state: accent background + white text
  - Hover state: surface background
  - `title` attr shows full shortcut on hover
- **Dark/Light toggle** — instant, persists via ThemeContext localStorage
- **Theme selector dropdown** — 6 themes, all immediately swappable; active theme highlighted
- **Performance mode dropdown** — Lite / Balanced / Ultra; active mode highlighted
- Both dropdowns stack upward (position: absolute; bottom: 100%) to avoid overflow

### AppShell (`src/renderer/components/AppShell.tsx`)
- Root layout: `display: flex` — Sidebar (220px) + main area (flex: 1)
- **PageContent** component maps `activePage` → correct page component
- **DarkRainbowAnimator** — when `themeId === 'dark-rainbow'` AND `animationsEnabled`:
  - Uses `requestAnimationFrame` to slowly cycle `--cq-accent` and `--cq-glow` through full hue spectrum
  - Stops and resets to base purple when perf mode = Lite or theme changes
- **ThemeAccentLayer** — injects CSS keyframe animations for Sakura drift + Neon pulse in Balanced/Ultra; cleans up on theme or perf mode change

### 6 Placeholder Pages
Each page uses `PlaceholderPage` component with:
- Generous padding (2.5rem 3rem)
- Page header with icon, title, number, shortcut
- Subtitle describing the page purpose
- "Coming in phase X" info card
- Features table listing every planned feature with the phase it arrives in
- **Live status strip** showing real context values (theme, variant, performance mode, animations enabled, API polling) — proves context wiring works

Pages built:
1. **New Quote** (Ctrl+1) — billing grid features listed, phases 4a-4b-5a-5b-6a
2. **History** (Ctrl+2) — bill history, versioning, search
3. **Customer Details** (Ctrl+3) — customer DB, auto-create, transport
4. **Inventory** (Ctrl+4) — product catalogue, price columns
5. **Loose Inventory History** (Ctrl+5) — stock movement ledger
6. **Settings** (Ctrl+6) — all settings, shows already-wired features marked ✓

### Performance Mode — UI Layer Wiring
- `usePerformance()` → `animationsEnabled`, `apiPollingEnabled` consumed throughout
- **Lite mode**: `animationsEnabled = false` → DarkRainbowAnimator stops; ThemeAccentLayer removes CSS keyframes; all visual animations cease
- **Lite mode**: `apiPollingEnabled = false` → weather/crypto/forex polling stops (services not yet built but flag is correct)
- **Balanced/Ultra**: animations run; polling at 2min/30sec intervals
- PlaceholderPage shows live `animationsEnabled` and `apiPollingEnabled` values so Lite mode effect is immediately visible

### Dark/Light Toggle
- Single button in sidebar footer
- Calls `ThemeContext.toggleVariant()` → immediately updates CSS vars on `:root` → instant repaint, zero flicker
- Persists via `localStorage` (existing ThemeContext behaviour)
- All 6 themes × 2 variants: 12 total CSS variable sets all work

### Theme Visual Differences (verified from `themes/index.ts`)
All 6 themes produce clearly distinct visuals:
| Theme | Bg Color | Accent | Character |
|---|---|---|---|
| Space Particles | `#050b18` deep space | `#3b82f6` blue | Default |
| Sakura | `#0f0710` / `#fff5f8` light | `#e8699a` pink | Delicate |
| Minimal | `#121212` / `#fafafa` | `#d4d4d4` greyscale | Clean |
| Dark Rainbow | `#0a0710` | cycles hue via JS | Animated |
| Neon | `#030a0e` | `#00f5d4` cyan + magenta | Cyberpunk |
| Dark Rose | `#0f0710` | `#c4648a` rose | Romantic |

---

## Decisions Made

1. **NavigationContext over react-router** — Phase 1b was scoped for a sidebar shell without URL routing; react-router-dom is already a dependency and will be wired in a future phase when deep-linking to specific bills/customers is needed. NavigationContext is hot-swappable.
2. **Sidebar width 220px** — matches the generous spacing rule; fits all 6 labels + shortcut hints without truncation
3. **Theme/Perf dropdowns in sidebar** — scope-appropriate for Phase 1b-B; full Settings page wires these same contexts in Phase 11a
4. **DarkRainbowAnimator as null component** — side-effect-only; no DOM node output; clean pattern for animation controllers

---

## Known Issues / TODOs

- `// TODO: [ONBOARDING-GATE]` — onboarding flow added Phase 2a-A; App currently goes straight to AppShell
- `// TODO: [Dashboard]` — Dashboard page (widgets, clock, etc.) built Phase 2a-A/B; currently NewQuote is the landing page
- `// TODO: [ThemeBackground]` — Three.js animated backgrounds (space particles, sakura petals) added Phase 3b-ii; DarkRainbowAnimator is pure CSS/JS, no Three.js
- react-router-dom wired in Phase 2a-A or later when URL-based navigation is needed

---

## Handoff State

- `npm run dev` launches Electron with the full sidebar navigation shell
- Ctrl+1–6 switches pages from anywhere
- Dark/light toggle in sidebar: instant, persists
- Theme selector: all 6 themes visible and switchable
- Performance Lite mode: strips animations and API polling
- All 6 pages show clean placeholder content with planned feature lists
- All Phase 1b-A safety systems (session logger, updater, app lock, crash recovery) remain fully wired and untouched
- Ready for Phase 2a-A: onboarding gate + Dashboard page with widgets

---

> **Next:** Phase 2a-A — Onboarding flow (first-launch gate, firm setup wizard, internet check) + Dashboard page layout
