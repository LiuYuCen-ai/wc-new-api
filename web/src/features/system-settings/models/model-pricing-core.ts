import * as z from 'zod'

import { combineBillingExpr } from '@/features/pricing/lib/billing-expr'
import { getBillingCurrencySymbol } from '@/lib/currency'

import { formatPricingNumber } from './pricing-format'
import {
  isTokenBillingUnit,
  normalizeResolutionLabel,
  type ResolutionBillingUnit,
  type VideoInputPriceConfig,
} from './resolution-pricing'

export const createModelPricingSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('Model name is required')),
    price: z.string().optional(),
    ratio: z.string().optional(),
    cacheRatio: z.string().optional(),
    createCacheRatio: z.string().optional(),
    completionRatio: z.string().optional(),
    imageRatio: z.string().optional(),
    audioRatio: z.string().optional(),
    audioCompletionRatio: z.string().optional(),
  })

export type ModelPricingFormValues = z.infer<
  ReturnType<typeof createModelPricingSchema>
>

export type PricingMode =
  | 'per-token'
  | 'per-request'
  | 'tiered_expr'
  | 'resolution'

export type LaneKey =
  | 'completion'
  | 'cache'
  | 'createCache'
  | 'image'
  | 'audioInput'
  | 'audioOutput'

export type ModelRatioData = {
  name: string
  price?: string
  ratio?: string
  cacheRatio?: string
  createCacheRatio?: string
  completionRatio?: string
  imageRatio?: string
  audioRatio?: string
  audioCompletionRatio?: string
  billingMode?: PricingMode
  billingExpr?: string
  requestRuleExpr?: string
  resolutionPrices?: Record<string, number>
  resolutionUnit?: ResolutionBillingUnit
  /** Seedance 视频输入计费覆盖（¥/百万 token）；未设置时按官方刊例价计费。 */
  videoInputPrice?: VideoInputPriceConfig | null
}

export type PreviewRow = {
  key: string
  label: string
  value: string
  multiline?: boolean
}

export const numericDraftRegex = /^(\d+(\.\d*)?|\.\d*)?$/

export const EMPTY_LANE_PRICES: Record<LaneKey, string> = {
  completion: '',
  cache: '',
  createCache: '',
  image: '',
  audioInput: '',
  audioOutput: '',
}

export const EMPTY_LANE_ENABLED: Record<LaneKey, boolean> = {
  completion: false,
  cache: false,
  createCache: false,
  image: false,
  audioInput: false,
  audioOutput: false,
}

export const ratioFieldByLane: Record<LaneKey, keyof ModelPricingFormValues> = {
  completion: 'completionRatio',
  cache: 'cacheRatio',
  createCache: 'createCacheRatio',
  image: 'imageRatio',
  audioInput: 'audioRatio',
  audioOutput: 'audioCompletionRatio',
}

export const laneConfigs: Array<{
  key: LaneKey
  titleKey: string
  descriptionKey: string
  placeholder: string
}> = [
  {
    key: 'completion',
    titleKey: 'Completion price',
    descriptionKey: 'Output token price for generated tokens.',
    placeholder: '15',
  },
  {
    key: 'cache',
    titleKey: 'Cache read price',
    descriptionKey: 'Token price for cache reads.',
    placeholder: '0.3',
  },
  {
    key: 'createCache',
    titleKey: 'Cache write price',
    descriptionKey: 'Token price for creating cache entries.',
    placeholder: '3.75',
  },
  {
    key: 'image',
    titleKey: 'Image input price',
    descriptionKey: 'Token price for image input.',
    placeholder: '2.5',
  },
  {
    key: 'audioInput',
    titleKey: 'Audio input price',
    descriptionKey: 'Token price for audio input.',
    placeholder: '3.81',
  },
  {
    key: 'audioOutput',
    titleKey: 'Audio output price',
    descriptionKey: 'Token price for audio output.',
    placeholder: '15.11',
  },
]

export function hasValue(value: unknown): boolean {
  return (
    value !== '' && value !== null && value !== undefined && value !== false
  )
}

