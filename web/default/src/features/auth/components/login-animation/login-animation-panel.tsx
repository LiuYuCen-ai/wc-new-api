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
import { cn } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useStatus } from '@/hooks/use-status'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthAnimation } from '../../auth-animation-context'
import { AnimatedCharacters } from './animated-characters'

export function LoginAnimationPanel({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { isTyping, showPassword, passwordLength } = useAuthAnimation()
  const { systemName, logo, loading } = useSystemConfig()
  const { status } = useStatus()

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  return (
    <div
      className={cn(
        'relative hidden min-h-svh flex-col bg-white text-gray-900 lg:flex dark:bg-white dark:text-gray-900',
        className
      )}
    >
      <Link
        to='/'
        className='absolute top-4 left-4 z-20 flex items-center gap-2 text-lg font-semibold transition-opacity hover:opacity-80 sm:top-8 sm:left-8'
      >
          <div className='relative h-8 w-8'>
            {loading ? (
              <Skeleton className='absolute inset-0 rounded-lg' />
            ) : (
              <img
                src={logo}
                alt={t('Logo')}
                width={32}
                height={32}
                className='rounded-lg bg-gray-100 p-1 object-cover'
              />
            )}
          </div>
          {loading ? (
            <Skeleton className='h-6 w-32' />
          ) : (
            <span>{systemName}</span>
          )}
      </Link>

      <div className='relative z-20 flex flex-1 items-center justify-end pl-4 pr-6 sm:pl-8 sm:pr-10 lg:pr-14'>
        <AnimatedCharacters
          isTyping={isTyping}
          showPassword={showPassword}
          passwordLength={passwordLength}
        />
      </div>

      {(hasUserAgreement || hasPrivacyPolicy) && (
        <div className='absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-8 text-sm text-gray-600 sm:bottom-8 sm:left-8 dark:text-gray-700'>
          {hasPrivacyPolicy && (
            <a
              href='/privacy-policy'
              className='transition-colors hover:text-gray-900 dark:hover:text-black'
            >
              {t('Privacy Policy')}
            </a>
          )}
          {hasUserAgreement && (
            <a
              href='/user-agreement'
              className='transition-colors hover:text-gray-900 dark:hover:text-black'
            >
              {t('User Agreement')}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
