/**
 * cQikly — LandingScreen
 * Built in: Phase 2a-A
 *
 * Full-screen animated landing shown on first launch before onboarding completes.
 *
 * Sections:
 *   1. ThreeJSCanvas     — deep-space particle system via Three.js (Balanced/Ultra only)
 *   2. LiteBackground    — static CSS-only deep space gradient (Lite mode)
 *   3. AnimatedTitle     — "cQikly" text with glow + floating animation
 *   4. ClickTrigger      — clicking the title fires onOpenWizard()
 *   5. LandingScreen     — composes all of the above; exported as default
 *
 * Performance rules (Hard Spec #12 / Section 6):
 *   Lite     → No Three.js canvas, no Framer Motion; static gradient bg + CSS pulse on text
 *   Balanced → Three.js particle system (moderate count), CSS text animation
 *   Ultra    → Three.js particle system (full count + nebula), CSS text animation
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { usePerformance } from '../../contexts/PerformanceContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LandingScreenProps {
  /** Called when user clicks "cQikly" — parent opens wizard */
  onOpenWizard: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTICLE_COUNT_BALANCED = 3_000
const PARTICLE_COUNT_ULTRA    = 7_000

// Nebula cloud colour stops (Ultra only)
const NEBULA_COLORS = ['#1a0533', '#0a1a3d', '#0d0d1a', '#12002b']

// ─── Three.js Canvas ──────────────────────────────────────────────────────────

interface ThreeCanvasProps {
  particleCount: number
  showNebula: boolean
}

