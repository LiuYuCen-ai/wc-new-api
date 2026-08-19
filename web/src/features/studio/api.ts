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

import { isGeminiImageModel } from './image-params'

export type StudioImage = {
  url?: string
  b64?: string
  mimeType?: string
  revisedPrompt?: string
}

export type StudioGroup = { value: string; label: string; desc?: string }

/**
 * Fetch the model groups (分组) available to the current user, mirroring the
 * playground group selector (`/api/user/self/groups`).
 */
export async function getStudioGroups(): Promise<StudioGroup[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const data = res.data as {
    success?: boolean
    data?: Record<string, { desc?: string }>
  }
  if (!data?.success || !data.data) return []
  return Object.entries(data.data).map(([group, info]) => ({
    value: group,
    label: group,
    desc: info?.desc,
  }))
}

/**
 * Fetch the models available to the current user for a given group, mirroring
 * the playground model list (`/api/user/models?group=`).
 */
export async function getStudioModels(group: string): Promise<string[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: group ? { group } : undefined,
  } as Record<string, unknown>)
  const data = res.data as { success?: boolean; data?: string[] }
  if (!data?.success || !Array.isArray(data.data)) return []
  return data.data
}

export type StudioGenerateParams = {
  model: string
  prompt: string
  size?: string
  /** Gemini image-config aspect ratio (e.g. "16:9"). */
  aspectRatio?: string
  /** Gemini image-config resolution tier (e.g. "2K"). */
  imageSize?: string
  group?: string
}

function extractApiErrorMessage(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const record = data as { error?: { message?: string }; message?: string }
  return record.error?.message ?? record.message
}

function parseOpenAIImageList(data: unknown): StudioImage[] {
  const list = (data as { data?: unknown[] })?.data ?? []
  const images: StudioImage[] = []
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

/**
 * Parse images returned by a Gemini image model via chat completions. The
 * image may arrive as a markdown/base64 image_url part or an inline_data part.
 */
function parseGeminiChatImages(data: unknown): StudioImage[] {
  const content = (
    data as { choices?: { message?: { content?: unknown } }[] }
  )?.choices?.[0]?.message?.content
  const images: StudioImage[] = []
  if (!Array.isArray(content)) return images
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const record = part as {
      image_url?: { url?: string }
      inline_data?: { mime_type?: string; data?: string }
    }
    const url = record.image_url?.url
    if (typeof url === 'string' && url) {
      images.push({ url })
      continue
    }
    const inline = record.inline_data
    if (inline?.data) {
      images.push({ b64: inline.data, mimeType: inline.mime_type })
    }
  }
  return images
}

/**
 * Generate images with a Gemini image model through the relay chat completions
 * API, passing the aspect ratio and resolution via the google image_config
 * (same request shape as the Photo playground).
 */
async function generateGeminiImage(
  params: StudioGenerateParams,
  refs: string[]
): Promise<StudioImage[]> {
  const content: Record<string, unknown>[] = []
  for (const url of refs) {
    content.push({ type: 'image_url', image_url: { url } })
  }
  content.push({ type: 'text', text: params.prompt })

  const payload: Record<string, unknown> = {
    model: params.model,
    stream: false,
    messages: [{ role: 'user', content }],
    extra_body: {
      google: {
        image_config: {
          aspect_ratio: params.aspectRatio,
          image_size: params.imageSize,
        },
      },
    },
  }
  if (params.group) payload.group = params.group

  const res = await api.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)

  const errorMessage = extractApiErrorMessage(res.data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }
  const images = parseGeminiChatImages(res.data)
  if (images.length === 0) {
    throw new Error(
      'The model returned no images. Try adjusting the prompt or image size.'
    )
  }
  return images
}

/**
 * Generate images through the relay images API (session auth, same as the
 * Photo playground). Works with any image model configured on this site.
 */
export async function generateStudioImage(
  params: StudioGenerateParams
): Promise<StudioImage[]> {
  if (isGeminiImageModel(params.model)) {
    return generateGeminiImage(params, [])
  }
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: 1,
    response_format: 'b64_json',
  }
  if (params.group) payload.group = params.group
  if (params.size && params.size !== 'auto') {
    payload.size = params.size
  }

  const res = await api.post(API_ENDPOINTS.IMAGE_GENERATIONS, payload, {
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
        'The image API returned an empty result. Check that the model channel is configured.'
    )
  }
  return images
}

export type StudioEditParams = {
  model: string
  prompt: string
  /** One or more reference image URLs / data-URLs. */
  images: string[]
  size?: string
  /** Gemini image-config aspect ratio (e.g. "16:9"). */
  aspectRatio?: string
  /** Gemini image-config resolution tier (e.g. "2K"). */
  imageSize?: string
  group?: string
}

