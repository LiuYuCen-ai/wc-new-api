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
import { API_ENDPOINTS } from '@/features/playground/constants'
import type { PhotoModel, PhotoParams, PhotoResult } from './types'
import { PHOTO_MODELS } from './constants'

function isGeminiImage(model: string) {
  return model.startsWith('gemini-')
}

export type GeneratePhotoResponse = {
  images: PhotoResult[]
  usage?: {
    total_tokens?: number
    quota_used?: number
  }
}

/**
 * Generate photos through existing relay APIs:
 * - Gemini: /pg/chat/completions (session auth, same as Playground)
 * - OpenAI image models: /pg/images/generations or /pg/images/edits (session auth)
 */
export async function generatePhoto(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const model = PHOTO_MODELS.find((m) => m.id === params.model) as PhotoModel

  if (isGeminiImage(params.model)) {
    return generateViaChatCompletions(params)
  }

  return generateViaImagesApi(params, model)
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
  params: PhotoParams,
  model: PhotoModel
): Promise<GeneratePhotoResponse> {
  const imageInputUrls = getImageInputUrls(params)
  const isImageToImage = imageInputUrls.length > 0

  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: clampCount(params.n),
    response_format: 'b64_json',
  }

  if (model.supportsSize && params.size && params.size !== 'auto') {
    payload.size = params.size
  }
  if (model.supportsQuality && params.quality) {
    payload.quality = params.quality
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

async function generateViaChatCompletions(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = []

  const imageInputUrls = getImageInputUrls(params)
  for (const url of imageInputUrls) {
    content.push({ type: 'image_url', image_url: { url } })
  }

  content.push({ type: 'text', text: params.prompt })

  const payload = {
    model: params.model,
    stream: false,
    messages: [
      {
        role: 'user' as const,
        content,
      },
    ],
    extra_body: {
      google: {
        image_config: {
          aspect_ratio: params.aspectRatio,
          image_size: params.imageSize,
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

  const images = parseGeminiImages(res.data)
  if (images.length === 0) {
    throw new Error(
      'The model returned no images. Try adjusting the prompt or image size.'
    )
  }

  return { images }
}

function parseGeminiImages(data: unknown): PhotoResult[] {
  const message = (data as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message
  const content = message?.content
  const images: PhotoResult[] = []

  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const record = part as {
        type?: string
        image_url?: { url?: string }
        inline_data?: { mime_type?: string; data?: string }
      }
      const imageUrl = record.image_url?.url
      if (typeof imageUrl === 'string') {
        images.push(
          imageUrl.startsWith('data:') ? parseDataUrl(imageUrl) : { url: imageUrl }
        )
        continue
      }
      if (record.inline_data?.data) {
        images.push({
          mimeType: record.inline_data.mime_type ?? 'image/png',
          b64: record.inline_data.data,
        })
      }
    }
    return images
  }

  if (typeof content === 'string') {
    const matches = content.match(/!\[[^\]]*\]\(([^)]+)\)/g) ?? []
    for (const match of matches) {
      const url = match.replace(/^!\[[^\]]*\]\(/, '').replace(/\)$/, '')
      images.push(url.startsWith('data:') ? parseDataUrl(url) : { url })
    }
  }

  return images
}

function parseDataUrl(dataUrl: string): PhotoResult {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return { url: dataUrl }
  return {
    mimeType: match[1],
    b64: match[2],
  }
}

function clampCount(n: number | '' | undefined): number {
  const v = Math.floor(Number(n || 1))
  if (!Number.isFinite(v) || v < 1) return 1
  if (v > 4) return 4
  return v
}
