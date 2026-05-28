/**
 * cQikly — Shared UI Components Index
 * All shared/reusable components are exported from here.
 *
 * Phase 1b-A additions:
 *   <AppLockGate />         — wraps app; shows PIN screen when lock is enabled
 *   <CrashRecoveryPrompt /> — bottom-right banner when a draft is detected
 *   <UpdateToast />         — top-right toast when an update is available
 *
 * Planned shared components (built across phases):
 *   <AppShell />          — Phase 1b-B: sidebar + main content layout
 *   <Sidebar />           — Phase 1b-B: 6-button nav sidebar
 *   <ThemeBackground />   — Phase 3b-ii: animated theme background layer
 *   <ToastProvider />     — Phase 1b-B: notification toasts
 *   <BillingGrid />       — Phase 5a: the core billing table
 *   <PartyDetails />      — Phase 4b: party name / phone / transport section
 *   <PdfPreview />        — Phase 6a-A: PDF preview modal
 *   <FuzzySearch />       — Phase 4b: reusable fuzzy search input with dropdown
 *   <StatusBadge />       — Phase 7a: bill status color badge
 *   <ConfirmDialog />     — Phase 7a: reusable confirmation dialog
 *
 * All components follow the UI design rule (Spec #27):
 *   Generous padding, breathing room, nothing cramped, nothing ugly.
 */

// ─── Phase 1b-A Safety System Components ─────────────────────────────────────
export { AppLockGate }          from './AppLockGate'
export { CrashRecoveryPrompt }  from './CrashRecoveryPrompt'
export { UpdateToast }          from './UpdateToast'

// ─── Phase 1b-B Navigation Shell Components ───────────────────────────────────
export { AppShell }       from './AppShell'
export { Sidebar }        from './Sidebar'
export { PlaceholderPage } from './PlaceholderPage'

// ─── Phase 2b Onboarding Components ──────────────────────────────────────────
export { default as InternetGate } from './InternetGate'

// ─── Phase 12a Global Overlay Components ──────────────────────────────────────
export { CalculatorOverlay }       from './CalculatorOverlay'
export { CommandPaletteOverlay }   from './CommandPaletteOverlay'
export { ShortcutReferencePanel }  from './ShortcutReferencePanel'
// ─── Phase 12b Global Overlay Components ──────────────────────────────────────
export { ScratchpadOverlay }       from './ScratchpadOverlay'
export { ModulePlaceholderPage } from './ModulePlaceholderPage'
