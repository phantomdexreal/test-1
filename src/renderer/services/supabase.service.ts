/**
 * cQikly — Supabase Service
 * Built in: FUTURE (admin-provisioned cloud sync)
 * Placeholder: Phase 1a-i-A
 *
 * ⚠️  ADMIN-ONLY FUTURE FEATURE — NEVER EXPOSED TO REGULAR USERS
 *
 * This service handles cloud sync with Supabase.
 * It is gated behind an admin access key and cloud sharing flag.
 * Regular users never see, configure, or interact with this service.
 * For Phase 1 through all planned phases: offline drag-and-drop DB sync only.
 *
 * No direct Supabase calls from components ever (Core Principle).
 * All sync goes through this service layer.
 */

// TODO: [SUPABASE-SERVICE] - Implementation deferred to admin cloud sync phase.
// This stub is intentionally minimal and clearly marked as admin-only.

export interface ISupabaseService {
  /** Admin-only: initialize connection with provisioned access key */
  initialize(accessKey: string): Promise<boolean>
  /** Push local DB changes to Supabase */
  pushChanges(): Promise<void>
  /** Pull remote changes from Supabase */
  pullChanges(): Promise<void>
  /** Check sync status */
  getSyncStatus(): Promise<{ lastSync: string | null; pendingChanges: number }>
}

// Placeholder — never call these from regular user flows
export const supabaseService: ISupabaseService = {
  initialize: async () => false,
  pushChanges: async () => {},
  pullChanges: async () => {},
  getSyncStatus: async () => ({ lastSync: null, pendingChanges: 0 }),
}
