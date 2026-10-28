import { formatCurrencyFromUSD } from '@/lib/currency'

import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { getConfiguredGroupRatio, getDisplayGroupRatio } from './model-helpers'

// ----------------------------------------------------------------------------
// Price Calculation Utilities
// ----------------------------------------------------------------------------

/**
 * Strip trailing zeros from formatted price string while preserving currency symbols
 */
export function stripTrailingZeros(formatted: string): string {
  // Match currency symbol at start, number, and potential 'k' suffix
  const match = formatted.match(/^([^\d-]*)([-\d,]+\.?\d*)(k?)$/)
  if (!match) return formatted

  const [, symbol, number, suffix] = match

  // Remove commas for processing
  const cleanNumber = number.replaceAll(',', '')

  // Convert to number and back to remove trailing zeros
  const parsed = Number.parseFloat(cleanNumber)
  if (Number.isNaN(parsed)) return formatted

  // Convert to string, which automatically removes trailing zeros
  let result = parsed.toString()

  // If the result is in scientific notation, format it properly
  if (result.includes('e')) {
    result = parsed.toFixed(20).replace(/\.?0+$/, '')
  }

  return `${symbol}${result}${suffix}`
}

/**
 * Calculate token price in USD.
 *
 * Returns NaN when the required ratio field is missing/null so callers can
 * skip rendering that price type.
 */
function calculateTokenPrice(
  model: PricingModel,
  type: PriceType,
  ratio: number
): number {
  const base = model.model_ratio * 2 * ratio

  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * model.completion_ratio
    case 'cache':
      return hasRatio(model.cache_ratio)
        ? base * Number(model.cache_ratio)
        : Number.NaN
    case 'create_cache':
      return hasRatio(model.create_cache_ratio)
        ? base * Number(model.create_cache_ratio)
        : Number.NaN
    case 'image':
      return hasRatio(model.image_ratio)
        ? base * Number(model.image_ratio)
        : Number.NaN
    case 'audio_input':
      return hasRatio(model.audio_ratio)
        ? base * Number(model.audio_ratio)
        : Number.NaN
    case 'audio_output':
      return hasRatio(model.audio_ratio) &&
        hasRatio(model.audio_completion_ratio)
        ? base *
            Number(model.audio_ratio) *
            Number(model.audio_completion_ratio)
        : Number.NaN
  }
}

