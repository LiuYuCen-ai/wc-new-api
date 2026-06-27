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
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
    description: 'Google multimodal image generation (high quality)',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    imageSizes: ['1K', '2K', '4K'],
    supportsN: false,
    supportsSize: false,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Preview',
    description: 'Google multimodal image generation (fast)',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'],
    imageSizes: ['1K', '2K', '4K'],
    supportsN: false,
    supportsSize: false,
  },
]

export const ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '21:9',
] as const

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
// 1K = standard, 2K = enhanced, 4K = ultra HD.
export const RESOLUTION_TIERS = ['1K', '2K', '4K'] as const

export type ResolutionOption = {
  // Internal size key passed to the backend / OpenAI images API
  size: string
  // Aspect ratio label shown on top of the tile (e.g. "1:1", "16:9")
  ratio: string
  // Pixel resolution shown on the bottom of the tile (e.g. "1024x1024")
  label: string
}

export const RESOLUTION_SIZE_MAP: Record<
  (typeof RESOLUTION_TIERS)[number],
  ResolutionOption[]
> = {
  // 1K – base values, as shown in the reference screenshot.
  '1K': [
    { size: 'auto', ratio: 'Auto', label: 'Auto' },
    { size: '1024x1024', ratio: '1:1', label: '1024x1024' },
    { size: '1536x1024', ratio: '3:2', label: '1536x1024' },
    { size: '1024x1536', ratio: '2:3', label: '1024x1536' },
    { size: '1024x1360', ratio: '3:4', label: '1024x1360' },
    { size: '1360x1024', ratio: '4:3', label: '1360x1024' },
    { size: '1792x1024', ratio: '16:9', label: '1792x1024' },
    { size: '1024x1792', ratio: '9:16', label: '1024x1792' },
  ],
  // 2K – every 1K dimension × 2.
  '2K': [
    { size: 'auto', ratio: 'Auto', label: 'Auto' },
    { size: '2048x2048', ratio: '1:1', label: '2048x2048' },
    { size: '3072x2048', ratio: '3:2', label: '3072x2048' },
    { size: '2048x3072', ratio: '2:3', label: '2048x3072' },
    { size: '2048x2720', ratio: '3:4', label: '2048x2720' },
    { size: '2720x2048', ratio: '4:3', label: '2720x2048' },
    { size: '3584x2048', ratio: '16:9', label: '3584x2048' },
    { size: '2048x3584', ratio: '9:16', label: '2048x3584' },
  ],
  // 4K – 按照用户提供的图片比例配置
  '4K': [
    { size: 'auto', ratio: 'Auto', label: '4096x4096' },
    { size: '4096x4096', ratio: '1:1', label: '4096x4096' },
    { size: '3840x2560', ratio: '3:2', label: '3840x2560' },
    { size: '2560x3840', ratio: '2:3', label: '2560x3840' },
    { size: '2880x3840', ratio: '3:4', label: '2880x3840' },
    { size: '3840x2880', ratio: '4:3', label: '3840x2880' },
    { size: '3840x2160', ratio: '16:9', label: '3840x2160' },
    { size: '2160x3840', ratio: '9:16', label: '2160x3840' },
  ],
}

// OpenAI image quality levels (in display order).
export const QUALITIES = ['low', 'medium', 'high', 'auto'] as const
