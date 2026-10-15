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
import { normalizeVideoAspectRatio, videoReferenceUrls } from './video-request'
import type { VideoHistoryItem, VideoTaskStatus } from '../types'

export type UserVideoTask = {
  id?: number | string
  task_id?: string
  platform?: string
  action?: string
  status?: string
  result_url?: string
  fail_reason?: string
  created_at?: number
  submit_time?: number
  properties?: {
    input?: string
    origin_model_name?: string
    upstream_model_name?: string
  }
  data?: unknown
}

const VIDEO_ACTIONS = new Set([
  'generate',
  'textGenerate',
  'firstTailGenerate',
  'referenceGenerate',
  'remixGenerate',
])

const VIDEO_MODEL_HINT =
  /sora|hailuo|seedance|kling|jimeng|vidu|runway|luma|pika|minimax|t2v|i2v|s2v/

export const VIDEO_TASK_PAGE_SIZE = 50
const VIDEO_HISTORY_CACHE_LIMIT = 50

function looksLikeMediaUrl(value?: string): boolean {
  if (!value) return false
  return /^(https?:\/\/|\/v1\/videos\/|data:)/i.test(value.trim())
}

export function isVideoGenerationTask(task: UserVideoTask): boolean {
  const platform = String(task.platform ?? '').toLowerCase()
  if (platform === 'suno' || platform === 'mj') return false

  const action = String(task.action ?? '')
  if (VIDEO_ACTIONS.has(action)) return true
  if (looksLikeMediaUrl(task.result_url)) return true

  const model = videoTaskModel(task).toLowerCase()
  return VIDEO_MODEL_HINT.test(model)
}

function videoTaskModel(task: UserVideoTask): string {
  return (
    task.properties?.origin_model_name ||
    task.properties?.upstream_model_name ||
    ''
  )
}

export function videoPlaybackUrl(task: UserVideoTask): string | undefined {
  const resultUrl = task.result_url?.trim()
  if (looksLikeMediaUrl(resultUrl)) return resultUrl
  const failReason = task.fail_reason?.trim()
  if (looksLikeMediaUrl(failReason)) return failReason
  const taskId = task.task_id?.trim()
  if (taskId && isSuccessStatus(task.status)) {
    return `/v1/videos/${encodeURIComponent(taskId)}/content`
  }
  return undefined
}

export function toVideoHistoryItem(task: UserVideoTask): VideoHistoryItem | null {
  const taskId = task.task_id?.trim()
  if (!taskId || !isVideoGenerationTask(task)) return null

  const createdAt = Number(task.created_at || task.submit_time || 0)
  let recordId: string | undefined
  if (typeof task.id === 'number' && Number.isFinite(task.id)) {
    recordId = String(task.id)
  } else if (typeof task.id === 'string' && task.id.trim()) {
    recordId = task.id.trim()
  }
  const deleteIds = uniqueVideoIds([
    taskId,
    recordId,
    ...collectTaskAliasIds(task.data),
  ])
  const referenceImageUrls = extractReferenceMediaUrls(task, [
    'reference_images',
    'reference_image',
    'first_frame_image',
    'image',
  ])
  const referenceVideoUrls = extractReferenceMediaUrls(task, [
    'video_urls',
    'video_url',
  ])
  const referenceAudioUrl = extractReferenceMediaUrl(task, ['audio_url'])
  return {
    id: taskId,
    requestId: taskId,
    ...(recordId ? { recordId } : {}),
    deleteIds,
    status: mapTaskStatus(task.status),
    url: videoPlaybackUrl(task),
    prompt: extractVideoPrompt(task),
    model: videoTaskModel(task),
    duration: extractVideoDuration(task),
    aspectRatio: extractVideoAspectRatio(task),
    resolution: extractVideoResolution(task),
    ...(referenceImageUrls.length > 0 ? { referenceImageUrls } : {}),
    ...(referenceVideoUrls.length > 0 ? { referenceVideoUrls } : {}),
    ...(referenceAudioUrl ? { referenceAudioUrl } : {}),
    createdAt: createdAt > 1_000_000_000_000 ? createdAt : createdAt * 1000,
  }
}

