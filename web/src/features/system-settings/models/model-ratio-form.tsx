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
import { useQuery } from '@tanstack/react-query'
import { Code2, Eye, RotateCcw, Save } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { JsonCodeEditor } from '@/components/json-code-editor'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { getEnabledModels } from '@/features/channels/api'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import {
  ModelRatioVisualEditor,
  type ModelRatioVisualEditorHandle,
} from './model-ratio-visual-editor'
import { normalizeJsonString } from './utils'

const PRICING_JSON_FIELD_MAP: Record<string, keyof ModelFormValues> = {
  'billing_setting.billing_mode': 'BillingMode',
  'billing_setting.billing_expr': 'BillingExpr',
  'billing_setting.resolution_price': 'ResolutionPrice',
}

const PRICING_WATCH_FIELDS = [
  'ModelPrice',
  'ModelRatio',
  'CacheRatio',
  'CreateCacheRatio',
  'CompletionRatio',
  'ImageRatio',
  'AudioRatio',
  'AudioCompletionRatio',
  'BillingMode',
  'BillingExpr',
  'ResolutionPrice',
  'ExposeRatioEnabled',
] as const satisfies ReadonlyArray<keyof ModelFormValues>

type ModelFormValues = {
  ModelPrice: string
  ModelRatio: string
  CacheRatio: string
  CreateCacheRatio: string
  CompletionRatio: string
  ImageRatio: string
  AudioRatio: string
  AudioCompletionRatio: string
  ExposeRatioEnabled: boolean
  BillingMode: string
  BillingExpr: string
  ResolutionPrice: string
}

type ModelRatioFormProps = {
  form: UseFormReturn<ModelFormValues>
  savedValues: ModelFormValues
  onSave: (values: ModelFormValues) => Promise<void>
  onReset: () => void
  isSaving: boolean
  isResetting: boolean
  variant?: 'default' | 'unset'
}

type ModelJsonFieldName =
  | 'ModelPrice'
  | 'ModelRatio'
  | 'CacheRatio'
  | 'CreateCacheRatio'
  | 'CompletionRatio'
  | 'ImageRatio'
  | 'AudioRatio'
  | 'AudioCompletionRatio'

const modelJsonFields: Array<{
  name: ModelJsonFieldName
  labelKey: string
  descriptionKey: string
}> = [
  {
    name: 'ModelPrice',
    labelKey: 'Model fixed pricing',
    descriptionKey:
      'JSON map of model → USD cost per request. Takes precedence over ratio based billing.',
  },
  {
    name: 'ModelRatio',
    labelKey: 'Model ratio',
    descriptionKey: 'JSON map of model → multiplier applied to quota billing.',
  },
  {
    name: 'CacheRatio',
    labelKey: 'Prompt cache ratio',
    descriptionKey: 'Optional ratio used when upstream cache hits occur.',
  },
  {
    name: 'CreateCacheRatio',
    labelKey: 'Create cache ratio',
    descriptionKey:
      'Ratio applied when creating cache entries for supported models.',
  },
  {
    name: 'CompletionRatio',
    labelKey: 'Completion ratio',
    descriptionKey:
      'Applies to custom completion endpoints. JSON map of model → ratio.',
  },
  {
    name: 'ImageRatio',
    labelKey: 'Image ratio',
    descriptionKey: 'Configure per-model ratio for image inputs or outputs.',
  },
  {
    name: 'AudioRatio',
    labelKey: 'Audio ratio',
    descriptionKey:
      'Ratio applied to audio inputs where supported by the upstream model.',
  },
  {
    name: 'AudioCompletionRatio',
    labelKey: 'Audio completion ratio',
    descriptionKey: 'Ratio applied to audio completions for streaming models.',
  },
]