export function toNumberOrNull(value: unknown): number | null {
  if (!hasValue(value) && value !== 0) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function ratioToBasePrice(ratio: unknown): string {
  const num = toNumberOrNull(ratio)
  if (num === null) return ''
  return formatPricingNumber(num * 2)
}

function deriveLanePrice(
  ratio: unknown,
  denominator: unknown,
  fallback = ''
): string {
  const ratioNumber = toNumberOrNull(ratio)
  const denominatorNumber = toNumberOrNull(denominator)
  if (ratioNumber === null || denominatorNumber === null) return fallback
  return formatPricingNumber(ratioNumber * denominatorNumber)
}

export function createInitialLaneState(data?: ModelRatioData | null) {
  if (!data) {
    return {
      promptPrice: '',
      prices: { ...EMPTY_LANE_PRICES },
      enabled: { ...EMPTY_LANE_ENABLED },
    }
  }

  const promptPrice = ratioToBasePrice(data.ratio)
  const audioInputPrice = deriveLanePrice(data.audioRatio, promptPrice)
  const prices: Record<LaneKey, string> = {
    completion: deriveLanePrice(data.completionRatio, promptPrice),
    cache: deriveLanePrice(data.cacheRatio, promptPrice),
    createCache: deriveLanePrice(data.createCacheRatio, promptPrice),
    image: deriveLanePrice(data.imageRatio, promptPrice),
    audioInput: audioInputPrice,
    audioOutput: deriveLanePrice(data.audioCompletionRatio, audioInputPrice),
  }

  return {
    promptPrice,
    prices,
    enabled: {
      completion: hasValue(data.completionRatio),
      cache: hasValue(data.cacheRatio),
      createCache: hasValue(data.createCacheRatio),
      image: hasValue(data.imageRatio),
      audioInput: hasValue(data.audioRatio),
      audioOutput: hasValue(data.audioCompletionRatio),
    },
  }
}

export function buildPreviewRows(
  values: ModelPricingFormValues,
  mode: PricingMode,
  billingExpr: string,
  requestRuleExpr: string,
  promptPrice: string,
  lanePrices: Record<LaneKey, string>,
  laneEnabled: Record<LaneKey, boolean>,
  t: (key: string) => string,
  resolutionPrices?: Record<string, number>,
  resolutionUnit?: ResolutionBillingUnit,
  videoInputPrice?: VideoInputPriceConfig | null
): PreviewRow[] {
  const videoInputRows: PreviewRow[] = videoInputPrice
    ? [
        {
          key: 'video_input_no_video',
          label: t('No video input price'),
          value: `${getBillingCurrencySymbol()}${videoInputPrice.no_video} / ${t('1M tokens')}`,
        },
        {
          key: 'video_input_video',
          label: t('With video input price'),
          value: `${getBillingCurrencySymbol()}${videoInputPrice.video} / ${t('1M tokens')}`,
        },
      ]
    : []

  if (mode === 'tiered_expr') {
    const effectiveExpr = combineBillingExpr(billingExpr, requestRuleExpr)
    return [
      ...videoInputRows,
      { key: 'mode', label: 'BillingMode', value: 'tiered_expr' },
      {
        key: 'expr',
        label: t('Expression'),
        value: effectiveExpr || t('Empty'),
        multiline: true,
      },
    ]
  }

  if (mode === 'resolution') {
    const entries = Object.entries(resolutionPrices ?? {})
    const unitLabel = isTokenBillingUnit(resolutionUnit)
      ? t('per 1M tokens')
      : t('per second')
    if (entries.length === 0) {
      // 「按 token」时不再配置分辨率单价，实际按视频输入两档单价 + token 估算计费。
      if (isTokenBillingUnit(resolutionUnit)) {
        return [
          ...videoInputRows,
          { key: 'mode', label: t('Mode'), value: t('Per-token') },
        ]
      }
      return [
        ...videoInputRows,
        { key: 'mode', label: t('Mode'), value: t('By resolution') },
        { key: 'empty', label: t('Price summary'), value: t('Empty') },
      ]
    }
    return [
      ...videoInputRows,
      {
        key: 'mode',
        label: t('Mode'),
        value: `${t('By resolution')} · ${unitLabel}`,
      },
      ...entries.map(([resolution, price]) => {
        if (!isTokenBillingUnit(resolutionUnit)) {
          return {
            key: resolution,
            label: resolution,
            value: `$${price} / ${unitLabel}`,
          }
        }
        // 按 token：逐分辨率两档价——有视频档优先取逐分辨率配置，否则按全局倍率换算。
        const tier =
          videoInputPrice?.resolutions?.[resolution] ??
          videoInputPrice?.resolutions?.[normalizeResolutionLabel(resolution)]
        let withVideo: number | undefined
        if (tier && tier.video > 0) {
          withVideo = tier.video
        } else if (
          videoInputPrice &&
          videoInputPrice.no_video > 0 &&
          videoInputPrice.video > 0
        ) {
          withVideo = price * (videoInputPrice.video / videoInputPrice.no_video)
        }
        const symbol = getBillingCurrencySymbol()
        const value =
          withVideo !== undefined
            ? `${symbol}${price} / ${symbol}${formatPricingNumber(withVideo)} (${t('No video')} / ${t('With video')}) / ${unitLabel}`
            : `${symbol}${price} / ${unitLabel}`
        return { key: resolution, label: resolution, value }
      }),
    ]
  }

  if (mode === 'per-request') {
    return [
      ...videoInputRows,
      {
        key: 'price',
        label: 'ModelPrice',
        value: values.price || t('Empty'),
      },
    ]
  }

  return [
    ...videoInputRows,
    {
      key: 'inputPrice',
      label: t('Input price'),
      value: promptPrice ? `$${promptPrice}` : t('Empty'),
    },
    {
      key: 'completion',
      label: t('Completion price'),
      value:
        laneEnabled.completion && lanePrices.completion
          ? `$${lanePrices.completion}`
          : t('Empty'),
    },
    {
      key: 'cache',
      label: t('Cache read price'),
      value:
        laneEnabled.cache && lanePrices.cache
          ? `$${lanePrices.cache}`
          : t('Empty'),
    },
    {
      key: 'createCache',
      label: t('Cache write price'),
      value:
        laneEnabled.createCache && lanePrices.createCache
          ? `$${lanePrices.createCache}`
          : t('Empty'),
    },
    {
      key: 'image',
      label: t('Image input price'),
      value:
        laneEnabled.image && lanePrices.image
          ? `$${lanePrices.image}`
          : t('Empty'),
    },
    {
      key: 'audio',
      label: t('Audio input price'),
      value:
        laneEnabled.audioInput && lanePrices.audioInput
          ? `$${lanePrices.audioInput}`
          : t('Empty'),
    },
    {
      key: 'audioCompletion',
      label: t('Audio output price'),
      value:
        laneEnabled.audioOutput && lanePrices.audioOutput
          ? `$${lanePrices.audioOutput}`
          : t('Empty'),
    },
  ]
}
