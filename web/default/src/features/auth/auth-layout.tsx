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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { AuthAnimationSidebar } from '@/features/auth/components/auth-animation/auth-animation-panel'
import { AuthAnimationProvider } from '@/features/auth/context/auth-animation-context'

type AuthLayoutProps = {
  children: React.ReactNode
  contentClassName?: string
}

export function AuthLayout({ children, contentClassName }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  return (
    <AuthAnimationProvider>
      <div className='min-h-svh bg-white'>
        <Link
          to='/'
          className='fixed top-4 left-4 z-30 flex items-center gap-2 text-lg font-semibold text-gray-900 transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
        >
          <div className='relative h-8 w-8 shrink-0'>
            {loading ? (
              <Skeleton className='absolute inset-0 rounded-lg' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                width={32}
                height={32}
                className='rounded-lg border border-gray-200 bg-white p-1'
              />
            )}
          </div>
          {loading ? (
            <Skeleton className='h-7 w-36' />
          ) : (
            <span>{systemName}</span>
          )}
        </Link>

        <div className='grid min-h-svh lg:grid-cols-[550px_420px] lg:justify-center lg:gap-7'>
          <AuthAnimationSidebar />

          <div className='relative flex min-h-svh items-center justify-center bg-white px-6 py-10 sm:px-10 lg:px-0'>
            <div
              className={cn(
                'w-full max-w-[420px] pt-16 sm:pt-20 lg:pt-0',
                contentClassName
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </AuthAnimationProvider>
  )
}
