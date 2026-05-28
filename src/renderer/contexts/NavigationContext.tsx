/**
 * cQikly — NavigationContext
 * Built in: Phase 1b-B
 * Phase 6b-B: Added Unsaved Changes Guard — pages register a dirty flag +
 *   save callback; navigating away shows a Save / Discard / Cancel dialog.
 *
 * Manages the active page, page history, and Ctrl+1–6 shortcuts.
 * All navigation is centralised here — no component calls router directly.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// ─── Page definitions ──────────────────────────────────────────────────────────

export type PageId =
  | 'dashboard'
  | 'new-quote'
  | 'history'
  | 'customer-details'
  | 'inventory'
  | 'loose-inventory-history'
  | 'settings'
  // ── Boolean-gated module pages (Phase 13) ──────────────────────────────────
  // These are only shown in the sidebar when their feature flag is ON.
  // They are valid PageIds so navigation can set them, but they are never
  // in the core ALL_PAGES list. The Sidebar and AppShell handle the gating.
  | 'module-reports'
  | 'module-expense-tracker'
  | 'module-multi-user'
  | 'module-payment-ledger'
  // 'module-whatsapp-share' removed — WhatsApp Share is a service module with no nav page
  | 'module-branch-sync'
  | 'module-branch-activity-monitor'
  | 'module-customer-db-sync'
  | 'module-price-list-sync'

export interface PageMeta {
  id: PageId
  label: string
  shortcut: string     // e.g. "Ctrl+1"
  shortcutKey: string  // e.g. "1"
  icon: string         // emoji / icon char for placeholder pages
  phaseBuilt: string
}

export const ALL_PAGES: PageMeta[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortcut: 'Ctrl+`',
    shortcutKey: '`',
    icon: '🏠',
    phaseBuilt: 'Phase 3a-A',
  },
  {
    id: 'new-quote',
    label: 'New Quote',
    shortcut: 'Ctrl+1',
    shortcutKey: '1',
    icon: '📄',
    phaseBuilt: 'Phase 4a-A/B',
  },
  {
    id: 'history',
    label: 'History',
    shortcut: 'Ctrl+2',
    shortcutKey: '2',
    icon: '🗂',
    phaseBuilt: 'Phase 7a',
  },
  {
    id: 'customer-details',
    label: 'Customer Details',
    shortcut: 'Ctrl+3',
    shortcutKey: '3',
    icon: '👥',
    phaseBuilt: 'Phase 8a',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    shortcut: 'Ctrl+4',
    shortcutKey: '4',
    icon: '📦',
    phaseBuilt: 'Phase 9a-A',
  },
  {
    id: 'loose-inventory-history',
    label: 'Loose Inventory History',
    shortcut: 'Ctrl+5',
    shortcutKey: '5',
    icon: '📋',
    phaseBuilt: 'Phase 9b-A',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortcut: 'Ctrl+6',
    shortcutKey: '6',
    icon: '⚙️',
    phaseBuilt: 'Phase 11a-i/ii',
  },
]

export const PAGE_MAP = Object.fromEntries(
  ALL_PAGES.map(p => [p.id, p])
) as Record<PageId, PageMeta>

// ─── Guard dialog ──────────────────────────────────────────────────────────────

interface GuardDialogProps {
  targetPage: PageMeta
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
  saving?: boolean
}

function UnsavedGuardDialog({ targetPage, onSave, onDiscard, onCancel, saving = false }: GuardDialogProps): React.ReactElement {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (saving) return
      if (e.key === 'Escape') { e.preventDefault(); onCancel() }
      if (e.key === 'Enter')  { e.preventDefault(); onSave() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onSave, onCancel, saving])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guard-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: 'var(--cq-surface-raised)',
        border: '1px solid var(--cq-border)',
        borderRadius: '14px',
        padding: '28px 32px',
        minWidth: '380px',
        maxWidth: '440px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        fontFamily: '"Inter", system-ui, sans-serif',
        animation: 'guardIn 0.15s ease',
      }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'color-mix(in srgb, #f59e0b 18%, var(--cq-surface-raised))',
            border: '1px solid color-mix(in srgb, #f59e0b 40%, var(--cq-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0,
          }}>
            ⚠️
          </div>
          <div>
            <div id="guard-title" style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--cq-text-primary)' }}>
              Unsaved Changes
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)', marginTop: '2px' }}>
              Navigating to <strong style={{ color: 'var(--cq-accent)' }}>{targetPage.label}</strong>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--cq-text-muted)', lineHeight: 1.55, margin: '0 0 22px' }}>
          This bill has unsaved changes. If you leave now, your work will be lost.
          Would you like to save before leaving?
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: '7px',
              background: 'transparent', border: '1px solid var(--cq-border)',
              color: 'var(--cq-text-muted)', fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: '7px',
              background: 'color-mix(in srgb, #ef4444 12%, var(--cq-surface-raised))',
              border: '1px solid color-mix(in srgb, #ef4444 40%, var(--cq-border))',
              color: '#ef4444', fontSize: '0.82rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.5 : 1,
            }}
          >
            Discard &amp; Leave
          </button>
          <button
            type="button"
            autoFocus
            onClick={onSave}
            disabled={saving}
            style={{
              padding: '8px 18px', borderRadius: '7px',
              background: 'var(--cq-accent)', border: 'none',
              color: 'var(--cq-surface)', fontSize: '0.82rem', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Bill'}
          </button>
        </div>

        <div style={{ marginTop: '12px', fontSize: '0.68rem', color: 'var(--cq-text-muted)', opacity: 0.55, textAlign: 'right' }}>
          Enter → Save  ·  Esc → Cancel
        </div>
      </div>
      <style>{`@keyframes guardIn { from { opacity: 0; transform: scale(0.96) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  )
}

// ─── Context shape ─────────────────────────────────────────────────────────────

export interface NavigationContextValue {
  activePage: PageId
  setActivePage: (id: PageId) => void
  allPages: PageMeta[]
  activePageMeta: PageMeta
  /**
   * Register an unsaved-changes guard.
   * Call with (isDirtyFn, saveFn) when the page has unsaved content.
   * Call with (null, null) to clear the guard after save / discard / reset.
   *
   * isDirtyFn: called before navigation — return true to show guard dialog.
   * saveFn:    async — navigation waits for it to resolve before switching page.
   */
  registerUnsavedGuard: (isDirty: (() => boolean) | null, onSave: (() => Promise<void> | void) | null) => void
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

