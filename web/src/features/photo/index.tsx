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
import { Download, Check, ChevronLeft, ChevronRight, Film, ImageIcon, ImagePlus, Loader2, Paperclip, Plus, Wand2, X } from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/stores/auth-store'
import {
  usePhotoFormGenerating,
  usePhotoGenerationStore,
  type PhotoPreviewState,
} from '@/stores/photo-generation-store'
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
  RESOLUTION_SIZE_MAP,
} from './constants'
import { PhotoImageMagnifier } from './components/photo-image-magnifier'
import { VideoPanel } from './components/video-panel'
import {
  deletePhotoHistoryItem,
  type PhotoHistoryItem,
} from './lib/photo-history-api'
import { hydratePhotoHistoryItem } from './lib/photo-history-image'
import { getPhotoResultSrc, pickGenerationSnapshot } from './lib/photo-utils'
import { PhotoHistoryThumbnail } from './components/photo-history-thumbnail'
import type {
  PhotoAspectRatio,
  PhotoImageSize,
  PhotoParams,
  PhotoQuality,
  PhotoResolution,
} from './types'

const photoOptionTileClass =
  'flex min-w-0 w-full flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors'
const photoOptionHintClass = 'w-full break-words text-[11px] leading-snug'
const photoSectionLabelClass =
  'text-muted-foreground text-xs font-medium leading-snug break-words'
const photoWrapButtonClass = 'h-auto min-h-9 whitespace-normal'

export type { PhotoGenerationSnapshot } from './types'

type PhotoPreviewItem = {
  id: string
  src?: string
  loading?: boolean
}

function buildPreviewItemsFromHistoryItem(item: PhotoHistoryItem): PhotoPreviewItem[] {
  return item.images
    .map(getPhotoResultSrc)
    .filter(Boolean)
    .map((src, idx) => ({
      id: `${item.id}-${idx}`,
      src,
    }))
}

function mergePreviewWithLoadingItems(
  loadingItems: PhotoPreviewItem[],
  historyItems: PhotoPreviewItem[]
): PhotoPreviewItem[] {
  if (loadingItems.length === 0) return historyItems
  const historySrcs = new Set(
    historyItems.map((item) => item.src).filter(Boolean)
  )
  const uniqueLoading = loadingItems.filter(
    (item) => !item.src || !historySrcs.has(item.src)
  )
  return [...uniqueLoading, ...historyItems]
}

function getPreviewCurrentItem(
  preview: PhotoPreviewState | null
): PhotoPreviewItem | null {
  if (!preview?.items.length) return null
  return preview.items[preview.currentIndex] ?? preview.items[0] ?? null
}

function downloadPhotoSrc(src: string, filename: string) {
  if (!src) return
  const a = document.createElement('a')
  a.href = src
  a.download = filename
  a.click()
}

function srcToImageDataEntry(
  src: string,
  name = 'reference.png'
): { name: string; dataUrl: string } {
  return { name, dataUrl: src }
}

function appendImageDataEntry(
  current: { name: string; dataUrl: string }[],
  entry: { name: string; dataUrl: string }
): { name: string; dataUrl: string }[] {
  const exists = current.some((item) => item.dataUrl === entry.dataUrl)
  if (exists) return current
  if (current.length >= MAX_UPLOAD_IMAGES) {
    return [...current.slice(1), entry]
  }
  return [...current, entry]
}

const PHOTO_TEMPLATE_IMAGE_GPT = '/landing/experience/girl.png'
const PHOTO_TEMPLATE_IMAGE_GEMINI = '/landing/experience/cat.png'

const DEFAULT_PHOTO_PROMPT = `生成一幅具有艺术展览感的宽笔湿画厚涂叙事油画。

画面主题为【主题】，主体是【主体】，正在【动作或叙事瞬间】，置于【环境】之中，表达【1—3 个情绪关键词】。画面首先必须好看、协调、有力量和诗性，然后才让观众读出题材与故事；不要做成照片、电影剧照或普通数字插画。

采用【画面比例】构图，建立单一视觉焦点、不对称平衡、清楚的观看路径与合理呼吸空间。主体与环境必须处在同一片空气和光线中，不能像清晰贴图放在背景前。若用于网站首屏、PPT 封面或海报，在【左侧／右侧】保留低对比、有空间层次的自然留白。

整体使用有限、协调、低饱和的配色：【主色】、【辅助色】与少量【点缀色】。使用一束方向明确、边界柔和的叙事主光连接主体、空气和环境；最高亮度只集中在焦点与少量受光部位。

整幅画必须像使用装载大量湿油彩的大号硬毛平刷、大号榛形笔和少量宽画刀直接绘制。对象从大面积明暗色域、冷暖关系、宽笔方向和不完整边缘中逐渐显现，不能先画成清晰平滑的数字图像，再覆盖油画纹理。

主要笔触应是连续、浓稠、湿润、有真实重量的颜料带：起笔载色饱满，中段保留压力变化与刷毛拖痕，两侧形成柔软、圆钝、不规则的油彩脊，收笔逐渐拖薄、断续或融入下层颜色；相邻笔触彼此覆盖、压叠、带色并有限湿画湿融合。

大笔触约占 60%，负责整体构图、主体大结构、环境与光线；中等笔触约占 30%，负责空间和结构提示；小笔触约占 10%，只用于最关键的视觉锚点。不要逐根描绘毛发、羽毛和植物，不要逐一解释建筑与远景细节。

大量使用"失去与找回的边缘"：约 65%—70% 的边缘通过油彩覆盖、主动省略和色域融合而不完整，只有焦点附近保留少量相对明确的结构。柔化必须来自绘画省略，不能来自高斯模糊、镜头失焦或柔焦滤镜。

厚度需要有节奏：焦点、受光面和少量前景使用最厚、最饱满的湿油彩；主体中间调保持中等厚度；背光面、远景、雾气和留白区域更薄、更松、更融合。观看时应先看到完整画面和情绪，靠近后才发现油彩脊、刷毛拖痕与覆盖关系。

严格避免：照片写实、电影剧照、平滑数字绘画、3D 渲染、塑料或蜡像材质、主体贴图感、所有对象同等清晰、全图数字模糊、均匀细碎笔触、硬质浮雕、轮廓描边、玻璃碎片、拼图、马赛克、裂纹、金色缝隙、霓虹、金粉、魔法粒子、发光眼睛、发光轮廓，以及未经要求的文字、字母、数字、Logo、签名或水印。`

