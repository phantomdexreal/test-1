/**
 * cQikly — Onboarding Persistence Service
 * Built in: Phase 2b
 *
 * Handles all writes that occur when the onboarding wizard completes:
 *   1. Write company profile row to SQLite (company_profile table)
 *   2. Seed the bill_number_sequence row with the user's starting number
 *   3. Copy logo to AppData/logos/ if one was provided (data URL → file)
 *   4. Write onboardingComplete: true + billing prefs to the config file
 *      via ConfigContext.updateConfig() (called by the caller)
 *
 * Called by: OnboardingPage after the wizard's onComplete fires.
 *
 * Architecture: all DB calls go through window.cqikly.db IPC, never direct.
 */

import type { OnboardingData } from '../pages/Onboarding/OnboardingWizard'

// ─── Month → number helper ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

// ─── IPC bridge ───────────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

// ─── Logo save helper ─────────────────────────────────────────────────────────

/**
 * If a data URL is provided, save it to AppData/logos/<firmname>.png via
 * the db service (using a raw SQL insert into a key-value table if needed,
 * or simply store the data URL in the profile for now).
 *
 * In Phase 2b we store the data URL directly in the DB field for simplicity.
 * Phase 11a-i will migrate this to a proper file-based logo system.
 */
function sanitizeLogoForStorage(dataUrl: string): string {
  // Limit storage to reasonable size (< 500 KB base64 ≈ ~375 KB file)
  if (dataUrl && dataUrl.length > 700_000) {
    console.warn('[OnboardingService] Logo data URL too large — skipping storage')
    return ''
  }
  return dataUrl
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface OnboardingPersistResult {
  success: boolean
  error?: string
}

/**
 * Persist all onboarding data to SQLite and return success/failure.
 * The config file update (onboardingComplete: true, billing prefs) is
 * handled separately by the caller via updateConfig().
 */
export async function persistOnboardingData(
  data: OnboardingData
): Promise<OnboardingPersistResult> {
  const ipc = getIpc()

  if (!ipc) {
    // Browser / no-Electron dev mode: silently succeed (config file path also mock)
    console.info('[OnboardingService] No IPC bridge — skipping SQLite write (dev mode)')
    return { success: true }
  }

  try {
    const fyStartMonth  = MONTH_MAP[data.financialYearStartMonth] ?? 4
    const numberOfBranches = parseInt(data.numberOfBranches || '0', 10)
    const startingBillNum  = parseInt(data.startingBillNumber   || '1', 10)
    const logoForStorage   = sanitizeLogoForStorage(data.companyLogoDataUrl)

    // ── 1. Upsert company_profile ──────────────────────────────────────────
    // DELETE first then INSERT so re-run from Settings also works cleanly.
    await ipc.db.run('DELETE FROM company_profile', [])

    await ipc.db.run(
      `INSERT INTO company_profile (
        firm_name, nature_of_firm, nature_of_business, business_model,
        gst_number, address, office_type, number_of_branches,
        phone, email, logo_path,
        financial_year_start, bill_reset_cycle, starting_bill_number,
        onboarding_complete, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
      [
        data.firmName,
        data.natureOfFirm,
        JSON.stringify(data.natureOfBusiness),
        JSON.stringify(data.businessModel),
        data.gstNumber || null,
        data.companyAddress,
        data.officeType === 'head_office' ? 'head' : 'branch',
        numberOfBranches,
        data.contactPhone || null,
        data.contactEmail || null,
        logoForStorage || null,
        fyStartMonth,
        data.billResetCycle || 'yearly',
        startingBillNum,
      ]
    )

    // ── 2. Seed / reset the bill number sequence ───────────────────────────
    // Hard Spec #3: starting bill number is one-time-only.
    // On re-run from Settings this updates the sequence for the new setup.
    await ipc.db.run(
      `INSERT INTO bill_number_sequence (id, current_number, reset_cycle, last_reset_date)
       VALUES (1, ?, ?, date('now'))
       ON CONFLICT(id) DO UPDATE SET
         current_number = excluded.current_number,
         reset_cycle    = excluded.reset_cycle,
         last_reset_date = excluded.last_reset_date`,
      [startingBillNum - 1, data.billResetCycle || 'yearly']
    )

    console.info('[OnboardingService] Company profile + bill sequence written to SQLite')
    return { success: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[OnboardingService] DB write failed:', msg)
    return { success: false, error: msg }
  }
}

/**
 * Read back the company profile from SQLite.
 * Used by Settings → Company Profile (Phase 11a-i) and for verification.
 */
export async function readCompanyProfile(): Promise<Record<string, unknown> | null> {
  const ipc = getIpc()
  if (!ipc) return null

  try {
    const rows = await ipc.db.query('SELECT * FROM company_profile LIMIT 1', []) as Record<string, unknown>[]
    return rows[0] ?? null
  } catch (err) {
    console.error('[OnboardingService] readCompanyProfile failed:', err)
    return null
  }
}
