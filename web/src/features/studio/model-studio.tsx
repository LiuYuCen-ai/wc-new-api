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
import { type FormEvent, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Download,
  Loader2,
  Wand2,
} from 'lucide-react'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

import {
  generateStudioImage,
  studioImageToSrc,
  type StudioImage,
} from './api'
import { SIZE_OPTIONS, type StudioModel } from './models'

type ModelStudioProps = {
  model: StudioModel
}

export function ModelStudio({ model }: ModelStudioProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)

  const [prompt, setPrompt] = useState<string>(t(model.defaultPrompt))
  const [size, setSize] = useState<string>(SIZE_OPTIONS[0].value)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<StudioImage[]>([])

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (loading) return
    if (!user) {
      navigate({
        to: '/sign-in',
        search: {
          redirect: `${window.location.pathname}${window.location.search}`,
        },
      })
      return
    }
    if (!prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }

    setLoading(true)
    try {
      const images = await generateStudioImage({
        model: model.id,
        prompt: prompt.trim(),
        size,
      })
      setResults(images)
      toast.success(t('Image generated successfully'))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('Image generation failed')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const downloadImage = (src: string, index: number) => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = `${model.slug}-${Date.now()}-${index + 1}.png`
    a.click()
  }

  return (
    <PublicLayout>
      <PageTransition>
        <div className='mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6'>
          {/* Header */}
          <div className='mb-6 flex min-w-0 flex-col gap-3'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='w-fit gap-1.5 px-2'
              onClick={() => navigate({ to: '/studio' })}
            >
              <ArrowLeft className='h-4 w-4' />
              {t('Back to models')}
            </Button>
            <div className='min-w-0 space-y-1'>
              <h1 className='min-w-0 text-2xl font-bold tracking-tight break-words'>
                {model.label}
              </h1>
              <p className='text-muted-foreground max-w-3xl text-sm leading-relaxed text-balance break-words'>
                {t(model.description)}
              </p>
            </div>
          </div>

          <div className='grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
            {/* Left: prompt + size */}
            <Card className='h-fit min-w-0 lg:sticky lg:top-24'>
              <CardContent className='p-5'>
                <form onSubmit={handleSubmit} className='space-y-5'>
                  {/* Prompt */}
                  <div className='space-y-2'>
                    <Label htmlFor='studio-prompt'>{t('Prompt')}</Label>
                    <Textarea
                      id='studio-prompt'
                      rows={7}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={t('Describe the image you want to generate')}
                      className='min-h-36 resize-none'
                    />
                  </div>

                  {/* Size */}
                  <div className='space-y-2'>
                    <Label>{t('Image size')}</Label>
                    <div className='grid grid-cols-3 gap-2'>
                      {SIZE_OPTIONS.map((item) => {
                        const isSelected = size === item.value
                        return (
                          <button
                            key={item.value}
                            type='button'
                            onClick={() => setSize(item.value)}
                            className={cn(
                              'flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center transition-colors',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-background text-foreground hover:bg-muted/60'
                            )}
                          >
                            <span className='text-sm font-medium'>
                              {item.label}
                            </span>
                            <span
                              className={cn(
                                'text-[11px] leading-snug',
                                isSelected
                                  ? 'text-primary-foreground/75'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {item.hint}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Button type='submit' disabled={loading} className='w-full'>
                    {loading ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        {t('Generating...')}
                      </>
                    ) : (
                      <>
                        <Wand2 className='mr-2 h-4 w-4' />
                        {t('Generate')}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right: image area (templates or results) */}
            <Card className='min-h-[560px] min-w-0'>
              <div className='border-b px-4 py-3 sm:px-5'>
                <h2 className='text-base font-semibold tracking-tight break-words'>
                  {results.length > 0 ? t('Result') : t('Templates')}
                </h2>
                <p className='text-muted-foreground mt-1 text-xs leading-relaxed break-words sm:text-sm'>
                  {results.length > 0
                    ? t('Your generated images appear here.')
                    : t('Pick a template or generate your own image.')}
                </p>
              </div>

              <CardContent className='p-4 sm:p-5'>
                {loading ? (
                  <div className='flex min-h-[420px] flex-col items-center justify-center gap-3'>
                    <Loader2 className='text-primary h-10 w-10 animate-spin' />
                    <p className='text-muted-foreground text-sm'>
                      {t('Generating image...')}
                    </p>
                  </div>
                ) : results.length > 0 ? (
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                    {results.map((image, index) => {
                      const src = studioImageToSrc(image)
                      return (
                        <div
                          key={`${index}-${src.slice(0, 24)}`}
                          className='group bg-muted relative overflow-hidden rounded-lg border'
                        >
                          {src ? (
                            <img
                              src={src}
                              alt={t('Generated image')}
                              className='h-auto w-full object-cover'
                            />
                          ) : null}
                          <Button
                            type='button'
                            variant='secondary'
                            size='sm'
                            className='absolute right-2 top-2 gap-1.5 opacity-0 transition-opacity group-hover:opacity-100'
                            onClick={() => downloadImage(src, index)}
                          >
                            <Download className='h-4 w-4' />
                            {t('Download')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className='overflow-hidden rounded-lg border'>
                    <img
                      src={model.cover}
                      alt={model.label}
                      className='h-auto w-full object-cover'
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}
