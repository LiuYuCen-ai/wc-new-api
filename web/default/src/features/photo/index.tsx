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
import { useMemo, useRef, useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, Check, ChevronLeft, ChevronRight, ImageIcon, ImagePlus, Loader2, Plus, Sparkles, Wand2, X } from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  buildGeminiAspectRatioGroups,
  buildGptSizeGroups,
  GEMINI_IMAGE_SIZE_OPTIONS,
  GPT_IMAGE_SIZE_OPTIONS,
  getGeminiAspectRatiosForSize,
  getNanoBananaKind,
  isGeminiOptionAvailable,
  PHOTO_MODELS,
  QUALITIES,
  RESOLUTIONS,
  RESOLUTION_SIZE_MAP,
} from './constants'
import { generatePhoto } from './api'
import type {
  PhotoAspectRatio,
  PhotoImageSize,
  PhotoParams,
  PhotoQuality,
  PhotoResolution,
  PhotoResult,
} from './types'

interface HistoryItem {
  id: string
  prompt: string
  model: string
  created_at: string
  images: PhotoResult[]
}

type PhotoPreviewState = {
  src: string
  prompt?: string
  model?: string
  createdAt?: string
  images?: string[]
  currentIndex?: number
}

function getPhotoResultSrc(image: PhotoResult): string {
  if (image.b64 && image.mimeType) {
    return `data:${image.mimeType};base64,${image.b64}`
  }
  if (image.b64) {
    return `data:image/png;base64,${image.b64}`
  }
  return image.url ?? ''
}

function downloadPhotoSrc(src: string, filename: string) {
  if (!src) return
  const a = document.createElement('a')
  a.href = src
  a.download = filename
  a.click()
}

const DEFAULT_PARAMS: PhotoParams = {
  model: PHOTO_MODELS[0].id,
  prompt: '',
  n: 1,
  size: '1024x1024',
  resolution: '1K',
  quality: 'high',
  aspectRatio: '1:1',
  imageSize: '1K',
  imageUrlEnabled: false,
  imageDataUrls: [],
}

const MAX_UPLOAD_IMAGES = 6
const PHOTO_HISTORY_LIMIT = 50
const LEGACY_PHOTO_HISTORY_KEY = 'photo_history'

function getPhotoHistoryStorageKey(userId?: number | null) {
  if (userId == null) return `${LEGACY_PHOTO_HISTORY_KEY}_guest`
  return `${LEGACY_PHOTO_HISTORY_KEY}_${userId}`
}

function loadPhotoHistory(userId?: number | null): HistoryItem[] {
  if (userId == null) return []

  try {
    const storageKey = getPhotoHistoryStorageKey(userId)
    const legacy = localStorage.getItem(LEGACY_PHOTO_HISTORY_KEY)
    if (!localStorage.getItem(storageKey) && legacy) {
      localStorage.setItem(storageKey, legacy)
    }

    const stored = localStorage.getItem(storageKey)
    if (!stored) return []

    const parsed = JSON.parse(stored) as unknown
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : []
  } catch {
    return []
  }
}

function persistPhotoHistoryItem(
  userId: number,
  item: HistoryItem
): HistoryItem[] {
  const storageKey = getPhotoHistoryStorageKey(userId)
  const history = loadPhotoHistory(userId)
  const next = [item, ...history].slice(0, PHOTO_HISTORY_LIMIT)
  localStorage.setItem(storageKey, JSON.stringify(next))
  return next
}

