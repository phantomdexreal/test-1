/**
 * cQikly — Settings: Company Profile Panel
 * Built in: Phase 11a-i
 *
 * All onboarding fields are editable here:
 *   - Firm name, address, GST number, contact info, logo
 *   - Office type (Head Office / Branch) + branch info
 *   - Financial year start month
 *   - Bill number reset cycle
 *   - Starting bill number (one-time migration — clearly labelled)
 *   - Onboarding Re-run button (opens full wizard)
 *
 * All changes propagate instantly via ConfigContext.updateConfig()
 * which fires eventBus.emit('configChange') — zero restart.
 *
 * Data is also persisted to the company_profile SQLite table
 * via the onboarding service helpers.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { eventBus } from '../../utils/eventBus'
import { updateBillNumberConfig } from '../../utils/billNumber'

// ─── Design tokens (shared with Settings page) ────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  surface:     'var(--cq-surface)',
  border:      'var(--cq-border)',
  panelBg:     'rgba(255,255,255,0.03)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  amber:       '#fbbf24',
  amberBg:     'rgba(251,191,36,0.10)',
  amberBorder: 'rgba(251,191,36,0.35)',
}

// ─── IPC bridge ───────────────────────────────────────────────────────────────

function getIpc() {
  return (window as Window & { cqikly?: Window['cqikly'] }).cqikly ?? null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const MONTH_NUM: Record<string, number> = {
  January:1, February:2, March:3, April:4, May:5, June:6,
  July:7, August:8, September:9, October:10, November:11, December:12,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: C.textSecond, letterSpacing: '0.02em' }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: '0.74rem', color: C.textSecond, opacity: 0.7, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  fontFamily: C.font,
  fontSize: '0.88rem',
  color: 'var(--cq-text-primary)',
  background: 'rgba(255,255,255,0.05)',
  border: '1.5px solid var(--cq-border)',
  borderRadius: 8,
  padding: '10px 14px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 80,
  lineHeight: 1.6,
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238b5cf6' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
}

// ─── Company Profile Form ─────────────────────────────────────────────────────

interface CompanyFormState {
  firmName: string
  address: string
  gstNumber: string
  contactPhone: string
  contactEmail: string
  officeType: 'head_office' | 'branch'
  numberOfBranches: string
  fyStartMonth: string       // month name
  billResetCycle: 'yearly' | 'monthly' | 'never'
  startingBillNumber: string // one-time migration
  logoDataUrl: string        // base64 or empty
}

interface CompanyProfilePanelProps {
  onRerunOnboarding: () => void
}

export default function CompanyProfilePanel({ onRerunOnboarding }: CompanyProfilePanelProps): React.ReactElement {
  const { config, updateConfig } = useConfig()

  // ── Local form state (sourced from config + DB on mount) ──────────────────
  const [form, setForm] = useState<CompanyFormState>({
    firmName:         '',
    address:          '',
    gstNumber:        '',
    contactPhone:     '',
    contactEmail:     '',
    officeType:       'head_office',
    numberOfBranches: '0',
    fyStartMonth:     'April',
    billResetCycle:   'yearly',
    startingBillNumber: '1',
    logoDataUrl:      '',
  })

  const [savedFeedback, setSavedFeedback] = useState(false)
  const [logoSavedFeedback, setLogoSavedFeedback] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load from SQLite on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const ipc = getIpc()

      // Seed from config first (fast)
      const fyMonth = MONTHS[(config.fyStartMonth ?? 4) - 1] ?? 'April'
      const billCycle = (config.billResetCycle as CompanyFormState['billResetCycle']) ?? 'yearly'

      // Try DB for richer profile data
      if (ipc) {
        try {
          const rows = await ipc.db.query(
            'SELECT * FROM company_profile LIMIT 1', []
          ) as Record<string, unknown>[]
          const row = rows[0]
          if (row) {
            setForm({
              firmName:         (row.firm_name as string)        ?? '',
              address:          (row.address as string)          ?? '',
              gstNumber:        (row.gst_number as string)       ?? '',
              contactPhone:     (row.phone as string)            ?? '',
              contactEmail:     (row.email as string)            ?? '',
              officeType:       (row.office_type as string) === 'branch' ? 'branch' : 'head_office',
              numberOfBranches: String(row.number_of_branches     ?? 0),
              fyStartMonth:     MONTHS[(row.financial_year_start as number ?? 4) - 1] ?? 'April',
              billResetCycle:   (row.bill_reset_cycle as CompanyFormState['billResetCycle']) ?? 'yearly',
              startingBillNumber: String(row.starting_bill_number ?? 1),
              logoDataUrl:      (row.logo_path as string)        ?? '',
            })
            return
          }
        } catch (err) {
          console.warn('[CompanyProfilePanel] DB read failed — falling back to config', err)
        }
      }

      // Fallback: config file values (browser / dev mode)
      try {
        const raw = localStorage.getItem('cq:companyProfile')
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<CompanyFormState>
          setForm(prev => ({ ...prev, ...parsed, fyStartMonth: fyMonth, billResetCycle: billCycle }))
          return
        }
      } catch { /* ignore */ }

      setForm(prev => ({ ...prev, fyStartMonth: fyMonth, billResetCycle: billCycle }))
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Persist & propagate changes ───────────────────────────────────────────
  const persistProfile = useCallback(async (next: CompanyFormState) => {
    const fyNum = MONTH_NUM[next.fyStartMonth] ?? 4

    // 1. Config (instant propagation via event bus)
    updateConfig({
      fyStartMonth:       fyNum,
      billResetCycle:     next.billResetCycle,
      // Emit firmName as a custom key for any UI that reads it
      ...(next.firmName ? { companyName: next.firmName } : {}),
    })

    // 2. Bill number engine (applies new FY start month / reset cycle)
    await updateBillNumberConfig({
      prefix:        config.billPrefix ?? '',
      fyStartMonth:  fyNum,
      resetCycle:    next.billResetCycle,
    })

    // 3. SQLite (Electron)
    const ipc = getIpc()
    if (ipc) {
      try {
        await ipc.db.run('DELETE FROM company_profile', [])
        await ipc.db.run(
          `INSERT INTO company_profile (
            firm_name, address, gst_number, phone, email, logo_path,
            office_type, number_of_branches,
            financial_year_start, bill_reset_cycle, starting_bill_number,
            onboarding_complete, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`,
          [
            next.firmName,
            next.address,
            next.gstNumber || null,
            next.contactPhone || null,
            next.contactEmail || null,
            next.logoDataUrl || null,
            next.officeType === 'head_office' ? 'head' : 'branch',
            parseInt(next.numberOfBranches) || 0,
            fyNum,
            next.billResetCycle,
            parseInt(next.startingBillNumber) || 1,
          ]
        )
      } catch (err) {
        console.error('[CompanyProfilePanel] DB write failed:', err)
      }
    }

    // 4. localStorage fallback (dev/browser)
    try {
      localStorage.setItem('cq:companyProfile', JSON.stringify(next))
    } catch { /* ignore */ }

    // 5. Broadcast profile-level changes so QuotePage / Sidebar etc. can react
    eventBus.emit('configChange', { key: 'companyProfileUpdated', value: true })
  }, [config.billPrefix, updateConfig])

  // ── Debounced save (400 ms) ───────────────────────────────────────────────
  const handleChange = useCallback(<K extends keyof CompanyFormState>(
    key: K, value: CompanyFormState[K]
  ) => {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        await persistProfile(next)
        setSavedFeedback(true)
        setTimeout(() => setSavedFeedback(false), 2000)
      }, 400)
      return next
    })
  }, [persistProfile])

  // ── Logo file picker ──────────────────────────────────────────────────────
  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      handleChange('logoDataUrl', url)
      setLogoSavedFeedback(true)
      setTimeout(() => setLogoSavedFeedback(false), 2000)
    }
    reader.readAsDataURL(file)
  }, [handleChange])

  const removeLogo = useCallback(() => {
    handleChange('logoDataUrl', '')
  }, [handleChange])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      padding: '28px 32px',
      background: C.panelBg,
      border: '1px solid var(--cq-border)',
      borderRadius: 14,
      fontFamily: C.font,
    }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            Company Profile
          </div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary }}>
            Firm Details
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {savedFeedback && (
            <div style={{
              fontSize: '0.78rem', fontWeight: 700, color: C.green,
              background: C.greenBg, border: `1px solid ${C.greenBorder}`,
              borderRadius: 8, padding: '5px 12px',
              animation: 'fadeIn 0.2s ease',
            }}>
              ✓ Saved
            </div>
          )}
        </div>
      </div>

      {/* Form grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
        {/* Firm Name */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Firm / Company Name" hint="Shown on all bills and PDFs">
            <input
              style={inputStyle}
              value={form.firmName}
              onChange={e => handleChange('firmName', e.target.value)}
              placeholder="e.g. Sharma Enterprises"
            />
          </Field>
        </div>

        {/* Address */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Company Address">
            <textarea
              style={textareaStyle}
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder="Street, City, State, PIN"
            />
          </Field>
        </div>

        {/* GST */}
        <Field label="GST Number" hint="Optional — appears on GST format PDFs">
          <input
            style={inputStyle}
            value={form.gstNumber}
            onChange={e => handleChange('gstNumber', e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
        </Field>

        {/* Office type */}
        <Field label="Office Type">
          <select
            style={selectStyle}
            value={form.officeType}
            onChange={e => handleChange('officeType', e.target.value as CompanyFormState['officeType'])}
          >
            <option value="head_office">Head Office</option>
            <option value="branch">Branch</option>
          </select>
        </Field>

        {/* Phone */}
        <Field label="Contact Phone">
          <input
            style={inputStyle}
            value={form.contactPhone}
            onChange={e => handleChange('contactPhone', e.target.value)}
            placeholder="+91 98765 43210"
            type="tel"
          />
        </Field>

        {/* Email */}
        <Field label="Contact Email">
          <input
            style={inputStyle}
            value={form.contactEmail}
            onChange={e => handleChange('contactEmail', e.target.value)}
            placeholder="contact@yourfirm.com"
            type="email"
          />
        </Field>

        {/* Number of branches (shown only for head office) */}
        {form.officeType === 'head_office' && (
          <Field label="Number of Branches" hint="0 if no branches">
            <input
              style={inputStyle}
              value={form.numberOfBranches}
              onChange={e => handleChange('numberOfBranches', e.target.value)}
              type="number"
              min="0"
              max="999"
            />
          </Field>
        )}

        {/* Financial Year Start Month */}
        <Field label="Financial Year Start Month" hint="Default: April (India standard)">
          <select
            style={selectStyle}
            value={form.fyStartMonth}
            onChange={e => handleChange('fyStartMonth', e.target.value)}
          >
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>

        {/* Bill Number Reset Cycle */}
        <Field label="Bill Number Reset Cycle">
          <select
            style={selectStyle}
            value={form.billResetCycle}
            onChange={e => handleChange('billResetCycle', e.target.value as CompanyFormState['billResetCycle'])}
          >
            <option value="yearly">Yearly (on financial year start)</option>
            <option value="monthly">Monthly (on 1st of each month)</option>
            <option value="never">Never (continuous numbering)</option>
          </select>
        </Field>

        {/* Starting Bill Number — one-time migration */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field
            label="Starting Bill Number"
            hint={
              '⚠ ONE-TIME MIGRATION SETTING — used only for the very first bill in this installation. ' +
              'On yearly or monthly resets, the counter always restarts from 1 regardless of this value. ' +
              'Change this only if you are migrating from another billing system.'
            }
          >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, maxWidth: 160 }}
                value={form.startingBillNumber}
                onChange={e => handleChange('startingBillNumber', e.target.value)}
                type="number"
                min="1"
              />
              <div style={{
                fontSize: '0.76rem', color: C.amber,
                background: C.amberBg, border: `1px solid ${C.amberBorder}`,
                borderRadius: 7, padding: '6px 12px', lineHeight: 1.4,
                flex: 1,
              }}>
                🔒 One-time only — applies to first bill, then resets always restart from 1
              </div>
            </div>
          </Field>
        </div>

        {/* Company Logo */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Company Logo" hint="Optional — shown on Professional PDF formats. PNG, JPG, or SVG.">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Preview */}
              {form.logoDataUrl ? (
                <div style={{
                  width: 80, height: 80, borderRadius: 10,
                  border: '1.5px solid var(--cq-border)',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  <img
                    src={form.logoDataUrl}
                    alt="Company logo"
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : (
                <div style={{
                  width: 80, height: 80, borderRadius: 10,
                  border: '1.5px dashed var(--cq-border)',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.textSecond, fontSize: '1.6rem', flexShrink: 0,
                }}>
                  🏢
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp"
                  onChange={handleLogoFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  style={{
                    fontFamily: C.font, fontSize: '0.83rem', fontWeight: 700,
                    padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(139,92,246,0.14)',
                    color: '#c4b5fd',
                    border: '1.5px solid rgba(139,92,246,0.35)',
                    outline: 'none', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.25)'
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.55)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(139,92,246,0.14)'
                    e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'
                  }}
                >
                  {form.logoDataUrl ? '🔄 Change Logo' : '📁 Select Logo'}
                </button>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    style={{
                      fontFamily: C.font, fontSize: '0.8rem', fontWeight: 600,
                      padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.09)',
                      color: '#fca5a5',
                      border: '1.5px solid rgba(239,68,68,0.28)',
                      outline: 'none', transition: 'all 0.15s',
                    }}
                  >
                    🗑 Remove Logo
                  </button>
                )}
                {logoSavedFeedback && (
                  <div style={{ fontSize: '0.76rem', color: C.green, fontWeight: 700 }}>
                    ✓ Logo saved
                  </div>
                )}
              </div>
            </div>
          </Field>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--cq-border)', margin: '28px 0' }} />

      {/* Onboarding Re-run */}
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
          Re-run Company Setup Wizard
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, lineHeight: 1.7, marginBottom: 16 }}>
          Opens the full onboarding wizard to re-enter all company details from scratch.
          Your billing history, customers, and inventory are <strong style={{ color: C.textPrimary }}>not affected</strong>
          — only the company profile is overwritten when you complete the wizard.
          Internet connection is not required for re-runs.
        </div>
        <button
          type="button"
          onClick={onRerunOnboarding}
          style={{
            fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
            background: 'rgba(139,92,246,0.13)',
            color: '#c4b5fd',
            border: '1.5px solid rgba(139,92,246,0.32)',
            borderRadius: 10, padding: '11px 24px', cursor: 'pointer',
            outline: 'none', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.24)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(139,92,246,0.13)'
            e.currentTarget.style.borderColor = 'rgba(139,92,246,0.32)'
          }}
        >
          ⚙️ Open Setup Wizard
        </button>
      </div>
    </div>
  )
}
