/**
 * cQikly — To-Do List Widget
 * Phase: 3a-A
 *
 * Persistent checklist:
 *  - Items carry over across days automatically (they never auto-clear)
 *  - User can check/uncheck items — checked items remain visible until manually cleared
 *  - "Clear completed" button removes checked items
 *  - Full list clear available from Settings (Hard Spec #24)
 *  - Persisted via localStorage in dev; IPC settings layer in Electron
 *
 * Visibility: respects config.widgetVisibility.todoList
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number  // epoch ms
}

// ─── Storage helpers (IPC-bridged; localStorage fallback) ──────────────────────

const TODO_STORAGE_KEY = 'cq:dashboard:todos'

function loadTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TodoItem[]
  } catch {
    return []
  }
}

function saveTodos(items: TodoItem[]): void {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(items))
  } catch { /* ignore */ }
}

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function IconPlus(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function IconTrash(): React.ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TodoWidget(): React.ReactElement | null {
  const { config } = useConfig()
  const [items, setItems] = useState<TodoItem[]>(() => loadTodos())
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Visibility gate
  if (!config.widgetVisibility?.todoList) return null

  // Persist on every change
  useEffect(() => {
    saveTodos(items)
  }, [items])

  const addItem = useCallback(() => {
    const text = inputVal.trim()
    if (!text) return
    const newItem: TodoItem = {
      id: `todo-${Date.now()}-${Math.random()}`,
      text,
      done: false,
      createdAt: Date.now(),
    }
    setItems(prev => [newItem, ...prev])
    setInputVal('')
    inputRef.current?.focus()
  }, [inputVal])

  const toggleItem = useCallback((id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, done: !it.done } : it))
  }, [])

  const deleteItem = useCallback((id: string) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(it => !it.done))
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') addItem()
  }, [addItem])

  const pendingCount = items.filter(it => !it.done).length
  const doneCount    = items.filter(it => it.done).length

  return (
    <div
      style={{
        background: 'var(--cq-surface)',
        border: '1px solid var(--cq-border)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        minWidth: 280,
        maxWidth: 360,
        flex: '1 1 300px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cq-accent)', opacity: 0.8 }}>
            To-Do List
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--cq-text-muted)', marginTop: '0.15rem' }}>
            {pendingCount} pending{doneCount > 0 ? ` · ${doneCount} done` : ''}
          </div>
        </div>
        {doneCount > 0 && (
          <button
            onClick={clearCompleted}
            title="Clear completed items"
            style={{
              fontSize: '0.7rem',
              padding: '4px 10px',
              borderRadius: '999px',
              border: '1px solid var(--cq-border)',
              background: 'transparent',
              color: 'var(--cq-text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface-raised)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-muted)'
            }}
          >
            Clear done
          </button>
        )}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a task..."
          style={{
            flex: 1,
            background: 'var(--cq-bg-primary)',
            border: '1px solid var(--cq-border)',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
            color: 'var(--cq-text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--cq-accent)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--cq-border)' }}
        />
        <button
          onClick={addItem}
          title="Add task (Enter)"
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--cq-accent)',
            border: 'none',
            borderRadius: '0.5rem',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          <IconPlus />
        </button>
      </div>

      {/* Items list */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        maxHeight: 280,
        overflowY: 'auto',
        paddingRight: 2,
      }}>
        {items.length === 0 && (
          <div style={{ fontSize: '0.82rem', color: 'var(--cq-text-muted)', textAlign: 'center', padding: '1rem 0', opacity: 0.6 }}>
            No tasks yet — add one above
          </div>
        )}
        {items.map(item => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.45rem 0.5rem',
              borderRadius: '0.5rem',
              background: item.done ? 'transparent' : 'var(--cq-bg-primary)',
              border: '1px solid',
              borderColor: item.done ? 'transparent' : 'var(--cq-border)',
              transition: 'all 0.15s',
              opacity: item.done ? 0.55 : 1,
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggleItem(item.id)}
              title={item.done ? 'Mark incomplete' : 'Mark done'}
              style={{
                width: 18,
                height: 18,
                borderRadius: '4px',
                border: `2px solid ${item.done ? 'var(--cq-accent)' : 'var(--cq-border)'}`,
                background: item.done ? 'var(--cq-accent)' : 'transparent',
                cursor: 'pointer',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
                padding: 0,
              }}
            >
              {item.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {/* Text */}
            <span style={{
              flex: 1,
              fontSize: '0.84rem',
              color: 'var(--cq-text-primary)',
              textDecoration: item.done ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.text}
            </span>

            {/* Delete */}
            <button
              onClick={() => deleteItem(item.id)}
              title="Delete task"
              style={{
                padding: '2px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--cq-text-muted)',
                opacity: 0.4,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4' }}
            >
              <IconTrash />
            </button>
          </div>
        ))}
      </div>

      {/* Persistence note */}
      <div style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', opacity: 0.5, textAlign: 'center' }}>
        Items carry over across days until cleared
      </div>
    </div>
  )
}

// ─── Export clear function (called from Settings) ──────────────────────────────

export function clearAllTodos(): void {
  try { localStorage.removeItem(TODO_STORAGE_KEY) } catch { /* ignore */ }
}
