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

export type StudioImage = {
  url?: string
  b64?: string
  mimeType?: string
  revisedPrompt?: string
}

export type StudioGenerateParams = {
  model: string
  prompt: string
  size?: string
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
 * Generate images through the relay images API (session auth, same as the
 * Photo playground). Works with any image model configured on this site.
 */
export async function generateStudioImage(
  params: StudioGenerateParams
): Promise<StudioImage[]> {
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    n: 1,
    response_format: 'b64_json',
  }
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

export function studioImageToSrc(image: StudioImage): string {
  if (image.url) return image.url
  if (!image.b64) return ''
  const normalized = image.b64.trim()
  if (normalized.startsWith('data:')) return normalized
  const type = image.mimeType?.trim() || 'image/png'
  return `data:${type};base64,${normalized}`
}
