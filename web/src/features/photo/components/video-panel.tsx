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
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowUp,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn, randomUUID } from '@/lib/utils'

import {
  defaultVideoDuration,
  MAX_VIDEO_REFERENCE_IMAGES,
  MAX_VIDEO_REFERENCE_VIDEOS,
  normalizeVideoAspectRatio,
  snapVideoResolution,
  videoReferenceUrls,
} from '@/features/video/lib/video-request'
import { pendingVideoJobsToHistoryItems } from '@/features/video/lib/video-generation-session'
import type {
  VideoHistoryItem,
  VideoParams,
} from '@/features/video/types'
import { useAuthStore } from '@/stores/auth-store'
import { useVideoGenerationStore } from '@/stores/video-generation-store'
import { useUserDisplay } from '@/hooks/use-user-display'
import { usePhotoModels } from '../hooks/use-photo-models'
import { snapPhotoSize } from '../lib/photo-models'
import { feedCoverWeight } from '../lib/works-masonry'
import {
  composerChipClass,
  ComposerModelList,
  ComposerOption,
  ComposerSelect,
} from './composer-select'
import { VideoNoteViewer } from './video-note-viewer'
import { VideoWorksCard } from './video-works-card'
import {
  WorksFeedHeader,
  WorksLoadMoreSentinel,
  WorksMasonry,
} from './works-masonry'

const DEFAULT_PARAMS: VideoParams = {
  model: '',
  prompt: '',
  duration: '',
  aspectRatio: '16:9',
  resolution: '720P',
}

const MAX_VIDEO_DURATION = 15
const DURATION_OPTIONS = ['6', '10', '15'] as const
type ReferenceKind = 'image' | 'video' | 'audio'
type ReferenceField = { id: string; url: string }

const VIDEO_PROMPT_SUGGESTIONS = [
  'A paper boat floating down a rainy city street at night',
  'A cheetah sprinting across the savanna at sunset',
  'Lanterns rising into the night sky over an ancient town',
] as const

const ASPECT_RATIOS: { value: string; label: string; hint?: string }[] = [
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '9:16', label: '9:16', hint: 'Portrait' },
  { value: '1:1', label: '1:1', hint: 'Square' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9' },
]

