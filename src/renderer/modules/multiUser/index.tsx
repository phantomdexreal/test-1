/**
 * cQikly — Multi-User / Operator Profiles Module Page (Boolean-Gated)
 * Built in: Phase 13
 *
 * GATING RULE: Only rendered when feature flag 'multiUser' is true.
 * Components outside this module NEVER import from it directly.
 * When flag is off → completely invisible, zero side effects.
 *
 * Masterplan Section 16:
 *   PIN-based operator switching on same machine;
 *   each operator has their own session log.
 */
import React from 'react'
import { ModulePlaceholderPage } from '../../components/ModulePlaceholderPage'

export default function MultiUserModule(): React.ReactElement {
  return (
    <ModulePlaceholderPage
      icon="👥"
      title="Operator Profiles"
      badgeLabel="Coming Soon"
      badgeColor="purple"
      description="Multiple people, one machine — each with their own identity and activity log."
      features={[
        { icon: '🔢', label: 'PIN-based Operator Switching', desc: 'Each operator has a personal 4-digit PIN. Switch between operators in seconds without restarting the app.' },
        { icon: '📋', label: 'Per-operator Session Log', desc: 'Every action — bill created, customer added, setting changed — is logged per operator.' },
        { icon: '🏷️', label: 'Operator Name on Bills', desc: 'Optionally stamp the operator name on saved bills for accountability.' },
        { icon: '🔒', label: 'Admin Override PIN', desc: 'A separate admin PIN to manage operators and access restricted settings.' },
        { icon: '📊', label: 'Operator Activity Reports', desc: 'See how many bills each operator created in a given period.' },
      ]}
      settingsPath="Settings → Feature Modules → Multi-User / Operator Profiles"
    />
  )
}
