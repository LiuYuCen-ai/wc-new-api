import { useTranslation } from 'react-i18next'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import {
  SettingsControlGroup,
  SettingsSwitchField,
} from '../components/settings-form-layout'

export function PriceInput(props: {
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <InputGroup>
      <InputGroupAddon>$</InputGroupAddon>
      <InputGroupInput
        inputMode='decimal'
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <InputGroupAddon align='inline-end'>$/1M</InputGroupAddon>
    </InputGroup>
  )
}

export function BasePriceInput(props: {
  title: string
  description: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <SettingsControlGroup className='space-y-2'>
      <div className='min-w-0 space-y-0.5'>
        <Label className='text-sm font-medium'>{props.title}</Label>
        <p className='text-muted-foreground text-xs'>{props.description}</p>
      </div>
      <PriceInput
        value={props.value}
        placeholder={props.placeholder}
        onChange={props.onChange}
      />
    </SettingsControlGroup>
  )
}

export function PriceLane(props: {
  title: string
  description: string
  placeholder: string
  value: string
  enabled: boolean
  disabled?: boolean
  onEnabledChange: (checked: boolean) => void
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const effectiveDisabled = props.disabled || !props.enabled

  return (
    <SettingsControlGroup
      className={cn('space-y-3', effectiveDisabled && 'opacity-75')}
      data-disabled={effectiveDisabled || undefined}
    >
      <SettingsSwitchField
        checked={props.enabled}
        disabled={props.disabled}
        onCheckedChange={props.onEnabledChange}
        label={props.title}
        description={props.description}
        aria-label={props.title}
      />
      <PriceInput
        value={props.value}
        placeholder={props.placeholder}
        disabled={effectiveDisabled}
        onChange={props.onChange}
      />
      <p className='text-muted-foreground text-xs'>
        {props.enabled
          ? t('USD price per 1M tokens.')
          : t('Disabled lanes are omitted on save.')}
      </p>
    </SettingsControlGroup>
  )
}
