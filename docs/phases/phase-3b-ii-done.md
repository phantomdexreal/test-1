# Phase 3b-ii — Done

## What Was Built

### 6 Fully Animated Themes

All 6 themes are now fully implemented with complete visual designs, dark/light variants, and performance tier awareness.

---

### Theme Implementations

#### 1. Space Particles (`space-particles`) — Already complete in 3a-A
- Three.js deep-space particle system
- 800 particles (Balanced) / 2000 particles (Ultra) / null (Lite)
- Nebula glow sprites, slow camera drift
- Dark/light: deep navy vs light blue

#### 2. Sakura Flowers (`sakura`) — NEW in 3b-ii
- **File:** `Dashboard/SakuraBackground.tsx`
- Pure 2D Canvas API (no Three.js) — lightweight elegance
- 40 petals (Balanced) / 90 petals (Ultra) / null (Lite)
- Each petal: 5-lobe rose shape drawn with `quadraticCurveTo`, radial gradient fill
- Petals sway, rotate, drift downward, wrap around edges
- Dark variant: semi-transparent rose/pink (#e8698a) on deep dark bg
- Light variant: deeper pink (#d63864) on soft light bg
- Ultra adds occasional gusts via sway amplitude

#### 3. Minimal (`minimal`) — Intentionally no animation
- Returns `null` from `ThemeBackground` — by design
- CSS variables provide clean flat background in both dark/light
- Best for low-end devices; Lite mode users will feel at home here

#### 4. Dark Rainbow (`dark-rainbow`) — NEW in 3b-ii
- **File:** `Dashboard/DarkRainbowBackground.tsx`
- Zero canvas, zero Three.js — pure CSS custom property animation via RAF
- On each frame: updates `--cq-bg-primary`, `--cq-bg-secondary`, `--cq-accent`, `--cq-glow`, `--cq-accent-light`, `--cq-border`, `--cq-surface`, `--cq-surface-raised` on `:root`
- Full 360° hue cycle: 120s (Balanced) / 60s (Ultra)
- Because ALL UI elements use these CSS vars, every border, button, text accent, and surface phase-shifts with the background — no component changes needed
- On unmount: CSS vars removed so static theme vars take over instantly
- Dark variant: deep dark HSL tints; Light variant: soft pastel tints

#### 5. Neon (`neon`) — NEW in 3b-ii
- **File:** `Dashboard/NeonBackground.tsx`
- Multi-layer approach:
  - **Scanlines canvas** (Balanced + Ultra): subtle horizontal line overlay at opacity 0.08 per line
  - **Neon glow pulse** (Balanced + Ultra): RAF loop updating `--cq-glow` and `--cq-accent` with slow color rotation through cyan → magenta → lime → electric blue; intensity flicker via `sin(t)`
  - **Three.js neon grid** (Ultra only): perspective floor grid (`GridHelper`), floating neon bars at 35% opacity behind content
- CSS keyframes injected: `cq-neon-pulse` for `.cq-neon-glow` elements
- CSS selectors in `index.css`: focused inputs/buttons get `box-shadow: 0 0 0 2px var(--cq-glow)` when `data-cq-theme="neon"`

#### 6. Dark Rose (`dark-rose`) — NEW in 3b-ii
- **File:** `Dashboard/DarkRoseBackground.tsx`
- 2D Canvas with 3 element types: petal (teardrop bezier), circle (radial gradient glow), ring (stroke arc)
- 25 elements (Balanced) / 50 elements (Ultra)
- All elements drift slowly in random directions, wrap, pulse in size via `sin`
- Ultra mode also runs `useRoseShimmer`: RAF loop updating `--cq-accent` and `--cq-glow` with a slowly shifting hue (±15° around 330)
- CSS keyframe: `cq-rose-shimmer` injected for shimmer effects

---

### ThemeBackground Dispatcher
- **File:** `Dashboard/ThemeBackground.tsx`
- Single point of entry: `<ThemeBackground />` replaces the old `<SpaceParticlesBackground />` in Dashboard
- `switch(themeId)` selects the correct component
- Each component is keyed by theme ID, so React unmounts/mounts cleanly on theme switch — zero orphaned RAF loops

### Settings Page — Live Theme & Performance Controls
- **ThemePanel**: 6-button grid; click switches theme instantly; shows active checkmark
- **PerformancePanel**: 3-button set (Lite/Balanced/Ultra); switches live with zero reload
- Dark/Light toggle button in ThemePanel header
- Both panels use CSS vars for their own styling so they theme-shift correctly when you switch

### AppShell
- Added `data-cq-theme={themeId}` attribute on root div — enables CSS selectors targeting specific themes
- Removed old `DarkRainbowAnimator` (superseded by `DarkRainbowBackground`)
- Removed old `ThemeAccentLayer` (superseded by `ThemeKeyframeInjector`)
- `ThemeKeyframeInjector` injects theme-specific `@keyframes` once per theme switch; cleans up on unmount

### PerformanceContext
- Now sets `--cq-anim-enabled` CSS var (`"1"` or `"0"`) on `:root` on every mode change
- Also set on mount from `initialMode`
- The CSS rule in `index.css` pauses all CSS animations and disables transitions when `--cq-anim-enabled: 0`

---

## Architecture: How Zero-Flicker Works

1. `ThemeContext.applyThemeToDom()` sets ALL CSS vars synchronously on `:root` in one batch before React re-renders
2. Components subscribe to `themeId` — ThemeBackground unmounts old canvas, mounts new one
3. The new canvas starts transparent and fades in; the CSS background is already correct
4. For Dark Rainbow: CSS vars are updated every RAF frame; removing them on unmount restores static vars instantly
5. For performance mode changes: `PerformanceContext.setMode()` sets `--cq-anim-enabled` immediately, then React state updates cascade

---

## Performance Mode Behavior Per Theme

| Theme | Lite | Balanced | Ultra |
|---|---|---|---|
| Space Particles | null (canvas not mounted) | 800 particles | 2000 particles + nebula |
| Sakura | null | 40 petals | 90 petals |
| Minimal | null (by design) | null (by design) | null (by design) |
| Dark Rainbow | null (RAF not started) | 120s hue cycle | 60s hue cycle |
| Neon | null | Scanlines + glow pulse | Scanlines + glow pulse + Three.js grid |
| Dark Rose | null | 25 elements | 50 elements + accent shimmer |

**In ALL cases: billing operations run at full speed regardless of performance mode.**

---

## Files Added/Modified

### New Files
- `src/renderer/pages/Dashboard/SakuraBackground.tsx`
- `src/renderer/pages/Dashboard/DarkRainbowBackground.tsx`
- `src/renderer/pages/Dashboard/NeonBackground.tsx`
- `src/renderer/pages/Dashboard/DarkRoseBackground.tsx`
- `src/renderer/pages/Dashboard/ThemeBackground.tsx`

### Modified Files
- `src/renderer/pages/Dashboard/index.tsx` — uses `<ThemeBackground />` instead of `<SpaceParticlesBackground />`
- `src/renderer/pages/Settings/index.tsx` — ThemePanel + PerformancePanel added
- `src/renderer/components/AppShell.tsx` — `data-cq-theme` attr; removed old animators; ThemeKeyframeInjector
- `src/renderer/contexts/PerformanceContext.tsx` — sets `--cq-anim-enabled` CSS var on mode changes
- `src/renderer/index.css` — neon focus/hover glow CSS; perf Lite animation pause rule; theme-specific selectors

---

## Known Issues / Handoff Notes

- **Dark Rainbow in non-Dashboard pages**: The `DarkRainbowBackground` only runs inside Dashboard. Pages like NewQuote/History still benefit from CSS vars being updated (since the vars cascade to all UI elements), but the background canvas/RAF is only active when Dashboard is mounted. To apply the hue shift globally, the component could be moved to AppShell — deferred to Phase 11+ when full Settings wiring happens.
- **Neon Three.js grid**: Only visible when performance mode is Ultra AND theme is Neon. On Balanced, the scanlines + CSS glow pulse are active without the 3D grid. This is correct per spec.
- **Light variants of animated themes**: CSS vars correctly switch (tested in ThemePanel). Some animations (e.g. Sakura petal colors) read `variant` from useTheme and re-initialize their canvas loops correctly.
- **PerformanceContext initialMode**: If ConfigContext loads a saved mode from localStorage later than PerformanceProvider's mount, the CSS var may briefly show `--cq-anim-enabled: 1` before Lite mode kicks in. This will be resolved in Phase 11 when Config is fully wired.

---

## Test Checklist
- [ ] Switch to each of the 6 themes from Settings → background changes instantly, zero flicker
- [ ] Toggle Dark/Light variant → CSS vars update instantly, canvas re-initializes with correct colors
- [ ] Switch to Minimal → canvas disappears, flat background remains
- [ ] Dark Rainbow → hue slowly cycles; all UI elements (borders, buttons, accents) shift with it
- [ ] Neon (Balanced) → scanlines visible, buttons pulse on hover
- [ ] Neon (Ultra) → Three.js floor grid visible below content
- [ ] Set Performance to Lite → all animations stop; background canvases unmount
- [ ] Set Performance to Balanced → moderate animations resume
- [ ] Set Performance to Ultra → full Three.js active
- [ ] Switch performance mode while Dark Rainbow is active → animation stops/resumes without reload
- [ ] Navigate between pages while Sakura/Neon active → no memory leaks (RAF cancelled on unmount)

---

*Phase 3b-ii complete. All 6 animated themes fully implemented with dark/light variants and performance tier awareness.*
