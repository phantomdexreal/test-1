/**
 * cQikly — Sidebar Navigation
 * Built in: Phase 1b-B
 *
 * Left sidebar with 6 nav buttons, Ctrl+1–6 shortcut hints,
 * dark/light toggle, theme selector, and performance mode toggle.
 * Follows the masterplan "generous spacing, breathing room" design rule.
 */

import React, { useState } from 'react'
import { useNavigation, type PageId } from '../contexts/NavigationContext'
import { useFeatureFlag } from '../contexts/FeatureFlagContext'
import { useConfig } from '../contexts/ConfigContext'
import { useTheme, type ThemeId } from '../contexts/ThemeContext'
import { usePerformance, type PerformanceMode } from '../contexts/PerformanceContext'

// ─── Icon components (lightweight SVG, no extra deps) ─────────────────────────

function IconQuote(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  )
}

function IconHistory(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="12 8 12 12 14 14"/>
      <path d="M3.05 11a9 9 0 1 0 .5-4"/>
      <polyline points="3 3 3 7 7 7"/>
    </svg>
  )
}

function IconCustomers(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function IconInventory(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  )
}

function IconLooseHistory(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}

function IconSettings(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
    </svg>
  )
}

function IconSun(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function IconMoon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function IconDashboard(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}

const PAGE_ICONS: Partial<Record<PageId, React.ReactElement>> = {
  'dashboard':               <IconDashboard />,
  'new-quote':               <IconQuote />,
  'history':                 <IconHistory />,
  'customer-details':        <IconCustomers />,
  'inventory':               <IconInventory />,
  'loose-inventory-history': <IconLooseHistory />,
  'settings':                <IconSettings />,
}

const THEME_LABELS: Record<ThemeId, string> = {
  'space-particles': '🌌 Space',
  'sakura':          '🌸 Sakura',
  'minimal':         '◻ Minimal',
  'dark-rainbow':    '🌈 Rainbow',
  'neon':            '⚡ Neon',
  'dark-rose':       '🌹 Rose',
}

const PERF_LABELS: Record<PerformanceMode, string> = {
  lite:     '🐢 Lite',
  balanced: '⚖️ Balanced',
  ultra:    '🚀 Ultra',
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar(): React.ReactElement {
  const { activePage, setActivePage, allPages }  = useNavigation()
  const { themeId, variant, setTheme, toggleVariant, allThemes } = useTheme()
  const { mode, setMode }                        = usePerformance()
  const { flags }                                = useFeatureFlag()
  const { config }                               = useConfig()

  const [themeOpen, setThemeOpen] = useState(false)
  const [perfOpen,  setPerfOpen]  = useState(false)

  // ── Boolean-gated module nav items (Phase 13) ──────────────────────────────
  // Only shown when the corresponding feature flag is ON.
  // Admin+cloud modules also require a valid cloud access key.
  const hasCloudKey = Boolean(config.cloudAccessKey?.trim())

  interface ModuleNavItem {
    id: PageId
    label: string
    icon: React.ReactElement
    flagKey: keyof typeof flags
    requiresCloudKey?: boolean
  }

  const MODULE_NAV_ITEMS: ModuleNavItem[] = [
    { id: 'module-reports',               label: 'Reports',             icon: <span style={{fontSize:'16px'}}>📊</span>, flagKey: 'reports' },
    { id: 'module-expense-tracker',       label: 'Expense Tracker',     icon: <span style={{fontSize:'16px'}}>💰</span>, flagKey: 'expenseTracker' },
    { id: 'module-multi-user',            label: 'Operators',           icon: <span style={{fontSize:'16px'}}>👥</span>, flagKey: 'multiUser' },
    { id: 'module-payment-ledger',        label: 'Payment Ledger',      icon: <span style={{fontSize:'16px'}}>📒</span>, flagKey: 'paymentLedger' },
    { id: 'module-branch-sync',           label: 'Branch Sync',         icon: <span style={{fontSize:'16px'}}>🔗</span>, flagKey: 'branchSync',              requiresCloudKey: true },
    { id: 'module-branch-activity-monitor', label: 'Branch Monitor',   icon: <span style={{fontSize:'16px'}}>📡</span>, flagKey: 'branchActivityMonitor',   requiresCloudKey: true },
    { id: 'module-customer-db-sync',      label: 'Customer DB Sync',    icon: <span style={{fontSize:'16px'}}>🗄️</span>, flagKey: 'customerDbSync',          requiresCloudKey: true },
    { id: 'module-price-list-sync',       label: 'Price List Sync',     icon: <span style={{fontSize:'16px'}}>🏷️</span>, flagKey: 'priceListSync',           requiresCloudKey: true },
  ]

  const activeModuleNavItems = MODULE_NAV_ITEMS.filter(m => {
    if (!flags[m.flagKey]) return false
    if (m.requiresCloudKey && !hasCloudKey) return false
    return true
  })

  return (
    <nav
      style={{
        width: 220,
        minWidth: 220,
        height: '100vh',
        background: 'var(--cq-bg-secondary)',
        borderRight: '1px solid var(--cq-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0',
        transition: 'background 0.3s ease, border-color 0.3s ease',
        position: 'relative',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* App name — clickable, navigates to Dashboard */}
      <div
        onClick={() => setActivePage('dashboard')}
        title="Go to Dashboard"
        style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid var(--cq-border)', cursor: 'pointer' }}
      >
        <h1 style={{
          fontSize: '1.6rem',
          fontWeight: 800,
          letterSpacing: '-0.04em',
          color: 'var(--cq-accent)',
          margin: 0,
          lineHeight: 1,
        }}>
          cQikly
        </h1>
        <p style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', margin: '0.35rem 0 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Billing & Business
        </p>
      </div>

      {/* Nav buttons */}
      <div style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {allPages.map(page => {
          const isActive = activePage === page.id
          return (
            <button
              key={page.id}
              onClick={() => setActivePage(page.id)}
              title={`${page.label} (${page.shortcut})`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.7rem 0.85rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                background: isActive
                  ? 'var(--cq-accent)'
                  : 'transparent',
                color: isActive
                  ? '#fff'
                  : 'var(--cq-text-muted)',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                textAlign: 'left',
                width: '100%',
                transition: 'background 0.15s ease, color 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-primary)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-muted)'
                }
              }}
            >
              <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>
                {PAGE_ICONS[page.id]}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {page.label}
              </span>
              <span style={{
                fontSize: '0.6rem',
                opacity: 0.5,
                fontFamily: 'monospace',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}>
                ^{page.shortcutKey}
              </span>
            </button>
          )
        })}

        {/* ── Boolean-gated module nav items (Phase 13) ────────────────────── */}
        {/* Completely invisible when flag is off. No divider if none are active. */}
        {activeModuleNavItems.length > 0 && (
          <div style={{
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--cq-border)',
          }}>
            <div style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--cq-text-muted)',
              opacity: 0.5, padding: '0 0.85rem', marginBottom: '0.25rem',
            }}>
              Modules
            </div>
            {activeModuleNavItems.map(mod => {
              const isActive = activePage === mod.id
              return (
                <button
                  key={mod.id}
                  onClick={() => setActivePage(mod.id)}
                  title={mod.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? 'var(--cq-accent)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--cq-text-muted)',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface)'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-muted)'
                    }
                  }}
                >
                  <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }}>
                    {mod.icon}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {mod.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--cq-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

        {/* Dark/Light toggle */}
        <button
          onClick={toggleVariant}
          title={`Switch to ${variant === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--cq-border)',
            background: 'transparent',
            color: 'var(--cq-text-muted)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            width: '100%',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-primary)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--cq-text-muted)'
          }}
        >
          <span style={{ flexShrink: 0 }}>{variant === 'dark' ? <IconSun /> : <IconMoon />}</span>
          <span>{variant === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        {/* Theme selector */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setThemeOpen(o => !o); setPerfOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--cq-border)',
              background: themeOpen ? 'var(--cq-surface)' : 'transparent',
              color: 'var(--cq-text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.15s ease',
              justifyContent: 'space-between',
            }}
          >
            <span>{THEME_LABELS[themeId]}</span>
            <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▼</span>
          </button>
          {themeOpen && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 4,
              background: 'var(--cq-surface-raised)',
              border: '1px solid var(--cq-border)',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}>
              {(allThemes as ThemeId[]).map(tid => (
                <button
                  key={tid}
                  onClick={() => { setTheme(tid, variant); setThemeOpen(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: 'none',
                    background: tid === themeId ? 'var(--cq-accent)' : 'transparent',
                    color: tid === themeId ? '#fff' : 'var(--cq-text-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => {
                    if (tid !== themeId) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface)'
                  }}
                  onMouseLeave={e => {
                    if (tid !== themeId) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  {THEME_LABELS[tid]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Performance mode */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setPerfOpen(o => !o); setThemeOpen(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 0.85rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--cq-border)',
              background: perfOpen ? 'var(--cq-surface)' : 'transparent',
              color: 'var(--cq-text-muted)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              width: '100%',
              transition: 'background 0.15s ease',
              justifyContent: 'space-between',
            }}
          >
            <span>{PERF_LABELS[mode]}</span>
            <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>▼</span>
          </button>
          {perfOpen && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 4,
              background: 'var(--cq-surface-raised)',
              border: '1px solid var(--cq-border)',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.3)',
              zIndex: 100,
            }}>
              {(['lite', 'balanced', 'ultra'] as PerformanceMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setPerfOpen(false) }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    border: 'none',
                    background: m === mode ? 'var(--cq-accent)' : 'transparent',
                    color: m === mode ? '#fff' : 'var(--cq-text-primary)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => {
                    if (m !== mode) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cq-surface)'
                  }}
                  onMouseLeave={e => {
                    if (m !== mode) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  {PERF_LABELS[m]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
