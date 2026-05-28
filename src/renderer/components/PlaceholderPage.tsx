/**
 * cQikly — PlaceholderPage
 * Built in: Phase 1b-B
 *
 * Reusable generous-spacing placeholder used by all 6 pages until their
 * real implementation arrives. Shows page name, phase, features list,
 * and the Ctrl+N shortcut as a reminder.
 */

import React from 'react'
import { usePerformance } from '../contexts/PerformanceContext'
import { useTheme } from '../contexts/ThemeContext'

interface FeatureRow {
  label: string
  phase: string
}

interface PlaceholderPageProps {
  pageNumber: number
  title: string
  subtitle: string
  shortcut: string
  icon: string
  accentColor?: string
  features: FeatureRow[]
  phaseBuilt: string
  /** Optional extra content appended below the features list (Phase 2b: Settings re-run button) */
  children?: React.ReactNode
}

export function PlaceholderPage({
  pageNumber,
  title,
  subtitle,
  shortcut,
  icon,
  accentColor,
  features,
  phaseBuilt,
  children,
}: PlaceholderPageProps): React.ReactElement {
  const { mode, animationsEnabled, apiPollingEnabled } = usePerformance()
  const { themeId, variant } = useTheme()

  const accent = accentColor ?? 'var(--cq-accent)'

  return (
    <div
      style={{
        flex: 1,
        height: '100vh',
        overflow: 'auto',
        background: 'var(--cq-bg-primary)',
        color: 'var(--cq-text-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* Page header */}
      <div style={{
        padding: '2.5rem 3rem 2rem',
        borderBottom: '1px solid var(--cq-border)',
        background: 'var(--cq-bg-secondary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>{icon}</span>
          <div>
            <h1 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: accent,
              margin: 0,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}>
              {title}
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--cq-text-muted)', margin: '0.3rem 0 0', letterSpacing: '0.04em' }}>
              Page {pageNumber} · {shortcut}
            </p>
          </div>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--cq-text-muted)', margin: '0.75rem 0 0', maxWidth: 560 }}>
          {subtitle}
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '2.5rem 3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Coming in phase card */}
        <div style={{
          background: 'var(--cq-surface)',
          border: `1px solid ${accent}33`,
          borderRadius: '0.75rem',
          padding: '1.75rem 2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.25rem',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '0.5rem',
            background: `${accent}22`,
            border: `1px solid ${accent}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}>
            🔧
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--cq-text-primary)' }}>
              Full implementation in {phaseBuilt}
            </p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem', color: 'var(--cq-text-muted)', lineHeight: 1.6 }}>
              This page is an intentional placeholder. The shell, navigation, keyboard shortcuts,
              theme system, and performance mode are fully wired. The billing logic arrives in the phases listed below.
            </p>
          </div>
        </div>

        {/* Features table */}
        <div style={{
          background: 'var(--cq-surface)',
          border: '1px solid var(--cq-border)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '1.25rem 1.75rem 1rem',
            borderBottom: '1px solid var(--cq-border)',
          }}>
            <h2 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--cq-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Planned Features
            </h2>
          </div>
          <div style={{ padding: '0.75rem 0' }}>
            {features.map((f, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.7rem 1.75rem',
                borderBottom: i < features.length - 1 ? '1px solid var(--cq-border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: accent,
                    flexShrink: 0,
                    opacity: 0.6,
                  }} />
                  <span style={{ fontSize: '0.875rem', color: 'var(--cq-text-primary)' }}>{f.label}</span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--cq-text-muted)',
                  background: 'var(--cq-bg-secondary)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  fontFamily: 'monospace',
                  flexShrink: 0,
                }}>
                  {f.phase}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live status strip — shows real context values so Phase 1b-B deliverables are visible */}
        <div style={{
          background: 'var(--cq-surface)',
          border: '1px solid var(--cq-border)',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}>
          <StatusChip label="Theme" value={themeId} />
          <StatusChip label="Variant" value={variant} />
          <StatusChip label="Performance" value={mode} />
          <StatusChip label="Animations" value={animationsEnabled ? 'enabled' : 'disabled (Lite)'} highlight={!animationsEnabled} />
          <StatusChip label="API Polling" value={apiPollingEnabled ? 'enabled' : 'disabled (Lite)'} highlight={!apiPollingEnabled} />
        </div>

        {/* Extra content (e.g. Settings re-run button in Phase 2b) */}
        {children}
      </div>
    </div>
  )
}

function StatusChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.65rem', color: 'var(--cq-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize: '0.8rem',
        color: highlight ? '#f97316' : 'var(--cq-text-primary)',
        fontFamily: 'monospace',
        fontWeight: 500,
      }}>
        {value}
      </span>
    </div>
  )
}
