/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

import './cinematic-transition.css'

type CinematicTransitionProps = {
  title?: string
  subtitle?: string
  duration?: number
  onComplete?: () => void
}

type Particle = {
  x: number
  y: number
  depth: number
  size: number
  drift: number
  alpha: number
}

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)

export function CinematicTransition({
  title = '万象生成',
  subtitle = 'COMPOSE THE UNSEEN',
  duration = 10000,
  onComplete,
}: CinematicTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const startedAt = useRef(performance.now())
  const onCompleteRef = useRef(onComplete)
  const leavingTimerRef = useRef<number | undefined>(undefined)
  const completeTimerRef = useRef<number | undefined>(undefined)
  const finishedRef = useRef(false)
  const [leaving, setLeaving] = useState(false)

  onCompleteRef.current = onComplete

  const titleGlyphs = useMemo(() => {
    const seen = new Map<string, number>()
    return [...title].map((character) => {
      const occurrence = (seen.get(character) ?? 0) + 1
      seen.set(character, occurrence)
      return { character, key: `${character}-${occurrence}` }
    })
  }, [title])

  const completeOnce = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onCompleteRef.current?.()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let width = 0
    let height = 0
    let frame = 0
    let particles: Particle[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(
        130,
        Math.max(70, Math.floor((width * height) / 12000))
      )
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        depth: 0.2 + Math.random() * 0.8,
        size: 0.45 + Math.random() * 1.5,
        drift: (Math.random() - 0.5) * 0.18,
        alpha: 0.12 + Math.random() * 0.6,
      }))
    }

    const draw = (now: number) => {
      const elapsed = now - startedAt.current
      const progress = Math.min(elapsed / duration, 1)
      const reveal = Math.min(Math.max((progress - 0.08) / 0.28, 0), 1)
      const collapse = Math.min(Math.max((progress - 0.76) / 0.19, 0), 1)

      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'lighter'

      const centerX = width * 0.5
      const centerY = height * 0.5
      const pull = easeOutCubic(collapse)

      particles.forEach((particle, index) => {
        const time = elapsed * 0.0001 * particle.depth
        const orbit = time + index * 0.37
        const idleX = particle.x + Math.cos(orbit) * 15 * particle.depth
        const idleY =
          particle.y + Math.sin(orbit * 0.7) * 10 + elapsed * particle.drift
        const x = idleX + (centerX - idleX) * pull
        const y = idleY + (centerY - idleY) * pull
        const tail = 4 + 34 * pull * particle.depth

        context.beginPath()
        context.moveTo(x - Math.cos(orbit) * tail, y - Math.sin(orbit) * tail)
        context.lineTo(x, y)
        const earlyTone = progress < 0.48 ? '112, 132, 210' : '221, 225, 255'
        context.strokeStyle = `rgba(${earlyTone}, ${particle.alpha * reveal * (1 - collapse)})`
        context.lineWidth = particle.size * particle.depth
        context.stroke()
      })

      context.globalCompositeOperation = 'source-over'
      if (progress < 1) frame = requestAnimationFrame(draw)
    }

    resize()
    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [duration])

  useEffect(() => {
    leavingTimerRef.current = window.setTimeout(
      () => setLeaving(true),
      duration - 900
    )
    completeTimerRef.current = window.setTimeout(completeOnce, duration)
    return () => {
      window.clearTimeout(leavingTimerRef.current)
      window.clearTimeout(completeTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration])

  const finish = () => {
    if (leaving || finishedRef.current) return
    window.clearTimeout(leavingTimerRef.current)
    window.clearTimeout(completeTimerRef.current)
    setLeaving(true)
    completeTimerRef.current = window.setTimeout(completeOnce, 650)
  }

  return (
    <section
      className={`cinematic-stage ${leaving ? 'is-leaving' : ''}`}
      style={
        {
          '--duration': `${duration}ms`,
        } as React.CSSProperties
      }
      aria-label='工作流开场动画'
    >
      <div className='base-glow' />
      <canvas ref={canvasRef} className='particle-field' aria-hidden='true' />
      <div className='perspective-grid' aria-hidden='true' />

      <div className='ice-opener' aria-hidden='true'>
        <div className='chapter-figure'>07</div>
        <div className='prism prism-left' />
        <div className='prism prism-center' />
        <div className='prism prism-right' />
        <div className='focus-orbit'>
          <span />
          <i />
        </div>
        <div className='light-scan' />
        <div className='opener-caption'>
          <span>NODE / FLOW / CREATE</span>
          <i />
          <span>2026</span>
        </div>
      </div>

      <div className='brand-reveal' aria-hidden='true'>
        <span className='brand-halo' />
        <span className='brand-echo brand-echo-a' />
        <span className='brand-echo brand-echo-b' />
        <span className='brand-mark' />
        <span className='brand-scan' />
      </div>

      <div className='portal' aria-hidden='true'>
        <span className='portal-ring ring-one' />
        <span className='portal-ring ring-two' />
        <span className='portal-ring ring-three' />
        <span className='portal-core' />
        <span className='portal-axis axis-x' />
        <span className='portal-axis axis-y' />
      </div>

      <div className='opening-copy'>
        <div className='copy-kicker'>
          <span>STUDIO</span>
          <i />
          <span>07</span>
        </div>
        <h1 aria-label={title}>
          {titleGlyphs.map((glyph, index) => (
            <span
              key={glyph.key}
              style={{ '--i': index } as React.CSSProperties}
            >
              {glyph.character}
            </span>
          ))}
        </h1>
        <div className='copy-subtitle'>
          <i />
          <p>{subtitle}</p>
          <i />
        </div>
      </div>

      <div className='secondary-copy' aria-hidden='true'>
        <span>由</span>
        <span>点</span>
        <i />
        <span>成</span>
        <span>境</span>
      </div>

      <div className='interface-chrome' aria-hidden='true'>
        <div className='chrome-corner top-left'>
          <span>AETHER / 04</span>
          <small>NODE WORKFLOW</small>
        </div>
        <div className='chrome-corner bottom-left'>
          <span>CONNECT</span>
          <small>GENERATE</small>
        </div>
        <div className='chrome-corner bottom-right'>
          <span>IMMERSION</span>
          <small>10.00 SEC</small>
        </div>
        <div className='edge-index'>
          <span>01</span>
          <i />
          <span>10</span>
        </div>
      </div>

      <div className='time-rail' aria-hidden='true'>
        <span />
      </div>
      <div className='film-grain' aria-hidden='true' />
      <div className='final-flare' aria-hidden='true' />

      <div className='stage-actions'>
        <button type='button' onClick={finish} aria-label='跳过开场'>
          <X size={18} />
          <span>SKIP</span>
        </button>
      </div>
    </section>
  )
}
