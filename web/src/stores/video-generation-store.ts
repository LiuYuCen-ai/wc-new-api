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
import {
  deleteUserVideoTask,
  fetchUserVideoTaskPage,
  pollVideoTask,
  submitVideoTask,
} from '@/features/video/api'
import { videoReferenceUrls } from '@/features/video/lib/video-request'
import {
  cacheVideoHistory,
  hasMoreTaskPages,
  mergeVideoHistory,
  remoteContainsVideoWork,
  syncVideoHistoryFromRemote,
  videoTaskDeleteIds,
} from '@/features/video/lib/video-history'
import {
  loadPersistedVideoJobs,
  removePersistedVideoJob,
  upsertPersistedVideoJob,
} from '@/features/video/lib/video-generation-session'
import { isUpstreamSensitiveError } from '@/features/photo/lib/photo-utils'
import type {
  VideoHistoryItem,
  VideoParams,
  VideoTaskStatus,
} from '@/features/video/types'

const VIDEO_HISTORY_KEY = 'quick-video-history'
const MAX_EMPTY_PAGE_LOOKAHEAD = 8
const MIN_HISTORY_PAGE_VIDEOS = 8
const activePolls = new Set<string>()

export type PendingVideoJob = {
  id: string
  userId: number
  taskId?: string
  params: VideoParams
  status: VideoTaskStatus
  startedAt: number
}

type VideoGenerationStore = {
  historyUserId: number | null
  history: VideoHistoryItem[]
  historyLoading: boolean
  historyLoadingMore: boolean
  historyPage: number
  historyTotal: number
  historyHasMore: boolean
  pendingJobs: PendingVideoJob[]
  viewerId: string | null
  resetForUser: () => void
  setViewerId: (id: string | null) => void
  loadHistory: (userId: number) => Promise<void>
  loadMoreHistory: () => Promise<void>
  startGeneration: (params: VideoParams, userId: number) => Promise<void>
  deleteHistoryItem: (id: string) => Promise<boolean>
}

function videoHistoryStorageKey(userId: number) {
  return `${VIDEO_HISTORY_KEY}:${userId}`
}

function loadVideoHistory(userId: number): VideoHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const keyed = window.sessionStorage.getItem(videoHistoryStorageKey(userId))
    if (keyed) {
      const parsed = JSON.parse(keyed) as unknown
      return Array.isArray(parsed) ? (parsed as VideoHistoryItem[]) : []
    }
    const legacy = window.sessionStorage.getItem(VIDEO_HISTORY_KEY)
    if (!legacy) return []
    const items = JSON.parse(legacy) as unknown
    return Array.isArray(items) ? (items as VideoHistoryItem[]) : []
  } catch {
    return []
  }
}

function saveVideoHistory(userId: number, history: VideoHistoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      videoHistoryStorageKey(userId),
      JSON.stringify(cacheVideoHistory(history))
    )
  } catch {
    // sessionStorage may be unavailable.
  }
}

function applyHistory(userId: number, history: VideoHistoryItem[]) {
  const state = useVideoGenerationStore.getState()
  if (state.historyUserId !== userId) return
  saveVideoHistory(userId, history)
  useVideoGenerationStore.setState({ history })
}

function friendlyError(err: unknown) {
  const raw = err instanceof Error ? err.message : t('Video generation failed')
  if (isUpstreamSensitiveError(raw)) {
    return t(
      'The model blocked this prompt as sensitive. Remove celebrity names, brands, IP, and prohibited descriptions, then try again.'
    )
  }
  return raw
}

function persistJob(job: PendingVideoJob) {
  upsertPersistedVideoJob(job)
}

function patchPendingJob(jobId: string, next: PendingVideoJob | null) {
  useVideoGenerationStore.setState((state) => ({
    pendingJobs:
      next == null
        ? state.pendingJobs.filter((job) => job.id !== jobId)
        : state.pendingJobs.map((job) => (job.id === jobId ? next : job)),
  }))
}

