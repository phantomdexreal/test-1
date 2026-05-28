/**
 * cQikly — OnboardingWizard
 * Built in: Phase 2a-B
 *
 * Full multi-step onboarding wizard — collects all company setup fields,
 * validates required fields before allowing forward progression,
 * preserves all data across backward/forward navigation,
 * and ends with a confirmation screen.
 *
 * No DB writes in this phase — all data lives in memory (onComplete callback).
 *
 * Steps:
 *   1  — Firm Identity     (Name of Firm, Nature of Firm)
 *   2  — Business Profile  (Nature of Business [if product], Business Model)
 *   3  — Legal & Address   (GST Number [optional], Company Address)
 *   4  — Office Setup      (Head Office / Branch, Number of Branches)
 *   5  — Cloud Sharing     (Yes/No, access key info screen)
 *   6  — Contact Info      (Phone, Email, Website)
 *   7  — Company Logo      (file picker, optional)
 *   8  — Financial Year    (FY Start Month, Bill Reset Cycle, Starting Bill No.)
 *   9  — Confirmation      (summary of all collected data, Confirm & Start button)
 *
 * Architecture rules:
 *   - All data held in a single `FormData` state object at wizard root
 *   - Each step receives its slice + updater via props
 *   - Backward navigation never clears any already-filled field
 *   - Required field checks are per-step before allowing Next
 *   - Validation errors shown inline below the relevant field
 *   - A progress bar + step indicator shows current position
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OnboardingData {
  // Step 1
  firmName: string
  natureOfFirm: 'product' | 'service' | ''

  // Step 2
  natureOfBusiness: Array<'wholesale' | 'retail' | 'production'>
  businessModel: Array<'b2b' | 'b2c' | 'c2c'>

  // Step 3
  gstNumber: string
  companyAddress: string

  // Step 4
  officeType: 'head_office' | 'branch' | ''
  numberOfBranches: string

  // Step 5
  cloudSharing: boolean | null

  // Step 6
  contactPhone: string
  contactEmail: string
  contactWebsite: string

  // Step 7
  companyLogoPath: string
  companyLogoDataUrl: string

  // Step 8
  financialYearStartMonth: string
  billResetCycle: 'yearly' | 'monthly' | 'never' | ''
  startingBillNumber: string
}

const INITIAL_DATA: OnboardingData = {
  firmName: '',
  natureOfFirm: '',
  natureOfBusiness: [],
  businessModel: [],
  gstNumber: '',
  companyAddress: '',
  officeType: '',
  numberOfBranches: '',
  cloudSharing: null,
  contactPhone: '',
  contactEmail: '',
  contactWebsite: '',
  companyLogoPath: '',
  companyLogoDataUrl: '',
  financialYearStartMonth: 'April',
  billResetCycle: 'yearly',
  startingBillNumber: '1',
}

interface OnboardingWizardProps {
  onClose: () => void
  onComplete: (data: OnboardingData) => void
  /** Phase 2b: save error message to surface to user (set by OnboardingPage on DB fail) */
  saveError?: string
  /** Phase 2b: clear the save error (fired when user edits and tries again) */
  onClearSaveError?: () => void
}

// ─── Design tokens (inline — no Tailwind dependency) ─────────────────────────

const C = {
  bg:           'rgba(8,3,22,0.98)',
  bgStep:       'rgba(14,6,38,0.99)',
  border:       'rgba(139,92,246,0.25)',
  borderFocus:  'rgba(167,139,250,0.7)',
  borderErr:    'rgba(239,68,68,0.7)',
  accent:       '#8b5cf6',
  accentLight:  '#c4b5fd',
  accentSoft:   'rgba(139,92,246,0.15)',
  accentSoftHover: 'rgba(139,92,246,0.28)',
  textPrimary:  '#f1f0ff',
  textSecond:   'rgba(196,181,253,0.72)',
  textMuted:    'rgba(196,181,253,0.42)',
  inputBg:      'rgba(22,10,55,0.8)',
  chipBg:       'rgba(139,92,246,0.12)',
  chipActive:   'rgba(139,92,246,0.30)',
  chipBorder:   'rgba(139,92,246,0.35)',
  successBg:    'rgba(34,197,94,0.12)',
  successBorder:'rgba(34,197,94,0.4)',
  successText:  '#86efac',
  infoBg:       'rgba(59,130,246,0.12)',
  infoBorder:   'rgba(59,130,246,0.4)',
  infoText:     '#93c5fd',
  errBg:        'rgba(239,68,68,0.1)',
  errText:      '#fca5a5',
  shadow:       '0 0 100px rgba(139,92,246,0.22), 0 40px 80px rgba(0,0,0,0.7)',
  font:         '"Inter", system-ui, -apple-system, sans-serif',
}

