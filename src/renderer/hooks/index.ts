/**
 * cQikly — Hook re-exports
 * Central barrel so imports are short: import { usePerformance } from '../hooks'
 */

export { useConfig }                        from '../contexts/ConfigContext'
export { useTheme }                         from '../contexts/ThemeContext'
export { useDB }                            from '../contexts/DBContext'
export { usePerformance }                   from '../contexts/PerformanceContext'
export { useLanguage }                      from '../contexts/LanguageContext'
export { useFeatureFlag, useFlag }          from '../contexts/FeatureFlagContext'
export { useGlobalShortcuts }              from './useGlobalShortcuts'
