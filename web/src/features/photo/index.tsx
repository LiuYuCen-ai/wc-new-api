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
import {
  Download,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  ImagePlus,
  Loader2,
  Plus,
  Wand2,
} from 'lucide-react'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { ComboboxInput } from '@/components/ui/combobox-input'
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
import { useUserDisplay } from '@/hooks/use-user-display'
import {
  usePhotoFormGenerating,
  usePhotoGenerationStore,
  usePhotoPendingDisplayCount,
  type PhotoPreviewState,
} from '@/stores/photo-generation-store'
import { cn } from '@/lib/utils'
import {
  resolvePhotoSize,
  SEEDREAM_ASPECT_RATIO_OPTIONS,
} from './constants'
import { PhotoImageMagnifier } from './components/photo-image-magnifier'
import { PhotoComposer } from './components/photo-composer'
import { PhotoCustomSizeFields } from './components/photo-custom-size-fields'
import { PhotoModeRail, type PhotoWorkspaceMode } from './components/photo-mode-rail'
import { VideoPanel } from './components/video-panel'
import { usePhotoModels } from './hooks/use-photo-models'
import { snapPhotoSize } from './lib/photo-models'
import {
  deletePhotoHistoryItem,
  type PhotoHistoryItem,
} from './lib/photo-history-api'
import { markPhotoHistoryItemRemoved } from './lib/photo-history-storage'
import { hydratePhotoHistoryItem } from './lib/photo-history-image'
import {
  applyPhotoGeometry,
  getPhotoResultSrc,
  pickGenerationSnapshot,
} from './lib/photo-utils'
import { PhotoWorksCard } from './components/photo-works-card'
import { WorksFeedHeader, WorksMasonry } from './components/works-masonry'
import {
  masonryItemWeight,
  photoCoverAspectFromSnapshot,
} from './lib/works-masonry'
import type {
  PhotoAspectRatio,
  PhotoModel,
  PhotoParams,
  PhotoSizeOption,
} from './types'

const photoOptionTileClass =
  'flex min-w-0 w-full flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors'
const photoOptionHintClass = 'w-full break-words text-[11px] leading-snug'
const photoWrapButtonClass = 'h-auto min-h-9 whitespace-normal'

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

const DEFAULT_PARAMS: PhotoParams = {
  model: '',
  prompt: '',
  n: 1,
  size: resolvePhotoSize('2K', '1:1'),
  resolution: '2K',
  aspectRatio: '1:1',
  imageSize: '2K',
  customWidth: 2048,
  customHeight: 2048,
  imageUrlEnabled: false,
  imageDataUrls: [],
}

const MAX_UPLOAD_IMAGES = 6

