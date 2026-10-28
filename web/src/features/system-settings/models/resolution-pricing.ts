export const RESOLUTION_PRESETS = [
  '480P',
  '720P',
  '768P',
  '1K',
  '1080P',
  '2K',
  '4K',
] as const

export type ResolutionPriceRow = {
  id: string
  resolution: string
  /** 无视频输入单价（按 token 模式下即分辨率基准价；按秒模式为每秒单价）。 */
  price: string
  /** 有视频输入单价（仅按 token 模式使用；留空时按全局两档倍率换算）。 */
  videoPrice: string
}

export type ResolutionPriceMap = Record<string, number>

/** 视频计费单位：按秒 / 按百万 token */
export type ResolutionBillingUnit = 'second' | 'million_tokens'

export const DEFAULT_RESOLUTION_BILLING_UNIT: ResolutionBillingUnit = 'second'

export const RESOLUTION_BILLING_UNITS: ResolutionBillingUnit[] = [
  'second',
  'million_tokens',
]

export function normalizeResolutionBillingUnit(
  value?: string
): ResolutionBillingUnit {
  return value === 'million_tokens'
    ? 'million_tokens'
    : DEFAULT_RESOLUTION_BILLING_UNIT
}

export function isTokenBillingUnit(unit?: string): boolean {
  return normalizeResolutionBillingUnit(unit) === 'million_tokens'
}

/**
 * Seedance 系列自带 token 预估与倍率计费，后端不会套用这里的
 * 「按百万 token」分辨率单价，界面需要提示管理员。
 */
export function isSeedanceModel(name?: string): boolean {
  return /seedance/i.test(name ?? '')
}

const VIDEO_MODEL_PATTERN =
  /seedance|kling|keling|vidu|hailuo|veo|sora|jimeng|cogvideo|pixverse|runway|gen-?[345]|pika|luma|wan\d|wanx|video-?01|t2v|i2v|v2v/i

/**
 * 视频类模型判定：名称含已知视频模型家族或直接含 video。
 * 用于在价格编辑页显示「无视频输入 / 有视频输入」两档单价配置。
 */
export function isVideoModel(name?: string): boolean {
  const value = (name ?? '').trim().toLowerCase()
  if (!value) return false
  return value.includes('video') || VIDEO_MODEL_PATTERN.test(value)
}

/** 某分辨率的「无视频 / 有视频」两档单价（按 token 计费专用表）。 */
export type ResolutionTierPrice = {
  no_video: number
  video: number
}

/** Seedance 视频输入计费配置：无视频输入 / 有视频输入单价（¥/百万 token）。
 *  resolutions 为按 token 计费的逐分辨率两档单价表（与按秒的 resolution_price 独立）。 */
export type VideoInputPriceConfig = {
  no_video: number
  video: number
  resolutions?: Record<string, ResolutionTierPrice>
}

export type VideoInputPriceMap = Record<string, VideoInputPriceConfig>

/**
 * Seedance 官方刊例价（火山方舟，¥/百万 token，480p/720p 基准档）。
 * 与后端 task/doubao 价格表保持一致；未配置时后端按此计费。
 */
export const SEEDANCE_OFFICIAL_VIDEO_PRICES: VideoInputPriceMap = {
  'doubao-seedance-2-0': { no_video: 46, video: 28 },
  'doubao-seedance-2-0-fast': { no_video: 37, video: 22 },
  'doubao-seedance-2-0-mini': { no_video: 23, video: 14 },
  'doubao-seedance-2-5': { no_video: 70, video: 42 },
}

/** 与后端 resolveVideoPriceModel 一致：把调用名归一到价格表规范名。 */
export function resolveSeedanceCanonicalModel(name?: string): string {
  const value = (name ?? '').trim().toLowerCase().replaceAll('.', '-')
  if (value.includes('seedance-2-5')) return 'doubao-seedance-2-5'
  if (value.includes('seedance-2-0-mini')) return 'doubao-seedance-2-0-mini'
  if (value.includes('seedance-2-0-fast')) return 'doubao-seedance-2-0-fast'
  if (value.includes('seedance-2-0')) return 'doubao-seedance-2-0'
  return name ?? ''
}

