/**
 * cQikly — Dark Rainbow Background
 * Phase: 3b-ii
 *
 * Animated full-spectrum hue shift applied via CSS custom properties.
 * The background slowly cycles through all hues with deep dark saturation.
 * Also drives --cq-accent and --cq-glow so all UI elements phase-shift.
 *
 * Performance tiers:
 *   Lite     → null (no animation; falls back to static CSS vars)
 *   Balanced → slow 120s cycle, gentle
 *   Ultra    → 60s cycle, richer gradient overlay
 *
 * Uses requestAnimationFrame to update CSS vars on :root directly.
 * No canvas, no Three.js — pure CSS variable animation.
 */

import React, { useEffect } from 'react'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useTheme } from '../../contexts/ThemeContext'

// How many seconds for a full hue cycle
const CYCLE_SECONDS = { lite: 0, balanced: 120, ultra: 60 }

function hslFromHue(hue: number, isDark: boolean): string {
  return isDark
    ? `hsl(${hue}, 60%, 8%)`        // deep dark tinted bg
    : `hsl(${hue}, 70%, 95%)`       // soft light tinted bg
}

function accentFromHue(hue: number): string {
  return `hsl(${hue}, 80%, 62%)`
}

function glowFromHue(hue: number): string {
  return `hsl(${hue}, 90%, 55%)`
}

export function DarkRainbowBackground(): React.ReactElement | null {
  const { mode, animationsEnabled } = usePerformance()
  const { themeId, variant } = useTheme()

  const isRainbow = themeId === 'dark-rainbow'

  useEffect(() => {
    if (!animationsEnabled || !isRainbow) return

    const cycleSecs = CYCLE_SECONDS[mode] || 120
    const root = document.documentElement
    let rafId = 0
    let startTime: number | null = null

    const animate = (ts: number): void => {
      if (startTime === null) startTime = ts
      const elapsed = (ts - startTime) / 1000
      const hue = ((elapsed / cycleSecs) * 360) % 360
      const isDark = variant === 'dark'

      // Primary bg hue
      root.style.setProperty('--cq-bg-primary', hslFromHue(hue, isDark))
      // Secondary bg (shifted +20°)
      root.style.setProperty('--cq-bg-secondary', hslFromHue((hue + 20) % 360, isDark))
      // Accent and glow follow hue offset
      root.style.setProperty('--cq-accent', accentFromHue((hue + 60) % 360))
      root.style.setProperty('--cq-glow', glowFromHue((hue + 60) % 360))
      root.style.setProperty('--cq-accent-light', accentFromHue((hue + 80) % 360))
      // Border gets a subtle tint
      root.style.setProperty('--cq-border', `hsl(${hue}, 30%, ${isDark ? '18' : '80'}%)`)
      // Surface
      root.style.setProperty('--cq-surface', hslFromHue((hue + 5) % 360, isDark))
      root.style.setProperty('--cq-surface-raised', hslFromHue((hue + 10) % 360, isDark))

      rafId = requestAnimationFrame(animate)
    }

    rafId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafId)
      // Clear dynamic props so static theme vars take over on unmount
      const props = [
        '--cq-bg-primary', '--cq-bg-secondary', '--cq-accent', '--cq-glow',
        '--cq-accent-light', '--cq-border', '--cq-surface', '--cq-surface-raised',
      ]
      props.forEach(p => root.style.removeProperty(p))
    }
  }, [mode, animationsEnabled, isRainbow, variant])

  // No canvas element needed — pure CSS variable animation
  return null
}
