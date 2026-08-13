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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Download,
  Film,
  History,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { generateVideo } from '@/features/video/api'
import type {
  VideoHistoryItem,
  VideoParams,
  VideoTaskStatus,
} from '@/features/video/types'

const PRESET_VIDEO_MODELS = [
  'grok-imagine-1.0-video',
  'grok-imagine-video-1.5-preview',
] as const

const DEFAULT_PARAMS: VideoParams = {
  model: PRESET_VIDEO_MODELS[0],
  prompt: '',
  duration: '',
  aspectRatio: '16:9',
  resolution: '720p',
}

const VIDEO_HISTORY_KEY = 'quick-video-history'

const VIDEO_STATUS_KEYS: Record<VideoTaskStatus, string> = {
  queued: 'Queued',
  processing: 'Processing',
  running: 'Running',
  done: 'Completed',
  succeeded: 'Succeeded',
  failed: 'Failed',
}

const videoOptionTileClass =
  'flex min-w-0 w-full flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors'
const videoOptionHintClass = 'w-full break-words text-[11px] leading-snug'

const MAX_VIDEO_DURATION = 15

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '9:16', label: '9:16', hint: 'Portrait' },
  { value: '1:1', label: '1:1', hint: 'Square' },
] as const

const RESOLUTIONS = [
  { value: '720p', label: '720p', hint: 'Balanced preview quality' },
  { value: '1080p', label: '1080p', hint: 'Sharper output preview' },
] as const

function loadVideoHistory(): VideoHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(VIDEO_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as VideoHistoryItem[]) : []
  } catch {
    return []
  }
}

function saveVideoHistory(history: VideoHistoryItem[]) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(VIDEO_HISTORY_KEY, JSON.stringify(history))
}

