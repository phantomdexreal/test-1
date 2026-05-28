/**
 * cQikly — Onboarding/index.tsx
 * Built in: Phase 2a-A (landing screen), Phase 2a-B (full wizard), Phase 2b (full wiring)
 *
 * Phase 2b additions:
 *   - Internet detection gate before wizard opens on first launch (cannot skip)
 *   - Internet-loss recovery mid-fill (overlay over wizard; data preserved)
 *   - Persist all data to SQLite + config file on wizard completion
 *   - Redirect to Dashboard (set config.onboardingComplete = true)
 *   - Re-run mode: started from Settings, skips internet check, overwrites profile
 *
 * State machine:
 *   'landing'            — LandingScreen (first launch); or Settings re-run entry
 *   'internet-check'     — Checking internet before opening wizard (first launch only)
 *   'wizard'             — Wizard open; mid-fill internet monitor active
 *   'internet-lost-mid'  — Internet lost mid-fill; overlay over wizard; data frozen
 *   'saving'             — Writing to SQLite / config; brief loading state
 *   'complete'           — Done; triggers redirect via onComplete
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import LandingScreen from './LandingScreen'
import OnboardingWizard, { type OnboardingData } from './OnboardingWizard'
import InternetGate from '../../components/InternetGate'
import { watchConnection, type ConnectionStatus } from '../../services/internet.service'
import { persistOnboardingData } from '../../services/onboarding.service'
import { useConfig } from '../../contexts/ConfigContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStage =
  | 'landing'
  | 'internet-check'
  | 'wizard'
  | 'internet-lost-mid'
  | 'saving'
  | 'complete'

interface OnboardingPageProps {
  /**
   * When true: re-run initiated from Settings.
   * Skips the internet requirement gate entirely.
   * On complete: overwrites existing company profile.
   */
  isRerun?: boolean
  /** Called when re-run completes (so Settings can dismiss the wizard) */
  onRerunComplete?: () => void
}

// ─── Saving overlay ───────────────────────────────────────────────────────────

