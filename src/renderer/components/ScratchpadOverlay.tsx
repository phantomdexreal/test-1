/**
 * cQikly — ScratchpadOverlay (Phase 12b)
 *
 * Persistent floating notepad accessible from anywhere via Alt+S.
 * Content persists across navigation and app restarts (localStorage).
 * Floating — can be repositioned by dragging the title bar.
 * Keyboard-only operable: Alt+S toggles, Escape closes.
 * Does not conflict with any other shortcut.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { eventBus } from '../utils/eventBus'

// ─── Persistence ──────────────────────────────────────────────────────────────

const CONTENT_KEY  = 'cq:scratchpad:content'
const POS_KEY      = 'cq:scratchpad:pos'

function loadContent(): string {
  try { return localStorage.getItem(CONTENT_KEY) ?? '' } catch { return '' }
}
function saveContent(text: string): void {
  try { localStorage.setItem(CONTENT_KEY, text) } catch { /* ignore */ }
}

interface Pos { x: number; y: number }

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (raw) return JSON.parse(raw) as Pos
  } catch { /* ignore */ }
  // Default: top-right area
  return { x: Math.max(0, window.innerWidth - 380), y: 80 }
}
function savePos(pos: Pos): void {
  try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────────

const PAD_W = 360
const PAD_H = 300

export function ScratchpadOverlay(): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState(loadContent)
  const [pos, setPos] = useState<Pos>(loadPos)
  const dragging = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const padRef = useRef<HTMLDivElement>(null)

  const toggle = useCallback(() => setOpen(v => !v), [])
  const close  = useCallback(() => setOpen(false), [])

  // Subscribe to eventBus for Alt+S
  useEffect(() => eventBus.on('openScratchpad', toggle), [toggle])

  // Focus textarea when opened
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 60)
  }, [open])

  // Persist content
  useEffect(() => { saveContent(content) }, [content])

  // Global key handler
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault(); close(); return
      }
      if (e.key === 'Escape') {
        e.stopPropagation(); close(); return
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, close])

  // ── Drag ──────────────────────────────────────────────────────────────────

  const onTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragging.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
    e.preventDefault()

    function onMove(me: MouseEvent) {
      if (!dragging.current) return
      const dx = me.clientX - dragging.current.startX
      const dy = me.clientY - dragging.current.startY
      const newX = Math.max(0, Math.min(window.innerWidth - PAD_W, dragging.current.origX + dx))
      const newY = Math.max(0, Math.min(window.innerHeight - PAD_H, dragging.current.origY + dy))
      setPos({ x: newX, y: newY })
    }
    function onUp() {
      if (dragging.current) {
        const dx = 0 // position already saved via setPos
        void dx
        setPos(p => { savePos(p); return p })
      }
      dragging.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  if (!open) return null

  return (
    <div
      ref={padRef}
      role="dialog"
      aria-modal="false"
      aria-label="Scratchpad"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: PAD_W,
        zIndex: 99980,
        background: 'var(--cq-surface-raised)',
        border: '1px solid var(--cq-border)',
        borderRadius: '12px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'scratchpadIn 0.18s ease',
      }}
    >
      {/* Title bar (draggable) */}
      <div
        onMouseDown={onTitleMouseDown}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px 8px',
          borderBottom: '1px solid var(--cq-border)',
          background: 'var(--cq-surface)',
          cursor: 'grab',
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '0.9rem' }}>📝</span>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--cq-text-primary)' }}>
            Scratchpad
          </span>
          <span style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', opacity: 0.5 }}>Alt+S</span>
        </div>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={close}
          title="Close (Escape or Alt+S)"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--cq-text-muted)', fontSize: '0.9rem', padding: '2px 4px',
            lineHeight: 1, borderRadius: '4px',
          }}
        >✕</button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Quick notes… (auto-saved, persists across restarts)"
        spellCheck={false}
        style={{
          flex: 1,
          height: PAD_H - 50,
          resize: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--cq-text-primary)',
          fontSize: '0.82rem',
          lineHeight: 1.6,
          fontFamily: '"JetBrains Mono", "Consolas", monospace',
          padding: '12px 14px',
        }}
      />

      {/* Footer */}
      <div style={{
        padding: '5px 14px',
        borderTop: '1px solid var(--cq-border)',
        fontSize: '0.63rem',
        color: 'var(--cq-text-muted)',
        opacity: 0.5,
        display: 'flex',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Drag title bar to move</span>
        <span>{content.length} chars</span>
      </div>

      <style>{`
        @keyframes scratchpadIn {
          from { opacity: 0; transform: scale(0.94) translateY(-8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
