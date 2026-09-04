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
import { cn } from '@/lib/utils'

import {
  defaultVideoDuration,
  snapVideoResolution,
} from '@/features/video/lib/video-request'
import type {
  VideoHistoryItem,
  VideoParams,
} from '@/features/video/types'
import { useAuthStore } from '@/stores/auth-store'
import { useVideoGenerationStore } from '@/stores/video-generation-store'
import { useUserDisplay } from '@/hooks/use-user-display'
import { usePhotoModels } from '../hooks/use-photo-models'
import { snapPhotoSize } from '../lib/photo-models'
import { masonryItemWeight } from '../lib/works-masonry'
import {
  composerChipClass,
  ComposerModelList,
  ComposerOption,
  ComposerSelect,
} from './composer-select'
import { VideoNoteViewer } from './video-note-viewer'
import { VideoWorksCard } from './video-works-card'
import { WorksMasonry } from './works-masonry'

const DEFAULT_PARAMS: VideoParams = {
  model: '',
  prompt: '',
  duration: '',
  aspectRatio: '16:9',
  resolution: '720P',
}

const MAX_VIDEO_DURATION = 15
const DURATION_OPTIONS = ['6', '10', '15'] as const

const VIDEO_PROMPT_SUGGESTIONS = [
  'A paper boat floating down a rainy city street at night',
  'A cheetah sprinting across the savanna at sunset',
  'Lanterns rising into the night sky over an ancient town',
] as const

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9', hint: 'Landscape' },
  { value: '9:16', label: '9:16', hint: 'Portrait' },
  { value: '1:1', label: '1:1', hint: 'Square' },
] as const

export function VideoPanel() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const bootstrapState = useAuthStore((state) => state.auth.bootstrapState)
  const author = useUserDisplay(user)
  const [params, setParams] = useState<VideoParams>(DEFAULT_PARAMS)
  const history = useVideoGenerationStore((state) => state.history)
  const historyLoading = useVideoGenerationStore((state) => state.historyLoading)
  const pendingJob = useVideoGenerationStore((state) => state.pendingJob)
  const viewerId = useVideoGenerationStore((state) => state.viewerId)
  const loadHistory = useVideoGenerationStore((state) => state.loadHistory)
  const resetForUser = useVideoGenerationStore((state) => state.resetForUser)
  const startGeneration = useVideoGenerationStore((state) => state.startGeneration)
  const deleteHistoryItem = useVideoGenerationStore(
    (state) => state.deleteHistoryItem
  )
  const setViewerId = useVideoGenerationStore((state) => state.setViewerId)
  const loading = Boolean(pendingJob)
  const [aspectById, setAspectById] = useState<Record<string, string>>({})
  const [referenceEnabled, setReferenceEnabled] = useState(false)
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

  const handleReferenceToggle = () => {
    setReferenceEnabled((enabled) => {
      const next = !enabled
      if (!next) {
        setParams((prev) => ({ ...prev, referenceImageUrl: undefined }))
      }
      return next
    })
  }

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (loading) return
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
    const referenceImageUrl = params.referenceImageUrl?.trim()
    if (referenceEnabled && !referenceImageUrl) {
      toast.error(t('Please enter a reference image URL'))
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

    const requestParams: VideoParams = {
      ...params,
      duration,
      resolution: snapVideoResolution(params.model, params.resolution),
      referenceImageUrl: referenceEnabled ? referenceImageUrl : undefined,
      endpointTypes:
        models.find((model) => model.id === params.model)?.endpointTypes ??
        params.endpointTypes,
    }

    await startGeneration(requestParams, user.id)
  }

  const applyHistoryItem = (item: VideoHistoryItem) => {
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
    if (!models.some((model) => model.id === item.model)) {
      addCustomModel(item.model)
    }
  }

  const galleryItems = useMemo((): VideoHistoryItem[] => {
    if (!pendingJob) return history
    return [
      {
        id: '__generating__',
        requestId: '__generating__',
        status: pendingJob.status,
        prompt: pendingJob.params.prompt,
        model: pendingJob.params.model,
        duration:
          pendingJob.params.duration ||
          String(defaultVideoDuration(pendingJob.params.model)),
        aspectRatio: pendingJob.params.aspectRatio,
        resolution: pendingJob.params.resolution,
        createdAt: pendingJob.startedAt,
      },
      ...history,
    ]
  }, [history, pendingJob])

  const [durationMenuOpen, setDurationMenuOpen] = useState(false)
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
            <Button
              type='button'
              variant='outline'
              size='icon'
              className={cn(
                'text-muted-foreground mt-0.5 size-11 shrink-0 rounded-2xl',
                referenceEnabled && 'border-primary text-foreground'
              )}
              aria-label={t('Reference image')}
              aria-pressed={referenceEnabled}
              onClick={handleReferenceToggle}
            >
              <Plus className='size-5' />
            </Button>
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

          {referenceEnabled ? (
            <Input
              type='url'
              value={params.referenceImageUrl ?? ''}
              onChange={(e) => {
                const value = e.target.value
                update('referenceImageUrl', value || undefined)
              }}
              placeholder='https://example.com/image.jpg'
              aria-label={t('Reference image')}
              className='h-9'
            />
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
                {(close) =>
                  ASPECT_RATIOS.map((item) => (
                    <ComposerOption
                      key={item.value}
                      selected={item.value === params.aspectRatio}
                      title={item.label}
                      hint={t(item.hint)}
                      onClick={() => {
                        update('aspectRatio', item.value)
                        close()
                      }}
                    />
                  ))
                }
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
              disabled={loading}
              className='size-10 shrink-0 rounded-full'
              aria-label={t('Generate video')}
            >
              {loading ? (
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

      <div className='space-y-4'>
        <div className='flex items-center gap-2'>
          <span className='bg-muted rounded-full px-3 py-1 text-sm font-medium'>
            {t('Works')}
          </span>
        </div>

        {historyLoading && history.length === 0 ? (
          <div className='bg-muted relative aspect-[3/4] max-w-56 overflow-hidden rounded-xl'>
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
              masonryItemWeight(aspectById[item.id] ?? item.aspectRatio)
            }
            renderItem={(item) => (
              <VideoWorksCard
                item={item}
                authorName={author.displayName}
                authorInitials={author.initials}
                coverAspect={aspectById[item.id]}
                generating={item.id === '__generating__'}
                onOpen={(opened) => setViewerId(opened.id)}
                onDelete={
                  item.id === '__generating__' ? undefined : deleteHistoryItem
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
        {!historyLoading && galleryItems.length === 0 ? (
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
