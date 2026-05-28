# Phase 2a-A — Done

**Phase:** 2a-A  
**Built:** Three.js Animated Landing Screen  
**Date:** May 2026  

---

## What Was Built

### 1. `LandingScreen.tsx` — `src/renderer/pages/Onboarding/LandingScreen.tsx`

Full-screen animated deep-space landing screen shown on first launch.

**Three.js particle system (Balanced/Ultra):**
- 3,000 particles (Balanced) / 7,000 particles (Ultra) as a deep-space star field
- Stars rendered with a soft radial sprite texture via CanvasTexture
- Vertex-coloured stars: white, pale blue, warm orange, lavender, faint rose
- Star field drifts slowly via `rotation.x/y` each frame
- Mouse parallax: camera position follows cursor with smooth lerp
- Shooting stars spawn periodically (random angle, fade out over life)
- Ultra-only: four nebula colour overlay quads (PlaneGeometry) using additive blending
- Twinkling: star material opacity oscillates gently via Math.sin

**Lite mode (no Three.js):**
- Pure CSS radial-gradient deep-space background
- 120 static star dots positioned randomly via inline styles
- Zero JS animation — fully compliant with Hard Spec #12

**`cQikly` title:**
- Gradient text (white → lavender → indigo) via `WebkitBackgroundClip`
- Floating animation (`cq-title-float`) — 14px vertical bob, 5s cycle
- Lite mode: slow CSS opacity pulse only (no translateY)
- On hover: scale(1.06), brighter text-shadow glow
- Three decorative lines below: subtitle, click hint, glow bar
- Click hint blinks and floats upward (Balanced/Ultra) / pulses opacity (Lite)

**Orbital rings (Balanced/Ultra):**
- Three concentric rotating rings with animated dot markers
- Outer: 40s CW, purple dot at top
- Middle: 28s CCW, indigo dot at bottom  
- Inner: 18s CW, no dot

**Click trigger:**
- Clicking anywhere on the title div fires `onOpenWizard()`
- Hover state gives immediate visual feedback

**Performance badge:**
- Top-right corner shows active performance tier at low opacity

---

### 2. `OnboardingWizardPlaceholder.tsx` — `src/renderer/pages/Onboarding/OnboardingWizardPlaceholder.tsx`

Placeholder wizard overlay shown when user clicks "cQikly" on the landing screen.
- Blurred backdrop overlay
- Styled card with cQikly branding, description, "Back to Landing" button
- Clearly marked with TODO comment for Phase 2a-B replacement

---

### 3. `Onboarding/index.tsx` (updated)

Orchestrates `landing → wizard` state machine.
- `stage: 'landing'` (default) → shows LandingScreen
- `stage: 'wizard'` → overlays OnboardingWizardPlaceholder
- TODOs stubbed for Phase 2a-B (full wizard), Phase 2b (internet check + DB write + redirect)

---

### 4. `App.tsx` (updated)

Added `RootContent` component with onboarding gate:
- If `config.onboardingComplete === false` → renders `<OnboardingPage />`
- Otherwise → renders full `<AppShell />` with NavigationProvider + safety overlays
- NavigationProvider moved inside the post-onboarding branch (correct: nav shortcuts only needed in the main app)

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Three.js in renderer process | Correct for Electron + Vite stack; no main-process involvement needed |
| CanvasTexture sprite for stars | Soft glow effect; cheap; avoids PNG dependency |
| Vertex colours on PointsMaterial | Zero extra draw calls for colour variety |
| AdditiveBlending throughout | Correct for space aesthetics; bright on dark |
| `animationsEnabled` from PerformanceContext | Single source of truth; live hot-swap works |
| Static star dots in Lite mode | Pure CSS/HTML; zero canvas; true Lite compliance |
| Keyframes injected via `<style>` tag | Avoids Tailwind; works without Framer Motion dependency in Lite mode |
| Onboarding gate in `RootContent` | Keeps App.tsx clean; gate is trivially removable when onboarding is done |

---

## Performance Compliance (Hard Spec #12)

| Mode | Three.js | Framer Motion | Behaviour |
|---|---|---|---|
| Lite | ❌ Not rendered | ❌ Not used | Static gradient bg + static dots + CSS pulse on text |
| Balanced | ✅ 3,000 particles | ❌ Not used | Full particle system + orbital rings + shooting stars |
| Ultra | ✅ 7,000 particles + nebula | ❌ Not used | Full particle system + nebula quads + orbital rings + shooting stars |

Framer Motion is not used in this component at all — CSS animations handle all motion, keeping the dependency optional.

---

## Known Issues / Limitations

- The static star dot positions in Lite mode are calculated at component mount using `Math.random()`. They are stable for the lifetime of the component but not seeded. This is fine — it's just a background.
- Three.js `@types/three` version is pinned at `^0.166.0` matching the installed Three.js `^0.166.1`. If Three.js is upgraded, types should be updated.
- Shooting stars use a cloned `LineBasicMaterial` per shooter. This is fine for a small number of concurrent shooters (typically 0-3) but would need pooling at very high spawn rates.

---

## Handoff State

- Landing screen is fully functional and wired
- `npm run dev` → shows landing screen (because `onboardingComplete: false` by default)
- Clicking "cQikly" opens wizard placeholder
- Performance mode toggle (from Settings page, accessible if you manually set `onboardingComplete: true` in localStorage) correctly switches Lite/Balanced/Ultra instantly
- All TODOs for Phase 2a-B and 2b are documented in code and above

---

## Next: Phase 2a-B

Build the complete multi-step onboarding wizard with all fields, validation, and step navigation. Replace `OnboardingWizardPlaceholder` with `OnboardingWizard`. No DB writes yet — data stays in memory on the confirmation screen.
