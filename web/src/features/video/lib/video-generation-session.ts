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
import { videoReferenceUrls } from './video-request'
import type { VideoHistoryItem, VideoParams, VideoTaskStatus } from '../types'

const SESSION_KEY = 'video_generation_jobs_v1'
const MAX_JOB_AGE_MS = 30 * 60 * 1000

export type PersistedVideoGenerationJob = {
  id: string
  userId: number
  taskId?: string
  params: VideoParams
  status: VideoTaskStatus
  startedAt: number
}

type SessionPayload = {
  jobs: PersistedVideoGenerationJob[]
}

function readPayload(): SessionPayload {
  if (typeof window === 'undefined') return { jobs: [] }
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return { jobs: [] }
    const parsed = JSON.parse(raw) as SessionPayload
    if (!Array.isArray(parsed.jobs)) return { jobs: [] }
    return parsed
  } catch {
    return { jobs: [] }
  }
}

function writePayload(payload: SessionPayload) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage may be unavailable; keep going in memory.
  }
}

function pruneExpiredJobs(jobs: PersistedVideoGenerationJob[]) {
  const now = Date.now()
  return jobs.filter((job) => now - job.startedAt <= MAX_JOB_AGE_MS)
}

export function loadPersistedVideoJobs(
  userId: number
): PersistedVideoGenerationJob[] {
  const payload = readPayload()
  const jobs = pruneExpiredJobs(payload.jobs).filter(
    (job) => job.userId === userId
  )
  if (jobs.length !== payload.jobs.length) {
    writePayload({ jobs })
  }
  return jobs
}

export function upsertPersistedVideoJob(job: PersistedVideoGenerationJob) {
  const payload = readPayload()
  const jobs = pruneExpiredJobs(payload.jobs)
  const existing = jobs.find((item) => item.id === job.id)
  const merged = existing
    ? {
        ...existing,
        ...job,
        startedAt: existing.startedAt,
      }
    : job
  writePayload({
    jobs: [...jobs.filter((item) => item.id !== job.id), merged],
  })
}

export function removePersistedVideoJob(jobId: string) {
  const payload = readPayload()
  writePayload({
    jobs: payload.jobs.filter((item) => item.id !== jobId),
  })
}

export function pendingVideoJobsToHistoryItems(
  jobs: PersistedVideoGenerationJob[]
): VideoHistoryItem[] {
  return [...jobs]
    .sort((left, right) => right.startedAt - left.startedAt)
    .map((job) => ({
      id: job.id,
      requestId: job.taskId ?? job.id,
      status: job.status,
      prompt: job.params.prompt,
      model: job.params.model,
      duration: job.params.duration,
      aspectRatio: job.params.aspectRatio,
      resolution: job.params.resolution,
      referenceImageUrls: videoReferenceUrls(
        job.params.referenceImageUrls,
        job.params.referenceImageUrl
      ),
      referenceVideoUrls: videoReferenceUrls(
        job.params.referenceVideoUrls,
        job.params.referenceVideoUrl
      ),
      referenceAudioUrl: job.params.referenceAudioUrl,
      createdAt: job.startedAt,
    }))
}
