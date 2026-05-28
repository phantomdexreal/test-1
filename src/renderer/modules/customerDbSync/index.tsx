/**
 * cQikly — Centralized Customer DB Sync Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'customerDbSync' is true
 * AND a valid cloud access key is active in config.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Admin + cloud only; shared customer list pushed from HQ to branches.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function CustomerDbSyncModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="🗄️"
      title="Customer DB Sync"
      badgeLabel="Admin + Cloud Key Required"
      badgeColor="amber"
      description="Maintain one master customer list at HQ and push it to all branches automatically."
      features={[
        { icon: '🏢', label: 'HQ-managed Customer Master', desc: 'Add, edit, and manage your complete customer database from Head Office.' },
        { icon: '📤', label: 'Push to All Branches', desc: 'One click pushes the full customer list (or specific updates) to every connected branch.' },
        { icon: '🔄', label: 'Merge Conflict Handling', desc: 'Branch-local customer additions are flagged for HQ review before being merged into the master list.' },
        { icon: '📊', label: 'Sync Status per Branch', desc: 'See which branches have the latest customer data and which are out of sync.' },
        { icon: '🔒', label: 'Read-only at Branches (Optional)', desc: 'Configure branches to see the master customer list but not edit it — protecting data integrity.' },
      ]}
      settingsPath="Settings → Feature Modules → Centralized Customer DB Sync (requires cloud access key)"
      adminNote="This module requires a cloud access key and active Branch Sync. Customer data syncs over the same Supabase infrastructure as billing data."
    />
  )
}
