/**
 * cQikly — LanguageContext (i18n)
 * Built in: Phase 1a-ii-B
 *
 * Responsibilities:
 *   - Every UI string goes through t() from Day One — never raw strings
 *   - English strings (en.ts) wired as default and sole active locale for now
 *   - Regional locales (Hindi, Kannada, Tamil…) addable later with ZERO structural
 *     changes — just add a new locale file and update LOCALE_MAP
 *   - Language switch applies instantly across the entire UI — no restart
 *   - Emits eventBus 'languageChange' on every switch
 *   - Listens to eventBus 'configChange' — if key === 'language', syncs
 *
 * t() behaviour:
 *   - Looks up key in active locale strings
 *   - Falls back to English strings if key is missing from non-English locale
 *   - Falls back to the key itself if missing from English (no silent empty strings)
 *   - Supports basic variable interpolation: t('billing.total', { amount: '100' })
 *     → replaces {{amount}} in the string
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import en from '../i18n/en'
import { eventBus } from '../utils/eventBus'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupportedLanguage = 'en' // | 'hi' | 'kn' | 'ta' — added in future phases

export type LocaleStrings = Record<string, string>

export interface LanguageContextValue {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => void
  /**
   * Translate a key with optional variable interpolation.
   * t('ui.greeting', { name: 'Alice' }) → replaces {{name}} in the string.
   * Falls back: locale → English → key itself.
   */
  t: (key: string, vars?: Record<string, string | number>) => string
}

// ─── Locale map — add new locales here only ───────────────────────────────────

const LOCALE_MAP: Record<SupportedLanguage, LocaleStrings> = {
  en: en as LocaleStrings,
  // hi: hi,  // Phase future
  // kn: kn,
  // ta: ta,
}

// ─── Translation helper ───────────────────────────────────────────────────────

function translate(
  key: string,
  activeStrings: LocaleStrings,
  fallbackStrings: LocaleStrings,
  vars?: Record<string, string | number>
): string {
  const raw =
    activeStrings[key] ??
    fallbackStrings[key] ??
    key  // last resort: show key so missing translations are visible

  if (!vars) return raw

  // Replace {{varName}} placeholders
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{{${name}}}`
  )
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface LanguageProviderProps {
  children: React.ReactNode
  /** Initial language — passed from ConfigContext (config.language) */
  initialLanguage?: SupportedLanguage
}

export function LanguageProvider({
  children,
  initialLanguage = 'en',
}: LanguageProviderProps): React.ReactElement {
  const [language, setLanguageState] = useState<SupportedLanguage>(
    // Guard: if saved language isn't in LOCALE_MAP yet, fall back to 'en'
    (initialLanguage in LOCALE_MAP ? initialLanguage : 'en') as SupportedLanguage
  )

  // ── Sync from configChange events (Settings page changes language) ──────────
  useEffect(() => {
    return eventBus.on('configChange', ({ key, value }) => {
      if (key === 'language' && typeof value === 'string' && value in LOCALE_MAP) {
        setLanguageState(value as SupportedLanguage)
      }
    })
  }, [])

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    if (!(lang in LOCALE_MAP)) {
      console.warn(`[LanguageContext] Locale "${lang}" not in LOCALE_MAP — ignoring`)
      return
    }
    setLanguageState(lang)
    eventBus.emit('languageChange', { language: lang })
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const activeStrings   = LOCALE_MAP[language] ?? {}
      const fallbackStrings = LOCALE_MAP['en']
      return translate(key, activeStrings, fallbackStrings, vars)
    },
    [language]
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage() must be used inside <LanguageProvider>')
  return ctx
}
