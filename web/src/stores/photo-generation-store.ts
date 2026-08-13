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
import { t } from 'i18next'
import { toast } from 'sonner'
import { create } from 'zustand'
import { randomUUID } from '@/lib/utils'
import { generatePhoto } from '@/features/photo/api'
import {
  createPendingPhotoHistoryItem,
  fetchPhotoHistory,
  type PhotoHistoryItem,
} from '@/features/photo/lib/photo-history-api'
import {
  loadPersistedPhotoJobs,
  pendingJobsToUiState,
  removePersistedPhotoJob,
  upsertPersistedPhotoJob,
  type PersistedPhotoGenerationJob,
} from '@/features/photo/lib/photo-generation-session'
import {
  hasActivePhotoSession,
  loadPhotoHistoryForUser,
  savePhotoHistoryImages,
  savePhotoHistoryItem,
  waitForActiveSession,
} from '@/features/photo/lib/photo-history-storage'
import {
  getPhotoResultSrc,
  pickGenerationSnapshot,
} from '@/features/photo/lib/photo-utils'
import type { PhotoGenerationSnapshot, PhotoParams, PhotoResult } from '@/features/photo/types'

export type PhotoPreviewItem = {
  id: string
  src?: string
  loading?: boolean
}

export type PhotoPreviewState = {
  prompt?: string
  model?: string
  createdAt?: string
  historyItemId?: string
  generationParams?: PhotoGenerationSnapshot
  items: PhotoPreviewItem[]
  currentIndex: number
}

type PhotoPendingFormJob = {
  id: string
  count: number
  historyId: string
}

type PhotoGenerationStore = {
  historyUserId: number | null
  history: PhotoHistoryItem[]
  historyLoading: boolean
  pendingFormJobs: PhotoPendingFormJob[]
  preview: PhotoPreviewState | null
  previewGenerating: boolean
  resetForUser: () => void
  setPreview: (preview: PhotoPreviewState | null) => void
  updatePreview: (
    updater: (current: PhotoPreviewState | null) => PhotoPreviewState | null
  ) => void
  loadHistory: (userId: number) => Promise<void>
  recoverGenerations: (userId: number) => Promise<void>
  runFormGeneration: (params: PhotoParams, userId: number) => Promise<void>
  runPreviewGeneration: (input: {
    params: PhotoParams
    userId: number
    trimmedPrompt: string
    generationModel: string
    existingHistoryItemId?: string
    previewBase?: PhotoPreviewState | null
    referenceSrc?: string
  }) => Promise<void>
}

const activeRecoveries = new Set<string>()
const PHOTO_HISTORY_LIMIT = 50

function clampPendingCount(n: number | '' | undefined) {
  const value = Math.floor(Number(n || 1))
  if (!Number.isFinite(value) || value < 1) return 1
  if (value > 4) return 4
  return value
}

function extractGenerationError(err: unknown) {
  const status = (err as { response?: { status?: number } })?.response?.status
  if (status === 401) {
    return t('Session expired!')
  }

  return (
    (err as { response?: { data?: { error?: { message?: string } } } })
      ?.response?.data?.error?.message ??
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ??
    (err as Error).message ??
    t('Generation failed')
  )
}

function isUnauthorizedError(err: unknown) {
  return (err as { response?: { status?: number } })?.response?.status === 401
}

function addPendingJob(jobs: PhotoPendingFormJob[], job: PhotoPendingFormJob) {
  return [...jobs.filter((item) => item.historyId !== job.historyId), job]
}

function removePendingJob(jobs: PhotoPendingFormJob[], historyId: string) {
  return jobs.filter((job) => job.historyId !== historyId)
}

function syncPendingUiFromSession(userId: number) {
  const jobs = loadPersistedPhotoJobs(userId)
  return pendingJobsToUiState(jobs).map((job) => ({
    id: job.id,
    count: job.count,
    historyId: job.historyId,
  }))
}

function buildPersistedJob(input: {
  historyId: string
  userId: number
  params: PhotoParams
  phase: PersistedPhotoGenerationJob['phase']
  resultImages?: PhotoResult[]
}): PersistedPhotoGenerationJob {
  return {
    id: randomUUID(),
    historyId: input.historyId,
    userId: input.userId,
    count: clampPendingCount(input.params.n),
    prompt: input.params.prompt,
    model: input.params.model,
    phase: input.phase,
    params: input.params,
    generationParams: pickGenerationSnapshot(input.params),
    startedAt: Date.now(),
    resultImages: input.resultImages,
  }
}

