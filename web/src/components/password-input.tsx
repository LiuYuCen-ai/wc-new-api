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
import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { t } from 'i18next'
import { cn } from '@/lib/utils'

import { Input } from './ui/input'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
  onVisibilityChange?: (visible: boolean) => void
}

export function PasswordInput({
  className,
  disabled,
  onFocus,
  onVisibilityChange,
  ref,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  const toggleVisibility = () => {
    setShowPassword((previous) => {
      const next = !previous
      onVisibilityChange?.(next)
      return next
    })
  }

  return (
    <div className='relative rounded-md'>
      <Input
        type={showPassword ? 'text' : 'password'}
        ref={ref}
        disabled={disabled}
        onFocus={(event) => {
          onFocus?.(event)
          onVisibilityChange?.(showPassword)
        }}
        {...props}
        className={cn('pe-10', className)}
      />
      <div className='pointer-events-none absolute inset-y-0 end-0 flex w-10 items-center justify-center'>
        <button
          type='button'
          disabled={disabled}
          tabIndex={-1}
          className={cn(
            'text-muted-foreground pointer-events-auto inline-flex size-7 items-center justify-center rounded-full border-0 bg-transparent',
            'transition-colors duration-150',
            'hover:bg-foreground/8 hover:text-foreground',
            'active:bg-foreground/12 active:text-foreground',
            'focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleVisibility}
          aria-label={
            showPassword ? t('Hide password') : t('Show password')
          }
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <Eye size={16} aria-hidden='true' />
          ) : (
            <EyeOff size={16} aria-hidden='true' />
          )}
        </button>
      </div>
    </div>
  )
}