/**
 * Edit / image-to-image generation through the relay images edits API.
 * Works with any image model that supports editing on this site.
 */
export async function editStudioImage(
  params: StudioEditParams
): Promise<StudioImage[]> {
  const refs = params.images.filter((u) => u.trim().length > 0)
  if (refs.length === 0) {
    throw new Error('At least one reference image is required.')
  }
  if (isGeminiImageModel(params.model)) {
    return generateGeminiImage(
      {
        model: params.model,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize,
        group: params.group,
      },
      refs
    )
  }
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: 1,
    response_format: 'b64_json',
    image: refs.length === 1 ? refs[0] : refs,
  }
  if (params.group) payload.group = params.group
  if (params.size && params.size !== 'auto') {
    payload.size = params.size
  }

  const res = await api.post(API_ENDPOINTS.IMAGE_EDITS, payload, {
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
  return images
}

export function studioImageToSrc(image: StudioImage): string {
  if (image.url) return image.url
  if (!image.b64) return ''
  const normalized = image.b64.trim()
  if (normalized.startsWith('data:')) return normalized
  const type = image.mimeType?.trim() || 'image/png'
  return `data:${type};base64,${normalized}`
}

export type StudioDescribeParams = {
  model: string
  prompt: string
  image?: string
  temperature?: number
  group?: string
}

/**
 * Describe an image (image-to-text) via the site relay chat completions API
 * (session auth, deducts quota from the current user). Uses a vision model.
 */
export async function describeStudioImage(
  params: StudioDescribeParams
): Promise<string> {
  const content: Record<string, unknown>[] = [
    { type: 'text', text: params.prompt },
  ]
  if (params.image) {
    content.push({ type: 'image_url', image_url: { url: params.image } })
  }
  const res = await api.post(
    API_ENDPOINTS.CHAT_COMPLETIONS,
    {
      model: params.model,
      messages: [{ role: 'user', content }],
      temperature: params.temperature ?? 0.6,
      max_tokens: 2048,
      stream: false,
      ...(params.group ? { group: params.group } : {}),
    },
    { skipErrorHandler: true } as Record<string, unknown>
  )
  const errorMessage = extractApiErrorMessage(res.data)
  if (errorMessage) {
    throw new Error(errorMessage)
  }
  const data = res.data as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content ?? ''
}

export type StudioVideoParams = {
  model: string
  prompt: string
  size?: string
  seconds?: string
  image?: string
  group?: string
}

type PlatformVideoResponse = {
  id?: string
  task_id?: string
  taskId?: string
  request_id?: string
  status?: string
  result_url?: string
  fail_reason?: string
  data?: PlatformVideoResponse
}

/**
 * Generate a video via the site relay video API (session auth, deducts quota
 * from the current user). Submits the task then polls until it completes.
 */
export async function generateStudioVideo(
  params: StudioVideoParams
): Promise<string> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
  }
  if (params.group) body.group = params.group
  if (params.size) body.size = params.size
  if (params.seconds) body.seconds = params.seconds
  if (params.image) body.image = params.image

  const submit = await api.post(API_ENDPOINTS.VIDEO_GENERATIONS, body, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  const submitError = extractApiErrorMessage(submit.data)
  if (submitError) throw new Error(submitError)

  const submitData = (submit.data as PlatformVideoResponse).data ??
    (submit.data as PlatformVideoResponse)
  const taskId =
    submitData.task_id ||
    submitData.id ||
    submitData.taskId ||
    submitData.request_id
  if (!taskId) {
    throw new Error('The video task was submitted, but no task ID was returned.')
  }

  // Poll until the task finishes (bounded).
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise((r) => setTimeout(r, 5000))
    const res = await api.get(
      `${API_ENDPOINTS.VIDEO_GENERATIONS}/${encodeURIComponent(String(taskId))}`,
      { disableDuplicate: true, skipErrorHandler: true } as Record<
        string,
        unknown
      >
    )
    const record =
      (res.data as PlatformVideoResponse).data ??
      (res.data as PlatformVideoResponse)
    const status = String(record.status ?? '').toUpperCase()
    if (['SUCCESS', 'SUCCEEDED', 'COMPLETED', 'DONE'].includes(status)) {
      if (!record.result_url) {
        throw new Error('The video task completed, but no video URL was returned.')
      }
      return record.result_url
    }
    if (['FAILURE', 'FAILED', 'CANCELLED', 'ERROR'].includes(status)) {
      throw new Error(record.fail_reason || 'Video generation failed')
    }
  }
  throw new Error('Video generation timed out. Please try again later.')
}
