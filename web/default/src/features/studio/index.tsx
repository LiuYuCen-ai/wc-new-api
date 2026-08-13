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
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ImageIcon, Sparkles } from 'lucide-react'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import {
  getStudioModelsByKind,
  type StudioModel,
  type StudioModelKind,
} from './models'

type StudioTab = 'all' | StudioModelKind

const TABS: { key: StudioTab; labelKey: string }[] = [
  { key: 'all', labelKey: 'All' },
  { key: 'image', labelKey: 'Image models' },
  { key: 'video', labelKey: 'Video models' },
]

const SECTIONS: { kind: StudioModelKind; titleKey: string }[] = [
  { kind: 'image', titleKey: 'Image models' },
  { kind: 'video', titleKey: 'Video models' },
]

export function Studio() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<StudioTab>('all')

  const openModel = (model: StudioModel) => {
    navigate({
      to: '/studio/$model',
      params: { model: model.slug },
    })
  }

  const renderCard = (model: StudioModel) => (
    <div
      key={model.slug}
      role='button'
      tabIndex={0}
      onClick={() => openModel(model)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openModel(model)
        }
      }}
      className='group block h-full w-full min-w-0 cursor-pointer text-left'
    >
      <Card className='flex h-full min-w-0 flex-col overflow-hidden pt-0 transition-shadow hover:shadow-lg'>
        {/* Cover */}
        <div
          className={cn(
            'bg-muted/40 relative w-full shrink-0 overflow-hidden',
            model.kind === 'video' ? 'aspect-video' : 'aspect-[4/3]'
          )}
        >
          {model.cover ? (
            <img
              src={model.cover}
              alt={model.label}
              loading='lazy'
              className='absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center'>
              <ImageIcon className='text-muted-foreground/50 h-10 w-10' />
            </div>
          )}
          {model.isNew && (
            <Badge className='absolute left-2 top-2 backdrop-blur'>NEW</Badge>
          )}
        </div>

        {/* Body */}
        <div className='flex min-w-0 flex-1 flex-col gap-1.5 p-4'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <Badge variant='secondary'>{t(model.tag)}</Badge>
          </div>
          <h3 className='truncate text-base font-semibold tracking-tight'>
            {model.label}
          </h3>
          <p className='text-muted-foreground line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed break-words'>
            {t(model.description)}
          </p>
          <div className='mt-auto flex items-center justify-between gap-2 pt-2'>
            <span className='text-muted-foreground truncate text-xs font-medium'>
              {model.vendor}
            </span>
            <Button
              type='button'
              size='sm'
              className='shrink-0'
              onClick={(e) => {
                e.stopPropagation()
                openModel(model)
              }}
            >
              {t('Try now')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )

  return (
    <PublicLayout>
      <PageTransition>
        <div className='mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6'>
          {/* Header */}
          <div className='mb-6 flex min-w-0 flex-col gap-2'>
            <div className='flex min-w-0 items-center gap-2'>
              <Sparkles className='text-primary h-6 w-6 shrink-0' />
              <h1 className='min-w-0 text-2xl font-bold tracking-tight break-words'>
                {t('Studio')}
              </h1>
            </div>
            <p className='text-muted-foreground max-w-3xl text-sm leading-relaxed text-balance break-words'>
              {t(
                'Explore leading image and video models. Pick one to start creating.'
              )}
            </p>
          </div>

          {/* Category tabs */}
          <div className='mb-6 flex flex-wrap items-center gap-2'>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type='button'
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              )
            })}
          </div>

          {/* Sections */}
          {SECTIONS.filter(
            (section) => activeTab === 'all' || activeTab === section.kind
          ).map((section) => {
            const models = getStudioModelsByKind(section.kind)
            return (
              <section key={section.kind} className='mb-8 min-w-0'>
                <div className='mb-4 flex items-center gap-2'>
                  <h2 className='text-lg font-semibold tracking-tight'>
                    {t(section.titleKey)}
                  </h2>
                  <span className='text-muted-foreground text-sm'>
                    ({models.length})
                  </span>
                </div>
                <div className='grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                  {models.map(renderCard)}
                </div>
              </section>
            )
          })}
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
