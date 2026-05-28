/**
 * cQikly — ModulePlaceholderPage
 * Built in: Phase 13
 *
 * Shared component used by all boolean-gated module stub pages.
 * Renders a polished, informative placeholder when a module is enabled
 * but not yet fully implemented.
 *
 * Design rule: generous spacing, breathing room, nothing cramped.
 */
import React from 'react'

type BadgeColor = 'blue' | 'green' | 'purple' | 'amber' | 'rose'

interface FeatureItem {
  icon: string
  label: string
  desc: string
}

interface ModulePlaceholderPageProps {
  icon: string
  title: string
  badgeLabel: string
  badgeColor: BadgeColor
  description: string
  features: FeatureItem[]
  settingsPath?: string
  adminNote?: string
}

const BADGE_COLORS: Record<BadgeColor, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)',  text: '#60a5fa' },
  green:  { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.35)',  text: '#4ade80' },
  purple: { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.35)',  text: '#a78bfa' },
  amber:  { bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
  rose:   { bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.35)', text: '#fb7185' },
}

export function ModulePlaceholderPage({
  icon,
  title,
  badgeLabel,
  badgeColor,
  description,
  features,
  settingsPath,
  adminNote,
}: ModulePlaceholderPageProps): React.ReactElement {
  const badge = BADGE_COLORS[badgeColor]
  const font = '"Inter", system-ui, -apple-system, sans-serif'

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '48px 56px',
        background: 'var(--cq-bg-primary)',
        fontFamily: font,
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 14 }}>
          {/* Module icon */}
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--cq-surface)',
            border: '1.5px solid var(--cq-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem', flexShrink: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}>
            {icon}
          </div>

          <div>
            {/* Status badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20, marginBottom: 8,
              background: badge.bg, border: `1px solid ${badge.border}`,
              fontSize: '0.72rem', fontWeight: 700, color: badge.text,
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              <span style={{ fontSize: '0.6rem' }}>●</span>
              {badgeLabel}
            </div>

            {/* Title */}
            <h1 style={{
              margin: 0,
              fontSize: '1.75rem', fontWeight: 800,
              color: 'var(--cq-text-primary)',
              letterSpacing: '-0.02em', lineHeight: 1.1,
            }}>
              {title}
            </h1>
          </div>
        </div>

        {/* Description */}
        <p style={{
          margin: 0, maxWidth: 620,
          fontSize: '1rem', color: 'var(--cq-text-muted)',
          lineHeight: 1.65,
        }}>
          {description}
        </p>
      </div>

      {/* "Module is on but not yet built" notice */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '18px 22px', marginBottom: 40,
        background: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.25)',
        borderRadius: 12,
        maxWidth: 680,
      }}>
        <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: 1 }}>🚧</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--cq-text-primary)', marginBottom: 5 }}>
            Module Enabled — Full Build Coming in a Future Phase
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--cq-text-muted)', lineHeight: 1.6 }}>
            You've turned this module on. The complete implementation will be built in a future phase.
            When it's ready, this placeholder will be replaced by the full working module.
            Disabling the toggle makes this page completely invisible again.
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div style={{ marginBottom: 40, maxWidth: 720 }}>
        <div style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--cq-accent)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 18,
        }}>
          What This Module Will Include
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {features.map((f, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '16px 0',
                borderTop: idx > 0 ? '1px solid var(--cq-border)' : undefined,
              }}
            >
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                background: 'var(--cq-surface)',
                border: '1px solid var(--cq-border)',
                borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.1rem',
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{
                  fontSize: '0.9rem', fontWeight: 600,
                  color: 'var(--cq-text-primary)', marginBottom: 4,
                }}>
                  {f.label}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', lineHeight: 1.55 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin note (for cloud/admin-only modules) */}
      {adminNote && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '16px 20px', marginBottom: 28,
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.25)',
          borderRadius: 10, maxWidth: 680,
        }}>
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔑</span>
          <div style={{ fontSize: '0.8rem', color: '#fbbf24', lineHeight: 1.6 }}>
            {adminNote}
          </div>
        </div>
      )}

      {/* Settings path hint */}
      {settingsPath && (
        <div style={{
          fontSize: '0.78rem', color: 'var(--cq-text-muted)',
          padding: '12px 16px',
          background: 'var(--cq-surface)',
          border: '1px solid var(--cq-border)',
          borderRadius: 8, display: 'inline-flex',
          alignItems: 'center', gap: 8,
          maxWidth: 680,
        }}>
          <span style={{ opacity: 0.6 }}>⚙️</span>
          <span>
            To disable this module: <strong style={{ color: 'var(--cq-text-primary)' }}>{settingsPath}</strong> → toggle OFF
          </span>
        </div>
      )}
    </div>
  )
}
