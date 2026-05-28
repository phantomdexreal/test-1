/**
 * cQikly — Neon Background
 * Phase: 3b-ii
 *
 * Cyberpunk/synthwave aesthetic:
 *   • Scanline overlay via a fixed canvas (subtle horizontal lines)
 *   • Neon grid perspective floor (Three.js, Ultra only)
 *   • Pulsing glow animations injected via CSS @keyframes on :root custom vars
 *   • Flicker effect on --cq-glow (subtle, non-distracting)
 *
 * Performance tiers:
 *   Lite     → null
 *   Balanced → scanlines + CSS glow pulse only
 *   Ultra    → scanlines + CSS glow pulse + Three.js grid
 */

import React, { useEffect, useRef } from 'react'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useTheme } from '../../contexts/ThemeContext'
import * as THREE from 'three'

// ─── Scanlines canvas ─────────────────────────────────────────────────────────

function useScanlines(canvasRef: React.RefObject<HTMLCanvasElement>, active: boolean): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = (): void => {
      canvas.width  = canvas.clientWidth
      canvas.height = canvas.clientHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Draw subtle scanlines every 3px
      for (let y = 0; y < canvas.height; y += 3) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)'
        ctx.fillRect(0, y, canvas.width, 1)
      }
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [active])
}

// ─── Glow pulse via CSS var ───────────────────────────────────────────────────

function useNeonGlowPulse(active: boolean, variant: 'dark' | 'light'): void {
  useEffect(() => {
    if (!active) return
    const root = document.documentElement
    let t = 0
    let rafId = 0

    const COLORS_DARK = ['#00f5d4', '#ff00ff', '#39ff14', '#00cfff']
    const COLORS_LIGHT = ['#009984', '#7c00b5', '#1da012', '#0088b3']
    const colors = variant === 'dark' ? COLORS_DARK : COLORS_LIGHT
    let colorIdx = 0
    let colorT = 0

    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      t += 0.015
      colorT += 0.004

      // Slow flicker on glow intensity
      const intensity = 0.7 + Math.sin(t) * 0.15 + Math.sin(t * 2.3) * 0.08
      const baseGlow = colors[colorIdx % colors.length]

      // Blend to next color every ~8s
      if (colorT > Math.PI) { colorIdx++; colorT = 0 }

      root.style.setProperty('--cq-glow', baseGlow)

      // Subtle accent cycle
      const accentHue = variant === 'dark' ? 176 : 170
      root.style.setProperty(
        '--cq-accent',
        `hsl(${accentHue + Math.sin(t * 0.3) * 20}, ${80 + intensity * 20}%, ${45 + intensity * 10}%)`
      )
    }
    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      root.style.removeProperty('--cq-glow')
      root.style.removeProperty('--cq-accent')
    }
  }, [active, variant])
}

// ─── Three.js neon grid (Ultra only) ─────────────────────────────────────────

function useNeonGrid(canvasRef: React.RefObject<HTMLCanvasElement>, active: boolean): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 100)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, 0)

    // Neon grid floor
    const gridHelper = new THREE.GridHelper(40, 40, 0x00f5d4, 0x003344)
    gridHelper.position.y = -1
    scene.add(gridHelper)

    // A few floating neon bars / lines
    const barMat = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4 })
    for (let i = 0; i < 6; i++) {
      const pts = [
        new THREE.Vector3(-8 + i * 3, -0.5 + Math.random(), -5 - Math.random() * 5),
        new THREE.Vector3(-8 + i * 3 + 1.5, -0.5 + Math.random(), -5 - Math.random() * 5),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      scene.add(new THREE.Line(geo, barMat))
    }

    let rafId = 0
    let t = 0
    const animate = (): void => {
      rafId = requestAnimationFrame(animate)
      t += 0.005
      camera.position.z = 5 + Math.sin(t) * 0.5
      renderer.render(scene, camera)
    }
    animate()

    const onResize = (): void => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }, [active])
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NeonBackground(): React.ReactElement | null {
  const { mode, animationsEnabled } = usePerformance()
  const { themeId, variant } = useTheme()
  const scanCanvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)

  const isNeon = themeId === 'neon'
  const scanActive = animationsEnabled && isNeon
  const gridActive = mode === 'ultra' && isNeon && animationsEnabled

  useScanlines(scanCanvasRef, scanActive)
  useNeonGlowPulse(scanActive, variant)
  useNeonGrid(gridCanvasRef, gridActive)

  if (!scanActive) return null

  return (
    <>
      {/* Three.js grid — Ultra only */}
      {gridActive && (
        <canvas
          ref={gridCanvasRef}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 0, opacity: 0.35,
          }}
        />
      )}
      {/* Scanlines overlay */}
      <canvas
        ref={scanCanvasRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 1,
        }}
      />
    </>
  )
}
