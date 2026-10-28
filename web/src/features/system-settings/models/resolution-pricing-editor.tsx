import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getBillingCurrencySymbol } from '@/lib/currency'

import { numericDraftRegex } from './model-pricing-core'
import {
  RESOLUTION_PRESETS,
  createResolutionRow,
  isSeedanceModel,
  isTokenBillingUnit,
  normalizeResolutionBillingUnit,
  normalizeResolutionLabel,
  type ResolutionBillingUnit,
  type ResolutionPriceRow,
} from './resolution-pricing'

type ResolutionPricingEditorProps = {
  rows: ResolutionPriceRow[]
  onChange: (rows: ResolutionPriceRow[]) => void
  /** 「按 token」模式视频输入计费卡片的标题/说明区 */
  videoInputHeader?: ReactNode
  /** 当前编辑的模型名，用于提示自带计费逻辑的模型（如 seedance） */
  modelName?: string
  /** 计费单位：按秒 / 按百万 token（对全部视频模型通用） */
  unit?: ResolutionBillingUnit
  onUnitChange?: (unit: ResolutionBillingUnit) => void
}

export function ResolutionPricingEditor(props: ResolutionPricingEditorProps) {
  const { t } = useTranslation()
  const currencySymbol = getBillingCurrencySymbol()
  const unit = normalizeResolutionBillingUnit(props.unit)
  const isTokenUnit = isTokenBillingUnit(unit)
  const used = new Set(
    props.rows
      .map((row) => normalizeResolutionLabel(row.resolution))
      .filter(Boolean)
  )

  const updateRow = (id: string, patch: Partial<ResolutionPriceRow>) => {
    props.onChange(
      props.rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }

  const addPreset = (preset: string) => {
    if (used.has(preset)) return
    props.onChange([...props.rows, createResolutionRow(preset, '')])
  }

  /** 分辨率行的公共输入：档位名 + 删除按钮（删除按钮仅第一组显示）。 */
  const renderResolutionField = (row: ResolutionPriceRow) => (
    <Field className='min-w-0 flex-1'>
      <Input
        value={row.resolution}
        placeholder='720P'
        aria-label={t('Resolution')}
        onChange={(event) =>
          updateRow(row.id, { resolution: event.target.value })
        }
        onBlur={() => {
          const next = normalizeResolutionLabel(row.resolution)
          if (next && next !== row.resolution) {
            updateRow(row.id, { resolution: next })
          }
        }}
      />
    </Field>
  )

  /** 无视频输入单价子行：分辨率 + 无视频单价（即该分辨率的基准价）。 */
  const renderNoVideoRow = (row: ResolutionPriceRow) => (
    <div key={row.id} className='flex items-center gap-2'>
      {renderResolutionField(row)}
      <InputGroup className='w-[196px] shrink-0'>
        <InputGroupAddon>{currencySymbol}</InputGroupAddon>
        <InputGroupInput
          inputMode='decimal'
          placeholder='0.01'
          aria-label={`${t('Resolution')} · ${t('No video input price')}`}
          value={row.price}
          onChange={(event) => {
            const value = event.target.value
            if (numericDraftRegex.test(value)) {
              updateRow(row.id, { price: value })
            }
          }}
        />
        <InputGroupAddon align='inline-end'>{t('per 1M tokens')}</InputGroupAddon>
      </InputGroup>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        aria-label={t('Remove resolution')}
        onClick={() =>
          props.onChange(props.rows.filter((item) => item.id !== row.id))
        }
      >
        <Trash2 className='text-destructive h-4 w-4' />
      </Button>
    </div>
  )

  /** 有视频输入单价子行：分辨率 + 有视频单价（与无视频档一一对应）。 */
  const renderVideoRow = (row: ResolutionPriceRow) => (
    <div key={row.id} className='flex items-center gap-2'>
      {renderResolutionField(row)}
      <InputGroup className='w-[196px] shrink-0'>
        <InputGroupAddon>{currencySymbol}</InputGroupAddon>
        <InputGroupInput
          inputMode='decimal'
          placeholder='0.01'
          aria-label={`${t('Resolution')} · ${t('With video input price')}`}
          value={row.videoPrice}
          onChange={(event) => {
            const value = event.target.value
            if (numericDraftRegex.test(value)) {
              updateRow(row.id, { videoPrice: value })
            }
          }}
        />
        <InputGroupAddon align='inline-end'>{t('per 1M tokens')}</InputGroupAddon>
      </InputGroup>
      {/* 删除按钮只在无视频组显示，避免同一行出现两个删除入口。 */}
      <span className='size-8 shrink-0' aria-hidden='true' />
    </div>
  )

  return (
    <FieldGroup className='gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <FieldLabel>{t('Video billing')}</FieldLabel>
            <Tabs
              value={unit}
              onValueChange={(value) =>
                props.onUnitChange?.(
                  normalizeResolutionBillingUnit(value as string)
                )
              }
            >
              <TabsList>
                <TabsTrigger value='second' className='px-2 text-xs'>
                  {t('By second')}
                </TabsTrigger>
                <TabsTrigger value='million_tokens' className='px-2 text-xs'>
                  {t('By token')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <FieldDescription>
            {isTokenUnit
              ? t(
                  'Billed per 1M video tokens. Each resolution bills at its own no-video price, and its with-video price at the value filled under the with-video section (falling back to the ratio of the two global video input prices when left empty). Per-second and per-token price tables are independent; saving keeps only the table of the current unit and clears the other one. Tokens are estimated as duration × width × height × 24fps / 1024 at pre-charge time, then reconciled with the token usage returned by upstream.'
                )
              : t(
                  'Set a USD price for each resolution. Billing is price × duration in seconds. Missing resolutions fall back to 720P. Per-second and per-token price tables are independent; saving keeps only the table of the current unit and clears the other one.'
                )}
          </FieldDescription>
          {isSeedanceModel(props.modelName) && (
            <FieldDescription>
              {t(
                'Seedance models keep their built-in token billing; the unit and prices configured here do not apply to them.'
              )}
            </FieldDescription>
          )}
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => props.onChange([...props.rows, createResolutionRow()])}
        >
          <Plus data-icon='inline-start' />
          {t('Add resolution')}
        </Button>
      </div>

      {isTokenUnit ? (
        <div className='grid gap-3 rounded-lg border p-4'>
          {props.videoInputHeader}
          <div className='grid gap-2'>
            <FieldLabel className='text-xs'>
              {t('No video input price')}
            </FieldLabel>
            {props.rows.map(renderNoVideoRow)}
          </div>
          <div className='grid gap-2'>
            <FieldLabel className='text-xs'>
              {t('With video input price')}
            </FieldLabel>
            {props.rows.map(renderVideoRow)}
          </div>
        </div>
      ) : (
        <>
          {/* 按秒模式：预设分辨率快捷按钮（官方档位固定），其它档位通过「添加分辨率」自定义。 */}
          <div className='flex flex-wrap gap-2'>
            {RESOLUTION_PRESETS.map((preset) => (
              <Button
                key={preset}
                type='button'
                size='sm'
                variant={used.has(preset) ? 'secondary' : 'outline'}
                onClick={() => addPreset(preset)}
                disabled={used.has(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>

          <div className='grid gap-2'>
            {props.rows.map((row) => (
              <div key={row.id} className='flex items-center gap-2'>
                {renderResolutionField(row)}
                <InputGroup className='w-[196px] shrink-0'>
                  <InputGroupAddon>$</InputGroupAddon>
                  <InputGroupInput
                    inputMode='decimal'
                    placeholder='0.01'
                    aria-label={t('Resolution price')}
                    value={row.price}
                    onChange={(event) => {
                      const value = event.target.value
                      if (numericDraftRegex.test(value)) {
                        updateRow(row.id, { price: value })
                      }
                    }}
                  />
                  <InputGroupAddon align='inline-end'>
                    {t('per second')}
                  </InputGroupAddon>
                </InputGroup>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Remove resolution')}
                  onClick={() =>
                    props.onChange(
                      props.rows.filter((item) => item.id !== row.id)
                    )
                  }
                >
                  <Trash2 className='text-destructive h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

    </FieldGroup>
  )
}
