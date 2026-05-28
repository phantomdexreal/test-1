/**
 * cQikly — Payment Recorder & Ledger Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * NOTE: The Payment Recorder core was built in Phase 8b-ii (per-customer
 * payments in Customer Details). This module page surfaces the cross-customer
 * global ledger and advanced outstanding tracking as a dedicated nav page.
 *
 * GATING RULE: Only rendered when feature flag 'paymentLedger' is true.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Log payments received; full Dr/Cr ledger per customer;
 *   outstanding balance tracking.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function PaymentLedgerModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="📒"
      title="Payment Ledger"
      badgeLabel="Partial — Core in Customer Details"
      badgeColor="amber"
      description="A global view of all payments and outstanding balances across every customer."
      features={[
        { icon: '✅', label: 'Per-customer Payment Recording (Built — Phase 8b-ii)', desc: 'Log payments received against any customer from their Customer Details record. Already live.' },
        { icon: '📊', label: 'Global Outstanding Dashboard', desc: 'One screen showing every customer with an outstanding balance, sorted by amount or age.' },
        { icon: '📖', label: 'Full Dr/Cr Ledger per Customer', desc: 'Every bill and every payment in chronological order with a running balance.' },
        { icon: '⚠️', label: 'Overdue Alerts', desc: 'Flag bills that have been unpaid beyond a configurable number of days.' },
        { icon: '📥', label: 'Outstanding Report Export', desc: 'Export the full outstanding list to Excel for collection follow-up.' },
      ]}
      settingsPath="Settings → Feature Modules → Payment Recorder & Ledger"
    />
  )
}