// ─── Small shared UI pieces ───────────────────────────────────────────────────

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: 'block', fontFamily: C.font, fontSize: '0.8rem', fontWeight: 600, color: C.accentLight, marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
      {children}
      {required && <span style={{ color: '#f87171', marginLeft: '4px' }}>*</span>}
    </label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <div style={{ fontFamily: C.font, fontSize: '0.78rem', color: C.errText, marginTop: '6px', background: C.errBg, borderRadius: '6px', padding: '5px 10px' }}>{msg}</div>
}

function TextInput({ value, onChange, placeholder, maxLength, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; style?: React.CSSProperties
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', boxSizing: 'border-box', fontFamily: C.font, fontSize: '0.93rem',
        background: C.inputBg, color: C.textPrimary, border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        borderRadius: '10px', padding: '11px 14px', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? `0 0 0 3px rgba(139,92,246,0.18)` : 'none',
        ...style,
      }}
    />
  )
}

function TextArea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', boxSizing: 'border-box', fontFamily: C.font, fontSize: '0.93rem',
        background: C.inputBg, color: C.textPrimary, border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        borderRadius: '10px', padding: '11px 14px', outline: 'none', resize: 'vertical',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: focused ? `0 0 0 3px rgba(139,92,246,0.18)` : 'none',
        lineHeight: 1.6,
      }}
    />
  )
}

function SelectInput({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%', boxSizing: 'border-box', fontFamily: C.font, fontSize: '0.93rem',
        background: C.inputBg, color: value ? C.textPrimary : C.textMuted,
        border: `1.5px solid ${focused ? C.borderFocus : C.border}`,
        borderRadius: '10px', padding: '11px 14px', outline: 'none', cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s', appearance: 'none',
        boxShadow: focused ? `0 0 0 3px rgba(139,92,246,0.18)` : 'none',
      }}
    >
      {children}
    </select>
  )
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontFamily: C.font, fontSize: '0.88rem', fontWeight: active ? 700 : 500,
        padding: '9px 20px', borderRadius: '24px', cursor: 'pointer',
        border: `1.5px solid ${active ? C.accent : C.chipBorder}`,
        background: active ? C.chipActive : hovered ? C.accentSoftHover : C.chipBg,
        color: active ? '#e9d5ff' : C.textSecond,
        transition: 'all 0.18s', outline: 'none',
        boxShadow: active ? `0 0 12px rgba(139,92,246,0.35)` : 'none',
      }}
    >
      {active ? '✓ ' : ''}{label}
    </button>
  )
}

