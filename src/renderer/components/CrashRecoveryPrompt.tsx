/**
 * cQikly — CrashRecoveryPrompt
 * Phase: 1b-A
 *
 * PURPOSE:
 *   Listens for the crash:draftFoundOnLaunch IPC push from the main process.
 *   If a draft is found, shows a non-blocking bottom banner / toast offering
 *   Restore or Discard.
 *
 * RULES (Hard Spec #7):
 *   Only ONE draft slot. Only the most recent unsaved bill is shown here.
 *
 * STUB STATUS:
 *   The "Restore" path currently reads the draft and logs it.
 *   The actual bill restoration (loading the draft into the quote page state)
 *   is wired in Phase 3 when the quote page is built.
 *   "Restore" fires the BILL_DRAFT_RESTORED session log event.
 *   "Discard" clears the draft file and fires BILL_DRAFT_DISCARDED.
 *
 * VISIBILITY:
 *   The prompt is a non-blocking floating banner — it never prevents billing.
 *   It auto-dismisses after 60 seconds if the user does nothing (draft is NOT
 *   deleted on auto-dismiss — it stays until explicitly restored or discarded).
 *
 * DEPENDENCIES:
 *   window.cqikly.crashRecovery (IPC bridge)
 *   window.cqikly.app.sessionLog (session logger bridge)
 */

