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
import { API_ENDPOINTS } from '@/features/playground/constants'
import { resolvePhotoSize } from './constants'
import { resolvePhotoCallKind } from './lib/photo-models'
import type { PhotoParams, PhotoResult } from './types'

export type GeneratePhotoResponse = {
  images: PhotoResult[]
  usage?: {
    total_tokens?: number
    quota_used?: number
  }
}

/**
 * Generate photos through the API that matches the model's endpoint type:
 * `/pg/images/generations` (or edits) for `image-generation`, and
 * `/pg/chat/completions` for Gemini native image models.
 */
export async function generatePhoto(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const callKind = resolvePhotoCallKind(params.model, params.endpointTypes)
  if (callKind === 'gemini-chat') {
    return generateViaGeminiChat(params)
  }
  return generateViaImagesApi(params)
}

function getImageInputUrls(params: PhotoParams): string[] {
  if (!params.imageUrlEnabled) return []
  return params.imageDataUrls
    .map((img) => img.dataUrl?.trim())
    .filter((url): url is string => Boolean(url))
}

function extractApiErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const record = data as {
    error?: { message?: string }
    message?: string
  }
  return record.error?.message ?? record.message
}

function parseOpenAIImageList(data: unknown): PhotoResult[] {
  const list = (data as { data?: unknown[] })?.data ?? []
  const images: PhotoResult[] = []
  if (!Array.isArray(list)) return images

  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const it = item as {
      b64_json?: string
      url?: string
      revised_prompt?: string
    }
    if (!it.b64_json && !it.url) continue
    images.push({
      b64: it.b64_json,
      url: it.url,
      revisedPrompt: it.revised_prompt,
    })
  }
  return images
}

async function generateViaImagesApi(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const imageInputUrls = getImageInputUrls(params)
  const isImageToImage = imageInputUrls.length > 0
  const size = resolvePhotoSize(params.imageSize, params.aspectRatio, {
    width: params.customWidth,
    height: params.customHeight,
  })

  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: clampCount(params.n),
    size,
    response_format: 'b64_json',
  }

  if (isImageToImage) {
    payload.image =
      imageInputUrls.length === 1 ? imageInputUrls[0] : imageInputUrls
  }

  const endpoint = isImageToImage
    ? API_ENDPOINTS.IMAGE_EDITS
    : API_ENDPOINTS.IMAGE_GENERATIONS

  const res = await api.post(endpoint, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)

  const errorMessage = extractApiErrorMessage(res.data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  const images = parseOpenAIImageList(res.data)
  if (images.length === 0) {
    throw new Error(
      extractApiErrorMessage(res.data) ??
        'The image API returned an empty result. Check that the model channel is configured and supports image editing.'
    )
  }

  return { images }
}

function geminiImageSize(params: PhotoParams): string {
  const raw = String(params.imageSize || params.resolution || '').trim()
  if (raw === '1K' || raw === '2K' || raw === '4K') return raw
  return '2K'
}

function pushImageFromUrl(images: PhotoResult[], raw?: string) {
  const url = raw?.trim()
  if (!url) return
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    images.push({
      b64: comma >= 0 ? url.slice(comma + 1) : url,
      mimeType: url.slice(5, url.indexOf(';')) || 'image/png',
    })
    return
  }
  images.push({ url })
}

function collectImagesFromContent(content: unknown, images: PhotoResult[]) {
  if (typeof content === 'string') {
    for (const match of content.matchAll(
      /(?:!\[[^\]]*]\()?((?:data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+)|https?:\/\/[^\s)]+)/g
    )) {
      pushImageFromUrl(images, match[1])
    }
    return
  }
  if (!Array.isArray(content)) return
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const item = part as {
      type?: string
      image_url?: { url?: string } | string
      inline_data?: { data?: string; mime_type?: string }
      inlineData?: { data?: string; mimeType?: string }
    }
    if (item.type === 'image_url') {
      const url =
        typeof item.image_url === 'string' ? item.image_url : item.image_url?.url
      pushImageFromUrl(images, url)
    }
    const inline = item.inlineData ?? item.inline_data
    if (inline?.data) {
      let mimeType = 'image/png'
      if ('mimeType' in inline && inline.mimeType) {
        mimeType = inline.mimeType
      } else if ('mime_type' in inline && inline.mime_type) {
        mimeType = inline.mime_type
      }
      images.push({
        b64: inline.data,
        mimeType,
      })
    }
  }
}

function parseChatImages(data: unknown): PhotoResult[] {
  const fromList = parseOpenAIImageList(data)
  if (fromList.length > 0) return fromList

  const images: PhotoResult[] = []
  const choices = (data as { choices?: unknown[] })?.choices ?? []
  for (const choice of choices) {
    if (!choice || typeof choice !== 'object') continue
    const message = (choice as { message?: Record<string, unknown> }).message
    if (!message) continue
    collectImagesFromContent(message.content, images)
    collectImagesFromContent(message.images, images)
  }
  return images
}

async function generateViaGeminiChat(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const imageInputUrls = getImageInputUrls(params)
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: params.prompt },
  ]
  for (const url of imageInputUrls) {
    content.push({ type: 'image_url', image_url: { url } })
  }

  const payload = {
    model: params.model,
    stream: false,
    messages: [{ role: 'user', content }],
    extra_body: {
      google: {
        image_config: {
          aspect_ratio: params.aspectRatio,
          image_size: geminiImageSize(params),
        },
      },
    },
  }

  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)

  const errorMessage = extractApiErrorMessage(res.data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  const images = parseChatImages(res.data)
  if (images.length === 0) {
    throw new Error(
      t(
        'The Gemini image model did not return an image. Confirm the channel supports this model, then try again.'
      )
    )
  }
  return { images }
}

function clampCount(n: number | '' | undefined): number {
  const v = Math.floor(Number(n || 1))
  if (!Number.isFinite(v) || v < 1) return 1
  if (v > 4) return 4
  return v
}
