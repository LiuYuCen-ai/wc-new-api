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
import axios from 'axios'
import { api, getCommonHeaders } from '@/lib/api'
import { fetchActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
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
 * - OpenAI image models: /v1/images/generations (Bearer API key)
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

async function postWithApiKey<T = unknown>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const apiKey = await fetchActiveChatKey()
  const res = await axios.post<T>(path, payload, {
    headers: {
      ...getCommonHeaders(),
      Authorization: `Bearer ${apiKey}`,
    },
    withCredentials: true,
  })
  return res.data
}

async function generateViaImagesApi(
  params: PhotoParams,
  model: PhotoModel
): Promise<GeneratePhotoResponse> {
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: clampCount(params.n),
    response_format: 'b64_json',
  }

  if (model.supportsSize && params.size) {
    payload.size = params.size
  }
  if (model.supportsQuality && params.quality) {
    payload.quality = params.quality
  }

  const imageDataUrls = params.imageUrlEnabled
    ? params.imageDataUrls
        .map((img) => img.dataUrl?.trim())
        .filter((url): url is string => Boolean(url))
    : []
  if (imageDataUrls.length > 0) {
    payload.image =
      imageDataUrls.length === 1 ? imageDataUrls[0] : imageDataUrls
  }

  const data = await postWithApiKey<{ data?: unknown[] }>(
    '/v1/images/generations',
    payload
  )

  const list = data?.data ?? []
  const images: PhotoResult[] = []
  if (Array.isArray(list)) {
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

  if (params.imageUrlEnabled && params.imageDataUrls.length > 0) {
    for (const img of params.imageDataUrls) {
      const url = img.dataUrl?.trim()
      if (url) {
        content.push({ type: 'image_url', image_url: { url } })
      }
    }
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

  return { images: parseGeminiImages(res.data) }
}

function parseGeminiImages(data: unknown): PhotoResult[] {
  const message = (data as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message
  const content = message?.content
  const images: PhotoResult[] = []

  if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const url = (part as { image_url?: { url?: string } }).image_url?.url
      if (typeof url !== 'string') continue
      images.push(url.startsWith('data:') ? parseDataUrl(url) : { url })
    }
    return images
  }

  if (typeof content === 'string') {
    const matches = content.match(/!\[[^\]]*\]\((data:[^)]+)\)/g) ?? []
    for (const match of matches) {
      const dataUrl = match.replace(/^!\[[^\]]*\]\(/, '').replace(/\)$/, '')
      images.push(parseDataUrl(dataUrl))
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
