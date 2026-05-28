/**
 * cQikly — ThemeBackground
 * Phase: 3b-ii
 *
 * Single entry point for all animated theme backgrounds.
 * Renders the correct background component based on the active themeId.
 * Each component self-terminates if performance mode is Lite.
 *
 * Themes:
 *   space-particles → SpaceParticlesBackground  (Three.js)
 *   sakura          → SakuraBackground          (2D Canvas petals)
 *   minimal         → null                      (no animation, by design)
 *   dark-rainbow    → DarkRainbowBackground     (CSS var hue cycle)
 *   neon            → NeonBackground            (scanlines + Three.js grid)
 *   dark-rose       → DarkRoseBackground        (2D Canvas + CSS var shimmer)
 *
 * Hot-swap: switching theme replaces the component key instantly.
 * Zero flicker because CSS vars are already applied by ThemeContext before this mounts.
 */

import React from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import { SpaceParticlesBackground } from './SpaceParticlesBackground'
import { SakuraBackground } from './SakuraBackground'
import { DarkRainbowBackground } from './DarkRainbowBackground'
import { NeonBackground } from './NeonBackground'
import { DarkRoseBackground } from './DarkRoseBackground'

export function ThemeBackground(): React.ReactElement | null {
  const { themeId } = useTheme()

  switch (themeId) {
    case 'space-particles': return <SpaceParticlesBackground key="space-particles" />
    case 'sakura':          return <SakuraBackground         key="sakura" />
    case 'minimal':         return null
    case 'dark-rainbow':    return <DarkRainbowBackground    key="dark-rainbow" />
    case 'neon':            return <NeonBackground           key="neon" />
    case 'dark-rose':       return <DarkRoseBackground       key="dark-rose" />
    default:                return null
  }
}
