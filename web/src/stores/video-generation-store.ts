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
  fetchUserVideoTasks,
  pollVideoTask,
  submitVideoTask,
} from '@/features/video/api'
import {
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
  pendingJob: PendingVideoJob | null
  viewerId: string | null
  resetForUser: () => void
  setViewerId: (id: string | null) => void
  loadHistory: (userId: number) => Promise<void>
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
      JSON.stringify(history)
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
    referenceImageUrl: input.params.referenceImageUrl,
    createdAt: Date.now(),
  }

  const current = useVideoGenerationStore.getState()
  const local =
    current.historyUserId === input.userId ? current.history : loadVideoHistory(input.userId)
  const remote = await fetchUserVideoTasks()
  const next =
    remote == null
      ? mergeVideoHistory([], [nextItem, ...local])
      : syncVideoHistoryFromRemote(remote, [nextItem, ...local])

  applyHistory(input.userId, next)
  removePersistedVideoJob(input.jobId)
  useVideoGenerationStore.setState((state) => {
    if (state.pendingJob?.id !== input.jobId) return state
    const opened = next.find((item) => remoteContainsVideoWork([item], nextItem))
    return {
      pendingJob: null,
      viewerId: opened?.id ?? input.result.requestId,
    }
  })
  toast.success(t('Video generated successfully'))
}

async function pollUntilDone(job: PendingVideoJob) {
  if (!job.taskId || activePolls.has(job.id)) return
  activePolls.add(job.id)
  try {
    const result = await pollVideoTask(job.taskId, (status) => {
      useVideoGenerationStore.setState((state) => {
        if (state.pendingJob?.id !== job.id) return state
        persistJob({ ...state.pendingJob, status })
        return { pendingJob: { ...state.pendingJob, status } }
      })
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
    useVideoGenerationStore.setState((state) =>
      state.pendingJob?.id === job.id ? { pendingJob: null } : state
    )
  } finally {
    activePolls.delete(job.id)
  }
}

export const useVideoGenerationStore = create<VideoGenerationStore>()(
  (set, get) => ({
    historyUserId: null,
    history: [],
    historyLoading: false,
    pendingJob: null,
    viewerId: null,

    resetForUser: () => {
      set({
        historyUserId: null,
        history: [],
        historyLoading: false,
        pendingJob: null,
        viewerId: null,
      })
    },

    setViewerId: (viewerId) => set({ viewerId }),

    loadHistory: async (userId) => {
      const local = loadVideoHistory(userId)
      const persisted = loadPersistedVideoJobs(userId)[0] ?? null
      set({
        historyUserId: userId,
        history: local,
        historyLoading: true,
        pendingJob: persisted,
      })
      try {
        const remote = await fetchUserVideoTasks()
        if (get().historyUserId !== userId) return
        if (remote != null) {
          const synced = syncVideoHistoryFromRemote(remote, local)
          applyHistory(userId, synced)
        }
        const job = loadPersistedVideoJobs(userId)[0]
        if (job) {
          set({ pendingJob: job })
          if (job.taskId) void pollUntilDone(job)
        }
      } finally {
        if (get().historyUserId === userId) {
          set({ historyLoading: false })
        }
      }
    },

    startGeneration: async (params, userId) => {
      if (get().pendingJob) return
      const job: PendingVideoJob = {
        id: randomUUID(),
        userId,
        params,
        status: 'queued',
        startedAt: Date.now(),
      }
      persistJob(job)
      set({ pendingJob: job, viewerId: null })
      try {
        const { taskId } = await submitVideoTask(params)
        const submitted = { ...job, taskId, status: 'processing' as const }
        persistJob(submitted)
        set((state) =>
          state.pendingJob?.id === job.id ? { pendingJob: submitted } : state
        )
        await pollUntilDone(submitted)
      } catch (err) {
        toast.error(friendlyError(err))
        removePersistedVideoJob(job.id)
        set((state) =>
          state.pendingJob?.id === job.id ? { pendingJob: null } : state
        )
      }
    },

    deleteHistoryItem: async (id) => {
      const { history, historyUserId } = get()
      if (!historyUserId) return false
      const item = history.find((entry) => entry.id === id)
      if (!item) return false
      const deleted = await deleteUserVideoTask(videoTaskDeleteIds(item))
      const nextLocal = history.filter(
        (entry) => !remoteContainsVideoWork([entry], item)
      )
      const remote = await fetchUserVideoTasks()
      if (remote == null) {
        if (!deleted) {
          toast.error(t('Delete failed'))
          return false
        }
        applyHistory(historyUserId, nextLocal)
        return true
      }
      if (remoteContainsVideoWork(remote, item)) {
        toast.error(t('Delete failed'))
        applyHistory(historyUserId, syncVideoHistoryFromRemote(remote, nextLocal))
        return false
      }
      applyHistory(historyUserId, syncVideoHistoryFromRemote(remote, nextLocal))
      return true
    },
  })
)

export function useVideoGenerating() {
  return useVideoGenerationStore((state) => Boolean(state.pendingJob))
}
