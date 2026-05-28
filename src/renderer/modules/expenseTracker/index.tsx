/**
 * cQikly — Expense Tracker Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'expenseTracker' is true.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Log business expenses (rent, transport, misc); rough P&L view
 *   (total billed minus total expenses).
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function ExpenseTrackerModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="💰"
      title="Expense Tracker"
      badgeLabel="Coming Soon"
      badgeColor="green"
      description="Log your business expenses and get a quick view of where your money is going."
      features={[
        { icon: '🏷️', label: 'Log Any Business Expense', desc: 'Rent, transport, raw materials, utilities, miscellaneous — all in one place.' },
        { icon: '📂', label: 'Categorised Expenses', desc: 'Organise expenses by type for cleaner reporting and tax preparation.' },
        { icon: '📈', label: 'Rough P&L View', desc: 'Total billed (revenue) minus total expenses — your quick profitability snapshot.' },
        { icon: '📅', label: 'Date-ranged Filters', desc: 'View expenses by day, month, or custom range.' },
        { icon: '📥', label: 'Excel Export', desc: 'Export your expense log for accounting or tax purposes.' },
      ]}
      settingsPath="Settings → Feature Modules → Expense Tracker"
    />
  )
}
