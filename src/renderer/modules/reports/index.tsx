/**
 * cQikly — Reports Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'reports' is true.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Daily / monthly / yearly sales summary; item-wise sales report;
 *   customer-wise sales report; GST collected summary broken down by GST%;
 *   all exportable to Excel.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function ReportsModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="📊"
      title="Reports"
      badgeLabel="Coming Soon"
      badgeColor="blue"
      description="Powerful sales and tax analytics for your business — all in one place."
      features={[
        { icon: '📅', label: 'Daily / Monthly / Yearly Sales Summary', desc: 'Track your revenue trends across any time period with clear charts and tables.' },
        { icon: '📦', label: 'Item-wise Sales Report', desc: 'See which products are your top sellers and which are slow-moving.' },
        { icon: '👥', label: 'Customer-wise Sales Report', desc: 'Understand your best customers and their buying patterns.' },
        { icon: '🧾', label: 'GST Collected Summary', desc: 'Full GST breakdowns by rate (5%, 12%, 18%, 28%) — ready for filing.' },
        { icon: '📥', label: 'Excel Export', desc: 'Every report is exportable to Excel for further analysis or your accountant.' },
      ]}
      settingsPath="Settings → Feature Modules → Reports Module"
    />
  )
}
