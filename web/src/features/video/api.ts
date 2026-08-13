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

import type { VideoParams, VideoTaskStatus } from './types'

type PlatformSubmitResponse = {
  id?: string
  task_id?: string
  taskId?: string
  request_id?: string
  data?: PlatformSubmitResponse
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
}

function getVideoSize(params: VideoParams): string {
  const edge = params.resolution === '1080p' ? 1080 : 720
  if (params.aspectRatio === '9:16')
    return `${edge}x${Math.round((edge * 16) / 9)}`
  if (params.aspectRatio === '1:1') return `${edge}x${edge}`
  return `${Math.round((edge * 16) / 9)}x${edge}`
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

export async function submitVideoTask(
  params: VideoParams
): Promise<{ taskId: string }> {
  const body: Record<string, unknown> = {
    model: params.model.trim(),
    prompt: params.prompt.trim(),
    seconds: params.duration,
    size: getVideoSize(params),
  }
  if (params.referenceImageUrl) {
    body.image = params.referenceImageUrl.trim()
  }

  const res = await api.post<PlatformSubmitResponse>('/pg/videos', body)
  const response = res.data.data || res.data
  const taskId =
    response.task_id || response.id || response.taskId || response.request_id
  if (!taskId) {
    throw new Error(
      t('Video task was submitted, but the platform did not return a task ID.')
    )
  }
  return { taskId }
}

export async function queryVideoTask(taskId: string): Promise<{
  status: VideoTaskStatus
  progress: number
  videoUrl?: string
  error?: string
}> {
  const res = await api.get<PlatformQueryResponse>(
    `/pg/videos/${encodeURIComponent(taskId)}`,
    { disableDuplicate: true }
  )
  const record = res.data.data
  if (!record) {
    throw new Error(t('The platform did not return video task data.'))
  }
  return {
    status: normalizeStatus(record.status),
    progress: Number.parseInt(record.progress || '0', 10) || 0,
    videoUrl: record.result_url,
    error: record.fail_reason,
  }
}

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 10 * 60 * 1000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function generateVideo(
  params: VideoParams,
  onProgress?: (status: VideoTaskStatus) => void
): Promise<{ requestId: string; url: string }> {
  const { taskId } = await submitVideoTask(params)

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
