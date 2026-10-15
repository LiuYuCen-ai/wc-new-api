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
export const RESOLUTION_PRESETS = [
  '480P',
  '720P',
  '768P',
  '1080P',
  '2K',
  '4K',
] as const

export type ResolutionPriceRow = {
  id: string
  resolution: string
  price: string
}

export type ResolutionPriceMap = Record<string, number>

let resolutionRowSeq = 0

export function createResolutionRow(
  resolution = '',
  price = ''
): ResolutionPriceRow {
  resolutionRowSeq += 1
  return { id: `res-${resolutionRowSeq}`, resolution, price }
}

/** Canonical pricing labels match Ali/MiniMax docs: 720P, 768P, 2K, 4K. */
export function normalizeResolutionLabel(raw: string): string {
  const value = raw.trim().toLowerCase().replaceAll(/\s+/g, '')
  if (!value) return ''

  const dimMatch = value.match(/^(\d+)[x*](\d+)$/)
  if (dimMatch) {
    const width = Number(dimMatch[1])
    const height = Number(dimMatch[2])
    return heightToResolution(Math.min(width, height))
  }

  if (value === '2k' || value === '1440p' || value === '1440') return '2K'
  if (value === '4k' || value === '2160p' || value === '2160') return '4K'

  const digits = value.endsWith('p') ? value.slice(0, -1) : value
  if (/^\d+$/.test(digits)) return heightToResolution(Number(digits))
  return value.toUpperCase()
}

function heightToResolution(height: number): string {
  switch (height) {
    case 360:
      return '360P'
    case 480:
      return '480P'
    case 512:
      return '512P'
    case 540:
      return '540P'
    case 720:
      return '720P'
    case 768:
      return '768P'
    case 1080:
      return '1080P'
    case 1440:
      return '2K'
    case 2160:
      return '4K'
    default:
      return `${height}P`
  }
}

export function rowsFromResolutionPrices(
  prices?: ResolutionPriceMap
): ResolutionPriceRow[] {
  if (!prices) return []
  return Object.entries(prices).map(([resolution, price]) =>
    createResolutionRow(
      normalizeResolutionLabel(resolution) || resolution,
      String(price)
    )
  )
}

export function resolutionPricesFromRows(
  rows: ResolutionPriceRow[]
): ResolutionPriceMap | null {
  const next: ResolutionPriceMap = {}
  const seen = new Set<string>()

  for (const row of rows) {
    const resolution = normalizeResolutionLabel(row.resolution)
    if (!resolution) continue
    const rawPrice = row.price.trim()
    if (rawPrice === '') return null
    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price < 0) return null
    if (seen.has(resolution)) return null
    seen.add(resolution)
    next[resolution] = price
  }

  if (Object.keys(next).length === 0) return null
  return next
}

export function defaultResolutionPrice(
  prices: ResolutionPriceMap
): number | undefined {
  if (Number.isFinite(prices['720P'])) return prices['720P']
  if (Number.isFinite(prices['720p'])) return prices['720p']
  const first = Object.values(prices)[0]
  return Number.isFinite(first) ? first : undefined
}
