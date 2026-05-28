/**
 * cQikly — Settings Page
 * Shell: Phase 1b-B
 * Phase 2b:     Onboarding Re-run button wired
 * Phase 3b-ii:  Theme selector + Performance mode fully wired live
 * Phase 11a-i:  Company Profile editor + Bill Number Settings (full build)
 * Phase 11a-ii: PDF Settings full build + Print Settings + Appearance panel
 *               (with zoom slider) + Language selector
 * Phase 11b-i:  Dashboard Widget Toggles + Quote Page Settings + Security
 *
 * Layout: two-column — sticky left nav + scrollable right content.
 * All changes propagate instantly via event bus — zero restart.
 */

import React, { useState } from 'react'
import OnboardingPage from '../Onboarding'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useConfig } from '../../contexts/ConfigContext'
import type { PerformanceMode } from '../../contexts/PerformanceContext'

// Panel components
import CompanyProfilePanel    from './CompanyProfilePanel'
import BillNumberSettingsPanel from './BillNumberSettingsPanel'
import PdfSettingsPanel       from './PdfSettingsPanel'
import PrintSettingsPanel     from './PrintSettingsPanel'
import AppearancePanel        from './AppearancePanel'
import LanguagePanel          from './LanguagePanel'
import InventoryRateSourcePanel from './InventoryRateSourcePanel'
import BackupRestorePanel from './BackupRestorePanel'
import SavedListsPanel from './SavedListsPanel'
import CustomerSettingsPanel from './CustomerSettingsPanel'
import FeatureModuleTogglesPanel from './FeatureModuleTogglesPanel'
import AccessKeyPanel from './AccessKeyPanel'
import ConfigExportImportPanel from './ConfigExportImportPanel'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  errText:     '#fca5a5',
  errBg:       'rgba(239,68,68,0.12)',
  errBorder:   'rgba(239,68,68,0.4)',
}

// ─── Left-nav section registry ────────────────────────────────────────────────

const SECTIONS = [
  { id: 'company',     label: '🏢 Company Profile' },
  { id: 'billnumber',  label: '🔢 Bill Number' },
  { id: 'pdf',         label: '📄 PDF Settings' },
  { id: 'print',       label: '🖨️ Print Settings' },
  { id: 'appearance',  label: '🎨 Appearance' },
  { id: 'performance', label: '⚡ Performance' },
  { id: 'language',    label: '🌐 Language' },
  { id: 'inventory',   label: '📦 Inventory & Stock' },
  { id: 'quotepage',   label: '🧾 Quote Page' },
  { id: 'dashboard',   label: '📊 Dashboard Widgets' },
  { id: 'security',    label: '🔒 Security' },
  { id: 'backup',       label: '💾 Backup & Restore' },
  { id: 'savedlists',   label: '📋 Saved Lists' },
  { id: 'customersettings', label: '👤 Customer Settings' },
  { id: 'featuretoggles', label: '🧩 Feature Modules' },
  { id: 'accesskey',    label: '🔑 Access Key' },
  { id: 'configexportimport', label: '📤 Config Export/Import' },
]

// ─── Performance Panel (self-contained) ──────────────────────────────────────

const PERF_MODES: { id: PerformanceMode; icon: string; label: string; desc: string }[] = [
  { id: 'lite',     icon: '🔋', label: 'Lite',     desc: 'No Three.js, Framer Motion, or API polling. Best for low-end devices. Billing runs at full speed.' },
  { id: 'balanced', icon: '⚖️', label: 'Balanced', desc: 'Moderate animations + API refresh every 2 minutes. Default for most users.' },
  { id: 'ultra',    icon: '🚀', label: 'Ultra',    desc: 'Full Three.js particle scenes, Framer Motion, and 30-second API refresh. Best on powerful machines.' },
]

