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
import type { PhotoGenerationSnapshot, PhotoParams } from '../types'

const photoResultSrcCache = new Map<string, string>()

export function pickGenerationSnapshot(
  params: PhotoParams
): PhotoGenerationSnapshot {
  return {
    size: params.size,
    resolution: params.resolution,
    quality: params.quality,
    aspectRatio: params.aspectRatio,
    imageSize: params.imageSize,
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
