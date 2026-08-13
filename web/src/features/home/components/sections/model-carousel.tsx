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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getHomePageModelCarouselContent } from '../../api'
import {
  DEFAULT_MODEL_CAROUSEL_CONTENT,
  DEFAULT_MODEL_CAROUSEL_I18N_CONTENT,
} from '../../model-carousel-defaults'
import type {
  HomePageModelCarouselContentConfig,
  LocalizedText,
} from '../../types'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'

const AUTOPLAY_INTERVAL_MS = 8000

type ModelCarouselThumbnail = {
  image: string
  model: string
  price: string
}

type ModelCarouselSlide = {
  id: string
  name: string
  image: string
  thumbnails: ModelCarouselThumbnail[]
  description: string
}

function isChineseLanguage(language: string): boolean {
  return language.toLowerCase().startsWith('zh')
}

function parseModelCarouselContentConfig(
  content: string | undefined
): HomePageModelCarouselContentConfig | null {
  if (!content?.trim()) return null
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const config = parsed as HomePageModelCarouselContentConfig
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

  const normalizedLanguage = language.trim().replaceAll('_', '-').toLowerCase()
  const primaryLanguage = normalizedLanguage.split('-')[0]
  const compactLanguage = normalizedLanguage.replaceAll('-', '')
  const languageCandidates = [
    language,
    normalizedLanguage,
    primaryLanguage,
    compactLanguage,
    normalizedLanguage === 'zh-cn' ? 'zhCN' : undefined,
    normalizedLanguage === 'zh-tw' ? 'zhTW' : undefined,
  ].filter(Boolean) as string[]

  for (const candidate of languageCandidates) {
    const matched = value[candidate]
    if (matched) return matched
  }

  return value.en || value.zhCN || value.zh || fallback
}

function mergeModelCarouselSlides(
  defaultSlides: ModelCarouselSlide[],
  config: HomePageModelCarouselContentConfig | null,
  language: string
): ModelCarouselSlide[] {
  if (!config?.slides) return defaultSlides

  return defaultSlides.map((defaultSlide, index) => {
    const customSlide = config.slides?.[index]
    if (!customSlide) return defaultSlide

    return {
      ...defaultSlide,
      name: getLocalizedText(customSlide.name, language, defaultSlide.name),
      description: getLocalizedText(
        customSlide.description,
        language,
        defaultSlide.description
      ),
      thumbnails: defaultSlide.thumbnails.map((thumbnail, thumbnailIndex) => ({
        ...thumbnail,
        model: customSlide.models?.[thumbnailIndex] || thumbnail.model,
      })),
    }
  })
}

interface ModelCarouselProps {
  className?: string
}

