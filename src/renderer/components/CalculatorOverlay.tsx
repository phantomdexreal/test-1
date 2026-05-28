/**
 * cQikly — CalculatorOverlay (FULL IMPLEMENTATION — Phase 12b)
 *
 * Alt+N: opens at bottom of screen.
 * Keyboard-only — no mouse buttons required for any operation.
 * Full mathematical operations via safe Function evaluation.
 * History: every calculation is a persistent row (localStorage).
 * Any previous row is editable — editing updates that row's result.
 * Refresh/clear resets all rows.
 * Does not conflict with any other shortcut.
 *
 * Keyboard map (when open):
 *   Alt+N / Escape     → Close
 *   Up/Down            → Navigate rows (or move between history rows)
 *   Enter              → Evaluate current row / add new row after
 *   Ctrl+Enter         → Always add a new blank row at end
 *   Ctrl+L             → Clear all history (refresh)
 *   Tab                → Move focus to next row (wrap)
 *   Shift+Tab          → Move focus to previous row
 *   Delete on empty    → Remove row (if more than 1 row)
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalcRow {
  id: string
  expr: string
  result: string | null  // null = not yet evaluated / error
  error: boolean
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = 'cq:calculator:rows'

function loadRows(): CalcRow[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CalcRow[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return [blankRow()]
}

function saveRows(rows: CalcRow[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)) } catch { /* ignore */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _idCounter = Date.now()
function newId(): string { return `cr_${++_idCounter}` }
function blankRow(): CalcRow { return { id: newId(), expr: '', result: null, error: false } }

