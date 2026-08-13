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
import type { PhotoModel } from './types'

export const GEMINI_MODEL_IDS = {
  BANANA_PRO: 'gemini-3-pro-image-preview',
  BANANA_2: 'gemini-3.1-flash-image-preview',
} as const

export const GEMINI_CLASSIC_ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '4:5',
  '5:4',
  '21:9',
] as const

export const GEMINI_EXTREME_ASPECT_RATIOS = [
  '4:1',
  '1:4',
  '8:1',
  '1:8',
] as const

// Banana 2 supports all 14; Banana Pro supports classic 10 only.
export const ASPECT_RATIOS = [
  ...GEMINI_CLASSIC_ASPECT_RATIOS,
  ...GEMINI_EXTREME_ASPECT_RATIOS,
] as const

export const GEMINI_IMAGE_SIZES = ['0.5K', '1K', '2K', '4K'] as const

export type GeminiAspectRatioOption = {
  ratio: (typeof ASPECT_RATIOS)[number]
  hint: string
  exclusiveTo?: 'banana2' | 'bananaPro'
  /** Pixel resolution for the selected image_size tier */
  resolution?: string
}

export type GeminiImageSize = (typeof GEMINI_IMAGE_SIZES)[number]

export const GEMINI_BANANA_2_RESOLUTIONS: Record<
  (typeof ASPECT_RATIOS)[number],
  Record<GeminiImageSize, string>
> = {
  '1:1': {
    '0.5K': '512×512',
    '1K': '1024×1024',
    '2K': '2048×2048',
    '4K': '4096×4096',
  },
  '1:4': {
    '0.5K': '256×1024',
    '1K': '512×2048',
    '2K': '1024×4096',
    '4K': '2048×8192',
  },
  '1:8': {
    '0.5K': '192×1536',
    '1K': '384×3072',
    '2K': '768×6144',
    '4K': '1536×12288',
  },
  '2:3': {
    '0.5K': '424×632',
    '1K': '848×1264',
    '2K': '1696×2528',
    '4K': '3392×5056',
  },
  '3:2': {
    '0.5K': '632×424',
    '1K': '1264×848',
    '2K': '2528×1696',
    '4K': '5056×3392',
  },
  '3:4': {
    '0.5K': '448×600',
    '1K': '896×1200',
    '2K': '1792×2400',
    '4K': '3584×4800',
  },
  '4:1': {
    '0.5K': '1024×256',
    '1K': '2048×512',
    '2K': '4096×1024',
    '4K': '8192×2048',
  },
  '4:3': {
    '0.5K': '600×448',
    '1K': '1200×896',
    '2K': '2400×1792',
    '4K': '4800×3584',
  },
  '4:5': {
    '0.5K': '464×576',
    '1K': '928×1152',
    '2K': '1856×2304',
    '4K': '3712×4608',
  },
  '5:4': {
    '0.5K': '576×464',
    '1K': '1152×928',
    '2K': '2304×1856',
    '4K': '4608×3712',
  },
  '8:1': {
    '0.5K': '1536×192',
    '1K': '3072×384',
    '2K': '6144×768',
    '4K': '12288×1536',
  },
  '9:16': {
    '0.5K': '384×688',
    '1K': '768×1376',
    '2K': '1536×2752',
    '4K': '3072×5504',
  },
  '16:9': {
    '0.5K': '688×384',
    '1K': '1376×768',
    '2K': '2752×1536',
    '4K': '5504×3072',
  },
  '21:9': {
    '0.5K': '792×168',
    '1K': '1584×672',
    '2K': '3168×1344',
    '4K': '6336×2688',
  },
}

export const GEMINI_BANANA_PRO_RESOLUTIONS: Record<
  (typeof GEMINI_CLASSIC_ASPECT_RATIOS)[number],
  Record<'1K' | '2K' | '4K', string>
> = {
  '1:1': { '1K': '1024×1024', '2K': '2048×2048', '4K': '4096×4096' },
  '2:3': { '1K': '848×1264', '2K': '1696×2528', '4K': '3392×5056' },
  '3:2': { '1K': '1264×848', '2K': '2528×1696', '4K': '5056×3392' },
  '3:4': { '1K': '896×1200', '2K': '1792×2400', '4K': '3584×4800' },
  '4:3': { '1K': '1200×896', '2K': '2400×1792', '4K': '4800×3584' },
  '4:5': { '1K': '928×1152', '2K': '1856×2304', '4K': '3712×4608' },
  '5:4': { '1K': '1152×928', '2K': '2304×1856', '4K': '4608×3712' },
  '9:16': { '1K': '768×1376', '2K': '1536×2752', '4K': '3072×5504' },
  '16:9': { '1K': '1376×768', '2K': '2752×1536', '4K': '5504×3072' },
  '21:9': { '1K': '1584×672', '2K': '3168×1344', '4K': '6336×2688' },
}

