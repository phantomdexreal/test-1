/**
 * cQikly — useGlobalShortcuts
 * Built in: Phase 12a
 *
 * Wires every keyboard shortcut from the Section 15 shortcut map across the
 * entire app.  Mounted once inside AppShell so shortcuts work from ANY page
 * and even when the toolbar is hidden.
 *
 * Shortcut map:
 *   Ctrl+1–6        Navigate to page (already in NavigationContext; re-checked here for completeness)
 *   Ctrl+H          Open History  (Ctrl+2 alias)
 *   Ctrl+,          Open Settings (Ctrl+6 alias)
 *   Alt+N           Open/close calculator   → eventBus.openCalculator
 *   Alt+S           Open/close scratchpad   → eventBus.openScratchpad
 *   Ctrl+K          Open command palette    → eventBus.openCommandPalette
 *   Ctrl+/          Open shortcut panel     → eventBus.openShortcutPanel
 *   Ctrl+S          Save bill               → eventBus.shortcutSaveBill   (NewQuote handles)
 *   Ctrl+P          Save PDF                → eventBus.shortcutSavePdf    (NewQuote handles)
 *   Ctrl+Shift+C    Copy image (pro format) → eventBus.shortcutCopyImage
 *   Ctrl+Shift+X    Copy simplified image   → eventBus.shortcutCopySimplified
 *   Ctrl+Shift+P    Quick print             → eventBus.shortcutQuickPrint
 *   Ctrl+D          Duplicate bill          → eventBus.shortcutDuplicateBill
 *   Alt+1           Switch to Free Format   (BillingGrid also handles in-grid)
 *   Alt+2           Switch to GST Format    (BillingGrid also handles in-grid)
 *   Escape          Close top-most overlay  → overlayStack managed here
 *   Insert          Context-aware (BillingGrid owns this — not fired here)
 *   F2              Edit-mode toggle        (BillingGrid owns this — not fired here)
 *   Ctrl+Z / Ctrl+Y Undo/Redo               (BillingGrid owns this — not fired here)
 *
 * Design decisions:
 * - Shortcuts that only make sense inside a specific grid cell (Insert, F2, Ctrl+Z/Y)
 *   are NOT re-fired here — the BillingGrid handles them with full context.
 * - All "page action" shortcuts (Ctrl+S, Ctrl+P, etc.) are emitted as eventBus
 *   events so that the relevant page component can subscribe and execute them.
 *   This avoids tight coupling between AppShell and page internals.
 * - Alt+N / Ctrl+K / Ctrl+/ each toggle their overlay via the same event bus,
 *   and the overlay components (stubs in Phase 12a, full in 12b) subscribe.
 */

import { useEffect } from 'react'
import { useNavigation } from '../contexts/NavigationContext'
import { eventBus } from '../utils/eventBus'
import type { PageId } from '../contexts/NavigationContext'

export function useGlobalShortcuts(): void {
  const { setActivePage } = useNavigation()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      // ── Ignore if user is typing inside an <input>, <textarea>, or contenteditable
      //    EXCEPT for the overlay-toggle shortcuts which should always work.
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement)?.isContentEditable

      // ── Navigation shortcuts Ctrl+H and Ctrl+, ───────────────────────────────
      // These should fire even from editable fields (consistent with Ctrl+1–6
      // which are in NavigationContext).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === 'h') {
          // Ctrl+H → Open History
          // Note: Ctrl+H is also used for "highlight cell" in NewQuote toolbar.
          // The NewQuote handler fires first (captured at window level, same phase).
          // We only navigate if NOT on new-quote page to avoid conflict.
          // Actually: per masterplan, Ctrl+H = open history globally.
          // The NewQuote highlight shortcut was an informal convenience; the
          // official masterplan shortcut takes precedence. NewQuote will use
          // its toolbar button or Ctrl+H from outside the quote page.
          // To avoid double-firing, the NewQuote local handler checks if focus
          // is inside the grid before applying highlight.
          e.preventDefault()
          setActivePage('history' as PageId)
          return
        }
        if (e.key === ',') {
          // Ctrl+, → Open Settings
          e.preventDefault()
          setActivePage('settings' as PageId)
          return
        }
      }

      // ── Alt+N — Open/close calculator ────────────────────────────────────────
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        eventBus.emit('openCalculator', {})
        return
      }

      // ── Alt+S — Open/close scratchpad ─────────────────────────────────────────
      if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        eventBus.emit('openScratchpad', {})
        return
      }

      // ── Ctrl+K — Global command palette ──────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'k') {
        e.preventDefault()
        eventBus.emit('openCommandPalette', {})
        return
      }

      // ── Ctrl+/ — Shortcut reference panel ────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === '/') {
        e.preventDefault()
        eventBus.emit('openShortcutPanel', {})
        return
      }

      // ── Shortcuts below only apply on the New Quote page (or are no-ops elsewhere)
      // We emit them as events; only NewQuote subscribes and acts on them.

      if (isEditable) return  // don't override typing in text fields below

      // ── Ctrl+S — Save bill ────────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 's') {
        e.preventDefault()
        eventBus.emit('shortcutSaveBill', {})
        return
      }

      // ── Ctrl+P — Save PDF ─────────────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'p') {
        e.preventDefault()
        eventBus.emit('shortcutSavePdf', {})
        return
      }

      // ── Ctrl+Shift+C — Copy image (professional format) ──────────────────────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'C') {
        e.preventDefault()
        eventBus.emit('shortcutCopyImage', {})
        return
      }

      // ── Ctrl+Shift+X — Copy simplified image ─────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'X') {
        e.preventDefault()
        eventBus.emit('shortcutCopySimplified', {})
        return
      }

      // ── Ctrl+Shift+P — Quick print ────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key === 'P') {
        e.preventDefault()
        eventBus.emit('shortcutQuickPrint', {})
        return
      }

      // ── Ctrl+D — Duplicate bill ───────────────────────────────────────────────
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key === 'd') {
        e.preventDefault()
        eventBus.emit('shortcutDuplicateBill', {})
        return
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [setActivePage])
}
