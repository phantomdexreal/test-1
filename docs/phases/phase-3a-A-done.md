# Phase 3a-A — Done

**Phase:** 3a-A — Dashboard: Layout + Sidebar + Clock + To-Do + System Status + Background Theme  
**Completed:** 2026-05  
**Status:** ✅ Complete

---

## What Was Built

### 1. Dashboard Page (`pages/Dashboard/index.tsx`)

Full dashboard layout shell with:
- Animated page-level container with `position: relative` to layer the Three.js canvas beneath content
- `DashboardHeader` — time-based greeting (Good morning/afternoon/evening), app version badge
- `WidgetGrid` — flex-wrap card layout with generous padding (2.5rem gutter), 2rem row gaps
- `ComingSoonWidget` stubs for all Phase 3a-B and 3b-i widgets — they show/hide per `config.widgetVisibility`, so widget toggles in Settings already work even before the widgets are built
- Design rule enforced: nothing cramped; every element has breathing room

### 2. Space Particles Background (`pages/Dashboard/SpaceParticlesBackground.tsx`)

Three.js particle system:
- **Only active** when `themeId === 'space-particles'` AND `animationsEnabled` (i.e. not Lite mode)
- Returns `null` in Lite mode — zero DOM impact, zero Three.js overhead
- Particle counts: Balanced = 800, Ultra = 2000 (Lite = 0, not mounted)
- 4 semi-transparent nebula sphere meshes behind particles for depth
- Each particle drifts independently with boundary wrapping (no teleport flicker)
- Full cleanup on unmount: `cancelAnimationFrame`, `window.removeEventListener`, `geometry.dispose()`, `material.dispose()`, `renderer.dispose()`
- Resize handler updates renderer + camera aspect ratio
- Canvas positioned as `position: absolute; inset: 0; pointer-events: none; z-index: 0` — completely non-blocking

### 3. Date & Clock Widget (`pages/Dashboard/ClockWidget.tsx`)

- Updates every 1 second via `setInterval`
- 12h format: `H:MM:SS AM/PM`; 24h format: `HH:MM:SS`
- Clock format read from `config.clockFormat` (default: `'12h'`)
- Locale-aware date: uses `en-IN` locale (e.g. "Monday, 25 May 2026")
- Format badge shows current mode (12H / 24H)
- Visibility gate: `config.widgetVisibility.clock === false` → returns null
- Widget card: `var(--cq-surface)` background, `1rem` border radius, generous padding

### 4. To-Do List Widget (`pages/Dashboard/TodoWidget.tsx`)

Per **Hard Spec #24**: unchecked items persist across days; user can only clear manually.

- **Persistence**: `localStorage` (key: `cq:dashboard:todos`) in dev; IPC-ready architecture for Electron
- Items carry over automatically — no auto-expiry, no date-based clearing
- Add item: text input + Enter key or `+` button
- Toggle done/undone: checkbox button per item
- Delete individual item: trash icon button
- Clear completed: "Clear done" button (only visible when ≥1 done items exist)
- Export `clearAllTodos()` function — called from Settings (see below)
- Max visible height: 280px with overflow-y scroll
- Visibility gate: `config.widgetVisibility.todoList === false` → returns null

### 5. System Status Widget (`pages/Dashboard/SystemStatusWidget.tsx`)

- Attempts `window.cqikly.app.getSystemInfo()` IPC call in Electron
- Falls back to `performance.memory` and `navigator.platform` in dev/browser
- Refreshes every 10 seconds
- Shows: Platform, Architecture, Electron version (if available), App Version, Session Uptime
- Memory bar with colour coding: green ≤65%, amber ≤85%, red >85%
- DB status row (stubbed "Local DB · Active" — wired to DBContext in Phase 3a-B)
- Visibility gate: `config.widgetVisibility.systemStatus === false` → returns null

### 6. Dashboard Navigation Wiring

**NavigationContext changes:**
- Added `'dashboard'` as a new `PageId`
- Dashboard appears first in `ALL_PAGES` array
- Default page changed to `'dashboard'` (so app lands on dashboard after onboarding)
- Keyboard shortcut: `Ctrl+\`` (backtick) or `Ctrl+0` → navigate to dashboard
- Existing `Ctrl+1–6` unchanged for the 6 functional pages

**AppShell changes:**
- Added `DashboardPage` import and `'dashboard'` route in `PageContent`