function ThreeJSCanvas({ particleCount, showNebula }: ThreeCanvasProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setClearColor(0x00000a, 1)
    mount.appendChild(renderer.domElement)

    // ── Scene & Camera ──
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      2000
    )
    camera.position.z = 600

    // ── Star field geometry ──
    const starPositions = new Float32Array(particleCount * 3)
    const starColors    = new Float32Array(particleCount * 3)
    const starSizes     = new Float32Array(particleCount)

    // Cool star colour palette
    const starPalette = [
      new THREE.Color('#ffffff'),  // white
      new THREE.Color('#aad4ff'),  // pale blue
      new THREE.Color('#ffd6a5'),  // warm orange
      new THREE.Color('#c9b6ff'),  // lavender
      new THREE.Color('#ffe4e1'),  // faint rose
    ]

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3
      starPositions[i3]     = (Math.random() - 0.5) * 2000
      starPositions[i3 + 1] = (Math.random() - 0.5) * 2000
      starPositions[i3 + 2] = (Math.random() - 0.5) * 1400

      const col = starPalette[Math.floor(Math.random() * starPalette.length)]
      starColors[i3]     = col.r
      starColors[i3 + 1] = col.g
      starColors[i3 + 2] = col.b

      starSizes[i] = Math.random() * 2.5 + 0.5
    }

    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starGeo.setAttribute('color',    new THREE.BufferAttribute(starColors, 3))
    starGeo.setAttribute('size',     new THREE.BufferAttribute(starSizes, 1))

    // Circular sprite texture
    const spriteCanvas = document.createElement('canvas')
    spriteCanvas.width = spriteCanvas.height = 64
    const ctx2d = spriteCanvas.getContext('2d')!
    const grad = ctx2d.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0,   'rgba(255,255,255,1)')
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)')
    grad.addColorStop(1,   'rgba(255,255,255,0)')
    ctx2d.fillStyle = grad
    ctx2d.fillRect(0, 0, 64, 64)
    const spriteTexture = new THREE.CanvasTexture(spriteCanvas)

    const starMat = new THREE.PointsMaterial({
      size:            2,
      map:             spriteTexture,
      vertexColors:    true,
      transparent:     true,
      opacity:         0.9,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const stars = new THREE.Points(starGeo, starMat)
    scene.add(stars)

    // ── Shooting-star group (bright streaks) ──
    const shooters: Array<{
      mesh: THREE.Line
      velocity: THREE.Vector3
      life: number
      maxLife: number
    }> = []

    const shooterMat = new THREE.LineBasicMaterial({
      color:       0xaad4ff,
      transparent: true,
      opacity:     0.9,
      blending:    THREE.AdditiveBlending,
    })

    function spawnShooter() {
      const length = Math.random() * 120 + 60
      const angle  = (Math.random() - 0.5) * Math.PI * 0.4 - Math.PI * 0.25
      const dx = Math.cos(angle) * length
      const dy = Math.sin(angle) * length

      const sx = (Math.random() - 0.5) * 1200
      const sy = (Math.random() - 0.5) * 700

      const pts = [
        new THREE.Vector3(sx, sy, 100),
        new THREE.Vector3(sx + dx * 0.3, sy + dy * 0.3, 100),
      ]
      const geo   = new THREE.BufferGeometry().setFromPoints(pts)
      const mesh  = new THREE.Line(geo, shooterMat.clone())
      scene.add(mesh)

      shooters.push({
        mesh,
        velocity: new THREE.Vector3(dx * 0.08, dy * 0.08, 0),
        life:     0,
        maxLife:  80 + Math.random() * 60,
      })
    }

    let shooterTimer = 0

    // ── Nebula quads (Ultra only) ──
    if (showNebula) {
      NEBULA_COLORS.forEach((colour, idx) => {
        const nGeo = new THREE.PlaneGeometry(900, 600)
        const nMat = new THREE.MeshBasicMaterial({
          color:       new THREE.Color(colour),
          transparent: true,
          opacity:     0.10 + idx * 0.015,
          blending:    THREE.AdditiveBlending,
          depthWrite:  false,
        })
        const nMesh = new THREE.Mesh(nGeo, nMat)
        nMesh.rotation.z = Math.random() * Math.PI
        nMesh.position.set(
          (Math.random() - 0.5) * 400,
          (Math.random() - 0.5) * 300,
          -200 - idx * 80
        )
        scene.add(nMesh)
      })
    }

    // ── Resize handler ──
    const onResize = (): void => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // ── Mouse parallax ──
    const mouse = { x: 0, y: 0 }
    const onMouseMove = (e: MouseEvent): void => {
      mouse.x = (e.clientX / window.innerWidth  - 0.5) * 2
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)

    // ── Animation loop ──
    let frame = 0
    let rafId: number
    let running = true

    const animate = (): void => {
      if (!running) return
      rafId = requestAnimationFrame(animate)
      frame++

      // Slow drift of entire star field
      stars.rotation.y += 0.00015
      stars.rotation.x += 0.00006

      // Mouse parallax on camera
      camera.position.x += (mouse.x * 40  - camera.position.x) * 0.015
      camera.position.y += (-mouse.y * 25 - camera.position.y) * 0.015
      camera.lookAt(scene.position)

      // Shooting stars
      shooterTimer++
      if (shooterTimer > 120 + Math.random() * 180) {
        spawnShooter()
        shooterTimer = 0
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const s = shooters[i]
        s.life++
        s.mesh.position.add(s.velocity)
        const m = s.mesh.material as THREE.LineBasicMaterial
        m.opacity = Math.max(0, 1 - s.life / s.maxLife) * 0.9
        if (s.life >= s.maxLife) {
          scene.remove(s.mesh)
          s.mesh.geometry.dispose()
          shooters.splice(i, 1)
        }
      }

      // Twinkle: vary overall star opacity slightly
      starMat.opacity = 0.85 + Math.sin(frame * 0.01) * 0.05

      renderer.render(scene, camera)
    }

    animate()

    // ── Cleanup ──
    return () => {
      running = false
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('mousemove', onMouseMove)
      starGeo.dispose()
      starMat.dispose()
      spriteTexture.dispose()
      shooters.forEach(s => { scene.remove(s.mesh); s.mesh.geometry.dispose() })
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [particleCount, showNebula])

  return (
    <div
      ref={mountRef}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
      }}
    />
  )
}

// ─── Lite background — pure CSS, zero JS animation ────────────────────────────

