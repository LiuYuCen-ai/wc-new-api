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
import { VIDEO_GENERATION_ENDPOINT } from '@/features/photo/lib/photo-models'

import type { VideoParams } from '../types'

export type VideoModelFamily =
  | 'sora'
  | 'minimax'
  | 'seedance'
  | 'kling'
  | 'generic'

const HAILUO_DURATIONS = [6, 10] as const
const ASPECT_RATIO_PATTERN = /^(\d{1,4})\s*[:/x×]\s*(\d{1,4})$/i
const MAX_ASPECT_SIDE = 100

export const MAX_VIDEO_REFERENCE_IMAGES = 9
export const MAX_VIDEO_REFERENCE_VIDEOS = 3

export function videoReferenceUrls(...values: unknown[]): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  const add = (value: unknown) => {
    if (typeof value === 'string') {
      const url = value.trim()
      if (!url || seen.has(url)) return
      seen.add(url)
      urls.push(url)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) add(item)
    }
  }
  for (const value of values) add(value)
  return urls
}

export function normalizeVideoAspectRatio(value: string): string | null {
  const match = ASPECT_RATIO_PATTERN.exec(
    value.trim().replaceAll('：', ':')
  )
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > MAX_ASPECT_SIDE ||
    height > MAX_ASPECT_SIDE
  ) {
    return null
  }
  return `${width}:${height}`
}

function aspectRatioParts(aspectRatio: string): { w: number; h: number } {
  const normalized = normalizeVideoAspectRatio(aspectRatio) ?? '16:9'
  const [width, height] = normalized.split(':')
  return { w: Number(width), h: Number(height) }
}

export function resolveVideoModelFamily(modelId: string): VideoModelFamily {
  const name = modelId.trim().toLowerCase()
  if (/sora/.test(name)) return 'sora'
  if (/hailuo|minimax-h3|t2v-|i2v-|s2v-/.test(name)) return 'minimax'
  if (/seedance|doubao.*video|jimeng/.test(name)) return 'seedance'
  if (/kling/.test(name)) return 'kling'
  return 'generic'
}

export function defaultVideoDuration(modelId: string): number {
  const family = resolveVideoModelFamily(modelId)
  if (family === 'minimax') return 6
  if (family === 'sora') return 4
  return 5
}

export function snapVideoDuration(modelId: string, duration: number): number {
  const family = resolveVideoModelFamily(modelId)
  if (family !== 'minimax') return duration
  if (/minimax-h3/.test(modelId.trim().toLowerCase())) {
    if (duration < 4) return 4
    if (duration > 15) return 15
    return duration
  }
  let nearest: number = HAILUO_DURATIONS[0]
  for (const allowed of HAILUO_DURATIONS) {
    if (Math.abs(allowed - duration) < Math.abs(nearest - duration)) {
      nearest = allowed
    }
  }
  return nearest
}

export function snapVideoResolution(
  modelId: string,
  resolution: string
): string {
  const family = resolveVideoModelFamily(modelId)
  const key = resolution.trim().toUpperCase()
  if (family !== 'minimax') return resolution
  // MiniMax-H3 official tiers are 768P and 2K. Legacy Hailuo models use 768P / 1080P.
  if (/minimax-h3/.test(modelId.trim().toLowerCase())) {
    if (key === '720P' || key === '1K') return '768P'
    if (key === '1080P' || key === '4K') return '2K'
    return key || '768P'
  }
  if (key === '720P' || key === '1K') return '768P'
  if (key === '2K' || key === '4K') return '1080P'
  return key || '768P'
}

function getSoraSize(params: VideoParams): string {
  const key = params.resolution.trim().toUpperCase()
  const isPro = /sora-2-pro/i.test(params.model)
  const highRes = isPro && (key === '1080P' || key === '2K')
  const { w, h } = aspectRatioParts(params.aspectRatio)
  if (h > w) {
    if (highRes) return '1024x1792'
    return '720x1280'
  }
  if (highRes) return '1792x1024'
  return '1280x720'
}