**Sidebar changes:**
- Added `IconDashboard` SVG component (4 small squares / grid icon)
- Added `'dashboard'` entry to `PAGE_ICONS` map
- cQikly logo/title area is now clickable (`onClick → setActivePage('dashboard')`) with pointer cursor
- Dashboard appears as first item in sidebar nav list (above New Quote)

### 7. Settings: To-Do List Clear (Hard Spec #24)

- New "Dashboard" section in Settings with a "Clear Entire To-Do List" button
- Calls `clearAllTodos()` from TodoWidget module
- Button shows green "✓ Cleared" confirmation for 2.5 seconds after click
- Imported `clearAllTodos` from `pages/Dashboard/TodoWidget`

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| `dashboard` added as 7th PageId (not replacing any page) | Clean navigation model; sidebar shows all destinations including home; Ctrl+\` is memorable, doesn't conflict with Ctrl+1–6 |
| SpaceParticles returns `null` in Lite mode | Zero DOM overhead; Three.js not instantiated at all — governance rule: visual systems never block billing |
| Todo persistence via localStorage | Available in both dev and Electron renderer; IPC-bridge pattern ready for Phase 11 when settings IPC is fully built |
| `clearAllTodos()` exported as standalone function | Settings page imports it directly; no prop drilling or context needed for a one-shot clear action |
| Widget visibility stubs already respect `config.widgetVisibility` | Settings toggles work immediately — Phase 3a-B and beyond don't need to add show/hide logic, just the widget component |

---

## File Changes

### New Files
- `src/renderer/pages/Dashboard/SpaceParticlesBackground.tsx`
- `src/renderer/pages/Dashboard/ClockWidget.tsx`
- `src/renderer/pages/Dashboard/TodoWidget.tsx`
- `src/renderer/pages/Dashboard/SystemStatusWidget.tsx`

### Modified Files
- `src/renderer/pages/Dashboard/index.tsx` — full rewrite (was placeholder)
- `src/renderer/contexts/NavigationContext.tsx` — added `'dashboard'` PageId + default page + keyboard shortcuts
- `src/renderer/components/AppShell.tsx` — added DashboardPage import + route
- `src/renderer/components/Sidebar.tsx` — added IconDashboard + PAGE_ICONS entry + clickable logo
- `src/renderer/pages/Settings/index.tsx` — added todo-clear section

---

## Known Issues / Handoff Notes

1. **System Status IPC stub**: `window.cqikly.app.getSystemInfo` is not yet implemented in the main process IPC handlers. Widget falls back gracefully to `performance.memory` values. Full wiring in Phase 11.
2. **Dashboard not in the 6 sidebar nav slots**: Dashboard appears as the 7th entry (home). The masterplan says "6 nav buttons" for the 6 functional pages. Dashboard is accessible via logo click or `Ctrl+\``. This is the correct interpretation — dashboard is the home, not one of the 6 business pages.
3. **Clock format toggle not wired to Settings UI yet**: Settings toggle will be built in Phase 11a-ii. Clock format already reads from `config.clockFormat` so it will work automatically once the Settings UI provides the toggle.
4. **Three.js import**: Imported synchronously. Vite tree-shakes unused Three.js modules. If bundle size is a concern in Phase 14, convert to dynamic import.

---

## Test Checklist

- [x] Dashboard renders after onboarding complete (default page = 'dashboard')
- [x] Ctrl+\` navigates to dashboard from any page
- [x] Ctrl+1–6 still navigate to the 6 functional pages
- [x] cQikly logo in sidebar is clickable → goes to Dashboard
- [x] Clock shows correct time; switches format when `config.clockFormat` changes
- [x] To-do items added via Enter key and button
- [x] To-do items checked/unchecked; done items crossed out
- [x] To-do items persist after page navigation (localStorage)
- [x] "Clear done" button removes checked items
- [x] Settings → "Clear Entire To-Do List" calls `clearAllTodos()`, shows confirmation
- [x] System Status widget shows platform, uptime, memory bar
- [x] SpaceParticlesBackground canvas appears over dark bg in balanced/ultra
- [x] In Lite mode → canvas not rendered, no Three.js overhead
- [x] Switching to non-space-particles theme → canvas not rendered
- [x] Widget stubs show "Coming in Phase X" labels for future widgets
- [x] All widget visibility toggles in config.widgetVisibility respected
