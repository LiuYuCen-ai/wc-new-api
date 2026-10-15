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
import {
  clampSeedreamCustomSize,
  isSeedreamAspectRatio,
  parseAspectRatioParts,
  parsePixelSize,
  resolvePhotoSize,
} from '../constants'
import type { PhotoGenerationSnapshot, PhotoParams } from '../types'

const photoResultSrcCache = new Map<string, string>()

export function pickGenerationSnapshot(
  params: PhotoParams
): PhotoGenerationSnapshot {
  return {
    size: params.size,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
    customWidth: params.customWidth,
    customHeight: params.customHeight,
  }
}

export function applyPhotoGeometry(
  params: PhotoParams,
  patch: Partial<PhotoParams>
): PhotoParams {
  const requestedSize = String(
    patch.imageSize ?? patch.resolution ?? params.imageSize ?? ''
  ).trim()
  const imageSize = requestedSize || params.imageSize
  const requestedRatio = patch.aspectRatio ?? params.aspectRatio
  const aspectRatio = isSeedreamAspectRatio(requestedRatio)
    ? requestedRatio
    : params.aspectRatio

  if (imageSize !== 'custom') {
    return {
      ...params,
      ...patch,
      imageSize,
      resolution: imageSize,
      aspectRatio,
      customWidth: params.customWidth ?? 2048,
      customHeight: params.customHeight ?? 2048,
      size: resolvePhotoSize(imageSize, aspectRatio, {
        width: params.customWidth,
        height: params.customHeight,
      }),
    }
  }

  const switchingToCustom = params.imageSize !== 'custom'
  const presetPixels = parsePixelSize(params.size)
  let customWidth = patch.customWidth ?? params.customWidth ?? 2048
  let customHeight = patch.customHeight ?? params.customHeight ?? 2048

  if (switchingToCustom && presetPixels) {
    customWidth = patch.customWidth ?? presetPixels.width
    customHeight = patch.customHeight ?? presetPixels.height
  } else if (
    patch.aspectRatio &&
    patch.customWidth === undefined &&
    patch.customHeight === undefined
  ) {
    const { w, h } = parseAspectRatioParts(aspectRatio)
    const longEdge = Math.max(customWidth || 2048, customHeight || 2048)
    if (w >= h) {
      customWidth = longEdge
      customHeight = (longEdge * h) / w
    } else {
      customHeight = longEdge
      customWidth = (longEdge * w) / h
    }
  } else if (
    patch.customWidth !== undefined &&
    patch.customHeight === undefined
  ) {
    const { w, h } = parseAspectRatioParts(aspectRatio)
    customHeight = (patch.customWidth * h) / w
  } else if (
    patch.customHeight !== undefined &&
    patch.customWidth === undefined
  ) {
    const { w, h } = parseAspectRatioParts(aspectRatio)
    customWidth = (patch.customHeight * w) / h
  }

  const clamped = clampSeedreamCustomSize(customWidth, customHeight)
  return {
    ...params,
    ...patch,
    imageSize: 'custom',
    resolution: 'custom',
    aspectRatio,
    customWidth: clamped.width,
    customHeight: clamped.height,
    size: `${clamped.width}x${clamped.height}`,
  }
}

export function buildPhotoBase64DataUrl(
  b64: string,
  mimeType?: string
): string {
  const normalized = b64.trim()
  if (!normalized) return ''
  if (normalized.startsWith('data:')) return normalized

  const type = mimeType?.trim() || 'image/png'
  return `data:${type};base64,${normalized}`
}

function getPhotoResultCacheKey(image: {
  id?: string
  b64?: string
}): string | null {
  if (image.id) return `id:${image.id}`
  if (image.b64) return `b64:${image.b64.slice(0, 96)}`
  return null
}

export function getPhotoResultSrc(image: {
  id?: string
  url?: string
  b64?: string
  mimeType?: string
}): string {
  if (!image.b64) return ''

  const cacheKey = getPhotoResultCacheKey(image)
  if (cacheKey) {
    const cached = photoResultSrcCache.get(cacheKey)
    if (cached) return cached
  }

  const dataUrl = buildPhotoBase64DataUrl(image.b64, image.mimeType)
  if (cacheKey && dataUrl) {
    photoResultSrcCache.set(cacheKey, dataUrl)
  }
  return dataUrl
}

export function isUpstreamSensitiveError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('new_sensitive') ||
    lower.includes('text sensitive') ||
    lower.includes('image sensitive') ||
    lower.includes('sensitive information') ||
    lower.includes('inputtextsensitive') ||
    lower.includes('outputimagesensitive')
  )
}

export function rememberPhotoResultSrc(
  image: { id?: string; b64?: string; mimeType?: string },
  dataUrl: string
): string {
  const normalized = dataUrl.trim()
  if (!normalized) return ''

  const cacheKey = getPhotoResultCacheKey(image)
  if (cacheKey) {
    photoResultSrcCache.set(cacheKey, normalized)
  }
  return normalized
}
