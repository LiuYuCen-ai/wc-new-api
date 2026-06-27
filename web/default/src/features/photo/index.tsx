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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download, ImageIcon, ImagePlus, Loader2, Plus, Sparkles, Wand2, X, History } from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'
import {
  ASPECT_RATIOS,
  IMAGE_SIZES,
  PHOTO_MODELS,
  QUALITIES,
  RESOLUTIONS,
  RESOLUTION_TIERS,
  RESOLUTION_SIZE_MAP,
} from './constants'
import { generatePhoto } from './api'
import type {
  PhotoAspectRatio,
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

const DEFAULT_PARAMS: PhotoParams = {
  model: PHOTO_MODELS[0].id,
  prompt: '',
  n: '',
  size: '1024x1024',
  resolution: '1K',
  quality: 'high',
  aspectRatio: '1:1',
  imageSize: '1K',
  imageUrlEnabled: false,
  imageDataUrls: [],
}

const MAX_UPLOAD_IMAGES = 6

export function Photo() {
  const { t } = useTranslation()
  const [params, setParams] = useState<PhotoParams>(DEFAULT_PARAMS)
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<PhotoResult[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

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
    if (!params.prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    setLoading(true)
    setImages([])
    try {
      const res = await generatePhoto(params)
      if (!res.images || res.images.length === 0) {
        toast.warning(t('No images returned'))
      } else {
        setImages(res.images)
        toast.success(
          t('Generated {{count}} image(s)', { count: res.images.length })
        )
        
        // 保存到历史记录
        saveToHistory({
          id: Date.now().toString(),
          prompt: params.prompt,
          model: params.model,
          created_at: new Date().toISOString(),
          images: res.images,
        })
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

  const saveToHistory = (item: HistoryItem) => {
    try {
      const stored = localStorage.getItem('photo_history')
      const history: HistoryItem[] = stored ? JSON.parse(stored) : []
      history.unshift(item) // 最新的放在前面
      // 只保留最近50条记录
      const limited = history.slice(0, 50)
      localStorage.setItem('photo_history', JSON.stringify(limited))
    } catch (err) {
      console.error('Failed to save history:', err)
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
                  <div className='space-y-2'>
                    <Label>{t('Model')}</Label>
                    <div className='grid grid-cols-2 gap-2'>
                      <Button
                        type='button'
                        variant={!isGemini ? 'default' : 'outline'}
                        className='h-9 justify-start'
                        onClick={() => update('model', gptModels[0].id)}
                      >
                        GPT
                      </Button>
                      <Button
                        type='button'
                        variant={isGemini ? 'default' : 'outline'}
                        className='h-9 justify-start'
                        onClick={() => update('model', geminiModels[0].id)}
                      >
                        Gemini
                      </Button>
                    </div>
                    {/* Specific model name buttons (rendered when a category is active) */}
                    <div className='mt-2 flex flex-wrap gap-2'>
                      {activeModels.map((model) => {
                        const isSelected = model.id === params.model
                        return (
                          <button
                            key={model.id}
                            type='button'
                            onClick={() => update('model', model.id)}
                            className={cn(
                              'inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border bg-background text-foreground hover:bg-muted/60'
                            )}
                          >
                            {model.label}
                          </button>
                        )
                      })}
                    </div>
                    {selectedModel.description ? (
                      <p className='text-muted-foreground text-xs'>
                        {t(selectedModel.description)}
                      </p>
                    ) : null}
                  </div>

                  {/* Prompt */}
                  <div className='space-y-2'>
                    <Label htmlFor='photo-prompt'>{t('Prompt')}</Label>
                    <Textarea
                      id='photo-prompt'
                      rows={5}
                      value={params.prompt}
                      onChange={(e) => update('prompt', e.target.value)}
                      placeholder={t(
                        'Photo prompt placeholder',
                        'Describe what you want to generate, e.g. a cute cat sitting on a windowsill at sunset'
                      )}
                    />
                  </div>

                  {/* n (count) — only OpenAI family */}
                  {selectedModel.supportsN ? (
                    <div className='space-y-2'>
                      <Label htmlFor='photo-n'>{t('Number of images')}</Label>
                      <Input
                        id='photo-n'
                        type='number'
                        min={1}
                        step={1}
                        placeholder='1'
                        value={params.n}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '') {
                            update('n', '')
                            return
                          }
                          const parsed = Number(raw)
                          if (!Number.isFinite(parsed)) return
                          update('n', Math.max(1, Math.floor(parsed)))
                        }}
                      />
                      <p className='text-muted-foreground text-xs'>
                        {t(
                          '1 request per image.',
                          '1 request per image.'
                        )}
                      </p>
                    </div>
                  ) : null}

                  {/* resolution tier (K) — only OpenAI family */}
                  {selectedModel.supportsSize ? (
                    <div className='space-y-2'>
                      <Label htmlFor='photo-resolution'>
                        {t('Resolution')}
                      </Label>
                      <PhotoSelect
                        id='photo-resolution'
                        value={params.resolution}
                        onChange={(v) =>
                          updateResolution(v as '1K' | '2K' | '4K')
                        }
                        options={RESOLUTION_TIERS.map((k) => ({
                          value: k,
                          label: k,
                        }))}
                      />
                    </div>
                  ) : null}

                  {/* size (resolution) — only OpenAI family */}
                  {selectedModel.supportsSize ? (
                    <>
                      <div className='space-y-2'>
                        <Label>{t('Size')}</Label>
                        <div className='grid grid-cols-2 gap-2'>
                          {RESOLUTION_SIZE_MAP[params.resolution].map(
                            (item) => {
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
                                    'flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                                    isSelected
                                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                                  )}
                                >
                                  <span className='font-medium'>
                                    {item.ratio}
                                  </span>
                                  <span
                                    className={cn(
                                      'text-xs',
                                      isSelected
                                        ? 'text-primary-foreground/80'
                                        : 'text-muted-foreground'
                                    )}
                                  >
                                    {item.label}
                                  </span>
                                </button>
                              )
                            }
                          )}
                        </div>
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

                      {selectedModel.id === 'gpt-image-2' ? (
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
                              <span>{t('Image URL')}</span>
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
                              'Enable to add local images as image input.',
                              'Enable to add local images as image input.'
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
                    </>
                  ) : (
                    <>
                      {/* aspect_ratio + image_size — Gemini */}
                      <div className='space-y-2'>
                        <Label>{t('Aspect ratio')}</Label>
                        <div className='grid grid-cols-3 gap-2'>
                          {ASPECT_RATIOS.map((a) => {
                            const isSelected = params.aspectRatio === a
                            return (
                              <button
                                key={a}
                                type='button'
                                onClick={() =>
                                  update(
                                    'aspectRatio',
                                    a as PhotoAspectRatio
                                  )
                                }
                                className={cn(
                                  'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                                )}
                              >
                                {a}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <Label>{t('Image size')}</Label>
                        <div className='grid grid-cols-3 gap-2'>
                          {IMAGE_SIZES.map((s) => {
                            const isSelected = params.imageSize === s
                            return (
                              <button
                                key={s}
                                type='button'
                                onClick={() =>
                                  update(
                                    'imageSize',
                                    s as '1K' | '2K' | '4K'
                                  )
                                }
                                className={cn(
                                  'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                                )}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Gemini 图片上传功能 */}
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
                            'Enable to add local images as image input for image editing.',
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
                    </>
                  )}

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

            {/* Right: results */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex-1' />
                <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                  <DialogTrigger asChild>
                    <Button variant='outline' size='sm'>
                      <History className='mr-2 h-4 w-4' />
                      {t('History')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className='max-w-4xl max-h-[80vh] overflow-y-auto'>
                    <DialogHeader>
                      <DialogTitle>{t('Generation History')}</DialogTitle>
                    </DialogHeader>
                    <HistoryPanel />
                  </DialogContent>
                </Dialog>
              </div>
              {loading ? (
                <PhotoSkeletonGrid count={params.n} />
              ) : images.length === 0 ? (
                <EmptyState isGemini={isGemini} />
              ) : (
                <div
                  className={cn(
                    'grid gap-4',
                    'grid-cols-1 sm:grid-cols-2'
                  )}
                >
                  {images.map((img, idx) => (
                    <PhotoCard key={idx} index={idx} image={img} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageTransition>
    </PublicLayout>
  )
}

type PhotoSelectOption = { value: string; label: string }

function PhotoSelect({
  id,
  value,
  onChange,
  options,
  searchPlaceholder,
  triggerLabel,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: PhotoSelectOption[]
  searchPlaceholder?: string
  triggerLabel?: string
}) {
  const { resolvedTheme } = useTheme()
  const selectedOption = options.find((opt) => opt.value === value)
  // Explicitly set the popover surface so it always matches the active
  // color scheme, regardless of how the rest of the page is themed.
  const isDark = resolvedTheme === 'dark'
  const surfaceStyle: React.CSSProperties = {
    backgroundColor: isDark ? 'oklch(0.255 0 0)' : 'oklch(1 0 0)',
    color: isDark ? 'oklch(0.965 0 0)' : 'oklch(0.145 0 0)',
  }
  // Re-declare the popover tokens locally so children using
  // bg-popover / text-popover-foreground pick up the right colors.
  surfaceStyle['--popover' as string] = isDark
    ? 'oklch(0.255 0 0)'
    : 'oklch(1 0 0)'
  surfaceStyle['--popover-foreground' as string] = isDark
    ? 'oklch(0.965 0 0)'
    : 'oklch(0.145 0 0)'
  return (
    <Select
      value={value}
      onValueChange={(v) => v && onChange(String(v))}
    >
      <SelectTrigger id={id} className='w-full'>
        <SelectValue placeholder={searchPlaceholder}>
          {triggerLabel ?? selectedOption?.label ?? searchPlaceholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        alignItemWithTrigger={false}
        sideOffset={6}
        style={surfaceStyle}
        className='bg-popover text-popover-foreground'
      >
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EmptyState({ isGemini }: { isGemini: boolean }) {
  const { t } = useTranslation()
  return (
    <Card className='border-dashed'>
      <CardContent className='flex flex-col items-center justify-center gap-3 p-12 text-center'>
        <div className='bg-muted rounded-full p-3'>
          <ImageIcon className='text-muted-foreground h-8 w-8' />
        </div>
        <div className='space-y-1'>
          <h3 className='text-base font-semibold'>
            {t('No images yet')}
          </h3>
          <p className='text-muted-foreground text-sm'>
            {isGemini
              ? t(
                  'Configure the parameters on the left and click Generate. Gemini image models support aspect ratio and image size.'
                )
              : t(
                  'Configure the parameters on the left and click Generate. OpenAI image models support count and resolution.'
                )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function PhotoSkeletonGrid({ count }: { count: number }) {
  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      {Array.from({ length: Math.max(1, count) }).map((_, i) => (
        <Card key={i} className='overflow-hidden'>
          <Skeleton className='aspect-square w-full' />
        </Card>
      ))}
    </div>
  )
}

function PhotoCard({ index, image }: { index: number; image: PhotoResult }) {
  const { t } = useTranslation()
  const src =
    image.b64 && image.mimeType
      ? `data:${image.mimeType};base64,${image.b64}`
      : image.b64
        ? `data:image/png;base64,${image.b64}`
        : image.url ?? ''

  const filename = `photo-${Date.now()}-${index + 1}.png`

  const handleDownload = () => {
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = filename
    a.click()
  }

  return (
    <Card className='overflow-hidden'>
      <div className='bg-muted relative aspect-square w-full overflow-hidden'>
        {src ? (
          <img
            src={src}
            alt={`generated-${index + 1}`}
            className='h-full w-full object-contain'
          />
        ) : (
          <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
            {t('No image data')}
          </div>
        )}
      </div>
      <CardContent className='flex items-center justify-between gap-2 p-3'>
        <span className='text-muted-foreground text-xs'>
          {t('Image {{n}}', { n: index + 1 })}
        </span>
        <Button
          size='sm'
          variant='outline'
          onClick={handleDownload}
          disabled={!src}
        >
          <Download className='mr-1 h-3.5 w-3.5' />
          {t('Download')}
        </Button>
      </CardContent>
    </Card>
  )
}

function HistoryPanel() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)

  // 加载历史记录
  const loadHistory = async () => {
    setLoading(true)
    try {
      // TODO: 调用后端API获取历史记录
      // const res = await api.get('/pg/history')
      // setHistory(res.data)
      
      // 临时使用本地存储
      const stored = localStorage.getItem('photo_history')
      if (stored) {
        setHistory(JSON.parse(stored))
      }
    } catch (err) {
      toast.error(t('Failed to load history'))
    } finally {
      setLoading(false)
    }
  }

  // 组件挂载时加载历史
  useEffect(() => {
    loadHistory()
  }, [])

  if (loading) {
    return (
      <div className='space-y-4'>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className='p-4'>
              <Skeleton className='h-20 w-full' />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className='text-muted-foreground flex flex-col items-center justify-center gap-3 py-12 text-center'>
        <ImageIcon className='h-12 w-12 opacity-50' />
        <p>{t('No generation history yet')}</p>
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {history.map((item) => (
        <Card key={item.id}>
          <CardContent className='p-4'>
            <div className='space-y-3'>
              <div className='flex items-start justify-between gap-3'>
                <div className='flex-1 space-y-1'>
                  <p className='text-sm font-medium'>{item.prompt}</p>
                  <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                    <span>{item.model}</span>
                    <span>•</span>
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                {item.images.map((img, idx) => {
                  const src =
                    img.b64 && img.mimeType
                      ? `data:${img.mimeType};base64,${img.b64}`
                      : img.b64
                        ? `data:image/png;base64,${img.b64}`
                        : img.url ?? ''
                  return (
                    <div
                      key={idx}
                      className='bg-muted relative aspect-square overflow-hidden rounded-md'
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={`history-${item.id}-${idx}`}
                          className='h-full w-full object-cover'
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