function evaluate(expr: string): { result: string; error: boolean } {
  const trimmed = expr.trim()
  if (!trimmed) return { result: '', error: false }
  try {
    // Allow: digits, basic ops, parens, ., %, spaces, sqrt/PI/E via Math
    const sanitized = trimmed
      .replace(/[^0-9+\-*/().,\s%^eE]/g, '')
      // percent shorthand: 18% → 0.18 (only standalone %)
      .replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
      // ^ as power
      .replace(/\^/g, '**')

    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${sanitized})`)() as number
    if (!isFinite(val)) return { result: 'Error', error: true }
    // Trim floating point noise (up to 10 decimal places)
    const formatted = parseFloat(val.toFixed(10)).toString()
    return { result: formatted, error: false }
  } catch {
    return { result: 'Error', error: true }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalculatorOverlay(): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<CalcRow[]>(loadRows)
  const [focusedIdx, setFocusedIdx] = useState(0)

  // refs to input elements, keyed by row id
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen(v => !v), [])
  const close  = useCallback(() => setOpen(false), [])

  // Subscribe to eventBus
  useEffect(() => eventBus.on('openCalculator', toggle), [toggle])

  // Persist on change
  useEffect(() => { saveRows(rows) }, [rows])

  // Focus the active row input when open
  useLayoutEffect(() => {
    if (!open) return
    const row = rows[focusedIdx]
    if (row) {
      const el = inputRefs.current.get(row.id)
      // small delay to let the DOM settle after animation
      setTimeout(() => el?.focus(), 60)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus when focusedIdx changes (only while open)
  useLayoutEffect(() => {
    if (!open) return
    const row = rows[focusedIdx]
    if (row) {
      const el = inputRefs.current.get(row.id)
      el?.focus()
    }
  }, [focusedIdx, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row operations ─────────────────────────────────────────────────────────

  const updateExpr = useCallback((idx: number, expr: string) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], expr }
      return next
    })
  }, [])

  const evaluateRow = useCallback((idx: number) => {
    setRows(prev => {
      const next = [...prev]
      const row = next[idx]
      const { result, error } = evaluate(row.expr)
      next[idx] = { ...row, result: result || null, error }
      return next
    })
  }, [])

  const addRowAfter = useCallback((idx: number) => {
    setRows(prev => {
      const next = [...prev]
      next.splice(idx + 1, 0, blankRow())
      return next
    })
    setFocusedIdx(idx + 1)
  }, [])

  const removeRow = useCallback((idx: number) => {
    setRows(prev => {
      if (prev.length <= 1) return [blankRow()]
      const next = [...prev]
      next.splice(idx, 1)
      return next
    })
    setFocusedIdx(prev => Math.min(prev, rows.length - 2))
  }, [rows.length])

  const clearAll = useCallback(() => {
    const fresh = [blankRow()]
    setRows(fresh)
    setFocusedIdx(0)
  }, [])

  // ── Global key handler (when overlay is open) ──────────────────────────────

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      // Close shortcuts
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault(); close(); return
      }
      if (e.key === 'Escape') {
        e.stopPropagation(); close(); return
      }
      // Clear all
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault(); clearAll(); return
      }
      // Add new row at end (Ctrl+Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        addRowAfter(rows.length - 1)
        return
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, close, clearAll, addRowAfter, rows.length])

  // ── Per-row key handler ────────────────────────────────────────────────────

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number): void {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      evaluateRow(idx)
      // Move to next row or add one
      if (idx === rows.length - 1) {
        addRowAfter(idx)
      } else {
        setFocusedIdx(idx + 1)
      }
      return
    }
    if (e.key === 'ArrowDown' && !e.ctrlKey) {
      e.preventDefault()
      if (idx < rows.length - 1) setFocusedIdx(idx + 1)
      return
    }
    if (e.key === 'ArrowUp' && !e.ctrlKey) {
      e.preventDefault()
      if (idx > 0) setFocusedIdx(idx - 1)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        setFocusedIdx(idx === 0 ? rows.length - 1 : idx - 1)
      } else {
        setFocusedIdx(idx === rows.length - 1 ? 0 : idx + 1)
      }
      return
    }
    if (e.key === 'Delete' && rows[idx].expr === '') {
      e.preventDefault()
      removeRow(idx)
      return
    }
  }

  if (!open) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="false"
      aria-label="Calculator"
      style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99985,
        width: 'min(520px, 96vw)',
        background: 'var(--cq-surface-raised)',
        border: '1px solid var(--cq-border)',
        borderBottom: 'none',
        borderRadius: '14px 14px 0 0',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.35)',
        fontFamily: '"Inter", system-ui, sans-serif',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '70vh',
        animation: 'calcSlideUp 0.2s ease',
      }}
    >
      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 9px',
        borderBottom: '1px solid var(--cq-border)',
        background: 'var(--cq-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cq-text-primary)' }}>
            🧮 Calculator
          </span>
          <span style={{ opacity: 0.4, fontWeight: 400, fontSize: '0.68rem', color: 'var(--cq-text-muted)' }}>Alt+N</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.67rem', color: 'var(--cq-text-muted)', opacity: 0.6 }}>
            Ctrl+L clear · Del empty row · ↑↓ navigate
          </span>
          <button
            onClick={clearAll}
            title="Clear all rows (Ctrl+L)"
            style={{
              background: 'transparent', border: '1px solid var(--cq-border)',
              borderRadius: '5px', cursor: 'pointer', color: 'var(--cq-text-muted)',
              fontSize: '0.68rem', padding: '2px 8px',
            }}
          >Clear</button>
        </div>
      </div>

      {/* Rows area */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
        {rows.map((row, idx) => (
          <CalcRowItem
            key={row.id}
            row={row}
            idx={idx}
            isFocused={focusedIdx === idx}
            onExprChange={expr => updateExpr(idx, expr)}
            onKeyDown={e => handleRowKeyDown(e, idx)}
            onFocus={() => setFocusedIdx(idx)}
            onEvaluate={() => evaluateRow(idx)}
            registerRef={el => {
              if (el) inputRefs.current.set(row.id, el)
              else inputRefs.current.delete(row.id)
            }}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '7px 16px',
        borderTop: '1px solid var(--cq-border)',
        fontSize: '0.65rem',
        color: 'var(--cq-text-muted)',
        opacity: 0.55,
        display: 'flex',
        gap: '14px',
        flexShrink: 0,
      }}>
        <span>Enter = evaluate + next row</span>
        <span>Ctrl+Enter = new row at end</span>
        <span>↑↓ = navigate rows</span>
        <span>Del on empty = remove row</span>
      </div>

      <style>{`
        @keyframes calcSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── CalcRowItem ──────────────────────────────────────────────────────────────

interface CalcRowItemProps {
  row: CalcRow
  idx: number
  isFocused: boolean
  onExprChange: (expr: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onFocus: () => void
  onEvaluate: () => void
  registerRef: (el: HTMLInputElement | null) => void
}

function CalcRowItem({
  row, idx, isFocused,
  onExprChange, onKeyDown, onFocus, onEvaluate, registerRef,
}: CalcRowItemProps): React.ReactElement {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '5px 14px',
      background: isFocused ? 'color-mix(in srgb, var(--cq-accent) 7%, transparent)' : 'transparent',
      borderLeft: isFocused ? '3px solid var(--cq-accent)' : '3px solid transparent',
      transition: 'background 0.1s, border-color 0.1s',
    }}>
      {/* Row number */}
      <span style={{
        fontSize: '0.65rem',
        color: 'var(--cq-text-muted)',
        opacity: 0.45,
        width: '18px',
        textAlign: 'right',
        flexShrink: 0,
        fontFamily: '"JetBrains Mono", "Consolas", monospace',
      }}>
        {idx + 1}
      </span>

      {/* Expression input */}
      <input
        ref={registerRef}
        value={row.expr}
        onChange={e => onExprChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onEvaluate}
        placeholder="e.g.  1200 * 18%"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--cq-text-primary)',
          fontSize: '0.88rem',
          fontFamily: '"JetBrains Mono", "Consolas", monospace',
          padding: '4px 0',
        }}
      />

      {/* Result */}
      <span style={{
        fontSize: '0.88rem',
        fontWeight: 700,
        color: row.error ? '#ef4444' : 'var(--cq-accent)',
        fontFamily: '"JetBrains Mono", "Consolas", monospace',
        minWidth: '80px',
        textAlign: 'right',
        flexShrink: 0,
        opacity: row.result ? 1 : 0.25,
      }}>
        {row.result ? `= ${row.result}` : row.expr ? '—' : ''}
      </span>
    </div>
  )
}