export function ModelCarousel(props: ModelCarouselProps) {
  const { i18n, t } = useTranslation()
  const [api, setApi] = useState<CarouselApi>()
  const [tabApi, setTabApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const autoplayTimerRef = useRef<number | null>(null)

  const defaultSlides = useMemo<ModelCarouselSlide[]>(
    () => [
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        image: '/landing/home-page/home_pingload.png',
        thumbnails: [
          { image: '/landing/Canton/BaiYunShan.png', model: 'gpt-image-2', price: '' },
          { image: '/landing/Canton/ChenJiaCi.png', model: 'gpt-5.6-sol', price: '' },
          { image: '/landing/Canton/ShaMianDao.png', model: 'gpt-5.6-luna', price: '' },
        ],
        description: t('The ChatGPT API gives developers access to the OpenAI model family, spanning flagship reasoning models, fast lightweight variants, and native image generation. OpenAI models are known for strong general-purpose capability, reliable tool calling and structured output, and a mature ecosystem, making them a dependable choice for chat products, agents, and creative workflows.'),
      },
      {
        id: 'gemini',
        name: 'Gemini',
        image: '/landing/Japen/FuShiShan.png',
        thumbnails: [
          { image: '/landing/Japen/JingDu.png', model: 'gemini-3-pro-image-preview', price: '' },
          { image: '/landing/Japen/TokyoTower.png', model: 'gemini-3.1-flash-lite-image', price: '' },
          { image: '/landing/Japen/YingHua.png', model: 'gemini-3.5-flash', price: '' },
        ],
        description: t('The Gemini API brings the Google DeepMind model family to developers. Natively multimodal, Gemini understands text, images, audio, and video in a single model and supports ultra-long context windows for analyzing large documents and codebases. The lineup ranges from deep-reasoning Pro models to low-latency Flash tiers, balancing capability, speed, and cost.'),
      },
      {
        id: 'grok',
        name: 'Grok',
        image: '/landing/London/DaBenZhong.png',
        thumbnails: [
          { image: '/landing/London/BoWuGuan.png', model: 'grok-imagine--video', price: '' },
          { image: '/landing/London/HaiDepark.png', model: 'grok-imageine-video-1.5-preview', price: '' },
          { image: '/landing/London/LunDunBridge.png', model: '', price: '' },
        ],
        description: t('The Grok API provides access to the xAI model family. Grok models combine strong reasoning and coding ability with real-time knowledge drawn from the X platform, keeping answers current on fast-moving topics. Beyond chat, the lineup includes Grok Imagine for image and video generation, and the models are known for a direct, conversational style.'),
      },
      {
        id: 'claude',
        name: 'Claude',
        image: '/landing/home-page/home_mountain.png',
        thumbnails: [
          { image: '/landing/NewYork/BrooklynBridge.png', model: 'claude-fable-5', price: '' },
          { image: '/landing/NewYork/DiGuoDaSha.png', model: 'claude-opus-4-8', price: '' },
          { image: '/landing/NewYork/ZhongYangPark.png', model: 'claude-sonnet-5', price: '' },
        ],
        description: t('The Claude API offers the Anthropic model family, widely regarded as a leader in complex reasoning, software engineering, and agentic workflows. Claude models excel at long-context analysis of large documents and codebases, produce clear and dependable writing, and are built with a strong emphasis on safety and reliability, with tiers trading peak capability against speed and cost.'),
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        image: '/landing/XiNi/GeJuYuan .png',
        thumbnails: [
          { image: '/landing/XiNi/DaBaoJiao.png', model: 'DeepSeek-v4-flash', price: '' },
          { image: '/landing/XiNi/SeaYanShi.png', model: 'DeepSeek-v4-pro', price: '' },
          { image: '/landing/XiNi/YanShi.png', model: 'DeepSeek-v3.2', price: '' },
        ],
        description: t('The DeepSeek API delivers the open-weight model family from DeepSeek AI. Built on an efficient Mixture-of-Experts architecture, DeepSeek models offer frontier-level reasoning, mathematics, and coding performance at a fraction of the typical cost, which has made them a popular choice for production workloads and cost-sensitive, high-volume applications.'),
      },
      {
        id: 'minimax',
        name: 'MiniMax',
        image: '/landing/home-page/home_seat.png',
        thumbnails: [
          { image: '/landing/Pair/FanErSai.png', model: 'MiniMax-M3', price: '' },
          { image: '/landing/Pair/LuFuGong.png', model: 'MiniMax-M2.7', price: '' },
          { image: '/landing/Pair/Mountain.png', model: 'MiniMax-M2.7-highspeed', price: '' },
        ],
        description: t('The MiniMax API opens up a versatile multimodal model family from MiniMax AI. Its text models pair long-context understanding with strong agent and tool-use ability at competitive cost, while the wider lineup covers lifelike speech synthesis and video generation, fitting content creation, voice applications, and interactive experiences.'),
      },
      {
        id: 'glm',
        name: 'GLM',
        image: '/landing/YiDaLi/DouShouChang.png',
        thumbnails: [
          { image: '/landing/YiDaLi/FanDiGang.png', model: 'glm-5.2', price: '' },
          { image: '/landing/YiDaLi/MiLanJiaoTang.png', model: 'glm-5.1', price: '' },
          { image: '/landing/YiDaLi/WeiNiSi.png', model: 'glm-5-turbo', price: '' },
        ],
        description: t('The GLM API brings the Zhipu AI model family to developers, one of the leading Chinese-English bilingual lineups with open-weight releases. GLM models stand out for strong coding, reasoning, and agentic tool-use ability, and their combination of quality and low cost makes them well suited to real-world applications from customer service to autonomous agent workflows.'),
      },
    ],
    [t]
  )
  const [slides, setSlides] = useState<ModelCarouselSlide[]>(defaultSlides)

  useEffect(() => {
    let mounted = true

    async function loadModelCarouselContent() {
      try {
        const response = await getHomePageModelCarouselContent()
        if (!mounted) return

        // 系统设置里没填时，回退到内置默认 JSON，保证多语言介绍开箱即用
        const isZh = isChineseLanguage(i18n.language)
        const savedContent = isZh
          ? response.data?.content
          : response.data?.i18nContent
        let content = savedContent
        if (!content?.trim()) {
          content = isZh
            ? DEFAULT_MODEL_CAROUSEL_CONTENT
            : DEFAULT_MODEL_CAROUSEL_I18N_CONTENT
        }
        const config = parseModelCarouselContentConfig(content)
        setSlides(mergeModelCarouselSlides(defaultSlides, config, i18n.language))
      } catch {
        if (mounted) {
          // 接口失败时同样使用内置默认 JSON
          const fallbackContent = isChineseLanguage(i18n.language)
            ? DEFAULT_MODEL_CAROUSEL_CONTENT
            : DEFAULT_MODEL_CAROUSEL_I18N_CONTENT
          const config = parseModelCarouselContentConfig(fallbackContent)
          setSlides(
            mergeModelCarouselSlides(defaultSlides, config, i18n.language)
          )
        }
      }
    }

    loadModelCarouselContent()

    return () => {
      mounted = false
    }
  }, [defaultSlides, i18n.language])

  const slidesCount = slides.length

  useEffect(() => {
    if (!api) return

    const syncSelected = () => {
      setSelectedIndex(api.selectedScrollSnap())
    }

    // 拖拽/滚动过程中实时计算离中间最近的卡片：
    // 当下一张被拖过中点时立即高亮它（变亮），原来那张随之变暗
    const syncClosestSnap = () => {
      const snaps = api.scrollSnapList()
      if (snaps.length === 0) return

      // loop 模式下 scrollProgress 可能越界，归一化到 [0, 1)
      const rawProgress = api.scrollProgress()
      const progress = rawProgress - Math.floor(rawProgress)

      let closestIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY
      snaps.forEach((snap, index) => {
        const delta = Math.abs(snap - progress)
        // 环形距离，处理首尾相接的情况
        const distance = Math.min(delta, 1 - delta)
        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })
      setSelectedIndex(closestIndex)
    }

    syncSelected()
    api.on('select', syncSelected)
    api.on('scroll', syncClosestSnap)
    api.on('reInit', syncSelected)

    return () => {
      api.off('select', syncSelected)
      api.off('scroll', syncClosestSnap)
      api.off('reInit', syncSelected)
    }
  }, [api])

  useEffect(() => {
    if (!tabApi) return
    tabApi.scrollTo(selectedIndex)
  }, [tabApi, selectedIndex])

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current === null) return
    window.clearTimeout(autoplayTimerRef.current)
    autoplayTimerRef.current = null
  }, [])

  const scheduleAutoplay = useCallback(() => {
    clearAutoplayTimer()
    if (!api || slides.length <= 1) return

    autoplayTimerRef.current = window.setTimeout(() => {
      api.scrollNext()
    }, AUTOPLAY_INTERVAL_MS)
  }, [api, clearAutoplayTimer, slides.length])

  useEffect(() => {
    if (!api || slides.length <= 1) return

    scheduleAutoplay()
    api.on('select', scheduleAutoplay)
    api.on('reInit', scheduleAutoplay)

    return () => {
      clearAutoplayTimer()
      api.off('select', scheduleAutoplay)
      api.off('reInit', scheduleAutoplay)
    }
  }, [api, clearAutoplayTimer, scheduleAutoplay, slides.length])

  const handleIndicatorClick = (index: number) => {
    if (!api) return
    clearAutoplayTimer()
    api.scrollTo(index)
    scheduleAutoplay()
  }

  const handleManualNavigate = (direction: -1 | 1) => {
    if (!api) return
    clearAutoplayTimer()
    if (direction === -1) {
      api.scrollPrev()
    } else {
      api.scrollNext()
    }
    scheduleAutoplay()
  }

  return (
    <section className={cn('bg-[#f7f7f5] py-10 lg:py-14', props.className)}>
      <div className='mx-auto mb-6 w-full max-w-7xl px-4 text-center sm:px-6 lg:px-8'>
        <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-5xl'>
          {t('From model access to deployment at scale, WebChannel gets you there in one stop.')}
        </h2>
        <p className='mx-auto mt-5 max-w-xl text-sm leading-7 text-slate-600 md:text-base'>
          {t('WebChannel is an AI model gateway for teams that unifies models, keys, permissions, routing, logs, and billing, helping products reach production faster and more reliably.')}
        </p>

        <Carousel
          setApi={setTabApi}
          opts={{ loop: true, align: 'center', watchDrag: false }}
          className='mt-6 w-full'
        >
          <CarouselContent className='-ml-3'>
            {slides.map((slide, index) => (
              <CarouselItem
                key={slide.id}
                className='basis-[45%] pl-3 sm:basis-[30%] md:basis-[22%]'
              >
                <button
                  type='button'
                  onClick={() => handleIndicatorClick(index)}
                  className={cn(
                    'w-full whitespace-nowrap rounded-none px-5 py-2 text-sm transition-all duration-300',
                    selectedIndex === index
                      ? 'bg-background font-semibold text-foreground shadow-md'
                      : 'bg-muted/60 font-medium text-muted-foreground/50 hover:bg-muted hover:text-foreground'
                  )}
                >
                  {slide.name}
                </button>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <div className='relative'>
        <Carousel
          setApi={setApi}
          opts={{ loop: true, align: 'center' }}
          className='w-full'
        >
          <CarouselContent className='items-stretch'>
            {slides.map((slide, index) => {
              const previousIndex = (selectedIndex - 1 + slidesCount) % slidesCount
              const nextIndex = (selectedIndex + 1) % slidesCount
              const isActive = index === selectedIndex
              const isNeighbor = index === previousIndex || index === nextIndex
              let cardStateClass = 'scale-[0.94] cursor-pointer shadow-sm'
              if (isActive) {
                cardStateClass = 'scale-100 shadow-xl'
              } else if (isNeighbor) {
                cardStateClass = 'scale-[0.97] cursor-pointer shadow-md'
              }

              return (
                <CarouselItem
                  key={slide.id}
                  className='basis-[96%] md:basis-[82%] lg:basis-[68%] xl:basis-[64%] 2xl:basis-[60%]'
                >
                  {/* 非激活的阴影卡片支持点击跳转到对应模型 */}
                  <div
                    onClick={() => {
                      if (!isActive) handleIndicatorClick(index)
                    }}
                    className={cn(
                      'group bg-background border-border/30 relative h-full overflow-hidden border transition-all duration-300',
                      cardStateClass
                    )}
                  >
                    <div className='relative bg-muted/10'>
                      <img
                        src={slide.image}
                        alt={t('{{name}} preview', { name: slide.name })}
                        className='block aspect-[4/5] w-full object-cover md:aspect-[16/10] xl:aspect-video'
                      />
                    </div>

                    <div className='absolute inset-x-0 top-0 z-10 flex flex-col gap-4 p-5 xl:top-auto xl:bottom-0 xl:flex-row xl:items-end xl:justify-between'>
                      {isActive ? (
                        <div
                          key={slide.id}
                          className='animate-in fade-in-0 slide-in-from-bottom-8 max-w-xl duration-700 xl:max-w-[calc(100%-26rem)]'
                        >
                          <p className='text-background/70 text-xs font-semibold tracking-[0.18em] uppercase md:text-base md:tracking-[0.28em]'>
                            {t('Model Series')}
                          </p>
                          <h3 className='text-background mt-2 break-words text-3xl leading-tight font-semibold tracking-tight md:mt-3 md:text-3xl lg:text-4xl'>
                            {slide.name}
                          </h3>
                          <p className='text-background/70 mt-2 line-clamp-4 text-sm leading-relaxed md:mt-3 md:text-sm lg:text-base xl:line-clamp-none'>
                            {slide.description}
                          </p>
                        </div>
                      ) : (
                        <div className='max-w-xl' />
                      )}
                    </div>
                    <div className='relative z-10 mt-[-8.5rem] flex w-full shrink-0 flex-col gap-2 p-5 pt-0 md:absolute md:right-5 md:bottom-5 md:mt-0 md:w-auto md:p-0 md:pb-2'>
                      <p className='text-background/85 text-xs font-semibold tracking-[0.18em] uppercase md:text-center md:text-xs md:tracking-[0.24em]'>
                        {t('Popular Models')}
                      </p>
                      <div className='flex items-start gap-2 overflow-x-auto no-scrollbar md:overflow-visible'>
                        {slide.thumbnails.map((thumb) => (
                          <div
                            key={thumb.image}
                            className='flex w-[32%] min-w-0 flex-col gap-1.5 md:w-28 xl:w-32'
                          >
                            <img
                              src={thumb.image}
                              alt=''
                              className='border-background/40 aspect-[3/2] w-full border object-cover shadow-md'
                            />
                            {thumb.model || thumb.price ? (
                              <div className='min-w-0'>
                                <p className='text-background/95 line-clamp-2 text-left font-mono text-[10px] leading-tight font-medium tracking-wide md:text-xs xl:truncate xl:text-center'>
                                  {thumb.model}
                                </p>
                                {thumb.price ? (
                                  <p className='mt-0.5 truncate text-left text-[11px] font-semibold tracking-wide text-amber-400/95 md:text-xs xl:text-center'>
                                    {thumb.price}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className='pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/15 to-transparent' />
                    <div
                      className={cn(
                        'pointer-events-none absolute inset-0 z-20 bg-black/60 transition-opacity duration-500',
                        isActive ? 'opacity-0' : 'opacity-100'
                      )}
                    />
                  </div>
                </CarouselItem>
              )
            })}
          </CarouselContent>
        </Carousel>

        <button
          type='button'
          onClick={() => handleManualNavigate(-1)}
          className='absolute top-1/2 left-2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-black/60 text-white shadow-md transition-colors hover:bg-black/80 sm:left-4 md:h-11 md:w-11'
          aria-label={t('Previous slide')}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className='h-5 w-5' />
        </button>
        <button
          type='button'
          onClick={() => handleManualNavigate(1)}
          className='absolute top-1/2 right-2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-black/60 text-white shadow-md transition-colors hover:bg-black/80 sm:right-4 md:h-11 md:w-11'
          aria-label={t('Next slide')}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className='h-5 w-5' />
        </button>
      </div>

      <div className='mt-5 flex items-center justify-center gap-2'>
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type='button'
            onClick={() => handleIndicatorClick(index)}
            className={cn(
              'h-2.5 rounded-full transition-all',
              selectedIndex === index
                ? 'bg-foreground w-8'
                : 'bg-border hover:bg-muted-foreground/40 w-2.5'
            )}
            aria-label={t('Go to {{name}} slide', { name: slide.name })}
          />
        ))}
      </div>
    </section>
  )
}