export function VideoPanel() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const bootstrapState = useAuthStore((state) => state.auth.bootstrapState)
  const author = useUserDisplay(user)
  const [params, setParams] = useState<VideoParams>(DEFAULT_PARAMS)
  const history = useVideoGenerationStore((state) => state.history)
  const historyLoading = useVideoGenerationStore((state) => state.historyLoading)
  const historyLoadingMore = useVideoGenerationStore(
    (state) => state.historyLoadingMore
  )
  const historyHasMore = useVideoGenerationStore((state) => state.historyHasMore)
  const pendingJobs = useVideoGenerationStore((state) => state.pendingJobs)
  const viewerId = useVideoGenerationStore((state) => state.viewerId)
  const loadHistory = useVideoGenerationStore((state) => state.loadHistory)
  const loadMoreHistory = useVideoGenerationStore((state) => state.loadMoreHistory)
  const resetForUser = useVideoGenerationStore((state) => state.resetForUser)
  const startGeneration = useVideoGenerationStore((state) => state.startGeneration)
  const deleteHistoryItem = useVideoGenerationStore(
    (state) => state.deleteHistoryItem
  )
  const setViewerId = useVideoGenerationStore((state) => state.setViewerId)
  const [submitting, setSubmitting] = useState(false)
  const [aspectById, setAspectById] = useState<Record<string, string>>({})
  const [referenceMenuOpen, setReferenceMenuOpen] = useState(false)
  const [imageFields, setImageFields] = useState<ReferenceField[]>([])
  const [videoFields, setVideoFields] = useState<ReferenceField[]>([])
  const [aspectDraft, setAspectDraft] = useState(DEFAULT_PARAMS.aspectRatio)
  const {
    models,
    isLoading: modelsLoading,
    addCustomModel,
    getSizeOptions,
  } = usePhotoModels('video')
  const resolutionOptions = getSizeOptions(params.model)
  const selectedModel =
    models.find((model) => model.id === params.model) ??
    (params.model ? { id: params.model, label: params.model } : null)

  const update = <K extends keyof VideoParams>(
    key: K,
    value: VideoParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  useEffect(() => {
    if (modelsLoading || models.length === 0) return
    const current =
      models.find((model) => model.id === params.model) ?? models[0]
    const nextTypes = current.endpointTypes ?? []
    const prevTypes = params.endpointTypes ?? []
    if (
      current.id === params.model &&
      nextTypes.join(',') === prevTypes.join(',')
    ) {
      return
    }
    setParams((prev) => ({
      ...prev,
      model: current.id,
      endpointTypes: nextTypes,
    }))
  }, [models, modelsLoading, params.endpointTypes, params.model])

  useEffect(() => {
    if (!params.model) return
    const next = snapPhotoSize(params.resolution, resolutionOptions)
    if (next === params.resolution) return
    update('resolution', next)
  }, [params.model, params.resolution, resolutionOptions])

  useEffect(() => {
    if (bootstrapState !== 'complete') return
    if (!user?.id) {
      resetForUser()
      return
    }
    void loadHistory(user.id)
  }, [bootstrapState, loadHistory, resetForUser, user?.id])

  const showImageRef = imageFields.length > 0
  const showVideoRef = videoFields.length > 0
  const showAudioRef = params.referenceAudioUrl !== undefined
  const hasAnyReference = showImageRef || showVideoRef || showAudioRef

  const addReference = (kind: ReferenceKind) => {
    if (kind === 'image') {
      if (imageFields.length >= MAX_VIDEO_REFERENCE_IMAGES) {
        toast.error(
          t('Up to {{max}} images can be attached.', {
            max: MAX_VIDEO_REFERENCE_IMAGES,
          })
        )
        return
      }
      setImageFields((prev) => [...prev, { id: randomUUID(), url: '' }])
    } else if (kind === 'video') {
      if (videoFields.length >= MAX_VIDEO_REFERENCE_VIDEOS) {
        toast.error(
          t('Up to {{max}} videos can be attached.', {
            max: MAX_VIDEO_REFERENCE_VIDEOS,
          })
        )
        return
      }
      setVideoFields((prev) => [...prev, { id: randomUUID(), url: '' }])
    } else if (params.referenceAudioUrl === undefined) {
      update('referenceAudioUrl', '')
    }
    setReferenceMenuOpen(false)
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    if (!user?.id) {
      toast.error(
        t('Sign in to save and view your generation history.')
      )
      return
    }
    if (!params.model.trim()) {
      toast.error(t('Please enter a model'))
      return
    }
    if (!params.prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    const referenceImageUrls = videoReferenceUrls(
      imageFields.map((field) => field.url)
    )
    const referenceVideoUrls = videoReferenceUrls(
      videoFields.map((field) => field.url)
    )
    const referenceAudioUrl = params.referenceAudioUrl?.trim()
    if (imageFields.some((field) => !field.url.trim())) {
      toast.error(t('Please enter a reference image URL'))
      return
    }
    if (videoFields.some((field) => !field.url.trim())) {
      toast.error(t('Please enter a reference video URL'))
      return
    }
    if (showAudioRef && !referenceAudioUrl) {
      toast.error(t('Please enter a reference audio URL'))
      return
    }

    const durationInput = params.duration.trim()
    let duration = String(defaultVideoDuration(params.model))
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

    const aspectRatio = normalizeVideoAspectRatio(params.aspectRatio)
    if (!aspectRatio) {
      toast.error(t('Enter a ratio like 16:9'))
      return
    }

    const requestParams: VideoParams = {
      ...params,
      duration,
      aspectRatio,
      resolution: snapVideoResolution(params.model, params.resolution),
      referenceImageUrls:
        referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
      referenceVideoUrls:
        referenceVideoUrls.length > 0 ? referenceVideoUrls : undefined,
      referenceImageUrl: undefined,
      referenceVideoUrl: undefined,
      referenceAudioUrl: showAudioRef ? referenceAudioUrl : undefined,
      endpointTypes:
        models.find((model) => model.id === params.model)?.endpointTypes ??
        params.endpointTypes,
    }

    setSubmitting(true)
    try {
      await startGeneration(requestParams, user.id)
    } finally {
      setSubmitting(false)
    }
  }

  const applyHistoryItem = (item: VideoHistoryItem) => {
    setParams((prev) => ({
      ...prev,
      model: item.model,
      prompt: item.prompt,
      duration: item.duration,
      aspectRatio: item.aspectRatio,
      resolution: item.resolution,
      referenceImageUrls: videoReferenceUrls(
        item.referenceImageUrls,
        item.referenceImageUrl
      ),
      referenceVideoUrls: videoReferenceUrls(
        item.referenceVideoUrls,
        item.referenceVideoUrl
      ),
      referenceImageUrl: undefined,
      referenceVideoUrl: undefined,
      referenceAudioUrl: item.referenceAudioUrl,
    }))
    setImageFields(
      videoReferenceUrls(
        item.referenceImageUrls,
        item.referenceImageUrl
      ).map((url) => ({ id: randomUUID(), url }))
    )
    setVideoFields(
      videoReferenceUrls(
        item.referenceVideoUrls,
        item.referenceVideoUrl
      ).map((url) => ({ id: randomUUID(), url }))
    )
    setAspectDraft(item.aspectRatio)
    if (!models.some((model) => model.id === item.model)) {
      addCustomModel(item.model)
    }
  }

  const pendingIds = useMemo(
    () => new Set(pendingJobs.map((job) => job.id)),
    [pendingJobs]
  )
  const galleryItems = useMemo(
    () => [...pendingVideoJobsToHistoryItems(pendingJobs), ...history],
    [history, pendingJobs]
  )

  const [durationMenuOpen, setDurationMenuOpen] = useState(false)

  const applyAspectRatio = (value: string, close?: () => void) => {
    const next = normalizeVideoAspectRatio(value)
    if (!next) {
      toast.error(t('Enter a ratio like 16:9'))
      return
    }
    update('aspectRatio', next)
    setAspectDraft(next)
    close?.()
  }
  const durationUnit = t('{{value}}s', { value: '' }).trim()
  const modelLabel =
    selectedModel?.label || (modelsLoading ? t('Loading') : t('Model'))

  return (
    <div className='min-w-0 space-y-10'>
      <div className='mx-auto w-full max-w-3xl'>
        <h1 className='mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl'>
          {t('Start creating with')}{' '}
          <ComposerSelect
            label={modelLabel}
            ariaLabel={t('Model')}
            contentClassName='w-80'
            triggerClassName='inline-flex h-auto max-w-[min(100%,20rem)] items-baseline gap-1 rounded-none border-0 bg-transparent px-0 text-2xl font-semibold text-primary hover:bg-transparent sm:text-3xl [&_svg]:size-5'
          >
            {(close) => (
              <ComposerModelList
                models={models}
                selectedId={params.model}
                loading={modelsLoading}
                onSelect={(modelId) => {
                  const selected = models.find((model) => model.id === modelId)
                  setParams((prev) => ({
                    ...prev,
                    model: modelId,
                    endpointTypes: selected?.endpointTypes ?? [],
                  }))
                  close()
                }}
                onAddCustom={(modelId) => {
                  addCustomModel(modelId)
                  setParams((prev) => ({
                    ...prev,
                    model: modelId,
                    endpointTypes: [],
                  }))
                  close()
                }}
              />
            )}
          </ComposerSelect>
        </h1>

        <form
          onSubmit={handleSubmit}
          className='bg-muted/40 flex flex-col gap-3 rounded-[28px] border p-3 sm:p-4'
          aria-label='video-prompt-bar'
        >
          <div className='flex items-start gap-2'>
            <Popover open={referenceMenuOpen} onOpenChange={setReferenceMenuOpen}>
              <PopoverTrigger
                type='button'
                className={cn(
                  'inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground mt-0.5',
                  hasAnyReference && 'border-primary text-foreground'
                )}
                aria-label={t('Add reference')}
                aria-pressed={hasAnyReference}
              >
                <Plus className='size-5' />
              </PopoverTrigger>
              <PopoverContent align='start' side='bottom' className='w-56 gap-1 p-1.5'>
                <ComposerOption
                  selected={showImageRef}
                  title={t('Image')}
                  hint={t('Up to {{max}} images can be attached.', {
                    max: MAX_VIDEO_REFERENCE_IMAGES,
                  })}
                  onClick={() => addReference('image')}
                />
                <ComposerOption
                  selected={showVideoRef}
                  title={t('Video')}
                  hint={t('Up to {{max}} videos can be attached.', {
                    max: MAX_VIDEO_REFERENCE_VIDEOS,
                  })}
                  onClick={() => addReference('video')}
                />
                <ComposerOption
                  selected={showAudioRef}
                  title={t('Audio')}
                  hint={t('Reference audio')}
                  onClick={() => addReference('audio')}
                />
              </PopoverContent>
            </Popover>
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
              placeholder={t('Describe your idea.')}
              className='max-h-48 min-h-20 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0'
            />
          </div>

          {(showImageRef || showVideoRef || showAudioRef) ? (
            <div className='space-y-2'>
              {imageFields.map((field) => (
                <div key={field.id} className='flex items-center gap-2'>
                  <Input
                    type='url'
                    value={field.url}
                    onChange={(event) => {
                      const value = event.target.value
                      setImageFields((prev) =>
                        prev.map((item) =>
                          item.id === field.id ? { ...item, url: value } : item
                        )
                      )
                    }}
                    placeholder='https://example.com/image.jpg'
                    aria-label={t('Reference image')}
                    className='h-9'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-8 shrink-0'
                    aria-label={t('Remove')}
                    onClick={() =>
                      setImageFields((prev) =>
                        prev.filter((item) => item.id !== field.id)
                      )
                    }
                  >
                    <X className='size-4' />
                  </Button>
                </div>
              ))}
              {videoFields.map((field) => (
                <div key={field.id} className='flex items-center gap-2'>
                  <Input
                    type='url'
                    value={field.url}
                    onChange={(event) => {
                      const value = event.target.value
                      setVideoFields((prev) =>
                        prev.map((item) =>
                          item.id === field.id ? { ...item, url: value } : item
                        )
                      )
                    }}
                    placeholder='https://example.com/video.mp4'
                    aria-label={t('Reference video')}
                    className='h-9'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-8 shrink-0'
                    aria-label={t('Remove')}
                    onClick={() =>
                      setVideoFields((prev) =>
                        prev.filter((item) => item.id !== field.id)
                      )
                    }
                  >
                    <X className='size-4' />
                  </Button>
                </div>
              ))}
              {showAudioRef ? (
                <div className='flex items-center gap-2'>
                  <Input
                    type='url'
                    value={params.referenceAudioUrl ?? ''}
                    onChange={(event) => {
                      update('referenceAudioUrl', event.target.value)
                    }}
                    placeholder='https://example.com/audio.mp3'
                    aria-label={t('Reference audio')}
                    className='h-9'
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-8 shrink-0'
                    aria-label={t('Remove')}
                    onClick={() => update('referenceAudioUrl', undefined)}
                  >
                    <X className='size-4' />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'>
              <ComposerSelect
                label={modelLabel}
                ariaLabel={t('Model')}
                contentClassName='w-80'
              >
                {(close) => (
                  <ComposerModelList
                    models={models}
                    selectedId={params.model}
                    loading={modelsLoading}
                    onSelect={(modelId) => {
                      const selected = models.find(
                        (model) => model.id === modelId
                      )
                      setParams((prev) => ({
                        ...prev,
                        model: modelId,
                        endpointTypes: selected?.endpointTypes ?? [],
                      }))
                      close()
                    }}
                    onAddCustom={(modelId) => {
                      addCustomModel(modelId)
                      setParams((prev) => ({
                        ...prev,
                        model: modelId,
                        endpointTypes: [],
                      }))
                      close()
                    }}
                  />
                )}
              </ComposerSelect>

              <ComposerSelect
                label={params.aspectRatio}
                ariaLabel={t('Aspect ratio')}
              >
                {(close) => (
                  <>
                    {ASPECT_RATIOS.map((item) => (
                      <ComposerOption
                        key={item.value}
                        selected={item.value === params.aspectRatio}
                        title={item.label}
                        hint={item.hint ? t(item.hint) : undefined}
                        onClick={() => {
                          update('aspectRatio', item.value)
                          setAspectDraft(item.value)
                          close()
                        }}
                      />
                    ))}
                    <div className='space-y-1 px-2.5 py-2'>
                      <Label htmlFor='video-aspect-custom' className='text-xs'>
                        {t('Custom')}
                      </Label>
                      <Input
                        id='video-aspect-custom'
                        value={aspectDraft}
                        placeholder={t('For example 4:5')}
                        aria-label={t('Custom')}
                        onChange={(event) => {
                          const value = event.target.value
                          setAspectDraft(value)
                          const next = normalizeVideoAspectRatio(value)
                          if (next) update('aspectRatio', next)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          applyAspectRatio(aspectDraft, close)
                        }}
                        onBlur={() => {
                          if (normalizeVideoAspectRatio(aspectDraft)) {
                            applyAspectRatio(aspectDraft)
                          }
                        }}
                      />
                    </div>
                  </>
                )}
              </ComposerSelect>

              <ComposerSelect
                label={params.resolution}
                ariaLabel={t('Resolution')}
              >
                {(close) =>
                  resolutionOptions.map((item) => (
                    <ComposerOption
                      key={item.value}
                      selected={item.value === params.resolution}
                      title={item.value}
                      hint={
                        item.hint && item.hint !== item.value
                          ? t(item.hint)
                          : undefined
                      }
                      onClick={() => {
                        update('resolution', item.value)
                        close()
                      }}
                    />
                  ))
                }
              </ComposerSelect>

              <div className={cn(composerChipClass, 'gap-0.5 pr-0.5')}>
                <input
                  id='video-duration'
                  type='number'
                  inputMode='numeric'
                  min={1}
                  max={MAX_VIDEO_DURATION}
                  value={params.duration}
                  placeholder={t('Auto')}
                  aria-label={t('Video duration')}
                  className='placeholder:text-foreground h-full w-12 min-w-0 bg-transparent px-0.5 text-center text-xs font-medium outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
                  onChange={(event) => update('duration', event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.preventDefault()
                  }}
                  onWheel={(event) => event.currentTarget.blur()}
                />
                {params.duration ? (
                  <span className='text-muted-foreground pr-0.5 text-xs'>
                    {durationUnit}
                  </span>
                ) : null}
                <Popover open={durationMenuOpen} onOpenChange={setDurationMenuOpen}>
                  <PopoverTrigger
                    className='text-muted-foreground hover:bg-muted flex size-7 shrink-0 items-center justify-center rounded-full'
                    aria-label={t('Video duration')}
                  >
                    <ChevronDown className='size-3.5 opacity-70' />
                  </PopoverTrigger>
                  <PopoverContent align='start' side='bottom' className='w-56 p-1.5'>
                    <ComposerOption
                      selected={params.duration === ''}
                      title={t('Auto')}
                      hint={t('Up to {{max}}s', { max: MAX_VIDEO_DURATION })}
                      onClick={() => {
                        update('duration', '')
                        setDurationMenuOpen(false)
                      }}
                    />
                    {DURATION_OPTIONS.map((value) => (
                      <ComposerOption
                        key={value}
                        selected={params.duration === value}
                        title={t('{{value}}s', { value })}
                        onClick={() => {
                          update('duration', value)
                          setDurationMenuOpen(false)
                        }}
                      />
                    ))}
                    <div className='space-y-1 px-2.5 py-2'>
                      <Label htmlFor='video-duration-custom' className='text-xs'>
                        {t('Video duration')}
                      </Label>
                      <Input
                        id='video-duration-custom'
                        type='number'
                        inputMode='numeric'
                        min={1}
                        max={MAX_VIDEO_DURATION}
                        value={params.duration}
                        onChange={(event) =>
                          update('duration', event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.preventDefault()
                        }}
                        placeholder={t('Up to {{max}}s', {
                          max: MAX_VIDEO_DURATION,
                        })}
                        aria-label={t('Video duration')}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button
              type='submit'
              size='icon'
              disabled={submitting}
              className='size-10 shrink-0 rounded-full'
              aria-label={t('Generate video')}
            >
              {submitting ? (
                <Loader2 className='size-4 animate-spin' />
              ) : (
                <ArrowUp className='size-4' />
              )}
            </Button>
          </div>
        </form>

        <div className='mt-3 flex gap-2 overflow-x-auto pb-1'>
          {VIDEO_PROMPT_SUGGESTIONS.map((prompt) => (
            <button
              key={prompt}
              type='button'
              onClick={() => update('prompt', t(prompt))}
              className='bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground max-w-52 shrink-0 truncate rounded-full border px-3 py-1.5 text-left text-xs transition-colors'
            >
              {t(prompt)}
            </button>
          ))}
        </div>
      </div>

      <div className='flex flex-col gap-3'>
        <WorksFeedHeader />

        {historyLoading && history.length === 0 ? (
          <div className='bg-muted relative aspect-[3/4] max-w-56 overflow-hidden rounded-lg'>
            <div className='bg-background/35 absolute inset-0 flex items-center justify-center'>
              <Loader2 className='text-primary size-6 animate-spin' />
            </div>
          </div>
        ) : null}

        {galleryItems.length > 0 ? (
          <WorksMasonry
            items={galleryItems}
            getItemKey={(item) => item.id}
            getItemWeight={(item) =>
              feedCoverWeight(aspectById[item.id] ?? item.aspectRatio)
            }
            renderItem={(item) => (
              <VideoWorksCard
                item={item}
                authorName={author.displayName}
                authorInitials={author.initials}
                coverAspect={aspectById[item.id]}
                generating={pendingIds.has(item.id)}
                onOpen={(opened) => setViewerId(opened.id)}
                onDelete={
                  pendingIds.has(item.id) ? undefined : deleteHistoryItem
                }
                onAspectMeasured={(id, ratio) => {
                  setAspectById((current) => {
                    if (current[id] === ratio) return current
                    return { ...current, [id]: ratio }
                  })
                }}
              />
            )}
          />
        ) : null}
        {user?.id ? (
          <WorksLoadMoreSentinel
            enabled={
              historyHasMore && !historyLoading && !historyLoadingMore
            }
            loading={historyLoadingMore}
            onLoadMore={loadMoreHistory}
          />
        ) : null}
        {!historyLoading &&
        !historyLoadingMore &&
        !historyHasMore &&
        galleryItems.length === 0 ? (
          <div className='text-muted-foreground py-10 text-center text-sm'>
            {user?.id
              ? t('No history yet')
              : t('Sign in to save and view your generation history.')}
          </div>
        ) : null}
      </div>
      <VideoNoteViewer
        items={history.filter((item) => Boolean(item.url))}
        activeId={viewerId}
        onClose={() => setViewerId(null)}
        onActiveIdChange={setViewerId}
        onDelete={deleteHistoryItem}
        onUsePrompt={(item) => {
          applyHistoryItem(item)
          setViewerId(null)
        }}
      />
    </div>
  )
}