function RadioCard({ label, sublabel, selected, onClick }: {
  label: string; sublabel?: string; selected: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1, fontFamily: C.font, cursor: 'pointer', padding: '18px 20px',
        borderRadius: '12px', textAlign: 'left', border: `1.5px solid ${selected ? C.accent : C.border}`,
        background: selected ? C.chipActive : hovered ? C.accentSoftHover : C.chipBg,
        transition: 'all 0.18s', outline: 'none',
        boxShadow: selected ? `0 0 16px rgba(139,92,246,0.3)` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${selected ? C.accent : C.border}`,
          background: selected ? C.accent : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff' }} />}
        </div>
        <div>
          <div style={{ fontSize: '0.93rem', fontWeight: 700, color: selected ? '#e9d5ff' : C.textPrimary }}>{label}</div>
          {sublabel && <div style={{ fontSize: '0.78rem', color: C.textMuted, marginTop: '3px' }}>{sublabel}</div>}
        </div>
      </div>
    </button>
  )
}

function InfoBanner({ type, children }: { type: 'info' | 'success' | 'warning'; children: React.ReactNode }) {
  const colors = {
    info:    { bg: C.infoBg,    border: C.infoBorder,    text: C.infoText,    icon: 'ℹ️' },
    success: { bg: C.successBg, border: C.successBorder, text: C.successText, icon: '✅' },
    warning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.4)', text: '#fde68a', icon: '⚠️' },
  }[type]
  return (
    <div style={{
      borderRadius: '10px', padding: '14px 18px', background: colors.bg,
      border: `1px solid ${colors.border}`, color: colors.text,
      fontFamily: C.font, fontSize: '0.87rem', lineHeight: 1.6,
      display: 'flex', gap: '10px', alignItems: 'flex-start',
    }}>
      <span style={{ flexShrink: 0, marginTop: '1px' }}>{colors.icon}</span>
      <div>{children}</div>
    </div>
  )
}

// ─── Step components ──────────────────────────────────────────────────────────

// Step 1: Firm Identity
function Step1({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <Label required>Name of Firm</Label>
        <TextInput
          value={data.firmName}
          onChange={v => update({ firmName: v })}
          placeholder="e.g. Shree Traders Pvt. Ltd."
          maxLength={120}
        />
        <FieldError msg={errors.firmName} />
      </div>

      <div>
        <Label required>Nature of Firm</Label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <RadioCard
            label="Product-Based"
            sublabel="Sells, manufactures, or distributes physical goods"
            selected={data.natureOfFirm === 'product'}
            onClick={() => update({ natureOfFirm: 'product' })}
          />
          <RadioCard
            label="Service-Based"
            sublabel="Provides services — consulting, labour, logistics, etc."
            selected={data.natureOfFirm === 'service'}
            onClick={() => update({ natureOfFirm: 'service' })}
          />
        </div>
        <FieldError msg={errors.natureOfFirm} />
      </div>
    </div>
  )
}

// Step 2: Business Profile
function Step2({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  function toggleNOB(val: 'wholesale' | 'retail' | 'production') {
    const arr = data.natureOfBusiness
    update({ natureOfBusiness: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] })
  }
  function toggleBM(val: 'b2b' | 'b2c' | 'c2c') {
    const arr = data.businessModel
    update({ businessModel: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {data.natureOfFirm === 'product' && (
        <div>
          <Label required>Nature of Business</Label>
          <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '12px' }}>
            Select all that apply — your firm can operate across multiple modes
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <ToggleChip label="Wholesale" active={data.natureOfBusiness.includes('wholesale')} onClick={() => toggleNOB('wholesale')} />
            <ToggleChip label="Retail" active={data.natureOfBusiness.includes('retail')} onClick={() => toggleNOB('retail')} />
            <ToggleChip label="Production / Manufacturing" active={data.natureOfBusiness.includes('production')} onClick={() => toggleNOB('production')} />
          </div>
          <FieldError msg={errors.natureOfBusiness} />
        </div>
      )}

      {data.natureOfFirm === 'service' && (
        <InfoBanner type="info">
          Business mode options are tailored for product-based firms. For service firms, you can configure service-specific settings from the Settings page after setup.
        </InfoBanner>
      )}

      <div>
        <Label required>Business Model</Label>
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '12px' }}>
          Who are your primary customers? Select all that apply
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <ToggleChip label="B2B — Business to Business" active={data.businessModel.includes('b2b')} onClick={() => toggleBM('b2b')} />
          <ToggleChip label="B2C — Business to Consumer" active={data.businessModel.includes('b2c')} onClick={() => toggleBM('b2c')} />
          <ToggleChip label="C2C — Consumer to Consumer" active={data.businessModel.includes('c2c')} onClick={() => toggleBM('c2c')} />
        </div>
        <FieldError msg={errors.businessModel} />
      </div>
    </div>
  )
}

// Step 3: Legal & Address
function Step3({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <Label>GST Number <span style={{ color: C.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>(Optional)</span></Label>
        <TextInput
          value={data.gstNumber}
          onChange={v => update({ gstNumber: v.toUpperCase() })}
          placeholder="e.g. 29AABCU9603R1ZX"
          maxLength={15}
        />
        {data.gstNumber.length > 0 && data.gstNumber.length !== 15 && (
          <div style={{ fontFamily: C.font, fontSize: '0.78rem', color: C.textMuted, marginTop: '6px' }}>
            GST numbers are 15 characters — {15 - data.gstNumber.length} more needed
          </div>
        )}
        <FieldError msg={errors.gstNumber} />
      </div>

      <div>
        <Label required>Company Address</Label>
        <TextArea
          value={data.companyAddress}
          onChange={v => update({ companyAddress: v })}
          placeholder="Full address including street, city, state, PIN code"
          rows={4}
        />
        <FieldError msg={errors.companyAddress} />
      </div>
    </div>
  )
}

// Step 4: Office Setup
function Step4({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <Label required>Is this a Head Office or Branch?</Label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <RadioCard
            label="Head Office"
            sublabel="This is the primary / main office of your company"
            selected={data.officeType === 'head_office'}
            onClick={() => update({ officeType: 'head_office' })}
          />
          <RadioCard
            label="Branch"
            sublabel="This is one branch of a larger company setup"
            selected={data.officeType === 'branch'}
            onClick={() => update({ officeType: 'branch' })}
          />
        </div>
        <FieldError msg={errors.officeType} />
      </div>

      <div>
        <Label>Number of Branches</Label>
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '10px' }}>
          Total branches your company operates (enter 0 if none)
        </div>
        <TextInput
          value={data.numberOfBranches}
          onChange={v => { if (/^\d*$/.test(v)) update({ numberOfBranches: v }) }}
          placeholder="0"
          style={{ maxWidth: '160px' }}
        />
        <FieldError msg={errors.numberOfBranches} />
      </div>
    </div>
  )
}

// Step 5: Cloud Sharing
function Step5({ data, update }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <InfoBanner type="info">
        Cloud sharing lets branch offices sync billing data in real-time with the Head Office. This is an admin-provisioned premium feature — you'll need an access key from the developer.
      </InfoBanner>

      <div>
        <Label required>Enable Cloud Sharing with Branches?</Label>
        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
          <RadioCard
            label="Yes, enable cloud sharing"
            sublabel="Requires a developer-issued access key"
            selected={data.cloudSharing === true}
            onClick={() => update({ cloudSharing: true })}
          />
          <RadioCard
            label="No, work offline only"
            sublabel="All data stays on this device — you can enable this later from Settings"
            selected={data.cloudSharing === false}
            onClick={() => update({ cloudSharing: false })}
          />
        </div>
      </div>

      {data.cloudSharing === true && (
        <InfoBanner type="warning">
          <strong>Cloud Sharing Selected</strong>
          <br />
          To activate cloud sync, you'll need to request an access key from the cQikly developer. Once you have your key, enter it from <strong>Settings → Cloud Sync</strong> after completing setup.
          <br /><br />
          <span style={{ opacity: 0.8 }}>You can continue onboarding now — cloud sync can be configured at any time.</span>
        </InfoBanner>
      )}

      {data.cloudSharing === false && (
        <InfoBanner type="success">
          Offline mode — your data stays 100% local. Cloud sync can be enabled anytime from Settings if you change your mind later.
        </InfoBanner>
      )}
    </div>
  )
}

// Step 6: Contact Info
function Step6({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <Label required>Phone Number</Label>
        <TextInput
          value={data.contactPhone}
          onChange={v => update({ contactPhone: v })}
          placeholder="e.g. +91 98765 43210"
          maxLength={20}
        />
        <FieldError msg={errors.contactPhone} />
      </div>

      <div>
        <Label>Email Address <span style={{ color: C.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>(Optional)</span></Label>
        <TextInput
          value={data.contactEmail}
          onChange={v => update({ contactEmail: v })}
          placeholder="e.g. info@yourfirm.com"
          maxLength={100}
        />
        <FieldError msg={errors.contactEmail} />
      </div>

      <div>
        <Label>Website <span style={{ color: C.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>(Optional)</span></Label>
        <TextInput
          value={data.contactWebsite}
          onChange={v => update({ contactWebsite: v })}
          placeholder="e.g. www.yourfirm.com"
          maxLength={100}
        />
      </div>
    </div>
  )
}

// Step 7: Company Logo
function Step7({ data, update }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      update({ companyLogoPath: file.name, companyLogoDataUrl: e.target?.result as string })
    }
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <InfoBanner type="info">
        Your company logo appears on bills and PDFs. This step is optional — you can add or change your logo anytime from Settings.
      </InfoBanner>

      <div>
        <Label>Company Logo <span style={{ color: C.textMuted, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>(Optional)</span></Label>

        {data.companyLogoDataUrl ? (
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '4px' }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '12px',
              border: `1.5px solid ${C.border}`, overflow: 'hidden', flexShrink: 0,
              background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={data.companyLogoDataUrl} alt="Logo preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div>
              <div style={{ fontFamily: C.font, fontSize: '0.88rem', color: C.textPrimary, marginBottom: '6px' }}>{data.companyLogoPath}</div>
              <button
                type="button"
                onClick={() => update({ companyLogoPath: '', companyLogoDataUrl: '' })}
                style={{
                  fontFamily: C.font, fontSize: '0.8rem', color: '#fca5a5',
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', outline: 'none',
                }}
              >
                Remove logo
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              marginTop: '4px', borderRadius: '12px', padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              border: `1.5px dashed ${dragOver ? C.accent : C.border}`,
              background: dragOver ? C.accentSoft : C.chipBg,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🖼️</div>
            <div style={{ fontFamily: C.font, fontSize: '0.9rem', color: C.textSecond, marginBottom: '6px' }}>
              Click to browse or drag & drop your logo here
            </div>
            <div style={{ fontFamily: C.font, fontSize: '0.78rem', color: C.textMuted }}>
              PNG, JPG, SVG — recommended size: 200×200px or larger
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
    </div>
  )
}

// Step 8: Financial Year & Billing Prefs
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Step8({ data, update, errors }: { data: OnboardingData; update: (patch: Partial<OnboardingData>) => void; errors: Record<string, string> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <Label required>Financial Year Start Month</Label>
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '10px' }}>
          April is the Indian standard (FY Apr–Mar). Change only if your company uses a different cycle.
        </div>
        <SelectInput value={data.financialYearStartMonth} onChange={v => update({ financialYearStartMonth: v })}>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </SelectInput>
      </div>

      <div>
        <Label required>Bill Number Reset Cycle</Label>
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '12px' }}>
          When should the bill counter reset back to 1?
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <ToggleChip label="Yearly" active={data.billResetCycle === 'yearly'} onClick={() => update({ billResetCycle: 'yearly' })} />
          <ToggleChip label="Monthly" active={data.billResetCycle === 'monthly'} onClick={() => update({ billResetCycle: 'monthly' })} />
          <ToggleChip label="Never Reset" active={data.billResetCycle === 'never'} onClick={() => update({ billResetCycle: 'never' })} />
        </div>
        <FieldError msg={errors.billResetCycle} />
      </div>

      <div>
        <Label required>Starting Bill Number</Label>
        <div style={{ color: C.textMuted, fontSize: '0.8rem', fontFamily: C.font, marginBottom: '10px' }}>
          If you're migrating from another system, enter your current bill number here so the sequence continues. For new businesses, leave as 1.
        </div>
        <TextInput
          value={data.startingBillNumber}
          onChange={v => { if (/^\d*$/.test(v)) update({ startingBillNumber: v }) }}
          placeholder="1"
          style={{ maxWidth: '180px' }}
        />
        <div style={{ fontFamily: C.font, fontSize: '0.78rem', color: C.textMuted, marginTop: '8px' }}>
          ⚠️ This one-time setting is used only for the first run. Future year resets always restart from 1 regardless of this number.
        </div>
        <FieldError msg={errors.startingBillNumber} />
      </div>
    </div>
  )
}

// Step 9: Confirmation screen
function Step9({ data, onConfirm }: { data: OnboardingData; onConfirm: () => void }) {
  const nobLabels = { wholesale: 'Wholesale', retail: 'Retail', production: 'Production / Manufacturing' }
  const bmLabels  = { b2b: 'Business to Business (B2B)', b2c: 'Business to Consumer (B2C)', c2c: 'Consumer to Consumer (C2C)' }

  function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: `1px solid rgba(139,92,246,0.1)` }}>
        <div style={{ fontFamily: C.font, fontSize: '0.8rem', color: C.textMuted, width: '180px', flexShrink: 0, paddingTop: '2px' }}>{label}</div>
        <div style={{ fontFamily: C.font, fontSize: '0.88rem', color: C.textPrimary, flex: 1, lineHeight: 1.5 }}>{value || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>—</span>}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <InfoBanner type="success">
        Everything looks good! Review your details below, then click <strong>Confirm & Start</strong> to complete setup and enter cQikly.
      </InfoBanner>

      <div style={{ background: 'rgba(22,10,55,0.6)', borderRadius: '12px', padding: '4px 20px', border: `1px solid ${C.border}` }}>
        <Row label="Firm Name" value={data.firmName} />
        <Row label="Nature of Firm" value={data.natureOfFirm === 'product' ? 'Product-Based' : 'Service-Based'} />
        {data.natureOfFirm === 'product' && (
          <Row label="Nature of Business" value={data.natureOfBusiness.map(k => nobLabels[k]).join(', ')} />
        )}
        <Row label="Business Model" value={data.businessModel.map(k => bmLabels[k]).join(', ')} />
        <Row label="GST Number" value={data.gstNumber || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Not provided</span>} />
        <Row label="Company Address" value={<span style={{ whiteSpace: 'pre-line' }}>{data.companyAddress}</span>} />
        <Row label="Office Type" value={data.officeType === 'head_office' ? 'Head Office' : 'Branch'} />
        <Row label="Number of Branches" value={data.numberOfBranches || '0'} />
        <Row label="Cloud Sharing" value={data.cloudSharing === true ? 'Enabled (key required from developer)' : 'Disabled — offline only'} />
        <Row label="Phone" value={data.contactPhone} />
        <Row label="Email" value={data.contactEmail || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Not provided</span>} />
        <Row label="Website" value={data.contactWebsite || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Not provided</span>} />
        <Row label="Company Logo" value={
          data.companyLogoDataUrl
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={data.companyLogoDataUrl} alt="logo" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', border: `1px solid ${C.border}` }} />
                {data.companyLogoPath}
              </span>
            : <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Not provided</span>
        } />
        <Row label="Financial Year Start" value={data.financialYearStartMonth} />
        <Row label="Bill Reset Cycle" value={{ yearly: 'Yearly', monthly: 'Monthly', never: 'Never' }[data.billResetCycle as string] || '—'} />
        <Row label="Starting Bill Number" value={`#${data.startingBillNumber}`} />
      </div>

      <button
        type="button"
        onClick={onConfirm}
        style={{
          fontFamily: C.font, fontSize: '1rem', fontWeight: 700,
          background: 'linear-gradient(135deg, #7c3aed, #6d28d9, #5b21b6)',
          color: '#fff', border: 'none', borderRadius: '12px',
          padding: '16px 40px', cursor: 'pointer', outline: 'none',
          boxShadow: '0 0 32px rgba(124,58,237,0.5), 0 8px 24px rgba(0,0,0,0.4)',
          letterSpacing: '0.06em', marginTop: '8px', transition: 'transform 0.15s, box-shadow 0.15s',
          width: '100%',
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.02)'; (e.target as HTMLElement).style.boxShadow = '0 0 48px rgba(124,58,237,0.65), 0 8px 24px rgba(0,0,0,0.5)' }}
        onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; (e.target as HTMLElement).style.boxShadow = '0 0 32px rgba(124,58,237,0.5), 0 8px 24px rgba(0,0,0,0.4)' }}
      >
        ✨ Confirm & Start cQikly
      </button>
    </div>
  )
}

