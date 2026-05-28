/**
 * cQikly — Price List Sync Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'priceListSync' is true
 * AND a valid cloud access key is active in config.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   Admin + cloud only; push updated inventory prices from HQ to all branches.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function PriceListSyncModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="🏷️"
      title="Price List Sync"
      badgeLabel="Admin + Cloud Key Required"
      badgeColor="amber"
      description="Update prices once at HQ and push them to all branches instantly — no manual re-entry."
      features={[
        { icon: '💲', label: 'HQ Price Master', desc: 'Maintain a single master price list at Head Office. All price changes originate here.' },
        { icon: '📤', label: 'Push Prices to All Branches', desc: 'When you update a product\'s price at HQ, all branches get the update on their next sync.' },
        { icon: '🎯', label: 'Selective Push', desc: 'Push specific products or categories to specific branches — useful for branch-specific pricing.' },
        { icon: '📋', label: 'Price Change History', desc: 'Full audit trail of every price change — what changed, when, and which branches received it.' },
        { icon: '🔔', label: 'Branch Acknowledgment', desc: 'Track which branches have applied the latest price list and which are still on old prices.' },
      ]}
      settingsPath="Settings → Feature Modules → Price List Sync (requires cloud access key)"
      adminNote="This module works alongside Inventory and Branch Sync. Prices pushed here override branch-local inventory prices on the next sync."
    />
  )
}
