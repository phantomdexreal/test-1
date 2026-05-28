# Phase 2a-B — Onboarding Wizard — Done

## What Was Built

Full multi-step onboarding wizard replacing the Phase 2a-A placeholder stub.

### Files Changed
- `src/renderer/pages/Onboarding/OnboardingWizard.tsx` — **NEW** — complete wizard component (~600 lines)
- `src/renderer/pages/Onboarding/index.tsx` — updated to wire in real wizard and handle completion

### Wizard Steps (9 total)

| Step | Title | Required Fields |
|------|-------|----------------|
| 1 | Firm Identity | Name of Firm, Nature of Firm |
| 2 | Business Profile | Nature of Business (if product), Business Model |
| 3 | Legal & Address | Company Address (GST optional but validated if entered) |
| 4 | Office Setup | Head Office / Branch selection |
| 5 | Cloud Sharing | Yes / No selection |
| 6 | Contact Info | Phone (email + website optional) |
| 7 | Company Logo | File picker with drag & drop (fully optional) |
| 8 | Billing Preferences | FY Start Month, Bill Reset Cycle, Starting Bill Number |
| 9 | Confirmation | Full summary + Confirm & Start CTA |

### Features Implemented
- **Full step navigation** — forward and back with animated transitions (slide in/out)
- **Data preservation** — all fields preserved across back/forward navigation via single `OnboardingData` state object at wizard root
- **Per-step validation** — required fields block Next; errors shown inline below field with red highlighting
- **Progress bar** — animated fill + step dot indicators with icons
- **Exit confirmation dialog** — warns before discarding progress
- **Logo upload** — file picker + drag & drop; base64 preview in-memory; no file system writes
- **Cloud sharing info screen** — contextual banners shown based on Yes/No selection
- **Confirmation screen** — full data summary with all filled fields before final submit
- **`onComplete` callback** — passes full `OnboardingData` object to parent; ready for Phase 2b DB write

### Architecture Decisions
- All data in one `OnboardingData` interface at wizard root — no per-step local state that could be lost
- `update(patch)` callback pattern — each step only updates its own slice
- Step config array drives validation, titles, icons, and subtitles — adding steps requires only one array entry
- No Tailwind dependency — 100% inline styles using design token object `C` for consistency with existing LandingScreen approach
- Scroll on body if step content is tall — `maxHeight: 90vh` with `overflowY: auto` on body

### TODOs Left for Phase 2b
- `[ONBOARDING-INTERNET]` — internet check gate before wizard opens
- `[ONBOARDING-DB-WRITE]` — persist `OnboardingData` to SQLite via `dbService.saveCompanyProfile(data)`
- `[ONBOARDING-REDIRECT]` — navigate to Dashboard after successful completion

### Known Limitations (Phase 2a-B scope)
- No DB writes — data lives in memory only (by design for this phase)
- Completion screen is a dev placeholder — Phase 2b replaces with Dashboard redirect
- Logo stored as base64 DataURL in memory — Phase 2b should write to AppData and store path

## Handoff State
App fully runnable. Landing screen Three.js animation works. Clicking "cQikly" opens the 9-step wizard. All fields collectible, validated, navigable. Wizard completion logs data to console. Ready for Phase 2b DB integration.
