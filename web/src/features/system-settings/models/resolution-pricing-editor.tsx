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
import { Plus, Trash2 } from 'lucide-react'
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

import { numericDraftRegex } from './model-pricing-core'
import {
  RESOLUTION_PRESETS,
  createResolutionRow,
  normalizeResolutionLabel,
  type ResolutionPriceRow,
} from './resolution-pricing'

type ResolutionPricingEditorProps = {
  rows: ResolutionPriceRow[]
  onChange: (rows: ResolutionPriceRow[]) => void
}

export function ResolutionPricingEditor(props: ResolutionPricingEditorProps) {
  const { t } = useTranslation()
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

  return (
    <FieldGroup className='gap-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <FieldLabel>{t('Video billing')}</FieldLabel>
          <FieldDescription>
            {t(
              'Set a USD price for each resolution. Billing is price × duration in seconds. Missing resolutions fall back to 720P.'
            )}
          </FieldDescription>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            props.onChange([...props.rows, createResolutionRow()])
          }
        >
          <Plus data-icon='inline-start' />
          {t('Add resolution')}
        </Button>
      </div>

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
            <InputGroup className='w-[168px] shrink-0'>
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
                props.onChange(props.rows.filter((item) => item.id !== row.id))
              }
            >
              <Trash2 className='text-destructive h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>
    </FieldGroup>
  )
}
