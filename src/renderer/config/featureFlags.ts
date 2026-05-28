/**
 * cQikly — Feature Flag Definitions
 * Central registry of all boolean-gated features.
 * All future modules are registered here from Day One.
 *
 * Rule: components outside a module NEVER import from that module directly.
 * They check the feature flag first; the module renders nothing when flag is false.
 */

import type { FeatureFlagsMap } from '@/contexts/FeatureFlagContext'

/** All feature flags with their default (off) states */
export const DEFAULT_FEATURE_FLAGS: FeatureFlagsMap = {
  reports: false,
  expenseTracker: false,
  multiUser: false,
  paymentLedger: false,
  branchSync: false,
  whatsappShare: false,
  branchActivityMonitor: false,
  customerDbSync: false,
  priceListSync: false,
}

/** Human-readable labels for Settings UI */
export const FEATURE_FLAG_LABELS: Record<keyof FeatureFlagsMap, string> = {
  reports: 'Reports Module',
  expenseTracker: 'Expense Tracker',
  multiUser: 'Multi-User / Operator Profiles',
  paymentLedger: 'Payment Recorder & Ledger',
  branchSync: 'Branch Sync',
  whatsappShare: 'WhatsApp Quick Share',
  branchActivityMonitor: 'Branch Activity Monitor (Admin + Cloud only)',
  customerDbSync: 'Centralized Customer DB Sync',
  priceListSync: 'Price List Sync',
}
