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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  ImageIcon,
  type LucideIcon,
  Network,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

type HeroMetric = [LucideIcon, string, string]

const HERO_SLIDES = [
  {
    src: '/landing/banana-hero-bg.png',
    title: 'Unified access to next-gen AI image models',
    eyebrow: 'New API Image Gateway',
    desc: 'Aggregate Gemini, GPT Image, and more image models through one compatible endpoint to build stable, observable, cost-efficient generation services faster.',
    model: 'gemini-3.1-flash-image-preview',
    tone: 'from-amber-300 via-yellow-400 to-orange-500',
  },
  {
    src: '/landing/hero-gpt-image-2.png',
    title: 'Ship high-quality image generation faster',
    eyebrow: 'GPT Image Ready',
    desc: 'Cover production scenarios like text-to-image, image editing, and batch generation with key management, request logs, and stable routing built in.',
    model: 'gpt-image-2',
    tone: 'from-emerald-300 via-lime-300 to-teal-400',
  },
  {
    src: '/landing/hero-gemini.png',
    title: 'High-concurrency visual APIs for business',
    eyebrow: 'Gemini Flash Image',
    desc: 'Automatically select available channels to reduce failures caused by provider volatility, so teams can focus on product experience instead of model integration.',
    model: 'gemini-2.5-flash-image',
    tone: 'from-cyan-300 via-sky-400 to-blue-500',
  },
]

const TRUST_SIGNALS = [
  'Unified auth',
  'Availability routing',
  'Request logs',
  'Usage-based billing',
]
const ROUTING_MODELS = [
  ['Gemini Flash Image', '28ms', '99.95%'],
  ['GPT Image 2', '46ms', '99.92%'],
  ['Gemini Pro Image', '32ms', '99.98%'],
]
const HERO_METRICS: HeroMetric[] = [
  [Gauge, '46ms', 'Average latency'],
  [Network, '99.95%', 'Request success rate'],
  [ImageIcon, '4K', 'Max resolution'],
]

const SWIPE_THRESHOLD_PX = 48

