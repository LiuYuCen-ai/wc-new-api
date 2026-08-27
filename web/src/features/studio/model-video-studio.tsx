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
  Clapperboard,
  Download,
  Loader2,
  Wand2,
} from 'lucide-react'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

import { generateVideo } from '@/features/video/api'
import type { VideoTaskStatus } from '@/features/video/types'

import type { StudioModel } from './models'

// Template slots shown before the user generates anything. Replace the `src`
// values later with your own template thumbnails.
const TEMPLATE_SLOTS: { id: string; src?: string }[] = [
  { id: 'tpl-1' },
  { id: 'tpl-2' },
  { id: 'tpl-3' },
  { id: 'tpl-4' },
]

const MAX_VIDEO_DURATION = 15

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '9:16', label: '9:16', hint: 'Portrait' },
  { value: '1:1', label: '1:1', hint: 'Square' },
] as const

const RESOLUTIONS = [
  { value: '720P', label: '720P', hint: 'Balanced preview quality' },
  { value: '1080P', label: '1080P', hint: 'Sharper output preview' },
] as const

const VIDEO_STATUS_KEYS: Record<VideoTaskStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  running: 'Running',
  done: 'Completed',
  succeeded: 'Succeeded',
  failed: 'Failed',
}

const optionTileClass =
  'flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-2 py-2 text-center transition-colors'

type ModelVideoStudioProps = {
  model: StudioModel
}

export function ModelVideoStudio({ model }: ModelVideoStudioProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)

  const [prompt, setPrompt] = useState<string>(model.defaultPrompt)
  const [duration, setDuration] = useState<string>('')
  const [aspectRatio, setAspectRatio] =
    useState<(typeof ASPECT_RATIOS)[number]['value']>('16:9')
  const [resolution, setResolution] =
    useState<(typeof RESOLUTIONS)[number]['value']>('720P')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<VideoTaskStatus | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

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

    const durationInput = duration.trim()
    let finalDuration = String(MAX_VIDEO_DURATION)
    if (durationInput) {
      const parsed = Number(durationInput)
      if (
        !Number.isInteger(parsed) ||
        parsed < 1 ||
        parsed > MAX_VIDEO_DURATION
      ) {
        toast.error(
          t('Duration must be an integer between 1 and {{max}} seconds', {
            max: MAX_VIDEO_DURATION,
          })
        )
        return
      }
      finalDuration = String(parsed)
    }

    setLoading(true)
    setVideoUrl(null)
    setStatus('queued')
    try {
      const { url } = await generateVideo(
        {
          model: model.id,
          prompt: prompt.trim(),
          duration: finalDuration,
          aspectRatio,
          resolution,
        },
        (s) => setStatus(s)
      )
      setVideoUrl(url)
      setStatus('done')
      toast.success(t('Video generated successfully'))
    } catch (err) {
      setStatus('failed')
      const message =
        err instanceof Error ? err.message : t('Video generation failed')
      toast.error(message)
    } finally {
      setLoading(false)
    }
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
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <h1 className='min-w-0 text-2xl font-bold tracking-tight break-words'>
                  {model.label}
                </h1>
                <Badge variant='secondary'>{t(model.tag)}</Badge>
                <span className='text-muted-foreground text-xs font-medium'>
                  {model.vendor}
                </span>
              </div>
              <p className='text-muted-foreground max-w-3xl text-sm leading-relaxed text-balance break-words'>
                {t(model.description)}
              </p>
            </div>
          </div>

          <div className='grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]'>
            {/* Left: prompt + params */}
            <Card className='h-fit min-w-0 lg:sticky lg:top-24'>
              <CardContent className='p-5'>
                <form onSubmit={handleSubmit} className='space-y-5'>
                  {/* Prompt */}
                  <div className='space-y-2'>
                    <Label htmlFor='studio-video-prompt'>{t('Prompt')}</Label>
                    <Textarea
                      id='studio-video-prompt'
                      rows={6}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={t('Video prompt placeholder')}
                      className='min-h-32 resize-none'
                    />
                  </div>

                  {/* Duration */}
                  <div className='space-y-2'>
                    <Label htmlFor='studio-video-duration'>
                      {t('Video duration')}
                    </Label>
                    <Input
                      id='studio-video-duration'
                      type='number'
                      min={1}
                      max={MAX_VIDEO_DURATION}
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder={t('Up to {{max}}s', {
                        max: MAX_VIDEO_DURATION,
                      })}
                    />
                  </div>

                  {/* Aspect ratio */}
                  <div className='space-y-2'>
                    <Label>{t('Aspect ratio')}</Label>
                    <div className='grid grid-cols-3 gap-2'>
                      {ASPECT_RATIOS.map((item) => {
                        const isSelected = aspectRatio === item.value
                        return (
                          <button
                            key={item.value}
                            type='button'
                            onClick={() => setAspectRatio(item.value)}
                            className={cn(
                              optionTileClass,
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
                              {t(item.hint)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Resolution */}
                  <div className='space-y-2'>
                    <Label>{t('Resolution')}</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      {RESOLUTIONS.map((item) => {
                        const isSelected = resolution === item.value
                        return (
                          <button
                            key={item.value}
                            type='button'
                            onClick={() => setResolution(item.value)}
                            className={cn(
                              optionTileClass,
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
                              {t(item.hint)}
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
                        {t('Generate video')}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Right: video area (templates or result) */}
            <Card className='min-h-[560px] min-w-0'>
              <div className='border-b px-4 py-3 sm:px-5'>
                <h2 className='text-base font-semibold tracking-tight break-words'>
                  {videoUrl ? t('Result') : t('Templates')}
                </h2>
                <p className='text-muted-foreground mt-1 text-xs leading-relaxed break-words sm:text-sm'>
                  {videoUrl
                    ? t('Your generated video appears here.')
                    : t('Pick a template or generate your own video.')}
                </p>
              </div>

              <CardContent className='p-4 sm:p-5'>
                {loading ? (
                  <div className='flex min-h-[420px] flex-col items-center justify-center gap-3'>
                    <Loader2 className='text-primary h-10 w-10 animate-spin' />
                    <p className='text-muted-foreground text-sm'>
                      {t('Generating your video, please wait...')}
                    </p>
                    {status && (
                      <p className='text-muted-foreground text-xs'>
                        {t('Status')}: {t(VIDEO_STATUS_KEYS[status])}
                      </p>
                    )}
                  </div>
                ) : videoUrl ? (
                  <div className='flex min-w-0 flex-col gap-3'>
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      loop
                      className='max-h-[520px] w-full rounded-md bg-black'
                    />
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='gap-2'
                        render={
                          <a
                            href={videoUrl}
                            download
                            target='_blank'
                            rel='noreferrer'
                          />
                        }
                      >
                        <Download className='h-4 w-4' />
                        {t('Download')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className='grid grid-cols-2 gap-4 lg:grid-cols-2 xl:grid-cols-4'>
                    {TEMPLATE_SLOTS.map((slot) => (
                      <div
                        key={slot.id}
                        className='bg-muted/40 flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-dashed'
                      >
                        {slot.src ? (
                          <img
                            src={slot.src}
                            alt={t('Template')}
                            className='h-full w-full object-cover'
                          />
                        ) : (
                          <Clapperboard className='text-muted-foreground/50 h-8 w-8' />
                        )}
                      </div>
                    ))}
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
