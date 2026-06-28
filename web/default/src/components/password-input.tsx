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
import { Eye, EyeClosed } from 'lucide-react'
import { t } from 'i18next'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
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
    <div className={cn('relative rounded-md', className)}>
      <Input
        type={showPassword ? 'text' : 'password'}
        className='pe-10'
        ref={ref}
        disabled={disabled}
        onFocus={(event) => {
          onFocus?.(event)
          onVisibilityChange?.(showPassword)
        }}
        {...props}
      />
      <div className='pointer-events-none absolute inset-y-0 end-0 flex w-10 items-center justify-center'>
        <Button
          type='button'
          size='icon'
          variant='ghost'
          disabled={disabled}
          tabIndex={-1}
          className='text-muted-foreground hover:text-foreground pointer-events-auto size-8 rounded-md hover:bg-transparent active:not-aria-[haspopup]:translate-y-0'
          onMouseDown={(event) => event.preventDefault()}
          onClick={toggleVisibility}
          aria-label={
            showPassword ? t('Hide password') : t('Show password')
          }
          aria-pressed={showPassword}
        >
        {showPassword ? (
          <Eye size={18} aria-hidden='true' />
        ) : (
          <EyeClosed size={18} aria-hidden='true' />
        )}
        </Button>
      </div>
    </div>
  )
}