function LiteBackground(): React.ReactElement {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: `
          radial-gradient(ellipse at 20% 30%, #0d0730 0%, transparent 50%),
          radial-gradient(ellipse at 80% 70%, #00091f 0%, transparent 55%),
          radial-gradient(ellipse at 50% 50%, #070014 0%, transparent 80%),
          #02000a
        `,
      }}
    >
      {/* Static star dots via box-shadow trick */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.7 }}>
        {Array.from({ length: 120 }).map((_, i) => (
          <div
            key={i}
            style={{
              position:  'absolute',
              width:     `${Math.random() * 2 + 1}px`,
              height:    `${Math.random() * 2 + 1}px`,
              left:      `${Math.random() * 100}%`,
              top:       `${Math.random() * 100}%`,
              borderRadius: '50%',
              background:   i % 5 === 0 ? '#aad4ff' : i % 7 === 0 ? '#ffd6a5' : '#ffffff',
              opacity:   Math.random() * 0.6 + 0.3,
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Animated "cQikly" title ──────────────────────────────────────────────────

interface AnimatedTitleProps {
  onClick: () => void
  liteMode: boolean
  hovered: boolean
  onHoverIn: () => void
  onHoverOut: () => void
}

function AnimatedTitle({ onClick, liteMode, hovered, onHoverIn, onHoverOut }: AnimatedTitleProps): React.ReactElement {
  const glowColor = hovered ? '#c084fc' : '#a855f7'
  const scaleVal  = hovered ? 'scale(1.06)' : 'scale(1)'

  return (
    <div
      style={{
        position:   'relative',
        zIndex:     10,
        display:    'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        cursor:     'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onClick={onClick}
      onMouseEnter={onHoverIn}
      onMouseLeave={onHoverOut}
    >
      {/* Main title */}
      <div
        style={{
          fontFamily:     '"Inter", "Segoe UI", system-ui, sans-serif',
          fontSize:       'clamp(5rem, 12vw, 9rem)',
          fontWeight:     900,
          letterSpacing:  '-0.02em',
          lineHeight:     1,
          color:          '#ffffff',
          textShadow: hovered
            ? `0 0 30px ${glowColor}, 0 0 80px ${glowColor}, 0 0 160px rgba(168,85,247,0.5)`
            : `0 0 20px ${glowColor}, 0 0 60px rgba(168,85,247,0.6), 0 0 100px rgba(168,85,247,0.3)`,
          transform:      scaleVal,
          transition:     'transform 0.3s ease, text-shadow 0.3s ease',
          animation:      liteMode
            ? 'cq-title-lite-pulse 4s ease-in-out infinite'
            : 'cq-title-float 5s ease-in-out infinite',
          background:     'linear-gradient(135deg, #ffffff 0%, #d8b4fe 40%, #a78bfa 70%, #818cf8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
          backgroundClip:       'text',
        }}
      >
        cQikly
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontFamily:    '"Inter", "Segoe UI", system-ui, sans-serif',
          fontSize:      'clamp(0.9rem, 1.8vw, 1.25rem)',
          fontWeight:    400,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color:         'rgba(196,181,253,0.8)',
          animation:     liteMode ? 'none' : 'cq-sub-fade 5s ease-in-out infinite',
          animationDelay: '0.5s',
        }}
      >
        Billing &amp; Business Management
      </div>

      {/* Click hint */}
      <div
        style={{
          marginTop:     '8px',
          fontFamily:    '"Inter", "Segoe UI", system-ui, sans-serif',
          fontSize:      'clamp(0.75rem, 1.4vw, 1rem)',
          fontWeight:    400,
          color:         'rgba(167,139,250,0.7)',
          letterSpacing: '0.12em',
          animation:     liteMode ? 'cq-hint-lite-blink 3s ease-in-out infinite' : 'cq-hint-blink 3s ease-in-out infinite',
          animationDelay: '1s',
        }}
      >
        ✦ &nbsp; Click to get started &nbsp; ✦
      </div>

      {/* Horizontal glow line below title */}
      <div
        style={{
          width:      hovered ? '260px' : '180px',
          height:     '1px',
          background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
          transition: 'width 0.4s ease, box-shadow 0.4s ease',
          boxShadow:  `0 0 12px ${glowColor}`,
        }}
      />
    </div>
  )
}

// ─── CSS keyframe injector ────────────────────────────────────────────────────

function InjectLandingStyles(): React.ReactElement | null {
  useEffect(() => {
    const styleId = 'cq-landing-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @keyframes cq-title-float {
        0%   { transform: translateY(0px);  }
        50%  { transform: translateY(-14px); }
        100% { transform: translateY(0px);  }
      }
      @keyframes cq-title-lite-pulse {
        0%   { opacity: 0.9; }
        50%  { opacity: 1.0; }
        100% { opacity: 0.9; }
      }
      @keyframes cq-sub-fade {
        0%   { opacity: 0.6; }
        50%  { opacity: 1.0; }
        100% { opacity: 0.6; }
      }
      @keyframes cq-hint-blink {
        0%   { opacity: 0.4; transform: translateY(0px); }
        50%  { opacity: 0.9; transform: translateY(-4px); }
        100% { opacity: 0.4; transform: translateY(0px); }
      }
      @keyframes cq-hint-lite-blink {
        0%   { opacity: 0.3; }
        50%  { opacity: 0.8; }
        100% { opacity: 0.3; }
      }
      @keyframes cq-ring-spin {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to   { transform: translate(-50%, -50%) rotate(360deg); }
      }
      @keyframes cq-ring-spin-rev {
        from { transform: translate(-50%, -50%) rotate(0deg); }
        to   { transform: translate(-50%, -50%) rotate(-360deg); }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(styleId)?.remove() }
  }, [])

  return null
}

// ─── Decorative orbital rings (Balanced/Ultra) ────────────────────────────────

function OrbitalRings(): React.ReactElement {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      {/* Outer ring */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        width:        'min(700px, 85vw)',
        height:       'min(700px, 85vw)',
        border:       '1px solid rgba(168,85,247,0.12)',
        borderRadius: '50%',
        transform:    'translate(-50%, -50%)',
        animation:    'cq-ring-spin 40s linear infinite',
      }}>
        {/* Dot on ring */}
        <div style={{
          position:     'absolute',
          top:          0,
          left:         '50%',
          width:        '6px',
          height:       '6px',
          background:   '#a855f7',
          borderRadius: '50%',
          boxShadow:    '0 0 10px #a855f7, 0 0 20px #a855f7',
          transform:    'translate(-50%, -50%)',
        }} />
      </div>

      {/* Middle ring */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        width:        'min(500px, 65vw)',
        height:       'min(500px, 65vw)',
        border:       '1px solid rgba(129,140,248,0.10)',
        borderRadius: '50%',
        transform:    'translate(-50%, -50%)',
        animation:    'cq-ring-spin-rev 28s linear infinite',
      }}>
        <div style={{
          position:     'absolute',
          bottom:       0,
          left:         '50%',
          width:        '4px',
          height:       '4px',
          background:   '#818cf8',
          borderRadius: '50%',
          boxShadow:    '0 0 8px #818cf8',
          transform:    'translate(-50%, 50%)',
        }} />
      </div>

      {/* Inner ring */}
      <div style={{
        position:     'absolute',
        top:          '50%',
        left:         '50%',
        width:        'min(340px, 45vw)',
        height:       'min(340px, 45vw)',
        border:       '1px solid rgba(216,180,254,0.08)',
        borderRadius: '50%',
        transform:    'translate(-50%, -50%)',
        animation:    'cq-ring-spin 18s linear infinite',
      }} />
    </div>
  )
}

// ─── LandingScreen — main export ──────────────────────────────────────────────

export default function LandingScreen({ onOpenWizard }: LandingScreenProps): React.ReactElement {
  const { mode, animationsEnabled } = usePerformance()
  const isLite      = mode === 'lite'
  const isUltra     = mode === 'ultra'
  const [hovered, setHovered] = useState(false)

  const handleClick = useCallback(() => {
    onOpenWizard()
  }, [onOpenWizard])

  return (
    <div
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     1000,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow:   'hidden',
        background: '#02000a',
      }}
    >
      {/* ── Keyframe styles injected once ── */}
      <InjectLandingStyles />

      {/* ── Background layer ── */}
      {isLite
        ? <LiteBackground />
        : <ThreeJSCanvas
            particleCount={isUltra ? PARTICLE_COUNT_ULTRA : PARTICLE_COUNT_BALANCED}
            showNebula={isUltra}
          />
      }

      {/* ── Decorative rings (Balanced/Ultra only) ── */}
      {animationsEnabled && <OrbitalRings />}

      {/* ── Radial centre glow ── */}
      <div
        style={{
          position:     'absolute',
          inset:        0,
          zIndex:       2,
          pointerEvents: 'none',
          background:   `radial-gradient(
            ellipse 600px 400px at 50% 50%,
            rgba(88,28,135,0.15) 0%,
            transparent 70%
          )`,
        }}
      />

      {/* ── Animated title + click trigger ── */}
      <AnimatedTitle
        onClick={handleClick}
        liteMode={isLite}
        hovered={hovered}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
      />

      {/* ── Performance mode badge (top-right, subtle) ── */}
      <div style={{
        position:      'absolute',
        top:           '16px',
        right:         '20px',
        zIndex:        20,
        fontFamily:    '"Inter", system-ui, sans-serif',
        fontSize:      '10px',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
        color:         'rgba(167,139,250,0.35)',
        fontWeight:    500,
      }}>
        {isLite ? 'Performance: Lite' : isUltra ? 'Performance: Ultra' : 'Performance: Balanced'}
      </div>
    </div>
  )
}
