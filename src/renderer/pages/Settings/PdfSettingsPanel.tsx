/**
 * cQikly — PDF Settings Panel
 * Phase 6b-A-ii: T&C, Bank Details, UPI ID, Format Memory
 * Phase 11a-ii: Full rebuild — adds default format selector, filename pattern,
 *               save location, PDF quality, watermark/DRAFT stamp toggle
 *
 * Layout: one flat panel with labelled rows then a per-format accordion.
 * All changes instant — no save button. Reads/writes via pdfSettings.service.
 */

import React, { useState, useEffect, useCallback } from 'react'
import type { PdfFormat } from '../../services/pdf.service'
import {
  getTcSettings, saveTcSettings,
  getBankSettings, saveBankSettings,
  getUpiId, saveUpiId,
  getDefaultPdfFormat, saveDefaultPdfFormat,
  getFilenamePattern, saveFilenamePattern, DEFAULT_FILENAME_PATTERN,
  getSaveLocation, saveSaveLocation,
  getPdfQuality, savePdfQuality,
  getWatermarkEnabled, saveWatermarkEnabled,
  type PdfQuality,
} from '../../services/pdfSettings.service'

// ─── Style tokens ──────────────────────────────────────────────────────────────

const C = {
  font:          '"Inter", system-ui, sans-serif',
  accent:        'var(--cq-accent)',
  textPrimary:   'var(--cq-text-primary)',
  textSecond:    'rgba(196,181,253,0.72)',
  textMuted:     'rgba(196,181,253,0.42)',
  border:        'var(--cq-border)',
  green:         '#4ade80',
  greenBg:       'rgba(74,222,128,0.12)',
  greenBorder:   'rgba(74,222,128,0.35)',
}

const ALL_FORMATS: PdfFormat[] = ['simplified', 'professional', 'detailed-professional']

const FORMAT_LABELS: Record<PdfFormat, string> = {
  'simplified':            '📄 Simplified',
  'professional':          '🏢 Professional',
  'detailed-professional': '📋 Detailed Professional',
}

const FORMAT_DESCS: Record<PdfFormat, string> = {
  'simplified':            'No company info — header is Customer Name + Contact only.',
  'professional':          'Full company header, logo, address, GST number, totals breakdown.',
  'detailed-professional': 'Everything in Professional + per-item GST breakdown, signature block.',
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      style={{
        width: 40, height: 22, borderRadius: 11,
        background: enabled ? 'var(--cq-accent)' : 'rgba(255,255,255,0.12)',
        border: 'none', padding: 2, cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0, outline: 'none',
      }}
      title={enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transform: enabled ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }} />
    </button>
  )
}

