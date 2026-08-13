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
import type { PhotoGenerationSnapshot, PhotoParams, PhotoResult } from '../types'

const SESSION_KEY = 'photo_generation_jobs_v1'
const MAX_JOB_AGE_MS = 30 * 60 * 1000

export type PersistedPhotoGenerationJob = {
  id: string
  historyId: string
  userId: number
  count: number
  prompt: string
  model: string
  phase: 'generating' | 'saving'
  params: PhotoParams
  generationParams?: PhotoGenerationSnapshot
  startedAt: number
  resultImages?: PhotoResult[]
}

type SessionPayload = {
  jobs: PersistedPhotoGenerationJob[]
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
    // sessionStorage may be full for large image payloads; best-effort only.
  }
}

function pruneExpiredJobs(jobs: PersistedPhotoGenerationJob[]) {
  const now = Date.now()
  return jobs.filter((job) => now - job.startedAt <= MAX_JOB_AGE_MS)
}

export function loadPersistedPhotoJobs(
  userId: number
): PersistedPhotoGenerationJob[] {
  const payload = readPayload()
  const jobs = pruneExpiredJobs(payload.jobs).filter(
    (job) => job.userId === userId
  )
  if (jobs.length !== payload.jobs.length) {
    writePayload({ jobs })
  }
  return jobs
}

export function upsertPersistedPhotoJob(job: PersistedPhotoGenerationJob) {
  const payload = readPayload()
  const jobs = pruneExpiredJobs(payload.jobs)
  const existing = jobs.find((item) => item.historyId === job.historyId)
  const merged = existing
    ? {
        ...existing,
        ...job,
        id: existing.id,
        startedAt: existing.startedAt,
      }
    : job
  writePayload({
    jobs: [...jobs.filter((item) => item.historyId !== job.historyId), merged],
  })
}

export function removePersistedPhotoJob(historyId: string) {
  const payload = readPayload()
  const jobs = payload.jobs.filter((item) => item.historyId !== historyId)
  writePayload({ jobs })
}

export function clearPersistedPhotoJobsForUser(userId: number) {
  const payload = readPayload()
  writePayload({
    jobs: payload.jobs.filter((item) => item.userId !== userId),
  })
}

export function pendingJobsToUiState(jobs: PersistedPhotoGenerationJob[]) {
  return jobs
    .filter((job) => job.phase === 'generating' || job.phase === 'saving')
    .map((job) => ({
      id: job.id,
      count: job.count,
      historyId: job.historyId,
    }))
}
