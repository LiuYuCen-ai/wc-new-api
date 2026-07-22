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
import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { getHomePageHeroContent } from '../../api'
import type {
  HomePageHeroContentConfig,
  LocalizedText,
} from '../../types'

interface HeroProps {
  className?: string
  isAuthenticated?: boolean
}

type HeroSlide = {
  src: string
  title: string
  eyebrow: string
  desc: string
  model: string
  tone: string
}

const HERO_SLIDES: HeroSlide[] = [
  {
    src: '/landing/home-page/home_war.png',
    title: 'Unified access to next-gen AI image models',
    eyebrow: 'Image Gateway',
    desc: 'Aggregate Gemini, GPT Image, and more image models through one compatible endpoint to build stable, observable, cost-efficient generation services faster.',
    model: 'gemini-3.1-flash-image-preview',
    tone: 'from-amber-300 via-yellow-400 to-orange-500',
  },
  {
    src: '/landing/home-page/home_simple.png',
    title: 'Ship high-quality image generation faster',
    eyebrow: 'GPT Image Ready',
    desc: 'Cover production scenarios like text-to-image, image editing, and batch generation with key management, request logs, and stable routing built in.',
    model: 'gpt-image-2',
    tone: 'from-emerald-300 via-lime-300 to-teal-400',
  },
  {
    src: '/landing/home-page/home_horse.png',
    title: 'High-concurrency visual APIs for business',
    eyebrow: 'Gemini Flash Image',
    desc: 'Automatically select available channels to reduce failures caused by provider volatility, so teams can focus on product experience instead of model integration.',
    model: 'gemini-3-pro-image-preview',
    tone: 'from-cyan-300 via-sky-400 to-blue-500',
  },
]

const ANNOUNCEMENT_BUTTON_COLORS = ['#F5C518', '#F5C518', '#F5C518']

function isChineseLanguage(language: string): boolean {
  return language.toLowerCase().startsWith('zh')
}

function parseHeroContentConfig(content: string | undefined): HomePageHeroContentConfig | null {
  if (!content?.trim()) return null
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const config = parsed as HomePageHeroContentConfig
    return Array.isArray(config.slides) ? config : null
  } catch {
    return null
  }
}

function getLocalizedText(
  value: LocalizedText | undefined,
  language: string,
  fallback: string
): string {
  if (!value) return fallback
  if (typeof value === 'string') return value || fallback

  const normalizedLanguage = language.toLowerCase()
  const primaryLanguage = normalizedLanguage.split('-')[0]
  return (
    value[normalizedLanguage] ||
    value[primaryLanguage] ||
    value.en ||
    value.zh ||
    fallback
  )
}

function mergeHeroSlides(
  config: HomePageHeroContentConfig | null,
  language: string
): HeroSlide[] {
  if (!config?.slides) return HERO_SLIDES

  return HERO_SLIDES.map((defaultSlide, index) => {
    const customSlide = config.slides?.[index]
    if (!customSlide) return defaultSlide

    return {
      ...defaultSlide,
      title: getLocalizedText(customSlide.title, language, defaultSlide.title),
      desc: getLocalizedText(customSlide.desc, language, defaultSlide.desc),
      model: customSlide.model || defaultSlide.model,
    }
  })
}

function getDisplayModelName(model: string): string {
  if (
    model === 'gemini-3-pro-image-preview' ||
    model === 'gemini-3.1-flash-image-preview'
  ) {
    return model.replace(/-preview$/i, '')
  }

  return model
}

