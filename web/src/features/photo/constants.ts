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
import type { PhotoAspectRatio, PhotoImageSize } from './types'

export const SEEDREAM_MODEL_IDS = {
  PRO: 'doubao-seedream-5-0-pro-260628',
  STANDARD: 'doubao-seedream-4-0-250828',
} as const

export const ASPECT_RATIOS = [
  '1:1',
  '16:9',
  '9:16',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '21:9',
] as const satisfies readonly PhotoAspectRatio[]

export const SEEDREAM_CUSTOM_SIZE = {
  MIN: 512,
  MAX: 4096,
} as const

export type SeedreamAspectRatioOption = {
  ratio: PhotoAspectRatio
  hint: string
}

export const SEEDREAM_ASPECT_RATIO_OPTIONS: SeedreamAspectRatioOption[] = [
  { ratio: '1:1', hint: 'Square · avatar & social posts' },
  { ratio: '16:9', hint: 'Widescreen · wallpaper & video' },
  { ratio: '9:16', hint: 'Portrait · mobile & short video' },
  { ratio: '4:3', hint: 'Standard photo · e-commerce' },
  { ratio: '3:4', hint: 'Portrait · product showcase' },
  { ratio: '3:2', hint: 'DSLR · photography & print' },
  { ratio: '2:3', hint: 'Portrait · photo prints' },
  { ratio: '21:9', hint: 'Ultrawide · cinematic' },
]

// Pixel sizes stay within a 4096 long-edge so Seedream 4/5 requests remain valid.
export const SEEDREAM_PIXEL_SIZE_MAP: Record<
  '1K' | '2K' | '4K',
  Record<PhotoAspectRatio, string>
> = {
  '1K': {
    '1:1': '1024x1024',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '16:9': '1280x720',
    '9:16': '720x1280',
    '3:2': '1248x832',
    '2:3': '832x1248',
    '21:9': '1512x648',
  },
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2560x1440',
    '9:16': '1440x2560',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3024x1296',
  },
  '4K': {
    '1:1': '4096x4096',
    '4:3': '4096x3072',
    '3:4': '3072x4096',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '3:2': '4096x2730',
    '2:3': '2730x4096',
    '21:9': '4096x1754',
  },
}

export function parsePixelSize(
  size: string
): { width: number; height: number } | null {
  const match = /^(\d+)x(\d+)$/i.exec(size.trim())
  if (!match) return null
  return { width: Number(match[1]), height: Number(match[2]) }
}

export function parseAspectRatioParts(
  ratio: PhotoAspectRatio
): { w: number; h: number } {
  const [w, h] = ratio.split(':').map(Number)
  return { w: w || 1, h: h || 1 }
}

export function clampSeedreamDimension(value: number): number {
  if (!Number.isFinite(value)) return 1024
  const rounded = Math.round(value)
  const even = rounded % 2 === 0 ? rounded : rounded + 1
  return Math.min(
    SEEDREAM_CUSTOM_SIZE.MAX,
    Math.max(SEEDREAM_CUSTOM_SIZE.MIN, even)
  )
}

export function clampSeedreamCustomSize(
  width: number,
  height: number
): { width: number; height: number } {
  let nextWidth = clampSeedreamDimension(width)
  let nextHeight = clampSeedreamDimension(height)
  const maxArea = SEEDREAM_CUSTOM_SIZE.MAX * SEEDREAM_CUSTOM_SIZE.MAX
  if (nextWidth * nextHeight <= maxArea) {
    return { width: nextWidth, height: nextHeight }
  }

  const scale = Math.sqrt(maxArea / (nextWidth * nextHeight))
  nextWidth = clampSeedreamDimension(nextWidth * scale)
  nextHeight = clampSeedreamDimension(nextHeight * scale)
  return { width: nextWidth, height: nextHeight }
}

export function sizeFromCustomDimensions(width: number, height: number): string {
  const next = clampSeedreamCustomSize(width, height)
  return `${next.width}x${next.height}`
}

export const PIXEL_TIER_LONG_EDGE: Record<string, number> = {
  '1K': 1024,
  '2K': 2048,
  '4K': 4096,
  '720P': 1280,
  '1080P': 1920,
}

export function sizeFromLongEdge(
  longEdge: number,
  aspectRatio: PhotoAspectRatio
): string {
  const { w, h } = parseAspectRatioParts(aspectRatio)
  if (w >= h) {
    return sizeFromCustomDimensions(longEdge, (longEdge * h) / w)
  }
  return sizeFromCustomDimensions((longEdge * w) / h, longEdge)
}

export function resolvePhotoSize(
  imageSize: PhotoImageSize,
  aspectRatio: PhotoAspectRatio,
  custom?: { width: number; height: number }
): string {
  if (imageSize === 'custom') {
    return sizeFromCustomDimensions(
      custom?.width ?? 2048,
      custom?.height ?? 2048
    )
  }
  if (imageSize === '1K' || imageSize === '2K' || imageSize === '4K') {
    return SEEDREAM_PIXEL_SIZE_MAP[imageSize]?.[aspectRatio] ?? '2048x2048'
  }
  if (parsePixelSize(imageSize)) {
    return imageSize
  }
  const longEdge = PIXEL_TIER_LONG_EDGE[imageSize.toUpperCase()]
  if (longEdge) {
    return sizeFromLongEdge(longEdge, aspectRatio)
  }
  return imageSize || '2048x2048'
}

export function isSeedreamAspectRatio(value: string): value is PhotoAspectRatio {
  return ASPECT_RATIOS.some((ratio) => ratio === value)
}
