/**
 * cQikly — Calculator Sidebar
 * Phase: 3b-i
 *
 * Triggered: Alt+N (no conflict with any existing shortcut)
 * Position: bottom of screen, slides up
 * Keyboard-only: full operation without mouse
 * History: every calculation is a persistent row stored in localStorage
 * Editable rows: editing any previous row re-evaluates it and all below it
 * Clear: Ctrl+Delete in calculator context
 *
 * Keyboard layout while open:
 *   - Type expression directly (digits, +, -, *, /, (, ), ., ^, %)
 *   - Enter → evaluate and add new row
 *   - Escape → close
 *   - ↑/↓ → navigate history rows
 *   - Ctrl+Delete → clear all history
 *   - Backspace → delete last char in active expression
 *
 * Shortcut: Alt+N
 * Does NOT conflict with: Alt+1/Alt+2 (format toggle), or any Ctrl/* shortcuts.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalcRow {
  id: string
  expression: string
  result: string      // string so we can show "Error"
  timestamp: number
}

// ── Persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cq:calc-history'

function loadHistory(): CalcRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as CalcRow[]
  } catch { return [] }
}

function saveHistory(rows: CalcRow[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)) } catch { /* ignore */ }
}

// ── Safe evaluator (no eval — uses Function constructor with strict whitelist) ─

function safeEval(expr: string): string {
  // Allow: digits, operators, parens, decimal, spaces, % (as /100)
  const cleaned = expr
    .replace(/\s+/g, '')
    .replace(/\^/g, '**')          // caret as power
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)') // 50% → (50/100)

  if (!/^[0-9+\-*/().%\s]+$/.test(cleaned.replace(/\*\*/g, '**'))) {
    return 'Error'
  }

  try {
    // eslint-disable-next-line no-new-func
    const val = new Function(`'use strict'; return (${cleaned})`)()
    if (typeof val !== 'number' || !isFinite(val)) return 'Error'
    // Format: up to 10 significant digits, strip trailing zeros
    const str = val.toPrecision(10).replace(/\.?0+$/, '')
    return str
  } catch {
    return 'Error'
  }
}

function newRow(expression: string): CalcRow {
  return {
    id: `${Date.now()}-${Math.random()}`,
    expression,
    result: safeEval(expression),
    timestamp: Date.now(),
  }
}

// ── Calculator component ──────────────────────────────────────────────────────

interface CalculatorSidebarProps {
  open: boolean
  onClose: () => void
}

