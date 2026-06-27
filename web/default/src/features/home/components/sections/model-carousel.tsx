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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CarouselApi } from '@/components/ui/carousel'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

interface ModelCarouselProps {
  className?: string
}

export function ModelCarousel(props: ModelCarouselProps) {
  const { t } = useTranslation()
  const [api, setApi] = useState<CarouselApi>()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const slides = useMemo(
    () => [
      {
        id: 'gpt',
        name: 'GPT',
        image: '/landing/nainai.png',
        badge: t('Featured model'),
        description: t('Fast multimodal generation for chat, vision, and creative workflows.'),
      },
      {
        id: 'gemini',
        name: 'Gemini',
        image: '/landing/ball.png',
        badge: t('Featured model'),
        description: t('Balanced reasoning and image understanding for broad product scenarios.'),
      },
      {
        id: 'grok',
        name: 'Grok',
        image: '/landing/chifan.png',
        badge: t('Featured model'),
        description: t('Responsive model experience suited to live prompts and fast iteration.'),
      },
      {
        id: 'claude',
        name: 'Claude',
        image: '/landing/dezhou.png',
        badge: t('Featured model'),
        description: t('Clear long-context assistance for analysis, writing, and planning tasks.'),
      },
    ],
    [t]
  )

  const slidesCount = slides.length

  useEffect(() => {
    if (!api) return

    const syncSelected = () => {
      setSelectedIndex(api.selectedScrollSnap())
    }

    syncSelected()
    api.on('select', syncSelected)
    api.on('reInit', syncSelected)

    return () => {
      api.off('select', syncSelected)
      api.off('reInit', syncSelected)
    }
  }, [api])

  useEffect(() => {
    if (!api || slides.length <= 1) return

    const intervalId = window.setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext()
        return
      }

      api.scrollTo(0)
    }, 4500)

    return () => window.clearInterval(intervalId)
  }, [api, slides.length])

  return (
    <section className={cn('py-10 lg:py-14', props.className)}>
      <div className='mx-auto mb-6 flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8'>
        <div>
          <p className='text-muted-foreground text-xs font-medium tracking-widest uppercase'>
            {t('Model Showcase')}
          </p>
          <h2 className='mt-2 text-2xl font-bold tracking-tight md:text-3xl'>
            {t('Explore popular model experiences')}
          </h2>
        </div>
        <div className='text-muted-foreground hidden text-sm md:block'>
          {selectedIndex + 1}/{slides.length}
        </div>
      </div>

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

            return (
              <CarouselItem
                key={slide.id}
                className='basis-[92%] md:basis-[68%] lg:basis-[52%] xl:basis-[50%] 2xl:basis-[46%]'
              >
                <div
                  className={cn(
                    'group bg-background border-border/30 relative h-full overflow-hidden rounded-3xl border transition-all duration-300',
                    isActive
                      ? 'scale-100 shadow-xl'
                      : isNeighbor
                        ? 'scale-[0.97] opacity-90 shadow-md'
                        : 'scale-[0.94] opacity-75 shadow-sm'
                  )}
                >
                  <div className='absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4 md:p-5'>
                    <div className='bg-background/85 border-border/40 inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase backdrop-blur md:px-4 md:text-sm'>
                      {slide.badge}
                    </div>
                    <div className='bg-background/75 text-muted-foreground rounded-full px-3.5 py-1.5 text-sm backdrop-blur md:px-4 md:text-base'>
                      {slide.name}
                    </div>
                  </div>

                  <div className='relative bg-muted/10'>
                    <img
                      src={slide.image}
                      alt={t('{{name}} preview', { name: slide.name })}
                      className='aspect-[16/10] w-full object-cover'
                    />
                  </div>

                  <div className='absolute inset-x-0 bottom-0 z-10 p-4 md:p-5'>
                    <div className='max-w-xl'>
                      <p className='text-background/70 text-sm tracking-[0.28em] uppercase md:text-base'>
                        {t('Model')}
                      </p>
                      <h3 className='text-background mt-3 text-2xl font-semibold tracking-tight md:text-3xl lg:text-4xl'>
                        {slide.name}
                      </h3>
                      <p className='text-background/85 mt-3 text-base leading-relaxed md:text-lg lg:text-xl'>
                        {slide.description}
                      </p>
                    </div>
                  </div>
                  <div className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent' />
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <CarouselPrevious className='left-2 top-1/2 z-20 -translate-y-1/2 md:left-3' />
        <CarouselNext className='right-2 top-1/2 z-20 -translate-y-1/2 md:right-3' />
      </Carousel>

      <div className='mt-5 flex items-center justify-center gap-2'>
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type='button'
            onClick={() => api?.scrollTo(index)}
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