export function Photo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)
  const bootstrapState = useAuthStore((state) => state.auth.bootstrapState)
  const [mode, setMode] = useState<PhotoWorkspaceMode>('image')
  const [params, setParams] = useState<PhotoParams>(DEFAULT_PARAMS)
  const [deleteTarget, setDeleteTarget] = useState<HistoryImageEntry | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const history = usePhotoGenerationStore((state) => state.history)
  const historyLoading = usePhotoGenerationStore((state) => state.historyLoading)
  const preview = usePhotoGenerationStore((state) => state.preview)
  const previewGenerating = usePhotoGenerationStore(
    (state) => state.previewGenerating
  )
  const formLoading = usePhotoFormGenerating()
  const pendingDisplayCount = usePhotoPendingDisplayCount()
  const {
    models,
    isLoading: modelsLoading,
    addCustomModel,
    getSizeOptions,
  } = usePhotoModels('image')
  const sizeOptions = getSizeOptions(params.model)
  const loadHistory = usePhotoGenerationStore((state) => state.loadHistory)
  const removeHistoryItem = usePhotoGenerationStore(
    (state) => state.removeHistoryItem
  )
  const resetForUser = usePhotoGenerationStore((state) => state.resetForUser)
  const setPreview = usePhotoGenerationStore((state) => state.setPreview)
  const updatePreview = usePhotoGenerationStore((state) => state.updatePreview)
  const runFormGeneration = usePhotoGenerationStore(
    (state) => state.runFormGeneration
  )
  const runPreviewGeneration = usePhotoGenerationStore(
    (state) => state.runPreviewGeneration
  )

  useEffect(() => {
    if (bootstrapState !== 'complete') return
    if (!user?.id) {
      resetForUser()
      return
    }

    void loadHistory(user.id)
  }, [bootstrapState, loadHistory, resetForUser, user?.id])

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
    setParams((prev) =>
      applyPhotoGeometry(
        {
          ...prev,
          ...(state.model ? { model: state.model } : {}),
        },
        state.generationParams ?? {}
      )
    )
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

    markPhotoHistoryItemRemoved(user.id, deleteTarget.historyItemId)
    removeHistoryItem(deleteTarget.historyItemId)
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

  const updateParams = (patch: Partial<PhotoParams>) => {
    setParams((prev) => applyPhotoGeometry(prev, patch))
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
    updateParams({
      model: current.id,
      endpointTypes: nextTypes,
    })
  }, [models, modelsLoading, params.endpointTypes, params.model])

  useEffect(() => {
    if (!params.model) return
    const nextSize = snapPhotoSize(params.imageSize, sizeOptions)
    if (nextSize === params.imageSize) return
    updateParams({ imageSize: nextSize, resolution: nextSize })
  }, [params.imageSize, params.model, sizeOptions])

  const handleFilesPicked = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files ? [...e.target.files] : []
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
        imageUrlEnabled: true,
        imageDataUrls: [...prev.imageDataUrls, ...results],
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

  const handleSubmit = async () => {
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
    if (!generationParams.model.trim()) {
      toast.error(t('Please enter a model'))
      return
    }
    const selected = models.find(
      (item) => item.id === generationParams.model
    )
    await runFormGeneration(
      {
        ...generationParams,
        endpointTypes:
          selected?.endpointTypes ?? generationParams.endpointTypes,
      },
      user.id
    )
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
    const selected = models.find((item) => item.id === generationModel)
    const nextParams: PhotoParams = {
      ...params,
      model: generationModel,
      prompt: trimmedPrompt || params.prompt,
      imageUrlEnabled: true,
      imageDataUrls:
        mode === 'generate'
          ? [entry]
          : appendImageDataEntry(params.imageDataUrls, entry),
      endpointTypes: selected?.endpointTypes ?? params.endpointTypes,
    }
    setParams(nextParams)

    if (mode === 'add') {
      setPreview(null)
      toast.success(t('Image added to image input'))
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

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition>
        <div className='flex min-h-svh flex-col pt-16 md:flex-row'>
          <PhotoModeRail mode={mode} onModeChange={setMode} />

          <div className='relative min-w-0 flex-1'>
            <div
              className={cn(
                'mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6',
                mode !== 'video' && 'hidden'
              )}
            >
              <VideoPanel />
            </div>
            <div
              className={cn(
                'mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6',
                mode !== 'image' && 'hidden'
              )}
            >
                <div className='mb-10'>
                  <PhotoComposer
                    params={params}
                    models={models}
                    modelsLoading={modelsLoading}
                    sizeOptions={sizeOptions}
                    loading={formLoading}
                    fileInputRef={fileInputRef}
                    onParamsChange={updateParams}
                    onAddCustomModel={addCustomModel}
                    onSubmit={() => {
                      void handleSubmit()
                    }}
                    onFilesPicked={(event) => {
                      void handleFilesPicked(event)
                    }}
                    onRemoveImage={removeImageDataUrl}
                  />
                </div>

                {!user ? (
                  <EmptyState
                    message={t(
                      'Sign in to save and view your generation history.'
                    )}
                  />
                ) : (
                  <PhotoHistorySection
                    history={history}
                    historyLoading={historyLoading}
                    formLoading={formLoading}
                    pendingDisplayCount={pendingDisplayCount}
                    onPreview={openPreview}
                    onRequestDelete={setDeleteTarget}
                  />
                )}
            </div>
          </div>
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
              model,
            }))
          }}
          params={params}
          sizeOptions={sizeOptions}
          models={models}
          onAddCustomModel={addCustomModel}
          onParamsChange={(patch) => {
            setParams((prev) => {
              const next = applyPhotoGeometry({ ...prev, ...patch }, patch)
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

function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  const description =
    message ??
    t(
      'Enter a prompt above, choose a ratio and resolution, then generate. Reference images are optional.'
    )

  return (
    <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
      <div className='bg-muted rounded-full p-3'>
        <ImageIcon className='text-muted-foreground size-8' />
      </div>
      <div className='space-y-1'>
        <h3 className='text-base font-semibold break-words'>{t('No images yet')}</h3>
        <p className='text-muted-foreground max-w-md text-sm leading-relaxed break-words'>
          {description}
        </p>
      </div>
    </div>
  )
}

const PHOTO_PENDING_SLOT_IDS = [
  'photo-pending-1',
  'photo-pending-2',
  'photo-pending-3',
  'photo-pending-4',
] as const

function PhotoHistorySection({
  history,
  historyLoading,
  formLoading,
  pendingDisplayCount,
  onPreview,
  onRequestDelete,
}: {
  history: PhotoHistoryItem[]
  historyLoading: boolean
  formLoading: boolean
  pendingDisplayCount: number
  onPreview: (state: PhotoPreviewState) => void
  onRequestDelete: (entry: HistoryImageEntry) => void
}) {
  const visibleHistory = history.filter(
    (item) => item.status !== 'pending' || item.images.length > 0
  )
  const showEmpty =
    !historyLoading && visibleHistory.length === 0 && !formLoading

  return (
    <div className='flex flex-col gap-3'>
      <WorksFeedHeader />
      {historyLoading ? <PhotoPendingGrid count={3} /> : null}
      {formLoading ? <PhotoPendingGrid count={pendingDisplayCount} /> : null}
      {showEmpty ? <EmptyState /> : null}
      {visibleHistory.length > 0 ? (
        <HistoryFeed
          history={visibleHistory}
          onPreview={onPreview}
          onRequestDelete={onRequestDelete}
        />
      ) : null}
    </div>
  )
}

function PhotoPendingGrid({ count }: { count: number }) {
  const { t } = useTranslation()
  const slotCount = Math.min(
    PHOTO_PENDING_SLOT_IDS.length,
    Math.max(1, Number(count) || 1)
  )
  const slots = PHOTO_PENDING_SLOT_IDS.slice(0, slotCount)

  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 xl:grid-cols-5'>
      {slots.map((slotId) => (
        <div key={slotId} className='min-w-0'>
          <div className='bg-muted relative aspect-[3/4] overflow-hidden rounded-lg'>
            <Skeleton className='size-full rounded-lg' />
            <div className='bg-background/35 absolute inset-0 flex flex-col items-center justify-center gap-1'>
              <Loader2 className='text-primary size-5 animate-spin' />
              <span className='text-muted-foreground text-[10px]'>
                {t('Generating...')}
              </span>
            </div>
          </div>
          <Skeleton className='mt-2 h-4 w-4/5' />
          <Skeleton className='mt-1.5 h-3 w-1/2' />
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
}: {
  history: PhotoHistoryItem[]
  onPreview: (state: PhotoPreviewState) => void
  onRequestDelete: (entry: HistoryImageEntry) => void
}) {
  const user = useAuthStore((state) => state.auth.user)
  const author = useUserDisplay(user)
  const entries = useMemo(() => flattenHistoryImages(history), [history])
  const [aspectById, setAspectById] = useState<Record<string, string>>({})

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
    <WorksMasonry
      items={entries}
      getItemKey={(entry) => entry.id}
      getItemWeight={(entry) =>
        masonryItemWeight(
          aspectById[entry.id] ??
            photoCoverAspectFromSnapshot(entry.historyItem.generationParams)
        )
      }
      renderItem={(entry) => (
        <PhotoWorksCard
          image={entry.image}
          prompt={entry.prompt}
          model={entry.model}
          authorName={author.displayName}
          authorInitials={author.initials}
          coverAspect={
            aspectById[entry.id] ??
            photoCoverAspectFromSnapshot(entry.historyItem.generationParams)
          }
          onOpen={(src) => {
            void handleOpenPreview(entry, src)
          }}
          onDelete={() => onRequestDelete(entry)}
          onAspectMeasured={(ratio) => {
            setAspectById((current) => {
              if (current[entry.id] === ratio) return current
              return { ...current, [entry.id]: ratio }
            })
          }}
        />
      )}
    />
  )
}

function PhotoPreviewModelPicker({
  modelId,
  models,
  disabled,
  onChange,
}: {
  modelId: string
  models: PhotoModel[]
  disabled?: boolean
  onChange: (modelId: string) => void
}) {
  const { t } = useTranslation()
  const options = models.map((model) => ({
    value: model.id,
    label: model.label,
  }))

  return (
    <div className='space-y-2'>
      <Label>{t('Model')}</Label>
      <p className='text-muted-foreground text-xs leading-relaxed break-words'>
        {t('Uses the model from this generation by default. You can change it before generating.')}
      </p>
      <ComboboxInput
        options={options}
        value={modelId}
        onValueChange={onChange}
        placeholder={t('Search models')}
        emptyText='No models available'
        allowCustomValue
        className={disabled ? 'pointer-events-none opacity-60' : undefined}
      />
    </div>
  )
}

function PhotoPreviewSizePicker({
  params,
  sizeOptions,
  disabled,
  onParamsChange,
}: {
  params: PhotoParams
  sizeOptions: PhotoSizeOption[]
  disabled?: boolean
  onParamsChange: (patch: Partial<PhotoParams>) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      <div className='space-y-1'>
        <Label>{t('Image size')}</Label>
        <p className='text-muted-foreground text-xs leading-relaxed break-words'>
          {t('Adjust output size and aspect ratio before generating.')}
        </p>
      </div>

      <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
        {sizeOptions.map((item) => {
          const isSelected = params.imageSize === item.value
          let hintText = item.value
          if (item.value === 'custom' && isSelected) {
            hintText = `${params.customWidth}×${params.customHeight}`
          } else if (item.hint && item.hint !== item.value) {
            hintText = t(item.hint)
          }
          return (
            <button
              key={item.value}
              type='button'
              disabled={disabled}
              onClick={() =>
                onParamsChange({
                  imageSize: item.value,
                  resolution: item.value,
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
                {item.value === 'custom' ? t('Custom') : item.value}
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
                {hintText}
              </span>
            </button>
          )
        })}
      </div>

      {params.imageSize === 'custom' ? (
        <PhotoCustomSizeFields
          width={params.customWidth}
          height={params.customHeight}
          disabled={disabled}
          idPrefix='photo-preview-custom'
          onCommit={onParamsChange}
        />
      ) : null}

      <div className='space-y-2'>
        <Label className='text-xs'>{t('Aspect ratio')}</Label>
        <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-4'>
          {SEEDREAM_ASPECT_RATIO_OPTIONS.map((item) => {
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
                <span className='text-xs font-medium'>{item.ratio}</span>
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
      </div>
    </div>
  )
}

function PhotoPreviewStage({
  item,
  currentIndex,
}: {
  item: PhotoPreviewItem
  currentIndex: number
}) {
  const { t } = useTranslation()

  if (item.loading) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-10'>
        <Loader2 className='text-primary size-10 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {t('Generating image...')}
        </p>
      </div>
    )
  }

  if (!item.src) return null

  return (
    <PhotoImageMagnifier
      key={`${item.id}-${currentIndex}`}
      src={item.src}
      alt={t('Image preview')}
    />
  )
}

function PhotoPreviewThumb({ item }: { item: PhotoPreviewItem }) {
  const { t } = useTranslation()

  if (item.loading) {
    return (
      <div className='bg-muted flex size-full flex-col items-center justify-center gap-1'>
        <Loader2 className='text-primary size-4 animate-spin' />
        <span className='text-muted-foreground text-[9px] leading-none'>
          {t('Generating...')}
        </span>
      </div>
    )
  }

  if (item.src) {
    return (
      <img src={item.src} alt='' className='size-full object-cover' />
    )
  }

  return <div className='bg-muted size-full' />
}

function PhotoImagePreviewDialog({
  open,
  onOpenChange,
  preview,
  onNavigate,
  onSelectIndex,
  onModelChange,
  params,
  sizeOptions,
  models,
  onAddCustomModel,
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
  sizeOptions: PhotoSizeOption[]
  models: PhotoModel[]
  onAddCustomModel: (modelId: string) => void
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
  const [dialogModel, setDialogModel] = useState(params.model)

  useEffect(() => {
    if (!open) return
    setEditPrompt(preview?.prompt ?? '')
    setDialogModel(preview?.model || params.model)
  }, [open, params.model, preview?.prompt, preview?.model, preview?.currentIndex])

  const handleModelChange = (modelId: string) => {
    const next = modelId.trim()
    if (!next) return
    if (!models.some((model) => model.id === next)) {
      onAddCustomModel(next)
    }
    setDialogModel(next)
    onModelChange(next)
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
                <ChevronLeft className='size-5' />
              </Button>
            ) : null}

            <PhotoPreviewStage
              item={currentItem}
              currentIndex={currentIndex}
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
                <ChevronRight className='size-5' />
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
                    <PhotoPreviewThumb item={item} />
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className='max-h-[42vh] space-y-3 overflow-y-auto border-t px-4 py-4 sm:px-6'>
          <PhotoPreviewModelPicker
            modelId={dialogModel}
            models={models}
            disabled={generating}
            onChange={handleModelChange}
          />

          <PhotoPreviewSizePicker
            params={params}
            sizeOptions={sizeOptions}
            disabled={generating}
            onParamsChange={onParamsChange}
          />

          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <ImagePlus className='text-primary size-4' />
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
              <Plus className='mr-2 size-4' />
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
                <Download className='mr-2 size-4' />
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
                    <Loader2 className='mr-2 size-4 animate-spin' />
                    {t('Generating...')}
                  </>
                ) : (
                  <>
                    <Wand2 className='mr-2 size-4' />
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