async function refreshHistoryForUser(userId: number) {
  const items = await loadPhotoHistoryForUser(userId)
  applyHistoryUpdate(userId, items)
  return items
}

function applyHistoryUpdate(userId: number, history: PhotoHistoryItem[] | null) {
  if (history && usePhotoGenerationStore.getState().historyUserId === userId) {
    usePhotoGenerationStore.setState({ history })
  }
}

function mergeHistoryItem(
  history: PhotoHistoryItem[],
  item: PhotoHistoryItem
): PhotoHistoryItem[] {
  return [item, ...history.filter((entry) => entry.id !== item.id)].slice(
    0,
    PHOTO_HISTORY_LIMIT
  )
}

function buildReadyHistoryItem(input: {
  historyId: string
  prompt: string
  model: string
  images: PhotoResult[]
  generationParams?: PhotoGenerationSnapshot
}): PhotoHistoryItem {
  return {
    id: input.historyId,
    prompt: input.prompt,
    model: input.model,
    status: 'ready',
    created_at: new Date().toISOString(),
    images: input.images,
    generationParams: input.generationParams,
  }
}

function upsertReadyHistoryItem(
  userId: number,
  input: {
    historyId: string
    prompt: string
    model: string
    images: PhotoResult[]
    generationParams?: PhotoGenerationSnapshot
  }
) {
  usePhotoGenerationStore.setState((state) => {
    if (state.historyUserId !== userId) return state
    return {
      history: mergeHistoryItem(
        state.history,
        buildReadyHistoryItem(input)
      ),
    }
  })
}

async function finalizeGeneratedHistory(input: {
  historyId: string
  userId: number
  prompt: string
  model: string
  images: PhotoResult[]
  generationParams?: PhotoGenerationSnapshot
}) {
  upsertReadyHistoryItem(input.userId, input)

  const nextHistory = await savePhotoHistoryImages(
    input.historyId,
    input.images,
    input.prompt
  )

  if (nextHistory) {
    applyHistoryUpdate(input.userId, nextHistory)
  } else {
    const created = await savePhotoHistoryItem({
      id: input.historyId,
      prompt: input.prompt,
      model: input.model,
      images: input.images,
      generationParams: input.generationParams,
    })
    if (created) {
      applyHistoryUpdate(input.userId, created)
    } else {
      await refreshHistoryForUser(input.userId)
    }
  }

  removePersistedPhotoJob(input.historyId)
  usePhotoGenerationStore.setState((state) => ({
    pendingFormJobs: removePendingJob(state.pendingFormJobs, input.historyId),
  }))
}

async function completeSavingJob(job: PersistedPhotoGenerationJob) {
  if (!job.resultImages?.length) return

  await finalizeGeneratedHistory({
    historyId: job.historyId,
    userId: job.userId,
    prompt: job.prompt,
    model: job.model,
    images: job.resultImages,
    generationParams: job.generationParams,
  })
}

async function resumeGeneratingJob(job: PersistedPhotoGenerationJob) {
  if (activeRecoveries.has(job.historyId)) return
  activeRecoveries.add(job.historyId)

  usePhotoGenerationStore.setState((state) => ({
    pendingFormJobs: addPendingJob(state.pendingFormJobs, {
      id: job.id,
      count: job.count,
      historyId: job.historyId,
    }),
  }))

  try {
    const res = await generatePhoto(job.params)
    if (!res.images?.length) {
      toast.warning(t('No images returned'))
      removePersistedPhotoJob(job.historyId)
      return
    }

    upsertPersistedPhotoJob(
      buildPersistedJob({
        historyId: job.historyId,
        userId: job.userId,
        params: job.params,
        phase: 'saving',
        resultImages: res.images,
      })
    )

    await finalizeGeneratedHistory({
      historyId: job.historyId,
      userId: job.userId,
      prompt: job.prompt,
      model: job.model,
      images: res.images,
      generationParams: job.generationParams,
    })

    toast.success(
      t('Generated {{count}} image(s)', { count: res.images.length })
    )
  } catch (err) {
    if (!isUnauthorizedError(err)) {
      toast.error(extractGenerationError(err))
    }
    if (!isUnauthorizedError(err)) {
      removePersistedPhotoJob(job.historyId)
    }
  } finally {
    activeRecoveries.delete(job.historyId)
    usePhotoGenerationStore.setState((state) => ({
      pendingFormJobs: removePendingJob(state.pendingFormJobs, job.historyId),
    }))
  }
}

