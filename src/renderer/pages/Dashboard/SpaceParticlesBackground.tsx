/**
 * cQikly — Space Particles Background
 * Phase: 3a-A
 *
 * Three.js particle system rendered to a <canvas> behind the dashboard content.
 * Respects performance mode:
 *   Lite     → canvas not mounted at all (returns null)
 *   Balanced → 800 particles, slow drift
 *   Ultra    → 2000 particles, richer motion
 *
 * Tears down cleanly when unmounted (dispose renderer, cancel RAF).
 * Only active when theme is 'space-particles'.
 */

import React, { useEffect, useRef } from 'react'
import { usePerformance } from '../../contexts/PerformanceContext'
import { useTheme } from '../../contexts/ThemeContext'

// Three is a peer dep (already in package.json); import via dynamic to avoid
// blocking the renderer bundle when Three is heavy.
// For simplicity we import synchronously (Three.js tree-shaking is handled by Vite).
import * as THREE from 'three'

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTICLE_COUNTS = {
  lite:     0,
  balanced: 800,
  ultra:    2000,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpaceParticlesBackground(): React.ReactElement | null {
  const { mode, animationsEnabled } = usePerformance()
  const { themeId } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  const isSpaceTheme = themeId === 'space-particles'

  // Don't mount if Lite mode or not the space-particles theme
  if (!animationsEnabled || !isSpaceTheme) return null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const count = PARTICLE_COUNTS[mode] || 800

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)

    // ── Scene + Camera ────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 1000)
    camera.position.z = 5

    // ── Particle Geometry ─────────────────────────────────────────────────────
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3) // vx, vy, vz per particle
    const sizes     = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 20  // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20  // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10  // z

      velocities[i * 3]     = (Math.random() - 0.5) * 0.003
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.003
      velocities[i * 3 + 2] = 0

      sizes[i] = Math.random() * 2 + 0.5
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

    // ── Material ──────────────────────────────────────────────────────────────
    const material = new THREE.PointsMaterial({
      color: 0x9d7fff,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
    })

    const particles = new THREE.Points(geometry, material)
    scene.add(particles)

    // ── Nebula glow sprites (a handful of large blurry spheres) ───────────────
    const nebulaColors = [0x6d28d9, 0x3b0764, 0x1e1b4b, 0x312e81]
    for (let n = 0; n < 4; n++) {
      const sphereGeo = new THREE.SphereGeometry(0.8 + Math.random() * 1.2, 8, 8)
      const sphereMat = new THREE.MeshBasicMaterial({
        color: nebulaColors[n % nebulaColors.length],
        transparent: true,
        opacity: 0.04 + Math.random() * 0.04,
      })
      const sphere = new THREE.Mesh(sphereGeo, sphereMat)
      sphere.position.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        -2 - Math.random() * 2
      )
      scene.add(sphere)
    }

    // ── Animation loop ────────────────────────────────────────────────────────
    let rafId = 0
    const posAttr = geometry.attributes.position as THREE.BufferAttribute

    const animate = (): void => {
      rafId = requestAnimationFrame(animate)

      // Drift each particle
      for (let i = 0; i < count; i++) {
        posAttr.array[i * 3]     += velocities[i * 3]
        posAttr.array[i * 3 + 1] += velocities[i * 3 + 1]

        // Wrap around bounds
        if ((posAttr.array[i * 3] as number) > 10)  (posAttr.array as Float32Array)[i * 3] = -10
        if ((posAttr.array[i * 3] as number) < -10) (posAttr.array as Float32Array)[i * 3] = 10
        if ((posAttr.array[i * 3 + 1] as number) > 10)  (posAttr.array as Float32Array)[i * 3 + 1] = -10
        if ((posAttr.array[i * 3 + 1] as number) < -10) (posAttr.array as Float32Array)[i * 3 + 1] = 10
      }
      posAttr.needsUpdate = true

      // Slow camera drift
      particles.rotation.z += 0.00008

      renderer.render(scene, camera)
    }

    animate()

    // ── Resize handler ────────────────────────────────────────────────────────
    const onResize = (): void => {
      if (!canvas) return
      renderer.setSize(canvas.clientWidth, canvas.clientHeight)
      camera.aspect = canvas.clientWidth / canvas.clientHeight
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Cleanup ────────────────────────────────────────────────────────────────
    cleanupRef.current = () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }

    return () => { cleanupRef.current?.() }
  }, [mode, isSpaceTheme])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
