/**
 * cQikly — Feature Module Toggles Panel
 * Phase 11b-ii
 *
 * Features:
 *   - Boolean toggle for every future module; each invisible + zero impact when off
 *   - Reports, Expense Tracker, Multi-User, Payment Ledger — on/off stubs
 *   - WhatsApp Quick Share toggle + method selector (Desktop deep link / WhatsApp Web)
 *     — Hard Spec #11: method is user-configurable; no hardcoded default
 *   - Branch Sync — visible ONLY when a valid cloud access key is active
 *   - All changes propagate instantly via event bus
 */

import React from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { useFeatureFlag } from '../../contexts/FeatureFlagContext'
import type { FeatureFlagName } from '../../contexts/FeatureFlagContext'

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  amber:       '#fbbf24',
  amberBg:     'rgba(251,191,36,0.12)',
  amberBorder: 'rgba(251,191,36,0.35)',
}

// ─── Module definition ────────────────────────────────────────────────────────

interface ModuleDef {
  key: FeatureFlagName
  icon: string
  label: string
  description: string
  adminOnly?: boolean      // visible only when cloud access key is active
  extra?: React.ReactNode  // rendered when module is ON
}

// ─── Toggle button ────────────────────────────────────────────────────────────

function ToggleBtn({ isOn, onClick }: { isOn: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: C.font, fontSize: '0.82rem', fontWeight: 700,
        padding: '7px 20px', borderRadius: 8, cursor: 'pointer', minWidth: 68,
        background: isOn ? C.greenBg : 'rgba(255,255,255,0.05)',
        color: isOn ? C.green : C.textSecond,
        border: `1.5px solid ${isOn ? C.greenBorder : 'rgba(255,255,255,0.12)'}`,
        transition: 'all 0.18s', outline: 'none', whiteSpace: 'nowrap',
      }}
    >
      {isOn ? 'ON' : 'OFF'}
    </button>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function FeatureModuleTogglesPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const { flags, setFlag } = useFeatureFlag()

  const hasCloudKey = Boolean(config.cloudAccessKey && String(config.cloudAccessKey).trim().length > 0)

  // WhatsApp method selector — shown when whatsappShare is ON
  const WhatsAppMethodSelector = (
    <div style={{
      marginTop: 12, padding: '14px 16px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(139,92,246,0.2)',
      borderRadius: 8,
    }}>
      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: C.accent, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        WhatsApp Method
      </div>
      <div style={{ fontSize: '0.78rem', color: C.textSecond, marginBottom: 10, lineHeight: 1.55 }}>
        Choose how WhatsApp Quick Share opens when you share a bill. Hard Spec #11: no hardcoded default — you choose.
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { key: 'desktop', label: '🖥️ WhatsApp Desktop', desc: 'Opens WhatsApp Desktop app via deep link' },
          { key: 'web',     label: '🌐 WhatsApp Web',     desc: 'Opens web.whatsapp.com in browser' },
        ].map(opt => {
          const active = config.whatsappMethod === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => updateConfig({ whatsappMethod: opt.key as 'desktop' | 'web' })}
              style={{
                flex: '1 1 160px', fontFamily: C.font, textAlign: 'left',
                padding: '12px 14px', borderRadius: 9, cursor: 'pointer', outline: 'none',
                background: active ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.02)',
                border: active ? '2px solid var(--cq-accent)' : '1.5px solid var(--cq-border)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '0.86rem', fontWeight: active ? 700 : 500, color: active ? C.accent : C.textPrimary, marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: '0.73rem', color: C.textSecond }}>{opt.desc}</div>
              {active && <div style={{ marginTop: 6, fontSize: '0.65rem', fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Selected</div>}
            </button>
          )
        })}
      </div>
      {!config.whatsappMethod && (
        <div style={{ marginTop: 8, fontSize: '0.75rem', color: C.amber, fontWeight: 600 }}>
          ⚠️ Please select a method — no default is set by design.
        </div>
      )}
    </div>
  )

  const MODULES: ModuleDef[] = [
    {
      key: 'reports',
      icon: '📊',
      label: 'Reports Module',
      description: 'Daily, monthly, and yearly sales summaries; item-wise and customer-wise reports; GST collected summary; all exportable to Excel.',
    },
    {
      key: 'expenseTracker',
      icon: '💰',
      label: 'Expense Tracker',
      description: 'Log business expenses (rent, transport, miscellaneous) and view a rough P&L — total billed minus total expenses.',
    },
    {
      key: 'multiUser',
      icon: '👥',
      label: 'Multi-User / Operator Profiles',
      description: 'PIN-based operator switching on the same machine. Each operator gets their own session log.',
    },
    {
      key: 'paymentLedger',
      icon: '📒',
      label: 'Payment Recorder & Ledger',
      description: 'Log payments received, maintain a full Dr/Cr ledger per customer, and track outstanding balances.',
    },
    {
      key: 'whatsappShare',
      icon: '💬',
      label: 'WhatsApp Quick Share',
      description: 'One-click share a bill image to WhatsApp. Configure your preferred method below.',
      extra: WhatsAppMethodSelector,
    },
    {
      key: 'branchSync',
      icon: '🔗',
      label: 'Branch Sync',
      description: 'Sync billing data across branches using cloud infrastructure. Requires a valid cloud access key.',
      adminOnly: true,
    },
    {
      key: 'branchActivityMonitor',
      icon: '📡',
      label: 'Branch Activity Monitor',
      description: 'Live admin view of activity across all branches — bills, revenue, and alerts in real time.',
      adminOnly: true,
    },
    {
      key: 'customerDbSync',
      icon: '🗄️',
      label: 'Centralized Customer DB Sync',
      description: 'Maintain one master customer list at HQ and push it to all branches automatically.',
      adminOnly: true,
    },
    {
      key: 'priceListSync',
      icon: '🏷️',
      label: 'Price List Sync',
      description: 'Update inventory prices once at HQ and push them to all branches instantly.',
      adminOnly: true,
    },
  ]

  return (
    <div id="featuretoggles" style={{ scrollMarginTop: 20 }}>
      <div style={{
        padding: '28px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--cq-border)',
        borderRadius: 14, fontFamily: C.font, marginTop: 20,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Feature Modules
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
          Module Toggles
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 22, lineHeight: 1.6 }}>
          Each module is independently toggled. When off, the module is completely invisible — no nav item, no memory usage, zero impact on the rest of the app.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {MODULES.map((mod, idx) => {
            // Admin-only: hide entirely when no cloud key
            if (mod.adminOnly && !hasCloudKey) return null

            const isOn = Boolean(flags[mod.key])

            return (
              <div
                key={mod.key}
                style={{
                  padding: '18px 0',
                  borderTop: idx > 0 ? '1px solid rgba(139,92,246,0.1)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {/* Icon */}
                  <div style={{ fontSize: '1.4rem', marginTop: 2 }}>{mod.icon}</div>

                  {/* Text */}
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      marginBottom: 4,
                    }}>
                      <div style={{ fontSize: '0.92rem', fontWeight: 700, color: C.textPrimary }}>
                        {mod.label}
                      </div>
                      {mod.adminOnly && (
                        <span style={{
                          fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: C.amberBg, color: C.amber, border: `1px solid ${C.amberBorder}`,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                        }}>
                          Admin + Cloud Key
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: C.textSecond, lineHeight: 1.55 }}>
                      {mod.description}
                    </div>
                    {/* Extra content when ON */}
                    {isOn && mod.extra}
                  </div>

                  {/* Toggle */}
                  <ToggleBtn isOn={isOn} onClick={() => setFlag(mod.key, !isOn)} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Admin features note when no key */}
        {!hasCloudKey && (
          <div style={{
            marginTop: 18, padding: '12px 16px',
            background: C.amberBg, border: `1px solid ${C.amberBorder}`,
            borderRadius: 8, fontSize: '0.78rem', color: C.amber, lineHeight: 1.55,
          }}>
            🔑 Branch Sync and other admin-only modules are hidden until a valid cloud access key is entered in the Access Key section below.
          </div>
        )}
      </div>
    </div>
  )
}