/** 返回该模型可自动填入的官方刊例价；未收录的模型返回 undefined。 */
export function getSeedanceOfficialPrices(
  name?: string
): VideoInputPriceConfig | undefined {
  return SEEDANCE_OFFICIAL_VIDEO_PRICES[resolveSeedanceCanonicalModel(name)]
}

/** 解析 billing_setting.video_input_price 选项 JSON。 */
export function parseVideoInputPriceMap(raw?: string): VideoInputPriceMap {
  if (!raw || !raw.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const out: VideoInputPriceMap = {}
    for (const [model, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const record = value as Record<string, unknown>
      const noVideo = Number(record.no_video)
      const video = Number(record.video)
      const rawResolutions = record.resolutions
      let resolutions: Record<string, ResolutionTierPrice> | undefined
      if (rawResolutions && typeof rawResolutions === 'object') {
        for (const [res, tier] of Object.entries(
          rawResolutions as Record<string, unknown>
        )) {
          if (!tier || typeof tier !== 'object') continue
          const tierRecord = tier as Record<string, unknown>
          const noVideoPrice = Number(tierRecord.no_video)
          const videoPrice = Number(tierRecord.video)
          if (
            !Number.isFinite(noVideoPrice) &&
            !Number.isFinite(videoPrice)
          ) {
            continue
          }
          ;(resolutions ??= {})[res] = {
            no_video: Number.isFinite(noVideoPrice) ? noVideoPrice : 0,
            video: Number.isFinite(videoPrice) ? videoPrice : 0,
          }
        }
      }
      if (
        !Number.isFinite(noVideo) &&
        !Number.isFinite(video) &&
        !resolutions
      ) {
        continue
      }
      out[model] = {
        no_video: Number.isFinite(noVideo) ? noVideo : 0,
        video: Number.isFinite(video) ? video : 0,
        ...(resolutions && Object.keys(resolutions).length > 0
          ? { resolutions }
          : {}),
      }
    }
    return out
  } catch {
    return {}
  }
}

// 与上游（火山方舟 / Seedance）一致的口径：
// tokens = 时长(秒) × 宽 × 高 × 24fps / 1024
export const VIDEO_TOKEN_FPS = 24
export const VIDEO_TOKEN_PIXEL_DIVISOR = 1024

const RESOLUTION_HEIGHTS: Record<string, number> = {
  '360P': 360,
  '480P': 480,
  '512P': 512,
  '540P': 540,
  '720P': 720,
  '768P': 768,
  '1K': 1080,
  '1080P': 1080,
  '2K': 1440,
  '4K': 2160,
}

function resolutionHeight(resolution: string): number {
  const label = normalizeResolutionLabel(resolution)
  const height = RESOLUTION_HEIGHTS[label]
  if (height) return height
  const digits = Number(label.replace(/P$/, ''))
  return Number.isFinite(digits) && digits > 0 ? digits : 720
}

function aspectRatioValue(aspect = '16:9'): [number, number] {
  const parts = aspect.trim().toLowerCase().split(':')
  if (parts.length !== 2) return [16, 9]
  const width = Number(parts[0])
  const height = Number(parts[1])
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [16, 9]
  }
  return [width, height]
}

/** 估算视频 token 数（用于预扣展示，结算以上游返回 usage 为准）。 */
export function estimateVideoTokens(
  resolution: string,
  seconds: number,
  aspect = '16:9'
): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  const height = resolutionHeight(resolution)
  const [aw, ah] = aspectRatioValue(aspect)
  const rawWidth = Math.round((height * aw) / ah)
  const width = rawWidth % 2 === 0 ? rawWidth : rawWidth + 1
  const tokens =
    (seconds * width * height * VIDEO_TOKEN_FPS) / VIDEO_TOKEN_PIXEL_DIVISOR
  return Math.max(1, Math.round(tokens))
}

