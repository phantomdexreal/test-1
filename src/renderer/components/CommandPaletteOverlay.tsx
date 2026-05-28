/**
 * cQikly — CommandPaletteOverlay (FULL IMPLEMENTATION — Phase 12b)
 *
 * Ctrl+K: global fuzzy command palette.
 * Searches across customers, bills, inventory items, and page navigation / settings.
 * Selecting a customer opens Customer Details page (scrolled to that customer).
 * Selecting a bill opens History page (filtered to that bill).
 * Selecting a settings item navigates to Settings and scrolls to the section.
 * Selecting a page entry navigates directly.
 *
 * Keyboard: ↑↓ navigate, Enter open, Escape / Ctrl+K close.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Fuse from 'fuse.js'
import type { IFuseOptions } from 'fuse.js'
import { eventBus } from '../utils/eventBus'
import { useNavigation } from '../contexts/NavigationContext'
import type { PageId } from '../contexts/NavigationContext'
import {
  getAllCustomers,
  loadCustomers,
} from '../services/customer.service'
import { getBills } from '../services/bill.service'
import { inventoryService } from '../services/inventory.service'

// ─── Result shape ─────────────────────────────────────────────────────────────

type ResultKind = 'page' | 'customer' | 'bill' | 'inventory' | 'setting'

interface PaletteResult {
  id: string
  kind: ResultKind
  icon: string
  title: string
  subtitle: string
  // What to do on activation
  action: () => void
}

// ─── Kind colours ─────────────────────────────────────────────────────────────

const KIND_COLOR: Record<ResultKind, string> = {
  page:      'var(--cq-accent)',
  customer:  '#10b981',
  bill:      '#f59e0b',
  inventory: '#8b5cf6',
  setting:   '#6b7280',
}

const KIND_LABEL: Record<ResultKind, string> = {
  page:      'Page',
  customer:  'Customer',
  bill:      'Bill',
  inventory: 'Inventory',
  setting:   'Setting',
}

// ─── Static page / settings entries ──────────────────────────────────────────

const PAGE_ENTRIES: Array<{ label: string; icon: string; pageId: PageId; subtitle: string }> = [
  { label: 'New Quote',               icon: '📄', pageId: 'new-quote',               subtitle: 'Create a new bill or quote' },
  { label: 'History',                 icon: '🗂',  pageId: 'history',                 subtitle: 'View all saved bills' },
  { label: 'Customer Details',        icon: '👥', pageId: 'customer-details',        subtitle: 'Manage customers and ledger' },
  { label: 'Inventory',               icon: '📦', pageId: 'inventory',               subtitle: 'Stock, pricing, categories' },
  { label: 'Loose Inventory History', icon: '📋', pageId: 'loose-inventory-history', subtitle: 'Past inventory usage records' },
  { label: 'Settings',                icon: '⚙️', pageId: 'settings',                subtitle: 'App configuration and preferences' },
  { label: 'Dashboard',               icon: '🏠', pageId: 'dashboard',               subtitle: 'Business overview and widgets' },
]

const SETTINGS_ENTRIES: Array<{ label: string; icon: string; section: string }> = [
  { label: 'Company Profile',         icon: '🏢', section: 'company-profile' },
  { label: 'Bill Number Settings',    icon: '🔢', section: 'bill-number' },
  { label: 'Performance Mode',        icon: '⚡', section: 'performance' },
  { label: 'Theme',                   icon: '🎨', section: 'theme' },
  { label: 'App Lock / PIN',          icon: '🔒', section: 'app-lock' },
  { label: 'Feature Modules',         icon: '🧩', section: 'feature-modules' },
  { label: 'Dashboard Widgets',       icon: '📊', section: 'dashboard-widgets' },
  { label: 'Config Export / Import',  icon: '💾', section: 'config-io' },
  { label: 'Inventory Rate Source',   icon: '💰', section: 'rate-source' },
]

// ─── Fuse config ─────────────────────────────────────────────────────────────

const FUSE_OPTS: IFuseOptions<PaletteResult> = {
  keys: ['title', 'subtitle'],
  threshold: 0.38,
  minMatchCharLength: 1,
  includeScore: true,
  shouldSort: true,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPaletteOverlay(): React.ReactElement | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [allResults, setAllResults] = useState<PaletteResult[]>([])

  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const { setActivePage } = useNavigation()

  const close  = useCallback(() => { setOpen(false); setQuery('') }, [])
  const toggle = useCallback(() => setOpen(v => !v), [])

  useEffect(() => eventBus.on('openCommandPalette', toggle), [toggle])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setLoading(true)
      setTimeout(() => inputRef.current?.focus(), 40)
      // Load dynamic data
      Promise.all([
        loadCustomers().catch(() => []),
        getBills().catch(() => []),
      ]).then(([, bills]) => {
        const customers = getAllCustomers()
        const inventoryItems = inventoryService.getItems()

        const results: PaletteResult[] = []

        // Page entries
        PAGE_ENTRIES.forEach((p, i) => {
          results.push({
            id: `page_${i}`,
            kind: 'page',
            icon: p.icon,
            title: p.label,
            subtitle: p.subtitle,
            action: () => { setActivePage(p.pageId); close() },
          })
        })

        // Settings entries
        SETTINGS_ENTRIES.forEach((s, i) => {
          results.push({
            id: `setting_${i}`,
            kind: 'setting',
            icon: s.icon,
            title: s.label,
            subtitle: `Settings → ${s.label}`,
            action: () => {
              setActivePage('settings')
              // Scroll to section after navigation settles
              setTimeout(() => {
                const el = document.getElementById(`settings-section-${s.section}`)
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 200)
              close()
            },
          })
        })

        // Customers
        customers.slice(0, 200).forEach((c, i) => {
          results.push({
            id: `cust_${i}`,
            kind: 'customer',
            icon: '👤',
            title: c.partyName,
            subtitle: [c.phoneNo, c.mobileNo, c.address].filter(Boolean).join(' · ') || 'Customer record',
            action: () => {
              setActivePage('customer-details')
              setTimeout(() => {
                eventBus.emit('navigateToCustomer', { customerId: c.id ?? 0 })
              }, 100)
              close()
            },
          })
        })

        // Bills
        bills.slice(0, 200).forEach((b, i) => {
          results.push({
            id: `bill_${i}`,
            kind: 'bill',
            icon: '🧾',
            title: `Bill #${b.billNumber}`,
            subtitle: [b.partyName, b.billDate, b.status].filter(Boolean).join(' · '),
            action: () => {
              setActivePage('history')
              setTimeout(() => {
                eventBus.emit('navigateToBill', { billId: b.id ?? 0 })
              }, 100)
              close()
            },
          })
        })

        // Inventory
        inventoryItems.slice(0, 200).forEach((item, i) => {
          results.push({
            id: `inv_${i}`,
            kind: 'inventory',
            icon: '📦',
            title: item.itemName,
            subtitle: [item.category, item.subCategory, item.price ? `₹${item.price}` : ''].filter(Boolean).join(' · ') || 'Inventory item',
            action: () => {
              setActivePage('inventory')
              setTimeout(() => {
                eventBus.emit('navigateToInventoryItem', { itemId: item.id })
              }, 100)
              close()
            },
          })
        })

        setAllResults(results)
        setLoading(false)
      }).catch(() => { setLoading(false) })
    }
  }, [open, setActivePage, close])

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(0) }, [query])

  // Fuzzy filter
  const filtered = useMemo<PaletteResult[]>(() => {
    if (!query.trim()) {
      // Show pages first, then top items
      return [
        ...allResults.filter(r => r.kind === 'page'),
        ...allResults.filter(r => r.kind !== 'page').slice(0, 12),
      ].slice(0, 18)
    }
    const fuse = new Fuse(allResults, FUSE_OPTS)
    return fuse.search(query).map(r => r.item).slice(0, 18)
  }, [query, allResults])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); close(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter' && filtered[selectedIdx]) {
        e.preventDefault()
        filtered[selectedIdx].action()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [open, close, filtered, selectedIdx])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={e => { if (e.target === e.currentTarget) close() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        background: 'rgba(0,0,0,0.50)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      <div style={{
        background: 'var(--cq-surface-raised)',
        border: '1px solid var(--cq-border)',
        borderRadius: '14px',
        width: 'min(580px, 92vw)',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        animation: 'cmdPaletteIn 0.16s ease',
      }}>
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px',
          borderBottom: '1px solid var(--cq-border)',
        }}>
          <span style={{ fontSize: '1rem', opacity: loading ? 0.3 : 0.5 }}>
            {loading ? '⏳' : '🔍'}
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, customers, bills, inventory…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--cq-text-primary)', fontSize: '0.92rem',
              fontFamily: '"Inter", system-ui, sans-serif',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--cq-text-muted)', fontSize: '0.8rem', padding: '2px 4px',
              }}
            >✕</button>
          )}
          <kbd style={{
            fontSize: '0.65rem', padding: '2px 6px', background: 'var(--cq-surface)',
            border: '1px solid var(--cq-border)', borderRadius: '4px',
            color: 'var(--cq-text-muted)', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--cq-text-muted)' }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--cq-text-muted)' }}>
              No results for "{query}"
            </div>
          ) : (
            filtered.map((result, idx) => (
              <button
                key={result.id}
                data-idx={idx}
                onClick={result.action}
                onMouseEnter={() => setSelectedIdx(idx)}
                style={{
                  width: '100%', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 16px',
                  background: idx === selectedIdx
                    ? 'color-mix(in srgb, var(--cq-accent) 10%, var(--cq-surface))'
                    : 'transparent',
                  border: 'none', cursor: 'pointer', transition: 'background 0.08s',
                  borderBottom: idx < filtered.length - 1 ? '1px solid var(--cq-border)' : 'none',
                }}
              >
                <span style={{ fontSize: '1rem', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                  {result.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.85rem', fontWeight: 600,
                    color: 'var(--cq-text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {result.title}
                  </div>
                  <div style={{
                    fontSize: '0.7rem', color: 'var(--cq-text-muted)', marginTop: '1px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {result.subtitle}
                  </div>
                </div>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: KIND_COLOR[result.kind],
                  background: `color-mix(in srgb, ${KIND_COLOR[result.kind]} 12%, transparent)`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}>
                  {KIND_LABEL[result.kind]}
                </span>
                {idx === selectedIdx && (
                  <kbd style={{
                    fontSize: '0.65rem', padding: '2px 6px', background: 'var(--cq-surface)',
                    border: '1px solid var(--cq-border)', borderRadius: '4px',
                    color: 'var(--cq-text-muted)', flexShrink: 0,
                  }}>↵</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px', borderTop: '1px solid var(--cq-border)',
          fontSize: '0.67rem', color: 'var(--cq-text-muted)',
          display: 'flex', gap: '14px', opacity: 0.7,
        }}>
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
          {!loading && allResults.length > 0 && (
            <span style={{ marginLeft: 'auto' }}>
              {allResults.length} items indexed
            </span>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cmdPaletteIn {
          from { opacity: 0; transform: scale(0.96) translateY(-12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