async function ensurePendingHistoryRecord(job: PersistedPhotoGenerationJob) {
  const history = await fetchPhotoHistory(PHOTO_HISTORY_LIMIT)
  const exists = history.some((item) => item.id === job.historyId)
  if (exists) return

  await createPendingPhotoHistoryItem({
    id: job.historyId,
    prompt: job.prompt,
    model: job.model,
    generationParams: job.generationParams,
  })
}

export const usePhotoGenerationStore = create<PhotoGenerationStore>()((set, get) => ({
  historyUserId: null,
  history: [],
  historyLoading: false,
  pendingFormJobs: [],
  preview: null,
  previewGenerating: false,

  resetForUser: () => {
    set({
      historyUserId: null,
      history: [],
      historyLoading: false,
      pendingFormJobs: [],
      preview: null,
      previewGenerating: false,
    })
  },

  setPreview: (preview) => set({ preview }),

  updatePreview: (updater) => {
    set({ preview: updater(get().preview) })
  },

  loadHistory: async (userId) => {
    set({
      historyLoading: true,
      historyUserId: userId,
      pendingFormJobs: syncPendingUiFromSession(userId),
    })
    try {
      const hasSession = await waitForActiveSession()
      if (!hasSession) {
        if (get().historyUserId === userId) {
          set({ history: [] })
        }
        return
      }

      const items = await loadPhotoHistoryForUser(userId)
      if (get().historyUserId === userId) {
        set({ history: items })
      }
      await get().recoverGenerations(userId)
    } finally {
      if (get().historyUserId === userId) {
        set({ historyLoading: false })
      }
    }
  },

  recoverGenerations: async (userId) => {
    if (!(await hasActivePhotoSession())) return

    const jobs = loadPersistedPhotoJobs(userId)
    if (jobs.length === 0) return

    set({ pendingFormJobs: syncPendingUiFromSession(userId) })

    for (const job of jobs) {
      if (activeRecoveries.has(job.historyId)) continue

      await ensurePendingHistoryRecord(job)
      await refreshHistoryForUser(userId)

      if (job.phase === 'saving') {
        activeRecoveries.add(job.historyId)
        try {
          await completeSavingJob(job)
        } finally {
          activeRecoveries.delete(job.historyId)
        }
        continue
      }

      void resumeGeneratingJob(job)
    }
  },

  runFormGeneration: async (params, userId) => {
    if (!(await hasActivePhotoSession())) {
      toast.error(t('Session expired!'))
      return
    }

    const historyId = randomUUID()
    const jobId = randomUUID()
    const count = clampPendingCount(params.n)

    const persistedJob = buildPersistedJob({
      historyId,
      userId,
      params,
      phase: 'generating',
    })
    persistedJob.id = jobId
    upsertPersistedPhotoJob(persistedJob)

    set((state) => ({
      pendingFormJobs: addPendingJob(state.pendingFormJobs, {
        id: jobId,
        count,
        historyId,
      }),
    }))

    await createPendingPhotoHistoryItem({
      id: historyId,
      prompt: params.prompt,
      model: params.model,
      generationParams: pickGenerationSnapshot(params),
    })
    await refreshHistoryForUser(userId)

    try {
      const res = await generatePhoto(params)
      if (!res.images || res.images.length === 0) {
        toast.warning(t('No images returned'))
        removePersistedPhotoJob(historyId)
        return
      }

      upsertPersistedPhotoJob(
        buildPersistedJob({
          historyId,
          userId,
          params,
          phase: 'saving',
          resultImages: res.images,
        })
      )

      await finalizeGeneratedHistory({
        historyId,
        userId,
        prompt: params.prompt,
        model: params.model,
        images: res.images,
        generationParams: pickGenerationSnapshot(params),
      })

      toast.success(
        t('Generated {{count}} image(s)', { count: res.images.length })
      )
    } catch (err) {
      if (!isUnauthorizedError(err)) {
        toast.error(extractGenerationError(err))
        removePersistedPhotoJob(historyId)
      }
    } finally {
      set((state) => ({
        pendingFormJobs: removePendingJob(state.pendingFormJobs, historyId),
      }))
    }
  },

  runPreviewGeneration: async ({
    params,
    userId,
    trimmedPrompt,
    generationModel,
    existingHistoryItemId,
    previewBase,
    referenceSrc,
  }) => {
    if (!(await hasActivePhotoSession())) {
      toast.error(t('Session expired!'))
      return
    }

    const pendingId = `pending-${Date.now()}`
    const baseItems =
      previewBase?.items ??
      (referenceSrc ? [{ id: 'ref', src: referenceSrc }] : [])

    set({
      previewGenerating: true,
      preview: {
        prompt: trimmedPrompt || previewBase?.prompt,
        model: generationModel,
        createdAt: previewBase?.createdAt ?? new Date().toISOString(),
        historyItemId: previewBase?.historyItemId ?? existingHistoryItemId,
        items: [{ id: pendingId, loading: true }, ...baseItems],
        currentIndex: 0,
      },
    })

    const historyId = existingHistoryItemId ?? randomUUID()
    if (!existingHistoryItemId) {
      const persistedJob = buildPersistedJob({
        historyId,
        userId,
        params,
        phase: 'generating',
      })
      upsertPersistedPhotoJob(persistedJob)
      await createPendingPhotoHistoryItem({
        id: historyId,
        prompt: trimmedPrompt,
        model: generationModel,
        generationParams: pickGenerationSnapshot(params),
      })
      set((state) => ({
        pendingFormJobs: addPendingJob(state.pendingFormJobs, {
          id: persistedJob.id,
          count: clampPendingCount(params.n),
          historyId,
        }),
      }))
    }

    try {
      const res = await generatePhoto(params)
      const newItems: PhotoPreviewItem[] = res.images.map((img, index) => ({
        id: `gen-${Date.now()}-${index}`,
        src: getPhotoResultSrc(img),
      }))

      set((state) => {
        const current = state.preview
        if (!current) return state
        const rest = current.items.filter((item) => item.id !== pendingId)
        return {
          preview: {
            ...current,
            prompt: trimmedPrompt,
            model: generationModel,
            items: [...newItems, ...rest],
            currentIndex: 0,
            historyItemId: historyId,
          },
        }
      })

      toast.success(
        t('Generated {{count}} image(s)', { count: res.images.length })
      )

      if (existingHistoryItemId) {
        usePhotoGenerationStore.setState((state) => {
          if (state.historyUserId !== userId) return state
          const existing = state.history.find(
            (item) => item.id === existingHistoryItemId
          )
          if (!existing) return state
          return {
            history: mergeHistoryItem(state.history, {
              ...existing,
              status: 'ready',
              prompt: trimmedPrompt || existing.prompt,
              images: [...existing.images, ...res.images],
            }),
          }
        })

        const nextHistory = await savePhotoHistoryImages(
          existingHistoryItemId,
          res.images,
          trimmedPrompt
        )
        applyHistoryUpdate(userId, nextHistory)
      } else {
        upsertPersistedPhotoJob(
          buildPersistedJob({
            historyId,
            userId,
            params,
            phase: 'saving',
            resultImages: res.images,
          })
        )

        await finalizeGeneratedHistory({
          historyId,
          userId,
          prompt: trimmedPrompt,
          model: generationModel,
          images: res.images,
          generationParams: pickGenerationSnapshot(params),
        })

        set((state) => ({
          preview: state.preview
            ? { ...state.preview, historyItemId: historyId }
            : state.preview,
        }))
      }
    } catch (err) {
      set((state) => {
        const current = state.preview
        if (!current) return { previewGenerating: false }
        return {
          preview: {
            ...current,
            items: current.items.filter((item) => item.id !== pendingId),
            currentIndex: Math.min(
              current.currentIndex,
              Math.max(0, current.items.length - 2)
            ),
          },
          previewGenerating: false,
        }
      })
      if (!existingHistoryItemId) {
        if (!isUnauthorizedError(err)) {
          removePersistedPhotoJob(historyId)
          set((state) => ({
            pendingFormJobs: removePendingJob(state.pendingFormJobs, historyId),
          }))
        }
      }
      if (!isUnauthorizedError(err)) {
        toast.error(extractGenerationError(err))
      }
      return
    }

    if (!existingHistoryItemId) {
      set((state) => ({
        pendingFormJobs: removePendingJob(state.pendingFormJobs, historyId),
      }))
    }
    set({ previewGenerating: false })
  },
}))

export function usePhotoFormGenerating() {
  return usePhotoGenerationStore((state) => state.pendingFormJobs.length > 0)
}

export function usePhotoPendingImageCount() {
  return usePhotoGenerationStore((state) =>
    state.pendingFormJobs.reduce((sum, job) => sum + job.count, 0)
  )
}

export function usePhotoPendingDisplayCount() {
  return usePhotoGenerationStore((state) => {
    const jobCount = state.pendingFormJobs.reduce(
      (sum, job) => sum + job.count,
      0
    )
    if (jobCount > 0) return jobCount

    return state.history.filter(
      (item) => item.status === 'pending' && item.images.length === 0
    ).length
  })
}
