/**
 * cQikly — OnboardingWizardPlaceholder
 * Phase: 2a-A (stub — full wizard built in 2a-B)
 *
 * Shown when user clicks "cQikly" on the landing screen.
 * Placeholder panel until the full wizard is built in Phase 2a-B.
 *
 * TODO: [ONBOARDING-WIZARD] — Phase 2a-B: Replace this placeholder with
 * the full multi-step onboarding wizard (firm name, nature, GST, address,
 * HO/branch, cloud sync, contact, logo, FY settings, bill number).
 */

import React from 'react'

interface OnboardingWizardPlaceholderProps {
  onClose: () => void
}

export default function OnboardingWizardPlaceholder({ onClose }: OnboardingWizardPlaceholderProps): React.ReactElement {
  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         2000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     'rgba(2,0,10,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background:    'rgba(15,8,35,0.97)',
          border:        '1px solid rgba(168,85,247,0.3)',
          borderRadius:  '16px',
          padding:       '48px 56px',
          maxWidth:      '480px',
          width:         '90vw',
          textAlign:     'center',
          boxShadow:     '0 0 80px rgba(168,85,247,0.2), 0 32px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          fontFamily:  '"Inter", system-ui, sans-serif',
          fontSize:    '2.5rem',
          fontWeight:  900,
          background:  'linear-gradient(135deg, #ffffff, #d8b4fe, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
          marginBottom: '12px',
        }}>
          cQikly
        </div>

        <div style={{
          fontFamily:  '"Inter", system-ui, sans-serif',
          fontSize:    '1.1rem',
          fontWeight:  600,
          color:       '#d8b4fe',
          marginBottom: '20px',
          letterSpacing: '0.05em',
        }}>
          Onboarding Wizard
        </div>

        <div style={{
          fontFamily:    '"Inter", system-ui, sans-serif',
          fontSize:      '0.9rem',
          color:         'rgba(196,181,253,0.65)',
          lineHeight:    1.7,
          marginBottom:  '32px',
        }}>
          {/* TODO: [ONBOARDING-WIZARD] — Full multi-step wizard built in Phase 2a-B. */}
          The onboarding wizard will guide you through setting up your firm details,
          GST info, branch configuration, and billing preferences.
          <br /><br />
          <span style={{ color: 'rgba(168,85,247,0.6)', fontSize: '0.78rem', fontStyle: 'italic' }}>
            Coming in Phase 2a-B — stub placeholder active
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            fontFamily:    '"Inter", system-ui, sans-serif',
            background:    'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color:         '#ffffff',
            border:        'none',
            borderRadius:  '8px',
            padding:       '12px 32px',
            fontSize:      '0.9rem',
            fontWeight:    600,
            cursor:        'pointer',
            letterSpacing: '0.05em',
            boxShadow:     '0 4px 20px rgba(124,58,237,0.4)',
            transition:    'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            ;(e.target as HTMLButtonElement).style.transform = 'scale(1.03)'
            ;(e.target as HTMLButtonElement).style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)'
          }}
          onMouseLeave={e => {
            ;(e.target as HTMLButtonElement).style.transform = 'scale(1)'
            ;(e.target as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)'
          }}
        >
          ← Back to Landing
        </button>
      </div>
    </div>
  )
}