function SettingRow({
  label, desc, children,
}: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(139,92,246,0.12)', gap: 20 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>{label}</div>
        {desc && <div style={{ fontSize: '0.78rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  )
}

// ─── Filename Pattern Section ─────────────────────────────────────────────────

const TOKENS = ['{PartyName}', '{Date}', '{PONo}', '{Format}']

function FilenamePatternSection() {
  const [pattern, setPattern] = useState(() => getFilenamePattern())

  const handleChange = (v: string) => {
    setPattern(v)
    saveFilenamePattern(v)
  }

  const insertToken = (token: string) => {
    handleChange(pattern + token)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={pattern}
          onChange={e => handleChange(e.target.value)}
          placeholder={DEFAULT_FILENAME_PATTERN}
          style={{
            flex: 1, fontFamily: C.font, fontSize: '0.83rem', color: C.textPrimary,
            background: 'rgba(255,255,255,0.05)', border: '1px solid var(--cq-border)',
            borderRadius: 8, padding: '8px 11px', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => handleChange(DEFAULT_FILENAME_PATTERN)}
          style={{
            fontFamily: C.font, fontSize: '0.72rem', fontWeight: 600,
            color: C.textMuted, background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--cq-border)', borderRadius: 6, padding: '7px 10px',
            cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
          }}
          title="Reset to default pattern"
        >
          Reset
        </button>
      </div>
      <div style={{ fontSize: '0.72rem', color: C.textMuted, marginBottom: 6, lineHeight: 1.6 }}>
        Available tokens — click to insert:
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TOKENS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => insertToken(t)}
            style={{
              fontFamily: '"Fira Code", monospace', fontSize: '0.72rem', fontWeight: 600,
              color: 'var(--cq-accent)', background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)', borderRadius: 5,
              padding: '3px 9px', cursor: 'pointer', outline: 'none',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.22)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)' }}
          >
            {t}
          </button>
        ))}
      </div>
      {pattern && (
        <div style={{ marginTop: 8, fontSize: '0.73rem', color: C.textSecond, lineHeight: 1.5 }}>
          Preview: <span style={{ color: C.textPrimary, fontFamily: '"Fira Code", monospace' }}>
            {pattern
              .replace(/{PartyName}/g, 'AcmeCorp')
              .replace(/{Date}/g, '2025-04-01')
              .replace(/{PONo}/g, 'INV-042')
              .replace(/{Format}/g, 'professional')}.pdf
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Save Location Section ────────────────────────────────────────────────────

function SaveLocationSection() {
  const [location, setLocation] = useState(() => getSaveLocation())

  const handleChange = (v: string) => {
    setLocation(v)
    saveSaveLocation(v)
  }

  const handleBrowse = async () => {
    try {
      const ipc = (window as unknown as { cqikly?: { app?: { selectFolder?: () => Promise<string | null> } } }).cqikly
      if (ipc?.app?.selectFolder) {
        const result = await ipc.app.selectFolder()
        if (result) handleChange(result)
      } else {
        // Dev-mode fallback: prompt
        const path = window.prompt('Enter folder path for PDF saves:', location)
        if (path !== null) handleChange(path)
      }
    } catch { /* ignore */ }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="text"
        value={location}
        onChange={e => handleChange(e.target.value)}
        placeholder="Leave blank to always prompt save dialog"
        style={{
          flex: 1, fontFamily: C.font, fontSize: '0.83rem', color: C.textPrimary,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--cq-border)',
          borderRadius: 8, padding: '8px 11px', outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={handleBrowse}
        style={{
          fontFamily: C.font, fontSize: '0.78rem', fontWeight: 600,
          color: C.textPrimary, background: 'rgba(139,92,246,0.1)',
          border: '1px solid rgba(139,92,246,0.3)', borderRadius: 7,
          padding: '7px 12px', cursor: 'pointer', outline: 'none', whiteSpace: 'nowrap',
        }}
      >
        📂 Browse
      </button>
      {location && (
        <button
          type="button"
          onClick={() => handleChange('')}
          style={{
            fontFamily: C.font, fontSize: '0.72rem', color: C.textMuted,
            background: 'transparent', border: '1px solid var(--cq-border)',
            borderRadius: 6, padding: '7px 10px', cursor: 'pointer', outline: 'none',
          }}
        >
          Clear
        </button>
      )}
    </div>
  )
}

// ─── Per-Format T&C / Bank accordion ─────────────────────────────────────────

function TcSection({ format }: { format: PdfFormat }) {
  const [tc, setTc] = useState(() => getTcSettings(format))
  const update = useCallback((patch: Partial<typeof tc>) => {
    const next = { ...tc, ...patch }
    setTc(next)
    saveTcSettings(format, next)
  }, [tc, format])

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textPrimary }}>
          Terms &amp; Conditions
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: C.textSecond }}>{tc.enabled ? 'Shown in PDF' : 'Hidden'}</span>
          <Toggle enabled={tc.enabled} onChange={v => update({ enabled: v })} />
        </div>
      </div>
      <textarea
        value={tc.text}
        onChange={e => update({ text: e.target.value })}
        placeholder={'Enter terms & conditions text…\ne.g. Goods once sold will not be taken back.'}
        rows={4}
        style={{
          width: '100%', resize: 'vertical', fontFamily: C.font, fontSize: '0.78rem',
          color: C.textPrimary, background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
          lineHeight: 1.6, outline: 'none', opacity: tc.enabled ? 1 : 0.5,
          transition: 'opacity 0.15s', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function BankSection({ format }: { format: PdfFormat }) {
  const [bank, setBank] = useState(() => getBankSettings(format))
  const update = useCallback((patch: Partial<typeof bank>) => {
    const next = { ...bank, ...patch }
    setBank(next)
    saveBankSettings(format, next)
  }, [bank, format])

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textPrimary }}>
          Bank Details
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: C.textSecond }}>{bank.enabled ? 'Shown in PDF' : 'Hidden'}</span>
          <Toggle enabled={bank.enabled} onChange={v => update({ enabled: v })} />
        </div>
      </div>
      <textarea
        value={bank.text}
        onChange={e => update({ text: e.target.value })}
        placeholder={'Account Number: XXXXXXXX\nIFSC: BANKXXXXXXX\nBank: Bank Name, Branch Name'}
        rows={3}
        style={{
          width: '100%', resize: 'vertical', fontFamily: C.font, fontSize: '0.78rem',
          color: C.textPrimary, background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
          lineHeight: 1.6, outline: 'none', opacity: bank.enabled ? 1 : 0.5,
          transition: 'opacity 0.15s', boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

function FormatAccordion({ format }: { format: PdfFormat }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 16px', background: open ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.03)',
          border: 'none', cursor: 'pointer', outline: 'none', transition: 'background 0.15s',
        }}
      >
        <span style={{ fontFamily: C.font, fontSize: '0.88rem', fontWeight: 600, color: C.textPrimary }}>
          {FORMAT_LABELS[format]}
        </span>
        <span style={{ fontSize: '0.8rem', color: C.textMuted, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
      </button>
      {open && (
        <div style={{ padding: '14px 16px', borderTop: `1px solid ${C.border}` }}>
          <TcSection format={format} />
          <BankSection format={format} />
        </div>
      )}
    </div>
  )
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export default function PdfSettingsPanel(): React.ReactElement {
  // Local reactive state for the new 11a-ii fields
  const [defaultFormat,    setDefaultFormat]    = useState<PdfFormat>(() => getDefaultPdfFormat())
  const [quality,          setQuality]          = useState<PdfQuality>(() => getPdfQuality())
  const [watermark,        setWatermark]        = useState(() => getWatermarkEnabled())
  const [upiId,            setUpiId]            = useState(() => getUpiId())

  // Force re-read on mount
  useEffect(() => {
    setDefaultFormat(getDefaultPdfFormat())
    setQuality(getPdfQuality())
    setWatermark(getWatermarkEnabled())
    setUpiId(getUpiId())
  }, [])

  const handleDefaultFormat = (fmt: PdfFormat) => {
    setDefaultFormat(fmt)
    saveDefaultPdfFormat(fmt)
  }
  const handleQuality = (q: PdfQuality) => {
    setQuality(q)
    savePdfQuality(q)
  }
  const handleWatermark = (v: boolean) => {
    setWatermark(v)
    saveWatermarkEnabled(v)
  }
  const handleUpi = (v: string) => {
    setUpiId(v)
    saveUpiId(v)
  }

  return (
    <div style={{
      marginTop: 24, padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${C.border}`,
      borderRadius: 14, fontFamily: C.font,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        PDF Settings
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        PDF Generation &amp; Output
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 24, lineHeight: 1.6 }}>
        Configure how PDFs are generated, named, and saved. Footer content (T&amp;C, bank details, UPI QR)
        is configured per format in the accordion below.
      </div>

      {/* ── Default Format ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 6, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
        Default PDF Format
      </div>
      <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 12, lineHeight: 1.5 }}>
        Pre-selected format when generating a PDF from the quote page. Overrideable per bill.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 28 }}>
        {ALL_FORMATS.map(fmt => {
          const active = fmt === defaultFormat
          return (
            <button
              key={fmt}
              type="button"
              onClick={() => handleDefaultFormat(fmt)}
              style={{
                fontFamily: C.font, textAlign: 'left',
                background: active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
                border: active ? '2px solid var(--cq-accent)' : `1.5px solid ${C.border}`,
                borderRadius: 11, padding: '14px 16px', cursor: 'pointer', outline: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--cq-accent)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = C.border }}
            >
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
                {FORMAT_LABELS[fmt]}
              </div>
              <div style={{ fontSize: '0.74rem', color: C.textSecond, lineHeight: 1.5 }}>
                {FORMAT_DESCS[fmt]}
              </div>
              {active && (
                <div style={{ marginTop: 8, fontSize: '0.68rem', fontWeight: 700, color: 'var(--cq-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ✓ Default
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Filename Pattern ───────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 20, marginBottom: 20 }}>
        <div style={{ marginBottom: 4, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
          PDF Filename Pattern
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 10, lineHeight: 1.5 }}>
          Template for auto-naming saved PDFs. Use tokens below to insert dynamic values.
          The <code style={{ color: 'var(--cq-accent)', fontSize: '0.72rem' }}>.pdf</code> extension is added automatically.
        </div>
        <FilenamePatternSection />
      </div>

      {/* ── Save Location ──────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 20, marginBottom: 20 }}>
        <div style={{ marginBottom: 4, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
          PDF Save Location
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 10, lineHeight: 1.5 }}>
          Folder where PDFs are auto-saved. Leave empty to always show the OS save dialog.
        </div>
        <SaveLocationSection />
      </div>

      {/* ── Quality + Watermark ────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 20, marginBottom: 20 }}>
        <SettingRow
          label="PDF Quality"
          desc="Controls resolution and file size. 'Print' is recommended for sharing. 'Prepress' for high-fidelity print shops."
        >
          <select
            value={quality}
            onChange={e => handleQuality(e.target.value as PdfQuality)}
            style={{
              fontFamily: C.font, fontSize: '0.82rem', color: C.textPrimary,
              background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '7px 28px 7px 11px', outline: 'none', cursor: 'pointer',
              WebkitAppearance: 'none', appearance: 'none',
            }}
          >
            <option value="screen">Screen (smallest file)</option>
            <option value="print">Print (recommended)</option>
            <option value="prepress">Prepress (highest quality)</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Watermark / DRAFT Stamp"
          desc="Applies a 'DRAFT' watermark diagonal stamp to PDFs generated from unsaved bills. Saved bills are never watermarked."
        >
          <Toggle enabled={watermark} onChange={handleWatermark} />
        </SettingRow>
      </div>

      {/* ── UPI ID ─────────────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 20, marginBottom: 20,
      }}>
        <div style={{ marginBottom: 4, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
          UPI ID for QR Code
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 10, lineHeight: 1.5 }}>
          When generating a PDF or copying an image you will be prompted to include a UPI QR code.
          The QR encodes this ID + the grand total. Leave blank to disable the QR option entirely.
        </div>
        <input
          type="text"
          value={upiId}
          onChange={e => handleUpi(e.target.value)}
          placeholder="e.g. yourname@upi  or  9876543210@paytm"
          style={{
            width: '100%', maxWidth: 380, fontFamily: C.font, fontSize: '0.83rem',
            color: C.textPrimary, background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ── Per-Format Footer Content ──────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid rgba(139,92,246,0.12)', paddingTop: 20 }}>
        <div style={{ marginBottom: 4, fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary }}>
          Footer Content per Format
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.5 }}>
          Terms &amp; Conditions and Bank Details are configured independently per PDF format.
          Each can be toggled on/off per format.
        </div>
        {ALL_FORMATS.map(fmt => (
          <FormatAccordion key={fmt} format={fmt} />
        ))}
      </div>
    </div>
  )
}
