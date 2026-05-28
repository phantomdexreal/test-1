/**
 * cQikly — Dashboard Page
 * Phase: 3a-A (shell, sidebar, clock, todo, system status, animated bg)
 * Phase: 3a-B (DB-reading widgets: bill counts, revenue, top customer, alerts)
 * Phase: 3b-i (live API widgets: weather, crypto, forex; converters; calculator)
 * Phase: 3b-ii (all 6 animated themes fully implemented via ThemeBackground)
 * Phase: 11b-i (all widget visibility flags fully respected; instant toggle)
 *
 * Design rule: generous spacing, breathing room, nothing cramped.
 */

import React from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { ThemeBackground } from './ThemeBackground'
import { ClockWidget } from './ClockWidget'
import { TodoWidget } from './TodoWidget'
import { SystemStatusWidget } from './SystemStatusWidget'

// ── Phase 3a-B widgets ─────────────────────────────────────────────────────────
import { TodayBillCountWidget, TotalBillsWidget } from './BillCountWidget'
import { TodayRevenueWidget, MonthComparisonWidget, TopCustomerWidget } from './RevenueWidgets'
import { PendingDraftIndicator, LowStockAlertWidget } from './AlertWidgets'

// ── Phase 3b-i: live API widgets ───────────────────────────────────────────────
import { WeatherWidget } from './WeatherWidget'
import { CryptoWidget } from './CryptoWidget'
import { ForexWidget } from './ForexWidget'
import { UnitConverterWidget } from './UnitConverterWidget'
import { CurrencyConverterWidget } from './CurrencyConverterWidget'
import { CalculatorSidebar, useCalculatorShortcut } from './CalculatorSidebar'

// ── Dashboard Header ───────────────────────────────────────────────────────────

function DashboardHeader(): React.ReactElement {
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div style={{
      padding: '2rem 2.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
    }}>
      <div>
        <h2 style={{
          margin: 0,
          fontSize: '1.6rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: 'var(--cq-text-primary)',
          lineHeight: 1.2,
        }}>
          {greeting} 👋
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.875rem', color: 'var(--cq-text-muted)' }}>
          Here's your business overview for today.
        </p>
      </div>
      <div style={{
        padding: '0.5rem 1rem',
        borderRadius: '0.65rem',
        background: 'var(--cq-surface)',
        border: '1px solid var(--cq-border)',
        fontSize: '0.78rem',
        color: 'var(--cq-text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
      }}>
        <span>cQikly · v0.1.0</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span style={{ fontSize: '0.65rem' }}>
          <kbd style={{ background: 'var(--cq-surface)', border: '1px solid var(--cq-border)', borderRadius: '0.25rem', padding: '0.05rem 0.3rem' }}>Alt+N</kbd>
          {' '}Calculator
        </span>
      </div>
    </div>
  )
}

// ── Widget grid ────────────────────────────────────────────────────────────────

function WidgetGrid(): React.ReactElement {
  const { config } = useConfig()
  const vis = config.widgetVisibility ?? {}

  // Helper: is a widget visible? Default is true (all shown unless explicitly false)
  const show = (key: string) => vis[key] !== false

  // Row 1 has content?
  const hasRow1 = show('clock') || show('todayBillCount') || show('totalBills') || show('todayRevenue') || show('systemStatus')
  // Row 2
  const hasRow2 = show('todoList') || show('monthComparison') || show('topCustomer')
  // Row 3
  const hasRow3 = show('pendingDraftIndicator') || show('lowStockAlert')
  // Row 4
  const hasRow4 = show('weather') || show('crypto') || show('forex')
  // Row 5
  const hasRow5 = show('unitConverter') || show('currencyConverter')

  return (
    <div style={{
      padding: '0 2.5rem 2.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.75rem',
      overflowY: 'auto',
      flex: 1,
    }}>

      {/* ── Row 1: Clock + stat counters ────────────────────────────────── */}
      {hasRow1 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {show('clock') && <ClockWidget />}
          {show('todayBillCount') && <TodayBillCountWidget />}
          {show('totalBills') && <TotalBillsWidget />}
          {show('todayRevenue') && <TodayRevenueWidget />}
          {show('systemStatus') && <SystemStatusWidget />}
        </div>
      )}

      {/* ── Row 2: Revenue comparison + top customer + to-do ──────────── */}
      {hasRow2 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {show('todoList') && <TodoWidget />}
          {(show('monthComparison') || show('topCustomer')) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, minWidth: 240 }}>
              {show('monthComparison') && <MonthComparisonWidget />}
              {show('topCustomer') && <TopCustomerWidget />}
            </div>
          )}
        </div>
      )}

      {/* ── Row 3: Alert indicators ─────────────────────────────────────── */}
      {hasRow3 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {show('pendingDraftIndicator') && <PendingDraftIndicator />}
          {show('lowStockAlert') && <LowStockAlertWidget />}
        </div>
      )}

      {/* ── Row 4: Live API widgets ──────────────────────────────────────── */}
      {hasRow4 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {show('weather') && <WeatherWidget />}
          {show('crypto') && <CryptoWidget />}
          {show('forex') && <ForexWidget />}
        </div>
      )}

      {/* ── Row 5: Converter widgets ─────────────────────────────────────── */}
      {hasRow5 && (
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {show('unitConverter') && <UnitConverterWidget />}
          {show('currencyConverter') && <CurrencyConverterWidget />}
        </div>
      )}

      {/* Empty state when all widgets hidden */}
      {!hasRow1 && !hasRow2 && !hasRow3 && !hasRow4 && !hasRow5 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, opacity: 0.45, paddingTop: 60 }}>
          <div style={{ fontSize: '3rem' }}>📊</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cq-text-primary)' }}>All widgets hidden</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--cq-text-muted)' }}>Re-enable widgets in Settings → Dashboard Widgets.</div>
        </div>
      )}

    </div>
  )
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────

export default function DashboardPage(): React.ReactElement {
  const { open: calcOpen, close: calcClose } = useCalculatorShortcut()

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--cq-bg-primary)',
    }}>
      {/* Theme-aware animated background — switches instantly with theme; respects perf mode */}
      <ThemeBackground />

      {/* Content layer above the canvas */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}>
        <DashboardHeader />
        <WidgetGrid />
      </div>

      {/* Calculator Sidebar — Alt+N; sits above everything */}
      <CalculatorSidebar open={calcOpen} onClose={calcClose} />
    </div>
  )
}
