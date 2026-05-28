/**
 * cQikly — Sakura Flowers Background
 * Phase: 3b-ii
 *
 * Canvas-based falling cherry blossom petals.
 * No Three.js — uses 2D Canvas API for lightweight elegance.
 *
 * Performance tiers:
 *   Lite     → null (not mounted)
 *   Balanced → 40 petals, gentle drift
 *   Ultra    → 90 petals, richer motion, occasional gusts
 *
 * Dark variant: petals are semi-transparent rose/pink on deep dark bg.
 * Light variant: petals are deeper pink on soft light bg.
 */

import React, { useEffect, useRef } from 'react'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useTheme } from '../../contexts/ThemeContext'

const PETAL_COUNTS = { lite: 0, balanced: 40, ultra: 90 }

interface Petal {
  x: number; y: number
  size: number
  speedY: number; speedX: number
  rotation: number; rotSpeed: number
  opacity: number; sway: number; swayOffset: number
}

function makePetal(w: number, h: number): Petal {
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    size: 6 + Math.random() * 10,
    speedY: 0.6 + Math.random() * 1.2,
    speedX: (Math.random() - 0.5) * 0.5,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    opacity: 0.4 + Math.random() * 0.5,
    sway: 1.5 + Math.random() * 2.5,
    swayOffset: Math.random() * Math.PI * 2,
  }
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, isDark: boolean): void {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.rotate(p.rotation)
  ctx.globalAlpha = p.opacity

  // Petal shape: 5 rounded lobes
  const s = p.size
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
    const lx = Math.cos(angle) * s * 0.5
    const ly = Math.sin(angle) * s * 0.5
    if (i === 0) ctx.moveTo(lx, ly)
    else ctx.quadraticCurveTo(0, 0, lx, ly)
  }
  ctx.closePath()

  // Colour based on variant
  const baseColor = isDark ? `rgba(232,105,138,${p.opacity})` : `rgba(198,58,100,${p.opacity})`
  const centerColor = isDark ? `rgba(255,180,200,${p.opacity * 0.6})` : `rgba(240,120,150,${p.opacity * 0.6})`
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.5)
  grad.addColorStop(0, centerColor)
  grad.addColorStop(1, baseColor)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.restore()
}

export function SakuraBackground(): React.ReactElement | null {
  const { mode, animationsEnabled } = usePerformance()
  const { themeId, variant } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isSakura = themeId === 'sakura'
  if (!animationsEnabled || !isSakura) return null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let t = 0
    const count = PETAL_COUNTS[mode] || 40
    const isDark = variant === 'dark'

    const resize = (): void => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const petals: Petal[] = Array.from({ length: count }, () =>
      makePetal(canvas.width, canvas.height)
    )

    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.01

      for (const p of petals) {
        p.y += p.speedY
        p.x += p.speedX + Math.sin(t + p.swayOffset) * p.sway * 0.02
        p.rotation += p.rotSpeed

        // Wrap when off-screen
        if (p.y > canvas.height + 20) {
          Object.assign(p, makePetal(canvas.width, canvas.height))
          p.y = -20
        }
        if (p.x < -20) p.x = canvas.width + 20
        if (p.x > canvas.width + 20) p.x = -20

        drawPetal(ctx, p, isDark)
      }
    }

    animate()
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [mode, isSakura, variant])

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