export function getGeminiResolutionLabel(
  kind: 'banana2' | 'bananaPro',
  imageSize: GeminiImageSize,
  ratio: (typeof ASPECT_RATIOS)[number]
): string | undefined {
  if (kind === 'banana2') {
    return GEMINI_BANANA_2_RESOLUTIONS[ratio]?.[imageSize]
  }
  if (imageSize === '0.5K') return undefined
  return GEMINI_BANANA_PRO_RESOLUTIONS[
    ratio as (typeof GEMINI_CLASSIC_ASPECT_RATIOS)[number]
  ]?.[imageSize]
}

export function buildGeminiAspectRatioGroups(
  kind: 'banana2' | 'bananaPro' | null,
  imageSize: GeminiImageSize
): GeminiAspectRatioGroup[] {
  if (!kind) return []

  return GEMINI_ASPECT_RATIO_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => isGeminiOptionAvailable(item.exclusiveTo, kind))
      .map((item) => ({
        ...item,
        resolution: getGeminiResolutionLabel(kind, imageSize, item.ratio),
      }))
      .filter((item) => item.resolution),
  })).filter((group) => group.items.length > 0)
}

export function getGeminiAspectRatiosForSize(
  kind: 'banana2' | 'bananaPro' | null,
  imageSize: GeminiImageSize
): (typeof ASPECT_RATIOS)[number][] {
  return buildGeminiAspectRatioGroups(kind, imageSize).flatMap((group) =>
    group.items.map((item) => item.ratio)
  )
}

export type GeminiImageSizeOption = {
  size: (typeof GEMINI_IMAGE_SIZES)[number]
  hint: string
  exclusiveTo?: 'banana2' | 'bananaPro'
}

export type GeminiAspectRatioGroup = {
  id: 'classic' | 'extreme'
  label: string
  items: GeminiAspectRatioOption[]
}

export const GEMINI_IMAGE_SIZE_OPTIONS: GeminiImageSizeOption[] = [
  { size: '0.5K', hint: '512px · fast preview', exclusiveTo: 'banana2' },
  { size: '1K', hint: 'Standard · social media' },
  { size: '2K', hint: 'HD · design draft' },
  { size: '4K', hint: 'Ultra detail · film footage' },
]

export const GEMINI_ASPECT_RATIO_GROUPS: GeminiAspectRatioGroup[] = [
  {
    id: 'classic',
    label: 'Classic aspect ratios',
    items: [
      { ratio: '1:1', hint: 'Square · avatar & social posts' },
      { ratio: '16:9', hint: 'Widescreen · wallpaper & video' },
      { ratio: '9:16', hint: 'Portrait · mobile & short video' },
      { ratio: '4:3', hint: 'Standard photo · e-commerce' },
      { ratio: '3:4', hint: 'Portrait · product showcase' },
      { ratio: '3:2', hint: 'DSLR · photography & print' },
      { ratio: '2:3', hint: 'Portrait · photo prints' },
      { ratio: '4:5', hint: 'Social poster · art prints' },
      { ratio: '5:4', hint: 'Photo print · fine art' },
      { ratio: '21:9', hint: 'Ultrawide · cinematic' },
    ],
  },
  {
    id: 'extreme',
    label: 'Extreme aspect ratios · Banana 2 exclusive',
    items: [
      {
        ratio: '4:1',
        hint: 'Ultra-wide banner · comic strip',
        exclusiveTo: 'banana2',
      },
      {
        ratio: '1:4',
        hint: 'Ultra-tall · vertical feed',
        exclusiveTo: 'banana2',
      },
      {
        ratio: '8:1',
        hint: 'Panorama · stage display',
        exclusiveTo: 'banana2',
      },
      {
        ratio: '1:8',
        hint: 'Vertical signage · narrow billboard',
        exclusiveTo: 'banana2',
      },
    ],
  },
]

export function getNanoBananaKind(
  modelId: string
): 'banana2' | 'bananaPro' | null {
  if (modelId === GEMINI_MODEL_IDS.BANANA_2) return 'banana2'
  if (modelId === GEMINI_MODEL_IDS.BANANA_PRO) return 'bananaPro'
  return null
}

export function isGeminiOptionAvailable(
  exclusiveTo: 'banana2' | 'bananaPro' | undefined,
  kind: 'banana2' | 'bananaPro' | null
): boolean {
  if (!exclusiveTo) return true
  return exclusiveTo === kind
}