export function Hero(props: HeroProps) {
  const { t } = useTranslation()
  const [activeSlide, setActiveSlide] = useState(0)
  const pointerStartX = useRef<number | null>(null)
  const activePointerId = useRef<number | null>(null)

  const endSwipe = useCallback((clientX: number) => {
    const start = pointerStartX.current
    pointerStartX.current = null
    activePointerId.current = null
    if (start === null) return
    const dx = clientX - start
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    const len = HERO_SLIDES.length
    if (dx > 0) {
      setActiveSlide((i) => (i - 1 + len) % len)
    } else {
      setActiveSlide((i) => (i + 1) % len)
    }
  }, [])

  const onPreviewPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      pointerStartX.current = e.clientX
      activePointerId.current = e.pointerId
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    []
  )

  const onPreviewPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== e.pointerId) return
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* capture may already be released */
      }
      endSwipe(e.clientX)
    },
    [endSwipe]
  )

  const onPreviewPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerStartX.current = null
      activePointerId.current = null
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* empty */
      }
    },
    []
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % HERO_SLIDES.length)
    }, 6000)

    return () => window.clearInterval(timer)
  }, [])

  const slide = HERO_SLIDES[activeSlide]

  return (
    <section
      className={`relative z-10 isolate min-h-svh overflow-hidden px-4 pt-28 pb-16 sm:px-6 md:pt-36 md:pb-24 lg:px-8 ${props.className ?? ''}`}
    >
      <div
        aria-hidden
        className='absolute inset-x-0 top-0 -z-30 h-svh min-h-[560px] sm:min-h-[640px]'
      >
        {HERO_SLIDES.map((item, index) => (
          <img
            key={item.src}
            src={item.src}
            alt=''
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ease-out ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>
      <div
        aria-hidden
        className='absolute inset-x-0 top-0 -z-10 h-svh min-h-[560px] bg-[linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.12] sm:min-h-[640px]'
      />

      <div className='mx-auto grid min-h-[calc(100svh-11rem)] max-w-7xl items-center gap-10 md:min-h-[calc(100svh-15rem)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,500px)] lg:gap-12 xl:gap-16'>
        <div className='max-w-3xl text-white'>
          <div
            className='landing-animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 shadow-lg shadow-black/20 backdrop-blur-md'
            style={{ animationDelay: '0ms' }}
          >
            <Sparkles className='size-4 text-yellow-300' />
            {t(slide.eyebrow)}
          </div>

          <h1
            className='landing-animate-fade-up text-[clamp(2.6rem,6.8vw,5.75rem)] leading-[1.04] font-bold tracking-tight text-balance'
            style={{ animationDelay: '80ms' }}
          >
            {t(slide.title)}
          </h1>

          <p
            className='landing-animate-fade-up mt-6 max-w-2xl text-base leading-8 text-white/78 opacity-0 md:text-xl'
            style={{ animationDelay: '160ms' }}
          >
            {t(slide.desc)}
          </p>

          <div
            className='landing-animate-fade-up mt-8 flex flex-col gap-3 opacity-0 sm:flex-row'
            style={{ animationDelay: '240ms' }}
          >
            {props.isAuthenticated ? (
              <Button
                className='group relative overflow-hidden rounded-full bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 px-7 text-slate-950 shadow-[0_12px_30px_-12px_rgba(250,204,21,0.85)] ring-1 ring-white/30 transition-all duration-300 before:absolute before:inset-y-0 before:left-[-45%] before:w-1/3 before:skew-x-[-20deg] before:bg-white/45 before:opacity-0 before:transition-all before:duration-500 hover:-translate-y-0.5 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-300 hover:shadow-[0_18px_42px_-16px_rgba(250,204,21,0.95)] hover:before:left-[120%] hover:before:opacity-100 focus-visible:ring-yellow-200/70 active:translate-y-0'
                render={<Link to='/dashboard' />}
              >
                <span className='relative z-10'>{t('Go to Dashboard')}</span>
                <ArrowRight className='relative z-10 ml-1 size-4 transition-transform duration-200 group-hover:translate-x-1' />
              </Button>
            ) : (
              <>
                <Button
                  className='group relative overflow-hidden rounded-full bg-gradient-to-r from-yellow-300 via-amber-300 to-yellow-400 px-7 text-slate-950 shadow-[0_12px_30px_-12px_rgba(250,204,21,0.85)] ring-1 ring-white/30 transition-all duration-300 before:absolute before:inset-y-0 before:left-[-45%] before:w-1/3 before:skew-x-[-20deg] before:bg-white/45 before:opacity-0 before:transition-all before:duration-500 hover:-translate-y-0.5 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-300 hover:shadow-[0_18px_42px_-16px_rgba(250,204,21,0.95)] hover:before:left-[120%] hover:before:opacity-100 focus-visible:ring-yellow-200/70 active:translate-y-0'
                  render={<Link to='/sign-up' />}
                >
                  <span className='relative z-10'>{t('Start with New API')}</span>
                  <ArrowRight className='relative z-10 ml-1 size-4 transition-transform duration-200 group-hover:translate-x-1' />
                </Button>
                <Button
                  variant='outline'
                  className='rounded-full border-white/20 bg-white/10 px-7 text-white shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/20 hover:text-white active:translate-y-0'
                  render={<Link to='/pricing' />}
                >
                  {t('Explore model pricing')}
                </Button>
              </>
            )}
          </div>

          <div
            className='landing-animate-fade-up mt-8 flex flex-wrap gap-3 opacity-0'
            style={{ animationDelay: '320ms' }}
          >
            {TRUST_SIGNALS.map((signal) => (
              <span
                key={signal}
                className='inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/25 px-3 py-1.5 text-sm text-white/78 backdrop-blur-md'
              >
                <CheckCircle2 className='size-4 text-yellow-300' />
                {t(signal)}
              </span>
            ))}
          </div>
        </div>

        <div
          className='landing-animate-fade-up relative mx-auto w-full max-w-[500px] opacity-0 lg:mx-0 lg:justify-self-end xl:translate-x-[clamp(0rem,calc((100vw-80rem)/2),10rem)]'
          style={{ animationDelay: '360ms' }}
        >
          <div className='absolute -inset-6 rounded-[2rem] bg-yellow-400/20 blur-3xl sm:-inset-8 sm:rounded-[2.5rem]' />
          <div className='relative overflow-hidden rounded-3xl border border-white/15 bg-black/35 p-4 shadow-2xl shadow-black/35 backdrop-blur-xl sm:rounded-[2rem] sm:p-5 lg:p-6'>
            <div
              role='group'
              aria-roledescription={t('Carousel')}
              aria-label={t('Swipe horizontally to switch slides')}
              className='relative aspect-[16/11] cursor-grab touch-pan-y overflow-hidden rounded-2xl border border-white/10 bg-white/5 select-none active:cursor-grabbing sm:aspect-[4/3] sm:rounded-3xl'
              onPointerDown={onPreviewPointerDown}
              onPointerUp={onPreviewPointerUp}
              onPointerCancel={onPreviewPointerCancel}
            >
              {HERO_SLIDES.map((item, index) => (
                <img
                  key={item.src}
                  src={item.src}
                  alt=''
                  draggable={false}
                  className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
                    index === activeSlide ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent' />
              <div className='pointer-events-none absolute right-4 bottom-4 left-4 sm:right-5 sm:bottom-5 sm:left-5'>
                <div className='mb-3 flex items-center justify-between gap-3 sm:mb-4'>
                  <span className='rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur sm:px-3.5 sm:py-1.5 sm:text-sm'>
                    {t('Current model')}
                  </span>
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200 backdrop-blur sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm'>
                    <span className='size-1.5 rounded-full bg-emerald-300 sm:size-2' />
                    {t('Online')}
                  </span>
                </div>
                <p
                  className={`bg-gradient-to-r ${slide.tone} bg-clip-text font-mono text-lg font-bold text-transparent sm:text-xl lg:text-2xl`}
                >
                  {slide.model}
                </p>
              </div>
            </div>

            <div className='mt-4 grid grid-cols-3 gap-2 sm:mt-5 sm:gap-4'>
              {HERO_METRICS.map(([Icon, value, label]) => (
                <div
                  key={label as string}
                  className='rounded-2xl border border-white/10 bg-white/[0.07] p-3 sm:rounded-3xl sm:p-4'
                >
                  <Icon className='mb-2 size-4 text-yellow-300 sm:mb-3 sm:size-5' />
                  <p className='text-base font-semibold text-white sm:text-lg'>
                    {value}
                  </p>
                  <p className='mt-1 text-[11px] text-white/45 sm:text-sm'>
                    {t(label as string)}
                  </p>
                </div>
              ))}
            </div>

            <div className='mt-4 space-y-2 sm:mt-5 sm:space-y-3'>
              {ROUTING_MODELS.map(([model, latency, uptime]) => (
                <div
                  key={model}
                  className='flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 sm:gap-4 sm:rounded-3xl sm:px-5 sm:py-4'
                >
                  <div className='min-w-0'>
                    <p className='truncate font-mono text-xs text-white sm:text-sm'>
                      {model}
                    </p>
                    <p className='mt-1 text-[11px] text-white/42 sm:mt-1.5 sm:text-xs'>
                      {t('latency {{latency}} · uptime {{uptime}}', {
                        latency,
                        uptime,
                      })}
                    </p>
                  </div>
                  <span className='rounded-full bg-yellow-300/15 px-2 py-1 text-[11px] font-medium text-yellow-200 sm:px-3 sm:py-1.5 sm:text-xs'>
                    {t('Active')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className='mt-5 flex justify-center gap-2'>
            {HERO_SLIDES.map((item, index) => (
              <Button
                key={item.src}
                variant='ghost'
                size='icon'
                aria-label={t('Switch to hero slide {{index}}', {
                  index: index + 1,
                })}
                aria-current={index === activeSlide}
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full p-0 transition-all hover:bg-white/70 ${
                  index === activeSlide ? 'w-10 bg-yellow-300' : 'w-2.5 bg-white/40'
                }`}
              >
                <span className='sr-only'>{index + 1}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
