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
import type { ChangeEvent, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowUp, Loader2, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { SEEDREAM_ASPECT_RATIO_OPTIONS } from '../constants'
import type {
  PhotoAspectRatio,
  PhotoModel,
  PhotoParams,
  PhotoSizeOption,
} from '../types'
import {
  ComposerModelList,
  ComposerOption,
  ComposerSelect,
} from './composer-select'
import { PhotoCustomSizeFields } from './photo-custom-size-fields'

const PHOTO_PROMPT_SUGGESTIONS = [
  'A cinematic sunset over a calm ocean, warm light, ultra detailed',
  'Studio product photo of wireless headphones on marble',
  'A Q-style ginger cat figurine on a desk',
  'Traditional Chinese ink painting of misty mountains',
] as const

export function PhotoComposer(props: {
  params: PhotoParams
  models: PhotoModel[]
  modelsLoading?: boolean
  sizeOptions: PhotoSizeOption[]
  loading: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onParamsChange: (patch: Partial<PhotoParams>) => void
  onAddCustomModel: (modelId: string) => void
  onSubmit: () => void
  onFilesPicked: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: (index: number) => void
}) {
  const { t } = useTranslation()
  const selectedModel =
    props.models.find((model) => model.id === props.params.model) ??
    (props.params.model
      ? { id: props.params.model, label: props.params.model }
      : null)
  const modelLabel =
    selectedModel?.label ||
    (props.modelsLoading ? t('Loading') : t('Model'))

  return (
    <div className='mx-auto w-full max-w-3xl'>
      <h1 className='mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl'>
        {t('Start creating with')}{' '}
        <ComposerSelect
          label={modelLabel}
          ariaLabel={t('Model')}
          contentClassName='w-80'
          triggerClassName='inline-flex h-auto max-w-[min(100%,20rem)] items-baseline gap-1 rounded-none border-0 bg-transparent px-0 text-2xl font-semibold text-primary hover:bg-transparent sm:text-3xl [&_svg]:size-5'
        >
          {(close) => (
            <ComposerModelList
              models={props.models}
              selectedId={props.params.model}
              loading={props.modelsLoading}
              onSelect={(modelId) => {
                const selected = props.models.find(
                  (model) => model.id === modelId
                )
                props.onParamsChange({
                  model: modelId,
                  endpointTypes: selected?.endpointTypes ?? [],
                })
                close()
              }}
              onAddCustom={(modelId) => {
                props.onAddCustomModel(modelId)
                props.onParamsChange({
                  model: modelId,
                  endpointTypes: [],
                })
                close()
              }}
            />
          )}
        </ComposerSelect>
      </h1>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          props.onSubmit()
        }}
        className='bg-muted/40 flex flex-col gap-3 rounded-[28px] border p-3 sm:p-4'
        aria-label='photo-prompt-bar'
      >
        <input
          ref={props.fileInputRef}
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          onChange={props.onFilesPicked}
        />
        <div className='flex items-start gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='text-muted-foreground mt-0.5 size-11 shrink-0 rounded-2xl'
            disabled={props.params.imageDataUrls.length >= 6}
            aria-label={t('Image Input')}
            onClick={() => {
              if (!props.params.imageUrlEnabled) {
                props.onParamsChange({ imageUrlEnabled: true })
              }
              props.fileInputRef.current?.click()
            }}
          >
            <Plus className='size-5' />
          </Button>
          <Label htmlFor='photo-prompt' className='sr-only'>
            {t('Prompt')}
          </Label>
          <Textarea
            id='photo-prompt'
            rows={3}
            value={props.params.prompt}
            onChange={(event) =>
              props.onParamsChange({ prompt: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                props.onSubmit()
              }
            }}
            placeholder={t('Describe your idea.')}
            className='max-h-48 min-h-20 flex-1 resize-none border-0 bg-transparent px-1 py-2.5 shadow-none focus-visible:ring-0'
          />
        </div>

        {props.params.imageDataUrls.length > 0 ? (
          <div className='flex flex-wrap gap-2 px-1'>
            {props.params.imageDataUrls.map((img, index) => (
              <div
                key={img.dataUrl}
                className='group bg-muted relative size-16 overflow-hidden rounded-md border'
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className='size-full object-cover'
                />
                <Button
                  type='button'
                  variant='secondary'
                  size='icon'
                  className='absolute top-0.5 right-0.5 size-5 opacity-0 transition-opacity group-hover:opacity-100'
                  onClick={() => props.onRemoveImage(index)}
                >
                  <X className='size-3' />
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1.5'>
            <ComposerSelect
              label={modelLabel}
              ariaLabel={t('Model')}
              contentClassName='w-80'
            >
              {(close) => (
                <ComposerModelList
                  models={props.models}
                  selectedId={props.params.model}
                  loading={props.modelsLoading}
                  onSelect={(modelId) => {
                    const selected = props.models.find(
                      (model) => model.id === modelId
                    )
                    props.onParamsChange({
                      model: modelId,
                      endpointTypes: selected?.endpointTypes ?? [],
                    })
                    close()
                  }}
                  onAddCustom={(modelId) => {
                    props.onAddCustomModel(modelId)
                    props.onParamsChange({
                      model: modelId,
                      endpointTypes: [],
                    })
                    close()
                  }}
                />
              )}
            </ComposerSelect>

            <ComposerSelect
              label={props.params.aspectRatio}
              ariaLabel={t('Aspect ratio')}
            >
              {(close) =>
                SEEDREAM_ASPECT_RATIO_OPTIONS.map((item) => (
                  <ComposerOption
                    key={item.ratio}
                    selected={item.ratio === props.params.aspectRatio}
                    title={item.ratio}
                    hint={t(item.hint)}
                    onClick={() => {
                      props.onParamsChange({
                        aspectRatio: item.ratio as PhotoAspectRatio,
                      })
                      close()
                    }}
                  />
                ))
              }
            </ComposerSelect>

            <ComposerSelect
              label={
                props.params.imageSize === 'custom'
                  ? `${props.params.customWidth}×${props.params.customHeight}`
                  : props.params.imageSize
              }
              ariaLabel={t('Image size')}
            >
              {(close) => (
                <>
                  {props.sizeOptions.map((item) => (
                    <ComposerOption
                      key={item.value}
                      selected={item.value === props.params.imageSize}
                      title={
                        item.value === 'custom' ? t('Custom') : item.value
                      }
                      hint={
                        item.hint && item.hint !== item.value
                          ? t(item.hint)
                          : undefined
                      }
                      onClick={() => {
                        props.onParamsChange({
                          imageSize: item.value,
                          resolution: item.value,
                        })
                        if (item.value !== 'custom') close()
                      }}
                    />
                  ))}
                  {props.params.imageSize === 'custom' ? (
                    <PhotoCustomSizeFields
                      width={props.params.customWidth}
                      height={props.params.customHeight}
                      idPrefix='photo-composer-custom'
                      onCommit={props.onParamsChange}
                    />
                  ) : null}
                </>
              )}
            </ComposerSelect>
          </div>

          <Button
            type='submit'
            size='icon'
            disabled={props.loading}
            className='size-10 shrink-0 rounded-full'
            aria-label={t('Generate')}
          >
            {props.loading ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <ArrowUp className='size-4' />
            )}
          </Button>
        </div>
      </form>

      <div className='mt-3 flex gap-2 overflow-x-auto pb-1'>
        {PHOTO_PROMPT_SUGGESTIONS.map((prompt) => (
          <button
            key={prompt}
            type='button'
            onClick={() => props.onParamsChange({ prompt: t(prompt) })}
            className='bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground max-w-52 shrink-0 truncate rounded-full border px-3 py-1.5 text-left text-xs transition-colors'
          >
            {t(prompt)}
          </button>
        ))}
      </div>
    </div>
  )
}
