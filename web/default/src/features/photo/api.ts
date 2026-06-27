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
import type { PhotoModel, PhotoParams, PhotoResult } from './types'
import { PHOTO_MODELS } from './constants'

// Identify whether a model id is a Gemini family image model
function isGeminiImage(model: string) {
  return model.startsWith('gemini-')
}

export type GeneratePhotoResponse = {
  images: PhotoResult[]
  // Optional usage / billing debug info returned by backend (e.g. quota)
  usage?: {
    total_tokens?: number
    quota_used?: number
  }
}

/**
 * Generate photos through the OpenAI /v1/images/generations endpoint.
 *
 * - For OpenAI family models (e.g. gpt-image-2) we send the standard
 *   OpenAI image generation payload.
 * - For Gemini image preview models we send a chat/completions request
 *   and instruct the backend to use google.image_config (aspect_ratio +
 *   image_size). The response is rendered as inline data URLs.
 *
 * All requests go through the existing relay pipeline so quota / billing
 * are applied automatically by the backend.
 */
export async function generatePhoto(
  params: PhotoParams
): Promise<GeneratePhotoResponse> {
  const model = PHOTO_MODELS.find((m) => m.id === params.model) as PhotoModel

  if (isGeminiImage(params.model)) {
    return generateViaGeminiImage(params, model)
  }

  return generateViaImagesApi(params, model)
}

async function generateViaImagesApi(
  params: PhotoParams,
  model: PhotoModel
): Promise<GeneratePhotoResponse> {
  // The number of images is translated to N parallel upstream requests
  // (each request always asks for 1 image), so we intentionally do NOT
  // pass `n` to the backend. This makes the feature work consistently
  // even with upstream channels that ignore or truncate `n`.
  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    response_format: 'b64_json',
  }

  if (model.supportsSize && params.size) {
    payload.size = params.size
  }
  if (model.supportsSize && params.resolution) {
    payload.resolution = params.resolution
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
  const count = clampCount(params.n)
  const responses = await Promise.all(
    Array.from({ length: count }, () => api.post('/pg/images/generations', payload))
  )
  const images: PhotoResult[] = []
  for (const res of responses) {
    const data = res.data?.data ?? res.data ?? []
    if (!Array.isArray(data)) continue
    for (const item of data) {
      if (!item || typeof item !== 'object') continue
      const it = item as { b64_json?: string; url?: string; revised_prompt?: string }
      if (!it.b64_json && !it.url) continue
      images.push({ b64: it.b64_json, url: it.url, revisedPrompt: it.revised_prompt })
    }
  }
  return { images }
}

function clampCount(n: number | '' | undefined): number {
  const v = Math.floor(Number(n || 1))
  if (!Number.isFinite(v) || v < 1) return 1
  return v
}

async function generateViaGeminiImage(
  params: PhotoParams,
  _model: PhotoModel
): Promise<GeneratePhotoResponse> {
  // Gemini 图片生成使用专用接口 /pg/gemini/images/generations
  // 后端会自动添加 responseModalities: ["TEXT", "IMAGE"]
  
  // 构建 parts 数组，包含文本提示词和可选的图片
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  
  // 如果启用了图片输入且有上传的图片，先添加图片
  if (params.imageUrlEnabled && params.imageDataUrls && params.imageDataUrls.length > 0) {
    for (const img of params.imageDataUrls) {
      // 解析 data URL，提取 mime type 和 base64 数据
      const match = /^data:([^;]+);base64,(.*)$/.exec(img.dataUrl)
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        })
      }
    }
  }
  
  // 添加文本提示词
  parts.push({
    text: params.prompt,
  })
  
  const payload: Record<string, unknown> = {
    model: params.model,
    contents: [
      {
        role: 'user',
        parts: parts,
      },
    ],
    generationConfig: {},
  }

  // 添加 aspect ratio 和 image size（如果模型支持）
  if (params.aspectRatio) {
    const imageConfig: Record<string, unknown> = {
      aspectRatio: params.aspectRatio,
    }
    if (params.imageSize) {
      imageConfig.imageSize = params.imageSize
    }
    ;(payload.generationConfig as Record<string, unknown>).imageConfig = imageConfig
  }

  const res = await api.post('/pg/gemini/images/generations', payload)
  
  // 解析 Gemini 原生响应
  const candidates = res.data?.candidates ?? []
  const images: PhotoResult[] = []

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? []
    for (const part of parts) {
      // 检查 inlineData 字段
      if (part.inlineData && part.inlineData.data && part.inlineData.mimeType) {
        images.push({
          mimeType: part.inlineData.mimeType,
          b64: part.inlineData.data,
        })
      }
    }
  }

  return { images }
}

function parseDataUrl(dataUrl: string): PhotoResult {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return { url: dataUrl }
  return {
    mimeType: match[1],
    b64: match[2],
  }
}
