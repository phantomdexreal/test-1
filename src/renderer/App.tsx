/**
 * cQikly — App.tsx
 * Phase: 2a-A
 *
 * Context wrap order (outer → inner):
 *   1. ConfigContext       — loads AppData config file; persists on change
 *   2. ThemeContext        — CSS variable system; all 6 themes × dark/light
 *   3. DBContext           — atomic SQLite connection manager; hot-swap
 *   4. PerformanceContext  — lite/balanced/ultra; derived animation + polling flags
 *   5. LanguageContext     — i18n; all strings through t() from Day One
 *   6. FeatureFlagContext  — boolean-gated module toggles reading from ConfigContext
 *   7. NavigationContext   — active page state + Ctrl+1-6 keyboard shortcuts
 *
 * Phase 2a-A adds:
 *   - Onboarding gate: if config.onboardingComplete is false, render OnboardingPage
 *     (Three.js landing screen + wizard placeholder) instead of AppShell.
 *   - Performance mode respected: Lite skips Three.js, shows static bg instead.
 */

import React from 'react'

// ─── Context Providers ────────────────────────────────────────────────────────
import { ConfigProvider,      useConfig }      from './contexts/ConfigContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { DBProvider }                          from './contexts/DBContext'
import { PerformanceProvider }                 from './contexts/PerformanceContext'
import { LanguageProvider }                    from './contexts/LanguageContext'
import { FeatureFlagProvider }                 from './contexts/FeatureFlagContext'
import { NavigationProvider }                  from './contexts/NavigationContext'

// ─── Safety System Components (1b-A) ─────────────────────────────────────────
import { AppLockGate }          from './components/AppLockGate'
import { CrashRecoveryPrompt }  from './components/CrashRecoveryPrompt'
import { UpdateToast }          from './components/UpdateToast'

// ─── Phase 1b-B Shell ─────────────────────────────────────────────────────────
import { AppShell } from './components/AppShell'

// ─── Phase 2a-A Onboarding ────────────────────────────────────────────────────
import OnboardingPage from './pages/Onboarding'

// ─── Root content: onboarding gate ───────────────────────────────────────────

function RootContent(): React.ReactElement {
  const { config, isLoaded } = useConfig()

  // While config is loading from IPC, show nothing (prevents onboarding flash)
  if (!isLoaded) {
    return <AppBootLoader />
  }

  // Gate: show landing/onboarding until onboardingComplete is set
  if (!config.onboardingComplete) {
    return <OnboardingPage />
  }

  return (
    <NavigationProvider>
      <AppLockGate>
        <AppShell />
        {/* Safety system overlays — non-blocking floats */}
        <UpdateToast />
        <CrashRecoveryPrompt />
      </AppLockGate>
    </NavigationProvider>
  )
}

function AppBootLoader(): React.ReactElement {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cq-bg-primary, #0f0f13)',
    }}>
      <div style={{
        width: 28,
        height: 28,
        border: '3px solid rgba(255,255,255,0.08)',
        borderTop: '3px solid var(--cq-accent, #8b5cf6)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Root App — all providers in correct order ─────────────────────────────────

function App(): React.ReactElement {
  return (
    <ConfigProvider>
      <ZoomBootstrap>
        <ThemeConsumerBridge>
          <DBProvider>
            <PerformanceConsumerBridge>
              <LanguageConsumerBridge>
                <FeatureFlagConsumerBridge>
                  <RootContent />
                </FeatureFlagConsumerBridge>
              </LanguageConsumerBridge>
            </PerformanceConsumerBridge>
          </DBProvider>
        </ThemeConsumerBridge>
      </ZoomBootstrap>
    </ConfigProvider>
  )
}

// ─── Consumer Bridges ─────────────────────────────────────────────────────────

function ThemeConsumerBridge({ children }: { children: React.ReactNode }): React.ReactElement {
  const { config, isLoaded } = useConfig()
  if (!isLoaded) {
    return <ThemeProvider>{children}</ThemeProvider>
  }
  return (
    <ThemeProvider
      initialThemeId={config.themeId as import('./themes').ThemeId}
      initialVariant={config.themeVariant}
    >
      {children}
    </ThemeProvider>
  )
}

function PerformanceConsumerBridge({ children }: { children: React.ReactNode }): React.ReactElement {
  const { config } = useConfig()
  return (
    <PerformanceProvider
      initialMode={config.performanceMode as import('./contexts/PerformanceContext').PerformanceMode}
    >
      {children}
    </PerformanceProvider>
  )
}

function LanguageConsumerBridge({ children }: { children: React.ReactNode }): React.ReactElement {
  const { config } = useConfig()
  return (
    <LanguageProvider
      initialLanguage={config.language as import('./contexts/LanguageContext').SupportedLanguage}
    >
      {children}
    </LanguageProvider>
  )
}

function FeatureFlagConsumerBridge({ children }: { children: React.ReactNode }): React.ReactElement {
  const { config, updateConfig } = useConfig()
  return (
    <FeatureFlagProvider
      initialFlags={config.featureFlags as Record<string, boolean> | undefined}
      updateConfig={updateConfig}
    >
      {children}
    </FeatureFlagProvider>
  )
}

/**
 * ZoomBootstrap — applies the persisted app zoom on first load.
 * Must live inside ConfigProvider so it can read config.
 * Phase 11a-ii: App-level zoom / font size slider.
 */
function ZoomBootstrap({ children }: { children: React.ReactNode }): React.ReactElement {
  const { config, isLoaded } = useConfig()

  React.useEffect(() => {
    if (!isLoaded) return
    const zoom = (config.appZoom as number) ?? 1.0
    if (zoom !== 1.0) {
      document.documentElement.style.fontSize = `${zoom * 16}px`
    }
  }, [isLoaded, config.appZoom])

  return <>{children}</>
}

export default App