function resumablePersistedJobs(userId: number): PendingVideoJob[] {
  const jobs = loadPersistedVideoJobs(userId)
  const resumable: PendingVideoJob[] = []
  for (const job of jobs) {
    if (job.taskId) {
      resumable.push(job)
      continue
    }
    removePersistedVideoJob(job.id)
  }
  return resumable
}

type PulledVideoPages = {
  history: VideoHistoryItem[]
  page: number
  pageSize: number
  total: number
  failed: boolean
}

async function pullVideoTaskPages(input: {
  userId: number
  fromPage: number
  existing: VideoHistoryItem[]
  minNewItems: number
}): Promise<PulledVideoPages | null> {
  let page = input.fromPage - 1
  let pageSize = 0
  let total = 0
  let history = input.existing
  let added = 0
  let rounds = 0
  let failed = false

  while (rounds < MAX_EMPTY_PAGE_LOOKAHEAD) {
    const result = await fetchUserVideoTaskPage(page + 1)
    if (useVideoGenerationStore.getState().historyUserId !== input.userId) {
      return null
    }
    if (result == null) {
      failed = rounds === 0
      break
    }
    page = result.page
    pageSize = result.pageSize
    total = result.total
    const merged = mergeVideoHistory(result.items, history)
    added += merged.length - history.length
    history = merged
    rounds += 1
    if (added >= input.minNewItems || !hasMoreTaskPages(page, pageSize, total)) {
      break
    }
  }

  return {
    history,
    page: Math.max(page, 0),
    pageSize,
    total,
    failed,
  }
}

async function finishVideoJob(input: {
  userId: number
  jobId: string
  result: { requestId: string; url: string }
  params: VideoParams
}) {
  const nextItem: VideoHistoryItem = {
    id: input.result.requestId,
    requestId: input.result.requestId,
    deleteIds: [input.result.requestId],
    status: 'done',
    url: input.result.url,
    prompt: input.params.prompt.trim(),
    model: input.params.model.trim(),
    duration: input.params.duration,
    aspectRatio: input.params.aspectRatio,
    resolution: input.params.resolution,
    referenceImageUrls: videoReferenceUrls(
      input.params.referenceImageUrls,
      input.params.referenceImageUrl
    ),
    referenceVideoUrls: videoReferenceUrls(
      input.params.referenceVideoUrls,
      input.params.referenceVideoUrl
    ),
    referenceAudioUrl: input.params.referenceAudioUrl,
    createdAt: Date.now(),
  }

  const current = useVideoGenerationStore.getState()
  const local =
    current.historyUserId === input.userId ? current.history : loadVideoHistory(input.userId)
  const remote = await fetchUserVideoTaskPage(1)
  const next =
    remote == null
      ? mergeVideoHistory([], [nextItem, ...local])
      : mergeVideoHistory(remote.items, [nextItem, ...local])

  applyHistory(input.userId, next)
  removePersistedVideoJob(input.jobId)
  patchPendingJob(input.jobId, null)
  toast.success(t('Video generated successfully'))
}

async function pollUntilDone(job: PendingVideoJob) {
  if (!job.taskId || activePolls.has(job.id)) return
  activePolls.add(job.id)
  try {
    const result = await pollVideoTask(job.taskId, (status) => {
      const current = useVideoGenerationStore
        .getState()
        .pendingJobs.find((item) => item.id === job.id)
      if (!current) return
      const next = { ...current, status }
      persistJob(next)
      patchPendingJob(job.id, next)
    })
    await finishVideoJob({
      userId: job.userId,
      jobId: job.id,
      result,
      params: job.params,
    })
  } catch (err) {
    toast.error(friendlyError(err))
    removePersistedVideoJob(job.id)
    patchPendingJob(job.id, null)
  } finally {
    activePolls.delete(job.id)
  }
}

