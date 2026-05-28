/**
 * cQikly — Access Key Panel
 * Phase 11b-ii
 *
 * Features:
 *   - Text input to enter cloud sync access key (obtained from developer)
 *   - On valid key entry: unlocks admin-only features (branch sync toggle becomes visible)
 *   - Key is stored in config and persists across sessions
 *   - Visual feedback: locked / unlocked state
 *
 * Note: The access key is not validated against a server in dev mode — the existence
 * of any non-empty key unlocks admin features (server validation is future Supabase work).
 */

import React, { useState } from 'react'
import { useConfig } from '../../contexts/ConfigContext'
import { eventBus } from '../../utils/eventBus'

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

export default function AccessKeyPanel(): React.ReactElement {
  const { config, updateConfig } = useConfig()

  const currentKey = typeof config.cloudAccessKey === 'string' ? config.cloudAccessKey : ''
  const isUnlocked = currentKey.trim().length > 0

  const [input, setInput]       = useState('')
  const [showKey, setShowKey]   = useState(false)
  const [saved, setSaved]       = useState(false)
  const [revoking, setRevoking] = useState(false)

  const handleActivate = () => {
    const val = input.trim()
    if (!val) return
    updateConfig({ cloudAccessKey: val })
    eventBus.emit('configChange', { key: 'cloudAccessKey', value: val })
    setInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleRevoke = () => {
    updateConfig({ cloudAccessKey: '' })
    eventBus.emit('configChange', { key: 'cloudAccessKey', value: '' })
    setRevoking(false)
  }

  return (
    <div id="accesskey" style={{ scrollMarginTop: 20 }}>
      <div style={{
        padding: '28px 32px',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isUnlocked ? C.greenBorder : 'var(--cq-border)'}`,
        borderRadius: 14, fontFamily: C.font, marginTop: 20,
        transition: 'border-color 0.3s',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: C.accent, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          Access Key
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: C.textPrimary }}>
            Cloud Sync Access Key
          </div>
          {isUnlocked && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
              background: C.greenBg, color: C.green, border: `1px solid ${C.greenBorder}`,
              letterSpacing: '0.04em',
            }}>
              🔓 Unlocked
            </span>
          )}
          {!isUnlocked && (
            <span style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', color: C.textSecond, border: '1px solid rgba(255,255,255,0.12)',
            }}>
              🔒 Locked
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.84rem', color: C.textSecond, marginBottom: 22, lineHeight: 1.6 }}>
          Enter the cloud sync access key obtained from the cQikly developer. Activating a key unlocks admin-only features like Branch Sync and remote monitoring. Regular billing and offline features are unaffected.
        </div>

        {/* Currently active key */}
        {isUnlocked && (
          <div style={{
            padding: '14px 16px', marginBottom: 18,
            background: C.greenBg, border: `1px solid ${C.greenBorder}`, borderRadius: 10,
          }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: C.green, marginBottom: 6 }}>
              ✅ Access key active — admin features unlocked
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                flex: 1, fontFamily: 'monospace', fontSize: '0.82rem',
                color: C.textPrimary, letterSpacing: '0.06em',
                filter: showKey ? 'none' : 'blur(5px)',
                transition: 'filter 0.2s', userSelect: showKey ? 'text' : 'none',
              }}>
                {currentKey}
              </div>
              <button type="button" onClick={() => setShowKey(v => !v)} style={{ fontFamily: C.font, fontSize: '0.74rem', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.06)', color: C.green, cursor: 'pointer', outline: 'none' }}>
                {showKey ? '🙈 Hide' : '👁 Show'}
              </button>
            </div>
          </div>
        )}

        {/* Enter new key */}
        {!isUnlocked && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textSecond, marginBottom: 8 }}>
              Enter access key:
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                type="password"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleActivate() }}
                placeholder="Paste key here…"
                style={{
                  fontFamily: 'monospace', fontSize: '0.9rem', padding: '10px 16px',
                  borderRadius: 9, border: '1.5px solid var(--cq-border)',
                  background: 'rgba(0,0,0,0.25)', color: C.textPrimary,
                  outline: 'none', flex: 1, minWidth: 220, transition: 'border-color 0.15s',
                  letterSpacing: '0.08em',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--cq-accent)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--cq-border)' }}
              />
              <button
                type="button"
                onClick={handleActivate}
                disabled={!input.trim()}
                style={{
                  fontFamily: C.font, fontSize: '0.88rem', fontWeight: 700,
                  padding: '10px 22px', borderRadius: 9, cursor: input.trim() ? 'pointer' : 'not-allowed',
                  background: input.trim() ? 'linear-gradient(135deg,rgba(139,92,246,0.3),rgba(109,40,217,0.3))' : 'rgba(255,255,255,0.04)',
                  color: input.trim() ? C.accent : C.textSecond,
                  border: `1.5px solid ${input.trim() ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  outline: 'none', transition: 'all 0.15s',
                }}
              >
                🔑 Activate
              </button>
            </div>
            {saved && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', fontWeight: 700, color: C.green }}>
                ✅ Key activated — admin features are now unlocked
              </div>
            )}
          </div>
        )}

        {/* Revoke key */}
        {isUnlocked && (
          revoking ? (
            <div style={{
              padding: '14px 16px', background: C.redBg,
              border: `1px solid ${C.redBorder}`, borderRadius: 8,
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: C.red, marginBottom: 10 }}>
                Revoke access key? This will hide all admin-only features.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setRevoking(false)} style={{ fontFamily: C.font, fontSize: '0.82rem', padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: C.textSecond, cursor: 'pointer', outline: 'none' }}>Cancel</button>
                <button type="button" onClick={handleRevoke} style={{ fontFamily: C.font, fontSize: '0.82rem', fontWeight: 700, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#dc2626,#991b1b)', color: '#fff', cursor: 'pointer', outline: 'none' }}>Revoke Key</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setRevoking(true)} style={{ fontFamily: C.font, fontSize: '0.8rem', padding: '7px 16px', borderRadius: 8, border: `1px solid ${C.redBorder}`, background: C.redBg, color: C.red, cursor: 'pointer', outline: 'none', marginTop: 4 }}>
              🗑️ Revoke Access Key
            </button>
          )
        )}
      </div>
    </div>
  )
}
