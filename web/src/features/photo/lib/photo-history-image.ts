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
import { api } from '@/lib/api'
import { getPhotoResultSrc, rememberPhotoResultSrc } from './photo-utils'
import type { PhotoResult } from '../types'

const PHOTO_HISTORY_IMAGE_PREFIX = '/api/photo/images/'
const dataUrlCache = new Map<string, string>()

export function isPhotoHistoryImageUrl(url?: string): boolean {
  return Boolean(url?.startsWith(PHOTO_HISTORY_IMAGE_PREFIX))
}

function parseDataUrl(dataUrl: string): { mimeType: string; b64: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  return { mimeType: match[1], b64: match[2] }
}

export async function fetchPhotoHistoryImageDataUrl(
  url: string
): Promise<string | null> {
  if (!isPhotoHistoryImageUrl(url)) return url || null
  if (dataUrlCache.has(url)) return dataUrlCache.get(url)!

  try {
    const res = await api.get<Blob>(url, {
      responseType: 'blob',
      skipErrorHandler: true,
    })
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(res.data)
    })
    dataUrlCache.set(url, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

export async function hydratePhotoResult(image: PhotoResult): Promise<PhotoResult> {
  if (image.b64) return image
  if (!isPhotoHistoryImageUrl(image.url)) return image

  const dataUrl = await fetchPhotoHistoryImageDataUrl(image.url!)
  if (!dataUrl) return image

  const parsed = parseDataUrl(dataUrl)
  if (!parsed) return image

  const hydrated = {
    ...image,
    id: image.id,
    b64: parsed.b64,
    mimeType: parsed.mimeType || image.mimeType,
    url: undefined,
  }
  rememberPhotoResultSrc(hydrated, dataUrl)
  return hydrated
}

export async function resolvePhotoHistoryImageSrc(
  image: PhotoResult
): Promise<string> {
  const existing = getPhotoResultSrc(image)
  if (existing) return existing

  const hydrated = await hydratePhotoResult(image)
  return getPhotoResultSrc(hydrated)
}

export async function hydratePhotoResults(
  images: PhotoResult[]
): Promise<PhotoResult[]> {
  return Promise.all(images.map((image) => hydratePhotoResult(image)))
}


export async function hydratePhotoHistoryItem<
  T extends { images: PhotoResult[] },
>(item: T, inlineImages?: PhotoResult[]): Promise<T> {
  let images = item.images
  if (inlineImages?.length) {
    const tailStart = Math.max(0, images.length - inlineImages.length)
    images = images.map((image, index) => {
      if (index < tailStart) return image
      const source = inlineImages[index - tailStart]
      if (source?.b64) {
        return {
          ...image,
          b64: source.b64,
          mimeType: source.mimeType || image.mimeType,
          url: undefined,
        }
      }
      return image
    })
  }

  return {
    ...item,
    images: await hydratePhotoResults(images),
  }
}

export async function hydratePhotoHistoryItems<
  T extends { images: PhotoResult[] },
>(items: T[]): Promise<T[]> {
  return Promise.all(items.map((item) => hydratePhotoHistoryItem(item)))
}
