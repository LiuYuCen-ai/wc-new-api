import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, RotateCcw, Save } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sideDrawerContentClassName } from '@/components/drawer-layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import {
  EMPTY_LANE_ENABLED,
  EMPTY_LANE_PRICES,
  buildPreviewRows,
  createInitialLaneState,
  createModelPricingSchema,
  hasValue,
  laneConfigs,
  numericDraftRegex,
  ratioFieldByLane,
  toNumberOrNull,
  type LaneKey,
  type ModelPricingFormValues,
  type ModelRatioData,
  type PricingMode,
} from './model-pricing-core'
import { BasePriceInput, PriceLane } from './model-pricing-inputs'
import { formatPricingNumber } from './pricing-format'
import {
  DEFAULT_RESOLUTION_BILLING_UNIT,
  createResolutionRow,
  getSeedanceOfficialPrices,
  normalizeResolutionBillingUnit,
  resolutionPricesFromRows,
  rowsFromResolutionPrices,
  rowsFromTokenResolutions,
  tokenResolutionTiersFromRows,
  type ResolutionBillingUnit,
  type ResolutionPriceRow,
} from './resolution-pricing'
import { ResolutionPricingEditor } from './resolution-pricing-editor'
import { TieredPricingEditor } from './tiered-pricing-editor'

export type { ModelRatioData } from './model-pricing-core'

type ModelPricingSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: ModelRatioData | null
  onSave?: () => void | Promise<void>
  isSaving?: boolean
}

type ModelPricingEditorPanelProps = Omit<
  ModelPricingSheetProps,
  'open' | 'onOpenChange'
> & {
  className?: string
}

export type ModelPricingEditorPanelHandle = {
  commitDraft: () => Promise<ModelRatioData | null>
}

export const ModelPricingSheet = forwardRef<
  ModelPricingEditorPanelHandle,
  ModelPricingSheetProps
>(function ModelPricingSheet(
  { open, onOpenChange, editData, onSave, isSaving },
  ref
) {
  const { t } = useTranslation()
  const title = editData ? t('Edit model pricing') : t('Add model pricing')
  const description = editData?.name || t('New model')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className={sideDrawerContentClassName('sm:max-w-2xl')}
      >
        <SheetHeader className='sr-only'>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <ModelPricingEditorPanel
          ref={ref}
          editData={editData}
          onSave={onSave}
          isSaving={isSaving}
          className='h-full rounded-none border-0'
        />
      </SheetContent>
    </Sheet>
  )
})

export const ModelPricingEditorPanel = forwardRef<
  ModelPricingEditorPanelHandle,
  ModelPricingEditorPanelProps