// Available photo models. The id MUST match the channel model name on the
// backend so that the relay middleware can route the request to the correct
// upstream provider and apply the configured billing.
export const PHOTO_MODELS: PhotoModel[] = [
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    description: 'OpenAI latest generation image model',
    // Official GPT-Image-2 preset sizes (per the public docs).
    sizes: [
      '1024x1024',
      '1536x1024',
      '1024x1536',
      '2048x2048',
      '2048x1152',
      '3840x2160',
      '2160x3840',
      'auto',
    ],
    supportsN: true,
    supportsSize: true,
    supportsQuality: true,
  },
  {
    id: GEMINI_MODEL_IDS.BANANA_PRO,
    label: 'Nano Banana Pro',
    description:
      'Studio-grade fidelity · 10 classic aspect ratios · up to 4K',
    aspectRatios: [...GEMINI_CLASSIC_ASPECT_RATIOS],
    imageSizes: ['1K', '2K', '4K'],
    supportsN: false,
    supportsSize: false,
  },
  {
    id: GEMINI_MODEL_IDS.BANANA_2,
    label: 'Nano Banana 2',
    description:
      'Flash speed · 14 aspect ratios incl. extreme · 0.5K–4K',
    aspectRatios: [...ASPECT_RATIOS],
    imageSizes: ['0.5K', '1K', '2K', '4K'],
    supportsN: false,
    supportsSize: false,
  },
]

export const IMAGE_SIZES = ['1K', '2K', '4K'] as const

// GPT-Image-2 official preset sizes (in display order).
export const RESOLUTIONS = [
  '1024x1024',
  '1536x1024',
  '1024x1536',
  '2048x2048',
  '2048x1152',
  '3840x2160',
  '2160x3840',
  'auto',
] as const

// Resolution tiers (K) and the corresponding size list shown in the UI.
// 1K = standard / social, 2K = HD wallpaper / design, 4K = ultra detail / film.
export const RESOLUTION_TIERS = ['1K', '2K', '4K'] as const

export type ResolutionOption = {
  // Internal size key passed to the backend / OpenAI images API
  size: string
  // Aspect ratio label shown on top of the tile (e.g. "1:1", "16:9")
  ratio: string
  // Pixel resolution shown on the bottom of the tile (e.g. "1024x1024")
  label: string
  hint?: string
}

export const RESOLUTION_SIZE_MAP: Record<
  (typeof RESOLUTION_TIERS)[number],
  ResolutionOption[]
> = {
  // 1K – standard / social media
  '1K': [
    {
      size: 'auto',
      ratio: 'Auto',
      label: 'Auto',
      hint: 'Let the model pick the best output size',
    },
    {
      size: '1024x1024',
      ratio: '1:1',
      label: '1024×1024',
      hint: 'Square · avatar & social posts',
    },
    {
      size: '1024x1536',
      ratio: '2:3',
      label: '1024×1536',
      hint: 'Portrait · poster',
    },
    {
      size: '1536x1024',
      ratio: '3:2',
      label: '1536×1024',
      hint: 'Widescreen · landscape',
    },
  ],
  // 2K – HD wallpaper / design draft
  '2K': [
    {
      size: '2048x2048',
      ratio: '1:1',
      label: '2048×2048',
      hint: 'Square · avatar & social posts',
    },
    {
      size: '2048x1152',
      ratio: '16:9',
      label: '2048×1152',
      hint: 'Widescreen · wallpaper & video',
    },
  ],
  // 4K – ultra detail / film footage
  '4K': [
    {
      size: '3840x2160',
      ratio: '16:9',
      label: '3840×2160',
      hint: 'Widescreen · wallpaper & video',
    },
    {
      size: '2160x3840',
      ratio: '9:16',
      label: '2160×3840',
      hint: 'Portrait · mobile & short video',
    },
  ],
}

export const GPT_IMAGE_SIZE_OPTIONS: GeminiImageSizeOption[] =
  GEMINI_IMAGE_SIZE_OPTIONS.filter((item) => item.size !== '0.5K')

export const GPT_TIER_GROUP_LABELS: Record<
  (typeof RESOLUTION_TIERS)[number],
  string
> = {
  '1K': 'Classic aspect ratios',
  '2K': 'HD aspect ratios',
  '4K': 'Ultra HD aspect ratios',
}

export type GptSizeGroupItem = {
  size: string
  ratio: string
  resolution: string
  hint?: string
}

export type GptSizeGroup = {
  id: 'sizes'
  label: string
  items: GptSizeGroupItem[]
}

export function buildGptSizeGroups(
  tier: (typeof RESOLUTION_TIERS)[number]
): GptSizeGroup[] {
  return [
    {
      id: 'sizes',
      label: GPT_TIER_GROUP_LABELS[tier],
      items: RESOLUTION_SIZE_MAP[tier].map((item) => ({
        size: item.size,
        ratio: item.ratio,
        resolution: item.label,
        hint: item.hint,
      })),
    },
  ]
}

// OpenAI image quality levels (in display order).
export const QUALITIES = ['low', 'medium', 'high', 'auto'] as const