export function VideoPanel() {
  const { t } = useTranslation()
  const [params, setParams] = useState<VideoParams>(DEFAULT_PARAMS)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<VideoTaskStatus | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<VideoHistoryItem[]>(() =>
    loadVideoHistory()
  )
  const [referenceEnabled, setReferenceEnabled] = useState(false)
  const [customModelEnabled, setCustomModelEnabled] = useState(false)

  const update = <K extends keyof VideoParams>(
    key: K,
    value: VideoParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const handleReferenceToggle = (checked: boolean) => {
    setReferenceEnabled(checked)
    if (!checked) {
      setParams((prev) => ({ ...prev, referenceImageUrl: undefined }))
    }
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (loading) return
    if (!params.model.trim()) {
      toast.error(t('Please enter a model'))
      return
    }
    if (!params.prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    const referenceImageUrl = params.referenceImageUrl?.trim()
    if (referenceEnabled && !referenceImageUrl) {
      toast.error(t('Please enter a reference image URL'))
      return
    }

    const durationInput = params.duration.trim()
    let duration = String(MAX_VIDEO_DURATION)
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
      duration = String(parsed)
    }

    const requestParams: VideoParams = {
      ...params,
      duration,
      referenceImageUrl: referenceEnabled ? referenceImageUrl : undefined,
    }

    setLoading(true)
    setVideoUrl(null)
    setStatus('queued')
    try {
      const { requestId, url } = await generateVideo(requestParams, (s) =>
        setStatus(s)
      )
      const nextItem: VideoHistoryItem = {
        id: `${requestId}-${Date.now()}`,
        requestId,
        status: 'done',
        url,
        prompt: params.prompt.trim(),
        model: params.model.trim(),
        duration: requestParams.duration,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        referenceImageUrl: requestParams.referenceImageUrl,
        createdAt: Date.now(),
      }

      setVideoUrl(url)
      setStatus('done')
      setHistory((prev) => {
        const next = [nextItem, ...prev].slice(0, 12)
        saveVideoHistory(next)
        return next
      })
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

  const selectHistoryItem = (item: VideoHistoryItem) => {
    setVideoUrl(item.url ?? null)
    setStatus(item.status)
    setParams((prev) => ({
      ...prev,
      model: item.model,
      prompt: item.prompt,
      duration: item.duration,
      aspectRatio: item.aspectRatio,
      resolution: item.resolution,
      referenceImageUrl: item.referenceImageUrl,
    }))
    setReferenceEnabled(item.referenceImageUrl ? true : false)
    setCustomModelEnabled(
      !PRESET_VIDEO_MODELS.includes(
        item.model as (typeof PRESET_VIDEO_MODELS)[number]
      )
    )
  }

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id)
      saveVideoHistory(next)
      return next
    })
  }

  return (
    <>
      <div className='grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'>
        {/* Left: parameters */}
        <Card className='h-fit min-w-0 lg:sticky lg:top-24'>
          <CardContent className='space-y-4 p-5'>
            <div className='space-y-4' aria-label={t('Video generation parameters')}>
              <div className='space-y-2'>
                <Label>{t('Model')}</Label>
                <div className='grid gap-2'>
                  {PRESET_VIDEO_MODELS.map((model) => (
                    <button
                      key={model}
                      type='button'
                      onClick={() => {
                        setCustomModelEnabled(false)
                        update('model', model)
                      }}
                      className={cn(
                        videoOptionTileClass,
                        !customModelEnabled && params.model === model
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <span className='w-full text-sm font-medium break-words'>
                        {model}
                      </span>
                    </button>
                  ))}
                  <button
                    type='button'
                    onClick={() => {
                      setCustomModelEnabled(true)
                      if (
                        PRESET_VIDEO_MODELS.includes(
                          params.model as (typeof PRESET_VIDEO_MODELS)[number]
                        )
                      ) {
                        update('model', '')
                      }
                    }}
                    className={cn(
                      videoOptionTileClass,
                      customModelEnabled
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <span className='text-sm font-medium'>
                      {t('Custom model')}
                    </span>
                    <span
                      className={cn(
                        videoOptionHintClass,
                        'text-muted-foreground'
                      )}
                    >
                      {t('Enter a model configured by this site')}
                    </span>
                  </button>
                </div>
                {customModelEnabled && (
                  <Input
                    id='video-model'
                    value={params.model}
                    onChange={(e) => update('model', e.target.value)}
                    placeholder={t('Enter video model name')}
                  />
                )}
              </div>

              <div className='space-y-2 rounded-lg border border-dashed p-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex min-w-0 items-center gap-2 font-medium'>
                    <ImagePlus className='h-4 w-4 shrink-0' />
                    <span className='min-w-0 break-words'>
                      {t('Reference image')}
                    </span>
                  </div>
                  <Switch
                    checked={referenceEnabled}
                    onCheckedChange={handleReferenceToggle}
                  />
                </div>
                {referenceEnabled && (
                  <Input
                    type='url'
                    value={params.referenceImageUrl ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      update('referenceImageUrl', value || undefined)
                      setReferenceEnabled(Boolean(value.trim()))
                    }}
                    placeholder='https://example.com/image.jpg'
                  />
                )}
              </div>

              <div className='space-y-2'>
                <Label htmlFor='video-duration'>{t('Video duration')}</Label>
                <Input
                  id='video-duration'
                  type='number'
                  min={1}
                  max={MAX_VIDEO_DURATION}
                  value={params.duration}
                  onChange={(e) => update('duration', e.target.value)}
                  placeholder={t('Up to {{max}}s', {
                    max: MAX_VIDEO_DURATION,
                  })}
                />
              </div>

              <div className='space-y-2'>
                <Label>{t('Aspect ratio')}</Label>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1'>
                  {ASPECT_RATIOS.map((item) => {
                    const isSelected = params.aspectRatio === item.value
                    return (
                      <button
                        key={item.value}
                        type='button'
                        onClick={() => update('aspectRatio', item.value)}
                        className={cn(
                          videoOptionTileClass,
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
                            videoOptionHintClass,
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

              <div className='space-y-2'>
                <Label>{t('Resolution')}</Label>
                <div className='grid grid-cols-2 gap-2'>
                  {RESOLUTIONS.map((item) => {
                    const isSelected = params.resolution === item.value
                    return (
                      <button
                        key={item.value}
                        type='button'
                        onClick={() => update('resolution', item.value)}
                        className={cn(
                          videoOptionTileClass,
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
                            videoOptionHintClass,
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
            </div>
          </CardContent>
        </Card>

        {/* Right: preview + history */}
        <div className='min-w-0 space-y-4'>
          <Card className='min-w-0 overflow-hidden'>
            <CardContent className='p-0'>
              {videoUrl ? (
                <div className='flex min-w-0 flex-col gap-3 p-4'>
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
                <div className='bg-muted/30 flex min-h-[520px] min-w-0 items-center justify-center p-6'>
                  <div className='text-muted-foreground flex max-w-sm flex-col items-center gap-3 text-center'>
                    <div className='bg-background flex h-16 w-16 items-center justify-center rounded-full border shadow-sm'>
                      {loading ? (
                        <Loader2 className='text-primary h-7 w-7 animate-spin' />
                      ) : (
                        <Sparkles className='text-primary h-7 w-7' />
                      )}
                    </div>
                    <div className='space-y-1'>
                      <p className='text-foreground text-sm font-medium'>
                        {loading
                          ? t('Generating your video, please wait...')
                          : t('Your video preview will appear here')}
                      </p>
                      {loading && status && (
                        <p className='text-xs leading-relaxed break-words'>
                          {t('Status')}: {t(VIDEO_STATUS_KEYS[status])}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='min-w-0'>
            <CardContent className='space-y-3 p-5'>
              <div className='flex min-w-0 items-center gap-2'>
                <History className='text-primary h-4 w-4 shrink-0' />
                <h2 className='min-w-0 text-sm font-semibold break-words'>
                  {t('History')}
                </h2>
              </div>
              {history.length > 0 ? (
                <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className='group bg-background hover:border-primary hover:bg-muted/40 relative flex min-w-0 flex-col overflow-hidden rounded-md border text-left transition-colors'
                    >
                      <button
                        type='button'
                        onClick={() => selectHistoryItem(item)}
                        className='flex min-w-0 flex-1 flex-col text-left'
                      >
                        {item.url ? (
                          <video
                            src={item.url}
                            className='h-[160px] w-full bg-black object-cover'
                            muted
                            playsInline
                          />
                        ) : (
                          <div className='bg-muted/20 flex h-[160px] w-full items-center justify-center'>
                            <Sparkles className='text-muted-foreground h-6 w-6' />
                          </div>
                        )}
                        <div className='w-full space-y-1 p-3'>
                          <p className='truncate pr-7 text-sm font-medium'>
                            {item.model || t('Not set')}
                          </p>
                          <p className='text-muted-foreground line-clamp-2 text-xs leading-relaxed'>
                            {item.prompt}
                          </p>
                          <div className='text-muted-foreground flex items-center justify-between gap-2 text-[11px]'>
                            <span>{item.duration}s</span>
                            <span>{item.aspectRatio}</span>
                            <span>{item.resolution}</span>
                          </div>
                        </div>
                      </button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='text-muted-foreground hover:text-destructive absolute top-[168px] right-2 h-7 w-7'
                        aria-label={t('Delete history')}
                        onClick={() => deleteHistoryItem(item.id)}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-muted-foreground rounded-md border border-dashed p-6 text-sm'>
                  {t('No history yet')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom prompt bar (fixed, chat-style) */}
      <div className='pointer-events-none fixed inset-x-0 bottom-0 z-40'>
        <div className='mx-auto w-full max-w-7xl px-4 pb-4 sm:px-6'>
          <form
            onSubmit={handleSubmit}
            className='bg-background/95 pointer-events-auto flex flex-col gap-2 rounded-2xl border p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80'
            aria-label='video-prompt-bar'
          >
            <Label htmlFor='video-prompt' className='sr-only'>
              {t('Prompt')}
            </Label>
            <Textarea
              id='video-prompt'
              rows={3}
              value={params.prompt}
              onChange={(e) => update('prompt', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
              placeholder={t('Video prompt placeholder')}
              className='max-h-48 min-h-20 flex-1 resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0'
            />
            <div className='flex items-center justify-between gap-2'>
              <div className='text-muted-foreground flex min-w-0 items-center gap-2 px-1 text-xs'>
                <Film className='h-4 w-4 shrink-0' />
                <span className='truncate'>{params.model || t('Not set')}</span>
              </div>
              <Button type='submit' disabled={loading} className='h-9 shrink-0'>
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
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