function getGenericVideoEdge(resolution: string): number {
  const key = resolution.trim().toUpperCase()
  if (key === '4K') return 2160
  if (key === '1080P' || key === '2K') return 1080
  return 720
}

export function videoPixelSize(resolution: string, aspectRatio: string): string {
  const edge = getGenericVideoEdge(resolution)
  const { w, h } = aspectRatioParts(aspectRatio)
  if (w === h) return `${edge}x${edge}`
  if (w > h) return `${Math.round((edge * w) / h)}x${edge}`
  return `${edge}x${Math.round((edge * h) / w)}`
}

export function isVideoCapableModel(
  modelId: string,
  endpointTypes: string[] = []
): boolean {
  if (endpointTypes.includes(VIDEO_GENERATION_ENDPOINT)) return true
  if (endpointTypes.length === 0) return true
  return resolveVideoModelFamily(modelId) !== 'generic'
}

export function buildVideoSubmitBody(
  params: VideoParams,
  duration: number
): Record<string, unknown> {
  const family = resolveVideoModelFamily(params.model)
  const prompt = params.prompt.trim()
  const model = params.model.trim()
  const resolution = snapVideoResolution(model, params.resolution)
  const seconds = snapVideoDuration(model, duration)
  const images = videoReferenceUrls(
    params.referenceImageUrls,
    params.referenceImageUrl
  ).slice(0, MAX_VIDEO_REFERENCE_IMAGES)
  const videos = videoReferenceUrls(
    params.referenceVideoUrls,
    params.referenceVideoUrl
  ).slice(0, MAX_VIDEO_REFERENCE_VIDEOS)
  const audio = params.referenceAudioUrl?.trim()
  const image = images[0]

  if (family === 'sora') {
    const body: Record<string, unknown> = {
      model,
      prompt,
      seconds: String(seconds),
      size: getSoraSize({ ...params, resolution }),
    }
    if (image) body.input_reference = image
    return body
  }

  const ratio = normalizeVideoAspectRatio(params.aspectRatio) ?? '16:9'

  if (family === 'minimax') {
    const metadata: Record<string, unknown> = {
      ratio,
      aspect_ratio: ratio,
      resolution,
      duration: seconds,
    }
    const useReferenceRoles =
      videos.length > 0 || Boolean(audio) || images.length > 1
    if (videos.length > 0) metadata.video_urls = videos
    if (audio) metadata.audio_url = audio
    if (useReferenceRoles && images.length > 0) {
      metadata.reference_images = images
    }
    const body: Record<string, unknown> = {
      model,
      prompt,
      duration: seconds,
      resolution,
      ratio,
      metadata,
    }
    if (!useReferenceRoles && images.length === 1) body.image = images[0]
    return body
  }

  if (family === 'seedance') {
    const metadata: Record<string, unknown> = {
      ratio,
      resolution,
      duration: seconds,
    }
    if (videos.length > 0) metadata.video_urls = videos
    if (audio) metadata.audio_url = audio
    const body: Record<string, unknown> = {
      model,
      prompt,
      seconds: String(seconds),
      duration: seconds,
      resolution,
      metadata,
    }
    if (image) body.image = image
    if (images.length > 1) body.images = images
    return body
  }

  if (family === 'kling') {
    const metadata: Record<string, unknown> = {
      duration: seconds,
      aspect_ratio: ratio,
      mode: 'std',
    }
    if (videos.length > 0) metadata.video_urls = videos
    if (audio) metadata.audio_url = audio
    const body: Record<string, unknown> = {
      model,
      prompt,
      duration: seconds,
      metadata,
    }
    if (image) body.image = image
    return body
  }

  const metadata: Record<string, unknown> = {
    ratio,
    resolution,
    duration: seconds,
  }
  if (videos.length > 0) metadata.video_urls = videos
  if (audio) metadata.audio_url = audio
  const body: Record<string, unknown> = {
    model,
    prompt,
    seconds: String(seconds),
    duration: seconds,
    size: videoPixelSize(resolution, ratio),
    resolution,
    metadata,
  }
  if (image) body.image = image
  if (images.length > 1) body.images = images
  return body
}