function SavingOverlay() {
  const C = {
    font: '"Inter", system-ui, -apple-system, sans-serif',
    textPrimary: '#f1f0ff',
    textSecond: 'rgba(196,181,253,0.72)',
    accent: '#8b5cf6',
  }
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000,
      background: 'rgba(2,0,10,0.95)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      gap: '20px',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        border: `3px solid rgba(139,92,246,0.2)`,
        borderTopColor: C.accent,
        animation: 'cq-spin 0.9s linear infinite',
      }} />
      <div style={{ fontFamily: C.font, fontSize: '1.05rem', fontWeight: 700, color: C.textPrimary }}>
        Setting up cQikly...
      </div>
      <div style={{ fontFamily: C.font, fontSize: '0.87rem', color: C.textSecond }}>
        Saving your company profile
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingPage({ isRerun = false, onRerunComplete }: OnboardingPageProps): React.ReactElement {
  const { updateConfig } = useConfig()

  const [stage, setStage]             = useState<OnboardingStage>(isRerun ? 'wizard' : 'landing')
  const [saveError, setSaveError]     = useState<string | null>(null)

  // Wizard data is preserved here — never reset on internet drops
  const wizardDataRef = useRef<OnboardingData | null>(null)

  // Mid-fill internet watcher
  const midFillWatcherRef = useRef<{ stop: () => void } | null>(null)

  // ── Mid-fill internet monitor ─────────────────────────────────────────────

  function startMidFillWatch() {
    stopMidFillWatch()
    midFillWatcherRef.current = watchConnection((status: ConnectionStatus) => {
      if (status === 'offline') {
        setStage(prev => {
          // Only trigger if we're currently in the wizard (not already in lost state)
          if (prev === 'wizard') return 'internet-lost-mid'
          return prev
        })
      }
      if (status === 'online') {
        setStage(prev => {
          // Auto-recover from lost state back to wizard
          if (prev === 'internet-lost-mid') return 'wizard'
          return prev
        })
      }
    }, 5000)
  }

  function stopMidFillWatch() {
    midFillWatcherRef.current?.stop()
    midFillWatcherRef.current = null
  }

  useEffect(() => {
    // Start mid-fill watch when wizard opens, stop when it closes
    if (stage === 'wizard' || stage === 'internet-lost-mid') {
      if (!midFillWatcherRef.current) startMidFillWatch()
    } else {
      stopMidFillWatch()
    }
    return () => { /* cleanup on unmount */ }
  }, [stage])

  useEffect(() => {
    return () => stopMidFillWatch()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Landing → internet gate (first launch) or wizard (re-run)
  const handleOpenWizard = useCallback(() => {
    if (isRerun) {
      setStage('wizard')
    } else {
      setStage('internet-check')
    }
  }, [isRerun])

  // Internet gate confirmed online → open wizard
  const handleInternetConfirmed = useCallback(() => {
    setStage('wizard')
  }, [])

  // Wizard complete → persist data
  const handleWizardComplete = useCallback(async (data: OnboardingData) => {
    wizardDataRef.current = data
    stopMidFillWatch()
    setStage('saving')
    setSaveError(null)

    // ── DB write ────────────────────────────────────────────────────────────
    const result = await persistOnboardingData(data)

    if (!result.success) {
      setSaveError(result.error ?? 'Unknown error')
      // Drop back to wizard so user is not stuck
      setStage('wizard')
      return
    }

    // ── Config file update ──────────────────────────────────────────────────
    const monthMap: Record<string, number> = {
      January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
      July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
    }

    updateConfig({
      onboardingComplete:  true,
      companyProfileId:    'default',
      fyStartMonth:        monthMap[data.financialYearStartMonth] ?? 4,
      billResetCycle:      data.billResetCycle as 'yearly' | 'monthly' | 'never' || 'yearly',
      startingBillNumber:  parseInt(data.startingBillNumber || '1', 10),
      currentBillNumber:   parseInt(data.startingBillNumber || '1', 10),
    })

    // ── Redirect to Dashboard ───────────────────────────────────────────────
    // Setting onboardingComplete = true in ConfigContext causes App.tsx's
    // RootContent to switch from <OnboardingPage> to <AppShell> (Dashboard).
    // The updateConfig call above triggers this — no explicit navigation needed.
    setStage('complete')

    // Re-run: notify Settings parent so it can hide the wizard and return to Settings UI
    if (isRerun && onRerunComplete) {
      onRerunComplete()
    }
  }, [updateConfig])

  // Wizard closed (exit button)
  const handleWizardClose = useCallback(() => {
    stopMidFillWatch()
    if (isRerun) {
      // Re-run: going back makes no sense (no landing screen); do nothing meaningful
      // Parent (Settings) should handle unmounting this component
      setStage('wizard') // Keep wizard open — can't "exit" without losing context
    } else {
      setStage('landing')
    }
  }, [isRerun])

  // Mid-fill: user chooses to continue filling without internet
  const handleResumeAnyway = useCallback(() => {
    setStage('wizard')
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────

  // 'complete' — for first launch: updateConfig(onboardingComplete: true) will cause App.tsx
  // to switch to AppShell, so this component unmounts naturally.
  // For re-run: onRerunComplete() was already called above; Settings will set showRerun=false.
  // Show saving overlay briefly in both cases.
  if (stage === 'saving' || stage === 'complete') {
    return <SavingOverlay />
  }

  return (
    <>
      {/* ── Base layer: Landing screen (first launch) or blank bg (re-run) ── */}
      {!isRerun && (
        <LandingScreen onOpenWizard={handleOpenWizard} />
      )}

      {/* ── Internet gate: shown before wizard opens (first launch only) ─── */}
      {stage === 'internet-check' && (
        <InternetGate
          firstLaunch={true}
          onOnline={handleInternetConfirmed}
        />
      )}

      {/* ── Onboarding wizard ──────────────────────────────────────────────── */}
      {(stage === 'wizard' || stage === 'internet-lost-mid') && (
        <OnboardingWizard
          onClose={handleWizardClose}
          onComplete={handleWizardComplete}
          saveError={saveError ?? undefined}
          onClearSaveError={() => setSaveError(null)}
        />
      )}

      {/* ── Mid-fill internet loss overlay (over the wizard) ──────────────── */}
      {stage === 'internet-lost-mid' && (
        <InternetGate
          firstLaunch={false}
          onOnline={handleInternetConfirmed}
          onResumeAnyway={handleResumeAnyway}
        />
      )}
    </>
  )
}