export function Hero(props: HeroProps) {
  const { i18n, t } = useTranslation()
  const [activeSlide, setActiveSlide] = useState(0)
  const [slideCycle, setSlideCycle] = useState(0)
  const [slideProgressStarted, setSlideProgressStarted] = useState(false)
  const [slides, setSlides] = useState<HeroSlide[]>(HERO_SLIDES)

  useEffect(() => {
    let mounted = true

    async function loadHeroContent() {
      try {
        const response = await getHomePageHeroContent()
        if (!mounted) return

        const content = isChineseLanguage(i18n.language)
          ? response.data?.content
          : response.data?.i18nContent
        const config = parseHeroContentConfig(content)
        setSlides(mergeHeroSlides(config, i18n.language))
      } catch {
        if (mounted) {
          setSlides(HERO_SLIDES)
        }
      }
    }

    loadHeroContent()

    return () => {
      mounted = false
    }
  }, [i18n.language])

  useEffect(() => {
    const color = ANNOUNCEMENT_BUTTON_COLORS[activeSlide] || ANNOUNCEMENT_BUTTON_COLORS[0]
    document.documentElement.style.setProperty('--announcement-primary', color)
  }, [activeSlide])

  useEffect(() => {
    setActiveSlide((current) => Math.min(current, slides.length - 1))
  }, [slides.length])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) return

    setSlideProgressStarted(false)
    const startTimer = window.setTimeout(() => setSlideProgressStarted(true), 50)
    const switchTimer = window.setTimeout(() => {
      setSlideProgressStarted(false)
      setActiveSlide((current) => (current + 1) % slides.length)
      setSlideCycle((current) => current + 1)
    }, 6000)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(switchTimer)
    }
  }, [activeSlide, slideCycle, slides.length])

  const slide = slides[activeSlide] ?? slides[0] ?? HERO_SLIDES[0]

  return (
    <section
      className={`hero-adaptive relative z-10 isolate min-h-svh overflow-hidden px-4 pt-24 pb-14 sm:px-6 sm:pt-26 sm:pb-16 md:pt-30 md:pb-18 lg:px-8 lg:pt-32 lg:pb-20 xl:pt-36 xl:pb-24 ${props.className ?? ''}`}
    >
      <div
        aria-hidden
        className='absolute inset-0 -z-30 min-h-full'
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
        className='absolute inset-0 -z-10 min-h-full bg-[linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_35%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-[0.12]'
      />
      <div
        aria-hidden
        className='absolute inset-0 -z-20 min-h-full bg-[linear-gradient(90deg,rgba(2,6,23,0.18)_0%,rgba(161,164,176,0.18)_42%,rgba(2,6,23,0.18)_70%,rgba(2,6,23,0.18)_100%)]'
      />

      <div className='hero-adaptive__grid mx-auto grid min-h-[calc(100svh-9.5rem)] max-w-7xl items-center gap-8 md:min-h-[calc(100svh-11rem)] md:gap-9 lg:gap-10 xl:min-h-[calc(100svh-15rem)] xl:gap-16'>
        <div className='hero-adaptive__content max-w-3xl translate-y-0 text-white [text-rendering:optimizeLegibility] [-webkit-font-smoothing:antialiased] [font-synthesis-weight:none] lg:translate-y-28'>
          <div
            key={`eyebrow-${activeSlide}`}
            className='hero-adaptive__eyebrow landing-animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/25 backdrop-blur-md'
            style={{ animationDelay: '0ms' }}
          >
            <Sparkles className='size-4 text-yellow-300' />
            {t(slide.eyebrow)}
          </div>

          <h1
            key={`title-${activeSlide}`}
            className='hero-adaptive__title landing-animate-fade-up max-w-[10.5ch] pb-[0.1em] text-[clamp(2.5rem,6vw,5.75rem)] leading-[1.08] font-extrabold tracking-tight text-balance text-[#ececec] drop-shadow-[0_3px_18px_rgba(0,0,0,0.55)] lg:max-w-[11ch] xl:max-w-none xl:text-[clamp(2.6rem,6.8vw,5.75rem)]'
            style={{ animationDelay: '80ms' }}
          >
            {t(slide.title)}
          </h1>

          <p
            key={`desc-${activeSlide}`}
            className='hero-adaptive__desc landing-animate-fade-up mt-6 max-w-2xl text-base leading-8 font-medium text-[#cccccc] opacity-0 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] md:text-xl'
            style={{ animationDelay: '160ms' }}
          >
            {t(slide.desc)}
          </p>

          <div
            className='hero-adaptive__cta landing-animate-fade-up mt-8 flex flex-col gap-3 opacity-0 sm:flex-row'
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
                  render={<Link to='/dashboard' />}
                >
                  <span className='relative z-10'>{t('Go to Dashboard')}</span>
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
            className='hero-adaptive__slide-cards landing-animate-fade-up mt-20 grid w-full max-w-3xl grid-cols-3 gap-3 opacity-0 sm:gap-4 md:mt-24 lg:mt-24'
            style={{ animationDelay: '400ms' }}
          >
            {slides.map((item, index) => (
              <Button
                key={item.src}
                variant='ghost'
                aria-label={t('Switch to hero slide {{index}}', {
                  index: index + 1,
                })}
                aria-current={index === activeSlide}
                onClick={() => {
                  setSlideProgressStarted(false)
                  setActiveSlide(index)
                  setSlideCycle((current) => current + 1)
                }}
                className={`relative h-auto w-full min-w-0 items-center justify-start gap-2 overflow-hidden rounded-none border bg-black/35 px-1 py-0.5 backdrop-blur-md transition-colors hover:bg-black/45 sm:gap-2.5 sm:px-1.5 sm:py-1 ${
                  index === activeSlide
                    ? 'border-yellow-300/70 bg-yellow-300/15 hover:bg-yellow-300/20'
                    : 'border-white/15'
                }`}
              >
                {index === activeSlide && (
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-0 z-0 bg-white/55 transition-[width] duration-[5950ms] ease-linear ${
                      slideProgressStarted ? 'w-full' : 'w-0'
                    }`}
                  />
                )}
                <img
                  src={item.src}
                  alt=''
                  draggable={false}
                  className='relative z-10 h-12 w-20 shrink-0 rounded-none object-cover sm:h-14 sm:w-24'
                />
                <span className='relative z-10 min-w-0 truncate font-mono text-xs font-medium text-white capitalize sm:max-w-[12rem]'>
                  {getDisplayModelName(item.model)}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
