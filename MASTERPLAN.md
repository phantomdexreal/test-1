# cQikly — MASTERPLAN
> **Version:** 2.9 | **Last Updated:** May 2026
> **Execution Model:** AI-driven, Claude Sonnet 4.x per session, one phase per session

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Core Principles](#3-core-principles)
4. [Governance & Conflict Resolution Rules](#4-governance--conflict-resolution-rules)
5. [Architecture: Hot-Swappable System](#5-architecture-hot-swappable-system)
6. [Performance Tiers](#6-performance-tiers)
7. [Onboarding Flow](#7-onboarding-flow)
8. [Dashboard Page](#8-dashboard-page)
9. [Page 1 — New Quote](#9-page-1--new-quote)
   - [Toolbar Features](#91-toolbar-features)
   - [Party Details & Bill Numbering](#92-party-details--bill-numbering)
   - [Billing Grid Table](#93-billing-grid-table)
   - [Footer Tools](#94-footer-tools)
   - [PDF Generation System](#95-pdf-generation-system)
   - [Copy Image & Quick Print](#96-copy-image--quick-print)
   - [Inventory Mode on Quote Page](#97-inventory-mode-on-quote-page)
10. [Page 2 — History](#10-page-2--history)
11. [Page 3 — Customer Details](#11-page-3--customer-details)
12. [Page 4 — Inventory](#12-page-4--inventory)
13. [Page 5 — Loose Inventory History](#13-page-5--loose-inventory-history)
14. [Page 6 — Settings](#14-page-6--settings)
15. [Global UX, Navigation & Keyboard Shortcuts](#15-global-ux-navigation--keyboard-shortcuts)
16. [Future / Boolean-Gated Modules (Stubbed from Day One)](#16-future--boolean-gated-modules-stubbed-from-day-one)
17. [AI Execution Rules Per Session](#17-ai-execution-rules-per-session)
18. [Testing Rules Per Phase](#18-testing-rules-per-phase)
19. [Documentation Rule for New Features](#19-documentation-rule-for-new-features)
20. [Phase Plan](#20-phase-plan)

---

## 1. PROJECT OVERVIEW

| Field | Value |
|---|---|
| **App Name** | cQikly |
| **Type** | Distributable desktop billing & business management application |
| **Shell** | Electron (Windows only for all planned phases; macOS/Linux are future considerations, not in current scope) |
| **Primary Users** | Indian SMBs — wholesale, retail, production, B2B, B2C, C2C |
| **Offline First** | 100% functional forever with zero internet |
| **Cloud Sync** | Supabase — admin provisioned only, invisible to regular users (future) |
| **Current Sync** | Offline drag-and-drop DB sync only (Phase 1 priority) |
| **Build Output** | Installable `.exe` / platform installer via `electron-builder` |
| **Dev Test** | Must be testable via `npm run dev` without compiling to `.exe` |
| **Coding Style** | 100% AI-coded; human guides sessions; industry-level structure, instantly readable and modifiable |

---

## 2. TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Desktop Shell | Electron |
| Animations | Three.js + Framer Motion |
| Local Database | SQLite via `better-sqlite3` |
| Cloud Sync | Supabase (admin provisioned only; offline drag-drop sync for now) |
| Excel I/O | SheetJS |
| Fuzzy Search | Fuse.js |
| Build/Installer | electron-builder |
| Service Layer | `services/` folder — ALL external calls abstracted here, zero direct DB/API calls from components |

---

## 2.5 LOCKED HARD SPECS (Q&A RESOLVED — DO NOT DEVIATE)

These were explicitly confirmed by the product owner. Claude must never guess or override these. Every session must re-read this section before writing any related code.

| # | Topic | Hard Spec |
|---|---|---|
| 1 | **MKD separator logic** | Only `-` and `=` are valid separators. `+` is treated as plain text, never a separator. Entries with no separator (e.g. `1024`, `black`) count as **qty = 1**. Entries with a separator sum the numeric value after it (e.g. `1024-2` → qty 2, `black=3` → qty 3). MKD sums all qty values per named group. |
| 2 | **MKD column/group names** | The Show MKD dialog uses the **actual user-defined column header name** and the **actual user-typed marked cell text** as group names. The word "custom" is never hardcoded anywhere — it was only an example in the screenshot. |
| 3 | **Bill number on year reset** | On financial year reset (April 1st by default, configurable), bill number **always restarts from 1**. The user-configured starting number (set during onboarding for migration) is a **one-time-only** setting used only for the very first run — it does NOT repeat on subsequent year resets. Each new year always starts from 1 with a new year prefix. |
| 4 | **Auto-create customer from quote page** | When a new party name is saved for the first time via a bill, **all fields filled** on the quote page are automatically saved to Customer Details — party name, phone, transport name, and any expanded fields (address, GSTIN, notes etc.) the user filled. This is **fully automatic with no save button** — it happens silently on bill save. |
| 5 | **F2 edit mode behaviour** | When F2 mode is ON: navigating to a cell with arrow keys does NOT enter edit mode. **Typing does nothing** until the user presses F2. Pressing F2 unlocks the cell for editing with the cursor placed inside the existing content (does not erase it). This is strict Excel-style cell locking. When F2 mode is OFF: navigating to a cell and typing immediately replaces the cell content. |
| 6 | **Sl.No column** | Purely auto-calculated. **Never manually editable** under any circumstance. No override possible. |
| 7 | **Crash recovery drafts** | Only the **single most recent unsaved draft** is recoverable on next launch. If multiple bills were in progress, only the last one is recovered. |
| 8 | **Simplified PDF format** | Intentionally contains **zero company information** — no company name, no logo, no address. Header is only `{Customer Name} - {Customer Contact}`. This is by design and is not configurable. |
| 9 | **Database structure** | **Separate SQLite file per company profile / branch**. The DB connection manager swaps the active file when switching profiles or branches. One config/settings DB separate from business data DBs. |
| 10 | **Bill edit versioning** | **Every single edit** to a saved bill creates a preserved version with the original intact — no exceptions, no time threshold, no conditions. Even a one-character typo fix creates a version. |
| 11 | **WhatsApp quick share target** | The preferred method (WhatsApp Desktop deep link vs WhatsApp Web) is **user-configurable in Settings**. No hardcoded default. |
| 12 | **Performance Lite mode scope** | Lite mode kills **both** visual animations (Three.js, Framer Motion) **AND** all background API polling (weather, crypto, forex). Balanced keeps moderate animations and moderate polling. Ultra runs everything at full. |
| 13 | **Target platform** | **Windows only** for Phase 1 through all planned phases. macOS/Linux are future considerations, not in scope. |
| 14 | **Row expansion trigger** | New rows are added **only** when the user presses **Enter or Down arrow** while on the last row. Tab key does NOT trigger row expansion. |
| 15 | **PDF page split logic** | Simplified: A5 up to 40 rows → if exceeded, one long A4 up to 80 rows → if exceeded, splits into multiple A4 pages. Professional: A5 up to 30 → A4 up to 60 → multi-page A4. Detailed Professional: A5 up to 20 → A4 up to 40 → multi-page A4. |
| 16 | **Config file import scope** | Importing a config file from another device **preserves the local company profile** (firm name, address, logo, GST, branches, contact info). Everything else (themes, toggles, shortcuts, PDF settings, all other preferences) is **replaced** by the imported config. |
| 17 | **Transport name per customer** | Transport name is stored **per customer** as "most recently used transport". When a customer is selected in the quote page, their most recent transport auto-fills. The user can change it freely per bill. Whatever transport is used on the newly saved bill becomes the new stored default for that customer going forward. |
| 18 | **Session activity log location** | The session activity log is a **raw file in the Windows AppData folder** only. It is never surfaced in the app UI in any form. Accessible only by navigating the file system manually. |
| 19 | **Bill Templates** | Templates save **format type + custom column headers only — zero row data**. Templates are fully manageable: create, rename, delete from a template manager panel. Loading a template into a new bill applies the structure only. |
| 20 | **Adjustment rows — negative values** | Adjustment amounts can be **positive or negative**. A negative value (e.g. Advance: -500) reduces the grand total. Both positive and negative adjustments are fully supported. |
| 21 | **Rate History Hint — matching** | Match is **fuzzy**, not exact item name match. Hint is a **ghost placeholder** in the Rate cell. Pressing **Insert** while in the Rate cell accepts the hint and fills it; cursor stays in Rate cell. |
| 22 | **Insert key — column-context rule** | Insert is **column-context-aware with zero conflict**: in the Item Name cell (inventory mode ON) → accepts inventory autocomplete; in the Rate cell (hint visible) → accepts rate hint; does nothing if no hint/autocomplete is active. These never conflict because they fire in different columns. |
| 23 | **Inventory Insert — rate column** | On inventory Insert from Item Name cell: fills Item Name + fills the Rate column (Rate in Free Format, Rate in GST Format). **Which inventory price field is used is configurable per bill format independently** — e.g. Free Format can be set to use Wholesale Price while GST Format uses GST Price. This is configured in Settings as "Inventory Rate Source per Format". The inventory item can have any number of price fields (the 4 defaults — Price, Wholesale Price, GST Price, Credit — plus any additional custom price columns the user adds); all of them appear as options in the per-format rate source selector. |
| 24 | **To-Do list persistence** | Unchecked to-do items **persist across days automatically**. User can manually clear/reset the entire list from Settings at any time. |
| 25 | **Backup ZIP contents** | Every backup (scheduled or manual) produces **one ZIP** containing: all SQLite DB files (active + all company/branch profiles) + config file + session activity log. Nothing is omitted. |
| 26 | **Toolbar visibility** | The entire toolbar strip toggles hidden/visible as **one unit**. Visible by default. When hidden, all toolbar keyboard shortcuts remain fully functional. |
| 27 | **Themes** | 6 themes total: Space Particles (default), Sakura, Minimal, Dark Rainbow (animated full-spectrum background color shift), Neon (dark bg + cyberpunk neon glows), Dark Rose (deep dark bg with rose/mauve/dusty pink accents and subtle animated rose elements). All have dark/light variants. **UI design rule across the entire app: generous spacing, breathing room, nothing cramped, nothing ugly — every element must sit comfortably.** |
| 28 | **Inventory rate source — per format** | The inventory price field used when Insert fills the Rate column is **configured independently per bill format** in Settings → "Inventory Rate Source per Format". Free Format and GST Format each have their own selector. Any price field on the inventory item is selectable — including the 4 defaults (Price, Wholesale Price, GST Price, Credit) and any additional custom price columns the user has added to inventory. There is no single global default — it is always per-format. |
| 29 | **Inventory custom price columns** | Inventory items support **any number of price fields** — the 4 defaults plus unlimited user-defined custom price columns (e.g. "Export Price", "B2B Rate"). All custom price columns appear as options in the per-format rate source selector. The tabular inventory editor supports adding/removing these columns freely. |

---

## 3. CORE PRINCIPLES

- **App name:** `cQikly`
- **Distributable product**, not an internal tool — zero hardcoded business details anywhere in the codebase
- **Every user sets up their own company instance** on first launch via the onboarding flow
- **100% AI coded**, human guides sessions
- **Local first** — fully functional with zero internet, forever
- **Supabase sync is admin provisioned only** — users never configure it; it is a premium/admin-gated feature, invisible to regular users
- **No direct Supabase calls from components ever** — all external service calls go through the `services/` layer
- **Backend-ready architecture** — pluggable when needed
- **License/auth hooks stubbed from day one** — even if not active
- **Performance mode toggle** — for heavy UI, reduces visuals before reducing functionality
- **Clean feature separation** — no monoliths; each session produces one working contained feature
- **Everything is hot-swappable** — every module, theme, config, database, PDF format, language, performance mode, and API source must be swappable at runtime instantly without app restart, without breaking any other part of the app, without orphaned state, without flicker
- **App is fully modifiable to the core** — every module can be added, removed, or tweaked at any time; Boolean-gated feature flags everywhere possible
- **6 default pages:** New Quote, History, Customer Details, Inventory, Loose Inventory History, Settings

### Stubbed Safety Features (active from Day One)

| Feature | Description |
|---|---|
| **App Lock / PIN Screen** | Stub stubbed from day one; business data is sensitive; activatable from Settings |
| **App Update Mechanism** | `electron-updater`; auto-check on launch; notify user; one-click update; fully silent in background |
| **Data Wipe / Factory Reset** | In Settings; multi-step confirmation; returns app to blank post-onboarding state |
| **Crash Recovery / Autosave Draft** | On launch, detect the single most recent unsaved bill draft and offer recovery. Only one draft slot — the most recent unsaved bill. Multiple in-progress bills are not all recoverable; only the last one is. |
| **Onboarding Re-run** | Accessible from Settings; resets company profile and re-runs full onboarding flow |
| **Internet Loss Mid-Onboarding Recovery** | Detect connection drop; resume screen without losing already-filled data |
| **App-Level Zoom / Font Size** | Global UI scale slider in Settings; accessibility for older/visually impaired users |
| **i18n Hooks** | All strings go through a translation layer from day one; regional languages (Hindi, Kannada, Tamil etc.) addable later with zero structural changes |
| **Session Activity Log** | Internal log of actions per session (bill created, customer added, settings changed etc.); **never surfaced in the app UI**; stored as a raw file in Windows AppData folder only; accessible by navigating the file system manually for debugging and audit |

---

## 4. GOVERNANCE & CONFLICT RESOLUTION RULES

### Priority Order (highest to lowest)
1. Data integrity
2. Billing correctness
3. Existing features never break
4. Stability and recovery
5. Performance
6. UX smoothness
7. Visual effects
8. Future extensibility

### Conflict Resolution
- If two requirements conflict → preserve the higher priority rule
- If phase scope exceeds session limits → create stubs/interfaces only; never silently skip
- Never silently skip features → create `TODO` entries with full context
- Never rewrite stable modules unless architecture requires it
- Every completed phase must remain fully runnable

### Architecture Safety Rules
- Visual systems must **never** block billing operations
- Feature modules must **fail independently** — one broken module never takes down another
- Settings corruption must **recover to last known valid config**
- Database migrations must **support rollback**

---

## 5. ARCHITECTURE: HOT-SWAPPABLE SYSTEM

Every single swappable surface below must change instantly at runtime with:
- Zero app restart
- Zero broken state
- Zero flicker
- Zero crash
- Zero impact on any unrelated part of the app

### Swappable Surfaces & Behavior

| Surface | Runtime Behavior |
|---|---|
| **Modules / Features** | Any page, feature, or boolean-gated module toggled on/off immediately; rest of app is completely blind to it when off; no orphaned state; no errors from missing modules |
| **Themes** | Switch between any theme (space particles, sakura, minimal, custom user themes, dark/light variants) live mid-session; instant; no flicker; no reload; all components subscribe to theme context and repaint immediately |
| **Config / Settings** | Import or change any setting; propagates instantly across entire app; every dependent component reacts immediately without restart or manual refresh |
| **Database** | Switch active SQLite database live (e.g., between company profiles, branches, or a restored backup); **separate SQLite file per company profile/branch**; one additional config DB for settings separate from business data; clean connection manager drains all in-flight operations before swapping; then re-initializes all dependent services atomically; no data corruption; no stale reads |
| **PDF Formats / Templates** | Swap or add PDF templates without restart; new formats plug in and are immediately selectable and usable |
| **UI Components** | Any component can be replaced, removed, or added without touching unrelated parts; enforced structurally by services layer and feature flag contexts |
| **Language / i18n** | Once regional languages are added, switching language applies instantly across the entire UI with no restart |
| **Performance Mode** | Toggling live immediately strips or restores all heavy UI elements, Three.js scenes, Framer Motion complexity, and API polling intervals without any reload |
| **API Sources** | Swapping the provider for weather, crypto, forex, or any other external API from Settings causes the service layer to reconnect to the new source immediately; old connection torn down cleanly; no duplicate calls; no stale data |

### Architectural Requirements to Achieve Hot-Swap

- Every module wrapped in a **React feature flag context** — components outside that module never import from it directly
- All global state (theme, config, DB connection, language, performance mode, feature flags) lives in **dedicated React contexts** that can be hot-updated
- No module hardcodes a dependency on another module — all cross-module communication goes through the **central services layer** or a **typed event bus**
- **DB Connection Manager** handles swap atomically: drains writes → closes connection → opens new → re-initializes all services that hold DB references → broadcasts ready signal
- Settings changes emit a **typed global event** that every subscriber reacts to immediately — no component polls settings, they subscribe
- **Theme tokens are CSS variables** updated at the root level so every component inherits changes instantly without re-rendering the tree
- **API service instances are replaceable at runtime** — swapping provider tears down the old instance and boots the new one through the same interface contract

### Folder Structure (Target)

```
cQikly/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts
│   │   ├── ipc/                 # IPC handlers
│   │   ├── updater.ts           # electron-updater
│   │   └── crashRecovery.ts
│   ├── renderer/                # React app (Vite entry)
│   │   ├── App.tsx
│   │   ├── contexts/            # All global React contexts
│   │   │   ├── ThemeContext.tsx
│   │   │   ├── ConfigContext.tsx
│   │   │   ├── DBContext.tsx
│   │   │   ├── FeatureFlagContext.tsx
│   │   │   ├── LanguageContext.tsx
│   │   │   └── PerformanceContext.tsx
│   │   ├── services/            # ALL external/DB calls abstracted here
│   │   │   ├── db.service.ts
│   │   │   ├── pdf.service.ts
│   │   │   ├── weather.service.ts
│   │   │   ├── crypto.service.ts
│   │   │   ├── forex.service.ts
│   │   │   ├── supabase.service.ts   # stub, admin-only future
│   │   │   └── index.ts
│   │   ├── pages/
│   │   │   ├── Onboarding/
│   │   │   ├── Dashboard/
│   │   │   ├── NewQuote/
│   │   │   ├── History/
│   │   │   ├── CustomerDetails/
│   │   │   ├── Inventory/
│   │   │   ├── LooseInventoryHistory/
│   │   │   └── Settings/
│   │   ├── components/          # Shared UI components
│   │   ├── modules/             # Boolean-gated future modules (stubs)
│   │   │   ├── reports/
│   │   │   ├── expenseTracker/
│   │   │   ├── multiUser/
│   │   │   ├── paymentLedger/
│   │   │   └── branchSync/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── i18n/                # Translation layer
│   │   ├── themes/              # Theme definitions as CSS variable sets
│   │   └── config/
│       │   ├── featureFlags.ts
│       │   └── defaults.ts
├── public/
├── electron-builder.config.js
├── vite.config.ts
├── tailwind.config.ts
├── README.md
├── docs/
│   ├── architecture.md
│   └── phases/
│       ├── phase-01-done.md
│       ├── phase-02-done.md
│       └── ...
├── changelog/
└── decisions/
```

---

## 6. PERFORMANCE TIERS

| Tier | Description |
|---|---|
| **Lite** | No Three.js / Framer Motion animations AND no background API polling (weather, crypto, forex all stopped); minimal repaints; for low-end devices. Billing operations always run at full speed regardless. |
| **Balanced** | Some animations; moderate API polling intervals; default for most users |
| **Ultra** | Full Three.js particle scenes; Framer Motion at full complexity; frequent API refresh |

**Rule:** Performance mode must reduce visuals first before reducing functionality. Billing operations must never be degraded by performance settings.

---

## 7. ONBOARDING FLOW

### Entry Condition
- Onboarding is only triggered on first launch
- **Requires internet connection at start** to validate and optionally configure cloud sync access key
- If internet is not available, show a clear message and a retry button — do not allow skipping internet requirement on first launch
- Onboarding re-run can be triggered anytime from Settings; on re-run, no internet check is required

### Landing Screen
- Full-screen animated page with **Three.js space particle system** (or theme variant)
- App name **"cQikly"** displayed as a moving/animated text element
- When user touches/clicks the animated text → onboarding wizard opens
- Extremely modern, attractive, moving UI

### Onboarding Wizard — Fields Collected

| Field | Type | Notes |
|---|---|---|
| **Name of Firm** | Text | Required |
| **Nature of Firm** | Select | Product-related OR Service-related |
| **If Product: Nature of Business** | Multi-select | Wholesale / Retail / Production |
| **Business Model** | Multi-select | B2B / B2C / C2C |
| **GST Number** | Text | Optional |
| **Company Address** | Textarea | Required |
| **Head Office or Branch?** | Select | Head Office / Branch |
| **Number of Branches** | Number | If company has branches |
| **Cloud Sharing with Branches?** | Boolean | Yes / No |
| — If Yes | Info screen | "Request access key from developer" |
| — If No | Proceed | Continue to next step |
| **Contact Information** | Text fields | Phone, email etc. |
| **Company Logo** | File picker | Select from local storage; optional |
| **Financial Year Start Month** | Select | Default: April (India standard) |
| **Preferred Bill Number Reset Cycle** | Select | Yearly / Monthly / Never |
| **Starting Bill Number** | Number | For users migrating from another system |

### After Onboarding
- All collected info is **automatically saved into the Company Profile** in Settings
- App proceeds to Dashboard

### Internet Loss Mid-Onboarding
- App detects connection drop at any point during onboarding
- Shows a clear **retry/resume screen** without losing already-filled data
- User can retry connection or resume from exactly where they left off

---

## 8. DASHBOARD PAGE

### Layout
- **Left Sidebar:** 6 navigation buttons (New Quote, History, Customer Details, Inventory, Loose Inventory History, Settings)
- **Main Area:** Dashboard widgets arranged in a clean card grid
- **Background:** Animated theme (Space Particles / Sakura / Minimal / up to 6 themes total, selectable from Settings)
- Extremely smooth and attractive with moving animations; removable for low-power mode

### Theme Options (6 themes, selectable from Settings; all have dark/light variants)
1. **Space Particles** (default) — deep space background with animated particle systems
2. **Sakura Flowers** — falling cherry blossom petals, soft and elegant
3. **Minimal** — no animation, clean flat background; best for low-end devices
4. **Dark Rainbow** — full animated background that slowly cycles through the entire rainbow spectrum as a living color shift; all UI elements and accents adapt to the current hue phase; deep/dark base tones throughout
5. **Neon** — dark background with bright neon glows (cyan, magenta, lime, electric blue) on UI elements, buttons, borders, and accents; cyberpunk/synthwave aesthetic
6. **Dark Rose** — deep dark background with rose, mauve, and dusty pink accents; romantic and elegant; subtle animated elements in rose tones
- Users can add their own themes in future using simple template code files
- **UI design rule across ALL themes:** generous padding, breathing room between every element, nothing cramped or congested; every component must sit comfortably; no ugly tight layouts anywhere in the app

### Dashboard Widgets (all show/hide controlled from Settings)

| Widget | Description |
|---|---|
| **Date & Clock** | Both 12-hour and 24-hour format; configurable |
| **To-Do List / Checklist** | Persistent checklist — unchecked items carry over across days automatically; user can manually clear/reset the entire list from Settings at any time |
| **Today's Bill Count** | How many bills created today |
| **Total Bills** | Total number of bills created overall in the app |
| **Today's Total Revenue** | Total amount billed today (not just count); show/hide from Settings |
| **This Month vs Last Month Revenue** | Two-number comparison card; toggleable |
| **Top Customer This Month** | Customer with highest billed value this month; toggleable |
| **Pending Draft Bills Indicator** | If user half-made a bill and navigated away; recovery indicator so they don't forget |
| **Low Stock Alert Indicator** | If any inventory item falls below its set threshold; warning badge/card (requires stock qty enabled) |
| **Weather Info** | Temperature, humidity, AQI, wind speed; city configurable from Settings |
| **Crypto Markets** | Current values of up to 5 popular cryptocurrencies; currency configurable (USD/INR/others) from Settings |
| **Forex Rates** | Current forex rates; currency pairs configurable; toggleable |
| **System Status** | Basic system health info |
| **Calculator Sidebar** | Floating always-accessible calculator accessible via keyboard shortcut from anywhere in the app |
| **Unit Converter Widget** | kg to g, meters to cm to feet etc.; useful for wholesale/production; toggleable |
| **Currency Converter Widget** | Uses the forex API data; toggleable |

### API-Powered Tabs (all free APIs, show/hide from Settings)
- Weather API (city set in Settings)
- Crypto markets API (up to 5 cryptos; currency in Settings)
- Forex rates API (pairs configurable)
- Any additional free API tab — architecture supports adding more with a settings toggle

---

## 9. PAGE 1 — NEW QUOTE

### Page Layout
- **Top Left:** Company name, shortcut helpers panel, date
- **Top Right:** Date, company logo (if any)

---

### 9.1 TOOLBAR FEATURES

All toolbar buttons are physical clickable buttons in the toolbar strip. All are also accessible via keyboard shortcuts.

**Toolbar visibility:** The entire toolbar strip can be toggled hidden/visible as one unit via a toggle button or keyboard shortcut. **Visible by default.** When hidden, all toolbar functions remain accessible via their keyboard shortcuts. This is useful for maximising the billing grid area on small screens.

**UI design rule:** The toolbar must never feel cramped or tightly packed. Buttons must have generous padding and breathing room between them. Nothing in the entire app should look ugly, congested, or squeezed — every element must sit comfortably with proper spacing.

| Button | Function |
|---|---|
| **Bold + Highlight** | Makes selected text in any cell bold and applies a chosen color; color picker shows basic options first (black, red, blue etc.) via a simple RGB selector, then full range; selected text colors **persist** even when old bills are opened from History |
| **Highlight Cell** | Highlights the entire active cell (cursor-focused cell) with selected color; also **persists** |
| **+Col** | Adds a free custom column to the table; completely unrelated to default billing columns; column header is **fully user-defined** (user types whatever name they want); meant for sub-product details (e.g., thread codes, sizes, color codes); user writes entries like `1024-2` or `black=3`; the separator is either `-` or `=` (manually typed, never auto-inserted); `+` is always treated as plain text, never a separator |
| **-Col** | Removes an already-created custom column |
| **Mark** | Marks the currently active custom column cell as a **named sub-group header**; the text already typed in that cell becomes the group name; marked cells are visually distinct from data rows; everything after a marked cell belongs to that group until the next marked cell or end of column; the column header name and all marked cell texts are user-defined — nothing is hardcoded |
| **Show MKD** | Opens a movable small dialogue box showing **total quantities per named group per custom column**; groups are separated by marked cells; dialog format: `Column: {user-defined column name}` then `{group name} = {sum of qtys}`; qty parsing rules: entries with `-` or `=` separator → qty is the numeric value after the separator; entries with no separator → qty = 1; entries where the value after separator is non-numeric → qty = 1; `+` is plain text and the whole entry counts as qty = 1 |
| **Excel Export** | Copies current bill state in TSV format to clipboard (paste directly into Excel); includes exact headers, party name, and totals; nothing truncated |
| **Print Options** | Opens the print dialogue with format options |
| **Duplicate Bill** | Copies an existing bill as a new draft; same party or different; all rows and custom columns carried over; date resets to today |
| **Bill Templates** | Save the current bill structure (format type + custom column headers only — no row data) as a named reusable template; templates can be managed (rename, delete) from a template manager panel; load any saved template into a new bill in one click |
| **Internal Remarks / Notes** | Opens a small text area per bill for private internal notes; **never appears on any PDF or printed output**; only visible inside the app |
| **Row Reorder** | Drag to reorder item rows within the grid before saving or printing |
| **Undo / Redo** | Grid-level undo and redo for the billing table only (not app-global); within current bill session |
| **Rate History Hint** | When cursor is in the Rate cell and a matching item name exists in bill history, shows a **ghost placeholder hint** of the last rate charged to that same party for that item; match is **fuzzy** (not exact); pressing **Insert** while in the Rate cell accepts the hint and fills it — cursor stays in the Rate cell; this does NOT conflict with inventory Insert (which only fires from the Item Name cell) |
| **Format Toggle (Alt+1 / Alt+2)** | Switch between Free Format and GST Format; also accessible via toolbar buttons |

---

### 9.2 PARTY DETAILS & BILL NUMBERING

#### Party Details Fields (always visible)
- **Party Name** — fuzzy autocomplete from existing customers; suggestion box appears below; if customer exists → select to autofill phone and transport name (most recent transport for that customer); if new → type name, ignore suggestion, save bill → **automatically and silently creates new customer record** in Customer Details with all fields that were filled on the quote page (name, phone, transport, and any expanded fields); no separate save button needed
- **Phone Number**
- **Transport Name** — saved transporters list in Settings with fuzzy autocomplete; **per-customer transport memory**: the most recently used transport for the selected customer auto-fills; user can change it freely per bill; whatever transport is used on save becomes the new stored default for that customer going forward

#### Expandable Extra Info (via "expand" button)
- Address
- GSTIN
- Notes / any other configurable field

#### Bill Numbering / PO Number
- Auto-increments by default
- Prefix configurable in Settings; **a new year prefix is applied on each financial year reset**
- Resets on financial year start (April 1st by default, configurable in Settings)
- **On reset, bill number always restarts from 1** — the user-configured starting number (set during onboarding for migration purposes) is a one-time-only setting used only for the very first run; it does NOT repeat on subsequent year resets
- Deleted bill numbers are **skipped and never reused**
- **Bill date field is fully editable** — backdating is common in Indian businesses; defaults to today but editable to any past or future date

#### Bill Status
- Each bill carries a status: **Unpaid / Paid / Partial / Cancelled**
- Defaults to **Unpaid** on save
- Editable from History page
- Visible as a color tag in the History list

---

### 9.3 BILLING GRID TABLE

#### Navigation
- **Free table navigation** like Excel — move between cells using Enter, Tab, or arrow keys without any mandatory fill-order
- No blocks requiring item name before moving; cursor goes anywhere freely
- Writing cursor always ends at the **last letter of contents** in every cell when navigating
- **F2 Edit Mode toggle** (in Settings):
  - **When ON (strict Excel mode):** navigating to a cell with arrow keys does NOT enter edit mode; typing does nothing until F2 is pressed; pressing F2 unlocks the cell for editing with cursor inside existing content without erasing it
  - **When OFF (direct mode):** navigating to a cell and typing immediately replaces the cell content
- **TSV paste support** — paste TSV data from clipboard into any cell; fills one column at a time correctly (like Excel)
- **Row expansion trigger:** new rows are added ONLY when pressing **Enter or Down arrow** while on the last row; Tab key does NOT trigger row expansion

#### Formats — toggled via Alt+1 / Alt+2 or toolbar buttons

**Free Format columns:**

| Column | Behavior |
|---|---|
| Sl. No | Auto-fills if item name + at least one of qty/rate is non-empty; does NOT number rows where only item name is filled with both qty and rate empty; **purely auto-calculated, never manually editable under any circumstance** |
| Item Name | Free text |
| Qty | Free text |
| Rate | Free text |
| Amount | Auto-calculated (Qty × Rate) |

**GST Format columns:**

| Column | Behavior |
|---|---|
| Sl. No | Same auto-fill logic as Free Format; purely auto, never manually editable |
| Item Name | Free text |
| Qty | Free text |
| Rate | Free text |
| Pre Tax | Auto-calculated |
| GST % | User-entered |
| GST Amt | Auto-calculated |
| Amount | Auto-calculated |

#### Starting Rows & Expansion
- 20 rows by default
- Automatically expands when user is on the last row and presses down/enter
- No row limit

#### Optional Columns (Toggleable from Settings or Toolbar)

| Column | Behavior |
|---|---|
| **Discount Column** | Per-item row; switchable between % or flat amount per cell; applies before amount calculation; works in both Free Format and GST Format; persists in saved bills and PDFs |
| **Quantity Unit Column** | Small optional unit field alongside Qty (pcs, kg, meters, boxes, dozen etc.); freetext or from saved units list; toggleable; appears in PDF if enabled |

#### Custom Columns
- Custom columns added via the `+Col` toolbar button persist within the bill even when switching formats
- Custom column data is preserved in saved bills

#### Totals & Adjustments
- **Subtotal** auto-calculated and shown below table
- **Adjustments** — completely editable rows below subtotal; label and amount both user-defined (e.g., Coolie, Advance, Freight, Discount etc.); **amounts can be positive or negative** — a negative adjustment reduces the grand total (e.g., Advance: -500); not hardcoded labels
- **Grand Total** output:
  - If no adjustments: just **Grand Total**
  - If adjustments exist: Subtotal → Adjustment rows → **Grand Total**
- **Round-off:** Grand total silently rounded to nearest integer; NO separate round-off row; rounding only on grand total, never on item rows or adjustment rows; applies everywhere (PDF, images, prints, bills)

---

### 9.4 FOOTER TOOLS

| Button | Behavior |
|---|---|
| **Save Bill** | Saves the bill; resists saving if party name is empty AND no single cell has content |
| **Save PDF** | Generates and saves PDF per active format (simplified / professional / detailed professional); follows all page-size and row-count rules |
| **Copy Image** | Copies the PDF-rendered bill (always in **professional format**) as an image to clipboard |
| **Copy Simplified Image** | Same as copy image but always in **simplified format** |
| **Quick Print** | Prints the **simplified format**, always A5; if A4 rule applies, shows warning before printing |

#### Unsaved Changes Guard
- When navigating away or closing the quote page, if the bill has enough data and unsaved changes exist → prompt user to save or discard

---

### 9.5 PDF GENERATION SYSTEM

#### Shared Rules (all formats)
- Empty rows are skipped gracefully — no empty row appears in the PDF
- Item names are never truncated with `...` — long names wrap within merged row height to fit
- Grand total is silently rounded to nearest integer; no round-off row
- PDF quality is controllable via Settings
- PDF save location is configurable from Settings; default opens the folder automatically after saving
- PDF filename follows a configurable naming pattern; default: `{PartyName}_{Date}_{PONo}.pdf`

#### Format 1 — Simplified Format
- **Header:** `{Customer Name} - {Customer Contact}` in bold black — this is the **only** header; **zero company information** (no company name, no logo, no address) — this is intentional by design and is not configurable
- **Table:** Simple Excel-like table based on bill format
  - Free Format: includes up to **4 custom columns**; if more than 4 custom columns → A4 with warnings
  - GST Format: **does NOT include custom columns** in the PDF
- **Page size:**
  - A5 → up to **40 item rows**
  - If exceeded → one long A4 page up to **80 item rows**
  - If even 80 rows exceeded → **splits into multiple A4 pages** as needed
- **Footer row:** Transport name shown as one combined row at the very end, after totals

#### Format 2 — Professional Format
- **Header block:** Company name, address, phone numbers, company logo (from Settings)
- **Sub-header:** Customer/company name, contact number, transport name, PO number
- **Table:** Same as simplified table rules
- **Page size:**
  - A5 → up to **30 item rows**
  - If exceeded → one long A4 up to **60 item rows**
  - If even 60 exceeded → **splits into multiple A4 pages** as needed
- **Optional footer additions** (toggleable per format in Settings):
  - Terms & Conditions / footer text (multi-line, configurable)
  - Bank details as plain text (account number, IFSC, bank name)
  - UPI QR code for grand total amount (asks whether to include at time of printing/copying)

#### Format 3 — Detailed Professional Format
- **Header block:** All company details + all customer details including address
- **Table:** Same rules
- **Page size:**
  - A5 → up to **20 item rows**
  - If exceeded → one long A4 up to **40 item rows**
  - If even 40 exceeded → **splits into multiple A4 pages** as needed

#### PDF Format Extensibility
- The 3 formats above are defaults; more formats can be added in future conveniently without breaking existing ones

#### Additional PDF Features
- **PDF Format Memory Per Party** — remembers the last used PDF format per customer; auto-selects it next time; overridable anytime
- **Watermark / Draft Stamp** — optionally stamp `DRAFT` across a PDF/image of an unsaved bill; toggled from Settings
- **Multiple Bills Batch PDF** — from History page, select multiple bills and generate as a single combined PDF
- **Bank Details + UPI QR** — when printing or copying image, ask whether to include QR for the grand total amount; UPI ID and bank details managed from Settings

---

### 9.6 COPY IMAGE & QUICK PRINT

| Feature | Behavior |
|---|---|
| **Copy Image** | Crops the generated PDF (always professional format) and copies to clipboard as an image in one click |
| **Copy Simplified Image** | Same but always simplified format |
| **Quick Print** | Prints simplified format A5 silently without print dialogue; if A4 rule applies → warning shown before printing |

---

### 9.7 INVENTORY MODE ON QUOTE PAGE

- Toggled from Settings (off by default)
- When enabled: typing in the **Item Name cell** shows fuzzy autocomplete suggestions from the Inventory page items; suggestion card shows item image if set
- **Insert key behaviour — column-context-aware (no conflicts):**
  - **In the Item Name cell** (inventory mode ON): Insert accepts the inventory autocomplete suggestion → fills the item name → also auto-fills the correct rate column from the inventory item's configured default rate (see rate source below) → cursor stays in the Item Name cell
  - **In the Rate cell** (rate history hint visible): Insert accepts the ghost rate hint → fills the rate → cursor stays in the Rate cell
  - Insert does nothing if no autocomplete or hint is active in the currently focused cell
  - These two behaviours are completely independent — they fire based on which column the cursor is in; zero conflict
- **Rate column fill on inventory insert:**
  - Free Format → fills the **Rate** column using the price field configured for Free Format in Settings
  - GST Format → fills the **Rate** column (pre-tax rate) using the price field configured for GST Format in Settings
  - These are **configured independently per format** in Settings → "Inventory Rate Source per Format"
  - Any price field on the inventory item is selectable — including the 4 defaults (Price, Wholesale Price, GST Price, Credit) and any additional custom price columns the user has added to inventory
- After inserting from inventory, the user can continue typing freely in the Item Name cell to add further details without any restriction — the inserted text is not locked

---

## 10. PAGE 2 — HISTORY

### Core Features
- Shows all bills ever created, with fuzzy search bar
- Monthly division view; periodical division view
- Open any bill from history to view it
- Edit any saved bill from history (edit versioning — see below)
- Periodical backup features
- Bill status visible as a color tag per bill (Unpaid / Paid / Partial / Cancelled)

### Filtering & Search
- **Fuzzy search** — search by party name, PO number, date, amount
- **Bill status filter** — tabs or dropdown: All / Unpaid / Paid / Partial / Cancelled
- **Search by amount range** — filter by grand total range (e.g., all bills above ₹50,000)
- **Date range filter** — custom date range picker; results exportable to Excel

### Bulk Actions
- Select multiple bills
- Delete selected
- Export selected to Excel
- Change status of selected (bulk status update)
- Batch PDF generation — generate all selected bills as one combined PDF

### Bill Edit Versioning
- When an already-saved bill is edited and re-saved, the **original is always preserved as a version — no exceptions, no time threshold, no conditions**
- Even a single character change creates a new version
- Version history is accessible from the bill view — shows what changed and when
- Edit never silently overwrites the original

### Duplicate Detection Warning
- When saving a new bill for the same party on the same date with a very similar total → show a warning that a possible duplicate exists before saving

### Outstanding / Ledger View Per Customer
- Accessible from History
- Shows total billed vs total paid vs outstanding balance for any customer
- Filterable by date range

---

## 11. PAGE 3 — CUSTOMER DETAILS

### Core Features
- Full list of all customers
- Add, edit, delete customers
- Shows bill count per customer
- Customer outstanding balance column (total billed, total unpaid/outstanding)

### Excel Import Format
Exact column format for import (partial fill is acceptable; only Name is compulsory):

```
Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type
```

### Per-Customer Fields
| Field | Notes |
|---|---|
| Party Name | Required |
| Address | Optional |
| Group | Fully functional — group-based filtering, reporting, bulk actions |
| Pincode | Optional |
| State Name | Optional |
| Contact Person | Optional |
| Phone No | Optional |
| Mobile No | Optional |
| Email | Optional |
| Website | Optional |
| PAN No | Optional |
| GSTIN | Optional |
| Reg Type | Optional |
| **Credit Limit** | Optional per customer; warn when new bill pushes outstanding beyond limit; global default in Settings |
| **Internal Notes** | Private notes per customer (e.g., "slow payer"); never shown on bills or PDFs |
| **Customer Since Date** | Auto-recorded from first bill date or date manually added |
| **Outstanding Balance** | Auto-calculated from bills and payments |

### Customer Ledger
- Per customer: full running Dr/Cr ledger view
- Shows every bill and every payment logged against them with running balance

### Payment Recorder Per Customer
- Log payments received against a customer
- Each payment entry: date, amount, reference/note, links to which bill(s) it covers
- Drives the Paid / Partial / Unpaid status on linked bills

### Customer Export to Excel
- Export full customer table in the same column format as the import — for backup or migration

---

## 12. PAGE 4 — INVENTORY

### Core Features
- Add, view, edit, delete inventory items
- Divided into **categories and sub-categories**
- **Tabular free-navigation editing** — edit all items at once in table format, freely moving between cells like in the quote page; no item-by-item modal saving required
- Product usage histories per item
- Price change histories per item
- Analytical data: what party bought an item, on what date, at what price — and other related detailed data

### Per-Item Fields
| Field | Notes |
|---|---|
| Item Name | Required |
| Price | Standard selling price (default field) |
| Wholesale Price | Optional (default field) |
| GST Price | Optional (default field) |
| Credit | Optional (default field) |
| **Custom Price Columns** | Any number of additional price columns can be added by the user (e.g. "Export Price", "B2B Rate" etc.); all custom price columns are available as options in the "Inventory Rate Source per Format" selector in Settings |
| Stock Qty | Optional — toggleable globally; when enabled, reduces on bill save |
| GST Rate | Optional |
| **Minimum Stock Threshold** | Optional per item; when stock qty falls below → flagged; feeds low stock alert on dashboard |
| **Unit of Measurement** | Optional per item (pcs, kg, meters, boxes, dozen etc.); flows through to billing grid qty column and PDFs |
| **Barcode / SKU** | Optional; searchable; scannable if barcode reader is connected |
| **Item Image** | Optional; stored locally; visible in inventory table and autocomplete suggestion in quote page |
| *(Any other custom fields)* | All column headers fully customizable; non-price custom fields also supported |

### Stock Deduction on Bill Save
- When stock qty is enabled and a bill is saved → automatically reduce stock qty of matched inventory items by billed quantity
- Settings toggle to enable/disable this behaviour

### Low Stock Alerts on Inventory Page
- Flagged items shown with a visual indicator (color, badge) directly in the inventory table

### Bulk Price Update
- Select multiple inventory items
- Apply percentage increase or flat change to all their prices at once
- Preview before applying

### Barcode / SKU
- Optional barcode or SKU code field per item
- Searchable and scannable if barcode reader is connected

### Inventory Export to Excel
- Export full inventory in the same column format as import would expect — for backup or transfer

### Inventory Import (Excel)
- Import from Excel in a defined column format
- Partial fill accepted; item name required

---

## 13. PAGE 5 — LOOSE INVENTORY HISTORY

- Items in this section do **not** exist in the normal inventory
- These are free products mentioned in quotations — either in non-inventory mode or inventory mode where the user adds extra info to items
- Tracks all such "loose" items mentioned across all bills
- Shows history and analytical data for these loose/unregistered items
- All related features and analytical detail

---

## 14. PAGE 6 — SETTINGS

Settings save to a **config file** that can be dragged-and-dropped into the Settings page of another device to apply all settings instantly.

### Company Profile
- All onboarding data (firm name, address, logo, GST, branch info, contact info, financial year start, bill number reset cycle, starting bill number)
- **Onboarding Re-run** button — resets company profile and re-runs the full onboarding flow

### Bill Number Settings
- PO number prefix
- Starting number
- Auto-increment toggle
- Reset cycle (yearly on financial year start / monthly / never)
- Financial year start month (default April)

### PDF Settings
- Default PDF format (Simplified / Professional / Detailed Professional)
- PDF filename pattern — configurable naming; default `{PartyName}_{Date}_{PONo}.pdf`; available tokens shown
- PDF save location
- Terms & Conditions text — multi-line; separately configurable per PDF format; toggleable
- Bank details text for PDF footer — account number, IFSC, bank name; toggleable per PDF format
- Bank details + UPI ID for QR generation
- PDF quality setting
- Watermark / Draft stamp toggle

### Print Settings
- Default printer selection — for quick print without dialogue
- Default page size override

### Dashboard Widget Toggles
- Show/hide each widget individually:
  - Today's bill count
  - Today's total revenue
  - This month vs last month comparison
  - Top customer this month
  - Pending draft bills indicator
  - Low stock alert indicator
  - Weather info (+ city selector)
  - Crypto markets (+ up to 5 cryptos selector + currency)
  - Forex rates (+ pairs)
  - Unit converter widget
  - Currency converter widget
  - Calculator sidebar
  - Any additional API tabs

### Quote Page Settings
- Inventory mode toggle (enables inventory autocomplete on quote page)
- F2 / mouse-click edit mode toggle for billing grid
- Discount column toggle (show/hide per bill)
- Quantity unit column toggle
- Rate history hint toggle
- Stock deduction on bill save toggle

### Appearance & Theme
- Theme selector (up to 6 themes + dark/light variants)
- Performance mode selector (Lite / Balanced / Ultra)
- App-level zoom / font size slider (global UI scale)
- UI must have dark and light mode for all default themes — extremely smooth transitions

### Language / i18n
- Language selector (English by default; regional languages addable later without structural changes)

### Security
- App Lock / PIN — enable numeric PIN lock; required on launch or after configurable idle timeout

### Backup & Restore
- Auto backup scheduler — set schedule (daily / weekly) + destination folder; manual "Backup Now" button; **each backup is a single ZIP containing: all SQLite DB files (active + all company/branch profiles) + config file + session activity log**; nothing is left out
- Backup restore — drag-drop or browse to a backup file; confirmation shown; current-state backup taken before restore
- Drag-and-drop DB sync between devices (offline)
- Data wipe / factory reset — multi-step confirmation; returns to blank post-onboarding state

### Saved Lists
- Saved transporters list — manage frequently used transporters; appear as autocomplete in transport name field
- Saved units list — manage quantity units used across billing and inventory

### Customer Settings
- Customer credit limit default — global default for all new customers

### Feature Module Toggles (Boolean-gated)
All stubs active from day one; each can be enabled/disabled:
- Reports module (stub)
- Expense tracker (stub)
- Multi-user / operator profiles (stub)
- Payment recorder & ledger (stub)
- WhatsApp quick share toggle
- Branch sync settings (admin only, visible only when cloud sync access key is active)

### Access Key
- Enter cloud sync access key (obtained from developer) — unlocks admin-only features

---

## 15. GLOBAL UX, NAVIGATION & KEYBOARD SHORTCUTS

### Calculator (Universal)
- Opens with **Alt+N**
- Opens at the **bottom of the screen**
- **No mouse buttons** — controlled entirely from keyboard
- Full calculation features including:
  - History of calculation rows
  - Row edit — edit any previous calculation row and the result updates
  - Refresh / clear calculator
  - All standard mathematical operations

### Scratchpad / Sticky Notes
- Persistent floating notepad accessible from anywhere in the app via shortcut
- For quick notes during billing that don't belong to any specific bill

### Global Fuzzy Search (Command Palette)
- **Ctrl+K** — command-palette style search
- Searches across customers, bills, inventory items, and settings in one box
- Navigate directly to any result

### Shortcut Reference Panel
- **Ctrl+/** — floating reference card showing all active shortcuts in the app
- Accessible from anywhere

### Complete Keyboard Shortcut Map

| Shortcut | Action |
|---|---|
| **Ctrl+1** | Navigate to New Quote |
| **Ctrl+2** | Navigate to History |
| **Ctrl+3** | Navigate to Customer Details |
| **Ctrl+4** | Navigate to Inventory |
| **Ctrl+5** | Navigate to Loose Inventory History |
| **Ctrl+6** | Navigate to Settings |
| **Alt+N** | Open/close calculator |
| **Alt+1** | Switch to Free Format (billing grid) |
| **Alt+2** | Switch to GST Format (billing grid) |
| **Ctrl+S** | Save bill |
| **Ctrl+P** | Save PDF |
| **Ctrl+Shift+C** | Copy image (professional format) |
| **Ctrl+Shift+X** | Copy simplified image |
| **Ctrl+Shift+P** | Quick print |
| **Ctrl+Z** | Undo (grid-level within current bill) |
| **Ctrl+Y** | Redo (grid-level within current bill) |
| **Ctrl+K** | Global fuzzy search / command palette |
| **Ctrl+/** | Open shortcut reference panel |
| **Ctrl+D** | Duplicate current bill |
| **Ctrl+H** | Open History |
| **Ctrl+,** | Open Settings |
| **Escape** | Back / close modal |
| **Insert** | Accept inventory autocomplete suggestion |
| **F2** | Enter edit mode in cell (when F2 mode is enabled in Settings) |
| *(Custom column)* | +Col / -Col / Mark / Show MKD — via toolbar + assignable shortcuts |
| *(Row actions)* | Add row, drag reorder — via toolbar |

---

## 16. FUTURE / BOOLEAN-GATED MODULES (STUBBED FROM DAY ONE)

All of the following must be stubbed from day one with proper feature flag contexts. They are completely invisible when off and have zero impact on any other module.

| Module | Description |
|---|---|
| **Reports Module** | Daily / monthly / yearly sales summary; item-wise sales report; customer-wise sales report; GST collected summary broken down by GST%; all exportable to Excel |
| **Expense Tracker** | Log business expenses (rent, transport, misc); rough P&L view (total billed minus total expenses) |
| **Payment Recorder & Ledger** | Log payments received; full Dr/Cr ledger per customer; outstanding balance tracking |
| **WhatsApp Quick Share** | One click opens WhatsApp; preferred method (Desktop deep link vs Web) is **user-configurable in Settings**; bill image attached via clipboard |
| **Multi-User / Operator Profiles** | PIN-based operator switching on same machine; each operator has their own session log |
| **Branch Activity Monitor** | Admin + cloud only; admin view of activity across all branches when Supabase sync is active |
| **Centralized Customer DB Sync** | Admin + cloud only; shared customer list pushed from HQ to branches |
| **Price List Sync** | Admin + cloud only; push updated inventory prices from HQ to all branches |
| **Mobile Module** | Eventually push modules such that cQikly works on mobile as well, with branch sync on desktop |
| **Supabase Cloud Sync** | Admin provisioned; currently offline drag-and-drop DB sync only; Supabase is the future upgrade path |

**Any new tool/module added (by Claude or otherwise) must have:**
- A Boolean toggle in Settings to enable/disable
- Must not break the core default working of the app when disabled
- Must fail independently from all other modules

---

## 17. AI EXECUTION RULES PER SESSION

Every phase/session must end with the following deliverables:

### End-of-Phase Documentation (inside `/docs/phases/phase-NN-done.md`)
- Updated README
- Architecture notes (what was built, how it connects)
- Known limitations
- Next phase entrypoint (exact starting point for the next Claude session)
- Migration notes if any structure changed

### Every Generated ZIP Must Contain
```
/README.md
/docs/
/phase-output/
/changelog/
/decisions/
```

### Coding Standards
- Code must be industry-level structured, instantly readable and modifiable
- Every module, context, service, and component must have clear inline comments explaining purpose
- No guessing required — structure must be self-documenting
- All AI sessions begin by reading the current README and latest phase-done file from `/docs/phases/`

### Session Continuity
- After each session, Claude provides a **ZIP output** with all work interconnected
- The ZIP is handed to the next Claude session which reads the context files and commences the next phase
- The session must always leave the app in a **fully runnable state** — `npm run dev` must work

---

## 18. TESTING RULES PER PHASE

Every phase completion must include all of the following:

| Test Type | Description |
|---|---|
| **Manual Test Checklist** | Step-by-step list of actions to verify every feature built in that phase |
| **Smoke Test** | Minimal happy-path run to verify the app launches and core functions work |
| **Rollback Test** | Verify that disabling the new feature/module leaves the rest of the app fully working |
| **Performance Check** | Verify that the new feature does not degrade performance in Lite mode |
| **Save/Load Verification** | Verify that all new data persists correctly after app restart |

---

## 19. DOCUMENTATION RULE FOR NEW FEATURES

Any new feature added later must include documentation covering:

| Section | Content |
|---|---|
| **Purpose** | What this feature does and why |
| **Dependencies** | What modules, services, or contexts it depends on |
| **Settings** | What settings control it; where in the Settings page |
| **Storage Impact** | What it writes to the SQLite DB or config file |
| **Migration Impact** | Any schema migrations required; rollback plan |
| **Disable Path** | How to disable it cleanly; what happens to its data when disabled |

---

## 20. PHASE PLAN

Each phase is designed to fit within a single free Claude session. Every phase ends with a fully runnable app. Nothing is skipped — if something cannot be completed, a stub/interface is created with a clear `TODO`. Total sessions: **1a-i-A, 1a-i-B, 1a-ii-A, 1a-ii-B, 1b-A, 1b-B, 2a-A, 2a-B, 2b, 3a-A, 3a-B, 3b-i, 3b-ii, 4b-i, 4b-ii, 5a, 5b, 4a-i, 4a-ii-A, 4a-ii-B, 6a-A, 6b-A-i, 6b-A-ii, 6b-B, 7a-A, 7a-B, 7b, 8a, 8b-i, 8b-ii, 9a-A, 9a-B, 9b-A, 9b-B-i, 9b-B-ii-A, 9b-B-ii-B, 10, 11a-i, 11a-ii, 11b-i, 11b-ii, 12a, 12b, 13, 14** — **45 sessions total.**

---

### PHASE 1a-i-A — Folder Structure + package.json + Config Files

**Goal:** Create the complete project folder structure, all config files, and package.json with every dependency. No code logic yet — just the skeleton and configuration.

**Deliverables:**
- Full folder structure exactly as defined in Section 5 — every folder and placeholder file created, nothing missing
- `package.json` with all dependencies: Electron, React, Vite, TypeScript, Tailwind, shadcn/ui, better-sqlite3, electron-builder, electron-rebuild, electron-updater, Three.js, Framer Motion, Fuse.js, SheetJS, and all others
- `vite.config.ts` configured for Electron + React renderer
- `tailwind.config.ts` configured
- `electron-builder.config.js` configured for Windows target
- All placeholder files in place (empty index files, empty context files, empty service files etc.) so the folder structure is complete and navigable

**Test:** All folders and files exist at the correct paths; `package.json` contains all required dependencies; no missing folders from Section 5 structure.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1a-i-A.zip` containing all project files at their current state, plus `/docs/phases/phase-1a-i-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1a-i-A is complete. Full folder structure, `package.json`, `vite.config.ts`, `tailwind.config.ts`, and `electron-builder.config.js` are in place with all placeholder files. Now execute **PHASE 1a-i-B**: get Electron running with React inside it, resolve the `better-sqlite3` native module compilation blocker via `electron-rebuild`, wire the Electron main process, the typed IPC skeleton with all channel stubs, and the versioned DB migration system. `npm run dev` must open the Electron window with React running — no errors.
---

### PHASE 1a-i-B — Electron Shell + IPC + Native Module + DB Migration System

**Goal:** Get Electron running with React inside it, resolve the `better-sqlite3` native module compilation blocker, wire the Electron main process, IPC skeleton, and the versioned DB migration system. This is pure infrastructure — no contexts, no UI yet.

**Deliverables:**
- **`electron-rebuild` configured and verified** — `better-sqlite3` native module compiled for the exact Electron version; must complete without errors before proceeding; this is a known blocker
- **Versioned DB migration system** — `/src/main/db/migrations/` folder; migration runner reads all migration files in order; each migration file exports `up()` and `down()` functions; migration version tracked in DB; supports rollback; initial empty migration `001_initial.ts` created
- Electron main process (`/src/main/index.ts`) — launches BrowserWindow, loads Vite dev server in dev mode, handles app lifecycle
- IPC skeleton (`/src/main/ipc/`) — typed IPC channel definitions; handler stubs for all expected channels (db, pdf, settings, updater, crash-recovery, app-lock); fully typed with TypeScript
- React renderer entry point (`/src/renderer/App.tsx`) — minimal, just confirms React is running inside Electron
- `npm run dev` launches Electron with React running inside — no errors

**Test:** `npm run dev` opens Electron window showing React app; `electron-rebuild` completed without errors; DB migration runner logs "migrations up to date" on launch; IPC channels registered without errors.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1a-i-B.zip` containing all project files at their current state, plus `/docs/phases/phase-1a-i-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1a-i-B is complete. Electron is running with React inside, `better-sqlite3` is compiled, IPC skeleton is wired, and the DB migration system is running. `npm run dev` works. Now execute **PHASE 1a-ii-A**: build and wire the first 3 React context providers — `ThemeContext` (CSS variable system with all 6 themes + dark/light variants), `ConfigContext` (loads from AppData config file, persists on change), and `DBContext` (atomic SQLite connection manager with full hot-swap behaviour). All 3 must be wrapped in `App.tsx` in correct order. `npm run dev` must still work.
---

### PHASE 1a-ii-A — ThemeContext + ConfigContext + DBContext

**Goal:** Build and wire the first 3 React context providers — ThemeContext (CSS variable theme system with all 6 themes), ConfigContext (settings persistence and propagation), and DBContext (atomic SQLite connection manager).

**Deliverables:**
- **`ThemeContext`** — CSS variable-based; all 6 themes registered (Space Particles, Sakura, Minimal, Dark Rainbow, Neon, Dark Rose) as CSS variable sets; dark/light variants for each; switches instantly at runtime with zero flicker, zero reload; theme tokens updated at root level so every component inherits changes without re-rendering the tree
- **`ConfigContext`** — loads from config file in AppData; propagates all changes instantly across all subscribers via typed events; persists on change
- **`DBContext`** — DB connection manager with full atomic swap behaviour: drains all in-flight writes → closes current connection → opens new SQLite file → re-initializes all dependent services → broadcasts ready signal; separate SQLite file per company profile/branch; one config DB separate from business data DBs
- All 3 contexts wrapped around the app in `App.tsx` in correct dependency order
- `npm run dev` still runs without errors with these 3 contexts wired

**Test:** ThemeContext.setTheme() call changes CSS variables in DevTools live; ConfigContext loads and persists a test value; DBContext initializes and logs connection ready; all 3 contexts importable without TypeScript errors.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1a-ii-A.zip` containing all project files at their current state, plus `/docs/phases/phase-1a-ii-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1a-ii-A is complete. `ThemeContext`, `ConfigContext`, and `DBContext` are wired and working. Now execute **PHASE 1a-ii-B**: build and wire the remaining 3 contexts (`FeatureFlagContext`, `LanguageContext`, `PerformanceContext`), the complete typed services layer (all 6 service stubs with typed interfaces and JSDoc), and the typed global event bus with all typed events. All 6 contexts must be wrapped in `App.tsx` in correct dependency order. `npm run dev` must still work with zero TypeScript errors.
---

### PHASE 1a-ii-B — FeatureFlagContext + LanguageContext + PerformanceContext + Services Layer + Event Bus

**Goal:** Build and wire the remaining 3 React context providers, the complete typed services layer, and the typed global event bus. All 6 contexts then wrapped together in correct order.

**Deliverables:**
- **`FeatureFlagContext`** — all 6 pages and all future modules registered as boolean flags from day one: reports, expenseTracker, multiUser, paymentLedger, branchSync, whatsappShare; components outside a module never import from it directly; toggling a flag is instant and leaves zero orphaned state
- **`LanguageContext`** — i18n translation layer skeleton; every UI string goes through a `t()` function; English strings file wired; regional languages addable later with zero structural changes
- **`PerformanceContext`** — Lite / Balanced / Ultra modes; exposes flags: `animationsEnabled`, `heavyAnimationsEnabled`, `apiPollingEnabled`, `apiPollingInterval`; all animation and polling components read from this context; switching mode live with zero reload
- **`services/` layer** — all service files fully stubbed with correct typed interfaces and JSDoc comments:
  - `db.service.ts` — typed methods for all DB operations (stubbed)
  - `pdf.service.ts` — typed methods for all PDF generation operations (stubbed)
  - `weather.service.ts` — typed interface for weather data fetch (stubbed)
  - `crypto.service.ts` — typed interface for crypto price fetch (stubbed)
  - `forex.service.ts` — typed interface for forex rate fetch (stubbed)
  - `supabase.service.ts` — admin-only future stub; clearly marked
  - `index.ts` — re-exports all services
- **Typed global event bus** (`/src/renderer/utils/eventBus.ts`) — typed events for: themeChange, configChange, dbSwap, featureFlagChange, performanceModeChange, languageChange; all contexts subscribe; no component ever polls settings directly
- All 6 contexts wrapped around the app in `App.tsx` in correct dependency order
- `npm run dev` still runs without errors with all contexts wired

**Test:** All 6 contexts importable and operational; FeatureFlagContext.toggle() logs change to console; PerformanceContext.setMode('Lite') sets animationsEnabled to false; event bus emits and receives typed events; all service stubs importable without TypeScript errors.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1a-ii-B.zip` containing all project files at their current state, plus `/docs/phases/phase-1a-ii-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1a-ii-B is complete. All 6 contexts, the full services layer, and the typed event bus are wired. Now execute **PHASE 1b-A**: build all 4 safety systems — the session activity logger (singleton, writes to AppData, never surfaces in UI), `electron-updater` (auto-checks on launch, non-blocking toast), the App Lock/PIN stub (wired into launch flow, skips cleanly when disabled), and the crash recovery/autosave draft detection stub (checks AppData for draft file on every launch, shows restore/discard prompt if found). `npm run dev` must still work with no errors.
---

### PHASE 1b-A — Safety Systems: Session Logger + Updater + App Lock Stub + Crash Recovery Stub

**Goal:** Build all 4 stubbed safety systems — the session activity logger, electron-updater, app lock/PIN stub, and crash recovery/autosave draft detection stub.

**Deliverables:**
- **Session activity logger** — writes timestamped action entries to a raw file in Windows AppData; never surfaces in the app UI in any form; logs: app launch, bill created, customer added, settings changed, etc.; implemented as a singleton service callable from anywhere
- **`electron-updater` wired** — auto-checks for update on every launch; notifies UI with a non-blocking banner/toast; one-click update; fully silent download in background
- **App Lock / PIN stub** — wired into the launch flow; when enabled in Settings (future), requires PIN before app loads; stub is present and skipped cleanly when not active; no errors when disabled
- **Crash recovery / autosave draft detection stub** — on every launch, checks AppData for an unsaved bill draft file; if found, shows a non-blocking recovery prompt offering to restore or discard; stub fully wired even if draft creation comes in a later phase
- `npm run dev` still runs without errors

**Test:** App launches; session activity log file appears in AppData with launch entry; updater check runs silently on launch; app lock stub skips cleanly with no errors when disabled; crash recovery stub shows recovery prompt if a test draft file is manually placed in AppData.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1b-A.zip` containing all project files at their current state, plus `/docs/phases/phase-1b-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1b-A is complete. Session logger, updater, app lock stub, and crash recovery stub are all wired. Now execute **PHASE 1b-B**: build the sidebar navigation shell with 6 nav buttons (New Quote, History, Customer Details, Inventory, Loose Inventory History, Settings), wire Ctrl+1–6 shortcuts, build 6 clean non-ugly placeholder pages with generous spacing, wire performance mode fully into the UI layer (Lite strips Three.js + Framer Motion + API polling), wire the dark/light toggle (instant, persists), and ensure all 6 themes produce a visible visual change when switched. `npm run dev` must run the full app end to end.
---

### PHASE 1b-B — Navigation Shell + Placeholder Pages + Dark/Light + Performance UI Wiring

**Goal:** Build the sidebar navigation shell with 6 placeholder pages, wire performance mode into the UI layer, wire dark/light mode toggle, and ensure the app is fully runnable and presentable as a foundation for all future phases.

**Deliverables:**
- **Performance mode** fully wired into UI layer — Lite strips Three.js scenes and Framer Motion animations and stops all background API polling; Balanced runs moderate; Ultra runs full; switching live with zero reload; billing operations never degraded regardless of mode
- **Dark/Light mode toggle** wired — switches instantly via CSS variables; persists in config
- **Sidebar navigation** — 6 nav buttons (New Quote, History, Customer Details, Inventory, Loose Inventory History, Settings); clean keyboard shortcuts (Ctrl+1 through Ctrl+6) wired; active state highlighted
- **6 placeholder pages** — each page shows a clean, well-spaced, non-ugly placeholder with the page name and a brief description of what it will contain; nothing blank or bare; generous spacing; breathing room; nothing cramped
- **Basic app shell layout** — sidebar + main content area; consistent with UI design rule from Spec 27
- All 6 themes registered with placeholder CSS variable sets — switching theme changes something visually even at this stage
- `npm run dev` runs the full app end to end without compiling to `.exe`

**Test:** Sidebar navigates between all 6 placeholder pages with Ctrl+1–6; theme switching visually changes the UI live; performance mode toggle changes animationsEnabled flag; dark/light toggle switches instantly; all placeholder pages are clean and non-ugly with generous spacing.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-1b-B.zip` containing all project files at their current state, plus `/docs/phases/phase-1b-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 1b-B is complete. The full app shell is running — sidebar, 6 placeholder pages, dark/light, performance mode, and theme switching all working. Now execute **PHASE 2a-A**: build only the Three.js animated landing screen — full-screen deep-space particle system, animated "cQikly" text element, click trigger that will open the onboarding wizard. Must respect performance mode (Lite = no Three.js animation). This screen shows on first launch before onboarding is completed.
---

### PHASE 2a-A — Onboarding: Three.js Animated Landing Screen

**Goal:** Build only the Three.js animated landing screen — the full-screen particle system, the animated "cQikly" text, and the click trigger that will open the wizard. Nothing else.

**Deliverables:**
- **Three.js space particle landing screen** — full-screen animated deep-space particle system; app name "cQikly" displayed as a moving/animated text element; extremely modern and attractive
- **Click-to-open trigger** — touching/clicking the animated "cQikly" text is wired to open the onboarding wizard (wizard itself built in next phase; for now clicking can show a placeholder or empty panel)
- Landing screen respects performance mode — Lite mode shows a static/minimal version with no Three.js animation
- `npm run dev` shows the landing screen on first launch (before onboarding is completed)

**Test:** App launches → landing screen fills the screen with animated Three.js particle system; "cQikly" text is animated and moving; clicking the text triggers the open action; in Lite performance mode the animation is stripped.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-2a-A.zip` containing all project files at their current state, plus `/docs/phases/phase-2a-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 2a-A is complete. The Three.js landing screen with animated "cQikly" text is working. Now execute **PHASE 2a-B**: build the complete multi-step onboarding wizard UI with all fields (Name of Firm, Nature of Firm, Nature of Business, Business Model, GST Number, Company Address, Head Office/Branch, Number of Branches, Cloud Sharing, Contact Info, Company Logo, Financial Year Start Month, Bill Number Reset Cycle, Starting Bill Number), full step-by-step navigation with backward/forward without data loss, all validation (required fields block progression), and a final confirmation screen. No DB writes yet — data stays in memory.
---

### PHASE 2a-B — Onboarding: Full Wizard UI + All Fields + Validation

**Goal:** Build the complete multi-step onboarding wizard with all input fields, step navigation, and validation. No DB writes yet — this phase ends with a complete, validated, navigable wizard that collects all data and holds it in memory.

**Deliverables:**
- **Onboarding wizard — all fields with validation** (per Section 7):
  - Name of Firm (text; required)
  - Nature of Firm (select: Product-related / Service-related)
  - If Product: Nature of Business (multi-select: Wholesale / Retail / Production)
  - Business Model (multi-select: B2B / B2C / C2C)
  - GST Number (text; optional)
  - Company Address (textarea; required)
  - Head Office or Branch? (select: Head Office / Branch)
  - Number of Branches (number; shown if company has branches)
  - Cloud Sharing with Branches? (boolean: Yes / No)
  - If Yes → info screen: "Request access key from developer"
  - If No → proceed to next step
  - Contact Information (phone, email etc.)
  - Company Logo (file picker; select from local storage; optional)
  - Financial Year Start Month (select; default: April)
  - Preferred Bill Number Reset Cycle (select: Yearly / Monthly / Never)
  - Starting Bill Number (number; for migration from another system)
- All wizard steps navigable forward and backward without losing already-filled data
- Validation: required fields block progression; optional fields allow skipping
- Wizard UI — generous spacing, breathing room, nothing cramped, attractive and smooth
- Final confirmation screen shows all collected data before submission

**Test:** Click "cQikly" text → wizard opens; fill all fields step by step; navigate backward → previously filled data still present; leave a required field empty → cannot advance; complete all steps → wizard reaches final confirmation screen with all data visible.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-2a-B.zip` containing all project files at their current state, plus `/docs/phases/phase-2a-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 2a-B is complete. The full onboarding wizard UI with all fields, validation, and step navigation is working. Data is held in memory on the confirmation screen. Now execute **PHASE 2b**: wire internet detection before the wizard opens (no internet = retry screen, cannot skip on first launch), implement internet-loss recovery mid-fill (drops detected at any step, resume without data loss), persist all collected data to SQLite and config file on completion, redirect to Dashboard after completion, and wire the Onboarding Re-run button in Settings (no internet check required on re-run).
---

### PHASE 2b — Onboarding Flow: Internet Detection + DB Write + Redirect + Re-run

**Goal:** Wire internet detection at wizard entry, implement internet-loss recovery mid-fill, persist all collected onboarding data to SQLite and config file on completion, redirect to Dashboard, and wire the onboarding re-run trigger from Settings.

**Deliverables:**
- **Internet detection on wizard entry** — checks connection on first launch before wizard opens; if no internet: shows clear message and a retry button; does not allow skipping the internet requirement on first launch
- **Internet-loss recovery mid-onboarding** — detects connection drop at any point during the wizard; shows a clear retry/resume screen without losing any already-filled data; user can retry connection or resume from exactly where they left off
- **Company profile written to SQLite and config file on completion** — all fields collected in Phase 2a are persisted: firm name, nature of firm, business model, GST number, address, head office / branch, number of branches, cloud sharing flag, contact information, company logo (stored in AppData), financial year start month, bill number reset cycle, starting bill number
- **Redirect to Dashboard** after onboarding completes
- **Onboarding re-run accessible from Settings** — Settings contains an "Onboarding Re-run" button; triggers the full onboarding wizard again; on re-run, no internet check is required; resets and overwrites the company profile with the new data entered
- All data written in this phase is immediately readable by the Settings > Company Profile section (to be built in Phase 11a-i)

**Test:** Full onboarding fill → complete → data persists in SQLite and config file; disconnect internet mid-fill → recovery screen appears without data loss → reconnect → resume and complete normally; onboarding re-run from Settings → wizard opens without internet check → completes → company profile updated.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-2b.zip` containing all project files at their current state, plus `/docs/phases/phase-2b-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 2b is complete. Onboarding is fully wired — internet detection, mid-fill recovery, DB write on completion, redirect to Dashboard, and re-run from Settings all working. Now execute **PHASE 3a-A**: build the dashboard layout shell, left sidebar with 6 nav buttons + Ctrl+1–6, the Date & Clock widget (12h/24h configurable), the To-Do List widget (persistent across days, items carry over until cleared), the System Status widget, and the animated Space Particles background (Three.js default, respects performance mode). All widgets individually show/hide from Settings.
---

### PHASE 3a-A — Dashboard: Layout + Sidebar + Clock + To-Do + System Status + Background Theme

**Goal:** Build the dashboard layout shell, sidebar, the Date & Clock widget, To-Do List widget, System Status widget, and the animated background theme. No DB-reading widgets yet.

**Deliverables:**
- Left sidebar with 6 nav buttons, active state, Ctrl+1–6 shortcuts
- Dashboard card grid layout — generous spacing; breathing room; nothing cramped; clean and attractive
- **Date & Clock widget** — both 12-hour and 24-hour format; configurable from Settings
- **To-Do List / Checklist widget** — persistent across days; items carry over until manually cleared; clear/reset option in Settings
- **System Status widget** — basic system health info
- Background themed — Space Particles default (Three.js); respects performance mode (Lite = no animation)
- All widgets individually show/hide controlled from Settings

**Test:** Dashboard layout renders cleanly; sidebar nav buttons highlight active page; Ctrl+1–6 navigation works; clock shows correct time in both formats; to-do items persist after app restart; system status widget shows; performance mode Lite removes background animation.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-3a-A.zip` containing all project files at their current state, plus `/docs/phases/phase-3a-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 3a-A is complete. Dashboard shell, sidebar, clock, to-do, system status, and animated background are all working. Now execute **PHASE 3a-B**: wire all DB-reading dashboard widgets — Today's Bill Count, Total Bills, Today's Total Revenue, This Month vs Last Month Revenue, Top Customer This Month, Pending Draft Bills Indicator (reads from crash recovery system), and Low Stock Alert Indicator (reads inventory thresholds from DB). All widgets individually show/hide from Settings.
---

### PHASE 3a-B — Dashboard: All DB-Reading Widgets (Bill Count, Revenue, Top Customer, Draft Indicator, Low Stock)

**Goal:** Wire all static widgets that read from the local DB — today's bill count, total bills, today's revenue, month comparison, top customer, pending draft indicator, and low stock alert indicator.

**Deliverables:**
- **Today's Bill Count widget** — reads from DB; show/hide from Settings
- **Total Bills widget** — reads from DB; show/hide from Settings
- **Today's Total Revenue widget** — reads from DB; show/hide from Settings
- **This Month vs Last Month Revenue widget** — reads from DB; toggleable
- **Top Customer This Month widget** — reads from DB; toggleable
- **Pending Draft Bills Indicator** — reads from crash recovery system; shows if unsaved draft exists
- **Low Stock Alert Indicator** — reads inventory thresholds from DB; shows warning if any item below threshold
- All widgets individually show/hide controlled from Settings

**Test:** All widgets load with correct data from DB; today's bill count increments after creating a bill; revenue widgets show correct totals; top customer reflects highest billed customer this month; low stock indicator fires when a test item is set below threshold in DB; draft indicator shows when test draft exists; all widgets hide/show correctly from Settings toggles.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-3a-B.zip` containing all project files at their current state, plus `/docs/phases/phase-3a-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 3a-B is complete. All DB-reading dashboard widgets are wired and correct. Now execute **PHASE 3b-i**: wire the 3 live API integrations into the dashboard — Weather widget (temp, humidity, AQI, wind speed; free API; city from Settings), Crypto Markets widget (up to 5 cryptos; currency from Settings; free API), Forex Rates widget (currency pairs from Settings; free API). Also build the Unit Converter widget, Currency Converter widget, and the Calculator Sidebar widget (Alt+N; keyboard-only; full calculation history with editable rows; does not conflict with any other shortcut). All respect performance mode — Lite stops all API polling entirely.
---

### PHASE 3b-i — Dashboard: API Widgets (Weather + Crypto + Forex + Converters + Calculator)

**Goal:** Wire all 3 live API integrations (weather, crypto, forex) into the dashboard, and build the unit converter, currency converter, and calculator sidebar widgets.

**Deliverables:**
- **Weather API widget** — temperature, humidity, AQI, wind speed; city configurable from Settings; free API; respects performance mode (Lite = polling stopped)
- **Crypto Markets widget** — up to 5 cryptocurrencies; currency configurable (USD/INR/others) from Settings; free API; respects performance mode
- **Forex Rates widget** — currency pairs configurable from Settings; free API; respects performance mode
- **Unit Converter widget** — kg/g, meters/cm/feet etc.; toggleable from Settings
- **Currency Converter widget** — uses forex API data; toggleable from Settings
- **Calculator Sidebar widget** — floating, accessible from anywhere via Alt+N; keyboard-only (no mouse buttons); full calculation features including history of calculation rows; any previous row editable and result updates; refresh/clear; all standard mathematical operations; does not conflict with any other shortcut
- All API widgets respect performance mode — Lite mode stops all API polling entirely (weather, crypto, forex all halted); Balanced runs moderate polling intervals; Ultra runs frequent refresh
- All widgets individually show/hide controlled from Settings

**Test:** Weather/crypto/forex data loads correctly from free APIs; API polling stops completely in Lite mode and resumes in Balanced/Ultra; unit and currency converters calculate correctly; calculator opens via Alt+N; calculator history rows are editable and results update; all widgets hide/show from Settings toggles.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-3b-i.zip` containing all project files at their current state, plus `/docs/phases/phase-3b-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 3b-i is complete. All 3 API widgets, converters, and the calculator are wired. Now execute **PHASE 3b-ii**: fully implement all 6 animated themes with their complete visual designs — Space Particles (Three.js deep-space), Sakura Flowers (falling petals), Minimal (no animation), Dark Rainbow (animated hue-cycling background), Neon (cyberpunk glows on UI elements), Dark Rose (dark background with rose/mauve animated elements). All 6 must have dark/light variants and switch instantly with zero flicker via the CSS variable system. Wire performance mode fully into all animation layers — Lite kills Three.js + Framer Motion + all API polling; Balanced moderate; Ultra full. Switching performance mode live with zero reload.
---

### PHASE 3b-ii — Dashboard: All 6 Themes Full Implementation + Performance Mode Animation Wiring

**Goal:** Fully implement all 6 animated themes with their complete visual designs, wire all dark/light variants, and ensure performance mode is fully connected to all animation layers across the dashboard.

**Deliverables:**
- **All 6 themes fully implemented with complete visual designs:**
  - **Space Particles** (default) — deep space Three.js particle system; animated background
  - **Sakura Flowers** — falling cherry blossom petals; Three.js/CSS animation; soft and elegant
  - **Minimal** — no animation; clean flat background; best for low-end devices
  - **Dark Rainbow** — full animated background that slowly cycles through the entire rainbow spectrum as a living color shift; all UI elements and accents adapt to the current hue phase; deep/dark base tones throughout
  - **Neon** — dark background with bright neon glows (cyan, magenta, lime, electric blue) on UI elements, buttons, borders, and accents; cyberpunk/synthwave aesthetic
  - **Dark Rose** — deep dark background with rose, mauve, and dusty pink accents; romantic and elegant; subtle animated elements in rose tones
  - All 6 themes have dark/light variants
  - All themes switch instantly with zero flicker and zero reload — CSS variable system at root level
- **UI design rule enforced across all themes:** generous padding, breathing room between every element, nothing cramped or congested; every component sits comfortably; no ugly tight layouts
- **Performance mode fully wired into all animation layers:**
  - Lite mode: kills Three.js scenes AND Framer Motion animations AND all background API polling
  - Balanced mode: moderate animations, moderate polling intervals
  - Ultra mode: full Three.js particle scenes, Framer Motion at full complexity, frequent API refresh
  - Switching performance mode live with zero reload, zero flicker

**Test:** All 6 themes switch live with zero flicker; dark/light variants work correctly on all 6 themes; Space Particles shows Three.js particle system; Sakura shows falling petals; Dark Rainbow cycles through hues; Neon shows cyberpunk glows; Dark Rose shows rose-toned animated elements; Minimal shows no animation; Lite mode strips ALL animations and stops ALL API polling; billing operations remain fully functional and unaffected in all performance modes.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-3b-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-3b-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 3b-ii is complete. All 6 themes are fully implemented with dark/light variants and instant switching. Performance mode is fully wired into all animation layers. Now execute **PHASE 4b-i**: build the party details section of the New Quote page — Party Name field with fuzzy autocomplete from existing customers, Phone Number field, Transport Name field with fuzzy autocomplete from saved transporters list and per-customer transport memory (most recent transport auto-fills on customer select; updates on each save), and the expandable extra info section (Address, GSTIN, Notes).
---

### PHASE 4b-i — New Quote Page: Party Name + Phone + Transport + Expandable Extra Info

**Goal:** Build the party details section — Party Name with fuzzy autocomplete, Phone Number, Transport Name with per-customer memory, and the expandable extra info section.

**Deliverables:**
- **Party Name field** — fuzzy autocomplete from existing customers; suggestion box appears below as user types; if customer exists → select to autofill phone number and transport name (most recent transport for that customer); if new name typed and suggestion ignored → proceeds as new customer
- **Phone Number field**
- **Transport Name field** — fuzzy autocomplete from saved transporters list (managed in Settings); **per-customer transport memory**: the most recently used transport for the selected customer auto-fills on customer select; user can change it freely per bill; whatever transport is used on the newly saved bill becomes the new stored default for that customer going forward
- **Expandable Extra Info section** — accessed via an "expand" button; reveals: Address, GSTIN, Notes / any other configurable field

**Test:** Type existing party name → suggestions appear → select → phone and transport autofill correctly; type a new party name → no autofill; change transport → save bill → reopen a new bill for same customer → new transport is now the default; expand button reveals Address, GSTIN, Notes fields.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-4b-i.zip` containing all project files at their current state, plus `/docs/phases/phase-4b-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 4b-i is complete. Party Name fuzzy autocomplete, Phone, Transport with per-customer memory, and Expandable Extra Info are all working. Now execute **PHASE 4b-ii**: build the bill numbering engine (prefix from Settings, auto-increment, resets on financial year start always to 1, deleted numbers never reused, one-time starting number for migration only), bill date field (fully editable, defaults to today, backdating supported), bill status field (Unpaid/Paid/Partial/Cancelled, defaults to Unpaid, visible as color tag, editable from History), and the silent auto-create customer on first bill save (all filled fields saved to Customer Details automatically with no button — party name, phone, transport, and any expanded fields).
---

### PHASE 4b-ii — New Quote Page: Bill Numbering Engine + Bill Date + Bill Status + Auto-Create Customer

**Goal:** Build the bill numbering engine, bill date field, bill status field, and the silent auto-create customer behaviour on bill save.

**Deliverables:**
- **Bill Numbering engine:**
  - Auto-increments by default
  - Prefix configurable in Settings; a new year prefix is applied on each financial year reset
  - Resets on financial year start (April 1st by default, configurable in Settings)
  - On reset, bill number always restarts from 1 — the user-configured starting number (set during onboarding for migration purposes) is a one-time-only setting used only for the very first run; it does NOT repeat on subsequent year resets
  - Deleted bill numbers are skipped and never reused
- **Bill date field** — fully editable; backdating is common in Indian businesses; defaults to today but editable to any past or future date
- **Bill status field** — each bill carries a status: Unpaid / Paid / Partial / Cancelled; defaults to Unpaid on save; editable from History page; visible as a color tag
- **Auto-create new customer on first bill save** — when a new party name is saved for the first time via a bill, all fields filled on the quote page are automatically saved to Customer Details: party name, phone, transport name, and any expanded fields (address, GSTIN, notes etc.) the user filled; this is fully automatic with no save button — it happens silently on bill save

**Test:** Bill number auto-increments on each new bill; year prefix changes on financial year reset date; deleted bill number is never reused on next bill; bill date field accepts any past/future date; bill status defaults to Unpaid; type a new party name → fill phone, transport, address → save bill → Customer Details page shows the new customer with all those fields populated automatically.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-4b-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-4b-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 4b-ii is complete. Bill numbering engine, bill date, bill status, and silent auto-create customer are all wired. Now execute **PHASE 5a**: build the core billing grid — Free Format (Sl.No auto-fill, Item Name, Qty, Rate, Amount) and GST Format (Sl.No, Item Name, Qty, Rate, Pre Tax, GST%, GST Amt, Amount) with all auto-calculations. Sl.No is purely auto, never editable. Free Excel-like navigation (Enter/Tab/arrow keys; writing cursor ends at last letter on every navigation). F2 edit mode (when ON: typing does nothing until F2 pressed; F2 unlocks without erasing; when OFF: typing immediately replaces). TSV paste into cells. Format switch Alt+1/Alt+2 never loses data. Enter/Down on last row adds new row; Tab does NOT. Starts at 20 rows, no upper limit. Discount column (% or flat; toggleable; persists). Qty unit column (toggleable; persists). Adjustments section (editable labels and amounts; positive or negative). Subtotal/Grand Total/Grand Total with adjustments. Silent round-off on grand total only.
---

### PHASE 5a — New Quote Page: Billing Grid Core (Navigation, Formats, Totals)

**Goal:** Core billing grid with both formats, free navigation, F2 mode, TSV paste, auto-Sl.No, auto-expansion, discount column, unit column, adjustments, and grand total. No custom columns yet.

**Deliverables:**
- Free Format grid (Sl.No auto-fill logic, Item Name, Qty, Rate, Amount)
- GST Format grid (Sl.No, Item Name, Qty, Rate, Pre Tax, GST%, GST Amt, Amount) with all auto-calculations
- **Sl.No is purely auto, never manually editable** — locked from any user interaction
- Free Excel-like cell navigation (Enter/Tab/arrow keys, no blocks)
- Writing cursor always ends at last letter of content in every cell on navigation
- **F2 edit mode** (when ON: typing does nothing until F2 pressed; F2 unlocks cell without erasing content; when OFF: typing immediately replaces content)
- TSV paste into cells (one column at a time, like Excel)
- Format switch (Alt+1 / Alt+2) — switching formats never loses any data
- **Row expansion: Enter or Down arrow on last row adds new row; Tab does NOT**
- Starts at 20 rows; no upper limit
- Discount column (% or flat per cell; toggleable; persists in saved bills)
- Qty unit column (toggleable; persists; appears in PDF if enabled)
- Adjustments section (fully editable labels and amounts below table; amounts can be positive or negative)
- Subtotal / Grand Total / Grand Total with adjustments logic
- Silent round-off on grand total only (no separate round-off row)

**Test:** Navigate all cells freely in both formats; F2 mode ON — typing does nothing until F2; F2 mode OFF — typing replaces; auto-Sl.No fires correctly; last row Enter adds row; Tab on last cell does NOT add row; negative adjustment reduces grand total; grand total rounds silently.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-5a.zip` containing all project files at their current state, plus `/docs/phases/phase-5a-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 5a is complete. The core billing grid with both formats, free navigation, F2 mode, TSV paste, row expansion, discount column, adjustments, and grand total are all working. Now execute **PHASE 5b**: build the custom column system (+Col/-Col with fully user-defined headers, no hardcoded names anywhere), custom column data persists across format switches and in saved bills, the Mark system (marking a cell makes its text a named sub-group header; marked cells visually distinct; first group before any mark uses the column header name), the Show MKD dialog (movable, closeable; correct qty parsing: `-` or `=` separator → qty = numeric after separator; no separator → qty = 1; non-numeric after separator → qty = 1; `+` always plain text = qty 1), grid-level Undo/Redo (within current bill session only), and row drag-to-reorder.
---

### PHASE 5b — New Quote Page: Custom Columns, Mark System, MKD, Undo/Redo, Row Reorder

**Goal:** Full custom column system, the Mark sub-header system, Show MKD dialog with correct qty parsing, grid-level undo/redo, and row drag-to-reorder.

**Deliverables:**
- Custom column system (+Col / -Col) with fully user-defined header names (no hardcoded "custom" anywhere)
- Custom column data persists across format switches (Free ↔ GST)
- Custom column data preserved in saved bills
- **Mark system:** marking a cell makes its text a named sub-group header within that column; marked cells are visually distinct from data rows; first group before any mark uses the column header name
- **Show MKD dialog** (movable, closeable):
  - Shows: `Column: {actual user-defined column name}` then one line per group: `{group name} = {total qty}`
  - Qty parsing rules: `-` or `=` separator → qty = numeric value after separator; no separator → qty = 1; non-numeric after separator → qty = 1; `+` is always plain text (whole entry = qty 1)
- Grid-level Undo / Redo (within current bill session only, not app-global)
- Row drag-to-reorder within the grid

**Test:** Add column named "THREAD"; enter `1001-2`, `1111-45`, `112`, `1332`; mark a cell with text "YKK ZIP"; enter `111-2`, `12121=2`; open Show MKD → verify THREAD total and YKK ZIP total are correct; enter `nlaks+4` → counts as qty 1; undo a cell change; drag rows to reorder.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-5b.zip` containing all project files at their current state, plus `/docs/phases/phase-5b-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 5b is complete. Custom columns, Mark system, Show MKD, Undo/Redo, and row reorder are all working. Now execute **PHASE 4a-i**: build the first half of the quote page toolbar — Bold+Highlight button (text bold + color picker), Highlight Cell button (highlights entire active cell), +Col button (adds free custom column with user-defined header), -Col button (removes custom column), Mark button (marks cell as named sub-group header; all these operate on the grid built in 5a/5b), Show MKD button (movable dialog showing qty totals per group per column with correct parsing rules), the toolbar visibility toggle (hides/shows strip; shortcuts still fire when hidden), and the color persist system (highlight colors stored with bill data and always restored when bill is reopened).
---

### PHASE 4a-i — Toolbar: Bold+Highlight, Highlight Cell, +Col, -Col, Mark, Show MKD + Toolbar Visibility + Color Persist

**Goal:** Build the toolbar strip shell, the two text/cell formatting buttons, the toolbar visibility toggle, the full color-persist system, the custom column system (+Col/-Col), the Mark system, and the Show MKD dialog.

**Deliverables:**
- **Toolbar strip shell** — the physical toolbar bar rendered above the billing grid; each slot is a clickable button with a keyboard shortcut; visible by default
- **Bold + Highlight** button — makes selected text in any cell bold and applies a chosen color; color picker shows basic options first (black, red, blue etc.) via a simple RGB selector then full range
- **Highlight Cell** button — highlights the entire active cell (cursor-focused cell) with selected color
- **Toolbar visibility toggle** — entire toolbar strip toggles hidden/visible as one unit; visible by default; when hidden, all toolbar keyboard shortcuts remain fully functional
- **Color persist system** — text/cell highlight colors are stored with bill data; opening an old bill from History always shows the exact same highlight colors that were applied when the bill was created; colors never reset or disappear
- **+Col** button — adds a free custom column; column header is fully user-defined (user types whatever name they want); meant for sub-product details (e.g., thread codes, sizes, color codes); user writes entries like `1024-2` or `black=3`; the separator is either `-` or `=` (manually typed, never auto-inserted); `+` is always treated as plain text, never a separator
- **-Col** button — removes an already-created custom column
- **Mark** button — marks the currently active custom column cell as a named sub-group header; the text already typed in that cell becomes the group name; marked cells are visually distinct from data rows; everything after a marked cell belongs to that group until the next marked cell or end of column; nothing is hardcoded
- **Show MKD** button — opens a movable small dialogue box showing total quantities per named group per custom column; groups are separated by marked cells; dialog format: `Column: {user-defined column name}` then `{group name} = {sum of qtys}`; qty parsing rules: entries with `-` or `=` separator → qty is numeric value after separator; entries with no separator → qty = 1; entries where value after separator is non-numeric → qty = 1; `+` is plain text and whole entry counts as qty = 1

**Test:** Highlight text in a cell → save bill → open from History → colors still present exactly as applied; highlight entire cell → reopen from History → cell highlight still there; toolbar hide toggle hides the entire strip; all keyboard shortcuts still fire correctly when toolbar is hidden; add column named "THREAD"; enter `1001-2`, `1111-45`, `112`; mark a cell "YKK ZIP"; enter `111-2`, `12121=2`; open Show MKD → verify correct group totals for both groups; enter `nlaks+4` → counts as qty 1; remove the column with -Col → column gone; Show MKD dialog is movable and closeable.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-4a-i.zip` containing all project files at their current state, plus `/docs/phases/phase-4a-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 4a-i is complete. Toolbar strip shell, Bold+Highlight, Highlight Cell, toolbar visibility toggle, color persist system, +Col, -Col, Mark, and Show MKD with correct qty parsing are all working. Now execute **PHASE 4a-ii-A**: build the first 5 remaining toolbar buttons — Excel Export (copies bill as TSV to clipboard; includes exact headers, party name, and totals; nothing truncated), Print Options (opens print dialogue with format options), Duplicate Bill (copies bill as new draft; all rows and custom columns carried over; date resets to today), Bill Templates (save structure only — format type + custom column headers, zero row data; fully manageable: create, rename, delete from template manager panel; loading applies structure only), and Internal Remarks (small text area per bill for private internal notes; never appears on any PDF or printed output; only visible inside the app).
---

### PHASE 4a-ii-A — Toolbar: Excel Export, Print Options, Duplicate Bill, Bill Templates, Internal Remarks

**Goal:** Build the first 5 remaining toolbar buttons — Excel export, print options, duplicate bill, bill templates, and internal remarks.

**Deliverables:**
- **Excel Export** button — copies current bill state in TSV format to clipboard (paste directly into Excel); includes exact headers, party name, and totals; nothing truncated
- **Print Options** button — opens the print dialogue with format options
- **Duplicate Bill** button — copies an existing bill as a new draft; same party or different; all rows and custom columns carried over; date resets to today
- **Bill Templates** button — save the current bill structure (format type + custom column headers only — zero row data) as a named reusable template; templates are fully manageable: create, rename, delete from a template manager panel; loading a template into a new bill applies the structure only
- **Internal Remarks / Notes** button — opens a small text area per bill for private internal notes; never appears on any PDF or printed output; only visible inside the app

**Test:** Excel Export button copies correct TSV to clipboard with exact headers, party name, and totals, nothing truncated; duplicate bill creates a correct copy with today's date with all rows and custom columns carried over; save a template → load it into a new bill → structure applied with zero row data; create, rename, and delete templates from the template manager panel; internal remarks text saved per bill; internal remarks never appears on any PDF or print output.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-4a-ii-A.zip` containing all project files at their current state, plus `/docs/phases/phase-4a-ii-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 4a-ii-A is complete. Excel Export, Print Options, Duplicate Bill, Bill Templates, and Internal Remarks are all working. Now execute **PHASE 4a-ii-B**: build the final 4 toolbar buttons — Row Reorder (drag to reorder item rows within the grid before saving or printing), Undo/Redo (grid-level undo and redo for the billing table only, not app-global, within current bill session), Rate History Hint (when cursor is in the Rate cell and a matching item name exists in bill history, shows a ghost placeholder hint of the last rate charged to that same party for that item; match is fuzzy; pressing Insert while in the Rate cell accepts the hint and fills it — cursor stays in the Rate cell; does NOT conflict with inventory Insert which only fires from the Item Name cell), and Format Toggle (Alt+1/Alt+2 — switch between Free Format and GST Format; also accessible via toolbar buttons).

---

### PHASE 4a-ii-B — Toolbar: Row Reorder, Undo/Redo, Rate History Hint, Format Toggle

**Goal:** Build the final 4 toolbar buttons — row reorder, undo/redo, rate history hint, and format toggle.

**Deliverables:**
- **Row Reorder** — drag to reorder item rows within the grid before saving or printing
- **Undo / Redo** — grid-level undo and redo for the billing table only (not app-global); within current bill session
- **Rate History Hint** — when cursor is in the Rate cell and a matching item name exists in bill history, shows a ghost placeholder hint of the last rate charged to that same party for that item; match is fuzzy (not exact); pressing Insert while in the Rate cell accepts the hint and fills it — cursor stays in the Rate cell; this does NOT conflict with inventory Insert (which only fires from the Item Name cell)
- **Format Toggle (Alt+1 / Alt+2)** — switch between Free Format and GST Format; also accessible via toolbar buttons

**Test:** Drag rows to reorder within the grid; undo a cell change → cell reverts; redo → change reapplied; undo/redo does not affect anything outside the billing grid; rate history hint appears as ghost text in Rate cell when cursor is in Rate cell for a known item from bill history; Insert in Rate cell accepts hint and fills it, cursor stays in Rate cell; Insert in Item Name cell still triggers inventory autocomplete with zero conflict; Alt+1 switches to Free Format; Alt+2 switches to GST Format; format toggle buttons on toolbar also switch correctly.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-4a-ii-B.zip` containing all project files at their current state, plus `/docs/phases/phase-4a-ii-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 4a-ii-B is complete. Row Reorder, Undo/Redo, Rate History Hint, and Format Toggle are all working. All toolbar buttons are now fully built. Now execute **PHASE 6a-A**: build the save bill flow (validation guard: resist saving if party name empty AND no cell has content; save all bill data including custom columns, highlights, adjustments, format type, all fields) and the Simplified PDF format (header: customer name + contact ONLY, zero company info; page logic: A5 ≤40 rows → one long A4 ≤80 rows → multiple A4 pages; headers repeat on each page; totals only on last page; long names wrap, never truncated; empty rows skipped; grand total silently rounded; footer row with transport name; DRAFT watermark for unsaved bills; PDF save to configurable location; configurable filename pattern).
---

### PHASE 6a-A — New Quote Page: Save Bill + Simplified PDF Format

**Goal:** Full save/load bill flow with validation, and the Simplified PDF format with exact page-size and multi-page split logic.

**Deliverables:**
- **Save bill** — with validation guard: resist saving if party name is empty AND no single cell has content; saves all bill data including custom columns, highlights, adjustments, format type, all fields
- **Simplified PDF format:**
  - Header: `{Customer Name} - {Customer Contact}` in bold black — this is the ONLY header; zero company information (no company name, no logo, no address) — intentional by design, not configurable
  - Table based on active bill format (Free Format or GST Format)
  - Free Format: includes up to 4 custom columns; if more than 4 custom columns → A4 with warning
  - GST Format: does NOT include custom columns in the PDF
  - Page size logic: A5 (≤40 rows) → one long A4 (≤80 rows) → multiple A4 pages as needed
  - When splitting into multiple pages: headers repeat on each page; totals only on last page
  - Long item names wrap within merged row height — never truncated with `...`
  - Empty rows skipped entirely in PDF output
  - Grand total silently rounded to nearest integer — no round-off row in PDF
  - Footer row: transport name shown as one combined row at the very end, after totals
- PDF save to configurable location; folder auto-opens after save
- PDF filename follows configurable pattern; default: `{PartyName}_{Date}_{PONo}.pdf`
- Watermark / DRAFT stamp across PDF for unsaved bills (Settings toggle)
- Batch PDF stub wired (for History page Phase 7)

**Test:** Save bill with validation → bill persists and reloads correctly; bill with 40 rows → Simplified A5; 41 rows → A4 single page; 81 rows → multiple A4 pages with headers on each; long item name wraps without truncation; empty rows absent in PDF; grand total rounded; DRAFT stamp appears on unsaved bill PDF; zero company info in header.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-6a-A.zip` containing all project files at their current state, plus `/docs/phases/phase-6a-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 6a-A is complete. Bill save and Simplified PDF format are working. Now execute **PHASE 6b-A-i**: build the Professional PDF format only — header block (company name, address, phone numbers, company logo from Settings), sub-header (customer name, contact number, transport name, PO number), table with same rules as Simplified (long names wrap, empty rows skipped, grand total rounded), page size logic (A5 ≤30 rows → A4 ≤60 rows → multiple A4 pages), headers repeat on each page, totals only on last page.
---

### PHASE 6b-A-i — New Quote Page: Professional PDF Format

**Goal:** Build the Professional PDF format only — full company header, customer sub-header, correct page size logic, multi-page splitting with headers repeating, totals only on last page.

**Deliverables:**
- **Professional PDF format:**
  - Header block: company name, address, phone numbers, company logo (from Settings)
  - Sub-header: customer/company name, contact number, transport name, PO number
  - Table: same rules as Simplified (long item names wrap within merged row height — never truncated; empty rows skipped entirely; grand total silently rounded to nearest integer)
  - Page size logic: A5 (≤30 rows) → A4 (≤60 rows) → multiple A4 pages as needed
  - Headers repeat on each page; totals only on last page

**Test:** Professional format shows full company header (company name, address, phone numbers, logo) + customer sub-header (customer name, contact, transport name, PO number); Professional with 30 rows → A5; 31 rows → A4 single page; 61 rows → multiple A4 pages with headers repeating on each page and totals only on last page; long item name wraps without truncation; empty rows absent in PDF; grand total rounded.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-6b-A-i.zip` containing all project files at their current state, plus `/docs/phases/phase-6b-A-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 6b-A-i is complete. Professional PDF format with full company header, customer sub-header, and correct page size logic is working. Now execute **PHASE 6b-A-ii**: build the Detailed Professional PDF format (header block with all company details + all customer details including address; table same rules; page size logic: A5 ≤20 rows → A4 ≤40 rows → multiple A4 pages as needed; headers repeat on each page; totals only on last page) and ALL shared PDF features across all 3 formats: Terms & Conditions text block per format (from Settings; toggleable per format independently), bank details text block per format (account number, IFSC, bank name; from Settings; toggleable per format independently), UPI QR code for grand total amount (prompt at print/copy time whether to include; not auto-included), and PDF format memory per party (remembers last used PDF format per customer; auto-selects next time that customer is billed; overridable anytime).

---

### PHASE 6b-A-ii — New Quote Page: Detailed Professional PDF + All Shared PDF Features

**Goal:** Build the Detailed Professional PDF format and wire all shared PDF features (T&C, bank details, UPI QR, PDF format memory per party) across all 3 formats.

**Deliverables:**
- **Detailed Professional PDF format:**
  - Header block: all company details + all customer details including address
  - Table: same rules as Simplified and Professional (long item names wrap; empty rows skipped; grand total rounded)
  - Page size logic: A5 (≤20 rows) → A4 (≤40 rows) → multiple A4 pages as needed
  - Headers repeat on each page; totals only on last page
- **Shared PDF features across all 3 formats:**
  - Terms & Conditions text block per format (from Settings; toggleable per format independently)
  - Bank details text block per format (account number, IFSC, bank name; from Settings; toggleable per format independently)
  - UPI QR code for grand total amount (prompt at print/copy time whether to include; not auto-included)
  - PDF format memory per party — remembers last used PDF format per customer; auto-selects next time that customer is billed; overridable anytime

**Test:** Detailed Professional format shows all company details + all customer details including address; Detailed Professional with 20 rows → A5; 21 rows → A4; 41 rows → multiple A4 pages with headers repeating and totals only on last; T&C toggle per format — toggling off for Simplified does not affect Professional or Detailed Professional; bank details toggle per format independently; UPI QR prompt appears at print/copy time and does not auto-include; last used format per customer auto-selected on next bill for that customer; overriding the format on one bill does not change the stored memory permanently.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-6b-A-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-6b-A-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 6b-A-ii is complete. Detailed Professional PDF format and all shared PDF features (T&C, bank details, UPI QR, format memory per party) are working across all 3 formats. Now execute **PHASE 6b-B**: build Copy Image (renders bill in professional format, crops, copies to clipboard as image in one click), Copy Simplified Image (same but always simplified format), Quick Print (prints simplified format A5 silently without dialogue; if A4 rule applies → shows warning before printing), and the Unsaved Changes Guard (when navigating away or closing with unsaved content → prompt to save or discard).
---

### PHASE 6b-B — New Quote Page: Copy Image, Quick Print, Unsaved Guard

**Goal:** Copy image to clipboard (both formats), quick print, and unsaved changes guard.

**Deliverables:**
- Copy Image — renders bill in professional format, crops, copies to clipboard as image in one click
- Copy Simplified Image — same but always simplified format
- Quick Print — prints simplified format A5 silently without print dialogue; if A4 rule applies → warning shown before printing
- Unsaved changes guard — when navigating away or closing with unsaved content → prompt to save or discard

**Test:** Copy image → paste into WhatsApp/image editor → bill appears correctly; quick print with 41 rows → warning fires; navigate away mid-bill → guard prompts.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-6b-B.zip` containing all project files at their current state, plus `/docs/phases/phase-6b-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 6b-B is complete. Copy Image, Copy Simplified Image, Quick Print, and the Unsaved Changes Guard are all working. Now execute **PHASE 7a-A**: build the full History page list view — all columns (party name, date, PO number, status color tag, grand total), monthly collapsible grouping, periodical grouping, fuzzy search bar (by party name, PO number, date, amount), bill status filter tabs (All/Unpaid/Paid/Partial/Cancelled), amount range filter, date range filter with Excel export. No bill opening yet — that comes in 7a-B.
---

### PHASE 7a-A — History Page: List View + Search + Filters + Status Tags

**Goal:** Build the full history page list view with all columns, monthly/periodical grouping, fuzzy search, all filters, date range Excel export, and bill status color tags. No bill opening yet.

**Deliverables:**
- **Full bill history list** with all columns: party name, date, PO number, status (color tag), grand total
- **Monthly division view** — bills grouped by month; collapsible
- **Periodical division view** — bills grouped by configurable period
- **Fuzzy search bar** — search by party name, PO number, date, amount
- **Bill status filter** — tabs or dropdown: All / Unpaid / Paid / Partial / Cancelled
- **Amount range filter** — filter by grand total range (e.g., all bills above ₹50,000)
- **Date range filter** — custom date range picker; results exportable to Excel
- Bill status visible as a color tag per bill in the list

**Test:** Create 20 bills with different parties, dates, and statuses → history shows all; monthly grouping correct and collapsible; fuzzy search by party name finds correct bills; search by PO number finds correct bill; status filter tabs show only bills of that status; amount range filter returns only bills in range; date range filter works correctly; Excel export of filtered results produces correct file with all columns.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-7a-A.zip` containing all project files at their current state, plus `/docs/phases/phase-7a-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 7a-A is complete. History list view, all columns, monthly/periodical grouping, fuzzy search, all filters, and date range Excel export are all working. Now execute **PHASE 7a-B**: build the ability to open any bill from history in a fully editable view — clicking a bill opens it with all fields editable: item names, rate, qty, every grid cell, party name, phone, transport, bill date, bill status, custom columns, highlights/colors, adjustments, and all other fields exactly as they appear on the quote page; user can modify any field and save it back; saving writes the updated bill back to the DB; bill status is also editable directly from this view as a color-tagged selector; the opened bill view must be identical in behaviour to the New Quote page — same grid navigation, same F2 mode, same keyboard shortcuts, same toolbar — just opened from history with existing data loaded in.

---

### PHASE 7a-B — History Page: Open Bill (Fully Editable) + Save Back

**Goal:** Build the ability to open any bill from history in a fully editable view — identical to the New Quote page in behaviour — where every field is editable and saving writes the updated bill back to the DB.

**Deliverables:**
- **Open bill from history — fully editable view:**
  - Clicking any bill in the history list opens it in a fully editable state
  - The opened bill view is identical in behaviour to the New Quote page: same grid navigation (Enter/Tab/arrow keys, F2 mode, cursor at last letter), same toolbar (all toolbar buttons functional), same keyboard shortcuts, same format toggle (Alt+1/Alt+2)
  - Every field is editable: item names, rate, qty, amount (auto-recalculated), every grid cell, party name, phone number, transport name, bill date, expandable extra info fields (address, GSTIN, notes), custom column headers and entries, highlight colors and bold text, adjustments (labels and amounts), PO number, all other fields
  - All data loads exactly as saved — custom columns present with correct data, highlight colors restored, adjustments present, format type (Free/GST) restored
  - **Bill status editable directly from this view** — color-tagged dropdown/selector to change status (Unpaid / Paid / Partial / Cancelled) without needing to go elsewhere
  - Saving the edited bill writes the updated bill back to the DB under the same bill record — the save overwrites; this is the intended behaviour
  - Unsaved changes guard applies here too — navigating away with unsaved edits prompts to save or discard

**Test:** Open a bill from history → every field is editable; change item name, rate, qty → amounts auto-recalculate; change party name → saved correctly; change bill date → saved correctly; change bill status via color-tagged selector → saved correctly; add a row → saved; modify a custom column entry → saved; change a highlight color → saved; save → bill in history list reflects all changes; open the bill again → all edits present exactly as saved; navigate away without saving → guard prompts to save or discard.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-7a-B.zip` containing all project files at their current state, plus `/docs/phases/phase-7a-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 7a-B is complete. Opening any bill from history in a fully editable view with all fields editable and save-back working is complete. Bill status is editable from the bill view directly. Saving a bill overwrites it — no versioning. Now execute **PHASE 7b**: build duplicate detection warning (same party + same date + similar total triggers warning before saving a bill), all bulk actions (delete selected, export to Excel, change status of selected, batch PDF generation of selected as one combined PDF), outstanding/ledger view per customer accessible from History page (total billed vs total paid vs outstanding balance; filterable by date range), and the periodical backup trigger button accessible from History page.
---

### PHASE 7b — History Page: Duplicate Detection + Bulk Actions + Outstanding View + Backup Trigger

**Goal:** Wire duplicate detection warning on bill save, all bulk actions, outstanding/ledger view per customer, and the periodical backup trigger. No versioning of any kind.

**Deliverables:**
- **Duplicate detection warning** — when saving a bill (new or edited) for the same party on the same date with a very similar total → show a warning that a possible duplicate exists before saving; user can proceed or cancel
- **Bulk actions** — select multiple bills from the history list:
  - Delete selected
  - Export selected to Excel
  - Change status of selected (bulk status update)
  - Batch PDF generation — generate all selected bills as one combined PDF
- **Outstanding / ledger view per customer** — accessible from History page; shows total billed vs total paid vs outstanding balance for any customer; filterable by date range
- **Periodical backup trigger** — button accessible from History page; manually triggers a backup immediately

**Test:** Save a bill with same party + same date + similar total as an existing bill → duplicate warning appears before save; user can proceed or cancel; select 5 bills → bulk delete works; select 5 bills → bulk status change updates all 5; select 5 bills → batch PDF generates one combined PDF correctly; outstanding view shows correct total billed, total paid, and outstanding balance per customer; date range filter on outstanding view works; backup trigger button produces a backup file immediately.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-7b.zip` containing all project files at their current state, plus `/docs/phases/phase-7b-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 7b is complete. Duplicate detection, bulk actions, outstanding view, and backup trigger are all working. Now execute **PHASE 8a**: build the Customer Details page — full table with all columns (Party Name, Address, Group, Pincode, State Name, Contact Person, Phone No, Mobile No, Email, Website, PAN No, GSTIN, Reg Type, Credit Limit, Outstanding Balance), add/edit/delete customers, Excel import in the exact defined column format (Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type), Excel export in same format, bill count per customer (auto-calculated), outstanding balance per customer (auto-calculated), customer groups with filtering and bulk actions, and credit limit system (per-customer warning when bill would push outstanding over limit).
---

### PHASE 8a — Customer Details Page: Table + Add/Edit/Delete + Excel Import/Export + Groups + Bill Count + Outstanding + Credit Limit

**Goal:** Build the core customer details page with the full table, all CRUD operations, Excel import/export in the exact defined format, customer groups, bill count per customer, outstanding balance, and credit limit system.

**Deliverables:**
- **Full customer table** with all columns from Section 11: Party Name, Address, Group, Pincode, State Name, Contact Person, Phone No, Mobile No, Email, Website, PAN No, GSTIN, Reg Type, Credit Limit, Outstanding Balance
- **Add customer** — manual entry form with all fields; Party Name required; all others optional
- **Edit customer** — inline or modal editing of any field
- **Delete customer** — with confirmation
- **Excel import** — exact column format as defined in Section 11: `Sr No | Party Name | Address | Group | Pincode | State Name | Contact Person | Phone No | Mobile No | Email | Website | PAN No | GSTIN | Reg Type`; partial fill accepted; only Party Name is compulsory
- **Excel export** — exports full customer table in the same column format as import — for backup or migration
- **Bill count per customer** — shown as a column; auto-calculated from bills DB
- **Outstanding balance per customer** — auto-calculated from bills and payments; shown as a column
- **Customer groups** — fully functional group field: group-based filtering of the customer list, group-based reporting, bulk actions scoped to a group
- **Customer credit limit** — per customer (optional); when a new bill being saved would push the customer's outstanding balance beyond their credit limit → show a warning before saving; global default credit limit configurable in Settings (Phase 11b-i)

**Test:** Import sample Excel with 10 customers in the exact defined column format → all 10 appear with correct fields; add a new customer manually → appears in list; edit a field → saved immediately; delete a customer → gone with confirmation; export → Excel file matches import format exactly; bill count column reflects correct number of bills per customer; outstanding balance column correct; set credit limit of ₹10,000 for a customer → create a bill that pushes them over → warning appears before save.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-8a.zip` containing all project files at their current state, plus `/docs/phases/phase-8a-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 8a is complete. Customer table, CRUD, Excel import/export, groups, bill count, outstanding balance, and credit limit system are all working. Now execute **PHASE 8b-i**: add internal notes per customer (private text field; never shown on any bill, PDF, or print output), customer since date (auto-recorded from first bill date; editable manually; displayed in customer record), and the full running Dr/Cr ledger view per customer (shows every bill logged against that customer with a running balance; accessible from both the customer record and the History page outstanding view). Payment recording comes in the next phase (8b-ii).
---

### PHASE 8b-i — Customer Details Page: Internal Notes + Customer Since Date + Ledger View

**Goal:** Build internal notes per customer, customer since date, and the full running Dr/Cr ledger view per customer.

**Deliverables:**
- **Internal Notes per customer** — private text notes field (e.g., "slow payer", "prefers WhatsApp"); never shown on any bill or PDF output; only visible inside the app in the customer record
- **Customer Since Date** — auto-recorded from first bill date when customer was auto-created or manually added; also editable manually; displayed in the customer record
- **Customer Ledger view** — per customer: full running Dr/Cr ledger view; shows every bill and every payment logged against that customer with a running balance; accessible from the customer record and from the History page outstanding view

**Test:** Add internal note to a customer → note visible in customer record; create a bill for that customer → note never appears on any PDF or print; customer since date auto-records on first bill and is editable; open customer ledger → all bills listed with running balance; ledger accessible from both the customer record and the History page outstanding view.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-8b-i.zip` containing all project files at their current state, plus `/docs/phases/phase-8b-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 8b-i is complete. Internal notes, customer since date, and the Dr/Cr ledger view are all working. The ledger shows bills with running balance but payments are not yet recordable. Now execute **PHASE 8b-ii**: build the full Payment Recorder per customer — log payments received against a customer (each payment entry: date, amount, reference/note, links to which bill(s) it covers); when a payment is logged → automatically drives the Paid / Partial / Unpaid status on the linked bill(s): full payment → Paid; partial payment → Partial; no payment → Unpaid; payment history must be visible in the customer ledger built in 8b-i so the ledger now shows both bills and payments together with a correct running balance.

---

### PHASE 8b-ii — Customer Details Page: Payment Recorder

**Goal:** Build the full payment recorder per customer that logs payments, links them to bills, auto-drives bill status, and feeds payment history into the ledger view built in 8b-i.

**Deliverables:**
- **Payment Recorder per customer:**
  - Log payments received against a customer
  - Each payment entry: date, amount, reference/note, links to which bill(s) it covers
  - When a payment is logged → automatically drives the Paid / Partial / Unpaid status on the linked bill(s): full payment → Paid; partial payment → Partial; no payment → Unpaid
  - Payment history visible in the customer ledger — ledger now shows every bill and every payment together with a correct running balance

**Test:** Log a full payment against a bill → bill status changes to Paid automatically; log a partial payment against a bill → bill status changes to Partial; log a payment linked to multiple bills → each linked bill status updates correctly; payment entries appear in the customer ledger alongside bills; ledger running balance updates correctly after each payment entry; payment reference/note saved and displayed correctly in the ledger.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-8b-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-8b-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 8b-ii is complete. Payment recorder is fully wired — payments logged, bills auto-status-updated, and payment history visible in the ledger with correct running balance. Now execute **PHASE 9a-A**: build the core Inventory page — full item table with all fields (Item Name, Price, Wholesale Price, GST Price, Credit, unlimited custom price columns, GST Rate), categories and sub-categories, tabular free-navigation editing with the same cell navigation behaviour as the billing grid (Enter/Tab/arrow keys, F2 mode, cursor at last letter; no modal saving required; edit all items in table format), and add/edit/delete items. Custom price columns must appear as options in the Inventory Rate Source per Format selector in Settings.
---

### PHASE 9a-A — Inventory Page: Table + Categories + Tabular Editing + Add/Edit/Delete + Custom Price Columns

**Goal:** Build the core inventory page with the full item table, categories/sub-categories, tabular free-navigation editing, and all per-item fields including custom price columns.

**Deliverables:**
- Inventory table with all fields from Section 12 — Item Name, Price, Wholesale Price, GST Price, Credit, unlimited custom price columns, GST Rate
- **Categories and sub-categories** — items organized into user-defined categories and sub-categories
- **Tabular free-navigation editing** — same cell navigation behaviour as billing grid (Enter/Tab/arrow keys, F2 mode, cursor at last letter); no item-by-item modal saving required; edit all items at once in table format
- Add, edit, delete items
- **Custom price columns** — any number of additional price columns can be added by the user (e.g. "Export Price", "B2B Rate"); all custom price columns appear as options in the "Inventory Rate Source per Format" selector in Settings

**Test:** Add 10 items in different categories; navigate between cells freely in tabular mode; edit any field inline; add a custom price column "Export Price" → appears on all items; delete an item with confirmation; categories filter the table correctly.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9a-A.zip` containing all project files at their current state, plus `/docs/phases/phase-9a-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9a-A is complete. Inventory table, categories, tabular editing, CRUD, and custom price columns are all working. Now execute **PHASE 9a-B**: wire stock quantity tracking (Stock Qty field per item; toggled globally from Settings), minimum stock threshold per item, stock deduction on bill save (toggle in Settings; reduces stock qty of matched items by billed quantity when bill is saved), low stock alerts on inventory page (items below threshold shown with color badge), low stock alert feeding the dashboard Low Stock Indicator widget, and unit of measurement per item (flows through to billing grid qty column and PDFs).
---

### PHASE 9a-B — Inventory Page: Stock Tracking + Thresholds + Stock Deduction + Low Stock Alerts + Unit of Measurement

**Goal:** Wire stock quantity tracking, minimum stock thresholds, automatic stock deduction on bill save, low stock alerts on the inventory page, and unit of measurement per item.

**Deliverables:**
- **Stock Qty** field per item — optional; toggled globally from Settings
- **Minimum Stock Threshold** per item — optional; when stock qty falls below → item is flagged
- **Stock deduction on bill save** — toggle in Settings; when enabled, automatically reduces stock qty of matched inventory items by the billed quantity when a bill is saved
- **Low stock alerts on inventory page** — items below threshold shown with a visual indicator (color badge) directly in the inventory table
- **Low stock alert feeds dashboard Low Stock Indicator widget** — dashboard widget reflects current low-stock state
- **Unit of measurement per item** — optional (pcs, kg, meters, boxes, dozen etc.); flows through to billing grid qty column and PDFs

**Test:** Add item with stock qty 10; save bill using that item with qty 3 → stock reduces to 7; set threshold at 5; manually reduce stock to 4 → low stock alert fires on inventory page with color badge; dashboard Low Stock Indicator widget shows the alert; unit of measurement set to "kg" → appears in billing grid qty column for that item.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9a-B.zip` containing all project files at their current state, plus `/docs/phases/phase-9a-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9a-B is complete. Stock tracking, thresholds, deduction, low stock alerts, and unit of measurement are all wired. Now execute **PHASE 9b-A**: build price change history per item (log of every price change with date and old/new value), product usage history per item (which party bought it, on what date, at what price), bulk price update (select multiple items; apply % increase or flat change; preview before applying; confirmation required), and the barcode/SKU field (optional per item; searchable; auto-detected from keyboard input when barcode scanner is connected).
---

### PHASE 9b-A — Inventory Page: Price History + Usage History + Bulk Price Update + Barcode/SKU

**Goal:** Build price change history per item, product usage history per item, bulk price update with preview, and barcode/SKU field.

**Deliverables:**
- **Price change history per item** — log of every price change with date and old/new value; accessible from the item record
- **Product usage history per item** — what party bought it, on what date, at what price; all related analytical data; accessible from the item record
- **Bulk price update** — select multiple items; apply % increase or flat change to all their prices at once; preview before applying; confirmation required before changes are written
- **Barcode / SKU field** — optional per item; searchable by barcode/SKU from inventory table; scannable if barcode reader connected (keyboard input from scanner auto-detected as a barcode scan)

**Test:** Change item price twice → price history shows both changes with dates and old/new values; create a bill with an inventory item → usage history for that item shows the party name, date, and price; select 5 items → bulk update by 10% → preview shows new prices → confirm → all 5 items updated correctly; enter a barcode value → search by that barcode → item found.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9b-A.zip` containing all project files at their current state, plus `/docs/phases/phase-9b-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9b-A is complete. Price history, usage history, bulk price update, and barcode/SKU are all working. Now execute **PHASE 9b-B-i**: build item image support — optional per item; stored locally in AppData; shown in the inventory table row alongside the item name; file picker to add/change/remove image per item; persists across app restarts; items without images show no broken placeholder gap.
---

### PHASE 9b-B-i — Inventory Page: Item Images

**Goal:** Build item image support — optional per item, stored locally in AppData, shown in the inventory table row, and ready to show in the autocomplete suggestion card on the quote page (the autocomplete card itself is wired in 9b-B-ii).

**Deliverables:**
- **Item images** — optional per item; stored locally in AppData; shown in the inventory table row alongside the item name; file picker to add/change/remove the image per item; image persists across app restarts; if no image is set the row looks normal with no empty placeholder gap

**Test:** Add image to an item → image shows in inventory table row; change the image → new image replaces old one in the row; remove the image → row returns to normal with no gap; restart app → image still present in the row; items without images show no broken placeholder.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9b-B-i.zip` containing all project files at their current state, plus `/docs/phases/phase-9b-B-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9b-B-i is complete. Item images are stored in AppData and showing correctly in the inventory table row. Now execute **PHASE 9b-B-ii-A**: fully wire inventory mode on the quote page — when inventory mode is enabled in Settings, typing in the Item Name cell shows a fuzzy autocomplete dropdown from inventory; if the suggested item has an image it must show in the suggestion card; Insert key accepts the suggestion and fills item name + fills the correct rate column per active format using the "Inventory Rate Source per Format" setting from Settings (Free Format and GST Format each independently use their own configured price column); after insert, user can continue typing freely in the cell; zero conflict with Insert in Rate cell.

---

### PHASE 9b-B-ii-A — Inventory Page: Inventory Mode on Quote Page

**Goal:** Fully wire inventory mode on the quote page — fuzzy autocomplete dropdown, Insert key filling item name and correct rate, rate source per format, and item image shown in suggestion card.

**Deliverables:**
- **Inventory mode on quote page** — fully wired end-to-end:
  - When enabled in Settings: typing in the Item Name cell shows a fuzzy autocomplete dropdown from inventory
  - Insert key accepts the suggestion — fills item name + fills the correct rate column per active format using the "Inventory Rate Source per Format" setting from Settings
  - Free Format and GST Format each independently use their own configured price column (e.g. Free Format → Wholesale Price; GST Format → GST Price)
  - After insert, user can continue typing freely in the cell
  - If an item has an image, the autocomplete suggestion card shows the image

**Test:** Open quote page → type item name → autocomplete suggestion card appears; item with image → image shows in suggestion card; item without image → suggestion card shows no broken placeholder; press Insert → item name fills + correct price fills based on format setting; Free Format set to Wholesale Price → Insert fills Wholesale Price; GST Format set to GST Price → Insert fills GST Price; after Insert, continue typing freely in the cell; Insert in Item Name cell does not conflict with Insert in Rate cell (rate hint behaviour).

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9b-B-ii-A.zip` containing all project files at their current state, plus `/docs/phases/phase-9b-B-ii-A-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9b-B-ii-A is complete. Inventory mode on the quote page is fully wired — autocomplete, Insert key, rate source per format, and item image in suggestion card all working with zero conflicts. Now execute **PHASE 9b-B-ii-B**: build Excel import for inventory (import from Excel in the defined column format; partial fill accepted; Item Name is the only required column; all other columns filled where present) and Excel export for inventory (export full inventory table in the same column format; for backup or migration).

---

### PHASE 9b-B-ii-B — Inventory Page: Excel Import/Export

**Goal:** Build Excel import and export for the inventory — import from a defined column format, export in the same format.

**Deliverables:**
- **Excel import** — import inventory from Excel in the defined column format; partial fill accepted; Item Name is the only required column; all other columns (Price, Wholesale Price, GST Price, Credit, GST Rate, Stock Qty, Unit, Barcode/SKU, Category, custom price columns where column headers match) filled where present in the import file
- **Excel export** — export full inventory in the same column format; for backup or migration

**Test:** Import Excel with 10 items → all 10 appear correctly in inventory with all filled columns; import with only Item Name column → items created with just names, all other fields blank; import with partial columns → only present columns filled, missing columns left blank; export → Excel file matches import format exactly with all columns; re-import the exported file → inventory unchanged.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-9b-B-ii-B.zip` containing all project files at their current state, plus `/docs/phases/phase-9b-B-ii-B-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 9b-B-ii-B is complete. Excel import and export for inventory are working. Now execute **PHASE 10**: build the full Loose Inventory History page — automatically tracks all loose/free items from bills (items not in inventory), history view with filters (by item name, date range, party), and analytics per loose item (which parties used it, on what dates, at what prices, all related analytical data).
---

### PHASE 10 — Loose Inventory History Page (Full)

**Goal:** Complete loose inventory history with all tracking and analytics.

**Deliverables:**
- All loose/free items from bills tracked automatically (items not in inventory)
- History view with filters (by item name, date range, party)
- Analytics per loose item — which parties used it, on what dates, at what prices
- All related analytical data and features

**Test:** Create a bill with non-inventory items → loose inventory history captures them; analytics show correct party, date, price data.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-10.zip` containing all project files at their current state, plus `/docs/phases/phase-10-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 10 is complete. Loose Inventory History page with full tracking and analytics is working. Now execute **PHASE 11a-i**: build the first section of the Settings page — Company Profile editor (all onboarding fields editable: firm name, address, logo, GST number, branch info, contact info, financial year start month, bill number reset cycle, starting bill number labelled as one-time only) with the Onboarding Re-run button, and the Bill Number Settings group (PO number prefix, starting number labelled one-time, auto-increment toggle, reset cycle, financial year start month, year prefix configuration; resets always restart from 1 on year rollover). All changes propagate instantly via event bus — zero restart.
---

### PHASE 11a-i — Settings Page: Company Profile + Bill Number Settings

**Goal:** Build the first section of the Settings page — the Company Profile editor with all onboarding fields editable and the Onboarding Re-run button, and the complete Bill Number Settings group.

**Deliverables:**
- **Company Profile section** — all onboarding data editable here:
  - Firm name
  - Address
  - Company logo (file picker; update or remove)
  - GST number
  - Branch info
  - Contact info (phone, email etc.)
  - Financial year start month
  - Bill number reset cycle
  - Starting bill number (one-time migration use only — clearly labelled as such)
  - **Onboarding Re-run button** — resets company profile and re-runs the full onboarding wizard
- **Bill Number Settings:**
  - PO number prefix (configurable text prefix)
  - Starting number (one-time migration setting; clearly labelled as one-time only)
  - Auto-increment toggle
  - Reset cycle (yearly on financial year start / monthly / never)
  - Financial year start month (default April; changing this updates the bill number reset schedule)
  - Year prefix configuration — a new year prefix is applied on each financial year reset
  - Resets always restart from 1 on year rollover — the starting number is never re-applied after the first run
- All settings changes propagate instantly via typed event bus — zero restart required

**Test:** Change firm name in Company Profile → firm name updates across the app instantly; change financial year start month → bill number reset schedule updates; change PO number prefix → next new bill uses new prefix; Onboarding Re-run button opens the onboarding wizard; all Company Profile changes persist after app restart; all Bill Number Settings changes persist after app restart.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-11a-i.zip` containing all project files at their current state, plus `/docs/phases/phase-11a-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 11a-i is complete. Company Profile editor and Bill Number Settings are working. Now execute **PHASE 11a-ii**: build the PDF Settings group (default format selector, configurable PDF filename pattern with available tokens shown, PDF save location, Terms & Conditions text per format, bank details text per format, UPI ID for QR, PDF quality, watermark/DRAFT stamp toggle), Print Settings group (default printer, default page size), Appearance & Theme group (theme selector with live preview for all 6 themes + dark/light; performance mode selector; app-level zoom/font size slider that immediately scales entire app UI; dark/light toggle), and Language selector. All changes instant via event bus.
---

### PHASE 11a-ii — Settings Page: PDF Settings + Print Settings + Appearance & Theme + Language

**Goal:** Build the PDF Settings group, Print Settings group, Appearance & Theme group, and Language selector in the Settings page.

**Deliverables:**
- **PDF Settings:**
  - Default PDF format selector (Simplified / Professional / Detailed Professional)
  - PDF filename pattern — configurable naming; default `{PartyName}_{Date}_{PONo}.pdf`; available tokens shown to the user
  - PDF save location — configurable folder path
  - Terms & Conditions text — multi-line text area; separately configurable per PDF format; toggleable per format
  - Bank details text for PDF footer — account number, IFSC, bank name; separately configurable per format; toggleable per format
  - UPI ID for QR code generation (used when UPI QR is included in PDF/image)
  - PDF quality setting
  - Watermark / Draft stamp toggle — enables DRAFT stamp on PDFs of unsaved bills
- **Print Settings:**
  - Default printer selection — for quick print without dialogue
  - Default page size override
- **Appearance & Theme:**
  - Theme selector — all 6 themes (Space Particles, Sakura, Minimal, Dark Rainbow, Neon, Dark Rose) + dark/light variants; live preview on select; switching theme is instant with zero flicker and zero reload
  - Performance mode selector (Lite / Balanced / Ultra)
  - App-level zoom / font size slider — global UI scale; moving the slider immediately scales the entire app UI; accessibility for older/visually impaired users
  - Dark/light mode toggle — switches instantly via CSS variables; persists in config
- **Language / i18n:**
  - Language selector (English default; others addable later without structural changes; selector present even if only English is available now)
- All settings changes propagate instantly via typed event bus — zero restart required

**Test:** Change theme → instant visual change with no flicker; change PDF filename pattern → new bills use new pattern immediately; change PDF save location → PDFs save to new folder; toggle Terms & Conditions per format → appears/disappears in that format's PDFs; zoom slider → entire app UI scales immediately; dark/light toggle → instant switch; all changes persist after app restart.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-11a-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-11a-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 11a-ii is complete. PDF Settings, Print Settings, Appearance & Theme, and Language selector are all working. Now execute **PHASE 11b-i**: build the Dashboard Widget Toggles group (show/hide toggles for every single dashboard widget with instant effect), the Quote Page Settings group (inventory mode toggle, F2/mouse-click edit mode toggle, discount column toggle, qty unit column toggle, rate history hint toggle, stock deduction on bill save toggle, and Inventory Rate Source per Format selectors — independently configurable per Free Format and GST Format), and the Security group (App Lock/PIN enable toggle, numeric PIN setup, idle timeout configuration). All changes instant via event bus.
---

### PHASE 11b-i — Settings Page: Dashboard Widget Toggles + Quote Page Settings + Security

**Goal:** Build the Dashboard Widget Toggles group, the Quote Page Settings group, and the Security group in the Settings page.

**Deliverables:**
- **Dashboard Widget Toggles** — show/hide each widget individually with instant effect on the dashboard:
  - Today's bill count
  - Today's total revenue
  - This month vs last month comparison
  - Top customer this month
  - Pending draft bills indicator
  - Low stock alert indicator
  - Weather info (+ city selector)
  - Crypto markets (+ up to 5 cryptos selector + currency selector)
  - Forex rates (+ currency pairs configurator)
  - Unit converter widget
  - Currency converter widget
  - Calculator sidebar
  - Any additional API tabs
- **Quote Page Settings:**
  - Inventory mode toggle — enables/disables inventory autocomplete on quote page Item Name cell
  - F2 / mouse-click edit mode toggle — when ON: strict Excel-style cell locking (typing does nothing until F2 is pressed); when OFF: typing immediately replaces cell content
  - Discount column toggle — show/hide the per-item discount column on the billing grid
  - Quantity unit column toggle — show/hide the unit field alongside Qty
  - Rate history hint toggle — enable/disable the ghost rate hint in the Rate cell
  - Stock deduction on bill save toggle — enable/disable automatic stock qty reduction when bill is saved
  - **Inventory Rate Source per Format** — independently configurable price field per bill format:
    - Free Format: selector for which inventory price column fills the Rate column on Insert (options: Price, Wholesale Price, GST Price, Credit, and any user-added custom price columns)
    - GST Format: independent selector for the same (separate from Free Format setting)
- **Security:**
  - App Lock / PIN enable toggle
  - Numeric PIN setup — set or change the PIN
  - Idle timeout configuration — set how long before app auto-locks when idle
- All settings changes propagate instantly via typed event bus — zero restart required

**Test:** Toggle weather widget off → disappears from dashboard instantly; toggle it back on → reappears instantly; toggle inventory mode on → autocomplete appears in Item Name cell on quote page; toggle F2 mode on → verify typing does nothing in a cell until F2 pressed; toggle discount column → column appears/disappears on billing grid; set Inventory Rate Source for Free Format to Wholesale Price → Insert in quote page fills Wholesale Price into Rate column; enable App Lock with PIN → on next app launch (or after idle timeout) → PIN screen appears before app loads.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-11b-i.zip` containing all project files at their current state, plus `/docs/phases/phase-11b-i-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 11b-i is complete. Dashboard widget toggles, quote page settings, and security settings are all working. Now execute **PHASE 11b-ii**: build the Backup & Restore group (auto backup scheduler with daily/weekly + destination folder; manual Backup Now button; each backup ZIP contains all SQLite DBs + config file + session activity log; backup restore with drag-drop or browse + auto-backup before restore; drag-and-drop DB sync between devices; data wipe/factory reset with multi-step confirmation), Saved Lists (transporters list, units list), Customer Settings (global default credit limit), all Feature Module Toggles (each boolean; invisible when off; includes WhatsApp quick share with method selector and branch sync behind access key), Access Key entry, and config file export/import (import preserves local company profile, replaces everything else).
---

### PHASE 11b-ii — Settings Page: Backup & Restore + Saved Lists + Customer Settings + Feature Toggles + Access Key + Config Import/Export

**Goal:** Build the Backup & Restore group, Saved Lists management, Customer Settings, all Feature Module Toggles, the Access Key entry, and the config file import/export system.

**Deliverables:**
- **Backup & Restore:**
  - Auto backup scheduler — set schedule (daily / weekly) + destination folder
  - Manual "Backup Now" button — triggers immediately
  - Each backup (scheduled or manual) produces one ZIP containing: all SQLite DB files (active + all company/branch profiles) + config file + session activity log; nothing is omitted
  - Backup restore — drag-drop a backup ZIP into Settings or browse to it; confirmation shown; current-state backup is automatically taken before restore begins
  - Drag-and-drop DB sync between devices (offline) — drag a DB file from another device into Settings to replace the active DB; confirmation + auto-backup before swap
  - Data wipe / factory reset — multi-step confirmation (cannot be triggered accidentally); returns app to blank post-onboarding state; all business data and settings wiped
- **Saved Lists:**
  - Saved transporters list — add, edit, delete frequently used transporter names; these appear as autocomplete suggestions in the Transport Name field on the quote page
  - Saved units list — add, edit, delete quantity units (pcs, kg, meters, boxes, dozen etc.); used across billing grid qty column and inventory
- **Customer Settings:**
  - Customer credit limit global default — applied to all new customers who don't have a specific credit limit set
- **Feature Module Toggles** — boolean toggle for each; each is invisible and has zero impact when off:
  - Reports module (stub)
  - Expense tracker (stub)
  - Multi-user / operator profiles (stub)
  - Payment recorder & ledger (stub; if not fully built in Phase 8b, stub here)
  - WhatsApp quick share toggle (+ method selector: Desktop deep link / WhatsApp Web — user-configurable; no hardcoded default)
  - Branch sync settings (visible and configurable only when cloud sync access key is active)
- **Access Key:**
  - Text input to enter cloud sync access key (obtained from developer)
  - Entering a valid key unlocks admin-only features (branch sync toggle becomes visible and configurable)
- **Config file export** — exports all current settings as a single drag-droppable config file; can be taken to another device
- **Config file import** — drag-drop a config file into Settings or browse to it; on import: **preserves the local company profile** (firm name, address, logo, GST, branches, contact info) and **replaces everything else** (themes, toggles, shortcuts, PDF settings, all other preferences) with the imported config
- All settings changes propagate instantly via typed event bus — zero restart required

**Test:** Toggle weather widget off from Phase 11b-i → still off after coming here; set backup schedule → backup ZIP file created at scheduled time containing all DBs + config + session log; manual backup → ZIP created immediately; factory reset → multi-step confirmation required → onboarding wizard re-runs after reset; import a config file from another device → all non-company settings replaced, company profile unchanged; export config → file produced; access key entry unlocks branch sync toggle; WhatsApp method selector saves correctly; saved transporters appear in quote page autocomplete.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-11b-ii.zip` containing all project files at their current state, plus `/docs/phases/phase-11b-ii-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 11b-ii is complete. All Settings sections are fully built. Now execute **PHASE 12a**: wire every keyboard shortcut from the complete shortcut map across the entire app — all navigation shortcuts (Ctrl+1–6), Alt+N calculator, Alt+1/Alt+2 format toggle, Ctrl+S save bill, Ctrl+P save PDF, Ctrl+Shift+C copy image, Ctrl+Shift+X copy simplified image, Ctrl+Shift+P quick print, Ctrl+Z/Ctrl+Y grid-level undo/redo, Ctrl+K command palette, Ctrl+/ shortcut reference panel, Ctrl+D duplicate bill, Ctrl+H open history, Ctrl+, open settings, Escape back/close modal, Insert (context-aware: inventory autocomplete in Item Name cell OR rate hint in Rate cell — zero conflict), F2 edit mode. No conflicts anywhere. All shortcuts functional when toolbar is hidden.
---

### PHASE 12a — Global UX: All Keyboard Shortcuts Wired

**Goal:** Wire every keyboard shortcut from Section 15 across the entire app so that every shortcut listed in the complete keyboard shortcut map works correctly from any page or context.

**Deliverables:**
- Every keyboard shortcut from Section 15 wired and working across the entire app:

| Shortcut | Action |
|---|---|
| **Ctrl+1** | Navigate to New Quote |
| **Ctrl+2** | Navigate to History |
| **Ctrl+3** | Navigate to Customer Details |
| **Ctrl+4** | Navigate to Inventory |
| **Ctrl+5** | Navigate to Loose Inventory History |
| **Ctrl+6** | Navigate to Settings |
| **Alt+N** | Open/close calculator |
| **Alt+1** | Switch to Free Format (billing grid) |
| **Alt+2** | Switch to GST Format (billing grid) |
| **Ctrl+S** | Save bill |
| **Ctrl+P** | Save PDF |
| **Ctrl+Shift+C** | Copy image (professional format) |
| **Ctrl+Shift+X** | Copy simplified image |
| **Ctrl+Shift+P** | Quick print |
| **Ctrl+Z** | Undo (grid-level within current bill) |
| **Ctrl+Y** | Redo (grid-level within current bill) |
| **Ctrl+K** | Global fuzzy search / command palette |
| **Ctrl+/** | Open shortcut reference panel |
| **Ctrl+D** | Duplicate current bill |
| **Ctrl+H** | Open History |
| **Ctrl+,** | Open Settings |
| **Escape** | Back / close modal |
| **Insert** | Accept inventory autocomplete suggestion (in Item Name cell) OR accept rate hint (in Rate cell) — column-context-aware, zero conflict |
| **F2** | Enter edit mode in cell (when F2 mode is enabled in Settings) |
| *(Custom column)* | +Col / -Col / Mark / Show MKD — via toolbar + assignable shortcuts |
| *(Row actions)* | Add row, drag reorder — via toolbar |

- No shortcut conflicts anywhere in the app
- All shortcuts remain functional when toolbar is hidden
- Shortcuts that fire on context (Insert, F2) behave correctly per their column-context rules

**Test:** Press every shortcut in the table above from the relevant page/context and verify it performs the correct action; press all navigation shortcuts (Ctrl+1–6) from every page; press Ctrl+S on quote page → bill saves; press Insert in Item Name cell (inventory mode on) → accepts autocomplete; press Insert in Rate cell (hint visible) → accepts hint; press Insert in Rate cell when no hint → does nothing; all shortcuts work when toolbar is hidden.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-12a.zip` containing all project files at their current state, plus `/docs/phases/phase-12a-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 12a is complete. Every keyboard shortcut from the full shortcut map is wired and working with zero conflicts. Now execute **PHASE 12b**: build the universal calculator (Alt+N; opens at bottom of screen; keyboard-only — no mouse buttons required; full mathematical operations; history of calculation rows — every calculation is a persistent row; any previous row editable and result updates; refresh/clear; does not conflict with any other shortcut), the persistent scratchpad/sticky notes (floating; accessible from anywhere via shortcut; content persists across navigation and app restarts), the global fuzzy command palette (Ctrl+K; searches across customers, bills, inventory items, and settings; navigate directly to any result), and the shortcut reference panel (Ctrl+/; floating card listing all active shortcuts in the app).
---

### PHASE 12b — Global UX: Calculator + Scratchpad + Command Palette + Shortcut Reference Panel

**Goal:** Build the universal keyboard-only calculator with full history and row editing, the persistent scratchpad, the global fuzzy command palette, and the shortcut reference panel.

**Deliverables:**
- **Universal calculator** (Alt+N):
  - Opens at the bottom of the screen
  - Controlled entirely from keyboard — no mouse buttons required
  - Full standard mathematical operations
  - History of calculation rows — each calculation is a persistent row
  - Any previous row is editable — editing a previous row updates its result and all dependent results
  - Refresh / clear calculator
  - Does not conflict with any other shortcut in the app
- **Scratchpad / sticky notes** — persistent floating notepad accessible from anywhere in the app via a keyboard shortcut; for quick notes during billing that don't belong to any specific bill; content persists across navigation and app restarts
- **Global fuzzy search / command palette** (Ctrl+K):
  - Command-palette style: one input box searches across everything
  - Searches across: customers, bills, inventory items, and settings
  - Navigate directly to any result from the palette — selecting a customer opens that customer record; selecting a bill opens that bill; selecting a settings item scrolls to that setting
- **Shortcut reference panel** (Ctrl+/):
  - Floating card/panel listing all active keyboard shortcuts in the app
  - Accessible from anywhere in the app
  - Shows shortcut + action for every shortcut in the Section 15 table

**Test:** Alt+N → calculator opens at bottom of screen; perform a calculation using only keyboard; go back to a previous calculation row → edit it → result updates; close and reopen calculator → history preserved; open scratchpad → type notes; navigate away to another page → open scratchpad again → notes still there; restart app → scratchpad content still present; Ctrl+K → command palette opens; type a customer name → customer appears in results → press Enter → customer record opens; type a bill PO number → bill appears → navigate to it; Ctrl+/ → shortcut panel opens showing all shortcuts from the Section 15 table.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-12b.zip` containing all project files at their current state, plus `/docs/phases/phase-12b-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 12b is complete. Calculator, scratchpad, command palette, and shortcut reference panel are all working. Now execute **PHASE 13**: stub all future boolean-gated modules — Reports module, Expense Tracker, Multi-user/Operator Profiles, Payment Recorder & Ledger (if not fully built in Phase 8b), WhatsApp Quick Share (wired to trigger on bill copy; method from Settings), Branch Activity Monitor (admin + cloud key only), Centralized Customer DB Sync stub, Price List Sync stub, and any additional developer-suggested tools. Each module has a boolean toggle in Settings; when off it is completely invisible and has zero impact on the rest of the app; when on it shows a clear placeholder page. No core functionality breaks when any module is toggled.
---

### PHASE 13 — Boolean-Gated Module Stubs + Future Module Wiring

**Goal:** All future modules properly stubbed, wired into feature flag contexts, visible/invisible based on settings toggles.

**Deliverables:**
- Reports module stub (fully gated; enabling shows placeholder page)
- Expense tracker stub
- Multi-user / operator profiles stub
- Payment recorder & ledger stub (if not already fully built in Phase 8)
- WhatsApp quick share stub (wired to trigger on bill copy; method from Settings)
- Branch activity monitor stub (admin + cloud key only)
- Centralized customer DB sync stub
- Price list sync stub
- Mobile module note (documented future path)
- Any additional developer-suggested tools — each with a boolean toggle; none break core when off

**Test:** Toggle each module on → placeholder page appears; toggle off → completely invisible; no console errors; rest of app unaffected.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-13.zip` containing all project files at their current state, plus `/docs/phases/phase-13-done.md` (what was built, decisions made, known issues, handoff state).

> **➡ Next Session Prompt:** Phase 13 is complete. All future module stubs are wired and boolean-gated correctly. Now execute **PHASE 14 — the final session**: run a full integration test across all pages and features, validate performance mode (Lite strips Three.js and Framer Motion and stops all API polling — billing still works at full speed), complete the `electron-builder` config for Windows installer, confirm `npm run dev` works without `.exe` compilation, document all known limitations, update the full README, produce the final architecture diagram, ensure all phase-done files are complete, and produce the final ZIP output containing `/README`, `/docs`, `/phase-output`, `/changelog`, and `/decisions`.
---

### PHASE 14 — Polish, Performance, Integration Testing, Packaging

**Goal:** Full integration test pass, performance mode validation across all tiers, Electron packaging config, final README, and ZIP output for distribution.

**Deliverables:**
- Full integration test across all pages and features
- Performance mode validated: Lite strips Three.js and Framer Motion and stops all API polling; billing still works perfectly at full speed
- `electron-builder` config complete (installer builds for Windows)
- `npm run dev` confirmed working without `.exe` compilation
- All known limitations documented
- Full README updated
- Final architecture diagram
- All phase-done files complete
- Final ZIP with `/README`, `/docs`, `/phase-output`, `/changelog`, `/decisions`

**Test:** Full smoke test; rollback test for every major module; performance check on Lite mode; `npm run dev` passes; build produces Windows installer.

> **📦 ZIP Output:** Provide a ZIP file named `cQikly-phase-14-FINAL.zip` containing the complete project at final state, plus `/docs/phases/phase-14-done.md` and the complete `/README`, `/docs`, `/changelog`, `/decisions` folders.

---

> **IMPORTANT:** No phase above may skip any feature. If a feature cannot be completed within session limits, a full interface stub with `// TODO: [FEATURE NAME] - [exact description]` must be left in place. The app must always be fully runnable after every phase. Nothing is silently dropped. Phases: **1a-i-A, 1a-i-B, 1a-ii-A, 1a-ii-B, 1b-A, 1b-B, 2a-A, 2a-B, 2b, 3a-A, 3a-B, 3b-i, 3b-ii, 4b-i, 4b-ii, 5a, 5b, 4a-i, 4a-ii-A, 4a-ii-B, 6a-A, 6b-A-i, 6b-A-ii, 6b-B, 7a-A, 7a-B, 7b, 8a, 8b-i, 8b-ii, 9a-A, 9a-B, 9b-A, 9b-B-i, 9b-B-ii-A, 9b-B-ii-B, 10, 11a-i, 11a-ii, 11b-i, 11b-ii, 12a, 12b, 13, 14** — **45 sessions total.**

---

*End of cQikly MASTERPLAN v2.9*