export function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return '0'
  return Math.round(tokens).toLocaleString('en-US')
}

let resolutionRowSeq = 0

export function createResolutionRow(
  resolution = '',
  price = '',
  videoPrice = ''
): ResolutionPriceRow {
  resolutionRowSeq += 1
  return { id: `res-${resolutionRowSeq}`, resolution, price, videoPrice }
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

  if (value === '1k') return '1K'
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

/** 按 token 逐分辨率两档表 → 编辑器行（price = 无视频价，videoPrice = 有视频价）。 */
export function rowsFromTokenResolutions(
  resolutions?: Record<string, ResolutionTierPrice>
): ResolutionPriceRow[] {
  if (!resolutions) return []
  return Object.entries(resolutions).map(([resolution, tier]) =>
    createResolutionRow(
      normalizeResolutionLabel(resolution) || resolution,
      tier.no_video > 0 ? String(tier.no_video) : '',
      tier.video > 0 ? String(tier.video) : ''
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

/**
 * 「按 token」模式下分辨率单价整表可选：
 *   - 全部价格为空 → configured: false（不保存，沿用两档视频输入单价计费）；
 *   - 任一价格已填 → 要求整表有效（非空、非负、不重复），否则 prices 为 null。
 */
export function optionalResolutionPricesFromRows(rows: ResolutionPriceRow[]): {
  configured: boolean
  prices: ResolutionPriceMap | null
} {
  const hasAnyPrice = rows.some((row) => row.price.trim() !== '')
  if (!hasAnyPrice) return { configured: false, prices: null }
  return { configured: true, prices: resolutionPricesFromRows(rows) }
}

/**
 * 「按 token」逐分辨率两档表（独立于按秒的 resolution_price）：
 *   - 全部（无视频价 + 有视频价）留空 → configured: false，不保存；
 *   - 任一已填 → 要求每行的无视频价有效（非空、非负、不重复），
 *     有视频价可逐行留空（留空回退全局两档倍率）；非法时 tiers 为 null。
 */
export function tokenResolutionTiersFromRows(rows: ResolutionPriceRow[]): {
  configured: boolean
  tiers: Record<string, ResolutionTierPrice> | null
} {
  const hasAny = rows.some(
    (row) => row.price.trim() !== '' || row.videoPrice.trim() !== ''
  )
  if (!hasAny) return { configured: false, tiers: null }

  const next: Record<string, ResolutionTierPrice> = {}
  const seen = new Set<string>()
  for (const row of rows) {
    const resolution = normalizeResolutionLabel(row.resolution)
    if (!resolution) continue
    const rawNoVideo = row.price.trim()
    if (rawNoVideo === '') return { configured: true, tiers: null }
    const noVideo = Number(rawNoVideo)
    if (!Number.isFinite(noVideo) || noVideo < 0) {
      return { configured: true, tiers: null }
    }
    const rawVideo = row.videoPrice.trim()
    let video = 0
    if (rawVideo !== '') {
      video = Number(rawVideo)
      if (!Number.isFinite(video) || video < 0) {
        return { configured: true, tiers: null }
      }
    }
    if (seen.has(resolution)) return { configured: true, tiers: null }
    seen.add(resolution)
    next[resolution] = { no_video: noVideo, video }
  }

  if (Object.keys(next).length === 0) return { configured: true, tiers: null }
  return { configured: true, tiers: next }
}

export function defaultResolutionPrice(
  prices: ResolutionPriceMap
): number | undefined {
  if (Number.isFinite(prices['720P'])) return prices['720P']
  if (Number.isFinite(prices['720p'])) return prices['720p']
  const first = Object.values(prices)[0]
  return Number.isFinite(first) ? first : undefined
}
