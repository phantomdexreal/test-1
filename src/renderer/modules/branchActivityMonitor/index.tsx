/**
 * cQikly — Branch Activity Monitor Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'branchActivityMonitor' is true
 * AND a valid cloud access key is active in config.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Admin + cloud only; admin view of activity across all branches
 *   when Supabase sync is active.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function BranchActivityMonitorModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="📡"
      title="Branch Activity Monitor"
      badgeLabel="Admin + Cloud Key Required"
      badgeColor="amber"
      description="A live admin dashboard showing what every branch is doing — bills, revenue, and alerts in real time."
      features={[
        { icon: '🌐', label: 'Live Activity Feed', desc: 'See bills being created, customers being added, and settings being changed across all branches as they happen.' },
        { icon: '💰', label: 'Cross-branch Revenue Dashboard', desc: 'Compare today\'s billing totals across branches side-by-side.' },
        { icon: '⚠️', label: 'Branch Alerts', desc: 'Get notified when a branch has unusual activity — large bills, bulk deletions, or settings changes.' },
        { icon: '📋', label: 'Session Logs per Branch', desc: 'Drill into any branch\'s session activity log without needing physical access to the machine.' },
        { icon: '🔒', label: 'Admin-only Access', desc: 'This view is completely hidden from regular operators. Only the admin access key unlocks it.' },
      ]}
      settingsPath="Settings → Feature Modules → Branch Activity Monitor (requires cloud access key)"
      adminNote="This module requires a cloud access key and active Branch Sync to function. Enable Branch Sync first, then activate this monitor."
    />
  )
}