export function CalculatorSidebar({ open, onClose }: CalculatorSidebarProps): React.ReactElement | null {
  const [history, setHistory]     = useState<CalcRow[]>(loadHistory)
  const [activeIdx, setActiveIdx] = useState<number | null>(null) // null = new input row
  const [draft, setDraft]         = useState('')  // the new-row input
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs  = useRef<Array<HTMLInputElement | null>>([])

  // Persist on every history change
  useEffect(() => { saveHistory(history) }, [history])

  // Focus new-input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80)
      setActiveIdx(null)
    }
  }, [open])

  // ── Evaluate & append row ─────────────────────────────────────────────────

  const commitDraft = useCallback(() => {
    const expr = draft.trim()
    if (!expr) return
    const row = newRow(expr)
    setHistory(prev => [...prev, row])
    setDraft('')
    setActiveIdx(null)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [draft])

  // ── Edit an existing row ──────────────────────────────────────────────────

  const commitRowEdit = useCallback((idx: number, newExpr: string) => {
    setHistory(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], expression: newExpr, result: safeEval(newExpr) }
      return updated
    })
    setActiveIdx(null)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  // ── Clear all ─────────────────────────────────────────────────────────────

  const clearAll = useCallback(() => {
    setHistory([])
    setDraft('')
    setActiveIdx(null)
  }, [])

  // ── New-row keyboard handler ──────────────────────────────────────────────

  const handleNewRowKey = useCallback((e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); commitDraft()
    } else if (e.key === 'Escape') {
      e.preventDefault(); onClose()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const idx = history.length - 1
        setActiveIdx(idx)
        setTimeout(() => rowRefs.current[idx]?.focus(), 30)
      }
    } else if (e.ctrlKey && e.key === 'Delete') {
      e.preventDefault(); clearAll()
    }
  }, [commitDraft, onClose, history.length, clearAll])

  // ── Existing row keyboard handler ─────────────────────────────────────────

  const handleRowKey = useCallback((e: ReactKeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = (e.target as HTMLInputElement).value
      commitRowEdit(idx, val)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setActiveIdx(null)
      inputRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (idx < history.length - 1) {
        setActiveIdx(idx + 1)
        setTimeout(() => rowRefs.current[idx + 1]?.focus(), 30)
      } else {
        setActiveIdx(null)
        inputRef.current?.focus()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (idx > 0) {
        setActiveIdx(idx - 1)
        setTimeout(() => rowRefs.current[idx - 1]?.focus(), 30)
      }
    } else if (e.ctrlKey && e.key === 'Delete') {
      e.preventDefault(); clearAll()
    }
  }, [history.length, commitRowEdit, clearAll])

  if (!open) return null

  const isError = (r: string) => r === 'Error'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 9000,
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Calculator"
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(520px, 96vw)',
          maxHeight: '55vh',
          background: 'var(--cq-surface)',
          borderTop: '2px solid var(--cq-accent)',
          borderLeft: '1px solid var(--cq-border)',
          borderRight: '1px solid var(--cq-border)',
          borderTopLeftRadius: '1rem',
          borderTopRightRadius: '1rem',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
          zIndex: 9001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Titlebar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          borderBottom: '1px solid var(--cq-border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem' }}>🧮</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--cq-text-primary)' }}>
              Calculator
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', background: 'var(--cq-bg-primary)', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', border: '1px solid var(--cq-border)' }}>
              Alt+N
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {history.length > 0 && (
              <button
                onClick={clearAll}
                title="Clear all history (Ctrl+Delete)"
                style={{
                  background: 'transparent', border: '1px solid var(--cq-border)',
                  borderRadius: '0.4rem', padding: '0.2rem 0.5rem',
                  fontSize: '0.68rem', color: '#ef4444', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              title="Close (Escape)"
              style={{
                background: 'transparent', border: '1px solid var(--cq-border)',
                borderRadius: '0.4rem', padding: '0.2rem 0.5rem',
                fontSize: '0.8rem', color: 'var(--cq-text-muted)', cursor: 'pointer',
              }}
            >✕</button>
          </div>
        </div>

        {/* History scroll area */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem',
          display: 'flex', flexDirection: 'column', gap: '0.35rem',
        }}>
          {history.length === 0 && (
            <div style={{ color: 'var(--cq-text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
              Type an expression below and press Enter
            </div>
          )}
          {history.map((row, idx) => (
            <div
              key={row.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: activeIdx === idx ? 'var(--cq-bg-primary)' : 'transparent',
                borderRadius: '0.5rem',
                padding: '0.25rem 0.5rem',
                border: activeIdx === idx ? '1px solid var(--cq-accent)' : '1px solid transparent',
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{
                fontSize: '0.62rem', color: 'var(--cq-text-muted)',
                minWidth: 22, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
              }}>
                {idx + 1}
              </span>
              <input
                ref={el => { rowRefs.current[idx] = el }}
                defaultValue={row.expression}
                onKeyDown={e => handleRowKey(e, idx)}
                onFocus={() => setActiveIdx(idx)}
                onBlur={e => { if (activeIdx === idx) commitRowEdit(idx, e.target.value) }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--cq-text-primary)', fontSize: '0.88rem',
                  fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
                }}
              />
              <span style={{
                fontSize: '0.88rem', fontWeight: 700,
                color: isError(row.result) ? '#ef4444' : 'var(--cq-accent)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'monospace',
                minWidth: 60, textAlign: 'right',
              }}>
                = {row.result}
              </span>
            </div>
          ))}
        </div>

        {/* New expression input */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--cq-border)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          flexShrink: 0,
          background: 'var(--cq-bg-primary)',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--cq-text-muted)', flexShrink: 0 }}>›</span>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={handleNewRowKey}
            placeholder="e.g. 125*48 + 200/5 - 10%  (Enter to calculate)"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--cq-text-primary)', fontSize: '0.95rem',
              fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
            }}
            autoComplete="off"
          />
          {draft && (
            <span style={{
              fontSize: '0.85rem', color: 'var(--cq-text-muted)',
              fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums',
            }}>
              = {safeEval(draft)}
            </span>
          )}
          <kbd style={{
            fontSize: '0.62rem', color: 'var(--cq-text-muted)',
            background: 'var(--cq-surface)', border: '1px solid var(--cq-border)',
            borderRadius: '0.3rem', padding: '0.1rem 0.4rem', flexShrink: 0,
          }}>↵</kbd>
        </div>

        {/* Help bar */}
        <div style={{
          padding: '0.3rem 1.25rem',
          borderTop: '1px solid var(--cq-border)',
          display: 'flex', gap: '1rem', flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          {['↑↓ Navigate rows', 'Enter Evaluate', 'Ctrl+Del Clear', 'Esc Close'].map(tip => (
            <span key={tip} style={{ fontSize: '0.6rem', color: 'var(--cq-text-muted)' }}>{tip}</span>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Global shortcut hook ──────────────────────────────────────────────────────

export function useCalculatorShortcut(): { open: boolean; toggle: () => void; close: () => void } {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen(p => !p), [])
  const close  = useCallback(() => setOpen(false), [])

  useEffect(() => {
    function handler(e: globalThis.KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        setOpen(p => !p)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, toggle, close }
}
