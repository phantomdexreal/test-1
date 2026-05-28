/**
 * cQikly — Config Export / Import Panel
 * Phase 11b-ii
 *
 * Features:
 *   - Config file export — exports all current settings as a single drag-droppable JSON file
 *   - Config file import — drag-drop or browse; on import:
 *       • PRESERVES local company profile (firm name, address, logo, GST, branches, contact)
 *       • REPLACES everything else (themes, toggles, shortcuts, PDF settings, preferences)
 *
 * Hard Spec #16: Config import preserves local company profile; replaces everything else.
 */

import React, { useRef, useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import type { AppConfig } from '../../contexts/ConfigContext'

const C = {
  font:        '"Inter", system-ui, -apple-system, sans-serif',
  accent:      'var(--cq-accent)',
  textPrimary: 'var(--cq-text-primary)',
  textSecond:  'var(--cq-text-muted)',
  green:       '#4ade80',
  greenBg:     'rgba(74,222,128,0.12)',
  greenBorder: 'rgba(74,222,128,0.35)',
  red:         '#f87171',
  redBg:       'rgba(239,68,68,0.08)',
  redBorder:   'rgba(239,68,68,0.3)',
  amber:       '#fbbf24',
  amberBg:     'rgba(251,191,36,0.12)',
  amberBorder: 'rgba(251,191,36,0.35)',
}

// Fields that belong to the company profile — NEVER overwritten on import (Hard Spec #16)
const COMPANY_PROFILE_KEYS: (keyof AppConfig)[] = [
  'companyProfileId',
  'companyName',
  'onboardingComplete',
]

type ImportStatus =
  | { type: 'idle' }
  | { type: 'confirm'; filename: string; incoming: Partial<AppConfig> }
  | { type: 'success' }
  | { type: 'error'; message: string }

export default function ConfigExportImportPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()
  const [importStatus, setImportStatus] = useState<ImportStatus>({ type: 'idle' })
  const [dragOver, setDragOver]         = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [exportDone, setExportDone]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = () => {
    setExporting(true)
    try {
      const exportData = {
        _cqiklyConfigVersion: 1,
        _exportedAt: new Date().toISOString(),
        ...config,
      }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cQikly_Config_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } finally {
      setExporting(false)
    }
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.json') && !file.name.endsWith('.cqconfig')) {
      setImportStatus({ type: 'error', message: 'Please drop a valid cQikly config JSON file.' })
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Record<string, unknown>
        if (!parsed._cqiklyConfigVersion) {
          setImportStatus({ type: 'error', message: 'This does not appear to be a valid cQikly config file.' })
          return
        }
        setImportStatus({ type: 'confirm', filename: file.name, incoming: parsed as Partial<AppConfig> })
      } catch {
        setImportStatus({ type: 'error', message: 'Could not parse the config file. It may be corrupted.' })
      }
    }
    reader.readAsText(file)
  }

  const handleImportConfirm = (incoming: Partial<AppConfig>) => {
    // Hard Spec #16: Preserve local company profile — strip those keys from the import payload
    const safePatch = { ...incoming }
    for (const key of COMPANY_PROFILE_KEYS) {
      delete safePatch[key]
    }
    // Also strip internal metadata keys
    delete (safePatch as Record<string, unknown>)._cqiklyConfigVersion
    delete (safePatch as Record<string, unknown>)._exportedAt

    updateConfig(safePatch)
    setImportStatus({ type: 'success' })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderImportZone = () => {
    if (importStatus.type === 'confirm') {
      return (
        <div style={{ padding: '18px 22px', background: C.amberBg, border: `1.5px solid ${C.amberBorder}`, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.amber, marginBottom: 8 }}>
            📋 Import: <span style={{ fontWeight: 500 }}>{importStatus.filename}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.6 }}>
            This will apply all settings from the imported file to your app — <strong style={{ color: C.textPrimary }}>except your company profile</strong> (firm name, address, logo, GST, contact info) which will be preserved as-is.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setImportStatus({ type: 'idle' })} style={{ fontFamily: C.font, fontSize: '0.83rem', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: C.textSecond, cursor: 'pointer', outline: 'none' }}>Cancel</button>
            <button type="button" onClick={() => handleImportConfirm(importStatus.incoming)} style={{ fontFamily: C.font, fontSize: '0.83rem', fontWeight: 700, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#d97706,#b45309)', color: '#fff', cursor: 'pointer', outline: 'none' }}>
              ✅ Apply Config (preserve company profile)
            </button>
          </div>
        </div>
      )
    }

    if (importStatus.type === 'success') {
      return (
        <div style={{ padding: '12px 16px', background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.green }}>✅ Config imported — all settings applied. Company profile preserved.</div>
        </div>
      )
    }

    if (importStatus.type === 'error') {
      return (
        <div style={{ padding: '10px 14px', background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: '0.8rem', color: C.red }}>❌ {importStatus.message}</div>
          <button type="button" onClick={() => setImportStatus({ type: 'idle' })} style={{ marginTop: 8, fontFamily: C.font, fontSize: '0.74rem', padding: '4px 12px', borderRadius: 6, border: `1px solid ${C.redBorder}`, background: C.redBg, color: C.red, cursor: 'pointer', outline: 'none' }}>Dismiss</button>
        </div>
      )
    }

    return (
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? C.accent : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 10, padding: '22px',
          textAlign: 'center',
          background: dragOver ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.15s', cursor: 'pointer', marginBottom: 10,
        }}
      >
        <input ref={fileInputRef} type="file" accept=".json,.cqconfig" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        <div style={{ fontSize: '1.4rem', marginBottom: 7 }}>📂</div>
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: C.textPrimary }}>Drop config file here or click to browse</div>
        <div style={{ fontSize: '0.74rem', color: C.textSecond, marginTop: 4 }}>Accepts cQikly .json config files</div>
      </div>
    )
  }

  return (
    <div id="configexportimport" style={{ scrollMarginTop: 20 }}>
      <div style={{
        padding: '28px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--cq-border)',
        borderRadius: 14, fontFamily: C.font, marginTop: 20,
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Config Export / Import
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>
          Portable Config File
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 22, lineHeight: 1.6 }}>
          Export your current settings to a file you can carry to another device. Importing a config preserves the <strong style={{ color: C.textPrimary }}>local company profile</strong> and replaces all other preferences.
        </div>

        {/* Export section */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>
            📤 Export Current Config
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              style={{
                fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
                padding: '10px 24px', borderRadius: 9, cursor: 'pointer',
                background: exportDone ? C.greenBg : 'rgba(139,92,246,0.16)',
                color: exportDone ? C.green : C.accent,
                border: `1.5px solid ${exportDone ? C.greenBorder : 'rgba(139,92,246,0.4)'}`,
                outline: 'none', transition: 'all 0.2s',
              }}
            >
              {exportDone ? '✅ Config Downloaded' : exporting ? '⏳ Exporting…' : '⬇️ Download Config File'}
            </button>
            <div style={{ fontSize: '0.76rem', color: C.textSecond }}>
              Saves a .json file you can import on another device
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ borderTop: '1px solid var(--cq-border)', marginBottom: 24 }} />

        {/* Import section */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.textPrimary, marginBottom: 6 }}>
            📥 Import Config from Another Device
          </div>
          <div style={{ fontSize: '0.78rem', color: C.textSecond, marginBottom: 14, lineHeight: 1.55 }}>
            ⚠️ Your <strong style={{ color: C.amber }}>company profile will not be overwritten</strong>. Everything else (themes, toggles, PDF settings, etc.) will be replaced.
          </div>
          {renderImportZone()}
        </div>
      </div>
    </div>
  )
}