export const useVideoGenerationStore = create<VideoGenerationStore>()(
  (set, get) => ({
    historyUserId: null,
    history: [],
    historyLoading: false,
    historyLoadingMore: false,
    historyPage: 0,
    historyTotal: 0,
    historyHasMore: false,
    pendingJobs: [],
    viewerId: null,

    resetForUser: () => {
      set({
        historyUserId: null,
        history: [],
        historyLoading: false,
        historyLoadingMore: false,
        historyPage: 0,
        historyTotal: 0,
        historyHasMore: false,
        pendingJobs: [],
        viewerId: null,
      })
    },

    setViewerId: (viewerId) => set({ viewerId }),

    loadHistory: async (userId) => {
      const local = loadVideoHistory(userId)
      const persisted = resumablePersistedJobs(userId)
      set({
        historyUserId: userId,
        history: local,
        historyLoading: true,
        historyLoadingMore: false,
        historyPage: 0,
        historyTotal: 0,
        historyHasMore: false,
        pendingJobs: persisted,
      })
      try {
        const pulled = await pullVideoTaskPages({
          userId,
          fromPage: 1,
          existing: [],
          minNewItems: MIN_HISTORY_PAGE_VIDEOS,
        })
        if (pulled == null || get().historyUserId !== userId) return
        if (!pulled.failed) {
          const hasMore = hasMoreTaskPages(
            pulled.page,
            pulled.pageSize,
            pulled.total
          )
          applyHistory(
            userId,
            hasMore
              ? mergeVideoHistory(pulled.history, local)
              : syncVideoHistoryFromRemote(pulled.history, local)
          )
          set({
            historyPage: pulled.page,
            historyTotal: pulled.total,
            historyHasMore: hasMore,
          })
        }
        const jobs = resumablePersistedJobs(userId)
        set({ pendingJobs: jobs })
        for (const job of jobs) {
          void pollUntilDone(job)
        }
      } finally {
        if (get().historyUserId === userId) {
          set({ historyLoading: false })
        }
      }
    },

    loadMoreHistory: async () => {
      const state = get()
      if (
        !state.historyUserId ||
        state.historyLoading ||
        state.historyLoadingMore ||
        !state.historyHasMore
      ) {
        return
      }

      set({ historyLoadingMore: true })
      try {
        const pulled = await pullVideoTaskPages({
          userId: state.historyUserId,
          fromPage: state.historyPage + 1,
          existing: state.history,
          minNewItems: MIN_HISTORY_PAGE_VIDEOS,
        })
        if (pulled == null || get().historyUserId !== state.historyUserId) {
          return
        }
        if (pulled.failed) return
        applyHistory(state.historyUserId, pulled.history)
        set({
          historyPage: pulled.page,
          historyTotal: pulled.total,
          historyHasMore: hasMoreTaskPages(
            pulled.page,
            pulled.pageSize,
            pulled.total
          ),
        })
      } finally {
        if (get().historyUserId === state.historyUserId) {
          set({ historyLoadingMore: false })
        }
      }
    },

    startGeneration: async (params, userId) => {
      const job: PendingVideoJob = {
        id: randomUUID(),
        userId,
        params,
        status: 'queued',
        startedAt: Date.now(),
      }
      persistJob(job)
      set((state) => ({
        pendingJobs: [job, ...state.pendingJobs],
      }))
      try {
        const { taskId } = await submitVideoTask(params)
        const submitted = { ...job, taskId, status: 'processing' as const }
        persistJob(submitted)
        patchPendingJob(job.id, submitted)
        void pollUntilDone(submitted)
      } catch (err) {
        toast.error(friendlyError(err))
        removePersistedVideoJob(job.id)
        patchPendingJob(job.id, null)
      }
    },

    deleteHistoryItem: async (id) => {
      const { history, historyUserId } = get()
      if (!historyUserId) return false
      const item = history.find((entry) => entry.id === id)
      if (!item) return false
      const deleted = await deleteUserVideoTask(videoTaskDeleteIds(item))
      if (!deleted) {
        toast.error(t('Delete failed'))
        return false
      }
      applyHistory(
        historyUserId,
        history.filter((entry) => !remoteContainsVideoWork([entry], item))
      )
      return true
    },
  })
)

export function useVideoGenerating() {
  return useVideoGenerationStore((state) => state.pendingJobs.length > 0)
}