>(function ModelPricingEditorPanel(
  { editData, className, onSave, isSaving },
  ref
) {
  const { t } = useTranslation()
  const usdExchangeRate = useSystemConfigStore(
    (s) => s.config.currency.usdExchangeRate
  )
  const quotaDisplayType = useSystemConfigStore(
    (s) => s.config.currency.quotaDisplayType
  )
  // 单价输入框展示的就是系统币种（USD→$ / CNY→¥），填入多少即多少钱：
  // 系统按美元显示时不做汇率折算，直接作为 USD 单价驱动 ModelRatio 推导。
  const priceToUsdRate =
    quotaDisplayType === 'USD' || quotaDisplayType === 'TOKENS'
      ? 1
      : usdExchangeRate
  const [pricingMode, setPricingMode] = useState<PricingMode>('per-token')
  // 无视频价未配置时的回退基准价（编辑旧模型时由已保存的 ratio 反推）。
  const [promptPrice, setPromptPrice] = useState('')
  const [lanePrices, setLanePrices] = useState<Record<LaneKey, string>>({
    ...EMPTY_LANE_PRICES,
  })
  const [laneEnabled, setLaneEnabled] = useState<Record<LaneKey, boolean>>({
    ...EMPTY_LANE_ENABLED,
  })
  const [billingExpr, setBillingExpr] = useState('')
  const [requestRuleExpr, setRequestRuleExpr] = useState('')
  const [resolutionRows, setResolutionRows] = useState<ResolutionPriceRow[]>([])
  // 按 token 专用的逐分辨率两档表（无视频 / 有视频），与按秒表完全独立：
  // 切换计费单位只切换显示与生效的表，不共享、不互相覆盖。
  const [tokenResolutionRows, setTokenResolutionRows] = useState<
    ResolutionPriceRow[]
  >([])
  const [resolutionUnit, setResolutionUnit] = useState<ResolutionBillingUnit>(
    DEFAULT_RESOLUTION_BILLING_UNIT
  )
  const isTokenUnit = resolutionUnit === 'million_tokens'
  // 当前单位对应的行数据 / setter（编辑器与校验统一走这两个）。
  const activeResolutionRows = isTokenUnit
    ? tokenResolutionRows
    : resolutionRows
  const setActiveResolutionRows = isTokenUnit
    ? setTokenResolutionRows
    : setResolutionRows
  // 视频输入计费覆盖（¥/百万 token）：空 = 未配置，按模型原有计费；seedance 有官方刊例价兜底。
  const [videoInputNoVideoPrice, setVideoInputNoVideoPrice] = useState('')
  const [videoInputPrice, setVideoInputPrice] = useState('')
  const [editorReloadToken, setEditorReloadToken] = useState(0)
  const isEditMode = !!editData

  const form = useForm<ModelPricingFormValues>({
    resolver: zodResolver(createModelPricingSchema(t)),
    defaultValues: {
      name: '',
      price: '',
      ratio: '',
      cacheRatio: '',
      createCacheRatio: '',
      completionRatio: '',
      imageRatio: '',
      audioRatio: '',
      audioCompletionRatio: '',
    },
  })

  useEffect(() => {
    const nextLaneState = createInitialLaneState(editData)

    if (editData) {
      form.reset({
        name: editData.name,
        price: editData.price || '',
        ratio: editData.ratio || '',
        cacheRatio: editData.cacheRatio || '',
        createCacheRatio: editData.createCacheRatio || '',
        completionRatio: editData.completionRatio || '',
        imageRatio: editData.imageRatio || '',
        audioRatio: editData.audioRatio || '',
        audioCompletionRatio: editData.audioCompletionRatio || '',
      })
      const savedVideoInput = editData.videoInputPrice
      const hasVideoInputPrice = Boolean(
        savedVideoInput &&
          (savedVideoInput.no_video > 0 || savedVideoInput.video > 0)
      )
      // 按秒表（resolution_price）与按 token 两档表（video_input_price.resolutions）
      // 分属两张独立配置，各自回填、互不覆盖。
      const secondRows = rowsFromResolutionPrices(editData.resolutionPrices)
      const tokenRows = rowsFromTokenResolutions(savedVideoInput?.resolutions)
      const hasResolutionPrice = secondRows.some(
        (row) => row.price.trim() !== ''
      )
      let nextMode: PricingMode = 'per-token'
      if (editData.billingMode === 'tiered_expr') {
        nextMode = 'tiered_expr'
      } else if (editData.billingMode === 'resolution') {
        nextMode = 'resolution'
      } else if (editData.price) {
        nextMode = 'per-request'
      }
      setPricingMode(nextMode)
      setBillingExpr(editData.billingExpr || '')
      setRequestRuleExpr(editData.requestRuleExpr || '')
      const nextUnit =
        hasVideoInputPrice && !hasResolutionPrice
          ? 'million_tokens'
          : normalizeResolutionBillingUnit(editData.resolutionUnit)
      setResolutionRows(
        secondRows.length > 0 ? secondRows : [createResolutionRow('720P', '')]
      )
      setTokenResolutionRows(
        tokenRows.length > 0
          ? tokenRows
          : [createResolutionRow('720P', '', '')]
      )
      setResolutionUnit(nextUnit)
      setVideoInputNoVideoPrice(
        savedVideoInput && savedVideoInput.no_video > 0
          ? formatPricingNumber(savedVideoInput.no_video)
          : ''
      )
      setVideoInputPrice(
        savedVideoInput && savedVideoInput.video > 0
          ? formatPricingNumber(savedVideoInput.video)
          : ''
      )
    } else {
      form.reset({
        name: '',
        price: '',
        ratio: '',
        cacheRatio: '',
        createCacheRatio: '',
        completionRatio: '',
        imageRatio: '',
        audioRatio: '',
        audioCompletionRatio: '',
      })
      setPricingMode('per-token')
      setBillingExpr('')
      setRequestRuleExpr('')
      setResolutionRows([createResolutionRow('720P', '')])
      setTokenResolutionRows([createResolutionRow('720P', '', '')])
      setResolutionUnit(DEFAULT_RESOLUTION_BILLING_UNIT)
      setVideoInputNoVideoPrice('')
      setVideoInputPrice('')
    }

    setPromptPrice(nextLaneState.promptPrice)
    setLanePrices(nextLaneState.prices)
    setLaneEnabled(nextLaneState.enabled)
    setEditorReloadToken((token) => token + 1)
  }, [editData, form])

  const setFormValue = (field: keyof ModelPricingFormValues, value: string) => {
    form.setValue(field, value, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const watchedName = form.watch('name')
  const officialVideoInputPrices = useMemo(
    () => getSeedanceOfficialPrices(watchedName),
    [watchedName]
  )

  // 无视频输入单价（¥/百万 token）直接充当基准输入价：按汇率换算成 USD 后驱动
  // ModelRatio 与各附加通道倍率的推导；未配置时回退到已保存 ratio 反推的基准价。
  const effectivePromptPrice = useMemo(() => {
    const noVideo = toNumberOrNull(videoInputNoVideoPrice)
    if (noVideo !== null && noVideo > 0 && priceToUsdRate > 0) {
      return formatPricingNumber(noVideo / priceToUsdRate)
    }
    return promptPrice
  }, [promptPrice, priceToUsdRate, videoInputNoVideoPrice])

  // seedance 模型自动填入官方刊例价（已有配置时不覆盖，可手动修改；其它模型由管理员填写）。
  // 填入无视频价时同步推导基准 ModelRatio（无视频价即基准输入价）。
  useEffect(() => {
    if (!officialVideoInputPrices) return
    let filledNoVideo = false
    setVideoInputNoVideoPrice((prev) => {
      if (prev !== '') return prev
      filledNoVideo = true
      return formatPricingNumber(officialVideoInputPrices.no_video)
    })
    setVideoInputPrice((prev) =>
      prev === '' ? formatPricingNumber(officialVideoInputPrices.video) : prev
    )
    if (
      filledNoVideo &&
      priceToUsdRate > 0 &&
      officialVideoInputPrices.no_video > 0
    ) {
      setFormValue(
        'ratio',
        formatPricingNumber(
          officialVideoInputPrices.no_video / priceToUsdRate / 2
        )
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFormValue 为 form.setValue 的薄包装，form 稳定
  }, [officialVideoInputPrices, priceToUsdRate])

  const handleVideoInputReset = () => {
    if (!officialVideoInputPrices) return
    setVideoInputNoVideoPrice(
      formatPricingNumber(officialVideoInputPrices.no_video)
    )
    setVideoInputPrice(formatPricingNumber(officialVideoInputPrices.video))
    const nextPrompt =
      priceToUsdRate > 0
        ? formatPricingNumber(
            officialVideoInputPrices.no_video / priceToUsdRate
          )
        : ''
    if (nextPrompt) setPromptPrice(nextPrompt)
    syncLaneRatios(nextPrompt, lanePrices, laneEnabled)
  }

  // 「按 Token」页签的输入价格（USD/百万 token）：改动后同步推导 ModelRatio 与各附加通道倍率。
  const handlePromptPriceChange = (value: string) => {
    if (!numericDraftRegex.test(value)) return
    setPromptPrice(value)
    syncLaneRatios(value, lanePrices, laneEnabled)
  }

  const deriveLaneRatio = (
    lane: LaneKey,
    price: string,
    nextPromptPrice = effectivePromptPrice,
    nextLanePrices = lanePrices
  ) => {
    const priceNumber = toNumberOrNull(price)
    if (priceNumber === null) return ''

    if (lane === 'audioOutput') {
      const audioInputPrice = toNumberOrNull(nextLanePrices.audioInput)
      if (audioInputPrice === null || audioInputPrice === 0) return ''
      return formatPricingNumber(priceNumber / audioInputPrice)
    }

    const inputPrice = toNumberOrNull(nextPromptPrice)
    if (inputPrice === null || inputPrice === 0) return ''
    return formatPricingNumber(priceNumber / inputPrice)
  }

  const syncLaneRatios = (
    nextPromptPrice = effectivePromptPrice,
    nextLanePrices = lanePrices,
    nextLaneEnabled = laneEnabled
  ) => {
    const inputPrice = toNumberOrNull(nextPromptPrice)
    setFormValue(
      'ratio',
      inputPrice !== null ? formatPricingNumber(inputPrice / 2) : ''
    )

    laneConfigs.forEach(({ key }) => {
      const ratioField = ratioFieldByLane[key]
      if (!nextLaneEnabled[key]) {
        setFormValue(ratioField, '')
        return
      }
      setFormValue(
        ratioField,
        deriveLaneRatio(
          key,
          nextLanePrices[key],
          nextPromptPrice,
          nextLanePrices
        )
      )
    })
  }

  const handleLanePriceChange = (lane: LaneKey, value: string) => {
    if (!numericDraftRegex.test(value)) return
    const nextLanePrices = { ...lanePrices, [lane]: value }
    setLanePrices(nextLanePrices)

    if (laneEnabled[lane]) {
      setFormValue(
        ratioFieldByLane[lane],
        deriveLaneRatio(lane, value, effectivePromptPrice, nextLanePrices)
      )
    }

    if (lane === 'audioInput' && laneEnabled.audioOutput) {
      setFormValue(
        'audioCompletionRatio',
        deriveLaneRatio(
          'audioOutput',
          nextLanePrices.audioOutput,
          effectivePromptPrice,
          nextLanePrices
        )
      )
    }
  }

  const handleLaneToggle = (lane: LaneKey, checked: boolean) => {
    const nextEnabled = { ...laneEnabled, [lane]: checked }
    let nextPrices = lanePrices

    if (!checked) {
      nextPrices = { ...nextPrices, [lane]: '' }
      setFormValue(ratioFieldByLane[lane], '')
      if (lane === 'audioInput') {
        nextEnabled.audioOutput = false
        nextPrices.audioOutput = ''
        setFormValue('audioCompletionRatio', '')
      }
    }

    setLaneEnabled(nextEnabled)
    setLanePrices(nextPrices)

    if (checked) {
      setFormValue(
        ratioFieldByLane[lane],
        deriveLaneRatio(
          lane,
          nextPrices[lane],
          effectivePromptPrice,
          nextPrices
        )
      )
    }
  }

  const handleModeChange = (value: string) => {
    const nextMode = value as PricingMode
    setPricingMode(nextMode)
    if (nextMode === 'tiered_expr' && !billingExpr) {
      setBillingExpr('tier("base", p * 0 + c * 0)')
    }
    if (nextMode === 'resolution' && activeResolutionRows.length === 0) {
      setActiveResolutionRows([createResolutionRow('720P', '')])
    }
  }

  const watchedValues = form.watch()
  // 分辨率单价的错误提示：整表为空时用「请先添加分辨率及单价」，其余情况提示格式/重复问题。
  const resolutionPriceErrorMessage = useCallback(
    (empty: boolean) => {
      if (empty) {
        return t('Add at least one resolution and its price before saving.')
      }
      return t(
        'Add at least one resolution with a non-negative price. Duplicate labels are not allowed.'
      )
    },
    [t]
  )
  const videoInputPriceDraft = useMemo(() => {
    const parse = (raw: string) => {
      const value = raw.trim()
      if (value === '') return null
      const num = Number(value)
      return Number.isFinite(num) ? num : Number.NaN
    }
    return {
      noVideo: parse(videoInputNoVideoPrice),
      video: parse(videoInputPrice),
    }
  }, [videoInputNoVideoPrice, videoInputPrice])
  const previewRows = useMemo(() => {
    // 预览按「当前单位」取对应的独立单价表：
    // 按秒读 resolution_price，按 token 读 video_input_price.resolutions。
    const tokenTiers = tokenResolutionTiersFromRows(tokenResolutionRows).tiers
    let previewResolutionPrices: Record<string, number> | undefined
    if (isTokenUnit) {
      previewResolutionPrices = tokenTiers
        ? Object.fromEntries(
            Object.entries(tokenTiers).map(([res, tier]) => [
              res,
              tier.no_video,
            ])
          )
        : undefined
    } else {
      previewResolutionPrices = resolutionPricesFromRows(resolutionRows) ?? undefined
    }
    const previewVideoInput =
      videoInputPriceDraft.noVideo !== null ||
      videoInputPriceDraft.video !== null ||
      (tokenTiers && Object.keys(tokenTiers).length > 0)
        ? {
            no_video:
              !Number.isNaN(videoInputPriceDraft.noVideo) &&
              videoInputPriceDraft.noVideo !== null
                ? videoInputPriceDraft.noVideo
                : 0,
            video:
              !Number.isNaN(videoInputPriceDraft.video) &&
              videoInputPriceDraft.video !== null
                ? videoInputPriceDraft.video
                : 0,
            ...(tokenTiers ? { resolutions: tokenTiers } : {}),
          }
        : null
    return buildPreviewRows(
      watchedValues,
      pricingMode,
      billingExpr,
      requestRuleExpr,
      effectivePromptPrice,
      lanePrices,
      laneEnabled,
      t,
      previewResolutionPrices,
      resolutionUnit,
      previewVideoInput
    )
  }, [
    billingExpr,
    laneEnabled,
    lanePrices,
    pricingMode,
    effectivePromptPrice,
    requestRuleExpr,
    resolutionRows,
    tokenResolutionRows,
    isTokenUnit,
    resolutionUnit,
    videoInputPriceDraft,
    t,
    watchedValues,
  ])

  const warnings = useMemo(() => {
    const nextWarnings: string[] = []
    const hasConflict =
      !!editData?.price &&
      [
        editData.ratio,
        editData.completionRatio,
        editData.cacheRatio,
        editData.createCacheRatio,
        editData.imageRatio,
        editData.audioRatio,
        editData.audioCompletionRatio,
      ].some(hasValue)

    if (hasConflict) {
      nextWarnings.push(
        t(
          'This model has both fixed-price and token-price settings. Saving the current mode will rewrite the conflicting fields.'
        )
      )
    }

    if (
      pricingMode === 'per-token' &&
      toNumberOrNull(effectivePromptPrice) === null &&
      laneConfigs.some(
        ({ key }) => laneEnabled[key] && hasValue(lanePrices[key])
      )
    ) {
      nextWarnings.push(
        t('Input price is required before saving dependent prices.')
      )
    }

    if (
      pricingMode === 'per-token' &&
      laneEnabled.audioOutput &&
      !hasValue(lanePrices.audioInput)
    ) {
      nextWarnings.push(t('Audio output price requires an audio input price.'))
    }

    // 按分辨率计费必须填写当前单位的分辨率单价：为空/非法时不允许保存。
    if (pricingMode === 'resolution' && !isTokenUnit) {
      if (!resolutionPricesFromRows(resolutionRows)) {
        nextWarnings.push(
          resolutionPriceErrorMessage(
            !resolutionRows.some((row) => row.price.trim() !== '')
          )
        )
      }
    }

    if (pricingMode === 'resolution' && isTokenUnit) {
      const { configured, tiers } =
        tokenResolutionTiersFromRows(tokenResolutionRows)
      if (!configured || !tiers) {
        nextWarnings.push(resolutionPriceErrorMessage(!configured))
      }
    }

    if (
      Number.isNaN(videoInputPriceDraft.noVideo) ||
      Number.isNaN(videoInputPriceDraft.video)
    ) {
      nextWarnings.push(t('Video input prices must be non-negative numbers.'))
    }

    return nextWarnings
  }, [
    editData,
    laneEnabled,
    lanePrices,
    pricingMode,
    effectivePromptPrice,
    resolutionRows,
    tokenResolutionRows,
    isTokenUnit,
    videoInputPriceDraft,
    resolutionPriceErrorMessage,
    t,
  ])

  // 返回第一条校验错误信息（用于 toast 提示 + 表单内联报错），通过时返回 null。
  const validatePricingValues = useCallback((): string | null => {
    if (
      pricingMode === 'per-token' &&
      toNumberOrNull(effectivePromptPrice) === null &&
      laneConfigs.some(
        ({ key }) => laneEnabled[key] && hasValue(lanePrices[key])
      )
    ) {
      const message = t('Input price is required before saving dependent prices.')
      form.setError('ratio', { message })
      return message
    }

    if (
      pricingMode === 'per-token' &&
      laneEnabled.audioOutput &&
      !hasValue(lanePrices.audioInput)
    ) {
      const message = t('Audio output price requires an audio input price.')
      form.setError('audioRatio', { message })
      return message
    }

    if (pricingMode === 'resolution' && !isTokenUnit) {
      if (!resolutionPricesFromRows(resolutionRows)) {
        const message = resolutionPriceErrorMessage(
          !resolutionRows.some((row) => row.price.trim() !== '')
        )
        form.setError('price', { message })
        return message
      }
    }

    if (pricingMode === 'resolution' && isTokenUnit) {
      const { configured, tiers } =
        tokenResolutionTiersFromRows(tokenResolutionRows)
      if (!configured || !tiers) {
        const message = resolutionPriceErrorMessage(!configured)
        form.setError('price', { message })
        return message
      }
    }

    if (
      Number.isNaN(videoInputPriceDraft.noVideo) ||
      Number.isNaN(videoInputPriceDraft.video)
    ) {
      const message = t('Video input prices must be non-negative numbers.')
      form.setError('price', { message })
      return message
    }

    return null
  }, [
    form,
    laneEnabled,
    lanePrices,
    pricingMode,
    effectivePromptPrice,
    resolutionRows,
    tokenResolutionRows,
    isTokenUnit,
    videoInputPriceDraft,
    resolutionPriceErrorMessage,
    t,
  ])

  const buildSubmitData = useCallback(
    (values: ModelPricingFormValues) => {
      // 保存时只落「当前单位」的价格，另一套价格在写入端被清空（校验已保证当前表非空）：
      //   - 按秒：resolution_price（USD/秒，单价 × 秒数），清空按 token 的逐分辨率表；
      //   - 按 token：video_input_price.resolutions（元/百万 token 的 {no_video, video}），
      //     清空按秒的 resolution_price。
      // 计费模式不再回退：没有有效单价时保存会被校验拦截。
      const secondPrices = resolutionPricesFromRows(resolutionRows)
      const { tiers: tokenTiers } = tokenResolutionTiersFromRows(
        tokenResolutionRows
      )
      const data: ModelRatioData = {
        name: values.name.trim(),
        billingMode: pricingMode,
        price: values.price || '',
        ratio: values.ratio || '',
        cacheRatio: values.cacheRatio || '',
        createCacheRatio: values.createCacheRatio || '',
        completionRatio: values.completionRatio || '',
        imageRatio: values.imageRatio || '',
        audioRatio: values.audioRatio || '',
        audioCompletionRatio: values.audioCompletionRatio || '',
      }

      if (pricingMode === 'tiered_expr') {
        data.billingExpr = billingExpr
        data.requestRuleExpr = requestRuleExpr
      }

      if (pricingMode === 'resolution') {
        data.resolutionUnit = resolutionUnit
        // 只保存当前单位对应的表；另一张表不写入，写入端据此清空旧值。
        if (!isTokenUnit && secondPrices) {
          data.resolutionPrices = secondPrices
        }
      }

      const { noVideo, video } = videoInputPriceDraft
      // 全局两档单价（无视频 / 有视频）在两种单位下都有效；
      // 逐分辨率两档表仅属于按 token，按秒保存时不写入以清空旧值。
      if (
        noVideo !== null ||
        video !== null ||
        (isTokenUnit && tokenTiers)
      ) {
        data.videoInputPrice = {
          no_video: noVideo !== null && !Number.isNaN(noVideo) ? noVideo : 0,
          video: video !== null && !Number.isNaN(video) ? video : 0,
          ...(isTokenUnit && tokenTiers ? { resolutions: tokenTiers } : {}),
        }
      }

      return data
    },
    [
      billingExpr,
      pricingMode,
      requestRuleExpr,
      resolutionRows,
      tokenResolutionRows,
      isTokenUnit,
      resolutionUnit,
      videoInputPriceDraft,
    ]
  )

  useImperativeHandle(
    ref,
    () => ({
      commitDraft: async () => {
        const isValid = await form.trigger()
        if (!isValid) {
          toast.error(t('Please fix the highlighted fields before saving'))
          return null
        }
        // 价格为空的校验：除了在表单内联报错，还要弹出提示，避免用户点了保存却没有任何反馈。
        const validationError = validatePricingValues()
        if (validationError) {
          toast.error(validationError)
          return null
        }
        return buildSubmitData(form.getValues())
      },
    }),
    [form, validatePricingValues, buildSubmitData, t]
  )

  const showActions = Boolean(onSave)

  // 视频输入计费区块：按 token 模式下按分辨率配置两档单价（无视频 / 有视频）。
  // 全局两档单价输入框已移除，仅作为已有配置的回退倍率保留在数据模型中。
  const videoInputHeaderSection = (
    <div className='flex flex-wrap items-start justify-between gap-2'>
      <div className='min-w-0 flex-1'>
        <FieldLabel>{t('Video input pricing')}</FieldLabel>
        <FieldDescription>
          {t(
            'Each resolution below has its own no-video / with-video price per 1M tokens. A with-video price left empty falls back to the ratio of the globally configured video input prices.'
          )}
          {officialVideoInputPrices
            ? ` ${t('Seedance models pre-fill official list prices.')}`
            : null}
        </FieldDescription>
      </div>
      {officialVideoInputPrices && (
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleVideoInputReset}
        >
          <RotateCcw data-icon='inline-start' />
          {t('Reset to official price')}
        </Button>
      )}
    </div>
  )


  return (
    <div
      className={cn(
        'bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className
      )}
    >
      <div className='border-b p-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h3 className='truncate text-base font-medium'>
              {isEditMode ? t('Edit model pricing') : t('Add model pricing')}
            </h3>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={(event) => event.preventDefault()}
          className='flex min-h-0 flex-1 flex-col'
          autoComplete='off'
        >
          <div className='min-h-0 flex-1 overflow-y-auto p-4 pb-6'>
            <div className='grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(220px,260px)]'>
              <FieldGroup>
                {warnings.length > 0 && (
                  <Alert variant='destructive'>
                    <AlertTriangle data-icon='inline-start' />
                    <AlertDescription>
                      <div className='flex flex-col gap-1'>
                        {warnings.map((warning) => (
                          <span key={warning}>{warning}</span>
                        ))}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Model name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('gpt-4')}
                          {...field}
                          disabled={isEditMode}
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'The exact model identifier as used in API requests.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Tabs
                  value={pricingMode}
                  onValueChange={handleModeChange}
                  className='gap-4'
                >
                  <TabsList className='grid w-full grid-cols-2 sm:grid-cols-4'>
                    <TabsTrigger value='per-token'>
                      {t('Per-token')}
                    </TabsTrigger>
                    <TabsTrigger value='per-request'>
                      {t('Per-request')}
                    </TabsTrigger>
                    <TabsTrigger value='resolution'>
                      {t('By resolution')}
                    </TabsTrigger>
                    <TabsTrigger value='tiered_expr'>
                      {t('Expression')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value='per-token' className='pt-0'>
                    <FieldGroup className='gap-5'>
                      <BasePriceInput
                        title={t('Input price')}
                        description={t('USD price per 1M input tokens.')}
                        value={promptPrice}
                        placeholder='3'
                        onChange={handlePromptPriceChange}
                      />

                      <div className='grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(400px,1fr))]'>
                        {laneConfigs.map((lane) => {
                          const disabled =
                            lane.key === 'audioOutput' &&
                            (!laneEnabled.audioInput ||
                              !hasValue(lanePrices.audioInput))
                          return (
                            <PriceLane
                              key={lane.key}
                              title={t(lane.titleKey)}
                              description={t(lane.descriptionKey)}
                              placeholder={lane.placeholder}
                              value={lanePrices[lane.key]}
                              enabled={laneEnabled[lane.key]}
                              disabled={disabled}
                              onEnabledChange={(checked) =>
                                handleLaneToggle(lane.key, checked)
                              }
                              onChange={(value) =>
                                handleLanePriceChange(lane.key, value)
                              }
                            />
                          )
                        })}
                      </div>
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent value='per-request' className='pt-0'>
                    <FieldGroup className='gap-5'>
                      <FormField
                        control={form.control}
                        name='price'
                        render={({ field }) => (
                          <FormItem className='contents'>
                            <Field>
                              <FieldLabel>{t('Fixed price')}</FieldLabel>
                              <FormControl>
                                <InputGroup>
                                  <InputGroupAddon>$</InputGroupAddon>
                                  <InputGroupInput
                                    inputMode='decimal'
                                    placeholder='0.01'
                                    {...field}
                                    onChange={(event) => {
                                      const value = event.target.value
                                      if (numericDraftRegex.test(value)) {
                                        field.onChange(value)
                                      }
                                    }}
                                  />
                                  <InputGroupAddon align='inline-end'>
                                    {t('per request')}
                                  </InputGroupAddon>
                                </InputGroup>
                              </FormControl>
                              <FieldDescription>
                                {t(
                                  'Cost in USD per request, regardless of tokens used.'
                                )}
                              </FieldDescription>
                              <FormMessage />
                            </Field>
                          </FormItem>
                        )}
                      />
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent value='resolution' className='pt-0'>
                    <FieldGroup className='gap-5'>
                      <ResolutionPricingEditor
                        modelName={watchedValues.name}
                        rows={activeResolutionRows}
                        onChange={setActiveResolutionRows}
                        unit={resolutionUnit}
                        onUnitChange={setResolutionUnit}
                        videoInputHeader={videoInputHeaderSection}
                      />
                    </FieldGroup>
                  </TabsContent>

                  <TabsContent value='tiered_expr' className='pt-0'>
                    <FieldGroup className='gap-5'>
                      <TieredPricingEditor
                        key={editorReloadToken}
                        modelName={watchedValues.name}
                        billingExpr={billingExpr}
                        requestRuleExpr={requestRuleExpr}
                        onBillingExprChange={setBillingExpr}
                        onRequestRuleExprChange={setRequestRuleExpr}
                      />
                    </FieldGroup>
                  </TabsContent>
                </Tabs>
              </FieldGroup>

              <aside className='bg-muted/20 sticky top-0 rounded-lg border'>
                <div className='border-b px-3 py-2'>
                  <div className='text-sm font-medium'>{t('Preview')}</div>
                </div>
                <div className='divide-y'>
                  {previewRows.map((row) => (
                    <div key={row.key} className='grid gap-1 px-3 py-2.5'>
                      <span className='text-muted-foreground text-xs'>
                        {row.label}
                      </span>
                      <span
                        className={cn(
                          'min-w-0 text-sm',
                          row.multiline
                            ? 'font-mono text-xs leading-5 break-words whitespace-pre-wrap'
                            : 'truncate'
                        )}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
          {showActions && (
            <div className='bg-background/95 supports-[backdrop-filter]:bg-background/80 shrink-0 border-t p-3 backdrop-blur'>
              <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                {onSave && (
                  <Button
                    type='button'
                    onClick={onSave}
                    disabled={isSaving}
                    className='w-full sm:w-auto'
                  >
                    <Save data-icon='inline-start' />
                    {isSaving ? t('Saving...') : t('Save model prices')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  )
})