export function videoTaskDeleteIds(item: VideoHistoryItem): string[] {
  return uniqueVideoIds([
    item.requestId,
    item.id,
    item.recordId,
    ...(item.deleteIds ?? []),
  ])
}

export function remoteContainsVideoWork(
  remote: VideoHistoryItem[],
  item: Pick<VideoHistoryItem, 'id' | 'requestId' | 'recordId' | 'deleteIds' | 'url'>
): boolean {
  const keys = new Set(workIdentityKeys(item))
  return remote.some((entry) =>
    workIdentityKeys(entry).some((key) => keys.has(key))
  )
}

export function mergeVideoHistory(
  remote: VideoHistoryItem[],
  local: VideoHistoryItem[]
): VideoHistoryItem[] {
  const byKey = new Map<string, VideoHistoryItem>()
  const add = (item: VideoHistoryItem) => {
    let existing: VideoHistoryItem | undefined
    for (const key of workIdentityKeys(item)) {
      existing = byKey.get(key)
      if (existing) break
    }
    const merged = existing ? mergeVideoHistoryItems(existing, item) : item
    for (const key of [
      ...workIdentityKeys(existing ?? item),
      ...workIdentityKeys(item),
      ...workIdentityKeys(merged),
    ]) {
      byKey.set(key, merged)
    }
  }
  for (const item of remote) {
    add(item)
  }
  for (const item of local) {
    add(item)
  }

  return [...new Set(byKey.values())].sort(
    (a, b) => b.createdAt - a.createdAt
  )
}

export function cacheVideoHistory(
  items: VideoHistoryItem[]
): VideoHistoryItem[] {
  return items.slice(0, VIDEO_HISTORY_CACHE_LIMIT)
}

export function hasMoreTaskPages(
  page: number,
  pageSize: number,
  total: number
): boolean {
  if (page < 1 || pageSize < 1 || total < 1) return false
  return page * pageSize < total
}

const LOCAL_PENDING_MS = 2 * 60 * 1000

export function syncVideoHistoryFromRemote(
  remote: VideoHistoryItem[],
  local: VideoHistoryItem[],
  now = Date.now()
): VideoHistoryItem[] {
  const remoteKeys = new Set(remote.flatMap((item) => workIdentityKeys(item)))
  const usableLocal = local.filter((item) => {
    if (workIdentityKeys(item).some((key) => remoteKeys.has(key))) return true
    return now - item.createdAt < LOCAL_PENDING_MS
  })
  return mergeVideoHistory(remote, usableLocal)
}

export function excludeRemovedVideoHistory(
  items: VideoHistoryItem[],
  removedIds: Iterable<string>
): VideoHistoryItem[] {
  const removed = new Set<string>()
  for (const id of removedIds) {
    const trimmed = id.trim()
    if (trimmed) removed.add(trimmed)
  }
  if (removed.size === 0) return items
  return items.filter(
    (item) => !removed.has(item.requestId) && !removed.has(item.id)
  )
}

function isSuccessStatus(status?: string): boolean {
  const key = String(status ?? '').toUpperCase()
  return key === 'SUCCESS' || key === 'SUCCEEDED' || key === 'DONE'
}

function mapTaskStatus(status?: string): VideoTaskStatus {
  switch (String(status ?? '').toUpperCase()) {
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'DONE':
    case 'COMPLETED':
      return 'done'
    case 'FAILURE':
    case 'FAILED':
    case 'CANCELLED':
      return 'failed'
    case 'SUBMITTED':
    case 'QUEUED':
    case 'PENDING':
    case 'NOT_START':
      return 'queued'
    default:
      return 'processing'
  }
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const parsed = JSON.parse(value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return null
  }
  return null
}

function uniqueVideoIds(ids: Array<string | undefined>): string[] {
  const unique: string[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    const trimmed = id?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    unique.push(trimmed)
  }
  return unique
}

function workIdentityKeys(
  item: Pick<
    VideoHistoryItem,
    'id' | 'requestId' | 'recordId' | 'deleteIds' | 'url'
  >
): string[] {
  const keys = uniqueVideoIds([
    item.requestId,
    item.id,
    item.recordId,
    ...(item.deleteIds ?? []),
  ]).map((id) => `id:${id}`)
  const url = item.url?.trim()
  if (url && looksLikeMediaUrl(url)) {
    keys.push(`url:${url}`)
  }
  return keys
}

