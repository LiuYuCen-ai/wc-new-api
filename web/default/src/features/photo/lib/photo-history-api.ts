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
import {
  hydratePhotoHistoryItem,
  hydratePhotoHistoryItems,
} from './photo-history-image'
import type { PhotoGenerationSnapshot, PhotoResult } from '../types'

const PHOTO_HISTORY_API_BASE = '/api/photo'

export type PhotoHistoryItem = {
  id: string
  prompt: string
  model: string
  status?: 'pending' | 'ready' | 'failed'
  created_at: string
  images: PhotoResult[]
  generationParams?: PhotoGenerationSnapshot
}

type PhotoHistoryImageDTO = {
  id: string
  mime_type?: string
  url: string
  b64?: string
  revised_prompt?: string
}

type PhotoHistoryDTO = {
  id: string
  prompt: string
  model: string
  status?: string
  created_at: number
  updated_at?: number
  generation_params?: PhotoGenerationSnapshot
  images: PhotoHistoryImageDTO[]
}

type ApiListResponse = {
  success: boolean
  data?: PhotoHistoryDTO[]
  message?: string
}

type ApiItemResponse = {
  success: boolean
  data?: PhotoHistoryDTO
  message?: string
}

function toPhotoResult(image: PhotoHistoryImageDTO): PhotoResult {
  return {
    url: image.b64 ? undefined : image.url,
    b64: image.b64,
    mimeType: image.mime_type,
    revisedPrompt: image.revised_prompt,
  }
}

function toPhotoHistoryItem(item: PhotoHistoryDTO): PhotoHistoryItem {
  const status = item.status === 'pending' || item.status === 'failed'
    ? item.status
    : 'ready'

  return {
    id: item.id,
    prompt: item.prompt,
    model: item.model,
    status,
    created_at: new Date(item.created_at * 1000).toISOString(),
    generationParams: item.generation_params,
    images: (item.images ?? []).map(toPhotoResult),
  }
}

function toImagePayload(image: PhotoResult) {
  return {
    b64: image.b64,
    url: image.url,
    mime_type: image.mimeType,
    revised_prompt: image.revisedPrompt,
  }
}

export async function fetchPhotoHistory(
  limit = 50
): Promise<PhotoHistoryItem[]> {
  try {
    const res = await api.get<ApiListResponse>(`${PHOTO_HISTORY_API_BASE}/history`, {
      params: { limit },
      skipErrorHandler: true,
    })
    if (!res.data?.success || !Array.isArray(res.data.data)) {
      return []
    }
    return hydratePhotoHistoryItems(res.data.data.map(toPhotoHistoryItem))
  } catch {
    return []
  }
}

export async function createPendingPhotoHistoryItem(input: {
  id: string
  prompt: string
  model: string
  generationParams?: PhotoGenerationSnapshot
}): Promise<PhotoHistoryItem | null> {
  try {
    const res = await api.post<ApiItemResponse>(
      `${PHOTO_HISTORY_API_BASE}/history`,
      {
        id: input.id,
        prompt: input.prompt,
        model: input.model,
        status: 'pending',
        generation_params: input.generationParams,
        images: [],
      },
      { skipErrorHandler: true }
    )
    if (!res.data?.success || !res.data.data) {
      return null
    }
    return toPhotoHistoryItem(res.data.data)
  } catch {
    return null
  }
}

export async function createPhotoHistoryItem(input: {
  id?: string
  prompt: string
  model: string
  created_at?: string
  images: PhotoResult[]
  generationParams?: PhotoGenerationSnapshot
}): Promise<PhotoHistoryItem | null> {
  try {
    const res = await api.post<ApiItemResponse>(`${PHOTO_HISTORY_API_BASE}/history`, {
      id: input.id,
      prompt: input.prompt,
      model: input.model,
      generation_params: input.generationParams,
      images: input.images.map(toImagePayload),
    }, { skipErrorHandler: true })
    if (!res.data?.success || !res.data.data) {
      return null
    }
    const item = toPhotoHistoryItem(res.data.data)
    return hydratePhotoHistoryItem(item, input.images)
  } catch {
    return null
  }
}

export async function appendPhotoHistoryImages(
  historyId: string,
  images: PhotoResult[],
  prompt?: string
): Promise<PhotoHistoryItem | null> {
  try {
    const res = await api.post<ApiItemResponse>(
      `${PHOTO_HISTORY_API_BASE}/history/${historyId}/images`,
      {
        prompt,
        images: images.map(toImagePayload),
      },
      { skipErrorHandler: true }
    )
    if (!res.data?.success || !res.data.data) {
      return null
    }
    const item = toPhotoHistoryItem(res.data.data)
    return hydratePhotoHistoryItem(item, images)
  } catch {
    return null
  }
}

export async function deletePhotoHistoryItem(historyId: string): Promise<boolean> {
  try {
    const res = await api.delete<{ success: boolean; message?: string }>(
      `${PHOTO_HISTORY_API_BASE}/history/${historyId}`,
      { skipErrorHandler: true }
    )
    return Boolean(res.data?.success)
  } catch {
    return false
  }
}