function ModelJsonTextareaField(props: {
  form: UseFormReturn<ModelFormValues>
  name: ModelJsonFieldName
  label: string
  description: string
}) {
  return (
    <FormField
      control={props.form.control}
      name={props.name}
      render={({ field }) => (
        <FormItem className='flex min-w-0 flex-col gap-2'>
          <FormLabel>{props.label}</FormLabel>
          <FormControl>
            <JsonCodeEditor
              value={field.value}
              onChange={(value) => field.onChange(value)}
              name={field.name}
              onBlur={field.onBlur}
              textareaRef={field.ref}
            />
          </FormControl>
          <FormDescription className='text-xs leading-5'>
            {props.description}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

export const ModelRatioForm = memo(function ModelRatioForm({
  form,
  savedValues,
  onSave,
  onReset,
  isSaving,
  isResetting,
  variant = 'default',
}: ModelRatioFormProps) {
  const { t } = useTranslation()
  const isUnsetVariant = variant === 'unset'
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')
  const [editorOpen, setEditorOpen] = useState(false)
  const visualEditorRef = useRef<ModelRatioVisualEditorHandle>(null)

  const enabledModelsQuery = useQuery({
    queryKey: ['enabled-models'],
    queryFn: getEnabledModels,
    enabled: isUnsetVariant,
  })

  const enabledModelsError = isUnsetVariant
    ? enabledModelsQuery.isError ||
      (enabledModelsQuery.data !== undefined &&
        !enabledModelsQuery.data.success)
    : false
  const enabledModelsErrorMessage = enabledModelsQuery.data?.message

  useEffect(() => {
    if (!enabledModelsError) return
    toast.error(enabledModelsErrorMessage || t('Failed to load enabled models'))
  }, [enabledModelsError, enabledModelsErrorMessage, t])

  const handleFieldChange = useCallback(
    (field: keyof ModelFormValues, value: string) => {
      form.setValue(field, value, {
        shouldDirty: true,
      })
    },
    [form]
  )

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => (prev === 'visual' ? 'json' : 'visual'))
  }, [])

  const handleSave = useCallback(async () => {
    if (editMode === 'visual') {
      const committed = await visualEditorRef.current?.commitOpenEditor()
      if (committed === false) return
    }

    await form.handleSubmit(onSave)()
  }, [editMode, form, onSave])

  const handlePersist = useCallback(async () => {
    await form.handleSubmit(onSave)()
  }, [form, onSave])

  const [
    watchedModelPrice,
    watchedModelRatio,
    watchedCacheRatio,
    watchedCreateCacheRatio,
    watchedCompletionRatio,
    watchedImageRatio,
    watchedAudioRatio,
    watchedAudioCompletionRatio,
    watchedBillingMode,
    watchedBillingExpr,
    watchedResolutionPrice,
    watchedExposeRatioEnabled,
  ] = useWatch({
    control: form.control,
    name: PRICING_WATCH_FIELDS,
  })

  const normalizedDraftValues = useMemo(
    () => ({
      ModelPrice: normalizeJsonString(watchedModelPrice ?? ''),
      ModelRatio: normalizeJsonString(watchedModelRatio ?? ''),
      CacheRatio: normalizeJsonString(watchedCacheRatio ?? ''),
      CreateCacheRatio: normalizeJsonString(watchedCreateCacheRatio ?? ''),
      CompletionRatio: normalizeJsonString(watchedCompletionRatio ?? ''),
      ImageRatio: normalizeJsonString(watchedImageRatio ?? ''),
      AudioRatio: normalizeJsonString(watchedAudioRatio ?? ''),
      AudioCompletionRatio: normalizeJsonString(
        watchedAudioCompletionRatio ?? ''
      ),
      BillingMode: normalizeJsonString(watchedBillingMode ?? ''),
      BillingExpr: normalizeJsonString(watchedBillingExpr ?? ''),
      ResolutionPrice: normalizeJsonString(watchedResolutionPrice ?? ''),
    }),
    [
      watchedAudioCompletionRatio,
      watchedAudioRatio,
      watchedBillingExpr,
      watchedBillingMode,
      watchedCacheRatio,
      watchedCompletionRatio,
      watchedCreateCacheRatio,
      watchedImageRatio,
      watchedModelPrice,
      watchedModelRatio,
      watchedResolutionPrice,
    ]
  )

  const hasUnsavedChanges = useMemo(() => {
    if (editorOpen) return true

    return (
      normalizedDraftValues.ModelPrice !== savedValues.ModelPrice ||
      normalizedDraftValues.ModelRatio !== savedValues.ModelRatio ||
      normalizedDraftValues.CacheRatio !== savedValues.CacheRatio ||
      normalizedDraftValues.CreateCacheRatio !== savedValues.CreateCacheRatio ||
      normalizedDraftValues.CompletionRatio !== savedValues.CompletionRatio ||
      normalizedDraftValues.ImageRatio !== savedValues.ImageRatio ||
      normalizedDraftValues.AudioRatio !== savedValues.AudioRatio ||
      normalizedDraftValues.AudioCompletionRatio !==
        savedValues.AudioCompletionRatio ||
      normalizedDraftValues.BillingMode !== savedValues.BillingMode ||
      normalizedDraftValues.BillingExpr !== savedValues.BillingExpr ||
      normalizedDraftValues.ResolutionPrice !== savedValues.ResolutionPrice ||
      watchedExposeRatioEnabled !== savedValues.ExposeRatioEnabled
    )
  }, [
    editorOpen,
    normalizedDraftValues,
    savedValues,
    watchedExposeRatioEnabled,
  ])

  const handlePricingChange = useCallback(
    (field: string, value: string) => {
      const formField =
        PRICING_JSON_FIELD_MAP[field] || (field as keyof ModelFormValues)
      handleFieldChange(formField, value)
    },
    [handleFieldChange]
  )

  const isDirty = hasUnsavedChanges

  return (
    <div className='space-y-6'>
      {!isUnsetVariant && (
        <>
          <FormDirtyIndicator isDirty={isDirty} />
          <div className='flex flex-wrap justify-end gap-2'>
          <Button
            type='button'
            variant='destructive'
            size='sm'
            onClick={onReset}
            disabled={isResetting}
          >
            <RotateCcw data-icon='inline-start' />
            {t('Reset prices')}
          </Button>
          <Button
            type='button'
            size='sm'
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <Save data-icon='inline-start' />
            {isSaving ? t('Saving...') : t('Save model prices')}
          </Button>
          <Button variant='outline' size='sm' onClick={toggleEditMode}>
            {editMode === 'visual' ? (
              <>
                <Code2 className='mr-2 h-4 w-4' />
                {t('Switch to JSON')}
              </>
            ) : (
              <>
                <Eye className='mr-2 h-4 w-4' />
                {t('Switch to Visual')}
              </>
            )}
          </Button>
        </div>
        </>
      )}

      <Form {...form}>
        {editMode === 'visual' ? (
          <div className='space-y-6'>
            <ModelRatioVisualEditor
              ref={visualEditorRef}
              savedModelPrice={savedValues.ModelPrice}
              savedModelRatio={savedValues.ModelRatio}
              savedCacheRatio={savedValues.CacheRatio}
              savedCreateCacheRatio={savedValues.CreateCacheRatio}
              savedCompletionRatio={savedValues.CompletionRatio}
              savedImageRatio={savedValues.ImageRatio}
              savedAudioRatio={savedValues.AudioRatio}
              savedAudioCompletionRatio={savedValues.AudioCompletionRatio}
              savedBillingMode={savedValues.BillingMode}
              savedBillingExpr={savedValues.BillingExpr}
              savedResolutionPrice={savedValues.ResolutionPrice}
              modelPrice={watchedModelPrice ?? ''}
              modelRatio={watchedModelRatio ?? ''}
              cacheRatio={watchedCacheRatio ?? ''}
              createCacheRatio={watchedCreateCacheRatio ?? ''}
              completionRatio={watchedCompletionRatio ?? ''}
              imageRatio={watchedImageRatio ?? ''}
              audioRatio={watchedAudioRatio ?? ''}
              audioCompletionRatio={watchedAudioCompletionRatio ?? ''}
              billingMode={watchedBillingMode ?? ''}
              billingExpr={watchedBillingExpr ?? ''}
              resolutionPrice={watchedResolutionPrice ?? ''}
              candidateModelNames={
                isUnsetVariant ? enabledModelsQuery.data?.data : undefined
              }
              candidateModelsLoading={
                isUnsetVariant && enabledModelsQuery.isLoading
              }
              filterMode={isUnsetVariant ? 'unset' : 'all'}
              onSave={handleSave}
              onPersist={handlePersist}
              onEditorOpenChange={setEditorOpen}
              isSaving={isSaving}
              onChange={handlePricingChange}
            />

            {!isUnsetVariant && (
              <FormField
                control={form.control}
                name='ExposeRatioEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Expose ratio API')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Allow clients to query configured ratios via `/api/ratio`.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
            )}
          </div>
        ) : (
          <SettingsForm onSubmit={form.handleSubmit(onSave)}>
            <div className='grid min-w-0 gap-x-5 gap-y-8 lg:grid-cols-2 2xl:grid-cols-3'>
              {modelJsonFields.map((config) => (
                <ModelJsonTextareaField
                  key={config.name}
                  form={form}
                  name={config.name}
                  label={t(config.labelKey)}
                  description={t(config.descriptionKey)}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name='ExposeRatioEnabled'
              render={({ field }) => (
                <SettingsSwitchItem>
                  <SettingsSwitchContent>
                    <FormLabel>{t('Expose ratio API')}</FormLabel>
                    <FormDescription>
                      {t(
                        'Allow clients to query configured ratios via `/api/ratio`.'
                      )}
                    </FormDescription>
                  </SettingsSwitchContent>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </SettingsSwitchItem>
              )}
            />
          </SettingsForm>
        )}
      </Form>
    </div>
  )
})
