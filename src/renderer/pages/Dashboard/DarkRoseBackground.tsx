/**
 * cQikly — Dark Rose Background
 * Phase: 3b-ii
 *
 * Deep dark background with animated rose/mauve floating elements:
 *   • Slowly drifting rose-petal silhouettes (2D canvas)
 *   • Subtle radial glow pulses in rose/mauve
 *   • A gentle shimmer on the accent color via CSS vars
 *
 * Performance tiers:
 *   Lite     → null
 *   Balanced → 25 elements, slow drift, no glow pulse
 *   Ultra    → 50 elements, glow pulse, shimmer
 */

import React, { useEffect, useRef } from 'react'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useTheme } from '../../contexts/ThemeContext'

const ELEMENT_COUNTS = { lite: 0, balanced: 25, ultra: 50 }

interface RoseElement {
  x: number; y: number
  size: number; opacity: number
  speedX: number; speedY: number
  rotation: number; rotSpeed: number
  type: 'petal' | 'circle' | 'ring'
  pulse: number; pulseSpeed: number
}

function makeElement(w: number, h: number): RoseElement {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: 10 + Math.random() * 30,
    opacity: 0.05 + Math.random() * 0.18,
    speedX: (Math.random() - 0.5) * 0.15,
    speedY: (Math.random() - 0.5) * 0.15,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.008,
    type: (['petal', 'circle', 'ring'] as const)[Math.floor(Math.random() * 3)],
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.005 + Math.random() * 0.01,
  }
}

function drawElement(ctx: CanvasRenderingContext2D, el: RoseElement, isDark: boolean, t: number): void {
  ctx.save()
  ctx.translate(el.x, el.y)
  ctx.rotate(el.rotation)

  const pulseScale = 1 + Math.sin(el.pulse + t * el.pulseSpeed * 60) * 0.15
  const baseOpacity = el.opacity * pulseScale
  ctx.globalAlpha = Math.min(baseOpacity, 0.4)

  const roseColor = isDark ? '#c4648a' : '#a03060'
  const mauveColor = isDark ? '#9b59b6' : '#7d2e7e'

  const s = el.size * pulseScale

  if (el.type === 'petal') {
    // Rose petal: elongated teardrop
    ctx.beginPath()
    ctx.moveTo(0, -s)
    ctx.bezierCurveTo(s * 0.6, -s * 0.5, s * 0.4, s * 0.5, 0, s * 0.3)
    ctx.bezierCurveTo(-s * 0.4, s * 0.5, -s * 0.6, -s * 0.5, 0, -s)
    ctx.fillStyle = roseColor
    ctx.fill()
  } else if (el.type === 'circle') {
    // Soft glowing circle
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s)
    grad.addColorStop(0, isDark ? 'rgba(196,100,138,0.8)' : 'rgba(160,48,96,0.8)')
    grad.addColorStop(1, 'rgba(196,100,138,0)')
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
  } else {
    // Ring
    ctx.beginPath()
    ctx.arc(0, 0, s, 0, Math.PI * 2)
    ctx.strokeStyle = mauveColor
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  ctx.restore()
}

// ─── Accent shimmer via CSS vars ──────────────────────────────────────────────

function useRoseShimmer(active: boolean, isUltra: boolean, variant: 'dark' | 'light'): void {
  useEffect(() => {
    if (!active || !isUltra) return
    const root = document.documentElement
    let t = 0
    let rafId = 0
    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      t += 0.008
      const hue = 330 + Math.sin(t) * 15
      const lightness = variant === 'dark' ? 45 + Math.sin(t * 1.3) * 8 : 38 + Math.sin(t * 1.3) * 6
      root.style.setProperty('--cq-accent', `hsl(${hue}, 65%, ${lightness}%)`)
      root.style.setProperty('--cq-glow', `hsl(${hue + 10}, 70%, ${lightness + 5}%)`)
    }
    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      root.style.removeProperty('--cq-accent')
      root.style.removeProperty('--cq-glow')
    }
  }, [active, isUltra, variant])
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DarkRoseBackground(): React.ReactElement | null {
  const { mode, animationsEnabled } = usePerformance()
  const { themeId, variant } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isDarkRose = themeId === 'dark-rose'
  const isActive = animationsEnabled && isDarkRose
  const isUltra = mode === 'ultra'

  useRoseShimmer(isActive, isUltra, variant)

  useEffect(() => {
    if (!isActive) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let t = 0
    const count = ELEMENT_COUNTS[mode] || 25
    const isDark = variant === 'dark'

    const resize = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const elements: RoseElement[] = Array.from({ length: count }, () =>
      makeElement(canvas.width, canvas.height)
    )

    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.01

      for (const el of elements) {
        el.x += el.speedX
        el.y += el.speedY
        el.rotation += el.rotSpeed
        el.pulse += el.pulseSpeed

        // Wrap
        if (el.x < -50) el.x = canvas.width + 50
        if (el.x > canvas.width + 50) el.x = -50
        if (el.y < -50) el.y = canvas.height + 50
        if (el.y > canvas.height + 50) el.y = -50

        drawElement(ctx, el, isDark, t)
      }
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [mode, isActive, variant])

  if (!isActive) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
      }}
    />
  )
}
