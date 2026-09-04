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
  if (family === 'minimax') {
    if (key === '720P' || key === '1K') return '768P'
    if (key === '2K' || key === '4K') return '1080P'
    return key || '768P'
  }
  return resolution
}

function getSoraSize(params: VideoParams): string {
  const key = params.resolution.trim().toUpperCase()
  const isPro = /sora-2-pro/i.test(params.model)
  const highRes = isPro && (key === '1080P' || key === '2K')
  if (params.aspectRatio === '9:16') {
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
  const image = params.referenceImageUrl?.trim()

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

  if (family === 'minimax') {
    const body: Record<string, unknown> = {
      model,
      prompt,
      duration: seconds,
      resolution,
    }
    if (image) body.image = image
    return body
  }

  if (family === 'seedance') {
    const body: Record<string, unknown> = {
      model,
      prompt,
      seconds: String(seconds),
      duration: seconds,
      resolution,
      metadata: {
        ratio: params.aspectRatio,
        resolution,
        duration: seconds,
      },
    }
    if (image) body.image = image
    return body
  }

  if (family === 'kling') {
    const body: Record<string, unknown> = {
      model,
      prompt,
      duration: seconds,
      metadata: {
        duration: seconds,
        aspect_ratio: params.aspectRatio,
        mode: 'std',
      },
    }
    if (image) body.image = image
    return body
  }

  const edge = getGenericVideoEdge(resolution)
  let size = `${Math.round((edge * 16) / 9)}x${edge}`
  if (params.aspectRatio === '9:16') {
    size = `${edge}x${Math.round((edge * 16) / 9)}`
  } else if (params.aspectRatio === '1:1') {
    size = `${edge}x${edge}`
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    seconds: String(seconds),
    duration: seconds,
    size,
    resolution,
    metadata: {
      ratio: params.aspectRatio,
      resolution,
      duration: seconds,
    },
  }
  if (image) body.image = image
  return body
}