export function Photo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const [params, setParams] = useState<PhotoParams>(DEFAULT_PARAMS)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [preview, setPreview] = useState<PhotoPreviewState | null>(null)

  const selectedModel = useMemo(
    () => PHOTO_MODELS.find((m) => m.id === params.model) ?? PHOTO_MODELS[0],
    [params.model]
  )

  const isGemini = selectedModel.id.startsWith('gemini-')
  const gptModels = useMemo(
    () => PHOTO_MODELS.filter((m) => m.id.startsWith('gpt-')),
    []
  )
  const geminiModels = useMemo(
    () => PHOTO_MODELS.filter((m) => m.id.startsWith('gemini-')),
    []
  )
  const activeModels = isGemini ? geminiModels : gptModels
  const nanoBananaKind = getNanoBananaKind(selectedModel.id)

  const geminiAspectRatioGroups = useMemo(
    () => buildGeminiAspectRatioGroups(nanoBananaKind, params.imageSize),
    [nanoBananaKind, params.imageSize]
  )

  const geminiImageSizeOptions = useMemo(
    () =>
      GEMINI_IMAGE_SIZE_OPTIONS.filter(
        (item) =>
          (selectedModel.imageSizes?.includes(item.size) ?? true) &&
          isGeminiOptionAvailable(item.exclusiveTo, nanoBananaKind)
      ),
    [selectedModel.imageSizes, nanoBananaKind]
  )

  const gptSizeGroups = useMemo(
    () => buildGptSizeGroups(params.resolution),
    [params.resolution]
  )

  const supportsImageInput =
    isGemini || selectedModel.id === 'gpt-image-2'

  useEffect(() => {
    if (!isGemini) return
    setParams((prev) => {
      const model =
        PHOTO_MODELS.find((m) => m.id === prev.model) ?? selectedModel
      const kind = getNanoBananaKind(model.id)
      if (!kind) return prev

      const allowedSizes = GEMINI_IMAGE_SIZE_OPTIONS.filter(
        (item) =>
          (model.imageSizes?.includes(item.size) ?? true) &&
          isGeminiOptionAvailable(item.exclusiveTo, kind)
      ).map((item) => item.size)
      const nextImageSize = allowedSizes.includes(prev.imageSize)
        ? prev.imageSize
        : (allowedSizes[0] ?? '1K')

      const allowedRatios = getGeminiAspectRatiosForSize(kind, nextImageSize)
      const nextAspectRatio = allowedRatios.includes(prev.aspectRatio)
        ? prev.aspectRatio
        : (allowedRatios[0] ?? '1:1')

      if (
        nextAspectRatio === prev.aspectRatio &&
        nextImageSize === prev.imageSize
      ) {
        return prev
      }
      return {
        ...prev,
        aspectRatio: nextAspectRatio as PhotoAspectRatio,
        imageSize: nextImageSize as PhotoImageSize,
      }
    })
  }, [isGemini, selectedModel.id])

  useEffect(() => {
    if (!isGemini || !nanoBananaKind) return
    setParams((prev) => {
      const allowedRatios = getGeminiAspectRatiosForSize(
        nanoBananaKind,
        prev.imageSize
      )
      if (allowedRatios.includes(prev.aspectRatio)) return prev
      return {
        ...prev,
        aspectRatio: (allowedRatios[0] ?? '1:1') as PhotoAspectRatio,
      }
    })
  }, [isGemini, nanoBananaKind, params.imageSize])

  useEffect(() => {
    if (!user?.id) {
      setHistory([])
      return
    }
    setHistory(loadPhotoHistory(user.id))
  }, [user?.id])

  const openPreview = (state: PhotoPreviewState) => {
    setPreview(state)
  }

  const handlePreviewNavigate = (direction: -1 | 1) => {
    setPreview((current) => {
      if (
        !current?.images?.length ||
        current.currentIndex === undefined ||
        current.currentIndex === null
      ) {
        return current
      }
      const nextIndex = current.currentIndex + direction
      if (nextIndex < 0 || nextIndex >= current.images.length) {
        return current
      }
      return {
        ...current,
        currentIndex: nextIndex,
        src: current.images[nextIndex] ?? current.src,
      }
    })
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = <K extends keyof PhotoParams>(
    key: K,
    value: PhotoParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const updateResolution = (k: '1K' | '2K' | '4K') => {
    setParams((prev) => {
      const sizes = RESOLUTION_SIZE_MAP[k].map((opt) => opt.size)
      const nextSize = sizes.includes(prev.size)
        ? prev.size
        : (sizes[0] as PhotoResolution)
      return { ...prev, resolution: k, size: nextSize }
    })
  }

  const updateGeminiImageSize = (size: PhotoImageSize) => {
    setParams((prev) => {
      const kind = getNanoBananaKind(prev.model)
      if (!kind) return { ...prev, imageSize: size }

      const allowedRatios = getGeminiAspectRatiosForSize(kind, size)
      const nextAspectRatio = allowedRatios.includes(prev.aspectRatio)
        ? prev.aspectRatio
        : (allowedRatios[0] ?? '1:1')

      return {
        ...prev,
        imageSize: size,
        aspectRatio: nextAspectRatio as PhotoAspectRatio,
      }
    })
  }

  const handleFilesPicked = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    const remainingSlots =
      MAX_UPLOAD_IMAGES - params.imageDataUrls.length
    if (remainingSlots <= 0) {
      toast.warning(
        t('Up to {{max}} images can be attached.', {
          max: MAX_UPLOAD_IMAGES,
        })
      )
      return
    }
    const accepted = files.slice(0, remainingSlots)
    const readers = accepted.map(
      (file) =>
        new Promise<{ name: string; dataUrl: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () =>
            resolve({
              name: file.name,
              dataUrl: String(reader.result ?? ''),
            })
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(file)
        })
    )
    try {
      const results = await Promise.all(readers)
      setParams((prev) => ({
        ...prev,
        imageDataUrls: [
          ...prev.imageDataUrls,
          ...results,
        ],
      }))
    } catch (err) {
      toast.error(
        (err as Error)?.message ?? t('Failed to read image file')
      )
    }
  }

  const removeImageDataUrl = (index: number) => {
    setParams((prev) => ({
      ...prev,
      imageDataUrls: prev.imageDataUrls.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!user) {
      navigate({
        to: '/sign-in',
        search: {
          redirect: `${window.location.pathname}${window.location.search}`,
        },
      })
      return
    }
    if (!params.prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    setLoading(true)
    try {
      const res = await generatePhoto(params)
      if (!res.images || res.images.length === 0) {
        toast.warning(t('No images returned'))
      } else {
        toast.success(
          t('Generated {{count}} image(s)', { count: res.images.length })
        )

        if (user?.id) {
          const nextHistory = persistPhotoHistoryItem(user.id, {
            id: Date.now().toString(),
            prompt: params.prompt,
            model: params.model,
            created_at: new Date().toISOString(),
            images: res.images,
          })
          setHistory(nextHistory)
        }
      }
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        (err as Error).message ??
        t('Generation failed')
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PublicLayout>
      <PageTransition>
        <div className='mx-auto w-full max-w-7xl py-6'>
          {/* Header */}
          <div className='mb-6 flex flex-col gap-2'>
            <div className='flex items-center gap-2'>
              <Sparkles className='text-primary h-6 w-6' />
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('Experience Hub')}
              </h1>
            </div>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Unified access to Gemini, GPT Image and other image models. Quota is deducted automatically.'
              )}
            </p>
          </div>

          <div className='grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]'>
            {/* Left: parameters */}
            <Card className='h-fit lg:sticky lg:top-24'>
              <CardContent className='space-y-4 p-5'>
                <form
                  onSubmit={handleSubmit}
                  className='space-y-4'
                  aria-label='photo-params'
                >
                  {/* Model */}
                  <div className='space-y-3'>
                    <Label>{t('Model')}</Label>
                    <div className='bg-muted/60 rounded-lg p-1'>
                      <div className='grid grid-cols-2 gap-1'>
                        <button
                          type='button'
                          onClick={() => update('model', gptModels[0].id)}
                          className={cn(
                            'rounded-md px-3 py-2 text-sm font-semibold transition-all',
                            !isGemini
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          GPT
                        </button>
                        <button
                          type='button'
                          onClick={() => update('model', geminiModels[0].id)}
                          className={cn(
                            'rounded-md px-3 py-2 text-sm font-semibold transition-all',
                            isGemini
                              ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Gemini
                        </button>
                      </div>
                    </div>
                    <div className='space-y-2'>
                      {activeModels.map((model) => {
                        const isSelected = model.id === params.model
                        return (
                          <button
                            key={model.id}
                            type='button'
                            onClick={() => update('model', model.id)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                              isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                                : 'border-border bg-muted/20 hover:border-muted-foreground/25 hover:bg-muted/50'
                            )}
                          >
                            <div className='min-w-0 flex-1 space-y-0.5'>
                              <span
                                className={cn(
                                  'block text-sm font-medium leading-snug',
                                  isSelected
                                    ? 'text-foreground'
                                    : 'text-foreground/90'
                                )}
                              >
                                {t(model.label)}
                              </span>
                              {model.description ? (
                                <span className='text-muted-foreground block text-xs leading-relaxed'>
                                  {t(model.description)}
                                </span>
                              ) : null}
                            </div>
                            {isSelected ? (
                              <Check className='text-primary mt-0.5 h-4 w-4 shrink-0' />
                            ) : (
                              <span className='border-muted-foreground/30 mt-1 h-4 w-4 shrink-0 rounded-full border' />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className='space-y-2'>
                    <Label htmlFor='photo-prompt'>{t('Prompt')}</Label>
                    <Textarea
                      id='photo-prompt'
                      rows={5}
                      value={params.prompt}
                      onChange={(e) => update('prompt', e.target.value)}
                      placeholder={t('Photo prompt placeholder')}
                    />
                  </div>

                  {selectedModel.supportsSize ? (
                    <>
                      <div className='space-y-2'>
                        <Label>{t('Image size')}</Label>
                        <div className='grid grid-cols-3 gap-2'>
                          {GPT_IMAGE_SIZE_OPTIONS.map((item) => {
                            const isSelected = params.resolution === item.size
                            return (
                              <button
                                key={item.size}
                                type='button'
                                onClick={() =>
                                  updateResolution(
                                    item.size as '1K' | '2K' | '4K'
                                  )
                                }
                                className={cn(
                                  'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                                )}
                              >
                                <span className='text-sm font-medium'>
                                  {item.size}
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

                      <div className='space-y-3'>
                        <Label>{t('Aspect ratio')}</Label>
                        {gptSizeGroups.map((group) => (
                          <div key={group.id} className='space-y-2'>
                            <p className='text-muted-foreground text-xs font-medium'>
                              {t(group.label)}
                            </p>
                            <div className='grid grid-cols-2 gap-2'>
                              {group.items.map((item) => {
                                const isSelected = params.size === item.size
                                return (
                                  <button
                                    key={item.size}
                                    type='button'
                                    onClick={() =>
                                      update(
                                        'size',
                                        item.size as PhotoResolution
                                      )
                                    }
                                    className={cn(
                                      'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                      isSelected
                                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                        : 'border-border bg-background text-foreground hover:bg-muted/60'
                                    )}
                                  >
                                    <span className='text-sm font-medium'>
                                      {item.ratio === 'Auto'
                                        ? t('Auto')
                                        : item.ratio}
                                    </span>
                                    <span
                                      className={cn(
                                        'text-[11px] leading-snug',
                                        isSelected
                                          ? 'text-primary-foreground/75'
                                          : 'text-muted-foreground'
                                      )}
                                    >
                                      {item.resolution}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedModel.supportsQuality ? (
                        <div className='space-y-2'>
                          <Label>{t('Quality')}</Label>
                          <div className='grid grid-cols-4 gap-2'>
                            {QUALITIES.map((q) => {
                              const isSelected = params.quality === q
                              return (
                                <button
                                  key={q}
                                  type='button'
                                  onClick={() =>
                                    update(
                                      'quality',
                                      q as PhotoQuality
                                    )
                                  }
                                  className={cn(
                                    'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                                    isSelected
                                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                                  )}
                                >
                                  {q}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {/* image_size + aspect_ratio — Gemini */}
                      <div className='space-y-2'>
                        <Label>{t('Image size')}</Label>
                        <div
                          className={cn(
                            'grid gap-2',
                            geminiImageSizeOptions.length > 3
                              ? 'grid-cols-2'
                              : 'grid-cols-3'
                          )}
                        >
                          {geminiImageSizeOptions.map((item) => {
                            const isSelected = params.imageSize === item.size
                            return (
                              <button
                                key={item.size}
                                type='button'
                                onClick={() =>
                                  updateGeminiImageSize(item.size)
                                }
                                className={cn(
                                  'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                                )}
                              >
                                <div className='flex w-full items-center gap-1.5'>
                                  <span className='text-sm font-medium'>
                                    {item.size}
                                  </span>
                                  {item.exclusiveTo === 'banana2' ? (
                                    <span
                                      className={cn(
                                        'rounded px-1 py-0.5 text-[10px] font-medium leading-none',
                                        isSelected
                                          ? 'bg-primary-foreground/20 text-primary-foreground'
                                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                      )}
                                    >
                                      {t('Banana 2')}
                                    </span>
                                  ) : null}
                                </div>
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

                      <div className='space-y-3'>
                        <Label>{t('Aspect ratio')}</Label>
                        {geminiAspectRatioGroups.length > 0 ? (
                          geminiAspectRatioGroups.map((group) => (
                            <div key={group.id} className='space-y-2'>
                              <p className='text-muted-foreground text-xs font-medium'>
                                {t(group.label)}
                              </p>
                              <div className='grid grid-cols-2 gap-2'>
                                {group.items.map((item) => {
                                  const isSelected =
                                    params.aspectRatio === item.ratio
                                  return (
                                    <button
                                      key={item.ratio}
                                      type='button'
                                      onClick={() =>
                                        update(
                                          'aspectRatio',
                                          item.ratio as PhotoAspectRatio
                                        )
                                      }
                                      className={cn(
                                        'flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors',
                                        isSelected
                                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                          : 'border-border bg-background text-foreground hover:bg-muted/60'
                                      )}
                                    >
                                      <div className='flex w-full items-center gap-1.5'>
                                        <span className='text-sm font-medium'>
                                          {item.ratio}
                                        </span>
                                        {item.exclusiveTo === 'banana2' ? (
                                          <span
                                            className={cn(
                                              'rounded px-1 py-0.5 text-[10px] font-medium leading-none',
                                              isSelected
                                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                            )}
                                          >
                                            {t('Banana 2')}
                                          </span>
                                        ) : null}
                                      </div>
                                      <span
                                        className={cn(
                                          'text-[11px] leading-snug',
                                          isSelected
                                            ? 'text-primary-foreground/75'
                                            : 'text-muted-foreground'
                                        )}
                                      >
                                        {item.resolution}
                                      </span>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className='text-muted-foreground text-xs'>
                            {t(
                              'Select an image size to view aspect ratio options.'
                            )}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {supportsImageInput ? (
                    <div className='space-y-2 rounded-lg border border-dashed p-3'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*'
                        multiple
                        className='hidden'
                        onChange={handleFilesPicked}
                      />
                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-2 font-medium'>
                          <ImageIcon className='h-4 w-4' />
                          <span>{t('Image Input')}</span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <Switch
                            checked={params.imageUrlEnabled}
                            onCheckedChange={(checked) =>
                              update('imageUrlEnabled', checked)
                            }
                          />
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            disabled={
                              !params.imageUrlEnabled ||
                              params.imageDataUrls.length >=
                                MAX_UPLOAD_IMAGES
                            }
                            onClick={() =>
                              fileInputRef.current?.click()
                            }
                          >
                            <Plus className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>
                      <p className='text-muted-foreground text-xs'>
                        {t(
                          'Enable to add local images as image input for image editing.'
                        )}
                      </p>
                      {params.imageUrlEnabled &&
                      params.imageDataUrls.length > 0 ? (
                        <div className='flex flex-wrap gap-2'>
                          {params.imageDataUrls.map((img, index) => (
                            <div
                              key={`${img.name}-${index}`}
                              className='group relative h-[120px] w-[120px] overflow-hidden rounded-md border bg-muted'
                            >
                              <img
                                src={img.dataUrl}
                                alt={img.name}
                                className='h-full w-full object-cover'
                              />
                              <Button
                                type='button'
                                variant='secondary'
                                size='icon'
                                className='absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100'
                                onClick={() =>
                                  removeImageDataUrl(index)
                                }
                              >
                                <X className='h-3 w-3' />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {params.imageUrlEnabled &&
                      params.imageDataUrls.length === 0 ? (
                        <button
                          type='button'
                          onClick={() =>
                            fileInputRef.current?.click()
                          }
                          className='text-muted-foreground hover:bg-muted/60 hover:text-foreground flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed py-6 text-xs transition-colors'
                        >
                          <ImagePlus className='h-5 w-5' />
                          {t(
                            'Click to upload local images (max {{max}})',
                            { max: MAX_UPLOAD_IMAGES }
                          )}
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  <Button
                    type='submit'
                    disabled={loading}
                    className='w-full'
                  >
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

            {/* Right: generation history */}
            <Card className='flex min-h-[560px] flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]'>
              <div className='border-b px-4 py-3 sm:px-5'>
                <h2 className='text-base font-semibold tracking-tight'>
                  {t('Generation History')}
                </h2>
                <p className='text-muted-foreground mt-1 text-xs sm:text-sm'>
                  {user
                    ? t(
                        'Your recent generations are saved here and can be previewed anytime.'
                      )
                    : t('Sign in to save and view your generation history.')}
                </p>
              </div>

              <CardContent className='min-h-0 flex-1 overflow-y-auto p-4 sm:p-5'>
                {loading ? (
                  <PhotoSkeletonGrid count={params.n} />
                ) : !user ? (
                  <EmptyState
                    isGemini={isGemini}
                    message={t('Sign in to save and view your generation history.')}
                  />
                ) : history.length === 0 ? (
                  <EmptyState isGemini={isGemini} />
                ) : (
                  <HistoryFeed history={history} onPreview={openPreview} />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <PhotoImagePreviewDialog
          open={Boolean(preview)}
          onOpenChange={(open) => {
            if (!open) setPreview(null)
          }}
          preview={preview}
          onNavigate={handlePreviewNavigate}
        />
      </PageTransition>
    </PublicLayout>
  )
}

function EmptyState({
  isGemini,
  message,
}: {
  isGemini: boolean
  message?: string
}) {
  const { t } = useTranslation()
  const description =
    message ??
    (isGemini
      ? t(
          'Configure the parameters on the left and click Generate. Gemini image models support aspect ratio and image size.'
        )
      : t(
          'Configure the parameters on the left and click Generate. OpenAI image models support resolution and quality.'
        ))

  return (
    <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
      <div className='bg-muted rounded-full p-3'>
        <ImageIcon className='text-muted-foreground h-8 w-8' />
      </div>
      <div className='space-y-1'>
        <h3 className='text-base font-semibold'>{t('No images yet')}</h3>
        <p className='text-muted-foreground max-w-md text-sm'>{description}</p>
      </div>
    </div>
  )
}

function PhotoSkeletonGrid({ count }: { count: number }) {
  return (
    <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6'>
      {Array.from({ length: Math.max(1, Number(count) || 1) }).map((_, i) => (
        <Skeleton key={i} className='aspect-square w-full rounded-lg' />
      ))}
    </div>
  )
}

type HistoryImageEntry = {
  id: string
  src: string
  prompt: string
  model: string
  createdAt: string
  imageIndex: number
  imageSources: string[]
}

function flattenHistoryImages(history: HistoryItem[]): HistoryImageEntry[] {
  return history.flatMap((item) => {
    const imageSources = item.images.map(getPhotoResultSrc).filter(Boolean)
    return item.images.flatMap((img, idx) => {
      const src = getPhotoResultSrc(img)
      if (!src) return []
      return [
        {
          id: `${item.id}-${idx}`,
          src,
          prompt: item.prompt,
          model: item.model,
          createdAt: item.created_at,
          imageIndex: idx,
          imageSources,
        },
      ]
    })
  })
}

function HistoryFeed({
  history,
  onPreview,
}: {
  history: HistoryItem[]
  onPreview: (state: PhotoPreviewState) => void
}) {
  const { t } = useTranslation()
  const entries = flattenHistoryImages(history)

  return (
    <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6'>
      {entries.map((entry) => (
        <button
          key={entry.id}
          type='button'
          onClick={() =>
            onPreview({
              src: entry.src,
              prompt: entry.prompt,
              model: entry.model,
              createdAt: entry.createdAt,
              images: entry.imageSources,
              currentIndex: entry.imageIndex,
            })
          }
          className='bg-muted group relative aspect-square cursor-zoom-in overflow-hidden rounded-lg ring-1 ring-foreground/10'
          aria-label={t('View image')}
        >
          <img
            src={entry.src}
            alt={entry.prompt}
            className='h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]'
          />
          <div className='pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10' />
          <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
            <p className='line-clamp-2 text-left text-[11px] leading-tight text-white'>
              {entry.prompt}
            </p>
            <p className='mt-1 truncate text-left text-[10px] text-white/75'>
              {entry.model} · {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

function PhotoImagePreviewDialog({
  open,
  onOpenChange,
  preview,
  onNavigate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: PhotoPreviewState | null
  onNavigate: (direction: -1 | 1) => void
}) {
  const { t } = useTranslation()

  if (!preview?.src) {
    return null
  }

  const hasMultiple = (preview.images?.length ?? 0) > 1
  const currentIndex = preview.currentIndex ?? 0
  const canGoPrev = hasMultiple && currentIndex > 0
  const canGoNext =
    hasMultiple &&
    preview.images != null &&
    currentIndex < preview.images.length - 1
  const filename = `photo-${Date.now()}-${currentIndex + 1}.png`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[92vh] w-[min(96vw,56rem)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl'>
        <DialogHeader className='space-y-3 border-b px-4 py-4 sm:px-6'>
          <DialogTitle>{t('Image preview')}</DialogTitle>
          {preview.prompt ? (
            <p className='text-muted-foreground text-sm leading-6'>
              {preview.prompt}
            </p>
          ) : null}
          {(preview.model || preview.createdAt) && (
            <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
              {preview.model ? <span>{preview.model}</span> : null}
              {preview.model && preview.createdAt ? <span>•</span> : null}
              {preview.createdAt ? (
                <span>{new Date(preview.createdAt).toLocaleString()}</span>
              ) : null}
              {hasMultiple ? (
                <>
                  <span>•</span>
                  <span>
                    {t('Image {{n}}', { n: currentIndex + 1 })} /{' '}
                    {preview.images?.length}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </DialogHeader>

        <div className='bg-muted/40 relative flex min-h-[280px] flex-1 items-center justify-center px-4 py-4 sm:min-h-[420px] sm:px-8'>
          {canGoPrev ? (
            <Button
              type='button'
              variant='secondary'
              size='icon'
              className='absolute top-1/2 left-2 z-10 -translate-y-1/2 sm:left-4'
              onClick={() => onNavigate(-1)}
              aria-label={t('Previous image')}
            >
              <ChevronLeft className='h-5 w-5' />
            </Button>
          ) : null}

          <img
            src={preview.src}
            alt={t('Image preview')}
            className='max-h-[58vh] w-full object-contain'
          />

          {canGoNext ? (
            <Button
              type='button'
              variant='secondary'
              size='icon'
              className='absolute top-1/2 right-2 z-10 -translate-y-1/2 sm:right-4'
              onClick={() => onNavigate(1)}
              aria-label={t('Next image')}
            >
              <ChevronRight className='h-5 w-5' />
            </Button>
          ) : null}
        </div>

        <div className='flex items-center justify-end gap-2 border-t px-4 py-4 sm:px-6'>
          <Button
            variant='outline'
            onClick={() => downloadPhotoSrc(preview.src, filename)}
          >
            <Download className='mr-2 h-4 w-4' />
            {t('Download')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