function PerformancePanel(): React.ReactElement {
  const { mode, setMode } = usePerformance()

  return (
    <div id="performance" style={{
      padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--cq-border)',
      borderRadius: 14, fontFamily: C.font, marginTop: 20,
    }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Performance
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        Performance Mode
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 18, lineHeight: 1.6 }}>
        Switches live — zero reload. Billing operations are never degraded regardless of mode.
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {PERF_MODES.map(pm => {
          const active = pm.id === mode
          return (
            <button
              key={pm.id}
              type="button"
              onClick={() => setMode(pm.id)}
              style={{
                flex: '1 1 180px', fontFamily: C.font, textAlign: 'left',
                background: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                border: active ? '2px solid var(--cq-accent)' : '1.5px solid var(--cq-border)',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer', outline: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--cq-accent)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--cq-border)' }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 7 }}>{pm.icon}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>{pm.label}</div>
              <div style={{ fontSize: '0.76rem', color: C.textSecond, lineHeight: 1.55 }}>{pm.desc}</div>
              {active && (
                <div style={{ marginTop: 10, fontSize: '0.68rem', fontWeight: 700, color: 'var(--cq-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ✓ Active
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage(): React.ReactElement {
  const [showRerun,        setShowRerun]        = useState(false)
  const [showRerunConfirm, setShowRerunConfirm] = useState(false)
  const [activeSection,    setActiveSection]    = useState<string>('company')

  const { config, updateConfig } = useConfig()

  // ── Re-run flow ───────────────────────────────────────────────────────────
  if (showRerun) {
    return (
      <OnboardingPage
        isRerun={true}
        onRerunComplete={() => setShowRerun(false)}
      />
    )
  }

  const handleRerunRequest = () => setShowRerunConfirm(true)

  // ── Smooth-scroll helper (used by nav clicks) ─────────────────────────────
  const scrollTo = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', height: '100%', overflow: 'hidden', fontFamily: C.font,
    }}>
      {/* ── Left nav ──────────────────────────────────────────────────────── */}
      <div style={{
        width: 210, flexShrink: 0, padding: '24px 12px',
        borderRight: '1px solid var(--cq-border)',
        overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{
          fontSize: '0.68rem', fontWeight: 700, color: C.textSecond,
          textTransform: 'uppercase', letterSpacing: '0.09em',
          marginBottom: 10, paddingLeft: 12,
        }}>
          Settings
        </div>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            style={{
              display: 'block', textAlign: 'left', width: '100%',
              padding: '8px 12px', borderRadius: 8, fontSize: '0.84rem',
              fontWeight: activeSection === s.id ? 700 : 500,
              color: activeSection === s.id ? 'var(--cq-accent)' : C.textSecond,
              background: activeSection === s.id ? 'rgba(139,92,246,0.12)' : 'transparent',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
            }}
            onMouseEnter={e => {
              if (activeSection !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
            }}
            onMouseLeave={e => {
              if (activeSection !== s.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '28px 36px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: '1.55rem', fontWeight: 900, color: C.textPrimary, margin: 0,
            letterSpacing: '-0.02em',
          }}>
            ⚙️ Settings
          </h1>
          <div style={{ fontSize: '0.86rem', color: C.textSecond, marginTop: 6 }}>
            All app configuration — changes propagate instantly with zero restart.
          </div>
        </div>

        {/* ── Company Profile ────────────────────────────────────────────── */}
        <div id="company" style={{ scrollMarginTop: 20 }}>
          <CompanyProfilePanel onRerunOnboarding={handleRerunRequest} />
        </div>

        {/* ── Bill Number Settings ───────────────────────────────────────── */}
        <div id="billnumber" style={{ scrollMarginTop: 20 }}>
          <BillNumberSettingsPanel />
        </div>

        {/* ── PDF Settings (Phase 11a-ii full build) ─────────────────────── */}
        <div id="pdf" style={{ scrollMarginTop: 20 }}>
          <PdfSettingsPanel />
        </div>

        {/* ── Print Settings (Phase 11a-ii) ──────────────────────────────── */}
        <div id="print" style={{ scrollMarginTop: 20 }}>
          <PrintSettingsPanel />
        </div>

        {/* ── Appearance & Theme (Phase 11a-ii) ─────────────────────────── */}
        <div id="appearance" style={{ scrollMarginTop: 20 }}>
          <AppearancePanel />
        </div>

        {/* ── Performance Mode ───────────────────────────────────────────── */}
        <div id="performance" style={{ scrollMarginTop: 20 }}>
          <PerformancePanel />
        </div>

        {/* ── Language (Phase 11a-ii) ────────────────────────────────────── */}
        <div id="language" style={{ scrollMarginTop: 20 }}>
          <LanguagePanel />
        </div>

        {/* ── Inventory Rate Source ──────────────────────────────────────── */}
        <div id="inventory" style={{ scrollMarginTop: 20, marginTop: 20 }}>
          <InventoryRateSourcePanel />
        </div>

        {/* ── Inventory Mode toggle ──────────────────────────────────────── */}
        <div style={{
          marginTop: 20, padding: '24px 32px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.22)', borderRadius: 14,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Quote Page — Inventory Mode
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div style={{ flex: 1, paddingRight: 20 }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>
                Inventory Autocomplete on Item Name
              </div>
              <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.55 }}>
                When enabled, typing in the Item Name cell shows a fuzzy autocomplete dropdown from your inventory.
                Press <strong style={{ color: C.textPrimary }}>Insert</strong> to accept — fills item name + rate.
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateConfig({ inventoryModeEnabled: !(config.inventoryModeEnabled === true) })}
              style={{
                fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700,
                padding: '8px 22px', borderRadius: 9, cursor: 'pointer', minWidth: 76,
                background: config.inventoryModeEnabled ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.06)',
                color: config.inventoryModeEnabled ? '#4ade80' : C.textSecond,
                border: `1.5px solid ${config.inventoryModeEnabled ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.12)'}`,
                transition: 'all 0.18s', outline: 'none',
              }}
            >
              {config.inventoryModeEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* ── Stock Tracking ──────────────────────────────────────────────── */}
        <div style={{
          marginTop: 20, padding: '24px 32px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(139,92,246,0.22)', borderRadius: 14,
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
            Inventory — Stock Tracking
          </div>
          {(
            [
              { key: 'stockQtyEnabled'   as const, label: 'Enable Stock Quantity Tracking',    desc: 'Shows Stock Qty, Min Stock, and Unit columns on the Inventory page. Items below threshold are flagged.' },
              { key: 'stockDeductOnSave' as const, label: 'Deduct Stock on Bill Save',          desc: "Automatically reduces each matched inventory item's Stock Qty by the billed quantity when a bill is saved. Requires Stock Tracking to be ON." },
            ]
          ).map(({ key, label, desc }) => {
            const isOn     = config[key] === true
            const disabled = key === 'stockDeductOnSave' && !config.stockQtyEnabled
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(139,92,246,0.12)', opacity: disabled ? 0.45 : 1 }}>
                <div style={{ flex: 1, paddingRight: 20 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary }}>{label}</div>
                  <div style={{ fontSize: '0.8rem', color: C.textSecond, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
                </div>
                <button type="button" disabled={disabled} onClick={() => !disabled && updateConfig({ [key]: !isOn })} style={{ fontFamily: C.font, fontSize: '0.85rem', fontWeight: 700, padding: '8px 22px', borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 76, background: isOn ? 'rgba(74,222,128,0.14)' : 'rgba(255,255,255,0.06)', color: isOn ? '#4ade80' : C.textSecond, border: `1.5px solid ${isOn ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.12)'}`, transition: 'all 0.18s', outline: 'none' }}>
                  {isOn ? 'ON' : 'OFF'}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Backup & Restore (Phase 11b-ii) ───────────────────────────── */}
        <BackupRestorePanel />

        {/* ── Saved Lists (Phase 11b-ii) ────────────────────────────────── */}
        <SavedListsPanel />

        {/* ── Customer Settings (Phase 11b-ii) ──────────────────────────── */}
        <CustomerSettingsPanel />

        {/* ── Feature Module Toggles (Phase 11b-ii) ─────────────────────── */}
        <FeatureModuleTogglesPanel />

        {/* ── Access Key (Phase 11b-ii) ──────────────────────────────────── */}
        <AccessKeyPanel />

        {/* ── Config Export / Import (Phase 11b-ii) ─────────────────────── */}
        <ConfigExportImportPanel />

      </div>

      {/* ── Rerun confirmation modal ───────────────────────────────────────── */}
      {showRerunConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 5000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowRerunConfirm(false)}
        >
          <div
            style={{ background: 'rgba(14,6,38,0.99)', border: `1px solid ${C.errBorder}`, borderRadius: 16, padding: '36px 40px', maxWidth: 400, width: '90vw', textAlign: 'center', boxShadow: '0 24px 48px rgba(0,0,0,0.7)', fontFamily: C.font }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: 14 }}>⚙️</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: C.textPrimary, marginBottom: 12 }}>
              Re-run Company Setup?
            </div>
            <div style={{ fontSize: '0.87rem', color: C.textSecond, lineHeight: 1.7, marginBottom: 28 }}>
              This will open the onboarding wizard and let you update your company profile.<br /><br />
              <span style={{ color: C.errText, fontWeight: 600 }}>Your billing history, customers, and inventory are not affected.</span><br />
              Only your company profile will be overwritten when you complete setup.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={() => setShowRerunConfirm(false)} style={{ fontFamily: C.font, fontSize: '0.88rem', fontWeight: 600, color: C.textSecond, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '11px 24px', cursor: 'pointer', outline: 'none' }}>Cancel</button>
              <button type="button" onClick={() => { setShowRerunConfirm(false); setShowRerun(true) }} style={{ fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700, background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', cursor: 'pointer', outline: 'none', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>Open Setup Wizard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