const DEFAULT_PARAMS: PhotoParams = {
  model: PHOTO_MODELS[0].id,
  prompt: DEFAULT_PHOTO_PROMPT,
  n: 1,
  size: '3840x2160',
  resolution: '4K',
  quality: 'high',
  aspectRatio: '4:3',
  imageSize: '4K',
  imageUrlEnabled: false,
  imageDataUrls: [],
}

const MAX_UPLOAD_IMAGES = 6

export function Photo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [params, setParams] = useState<PhotoParams>(DEFAULT_PARAMS)
  const [historyView, setHistoryView] = useState<'workbench' | 'history'>(
    'workbench'
  )
  const [deleteTarget, setDeleteTarget] = useState<HistoryImageEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const history = usePhotoGenerationStore((state) => state.history)
  const historyLoading = usePhotoGenerationStore((state) => state.historyLoading)
  const preview = usePhotoGenerationStore((state) => state.preview)
  const previewGenerating = usePhotoGenerationStore(
    (state) => state.previewGenerating
  )
  const formLoading = usePhotoFormGenerating()
  const loadHistory = usePhotoGenerationStore((state) => state.loadHistory)
  const resetForUser = usePhotoGenerationStore((state) => state.resetForUser)
  const setPreview = usePhotoGenerationStore((state) => state.setPreview)
  const updatePreview = usePhotoGenerationStore((state) => state.updatePreview)
  const runFormGeneration = usePhotoGenerationStore(
    (state) => state.runFormGeneration
  )
  const runPreviewGeneration = usePhotoGenerationStore(
    (state) => state.runPreviewGeneration
  )
  const paramsFormRef = useRef<HTMLFormElement | null>(null)

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
      resetForUser()
      return
    }

    void loadHistory(user.id)
  }, [loadHistory, resetForUser, user?.id])

  // Switch to the workbench view when a new generation starts so the user
  // sees the live result without leaving the history tab behind manually.
  useEffect(() => {
    if (formLoading) setHistoryView('workbench')
  }, [formLoading])

  useEffect(() => {
    const historyItemId = preview?.historyItemId
    if (!historyItemId) return

    const historyItem = history.find((item) => item.id === historyItemId)
    if (!historyItem) return

    const historyItems = buildPreviewItemsFromHistoryItem(historyItem)
    updatePreview((current) => {
      if (!current || current.historyItemId !== historyItemId) return current
      const loadingItems = current.items.filter((item) => item.loading)
      const merged = mergePreviewWithLoadingItems(loadingItems, historyItems)
      if (
        merged.length === current.items.length &&
        merged.every(
          (item, index) =>
            item.id === current.items[index]?.id &&
            item.src === current.items[index]?.src &&
            item.loading === current.items[index]?.loading
        )
      ) {
        return current
      }
      const currentSrc = current.items[current.currentIndex]?.src
      const nextIndex = currentSrc
        ? Math.max(
            0,
            merged.findIndex((item) => item.src === currentSrc)
          )
        : current.currentIndex
      return {
        ...current,
        items: merged,
        currentIndex: nextIndex >= 0 ? nextIndex : 0,
        prompt: historyItem.prompt,
        model: historyItem.model,
      }
    })
  }, [history, preview?.historyItemId, updatePreview])

  const openPreview = (state: PhotoPreviewState) => {
    setPreview(state)
    setParams((prev) => ({
      ...prev,
      ...(state.model ? { model: state.model as PhotoParams['model'] } : {}),
      ...(state.generationParams ?? {}),
    }))
  }

  const handleDeleteHistoryItem = async () => {
    if (!deleteTarget || !user?.id) return
    setDeleteLoading(true)
    const success = await deletePhotoHistoryItem(deleteTarget.historyItemId)
    setDeleteLoading(false)

    if (!success) {
      toast.error(t('Delete failed'))
      return
    }

    if (preview?.historyItemId === deleteTarget.historyItemId) {
      setPreview(null)
    }
    setDeleteTarget(null)
    toast.success(t('Deleted successfully'))
    void loadHistory(user.id)
  }

  const handlePreviewNavigate = (direction: -1 | 1) => {
    updatePreview((current) => {
      if (!current?.items.length) return current
      const nextIndex = current.currentIndex + direction
      if (nextIndex < 0 || nextIndex >= current.items.length) {
        return current
      }
      return {
        ...current,
        currentIndex: nextIndex,
      }
    })
  }

  const selectPreviewIndex = (index: number) => {
    updatePreview((current) => {
      if (!current || index < 0 || index >= current.items.length) return current
      return { ...current, currentIndex: index }
    })
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const update = <K extends keyof PhotoParams>(
    key: K,
    value: PhotoParams[K]
  ) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }

  const selectModel = (modelId: string) => {
    setParams((prev) => {
      if (prev.model === modelId) return prev
      const nextIsGemini = modelId.startsWith('gemini-')
      if (nextIsGemini) {
        return { ...prev, model: modelId, imageSize: '4K', aspectRatio: '4:3' }
      }
      return { ...prev, model: modelId, resolution: '4K', size: '3840x2160' }
    })
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
    await runGeneration(params)
  }

  const runGeneration = async (generationParams: PhotoParams) => {
    if (!user) {
      navigate({
        to: '/sign-in',
        search: {
          redirect: `${window.location.pathname}${window.location.search}`,
        },
      })
      return
    }
    if (!generationParams.prompt.trim()) {
      toast.error(t('Please enter a prompt'))
      return
    }
    await runFormGeneration(generationParams, user.id)
  }

  const handleImageToImage = async ({
    src,
    prompt,
    model,
    mode,
  }: {
    src: string
    prompt: string
    model: string
    mode: 'add' | 'generate'
  }) => {
    if (!user) {
      navigate({
        to: '/sign-in',
        search: {
          redirect: `${window.location.pathname}${window.location.search}`,
        },
      })
      return
    }

    const trimmedPrompt = prompt.trim()
    if (mode === 'generate' && !trimmedPrompt) {
      toast.error(t('Please enter a prompt'))
      return
    }

    const entry = srcToImageDataEntry(src)
    const existingHistoryItemId = preview?.historyItemId
    const generationModel =
      model || preview?.model || params.model
    const nextParams: PhotoParams = {
      ...params,
      model: generationModel,
      prompt: trimmedPrompt || params.prompt,
      imageUrlEnabled: true,
      imageDataUrls:
        mode === 'generate'
          ? [entry]
          : appendImageDataEntry(params.imageDataUrls, entry),
    }
    setParams(nextParams)

    if (mode === 'add') {
      setPreview(null)
      toast.success(t('Image added to image input'))
      paramsFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      return
    }

    void runPreviewGeneration({
      params: nextParams,
      userId: user.id,
      trimmedPrompt,
      generationModel,
      existingHistoryItemId,
      previewBase: preview,
      referenceSrc: src,
    })
  }

  let rightPanelHint = t('Your latest generation appears here.')
  if (historyView !== 'workbench') {
    rightPanelHint = user
      ? t('Your recent generations are saved here and can be previewed anytime.')
      : t('Sign in to save and view your generation history.')
  }

  return (
    <PublicLayout>
      <PageTransition>
        <div className='mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6'>
          {/* Mode tabs: image / video / history */}
          <div className='mb-6 flex flex-wrap items-center gap-2'>
            <div className='bg-muted/60 inline-flex rounded-lg p-1'>
              <button
                type='button'
                onClick={() => setMode('image')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all',
                  mode === 'image'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ImageIcon className='h-4 w-4' />
                {t('Image generation')}
              </button>
              <button
                type='button'
                onClick={() => setMode('video')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all',
                  mode === 'video'
                    ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Film className='h-4 w-4' />
                {t('Video generation')}
              </button>
            </div>
            <div className='bg-muted/60 inline-flex rounded-lg p-1'>
                <button
                  type='button'
                  onClick={() => setHistoryView('workbench')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all',
                    historyView === 'workbench'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('Workbench')}
                </button>
                <button
                  type='button'
                  onClick={() => setHistoryView('history')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all',
                    historyView === 'history'
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('Generation History')}
                </button>
              </div>
          </div>

          {mode === 'video' ? (
            <VideoPanel view={historyView} />
          ) : (
          <div className='grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'>
            {/* Left: parameters */}
            <Card className='flex min-h-[680px] min-w-0 flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-4rem)]'>
              <CardContent className='min-h-0 flex-1 space-y-4 overflow-y-auto p-5'>
                <form
                  ref={paramsFormRef}
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
                          onClick={() => selectModel(gptModels[0].id)}
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
                          onClick={() => selectModel(geminiModels[0].id)}
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
                            onClick={() => selectModel(model.id)}
                            className={cn(
                              'flex min-w-0 w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
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
                                <span className='text-muted-foreground block text-xs leading-relaxed break-words'>
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

                  {/* Prompt composer (above image size) */}
                  {mode === 'image' ? (
                    <div className='space-y-2'>
                      <input
                        ref={fileInputRef}
                        type='file'
                        accept='image/*'
                        multiple
                        className='hidden'
                        onChange={handleFilesPicked}
                      />
                      <Label htmlFor='photo-prompt'>{t('Prompt')}</Label>
                      <Textarea
                        id='photo-prompt'
                        rows={5}
                        value={params.prompt}
                        onChange={(e) => update('prompt', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            void handleSubmit()
                          }
                        }}
                        placeholder={t('Photo prompt placeholder')}
                        className={cn(
                          'field-sizing-fixed max-h-64 min-h-32 flex-1 resize-none',
                          params.prompt === DEFAULT_PHOTO_PROMPT &&
                            'text-muted-foreground'
                        )}
                      />

                      {supportsImageInput &&
                      params.imageUrlEnabled &&
                      params.imageDataUrls.length > 0 ? (
                        <div className='flex flex-wrap gap-2 px-1'>
                          {params.imageDataUrls.map((img, index) => (
                            <div
                              key={`${img.name}-${index}`}
                              className='group bg-muted relative h-16 w-16 overflow-hidden rounded-md border'
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
                                className='absolute right-0.5 top-0.5 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100'
                                onClick={() => removeImageDataUrl(index)}
                              >
                                <X className='h-3 w-3' />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className='flex items-center justify-between gap-2'>
                        <div className='flex items-center gap-1'>
                          {supportsImageInput ? (
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='text-muted-foreground h-8 w-8'
                              disabled={
                                params.imageDataUrls.length >= MAX_UPLOAD_IMAGES
                              }
                              aria-label={t('Image Input')}
                              onClick={() => {
                                if (!params.imageUrlEnabled) {
                                  update('imageUrlEnabled', true)
                                }
                                fileInputRef.current?.click()
                              }}
                            >
                              <Paperclip className='h-4 w-4' />
                            </Button>
                          ) : null}
                        </div>
                        <Button
                          type='submit'
                          disabled={formLoading}
                          className='h-9 shrink-0'
                        >
                          {formLoading ? (
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
                      </div>
                    </div>
                  ) : null}

                  {selectedModel.supportsSize ? (
                    <>
                      <div className='space-y-2'>
                        <Label>{t('Image size')}</Label>
                        <div className='grid grid-cols-1 gap-2'>
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
                                  photoOptionTileClass,
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
                                    photoOptionHintClass,
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
                            <p className={photoSectionLabelClass}>
                              {t(group.label)}
                            </p>
                            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
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
                                      photoOptionTileClass,
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
                                        photoOptionHintClass,
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
                          <div className='grid grid-cols-2 gap-2'>
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
                                    'min-w-0 rounded-md border px-2 py-2 text-xs font-medium break-words transition-colors',
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
                        <div className='grid grid-cols-1 gap-2'>
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
                                  photoOptionTileClass,
                                  isSelected
                                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                                )}
                              >
                                <div className='flex w-full min-w-0 flex-wrap items-center gap-1.5'>
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
                                    photoOptionHintClass,
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
                              <p className={photoSectionLabelClass}>
                                {t(group.label)}
                              </p>
                              <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
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
                                        photoOptionTileClass,
                                        isSelected
                                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                          : 'border-border bg-background text-foreground hover:bg-muted/60'
                                      )}
                                    >
                                      <div className='flex w-full min-w-0 flex-wrap items-center gap-1.5'>
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
                                          photoOptionHintClass,
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
                          <p className='text-muted-foreground text-xs leading-relaxed break-words'>
                            {t(
                              'Select an image size to view aspect ratio options.'
                            )}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Right: generation workbench / history */}
            <Card className='flex min-h-[680px] min-w-0 flex-col overflow-hidden lg:max-h-[calc(100vh-4rem)]'>
              <div className='flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5'>
                <div className='min-w-0'>
                  <p className='text-muted-foreground text-xs leading-relaxed break-words sm:text-sm'>
                    {rightPanelHint}
                  </p>
                </div>
              </div>

              <CardContent className='min-h-0 flex-1 overflow-y-auto p-4 sm:p-5'>
                {(() => {
                  if (!user) {
                    return (
                      <EmptyState
                        isGemini={isGemini}
                        message={t(
                          'Sign in to save and view your generation history.'
                        )}
                      />
                    )
                  }
                  const visibleHistory = history.filter(
                    (item) =>
                      item.status !== 'pending' || item.images.length > 0
                  )
                  if (historyView === 'workbench') {
                    if (formLoading) {
                      return <PhotoPendingGrid count={1} featured />
                    }
                    return (
                      <div className='space-y-3'>
                        {visibleHistory.length === 0 ? (
                          <div className='space-y-3'>
                            <div className='overflow-hidden rounded-lg border'>
                              <img
                                src={
                                  isGemini
                                    ? PHOTO_TEMPLATE_IMAGE_GEMINI
                                    : PHOTO_TEMPLATE_IMAGE_GPT
                                }
                                alt={t('Template')}
                                className='h-auto w-full object-cover'
                              />
                            </div>
                            <p className='text-muted-foreground text-center text-xs leading-relaxed break-words sm:text-sm'>
                              {t('Pick a template or generate your own image.')}
                            </p>
                          </div>
                        ) : (
                          <HistoryFeed
                            history={visibleHistory.slice(0, 1)}
                            onPreview={openPreview}
                            onRequestDelete={setDeleteTarget}
                            variant='featured'
                          />
                        )}
                      </div>
                    )
                  }
                  return (
                    <div className='space-y-3'>
                      {historyLoading ? <PhotoPendingGrid count={3} /> : null}
                      {!historyLoading && visibleHistory.length === 0 ? (
                        <EmptyState isGemini={isGemini} />
                      ) : null}
                      {visibleHistory.length > 0 ? (
                        <HistoryFeed
                          history={visibleHistory}
                          onPreview={openPreview}
                          onRequestDelete={setDeleteTarget}
                        />
                      ) : null}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
          )}
        </div>

        <AlertDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open && !deleteLoading) setDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('Confirm delete')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('Are you sure you want to delete this image? This action cannot be undone.')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction
                disabled={deleteLoading}
                onClick={(event) => {
                  event.preventDefault()
                  void handleDeleteHistoryItem()
                }}
              >
                {deleteLoading ? t('Deleting...') : t('Yes')}
              </AlertDialogAction>
              <AlertDialogCancel disabled={deleteLoading}>{t('No')}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <PhotoImagePreviewDialog
          open={Boolean(preview)}
          onOpenChange={(open) => {
            if (!open && !previewGenerating) setPreview(null)
          }}
          preview={preview}
          onNavigate={handlePreviewNavigate}
          onSelectIndex={selectPreviewIndex}
          onModelChange={(model) => {
            updatePreview((current) =>
              current ? { ...current, model } : current
            )
            setParams((prev) => ({
              ...prev,
              model: model as PhotoParams['model'],
            }))
          }}
          params={params}
          onParamsChange={(patch) => {
            setParams((prev) => {
              const next = { ...prev, ...patch }
              updatePreview((current) =>
                current
                  ? {
                      ...current,
                      generationParams: pickGenerationSnapshot(next),
                    }
                  : current
              )
              return next
            })
          }}
          onImageToImage={handleImageToImage}
          generating={previewGenerating}
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
        <h3 className='text-base font-semibold break-words'>{t('No images yet')}</h3>
        <p className='text-muted-foreground max-w-md text-sm leading-relaxed break-words'>{description}</p>
      </div>
    </div>
  )
}

function PhotoPendingGrid({
  count,
  featured = false,
}: {
  count: number
  featured?: boolean
}) {
  const { t } = useTranslation()
  if (featured) {
    return (
      <div className='bg-muted ring-foreground/10 relative flex min-h-[60vh] items-center justify-center overflow-hidden rounded-lg ring-1'>
        <Skeleton className='h-full w-full rounded-none' />
        <div className='bg-background/35 absolute inset-0 flex flex-col items-center justify-center gap-2'>
          <Loader2 className='text-primary h-8 w-8 animate-spin' />
          <span className='text-muted-foreground text-sm'>
            {t('Generating...')}
          </span>
        </div>
      </div>
    )
  }
  return (
    <div className='grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6'>
      {Array.from({ length: Math.max(1, Number(count) || 1) }).map((_, i) => (
        <div
          key={`pending-${i}`}
          className='bg-muted relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10'
        >
          <Skeleton className='h-full w-full rounded-lg' />
          <div className='absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/35'>
            <Loader2 className='text-primary h-5 w-5 animate-spin' />
            <span className='text-muted-foreground text-[10px]'>
              {t('Generating...')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

type HistoryImageEntry = {
  id: string
  historyItemId: string
  image: PhotoHistoryItem['images'][number]
  historyItem: PhotoHistoryItem
  prompt: string
  model: string
  createdAt: string
  imageIndex: number
}

function flattenHistoryImages(history: PhotoHistoryItem[]): HistoryImageEntry[] {
  return history.flatMap((item) =>
    item.images.map((image, idx) => ({
      id: `${item.id}-${idx}`,
      historyItemId: item.id,
      image,
      historyItem: item,
      prompt: item.prompt,
      model: item.model,
      createdAt: item.created_at,
      imageIndex: idx,
    }))
  )
}

function HistoryFeed({
  history,
  onPreview,
  onRequestDelete,
  variant = 'grid',
}: {
  history: PhotoHistoryItem[]
  onPreview: (state: PhotoPreviewState) => void
  onRequestDelete: (entry: HistoryImageEntry) => void
  variant?: 'grid' | 'featured'
}) {
  const { t } = useTranslation()
  const entries = useMemo(() => flattenHistoryImages(history), [history])
  const isFeatured = variant === 'featured'

  const handleOpenPreview = async (entry: HistoryImageEntry, selectedSrc: string) => {
    const openWithSources = (sources: string[]) => {
      if (sources.length === 0) return
      onPreview({
        prompt: entry.prompt,
        model: entry.model,
        createdAt: entry.createdAt,
        historyItemId: entry.historyItemId,
        generationParams: entry.historyItem.generationParams,
        items: sources.map((src, idx) => ({
          id: `${entry.historyItemId}-${idx}`,
          src,
        })),
        currentIndex: Math.min(entry.imageIndex, sources.length - 1),
      })
    }

    const immediateSources = entry.historyItem.images
      .map(getPhotoResultSrc)
      .filter(Boolean)
    openWithSources(immediateSources.length > 0 ? immediateSources : [selectedSrc])

    const hydrated = await hydratePhotoHistoryItem(entry.historyItem)
    const imageSources = hydrated.images.map(getPhotoResultSrc).filter(Boolean)
    openWithSources(imageSources)
  }

  return (
    <div
      className={
        isFeatured
          ? 'grid grid-cols-1 gap-3'
          : 'grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-6'
      }
    >
      {entries.map((entry) => (
        <PhotoHistoryThumbnail
          key={entry.id}
          image={entry.image}
          alt={entry.prompt}
          ariaLabel={t('View image')}
          aspectClassName={
            isFeatured ? 'min-h-[60vh] flex items-center justify-center' : undefined
          }
          imageClassName={isFeatured ? 'object-contain' : undefined}
          onClick={(src) => {
            void handleOpenPreview(entry, src)
          }}
          overlay={
            <>
              <div className='pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10' />
              <button
                type='button'
                onMouseDown={(event) => {
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onRequestDelete(entry)
                }}
                className='absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 shadow-sm transition-opacity hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100'
                aria-label={t('Delete image')}
              >
                <X className='h-3.5 w-3.5' />
              </button>
              <div className='pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2 pt-6 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                <p className='line-clamp-2 text-left text-[11px] leading-tight text-white'>
                  {entry.prompt}
                </p>
                <p className='mt-1 truncate text-left text-[10px] text-white/75'>
                  {entry.model} · {new Date(entry.createdAt).toLocaleString()}
                </p>
              </div>
            </>
          }
        />
      ))}
    </div>
  )
}

function PhotoPreviewModelPicker({
  modelId,
  disabled,
  onChange,
}: {
  modelId: string
  disabled?: boolean
  onChange: (modelId: string) => void
}) {
  const { t } = useTranslation()
  const gptModels = PHOTO_MODELS.filter((m) => m.id.startsWith('gpt-'))
  const geminiModels = PHOTO_MODELS.filter((m) => m.id.startsWith('gemini-'))
  const isGemini = modelId.startsWith('gemini-')
  const activeModels = isGemini ? geminiModels : gptModels

  return (
    <div className='space-y-2'>
      <Label>{t('Model')}</Label>
      <p className='text-muted-foreground text-xs leading-relaxed break-words'>
        {t('Uses the model from this generation by default. You can change it before generating.')}
      </p>
      <div className='bg-muted/60 rounded-lg p-1'>
        <div className='grid grid-cols-2 gap-1'>
          <button
            type='button'
            disabled={disabled}
            onClick={() => onChange(gptModels[0].id)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all',
              !isGemini
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            GPT
          </button>
          <button
            type='button'
            disabled={disabled}
            onClick={() => onChange(geminiModels[0].id)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-all',
              isGemini
                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Gemini
          </button>
        </div>
      </div>
      <div className='grid gap-1.5 sm:grid-cols-2'>
        {activeModels.map((model) => {
          const isSelected = model.id === modelId
          return (
            <button
              key={model.id}
              type='button'
              disabled={disabled}
              onClick={() => onChange(model.id)}
              className={cn(
                'flex min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/25'
                  : 'border-border bg-muted/20 hover:border-muted-foreground/25 hover:bg-muted/50'
              )}
            >
              <div className='min-w-0 flex-1'>
                <span className='block text-xs font-medium leading-snug break-words'>
                  {t(model.label)}
                </span>
              </div>
              {isSelected ? (
                <Check className='text-primary mt-0.5 h-3.5 w-3.5 shrink-0' />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PhotoPreviewSizePicker({
  modelId,
  params,
  disabled,
  onParamsChange,
}: {
  modelId: string
  params: PhotoParams
  disabled?: boolean
  onParamsChange: (patch: Partial<PhotoParams>) => void
}) {
  const { t } = useTranslation()
  const selectedModel =
    PHOTO_MODELS.find((m) => m.id === modelId) ?? PHOTO_MODELS[0]
  const isGemini = modelId.startsWith('gemini-')
  const nanoBananaKind = getNanoBananaKind(modelId)

  const gptSizeGroups = useMemo(
    () => buildGptSizeGroups(params.resolution),
    [params.resolution]
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

  const geminiAspectRatioGroups = useMemo(
    () => buildGeminiAspectRatioGroups(nanoBananaKind, params.imageSize),
    [nanoBananaKind, params.imageSize]
  )

  const updateResolution = (tier: '1K' | '2K' | '4K') => {
    const sizes = RESOLUTION_SIZE_MAP[tier].map((opt) => opt.size)
    const nextSize = sizes.includes(params.size)
      ? params.size
      : (sizes[0] as PhotoResolution)
    onParamsChange({ resolution: tier, size: nextSize })
  }

  const updateGeminiImageSize = (size: PhotoImageSize) => {
    if (!nanoBananaKind) {
      onParamsChange({ imageSize: size })
      return
    }
    const allowedRatios = getGeminiAspectRatiosForSize(nanoBananaKind, size)
    const nextAspectRatio = allowedRatios.includes(params.aspectRatio)
      ? params.aspectRatio
      : (allowedRatios[0] ?? '1:1')
    onParamsChange({
      imageSize: size,
      aspectRatio: nextAspectRatio as PhotoAspectRatio,
    })
  }

  if (!selectedModel.supportsSize && !isGemini) {
    return null
  }

  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <Label>{t('Image size')}</Label>
        <p className='text-muted-foreground text-xs leading-relaxed break-words'>
          {t('Adjust output size and aspect ratio before generating.')}
        </p>
      </div>

      {selectedModel.supportsSize ? (
        <>
          <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-3'>
            {GPT_IMAGE_SIZE_OPTIONS.map((item) => {
              const isSelected = params.resolution === item.size
              return (
                <button
                  key={item.size}
                  type='button'
                  disabled={disabled}
                  onClick={() =>
                    updateResolution(item.size as '1K' | '2K' | '4K')
                  }
                  className={cn(
                    photoOptionTileClass,
                    'px-2 py-1.5',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className='text-xs font-medium'>{item.size}</span>
                  <span
                    className={cn(
                      photoOptionHintClass,
                      'text-[10px]',
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

          <div className='space-y-2'>
            <Label className='text-xs'>{t('Aspect ratio')}</Label>
            {gptSizeGroups.map((group) => (
              <div key={group.id} className='space-y-1.5'>
                <p className='text-muted-foreground text-[11px] font-medium leading-snug break-words'>
                  {t(group.label)}
                </p>
                <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
                  {group.items.map((item) => {
                    const isSelected = params.size === item.size
                    return (
                      <button
                        key={item.size}
                        type='button'
                        disabled={disabled}
                        onClick={() =>
                          onParamsChange({
                            size: item.size as PhotoResolution,
                          })
                        }
                        className={cn(
                          photoOptionTileClass,
                          'px-2 py-1.5',
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                            : 'border-border bg-background text-foreground hover:bg-muted/60'
                        )}
                      >
                        <span className='text-xs font-medium'>
                          {item.ratio === 'Auto' ? t('Auto') : item.ratio}
                        </span>
                        <span
                          className={cn(
                            photoOptionHintClass,
                            'text-[10px]',
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
            <div className='space-y-1.5'>
              <Label className='text-xs'>{t('Quality')}</Label>
              <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
                {QUALITIES.map((q) => {
                  const isSelected = params.quality === q
                  return (
                    <button
                      key={q}
                      type='button'
                      disabled={disabled}
                      onClick={() =>
                        onParamsChange({ quality: q as PhotoQuality })
                      }
                      className={cn(
                        'min-w-0 rounded-md border px-2 py-1.5 text-[11px] font-medium break-words transition-colors',
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
          <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2'>
            {geminiImageSizeOptions.map((item) => {
              const isSelected = params.imageSize === item.size
              return (
                <button
                  key={item.size}
                  type='button'
                  disabled={disabled}
                  onClick={() => updateGeminiImageSize(item.size)}
                  className={cn(
                    photoOptionTileClass,
                    'px-2 py-1.5',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                  )}
                >
                  <span className='text-xs font-medium'>{item.size}</span>
                  <span
                    className={cn(
                      photoOptionHintClass,
                      'text-[10px]',
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

          <div className='space-y-2'>
            <Label className='text-xs'>{t('Aspect ratio')}</Label>
            {geminiAspectRatioGroups.length > 0 ? (
              geminiAspectRatioGroups.map((group) => (
                <div key={group.id} className='space-y-1.5'>
                  <p className='text-muted-foreground text-[11px] font-medium leading-snug break-words'>
                    {t(group.label)}
                  </p>
                  <div className='grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3'>
                    {group.items.map((item) => {
                      const isSelected = params.aspectRatio === item.ratio
                      return (
                        <button
                          key={item.ratio}
                          type='button'
                          disabled={disabled}
                          onClick={() =>
                            onParamsChange({
                              aspectRatio: item.ratio as PhotoAspectRatio,
                            })
                          }
                          className={cn(
                            photoOptionTileClass,
                            'px-2 py-1.5',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                              : 'border-border bg-background text-foreground hover:bg-muted/60'
                          )}
                        >
                          <span className='text-xs font-medium'>
                            {item.ratio}
                          </span>
                          <span
                            className={cn(
                              photoOptionHintClass,
                              'text-[10px]',
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
              <p className='text-muted-foreground text-xs leading-relaxed break-words'>
                {t('Select an image size to view aspect ratio options.')}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function PhotoImagePreviewDialog({
  open,
  onOpenChange,
  preview,
  onNavigate,
  onSelectIndex,
  onModelChange,
  params,
  onParamsChange,
  onImageToImage,
  generating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview: PhotoPreviewState | null
  onNavigate: (direction: -1 | 1) => void
  onSelectIndex: (index: number) => void
  onModelChange: (modelId: string) => void
  params: PhotoParams
  onParamsChange: (patch: Partial<PhotoParams>) => void
  onImageToImage: (options: {
    src: string
    prompt: string
    model: string
    mode: 'add' | 'generate'
  }) => void | Promise<void>
  generating: boolean
}) {
  const { t } = useTranslation()
  const [editPrompt, setEditPrompt] = useState('')
  const [dialogModel, setDialogModel] = useState(PHOTO_MODELS[0].id)

  useEffect(() => {
    if (!open) return
    setEditPrompt(preview?.prompt ?? '')
    const fallbackModel = preview?.model ?? PHOTO_MODELS[0].id
    const resolvedModel = PHOTO_MODELS.some((m) => m.id === fallbackModel)
      ? fallbackModel
      : PHOTO_MODELS[0].id
    setDialogModel(resolvedModel)
  }, [open, preview?.prompt, preview?.model, preview?.currentIndex])

  const handleModelChange = (modelId: string) => {
    setDialogModel(modelId)
    onModelChange(modelId)
  }

  const currentItem = getPreviewCurrentItem(preview)
  const items = preview?.items ?? []
  const currentIndex = preview?.currentIndex ?? 0
  const showRail = items.length > 0

  if (!preview || !currentItem) {
    return null
  }

  const canGoPrev = !showRail && currentIndex > 0
  const canGoNext = !showRail && currentIndex < items.length - 1
  const filename = `photo-${Date.now()}-${currentIndex + 1}.png`
  const canGenerate = editPrompt.trim().length > 0 && !generating
  const referenceSrc =
    currentItem.src && !currentItem.loading
      ? currentItem.src
      : items.find((item) => item.src && !item.loading)?.src
  const editSource = referenceSrc ?? ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[92vh] w-[min(96vw,60rem)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl'>
        <DialogHeader className='space-y-2 border-b px-4 py-4 sm:px-6'>
          <DialogTitle>{t('Image preview')}</DialogTitle>
          {(preview.model || preview.createdAt) && (
            <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
              {preview.model ? <span>{preview.model}</span> : null}
              {preview.model && preview.createdAt ? <span>•</span> : null}
              {preview.createdAt ? (
                <span>{new Date(preview.createdAt).toLocaleString()}</span>
              ) : null}
              {items.length > 0 ? (
                <>
                  <span>•</span>
                  <span>
                    {t('Image {{n}}', { n: currentIndex + 1 })} / {items.length}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </DialogHeader>

        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <div className='bg-muted/40 relative flex min-h-[240px] min-w-0 flex-1 items-center justify-center px-4 py-4 sm:min-h-[360px] sm:px-6'>
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

            {currentItem.loading ? (
              <div className='flex flex-col items-center justify-center gap-3 py-10'>
                <Loader2 className='text-primary h-10 w-10 animate-spin' />
                <p className='text-muted-foreground text-sm'>
                  {t('Generating image...')}
                </p>
              </div>
            ) : currentItem.src ? (
              <PhotoImageMagnifier
                key={`${currentItem.id}-${currentIndex}`}
                src={currentItem.src}
                alt={t('Image preview')}
              />
            ) : null}

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

          {showRail ? (
            <div className='bg-background flex w-[104px] shrink-0 flex-col gap-2 overflow-y-auto border-l p-2 sm:w-[120px]'>
              <p className='text-muted-foreground px-1 text-[11px] font-medium leading-snug break-words'>
                {t('Images in this generation')}
              </p>
              {items.map((item, index) => {
                const isSelected = index === currentIndex
                return (
                  <button
                    key={item.id}
                    type='button'
                    onClick={() => onSelectIndex(index)}
                    className={cn(
                      'relative aspect-square overflow-hidden rounded-md border transition-colors',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/50'
                    )}
                    aria-label={t('Image {{n}}', { n: index + 1 })}
                    aria-current={isSelected ? 'true' : undefined}
                  >
                    {item.loading ? (
                      <div className='bg-muted flex h-full w-full flex-col items-center justify-center gap-1'>
                        <Loader2 className='text-primary h-4 w-4 animate-spin' />
                        <span className='text-muted-foreground text-[9px] leading-none'>
                          {t('Generating...')}
                        </span>
                      </div>
                    ) : item.src ? (
                      <img
                        src={item.src}
                        alt=''
                        className='h-full w-full object-cover'
                      />
                    ) : (
                      <div className='bg-muted h-full w-full' />
                    )}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className='max-h-[42vh] space-y-3 overflow-y-auto border-t px-4 py-4 sm:px-6'>
          <PhotoPreviewModelPicker
            modelId={dialogModel}
            disabled={generating}
            onChange={handleModelChange}
          />

          <PhotoPreviewSizePicker
            modelId={dialogModel}
            params={params}
            disabled={generating}
            onParamsChange={onParamsChange}
          />

          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <ImagePlus className='text-primary h-4 w-4' />
              <Label htmlFor='photo-img2img-prompt'>{t('Image to image')}</Label>
            </div>
            <p className='text-muted-foreground text-xs leading-relaxed break-words'>
              {t(
                'Describe how you want to transform this image. The current image will be used as reference input.'
              )}
            </p>
            <Textarea
              id='photo-img2img-prompt'
              rows={3}
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder={t('Image to image prompt placeholder')}
              disabled={generating}
            />
          </div>

          <div className='flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className={cn(
                'text-muted-foreground justify-start px-0 sm:px-2',
                photoWrapButtonClass
              )}
              disabled={generating || !editSource}
              onClick={() => {
                if (!editSource) return
                onImageToImage({
                  src: editSource,
                  prompt: editPrompt,
                  model: dialogModel,
                  mode: 'add',
                })
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              {t('Add to image input')}
            </Button>

            <div className='flex flex-wrap justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                className={photoWrapButtonClass}
                disabled={generating || !currentItem.src || currentItem.loading}
                onClick={() => {
                  if (!currentItem.src) return
                  downloadPhotoSrc(currentItem.src, filename)
                }}
              >
                <Download className='mr-2 h-4 w-4' />
                {t('Download')}
              </Button>
              <Button
                type='button'
                className={photoWrapButtonClass}
                disabled={!canGenerate || !editSource}
                onClick={() => {
                  if (!editSource) return
                  onImageToImage({
                    src: editSource,
                    prompt: editPrompt,
                    model: dialogModel,
                    mode: 'generate',
                  })
                }}
              >
                {generating ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {t('Generating...')}
                  </>
                ) : (
                  <>
                    <Wand2 className='mr-2 h-4 w-4' />
                    {t('Generate from image')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
