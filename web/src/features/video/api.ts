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

import { api } from '@/lib/api'
import { isUpstreamSensitiveError } from '@/features/photo/lib/photo-utils'

import {
  VIDEO_TASK_PAGE_SIZE,
  toVideoHistoryItem,
  type UserVideoTask,
} from './lib/video-history'
import {
  buildVideoSubmitBody,
  defaultVideoDuration,
  isVideoCapableModel,
} from './lib/video-request'
import type {
  VideoHistoryItem,
  VideoParams,
  VideoTaskStatus,
} from './types'

type PlatformSubmitResponse = {
  id?: string
  task_id?: string
  taskId?: string
  request_id?: string
  data?: PlatformSubmitResponse
  error?: { message?: string }
  message?: string
  fail_reason?: string
}

type PlatformTask = {
  task_id: string
  status: string
  progress?: string
  result_url?: string
  fail_reason?: string
}

type PlatformQueryResponse = {
  code: string
  message?: string
  data?: PlatformTask
  error?: { message?: string }
}

function normalizeStatus(status?: string): VideoTaskStatus {
  switch (status?.toUpperCase()) {
    case 'SUBMITTED':
    case 'QUEUED':
    case 'PENDING':
      return 'queued'
    case 'IN_PROGRESS':
    case 'PROCESSING':
    case 'RUNNING':
      return 'processing'
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'COMPLETED':
    case 'DONE':
      return 'done'
    case 'FAILURE':
    case 'FAILED':
    case 'CANCELLED':
      return 'failed'
    default:
      return 'processing'
  }
}

function extractApiErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const record = data as {
    error?: { message?: string }
    message?: string
    fail_reason?: string
  }
  return record.error?.message ?? record.message ?? record.fail_reason
}

function extractThrownError(err: unknown): string {
  const responseData = (err as { response?: { data?: unknown } })?.response
    ?.data
  return (
    extractApiErrorMessage(responseData) ??
    (err as Error).message ??
    t('Video generation failed')
  )
}

function friendlyVideoError(message: string): string {
  if (isUpstreamSensitiveError(message)) {
    return t(
      'The model blocked this prompt as sensitive. Remove celebrity names, brands, IP, and prohibited descriptions, then try again.'
    )
  }
  return message
}

function parseDuration(params: VideoParams): number {
  const parsed = Number.parseInt(params.duration.trim(), 10)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  return defaultVideoDuration(params.model)
}

export async function submitVideoTask(
  params: VideoParams
): Promise<{ taskId: string }> {
  if (!isVideoCapableModel(params.model, params.endpointTypes)) {
    throw new Error(
      t(
        'This model does not support video generation. Choose a video model, or switch to Image mode.'
      )
    )
  }

  const body = buildVideoSubmitBody(params, parseDuration(params))
  try {
    const res = await api.post<PlatformSubmitResponse>('/pg/videos', body, {
      skipErrorHandler: true,
    })
    const errorMessage = extractApiErrorMessage(res.data)
    if (errorMessage) {
      throw new Error(friendlyVideoError(errorMessage))
    }
    const response = res.data.data || res.data
    const taskId =
      response.task_id || response.id || response.taskId || response.request_id
    if (!taskId) {
      throw new Error(
        t('Video task was submitted, but the platform did not return a task ID.')
      )
    }
    return { taskId }
  } catch (err) {
    if (err instanceof Error && err.message && !('response' in err)) {
      throw err
    }
    throw new Error(friendlyVideoError(extractThrownError(err)))
  }
}

export async function queryVideoTask(taskId: string): Promise<{
  status: VideoTaskStatus
  progress: number
  videoUrl?: string
  error?: string
}> {
  const res = await api.get<PlatformQueryResponse>(
    `/pg/videos/${encodeURIComponent(taskId)}`,
    { disableDuplicate: true, skipErrorHandler: true }
  )
  const errorMessage = extractApiErrorMessage(res.data)
  if (errorMessage && !res.data.data) {
    throw new Error(friendlyVideoError(errorMessage))
  }
  const record = res.data.data
  if (!record) {
    throw new Error(t('The platform did not return video task data.'))
  }
  return {
    status: normalizeStatus(record.status),
    progress: Number.parseInt(record.progress || '0', 10) || 0,
    videoUrl: record.result_url,
    error: record.fail_reason
      ? friendlyVideoError(record.fail_reason)
      : undefined,
  }
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type UserVideoTaskPage = {
  items: VideoHistoryItem[]
  page: number
  pageSize: number
  total: number
}

export async function fetchUserVideoTaskPage(
  page = 1,
  pageSize = VIDEO_TASK_PAGE_SIZE
): Promise<UserVideoTaskPage | null> {
  try {
    const res = await api.get<{
      success: boolean
      data?: {
        items?: UserVideoTask[]
        page?: number
        page_size?: number
        total?: number
      }
    }>('/api/task/self', {
      params: { p: page, page_size: pageSize },
      skipErrorHandler: true,
    })
    if (!res.data?.success) return null
    const data = res.data.data
    const items = Array.isArray(data?.items)
      ? data.items
          .map(toVideoHistoryItem)
          .filter((item): item is VideoHistoryItem => item != null)
      : []
    return {
      items,
      page: data?.page ?? page,
      pageSize: data?.page_size ?? pageSize,
      total: data?.total ?? 0,
    }
  } catch {
    return null
  }
}

export async function deleteUserVideoTask(
  taskId: string | string[]
): Promise<boolean> {
  const ids = uniqueDeleteIds(taskId)
  if (ids.length === 0) return false
  for (const id of ids) {
    const deleted = await deleteUserVideoTaskById(id)
    if (deleted) return true
  }
  return false
}

function uniqueDeleteIds(taskId: string | string[]): string[] {
  const values = Array.isArray(taskId) ? taskId : [taskId]
  const ids: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const id = value.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

async function deleteUserVideoTaskById(id: string): Promise<boolean> {
  try {
    const res = await api.delete<{ success: boolean; message?: string }>(
      `/api/task/self/${encodeURIComponent(id)}`,
      { skipErrorHandler: true, skipBusinessError: true }
    )
    return res.data?.success === true
  } catch {
    return false
  }
}

export async function pollVideoTask(
  taskId: string,
  onProgress?: (status: VideoTaskStatus) => void
): Promise<{ requestId: string; url: string }> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    await sleep(POLL_INTERVAL_MS)
    const result = await queryVideoTask(taskId)
    onProgress?.(result.status)

    if (result.status === 'done' || result.status === 'succeeded') {
      if (!result.videoUrl) {
        throw new Error(
          t(
            'The video task completed, but the platform did not return a video URL.'
          )
        )
      }
      return { requestId: taskId, url: result.videoUrl }
    }

    if (result.status === 'failed') {
      throw new Error(result.error || t('Video generation failed'))
    }
  }

  throw new Error(t('Video generation timed out. Please try again later.'))
}

export async function generateVideo(
  params: VideoParams,
  onProgress?: (status: VideoTaskStatus) => void
): Promise<{ requestId: string; url: string }> {
  const { taskId } = await submitVideoTask(params)
  return pollVideoTask(taskId, onProgress)
}