import React, { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftSummary {
  partyName?: string
  billDate?: string
  itemCount?: number
}

interface DraftFoundPayload {
  hasDraft: boolean
  summary?: DraftSummary
}

type PromptState = 'hidden' | 'visible' | 'restoring' | 'discarding'

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Mount this component once, high in the React tree (but inside all providers).
 * It renders nothing until a draft is detected.
 */
export function CrashRecoveryPrompt(): React.ReactElement | null {
  const [promptState, setPromptState] = useState<PromptState>('hidden')
  const [summary,     setSummary]     = useState<DraftSummary | null>(null)
  const [draft,       setDraft]       = useState<unknown>(null)

  // ── Subscribe to IPC push ──────────────────────────────────────────────────
  useEffect(() => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) return

    // Subscribe to the push event from main process (fires on launch if draft exists)
    const unsubscribe = api.crashRecovery.onDraftFound((payload: DraftFoundPayload) => {
      if (!payload.hasDraft) return
      setSummary(payload.summary ?? null)
      setPromptState('visible')

      // Pre-load the draft data so "Restore" can act immediately without a loading state
      api.crashRecovery.readDraft().then((d) => {
        setDraft(d)
      }).catch(() => {
        // If we can't read it, we still show the prompt — restore will show an error
      })
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  // ── Auto-dismiss after 60 seconds (draft is NOT deleted) ──────────────────
  useEffect(() => {
    if (promptState !== 'visible') return
    const timer = setTimeout(() => {
      setPromptState('hidden')
    }, 60_000)
    return () => clearTimeout(timer)
  }, [promptState])

  // ── Restore ────────────────────────────────────────────────────────────────
  const handleRestore = useCallback(async () => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) return

    setPromptState('restoring')
    try {
      // Read the full draft (already pre-loaded in `draft` state)
      const draftData = draft ?? await api.crashRecovery.readDraft()

      // Log the restore event
      api.app.sessionLog('BILL_DRAFT_RESTORED', {
        partyName: summary?.partyName,
        itemCount: summary?.itemCount,
      })

      // Clear the draft slot — it is now "in use" by the restored session
      await api.crashRecovery.clearDraft()

      // TODO: [DRAFT-RESTORE] In Phase 3, dispatch a context event / navigate to
      // the Quote page and hydrate the billing form with `draftData`.
      // For now, log the draft contents so it's visible in DevTools.
      console.log('[CrashRecovery] Draft restored — data:', draftData)

      setPromptState('hidden')
    } catch (err) {
      console.error('[CrashRecovery] Restore failed:', err)
      setPromptState('visible') // Stay visible so user can retry or discard
    }
  }, [draft, summary])

  // ── Discard ────────────────────────────────────────────────────────────────
  const handleDiscard = useCallback(async () => {
    const api = (window as Window & typeof globalThis).cqikly
    if (!api) return

    setPromptState('discarding')
    try {
      api.app.sessionLog('BILL_DRAFT_DISCARDED', {
        partyName: summary?.partyName,
      })
      await api.crashRecovery.clearDraft()
    } catch (err) {
      console.warn('[CrashRecovery] clearDraft() failed:', err)
    } finally {
      setPromptState('hidden')
    }
  }, [summary])

  // ── Render — nothing if hidden ─────────────────────────────────────────────
  if (promptState === 'hidden') return null

  // ── Build description ──────────────────────────────────────────────────────
  const parts: string[] = []
  if (summary?.partyName) parts.push(`for ${summary.partyName}`)
  if (summary?.billDate)  parts.push(`dated ${summary.billDate}`)
  if (summary?.itemCount != null) parts.push(`(${summary.itemCount} item${summary.itemCount !== 1 ? 's' : ''})`)
  const description = parts.length > 0
    ? `Unsaved bill ${parts.join(' ')}`
    : 'An unsaved bill draft was found'

  const isBusy = promptState === 'restoring' || promptState === 'discarding'

  return (
    <div style={bannerContainerStyles}>
      <div style={bannerStyles}>
        {/* Left: icon + text */}
        <div style={bannerLeftStyles}>
          <span style={bannerIconStyles}>📋</span>
          <div>
            <p style={bannerTitleStyles}>Unsaved draft detected</p>
            <p style={bannerDescStyles}>{description}</p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div style={bannerActionsStyles}>
          <button
            onClick={handleRestore}
            disabled={isBusy}
            style={{ ...actionButtonStyles, ...restoreButtonStyles }}
          >
            {promptState === 'restoring' ? 'Restoring…' : 'Restore'}
          </button>
          <button
            onClick={handleDiscard}
            disabled={isBusy}
            style={{ ...actionButtonStyles, ...discardButtonStyles }}
          >
            {promptState === 'discarding' ? 'Discarding…' : 'Discard'}
          </button>
          {/* Dismiss without deciding — draft stays for next launch */}
          <button
            onClick={() => setPromptState('hidden')}
            disabled={isBusy}
            style={dismissButtonStyles}
            title="Dismiss (draft will be shown again on next launch)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Positioned at bottom-right, non-blocking — never covers the billing area.

const bannerContainerStyles: React.CSSProperties = {
  position: 'fixed',
  bottom: '1.5rem',
  right: '1.5rem',
  zIndex: 9000,
  maxWidth: 480,
  width: 'calc(100vw - 3rem)',
}

const bannerStyles: React.CSSProperties = {
  background: 'var(--cq-surface, #111827)',
  border: '1px solid #f59e0b44',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '0.75rem',
  padding: '1rem 1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  animation: 'slideUpIn 0.25s ease',
}

const bannerLeftStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  flex: 1,
  minWidth: 0,
}

const bannerIconStyles: React.CSSProperties = {
  fontSize: '1.4rem',
  flexShrink: 0,
  marginTop: '0.1rem',
}

const bannerTitleStyles: React.CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  fontWeight: 600,
  color: 'var(--cq-text-primary, #e2e8f0)',
}

const bannerDescStyles: React.CSSProperties = {
  margin: '0.2rem 0 0',
  fontSize: '0.78rem',
  color: 'var(--cq-text-muted, #475569)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const bannerActionsStyles: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexShrink: 0,
}

const actionButtonStyles: React.CSSProperties = {
  border: 'none',
  borderRadius: '0.4rem',
  padding: '0.45rem 0.9rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
}

const restoreButtonStyles: React.CSSProperties = {
  background: '#f59e0b',
  color: '#000',
}

const discardButtonStyles: React.CSSProperties = {
  background: 'var(--cq-border, #1e293b)',
  color: 'var(--cq-text-muted, #475569)',
}

const dismissButtonStyles: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--cq-text-muted, #475569)',
  fontSize: '1.2rem',
  cursor: 'pointer',
  padding: '0.2rem 0.4rem',
  lineHeight: 1,
  borderRadius: '0.3rem',
  transition: 'color 0.15s ease',
}
