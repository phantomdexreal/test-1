/**
 * cQikly — PDF Action Dialogs
 * Phase 6b-A-ii
 *
 * Components:
 *   - UpiQrPrompt: asks whether to include UPI QR code at print/copy time
 *   - PdfFormatSelector: allows user to pick PDF format before generating
 */

import React from 'react'
import type { PdfFormat } from '../../services/pdf.service'

// ─── Style tokens ─────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, sans-serif',
  accent:      '#8b5cf6',
  textPrimary: '#f1f0ff',
  textSecond:  'rgba(196,181,253,0.75)',
  textMuted:   'rgba(196,181,253,0.42)',
  surface:     'rgba(14,6,38,0.99)',
  border:      'rgba(139,92,246,0.22)',
  overlay:     'rgba(0,0,0,0.72)',
}

// ─── Modal overlay wrapper ─────────────────────────────────────────────────────

function Modal({
  children,
  onDismiss,
}: {
  children: React.ReactNode
  onDismiss?: () => void
}): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: C.overlay, backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '16px',
          padding: '32px 36px',
          maxWidth: '420px', width: '90vw',
          boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
          fontFamily: C.font,
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Action button ─────────────────────────────────────────────────────────────

function Btn({
  children, onClick, primary = false, danger = false,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  danger?: boolean
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
        background: primary
          ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
          : danger
            ? 'rgba(239,68,68,0.1)'
            : 'rgba(255,255,255,0.08)',
        color: primary ? '#fff' : danger ? '#fca5a5' : C.textPrimary,
        border: primary ? 'none' : `1px solid ${danger ? 'rgba(239,68,68,0.3)' : C.border}`,
        borderRadius: '10px', padding: '11px 22px', cursor: 'pointer', outline: 'none',
        boxShadow: primary ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ─── UPI QR Prompt ────────────────────────────────────────────────────────────

export interface UpiQrPromptProps {
  /** Grand total amount to show in prompt */
  grandTotal: number
  /** Called with true = include QR, false = skip */
  onResult: (includeQr: boolean) => void
}

/**
 * Prompts the user at print/copy time whether to include the UPI QR code.
 * Per spec: UPI QR is never auto-included — always prompted.
 */
export function UpiQrPrompt({ grandTotal, onResult }: UpiQrPromptProps): React.ReactElement {
  const rounded = Math.round(grandTotal)

  return (
    <Modal onDismiss={() => onResult(false)}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: '12px' }}>📱</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: '10px' }}>
          Include UPI QR Code?
        </div>
        <div style={{ fontSize: '0.85rem', color: C.textSecond, lineHeight: 1.7, marginBottom: '24px' }}>
          A UPI QR code for{' '}
          <strong style={{ color: C.textPrimary }}>
            ₹{rounded.toLocaleString('en-IN')}
          </strong>{' '}
          can be included at the bottom of this PDF so the customer can scan to pay directly.
          <br /><br />
          <span style={{ color: C.textMuted, fontSize: '0.78rem' }}>
            The QR code uses the UPI ID configured in Settings → PDF Settings.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={() => onResult(false)}>
            Skip QR — Generate PDF
          </Btn>
          <Btn primary onClick={() => onResult(true)}>
            ✓ Include QR Code
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

// ─── PDF Format Selector ──────────────────────────────────────────────────────

const FORMAT_OPTIONS: { id: PdfFormat; icon: string; label: string; desc: string }[] = [
  {
    id: 'simplified',
    icon: '📄',
    label: 'Simplified',
    desc: 'Customer name + contact only. No company info. A5 ≤40 rows.',
  },
  {
    id: 'professional',
    icon: '🏢',
    label: 'Professional',
    desc: 'Company header with logo + customer sub-header. A5 ≤30 rows.',
  },
  {
    id: 'detailed-professional',
    icon: '📋',
    label: 'Detailed Professional',
    desc: 'All company + all customer details including address. A5 ≤20 rows.',
  },
]

export interface PdfFormatSelectorProps {
  /** Initially highlighted format (from format memory or default) */
  initialFormat: PdfFormat
  /** Party name for display */
  partyName: string
  /** True if format memory exists for this party */
  hasMemory: boolean
  /** Called with chosen format, or null if cancelled */
  onResult: (format: PdfFormat | null) => void
}

/**
 * Lets the user choose which PDF format to generate.
 * Shows the auto-selected format from memory (if any) pre-highlighted.
 * The user can override.
 */
export function PdfFormatSelector({
  initialFormat, partyName, hasMemory, onResult,
}: PdfFormatSelectorProps): React.ReactElement {
  const [selected, setSelected] = React.useState<PdfFormat>(initialFormat)

  return (
    <Modal onDismiss={() => onResult(null)}>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: C.textPrimary, marginBottom: '6px' }}>
        Choose PDF Format
      </div>
      {hasMemory && partyName && (
        <div style={{
          fontSize: '0.73rem', color: C.textSecond, marginBottom: '14px',
          background: 'rgba(139,92,246,0.08)', borderRadius: '6px',
          padding: '6px 10px', lineHeight: 1.5,
        }}>
          📌 Auto-selected <strong>{FORMAT_OPTIONS.find(f => f.id === initialFormat)?.label}</strong> — last used for <em>{partyName}</em>.
          You can change it below.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        {FORMAT_OPTIONS.map(opt => {
          const active = opt.id === selected
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelected(opt.id)}
              style={{
                textAlign: 'left',
                background: active ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.04)',
                border: active
                  ? `2px solid rgba(139,92,246,0.7)`
                  : `1px solid ${C.border}`,
                borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
                outline: 'none', transition: 'all 0.15s', fontFamily: C.font,
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0, lineHeight: 1 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.textPrimary, marginBottom: '2px' }}>
                    {opt.label}
                    {active && (
                      <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: C.accent, fontWeight: 700 }}>
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: C.textSecond, lineHeight: 1.5 }}>
                    {opt.desc}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <Btn onClick={() => onResult(null)}>Cancel</Btn>
        <Btn primary onClick={() => onResult(selected)}>
          Generate PDF →
        </Btn>
      </div>
    </Modal>
  )
}
