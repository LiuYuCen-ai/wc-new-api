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
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown } from 'lucide-react'

import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { PhotoModel } from '../types'

export const composerChipClass =
  'inline-flex h-8 max-w-full min-w-0 items-center gap-1 rounded-full border bg-muted/40 px-2.5 text-xs font-medium transition-colors hover:bg-muted'

export function ComposerSelect(props: {
  label: string
  ariaLabel: string
  contentClassName?: string
  triggerClassName?: string
  side?: 'top' | 'bottom'
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(composerChipClass, props.triggerClassName)}
        aria-label={props.ariaLabel}
      >
        <span className='truncate'>{props.label}</span>
        <ChevronDown className='size-3.5 shrink-0 opacity-70' />
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side={props.side ?? 'bottom'}
        className={cn('w-72 gap-1 p-1.5', props.contentClassName)}
      >
        {props.children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  )
}

export function ComposerModelList(props: {
  models: PhotoModel[]
  selectedId: string
  loading?: boolean
  onSelect: (modelId: string) => void
  onAddCustom: (modelId: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()
  const filtered = keyword
    ? props.models.filter(
        (model) =>
          model.label.toLowerCase().includes(keyword) ||
          model.id.toLowerCase().includes(keyword)
      )
    : props.models
  const exactMatch = props.models.some(
    (model) => model.id.toLowerCase() === keyword
  )
  const canAddCustom = Boolean(keyword) && !exactMatch

  return (
    <div className='flex flex-col gap-1'>
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('Search models')}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          event.preventDefault()
          if (canAddCustom) {
            props.onAddCustom(query.trim())
            return
          }
          if (filtered[0]) props.onSelect(filtered[0].id)
        }}
      />
      <div className='max-h-64 overflow-y-auto'>
        {props.loading ? (
          <p className='text-muted-foreground px-2.5 py-2 text-xs'>
            {t('Loading')}
          </p>
        ) : null}
        {!props.loading && filtered.length === 0 && !canAddCustom ? (
          <p className='text-muted-foreground px-2.5 py-2 text-xs'>
            {t('No models available')}
          </p>
        ) : null}
        {filtered.map((model) => (
          <ComposerOption
            key={model.id}
            selected={model.id === props.selectedId}
            title={model.label}
            hint={model.description || undefined}
            onClick={() => props.onSelect(model.id)}
          />
        ))}
        {canAddCustom ? (
          <ComposerOption
            selected={false}
            title={t('Add custom model "{{value}}"', {
              value: query.trim(),
            })}
            hint={t('Enter a model configured by this site')}
            onClick={() => props.onAddCustom(query.trim())}
          />
        ) : null}
      </div>
    </div>
  )
}

export function ComposerOption(props: {
  selected: boolean
  title: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
        props.selected ? 'bg-primary/10' : 'hover:bg-muted'
      )}
    >
      <div className='min-w-0 flex-1'>
        <span className='block text-sm font-medium leading-snug'>
          {props.title}
        </span>
        {props.hint ? (
          <span className='text-muted-foreground mt-0.5 block text-[11px] leading-snug'>
            {props.hint}
          </span>
        ) : null}
      </div>
      {props.selected ? (
        <Check className='text-primary mt-0.5 size-3.5 shrink-0' />
      ) : null}
    </button>
  )
}
