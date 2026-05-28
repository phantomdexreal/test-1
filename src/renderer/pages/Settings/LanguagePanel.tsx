/**
 * cQikly — Language / i18n Panel
 * Phase 11a-ii
 *
 * Shows the language selector. Currently only English is available.
 * The selector is present even with a single language so that adding a new
 * locale in future sessions requires zero structural changes — only a new
 * locale file and an entry in LANGUAGE_OPTIONS.
 *
 * Language change propagates instantly via LanguageContext → event bus.
 */

import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

// ─── Available languages ──────────────────────────────────────────────────────

interface LangOption {
  code:        string
  label:       string
  nativeLabel: string
  flag:        string
  available:   boolean  // false = "coming soon" — shown but disabled
}

const LANGUAGE_OPTIONS: LangOption[] = [
  { code: 'en', label: 'English',    nativeLabel: 'English',    flag: '🇬🇧', available: true },
  { code: 'hi', label: 'Hindi',      nativeLabel: 'हिन्दी',       flag: '🇮🇳', available: false },
  { code: 'kn', label: 'Kannada',    nativeLabel: 'ಕನ್ನಡ',       flag: '🇮🇳', available: false },
  { code: 'ta', label: 'Tamil',      nativeLabel: 'தமிழ்',        flag: '🇮🇳', available: false },
  { code: 'te', label: 'Telugu',     nativeLabel: 'తెలుగు',       flag: '🇮🇳', available: false },
  { code: 'mr', label: 'Marathi',    nativeLabel: 'मराठी',        flag: '🇮🇳', available: false },
  { code: 'gu', label: 'Gujarati',   nativeLabel: 'ગુજરાતી',      flag: '🇮🇳', available: false },
]

// ─── Style tokens ──────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'rgba(196,181,253,0.72)',
  textMuted:   'rgba(196,181,253,0.42)',
  border:      'var(--cq-border)',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguagePanel(): React.ReactElement {
  const { language, setLanguage } = useLanguage()

  return (
    <div style={{
      marginTop: 20, padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${C.border}`,
      borderRadius: 14, fontFamily: C.font,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Language
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
        App Language &amp; Region
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 20, lineHeight: 1.6 }}>
        Choose your preferred language. The app reloads all UI strings instantly without restart.
        More regional Indian languages are coming in future updates.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
        {LANGUAGE_OPTIONS.map(lang => {
          const active   = language === lang.code
          const disabled = !lang.available

          return (
            <button
              key={lang.code}
              type="button"
              disabled={disabled}
              onClick={() => { if (lang.available) setLanguage(lang.code as 'en') }}
              title={disabled ? 'Coming soon' : `Switch to ${lang.label}`}
              style={{
                fontFamily: C.font, textAlign: 'left', position: 'relative',
                background: active
                  ? 'rgba(255,255,255,0.09)'
                  : disabled
                    ? 'rgba(255,255,255,0.01)'
                    : 'rgba(255,255,255,0.03)',
                border: active
                  ? '2px solid var(--cq-accent)'
                  : `1.5px solid ${disabled ? 'rgba(255,255,255,0.07)' : C.border}`,
                borderRadius: 11, padding: '14px 16px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                outline: 'none', transition: 'all 0.15s',
                opacity: disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.borderColor = 'var(--cq-accent)' }}
              onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.borderColor = C.border }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{lang.flag}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: C.textPrimary, marginBottom: 2 }}>
                {lang.nativeLabel}
              </div>
              <div style={{ fontSize: '0.75rem', color: C.textSecond }}>
                {lang.label}
              </div>
              {active && (
                <div style={{ marginTop: 6, fontSize: '0.68rem', fontWeight: 700, color: 'var(--cq-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ✓ Active
                </div>
              )}
              {disabled && (
                <div style={{
                  position: 'absolute', top: 8, right: 8,
                  fontSize: '0.6rem', fontWeight: 700, color: C.textMuted,
                  background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 6px',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Soon
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: 18, padding: '12px 16px',
        background: 'rgba(139,92,246,0.07)',
        border: '1px solid rgba(139,92,246,0.2)',
        borderRadius: 9, fontSize: '0.78rem', color: C.textSecond, lineHeight: 1.6,
      }}>
        💡 All UI strings in cQikly are managed through a translation layer from day one.
        Adding a new language requires only a new locale file — zero structural changes to the app.
        Regional languages will be rolled out progressively in future updates.
      </div>
    </div>
  )
}
