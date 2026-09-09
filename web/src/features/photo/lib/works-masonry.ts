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

const ASPECT_RATIO_PATTERN = /^(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)$/i
const CAPTION_WEIGHT = 0.62

export type AspectRatioParts = { w: number; h: number }

export function parseMediaAspectRatio(
  ratio?: string | null,
  fallback: AspectRatioParts = { w: 3, h: 4 }
): AspectRatioParts {
  const match = ASPECT_RATIO_PATTERN.exec((ratio ?? '').trim())
  if (!match) return fallback
  const w = Number(match[1])
  const h = Number(match[2])
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return fallback
  }
  return { w, h }
}

export function mediaAspectRatioCss(
  ratio?: string | null,
  fallback?: AspectRatioParts
): string {
  const parts = parseMediaAspectRatio(ratio, fallback)
  return `${parts.w} / ${parts.h}`
}

export function clampFeedCoverAspect(
  ratio?: string | null,
  fallback?: AspectRatioParts
): AspectRatioParts {
  const parts = parseMediaAspectRatio(ratio, fallback)
  if (parts.w / parts.h > 4 / 3) {
    return { w: 4, h: 3 }
  }
  if (parts.h / parts.w > 4 / 3) {
    return { w: 3, h: 4 }
  }
  return parts
}

export function feedCoverAspectCss(
  ratio?: string | null,
  fallback?: AspectRatioParts
): string {
  const parts = clampFeedCoverAspect(ratio, fallback)
  return `${parts.w} / ${parts.h}`
}

export function masonryItemWeight(
  ratio?: string | null,
  fallback?: AspectRatioParts
): number {
  const parts = parseMediaAspectRatio(ratio, fallback)
  return parts.h / parts.w + CAPTION_WEIGHT
}

export function feedCoverWeight(
  ratio?: string | null,
  fallback?: AspectRatioParts
): number {
  const parts = clampFeedCoverAspect(ratio, fallback)
  return parts.h / parts.w + CAPTION_WEIGHT
}

export function photoCoverAspectFromSnapshot(params?: {
  aspectRatio?: string
  customWidth?: number
  customHeight?: number
} | null): string {
  if (params?.aspectRatio) return params.aspectRatio
  const width = params?.customWidth
  const height = params?.customHeight
  if (
    typeof width === 'number' &&
    typeof height === 'number' &&
    width > 0 &&
    height > 0
  ) {
    return `${width} / ${height}`
  }
  return '3 / 4'
}

export function masonryColumnCountForWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 2
  const gap = 10
  const minCardWidth = 240
  const count = Math.floor((width + gap) / (minCardWidth + gap))
  return Math.min(5, Math.max(2, count))
}

export function coverFocusPosition(id: string): string {
  let hash = 2166136261
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const x = 25 + Math.abs(hash % 51)
  const y = 20 + Math.abs((hash >>> 8) % 61)
  return `${x}% ${y}%`
}

export function packMasonryColumns<T>(
  items: T[],
  columnCount: number,
  itemWeight: (item: T) => number
): T[][] {
  const count = Math.max(1, columnCount)
  const columns: T[][] = Array.from({ length: count }, () => [])
  const weights = Array.from({ length: count }, () => 0)
  for (const item of items) {
    let index = 0
    for (let i = 1; i < count; i += 1) {
      if (weights[i] < weights[index]) index = i
    }
    columns[index].push(item)
    weights[index] += itemWeight(item)
  }
  return columns
}