// ─── Provider ──────────────────────────────────────────────────────────────────

export function NavigationProvider({
  children,
  initialPage = 'dashboard',
}: {
  children: React.ReactNode
  initialPage?: PageId
}): React.ReactElement {
  const [activePage, setActivePageState] = useState<PageId>(initialPage)

  // Guard state — using refs so guard callbacks are always fresh
  const isDirtyRef  = useRef<(() => boolean) | null>(null)
  const onSaveRef   = useRef<(() => Promise<void> | void) | null>(null)

  // pendingNav: non-null while the guard dialog is open
  const [pendingNav, setPendingNav] = useState<PageId | null>(null)
  // guardSaving: true while the async save is in-flight (disables dialog buttons)
  const [guardSaving, setGuardSaving] = useState(false)

  const registerUnsavedGuard = useCallback(
    (isDirty: (() => boolean) | null, onSave: (() => Promise<void> | void) | null) => {
      isDirtyRef.current = isDirty
      onSaveRef.current  = onSave
    },
    []
  )

  const setActivePage = useCallback((id: PageId) => {
    // Check guard
    if (isDirtyRef.current && isDirtyRef.current()) {
      setPendingNav(id)
      return
    }
    setActivePageState(id)
  }, [])

  // ── Guard dialog handlers ─────────────────────────────────────────────────
  const handleGuardSave = useCallback(async () => {
    setGuardSaving(true)
    try {
      if (onSaveRef.current) await onSaveRef.current()
    } catch (err) {
      console.error('[NavigationContext] Guard save failed:', err)
      setGuardSaving(false)
      return // Don't navigate if save threw
    }
    isDirtyRef.current = null
    onSaveRef.current  = null
    const target = pendingNav
    setPendingNav(null)
    setGuardSaving(false)
    if (target) setActivePageState(target)
  }, [pendingNav])

  const handleGuardDiscard = useCallback(() => {
    isDirtyRef.current = null
    onSaveRef.current  = null
    const target = pendingNav
    setPendingNav(null)
    if (target) setActivePageState(target)
  }, [pendingNav])

  const handleGuardCancel = useCallback(() => {
    setPendingNav(null)
  }, [])

  // Ctrl+1–6 global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (!e.ctrlKey || e.shiftKey || e.altKey || e.metaKey) return
      if (e.key === '`' || e.key === '0') {
        e.preventDefault()
        setActivePage('dashboard')
        return
      }
      const page = ALL_PAGES.find(p => p.shortcutKey === e.key && p.id !== 'dashboard')
      if (!page) return
      e.preventDefault()
      setActivePage(page.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActivePage])

  const value = useMemo<NavigationContextValue>(() => ({
    activePage,
    setActivePage,
    allPages: ALL_PAGES,
    activePageMeta: PAGE_MAP[activePage as PageId],
    registerUnsavedGuard,
  }), [activePage, setActivePage, registerUnsavedGuard])

  return (
    <NavigationContext.Provider value={value}>
      {children}
      {pendingNav && (
        <UnsavedGuardDialog
          targetPage={PAGE_MAP[pendingNav as PageId]}
          onSave={handleGuardSave}
          onDiscard={handleGuardDiscard}
          onCancel={handleGuardCancel}
          saving={guardSaving}
        />
      )}
    </NavigationContext.Provider>
  )
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigation() must be used inside <NavigationProvider>')
  return ctx
}

/**
 * useUnsavedGuard — convenience hook for pages that have unsaved-changes
 * detection. Wire the guard once; call setDirty(true/false) as content changes.
 *
 * Example:
 *   const { setDirty } = useUnsavedGuard({ onSave: handleSaveBill })
 *
 *   // when bill content changes:
 *   setDirty(true)
 *
 *   // after bill is saved / cleared:
 *   setDirty(false)
 */
export function useUnsavedGuard({ onSave }: { onSave: () => Promise<void> | void }): {
  setDirty: (dirty: boolean) => void
} {
  const { registerUnsavedGuard } = useNavigation()

  // Keep onSave always current without re-registering
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const dirtyRef = useRef(false)

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
    if (dirty) {
      registerUnsavedGuard(
        () => dirtyRef.current,
        () => onSaveRef.current()
      )
    } else {
      registerUnsavedGuard(null, null)
    }
  }, [registerUnsavedGuard])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      registerUnsavedGuard(null, null)
    }
  }, [registerUnsavedGuard])

  return { setDirty }
}