function collectTaskAliasIds(data: unknown): string[] {
  const record = parseRecord(data)
  if (!record) return []
  const task = parseRecord(record.task)
  return uniqueVideoIds([
    asTrimmedString(record.id),
    asTrimmedString(record.task_id),
    asTrimmedString(record.taskId),
    asTrimmedString(task?.id),
    asTrimmedString(task?.task_id),
    asTrimmedString(task?.taskId),
  ])
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function mergeVideoHistoryItems(
  preferred: VideoHistoryItem,
  extra: VideoHistoryItem
): VideoHistoryItem {
  return {
    ...preferred,
    prompt: preferred.prompt || extra.prompt,
    model: preferred.model || extra.model,
    duration: preferred.duration || extra.duration,
    aspectRatio: extra.aspectRatio || preferred.aspectRatio,
    resolution: preferred.resolution || extra.resolution,
    url: preferred.url || extra.url,
    referenceImageUrls: mergedReferenceUrls(
      preferred.referenceImageUrls,
      extra.referenceImageUrls,
      preferred.referenceImageUrl,
      extra.referenceImageUrl
    ),
    referenceVideoUrls: mergedReferenceUrls(
      preferred.referenceVideoUrls,
      extra.referenceVideoUrls,
      preferred.referenceVideoUrl,
      extra.referenceVideoUrl
    ),
    referenceAudioUrl: preferred.referenceAudioUrl || extra.referenceAudioUrl,
    recordId: preferred.recordId || extra.recordId,
    deleteIds: uniqueVideoIds([
      ...(preferred.deleteIds ?? []),
      ...(extra.deleteIds ?? []),
      preferred.id,
      preferred.requestId,
      extra.id,
      extra.requestId,
      preferred.recordId,
      extra.recordId,
    ]),
  }
}

function extractVideoPrompt(task: UserVideoTask): string {
  const data = parseRecord(task.data)
  const nestedTask = parseRecord(data?.task)
  const input = parseRecord(task.properties?.input)
  const candidates = [
    data?.prompt,
    nestedTask?.prompt,
    input?.prompt,
    input?.text,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  if (Array.isArray(input?.content)) {
    for (const item of input.content) {
      const record = parseRecord(item)
      if (typeof record?.text === 'string' && record.text.trim()) {
        return record.text.trim()
      }
    }
  }
  const rawInput = task.properties?.input?.trim()
  return rawInput && !rawInput.startsWith('{') ? rawInput : ''
}

function extractVideoDuration(task: UserVideoTask): string {
  const data = parseRecord(task.data)
  const nestedTask = parseRecord(data?.task)
  const metadata = parseRecord(data?.metadata)
  const value =
    data?.duration ??
    nestedTask?.duration ??
    data?.seconds ??
    metadata?.duration
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return ''
}

function extractVideoAspectRatio(task: UserVideoTask): string {
  const data = parseRecord(task.data)
  const nestedTask = parseRecord(data?.task)
  const metadata = parseRecord(data?.metadata)
  const value = String(
    metadata?.ratio ??
      metadata?.aspect_ratio ??
      data?.ratio ??
      data?.aspect_ratio ??
      nestedTask?.ratio ??
      ''
  )
  return normalizeVideoAspectRatio(value) ?? '16:9'
}

function extractVideoResolution(task: UserVideoTask): string {
  const data = parseRecord(task.data)
  const metadata = parseRecord(data?.metadata)
  const value = metadata?.resolution ?? data?.resolution
  return typeof value === 'string' ? value : ''
}

function extractReferenceMediaUrl(
  task: UserVideoTask,
  keys: string[]
): string | undefined {
  return extractReferenceMediaUrls(task, keys)[0]
}

function extractReferenceMediaUrls(
  task: UserVideoTask,
  keys: string[]
): string[] {
  const data = parseRecord(task.data)
  const metadata = parseRecord(data?.metadata)
  return videoReferenceUrls(
    ...keys.map((key) => metadata?.[key] ?? data?.[key])
  )
}

function mergedReferenceUrls(
  ...values: Array<string[] | string | undefined>
): string[] | undefined {
  const urls = videoReferenceUrls(...values)
  return urls.length > 0 ? urls : undefined
}
