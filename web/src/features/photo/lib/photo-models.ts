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
import type { PricingModel } from '@/features/pricing/types'

import type { PhotoModel, PhotoSizeOption } from '../types'

const IMAGE_GENERATION_ENDPOINT = 'image-generation'
export const VIDEO_GENERATION_ENDPOINT = 'openai-video'
const GEMINI_ENDPOINT = 'gemini'

const IMAGE_MODEL_NAME_HINT =
  /seedream|jimeng|dall-e|gpt-image|imagen|flux|midjourney|stable-diffusion|sdxl|ideogram|recraft|kolors|wanx|qwen-image|nano-banana|gemini-.*image|grok-.*image/i

const VIDEO_MODEL_NAME_HINT =
  /seedance|kling|runway|luma|pika|sora|veo|hailuo|minimax-hailuo|minimax-h3|wanx.*video|cogvideox|vidu|hunyuan-video|t2v-|i2v-|s2v-|jimeng.*video/i

type PricingLookup = Pick<
  PricingModel,
  'model_name' | 'description' | 'supported_endpoint_types' | 'resolution_price'
>

function normalizeResolutionKey(raw: string): string {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  if (lower === '1k') return '1K'
  if (lower === '2k') return '2K'
  if (lower === '4k') return '4K'
  if (lower === '720p') return '720P'
  if (lower === '1080p') return '1080P'
  return trimmed
}

function sizeOptionHint(value: string): string {
  if (value === '1K') return 'Standard · social media'
  if (value === '2K') return 'HD · design draft'
  if (value === '4K') return 'Ultra detail · film footage'
  if (value === 'custom') return 'Custom size · width × height'
  if (value === '720P') return 'Balanced preview quality'
  if (value === '1080P') return 'Sharper output preview'
  return value
}

function uniqueSizeOptions(values: string[]): PhotoSizeOption[] {
  const seen = new Set<string>()
  const options: PhotoSizeOption[] = []
  for (const value of values) {
    const next = value.trim()
    if (!next || seen.has(next)) continue
    seen.add(next)
    options.push({ value: next, hint: sizeOptionHint(next) })
  }
  return options
}

function pickWorkspaceModels(input: {
  userModels: string[]
  extraCustom: string[]
  pricingByName: Map<string, PricingLookup>
  endpoint: string
  nameHint: RegExp
}): PhotoModel[] {
  const endpointMatches = input.userModels.filter((id) =>
    input.pricingByName
      .get(id)
      ?.supported_endpoint_types?.includes(input.endpoint)
  )

  let source = endpointMatches
  if (source.length === 0) {
    source = input.userModels.filter((id) => {
      const endpoints =
        input.pricingByName.get(id)?.supported_endpoint_types ?? []
      if (endpoints.includes(input.endpoint)) return true
      if (
        input.endpoint === IMAGE_GENERATION_ENDPOINT &&
        endpoints.includes(VIDEO_GENERATION_ENDPOINT)
      ) {
        return false
      }
      return input.nameHint.test(id)
    })
  }

  const seen = new Set<string>()
  const models: PhotoModel[] = []
  for (const id of [...source, ...input.extraCustom]) {
    const name = id.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    models.push({
      id: name,
      label: name,
      description: input.pricingByName.get(name)?.description,
      endpointTypes:
        input.pricingByName.get(name)?.supported_endpoint_types ?? [],
    })
  }
  return models
}

export function pickPhotoModels(
  userModels: string[],
  pricingByName: Map<string, PricingLookup>,
  extraCustom: string[]
): PhotoModel[] {
  return pickWorkspaceModels({
    userModels,
    extraCustom,
    pricingByName,
    endpoint: IMAGE_GENERATION_ENDPOINT,
    nameHint: IMAGE_MODEL_NAME_HINT,
  })
}

export function pickVideoModels(
  userModels: string[],
  pricingByName: Map<string, PricingLookup>,
  extraCustom: string[]
): PhotoModel[] {
  return pickWorkspaceModels({
    userModels,
    extraCustom,
    pricingByName,
    endpoint: VIDEO_GENERATION_ENDPOINT,
    nameHint: VIDEO_MODEL_NAME_HINT,
  })
}

export function getPhotoSizeOptionsForModel(
  modelId: string,
  pricing?: Pick<PricingLookup, 'resolution_price'> | null
): PhotoSizeOption[] {
  const fromPrice = Object.keys(pricing?.resolution_price ?? {}).map(
    normalizeResolutionKey
  )
  if (fromPrice.length > 0) {
    if (!fromPrice.includes('custom')) fromPrice.push('custom')
    return uniqueSizeOptions(fromPrice)
  }

  const name = modelId.toLowerCase()
  if (/gemini/.test(name) && /image/.test(name) && !/4k/.test(name)) {
    return uniqueSizeOptions(['1K', '2K', 'custom'])
  }
  if (/dall-e-2/.test(name)) {
    return uniqueSizeOptions(['256x256', '512x512', '1024x1024', 'custom'])
  }
  if (/dall-e-3/.test(name)) {
    return uniqueSizeOptions(['1024x1024', '1792x1024', '1024x1792', 'custom'])
  }
  if (/gpt-image/.test(name)) {
    return uniqueSizeOptions(['1024x1024', '1536x1024', '1024x1536', 'custom'])
  }
  return uniqueSizeOptions(['1K', '2K', '4K', 'custom'])
}

export function getVideoResolutionOptionsForModel(
  _modelId: string,
  pricing?: Pick<PricingLookup, 'resolution_price'> | null
): PhotoSizeOption[] {
  const fromPrice = Object.keys(pricing?.resolution_price ?? {})
    .map(normalizeResolutionKey)
    .filter((value) => value !== 'custom')
  if (fromPrice.length > 0) return uniqueSizeOptions(fromPrice)
  return uniqueSizeOptions(['720P', '1080P'])
}

function defaultPhotoSize(options: PhotoSizeOption[]): string {
  const preferred =
    options.find((item) => item.value === '2K') ??
    options.find((item) => item.value !== 'custom') ??
    options[0]
  return preferred?.value ?? '2K'
}

export function snapPhotoSize(
  current: string,
  options: PhotoSizeOption[]
): string {
  if (options.some((item) => item.value === current)) return current
  return defaultPhotoSize(options)
}

export type PhotoCallKind = 'image-generation' | 'gemini-chat'

export function resolvePhotoCallKind(
  modelId: string,
  endpointTypes: string[] = []
): PhotoCallKind {
  const name = modelId.trim().toLowerCase()
  if (name.startsWith('imagen')) return 'image-generation'
  if (/gemini/.test(name) && /image/.test(name)) return 'gemini-chat'
  if (endpointTypes.includes(IMAGE_GENERATION_ENDPOINT)) {
    return 'image-generation'
  }
  if (endpointTypes.includes(GEMINI_ENDPOINT) && /image/.test(name)) {
    return 'gemini-chat'
  }
  return 'image-generation'
}