function hasRatio(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

/**
 * Apply recharge rate to price
 *
 * priceRate represents how much users need to recharge (in the display currency)
 * to get 1 USD credit. usdExchangeRate is the real exchange rate.
 *
 * The returned value will be formatted by formatCurrencyFromUSD, which will
 * multiply by the display currency's exchange rate.
 *
 * Examples:
 *
 * 1. Display currency = USD:
 *    - Model: 1 USD
 *    - priceRate = 0.5 (recharge $0.5 to get $1 credit)
 *    - usdExchangeRate = 1
 *    - Return: 1 × 0.5 / 1 = 0.5
 *    - formatCurrencyFromUSD(0.5) → $0.5 ✓
 *
 * 2. Display currency = CNY:
 *    - Model: 1 USD
 *    - priceRate = 4 (recharge ¥4 to get $1 credit)
 *    - usdExchangeRate = 7 (real rate: 1 USD = ¥7)
 *    - Return: 1 × 4 / 7 = 0.571
 *    - formatCurrencyFromUSD(0.571) → 0.571 × 7 = ¥4 ✓
 *    - Normal price: ¥7, Recharge price: ¥4 (cheaper!)
 */
function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

/**
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = calculateTokenPrice(model, type, displayGroupRatio)
  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format price for a specific group (token-based)
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = calculateTokenPrice(model, type, ratio)

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = (model.model_price || 0) * ratio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = (model.model_price || 0) * displayGroupRatio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

const RESOLUTION_SORT_ORDER = [
  '360P',
  '480P',
  '512P',
  '540P',
  '720P',
  '768P',
  '1080P',
  '2K',
  '4K',
] as const

export type ResolutionPriceEntry = {
  resolution: string
  price: number
}

function resolutionSortIndex(label: string): number {
  const index = (RESOLUTION_SORT_ORDER as readonly string[]).indexOf(label)
  if (index === -1) return RESOLUTION_SORT_ORDER.length
  return index
}

export function getResolutionPriceEntries(
  model: PricingModel
): ResolutionPriceEntry[] {
  const prices = model.resolution_price
  if (!prices) return []

  const entries: ResolutionPriceEntry[] = []
  for (const [resolution, price] of Object.entries(prices)) {
    const label = resolution.trim()
    if (!label || !Number.isFinite(price) || price < 0) continue
    entries.push({ resolution: label, price })
  }

  return [...entries].sort((left, right) => {
    const leftIndex = resolutionSortIndex(left.resolution)
    const rightIndex = resolutionSortIndex(right.resolution)
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.resolution.localeCompare(right.resolution)
  })
}

export function isResolutionPricingModel(model: PricingModel): boolean {
  return (
    model.billing_mode === 'resolution' &&
    getResolutionPriceEntries(model).length > 0
  )
}

/**
 * 逐分辨率「有视频输入单价」覆盖（元/百万 token）。
 * 仅使用显式配置的键（归一化匹配），未配置返回 undefined，
 * 由调用方回退「全局两档单价的倍率」换算。
 */
export function getResolutionVideoPrice(
  model: PricingModel,
  resolution: string
): number | undefined {
  const resolutions = model.video_input_resolutions
  if (!resolutions || !resolution) return undefined
  const want = resolution.trim().toLowerCase()
  if (resolutions[resolution] !== undefined) return resolutions[resolution]
  for (const [key, price] of Object.entries(resolutions)) {
    if (key.trim().toLowerCase() === want && Number.isFinite(price)) {
      return price
    }
  }
  return undefined
}

export type VideoInputPriceEntry = {
  key: 'no_video' | 'video'
  labelKey: string
  price: number
}

/**
 * 视频输入计费两档单价（按 token 计费的模型才有意义）：
 * 无视频输入 / 有视频输入（元/百万 token）。
 */
export function getVideoInputPriceEntries(
  model: PricingModel
): VideoInputPriceEntry[] {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) return []
  const prices = model.video_input_price
  if (!prices) return []

  const entries: VideoInputPriceEntry[] = []
  const noVideo = Number(prices.no_video)
  const video = Number(prices.video)
  if (Number.isFinite(noVideo) && noVideo > 0) {
    entries.push({
      key: 'no_video',
      labelKey: 'No video input price',
      price: noVideo,
    })
  }
  if (Number.isFinite(video) && video > 0) {
    entries.push({
      key: 'video',
      labelKey: 'With video input price',
      price: video,
    })
  }
  return entries
}

export function isVideoInputPricingModel(model: PricingModel): boolean {
  return getVideoInputPriceEntries(model).length > 0
}

// 视频输入单价按 CNY（元/百万 token）配置，定价页统一以 USD 中转展示，
// 由 formatCurrencyFromUSD 按展示货币换回。
export function formatVideoInputDisplayPrice(
  model: PricingModel,
  cnyPrice: number,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string
): string {
  const rate = usdExchangeRate > 0 ? usdExchangeRate : 1
  return formatResolutionDisplayPrice(
    model,
    cnyPrice / rate,
    showWithRecharge,
    priceRate,
    rate,
    selectedGroup
  )
}

export function formatVideoInputGroupPrice(
  cnyPrice: number,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  const rate = usdExchangeRate > 0 ? usdExchangeRate : 1
  return formatResolutionGroupPrice(
    cnyPrice / rate,
    group,
    showWithRecharge,
    priceRate,
    rate,
    groupRatio
  )
}

function formatUsdRequestAmount(
  priceInUSD: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): string {
  return formatCurrencyFromUSD(
    applyRechargeRate(priceInUSD, showWithRecharge, priceRate, usdExchangeRate),
    {
      digitsLarge: 4,
      digitsSmall: 4,
      abbreviate: false,
    }
  )
}

export function formatResolutionDisplayPrice(
  model: PricingModel,
  usdPrice: number,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string
): string {
  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)
  return formatUsdRequestAmount(
    usdPrice * displayGroupRatio,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )
}

export function formatResolutionGroupPrice(
  usdPrice: number,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  const ratio = getConfiguredGroupRatio(groupRatio, group)
  return formatUsdRequestAmount(
    usdPrice * ratio,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )
}