// ─── Step config ──────────────────────────────────────────────────────────────

interface StepConfig {
  id: number
  title: string
  subtitle: string
  icon: string
  validate: (data: OnboardingData) => Record<string, string>
}

const STEPS: StepConfig[] = [
  {
    id: 1, title: 'Firm Identity', icon: '🏢',
    subtitle: 'What is your firm called, and what do you do?',
    validate: d => {
      const e: Record<string, string> = {}
      if (!d.firmName.trim()) e.firmName = 'Firm name is required'
      if (!d.natureOfFirm) e.natureOfFirm = 'Please select the nature of your firm'
      return e
    },
  },
  {
    id: 2, title: 'Business Profile', icon: '📊',
    subtitle: 'How do you operate and who are your customers?',
    validate: d => {
      const e: Record<string, string> = {}
      if (d.natureOfFirm === 'product' && d.natureOfBusiness.length === 0)
        e.natureOfBusiness = 'Please select at least one mode of business'
      if (d.businessModel.length === 0)
        e.businessModel = 'Please select at least one business model'
      return e
    },
  },
  {
    id: 3, title: 'Legal & Address', icon: '📍',
    subtitle: 'Your GST number and registered company address',
    validate: d => {
      const e: Record<string, string> = {}
      if (!d.companyAddress.trim()) e.companyAddress = 'Company address is required'
      if (d.gstNumber && d.gstNumber.length !== 15)
        e.gstNumber = 'GST numbers must be exactly 15 characters'
      return e
    },
  },
  {
    id: 4, title: 'Office Setup', icon: '🏗️',
    subtitle: 'Is this your head office or a branch?',
    validate: d => {
      const e: Record<string, string> = {}
      if (!d.officeType) e.officeType = 'Please select Head Office or Branch'
      return e
    },
  },
  {
    id: 5, title: 'Cloud Sharing', icon: '☁️',
    subtitle: 'Sync data across branches via the cloud',
    validate: d => {
      const e: Record<string, string> = {}
      if (d.cloudSharing === null) e.cloudSharing = 'Please select an option'
      return e
    },
  },
  {
    id: 6, title: 'Contact Info', icon: '📞',
    subtitle: 'Your firm\'s contact details for bills and records',
    validate: d => {
      const e: Record<string, string> = {}
      if (!d.contactPhone.trim()) e.contactPhone = 'Phone number is required'
      if (d.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail))
        e.contactEmail = 'Please enter a valid email address'
      return e
    },
  },
  {
    id: 7, title: 'Company Logo', icon: '🖼️',
    subtitle: 'Add your logo to bills and printed documents (optional)',
    validate: () => ({}),
  },
  {
    id: 8, title: 'Billing Preferences', icon: '🧾',
    subtitle: 'Financial year and bill numbering configuration',
    validate: d => {
      const e: Record<string, string> = {}
      if (!d.billResetCycle) e.billResetCycle = 'Please select a reset cycle'
      if (!d.startingBillNumber || Number(d.startingBillNumber) < 1)
        e.startingBillNumber = 'Starting bill number must be at least 1'
      return e
    },
  },
  {
    id: 9, title: 'Confirm & Start', icon: '✅',
    subtitle: 'Review your details and complete setup',
    validate: () => ({}),
  },
]

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = ((current - 1) / (total - 1)) * 100
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontFamily: C.font, fontSize: '0.75rem', color: C.textMuted }}>
          Step {current} of {total}
        </div>
        <div style={{ fontFamily: C.font, fontSize: '0.75rem', color: C.textMuted }}>
          {Math.round(pct)}% complete
        </div>
      </div>
      <div style={{ height: '4px', background: 'rgba(139,92,246,0.15)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: '4px', width: `${pct}%`,
          background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '0 0 8px rgba(167,139,250,0.5)',
        }} />
      </div>
      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', position: 'relative' }}>
        {STEPS.map((s, i) => {
          const state = i + 1 < current ? 'done' : i + 1 === current ? 'active' : 'pending'
          return (
            <div key={s.id} title={s.title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: state === 'active' ? '28px' : '20px',
                height: state === 'active' ? '28px' : '20px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: state === 'active' ? '0.75rem' : '0.62rem',
                background: state === 'done' ? '#7c3aed' : state === 'active' ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : 'rgba(139,92,246,0.1)',
                border: `2px solid ${state === 'pending' ? 'rgba(139,92,246,0.2)' : '#7c3aed'}`,
                color: state === 'pending' ? C.textMuted : '#fff',
                transition: 'all 0.3s',
                boxShadow: state === 'active' ? '0 0 12px rgba(139,92,246,0.6)' : 'none',
              }}>
                {state === 'done' ? '✓' : s.icon}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onClose, onComplete, saveError, onClearSaveError }: OnboardingWizardProps): React.ReactElement {
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA)
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [animDir, setAnimDir] = useState<'fwd' | 'bwd'>('fwd')
  const [animating, setAnimating] = useState(false)

  const stepConfig = useMemo(() => STEPS[currentStep - 1], [currentStep])
  const totalSteps = STEPS.length

  const update = useCallback((patch: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...patch }))
    // Clear related errors on change
    const keys = Object.keys(patch)
    setErrors(prev => {
      const next = { ...prev }
      keys.forEach(k => delete next[k])
      return next
    })
  }, [])

  function navigate(direction: 'next' | 'back') {
    if (animating) return

    if (direction === 'next') {
      const validationErrors = stepConfig.validate(data)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return
      }
      if (currentStep === totalSteps) return
      setAnimDir('fwd')
    } else {
      if (currentStep === 1) { setShowExitConfirm(true); return }
      setAnimDir('bwd')
    }

    setAnimating(true)
    setTimeout(() => {
      setCurrentStep(prev => direction === 'next' ? prev + 1 : prev - 1)
      setErrors({})
      setAnimating(false)
    }, 180)
  }

  function handleConfirm() {
    onComplete(data)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(2,0,10,0.88)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
        onClick={() => setShowExitConfirm(true)}
      >
        {/* Wizard card */}
        <div
          style={{
            position: 'relative',
            background: C.bgStep, border: `1px solid ${C.border}`,
            borderRadius: '20px', width: '100%', maxWidth: '620px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: C.shadow,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ padding: '28px 32px 20px', borderBottom: `1px solid rgba(139,92,246,0.12)`, flexShrink: 0 }}>
            {/* Top row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.3rem', flexShrink: 0,
                  boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                }}>
                  {stepConfig.icon}
                </div>
                <div>
                  <div style={{ fontFamily: C.font, fontSize: '0.7rem', fontWeight: 600, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Setup — Step {currentStep} of {totalSteps}
                  </div>
                  <div style={{ fontFamily: C.font, fontSize: '1.15rem', fontWeight: 800, color: C.textPrimary }}>
                    {stepConfig.title}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExitConfirm(true)}
                title="Exit setup"
                style={{
                  fontFamily: C.font, fontSize: '0.85rem', color: C.textMuted,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', outline: 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = C.textPrimary }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = C.textMuted }}
              >
                ✕
              </button>
            </div>

            <ProgressBar current={currentStep} total={totalSteps} />

            <div style={{ fontFamily: C.font, fontSize: '0.88rem', color: C.textSecond }}>
              {stepConfig.subtitle}
            </div>
          </div>

          {/* Save error banner (Phase 2b) */}
          {saveError && (
            <div style={{
              margin: '0 0 -8px 0', padding: '12px 18px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
              borderRadius: '10px', fontFamily: C.font, fontSize: '0.84rem', color: '#fca5a5',
              display: 'flex', gap: '10px', alignItems: 'flex-start', lineHeight: 1.5,
            }}>
              <span style={{ flexShrink: 0 }}>⚠️</span>
              <div>
                <strong>Setup save failed:</strong> {saveError}
                <br />
                <span style={{ opacity: 0.8 }}>Your data is preserved. Please try confirming again.</span>
              </div>
              {onClearSaveError && (
                <button
                  type="button"
                  onClick={onClearSaveError}
                  style={{
                    marginLeft: 'auto', flexShrink: 0, background: 'none', border: 'none',
                    color: '#fca5a5', cursor: 'pointer', fontSize: '0.9rem', padding: '0 4px',
                  }}
                >✕</button>
              )}
            </div>
          )}

          {/* Body */}
          <div
            style={{
              flex: 1, overflowY: 'auto', padding: '28px 32px',
              opacity: animating ? 0 : 1,
              transform: animating ? (animDir === 'fwd' ? 'translateX(24px)' : 'translateX(-24px)') : 'translateX(0)',
              transition: 'opacity 0.18s, transform 0.18s',
            }}
          >
            {currentStep === 1 && <Step1 data={data} update={update} errors={errors} />}
            {currentStep === 2 && <Step2 data={data} update={update} errors={errors} />}
            {currentStep === 3 && <Step3 data={data} update={update} errors={errors} />}
            {currentStep === 4 && <Step4 data={data} update={update} errors={errors} />}
            {currentStep === 5 && <Step5 data={data} update={update} errors={errors} />}
            {currentStep === 6 && <Step6 data={data} update={update} errors={errors} />}
            {currentStep === 7 && <Step7 data={data} update={update} errors={errors} />}
            {currentStep === 8 && <Step8 data={data} update={update} errors={errors} />}
            {currentStep === 9 && <Step9 data={data} onConfirm={handleConfirm} />}
          </div>

          {/* Footer nav (hidden on confirmation step — that step has its own CTA) */}
          {currentStep < totalSteps && (
            <div style={{
              padding: '18px 32px', borderTop: `1px solid rgba(139,92,246,0.12)`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
              background: 'rgba(8,3,22,0.5)',
            }}>
              <button
                type="button"
                onClick={() => navigate('back')}
                style={{
                  fontFamily: C.font, fontSize: '0.88rem', fontWeight: 600,
                  color: C.textSecond, background: 'rgba(139,92,246,0.08)',
                  border: `1px solid rgba(139,92,246,0.2)`, borderRadius: '10px',
                  padding: '11px 24px', cursor: 'pointer', outline: 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(139,92,246,0.18)' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(139,92,246,0.08)' }}
              >
                ← {currentStep === 1 ? 'Back to Landing' : 'Back'}
              </button>

              <div style={{ fontFamily: C.font, fontSize: '0.78rem', color: C.textMuted }}>
                {Object.keys(errors).length > 0 && (
                  <span style={{ color: C.errText }}>⚠ Please fix the errors above</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('next')}
                style={{
                  fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  padding: '11px 28px', cursor: 'pointer', outline: 'none',
                  boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.03)' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
              >
                {currentStep === totalSteps - 1 ? 'Review Setup →' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Exit confirmation dialog */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            style={{
              background: 'rgba(14,6,38,0.99)', border: `1px solid rgba(239,68,68,0.3)`,
              borderRadius: '16px', padding: '32px 36px', maxWidth: '380px', width: '90vw',
              textAlign: 'center', boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: C.font, fontSize: '1.05rem', fontWeight: 700, color: C.textPrimary, marginBottom: '10px' }}>
              Exit Setup?
            </div>
            <div style={{ fontFamily: C.font, fontSize: '0.87rem', color: C.textSecond, lineHeight: 1.6, marginBottom: '24px' }}>
              Your progress will be lost. You'll be returned to the landing screen.
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                style={{
                  fontFamily: C.font, fontSize: '0.88rem', fontWeight: 600,
                  color: C.textSecond, background: 'rgba(255,255,255,0.06)',
                  border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '8px',
                  padding: '10px 22px', cursor: 'pointer', outline: 'none',
                }}
              >
                Keep Setup
              </button>
              <button
                type="button"
                onClick={() => { setShowExitConfirm(false); onClose() }}
                style={{
                  fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
                  background: 'rgba(239,68,68,0.2)', color: '#fca5a5',
                  border: `1px solid rgba(239,68,68,0.4)`, borderRadius: '8px',
                  padding: '10px 22px', cursor: 'pointer', outline: 'none',
                }}
              >
                Exit Setup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
