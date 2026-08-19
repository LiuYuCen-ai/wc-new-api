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

/**
 * Model-aware image parameter options for the studio Generate/Edit Image
 * nodes. Reuses the Photo playground constants so the selectable sizes and
 * aspect ratios stay in lockstep with `/photo`.
 */
import {
  GEMINI_ASPECT_RATIO_GROUPS,
  GEMINI_IMAGE_SIZE_OPTIONS,
  GEMINI_MODEL_IDS,
  RESOLUTION_SIZE_MAP,
  RESOLUTION_TIERS,
  getNanoBananaKind,
} from '@/features/photo/constants'

export type ImageParamOption = { value: string; label: string }

/** Which control layout an image model uses. */
export type ImageParamMode = 'gpt' | 'gemini' | 'generic'

export type ImageParamSpec = {
  mode: ImageParamMode
  /** OpenAI-style pixel size options (gpt / generic). */
  sizeOptions: ImageParamOption[]
  /** Resolution tier options (gemini). */
  imageSizeOptions: ImageParamOption[]
  /** Aspect ratio options (gemini). */
  aspectRatioOptions: ImageParamOption[]
}

/** The exact model ids that opt into the GPT-Image sizing layout. */
const GPT_IMAGE_MODEL = 'gpt-image-2'

const GENERIC_SIZE_OPTIONS: ImageParamOption[] = [
  { value: 'auto', label: 'Auto' },
  { value: '1024x1024', label: '1024x1024' },
  { value: '1024x1536', label: '1024x1536' },
  { value: '1536x1024', label: '1536x1024' },
]

/** GPT-Image-2 sizes, flattened from the Photo resolution map (with ratio hint). */
function gptSizeOptions(): ImageParamOption[] {
  const options: ImageParamOption[] = []
  const seen = new Set<string>()
  for (const tier of RESOLUTION_TIERS) {
    for (const item of RESOLUTION_SIZE_MAP[tier]) {
      if (seen.has(item.size)) continue
      seen.add(item.size)
      options.push({
        value: item.size,
        label: item.size === 'auto' ? 'Auto' : `${item.label} · ${item.ratio}`,
      })
    }
  }
  return options
}

/** Gemini image-size tiers available for the given model kind. */
function geminiImageSizeOptions(kind: 'banana2' | 'bananaPro'): ImageParamOption[] {
  return GEMINI_IMAGE_SIZE_OPTIONS.filter(
    (opt) => !opt.exclusiveTo || opt.exclusiveTo === kind
  ).map((opt) => ({ value: opt.size, label: opt.size }))
}

/** Gemini aspect ratios available for the given model kind. */
function geminiAspectRatioOptions(kind: 'banana2' | 'bananaPro'): ImageParamOption[] {
  const options: ImageParamOption[] = []
  for (const group of GEMINI_ASPECT_RATIO_GROUPS) {
    for (const item of group.items) {
      if (item.exclusiveTo && item.exclusiveTo !== kind) continue
      options.push({ value: item.ratio, label: item.ratio })
    }
  }
  return options
}

/** True when the model uses the Gemini image-config (aspect_ratio + image_size). */
export function isGeminiImageModel(model: string): boolean {
  return getNanoBananaKind(model) !== null
}

/** True when the model uses the GPT-Image pixel-size layout. */
export function isGptImageModel(model: string): boolean {
  return model === GPT_IMAGE_MODEL
}

/**
 * Resolve the selectable size / image-size / aspect-ratio options for a model,
 * matching the `/photo` playground per model.
 */
export function imageParamSpec(model: string): ImageParamSpec {
  const kind = getNanoBananaKind(model)
  if (kind) {
    return {
      mode: 'gemini',
      sizeOptions: [],
      imageSizeOptions: geminiImageSizeOptions(kind),
      aspectRatioOptions: geminiAspectRatioOptions(kind),
    }
  }
  if (model === GPT_IMAGE_MODEL) {
    return {
      mode: 'gpt',
      sizeOptions: gptSizeOptions(),
      imageSizeOptions: [],
      aspectRatioOptions: [],
    }
  }
  return {
    mode: 'generic',
    sizeOptions: GENERIC_SIZE_OPTIONS,
    imageSizeOptions: [],
    aspectRatioOptions: [],
  }
}

export { GEMINI_MODEL_IDS }
