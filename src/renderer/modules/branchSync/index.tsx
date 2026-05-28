/**
 * cQikly — Branch Sync Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'branchSync' is true
 * AND a valid cloud access key is active in config.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16: Admin + cloud only.
 * Currently offline drag-and-drop DB sync only; Supabase is the future path.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function BranchSyncModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="🔗"
      title="Branch Sync"
      badgeLabel="Admin + Cloud Key Required"
      badgeColor="amber"
      description="Sync billing data across all your branches in real time via secure cloud infrastructure."
      features={[
        { icon: '☁️', label: 'Supabase Cloud Infrastructure', desc: 'Admin-provisioned cloud sync. Regular users never see or configure this — it just works behind the scenes.' },
        { icon: '🔄', label: 'Real-time Branch Data Sync', desc: 'Bills, customers, and inventory changes at any branch propagate to all connected branches.' },
        { icon: '🏢', label: 'Head Office Dashboard', desc: 'HQ sees a unified view of all branch activity, totals, and outstanding amounts.' },
        { icon: '⚡', label: 'Conflict Resolution', desc: 'Smart merge strategy handles simultaneous edits from multiple branches without data loss.' },
        { icon: '📡', label: 'Offline Resilience', desc: 'Works fully offline. Changes queue and sync automatically when the connection is restored.' },
      ]}
      settingsPath="Settings → Feature Modules → Branch Sync (requires cloud access key)"
      adminNote="This module requires a cloud access key obtained from the cQikly developer. Enter your key in Settings → Access Key to activate admin features."
    />
  )
}
