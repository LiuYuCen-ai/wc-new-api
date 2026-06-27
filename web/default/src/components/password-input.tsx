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
import { Button } from './ui/button'
import { Input } from './ui/input'

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> & {
  ref?: React.Ref<HTMLInputElement>
}

export function PasswordInput({
  className,
  disabled,
  ref,
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <div className={cn('relative rounded-md', className)}>
      <Input
        type={showPassword ? 'text' : 'password'}
        className='pe-10'
        ref={ref}
        disabled={disabled}
        {...props}
      />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        disabled={disabled}
        tabIndex={-1}
        className='text-muted-foreground hover:text-foreground absolute end-0 top-1/2 h-full w-10 -translate-y-1/2 rounded-md rounded-s-none hover:bg-transparent'
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={
          showPassword ? t('Hide password') : t('Show password')
        }
        aria-pressed={showPassword}
      >
        {showPassword ? (
          <EyeOff size={18} aria-hidden='true' />
        ) : (
          <Eye size={18} aria-hidden='true' />
        )}
      </Button>
    </div>
  )
}
