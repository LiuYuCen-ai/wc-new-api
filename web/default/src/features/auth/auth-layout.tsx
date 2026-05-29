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
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AuthAnimationProvider } from './auth-animation-context'
import { LoginAnimationPanel } from './components/login-animation/login-animation-panel'

type AuthLayoutProps = {
  children: React.ReactNode
  withAnimation?: boolean
}

export function AuthLayout({ children, withAnimation = false }: AuthLayoutProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()

  const logoLink = (
    <Link
      to='/'
      className={cn(
        'flex items-center gap-2 transition-opacity hover:opacity-80',
        withAnimation
          ? 'absolute top-4 left-4 z-10 sm:top-8 sm:left-8 lg:hidden'
          : 'absolute top-4 left-4 z-10 sm:top-8 sm:left-8'
      )}
    >
      <div className='relative h-8 w-8'>
        {loading ? (
          <Skeleton className='absolute inset-0 rounded-full' />
        ) : (
          <img
            src={logo}
            alt={t('Logo')}
            className='h-8 w-8 rounded-full object-cover'
          />
        )}
      </div>
      {loading ? (
        <Skeleton className='h-6 w-24' />
      ) : (
        <h1 className='text-xl font-medium'>{systemName}</h1>
      )}
    </Link>
  )

  const formPanel = (
    <div className='relative flex min-h-svh flex-col'>
      {logoLink}
      <div
        className={cn(
          'flex flex-1 items-center pt-16 sm:pt-0',
          withAnimation
            ? 'justify-start pl-6 lg:pl-10 xl:pl-14'
            : 'container'
        )}
      >
        <div
          className={cn(
            'flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8',
            withAnimation ? 'mr-auto' : 'mx-auto'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )

  if (!withAnimation) {
    return (
      <div className='relative grid h-svh max-w-none'>
        {logoLink}
        <div className='container flex items-center pt-16 sm:pt-0'>
          <div className='mx-auto flex w-full flex-col justify-center space-y-2 px-4 py-8 sm:w-[480px] sm:p-8'>
            {children}
          </div>
        </div>
      </div>
    )
  }

  return (
    <AuthAnimationProvider>
      <div className='grid min-h-svh max-w-none lg:grid-cols-2'>
        <LoginAnimationPanel />
        {formPanel}
      </div>
    </AuthAnimationProvider>
  )
}
