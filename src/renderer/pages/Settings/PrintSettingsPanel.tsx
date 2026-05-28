/**
 * cQikly — Print Settings Panel
 * Phase 11a-ii
 *
 * Settings:
 *   - Default printer selection (empty = use OS default dialog)
 *   - Default page size override (A4 / A5 / Letter / Legal)
 *
 * Changes propagate instantly via ConfigContext → event bus.
 * Printer list is fetched from Electron IPC (window.cqikly.app.getPrinters)
 * and falls back to an empty list (just the OS-default option) in dev/browser mode.
 */

import React, { useState, useEffect } from 'react'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Style tokens ──────────────────────────────────────────────────────────────

const C = {
  font:        '"Inter", system-ui, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'rgba(196,181,253,0.72)',
  border:      'var(--cq-border)',
}

const PAGE_SIZES = ['A4', 'A5', 'Letter', 'Legal'] as const
type PageSizeValue = typeof PAGE_SIZES[number]

const PAGE_SIZE_DESCS: Record<PageSizeValue, string> = {
  'A4':     '210 × 297 mm — standard worldwide',
  'A5':     '148 × 210 mm — compact, common for invoices',
  'Letter': '215.9 × 279.4 mm — US standard',
  'Legal':  '215.9 × 355.6 mm — US legal',
}

// ─── Printer list fetcher ─────────────────────────────────────────────────────

async function fetchPrinters(): Promise<string[]> {
  try {
    const ipc = (window as unknown as { cqikly?: { app?: { getPrinters?: () => Promise<string[]> } } }).cqikly
    if (ipc?.app?.getPrinters) {
      return await ipc.app.getPrinters()
    }
  } catch { /* ignore */ }
  return []
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrintSettingsPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const [printers, setPrinters] = useState<string[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(true)

  useEffect(() => {
    fetchPrinters().then(list => {
      setPrinters(list)
      setLoadingPrinters(false)
    })
  }, [])

  const printerValue   = (config.printDefaultPrinter   as string)  ?? ''
  const pageSizeValue  = (config.printDefaultPageSize  as string)  ?? 'A4'

  return (
    <div style={{
      marginTop: 20, padding: '28px 32px',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${C.border}`,
      borderRadius: 14, fontFamily: C.font,
    }}>
      {/* Header */}
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
        Print Settings
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--cq-text-primary)', marginBottom: 6 }}>
        Quick Print Defaults
      </div>
      <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 24, lineHeight: 1.6 }}>
        These settings are used when quick-printing (Ctrl+Shift+P) to skip the OS print dialog.
        Individual print jobs can still override these on demand.
      </div>

      {/* ── Default Printer ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
          🖨️ Default Printer
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 10, lineHeight: 1.5 }}>
          Leave as "OS Default" to always use whatever the operating system has set as the default printer.
        </div>
        {loadingPrinters ? (
          <div style={{ fontSize: '0.8rem', color: C.textSecond, padding: '8px 0' }}>Detecting printers…</div>
        ) : (
          <select
            value={printerValue}
            onChange={e => updateConfig({ printDefaultPrinter: e.target.value })}
            style={{
              fontFamily: C.font, fontSize: '0.83rem', color: C.textPrimary,
              background: 'rgba(255,255,255,0.07)', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '9px 32px 9px 12px', outline: 'none', cursor: 'pointer',
              minWidth: 260, WebkitAppearance: 'none', appearance: 'none',
            }}
          >
            <option value="">🖨️ OS Default</option>
            {printers.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        {!loadingPrinters && printers.length === 0 && (
          <div style={{ marginTop: 6, fontSize: '0.73rem', color: C.textSecond, lineHeight: 1.5 }}>
            No printers detected (running in browser/dev mode). In Electron, installed printers appear here.
          </div>
        )}
      </div>

      {/* ── Default Page Size ─────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
          📐 Default Page Size
        </div>
        <div style={{ fontSize: '0.76rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.5 }}>
          Override for quick prints. Specific PDF formats have their own page logic (A5 → A4 → multi-page) —
          this controls the physical paper size sent to the printer.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PAGE_SIZES.map(size => {
            const active = pageSizeValue === size
            return (
              <button
                key={size}
                type="button"
                onClick={() => updateConfig({ printDefaultPageSize: size })}
                style={{
                  fontFamily: C.font, textAlign: 'left',
                  background: active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)',
                  border: active ? '2px solid var(--cq-accent)' : `1.5px solid ${C.border}`,
                  borderRadius: 10, padding: '12px 16px', cursor: 'pointer', outline: 'none',
                  minWidth: 130, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--cq-accent)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = C.border }}
              >
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: C.textPrimary, marginBottom: 4 }}>
                  {size}
                </div>
                <div style={{ fontSize: '0.72rem', color: C.textSecond, lineHeight: 1.5 }}>
                  {PAGE_SIZE_DESCS[size]}
                </div>
                {active && (
                  <div style={{ marginTop: 6, fontSize: '0.67rem', fontWeight: 700, color: 'var(--cq-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    ✓ Selected
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
