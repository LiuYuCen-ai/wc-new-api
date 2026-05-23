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
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Skeleton } from '@/components/ui/skeleton'
import {
  defaultAuthAnimationState,
  useAuthAnimation,
} from '@/features/auth/context/auth-animation-context'
import { AnimatedCharacters } from './animated-characters'

export type AuthAnimationPanelProps = {
  isTyping: boolean
  showPassword: boolean
  passwordLength: number
  /** Default true for standalone previews. Set false for hidden until `lg` like split auth layout. */
  forceShowOnMobile?: boolean
  className?: string
  showChrome?: boolean
}

/**
 * White sidebar with mascot characters reacting to auth field state.
 */
export function AuthAnimationPanel(props: AuthAnimationPanelProps) {
  const { t } = useTranslation()
  const { systemName, logo, loading } = useSystemConfig()
  const { status } = useStatus()
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const showLegalLinks = hasUserAgreement || hasPrivacyPolicy

  const forceShowOnMobile = props.forceShowOnMobile ?? true
  const showChrome = props.showChrome ?? true

  return (
    <div
      className={cn(
        'relative flex-col justify-between bg-white p-8 text-gray-900 sm:p-12 dark:bg-white dark:text-gray-900',
        forceShowOnMobile
          ? 'flex min-h-[min(720px,100dvh)]'
          : 'hidden min-h-[min(720px,100vh)] lg:flex',
        props.className
      )}
    >
      {showChrome ? (
        <div className='relative z-20'>
          <Link
            to='/'
            className='flex items-center gap-2 text-lg font-semibold text-gray-900'
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
        </div>
      ) : (
        <div aria-hidden />
      )}

      <div className='relative z-20 flex min-h-[280px] min-w-0 flex-1 items-center justify-center overflow-hidden pt-2 pb-2 sm:min-h-[500px] sm:pt-4'>
        <div
          className='-translate-y-6 scale-[0.55] sm:-translate-y-8 sm:scale-75 md:scale-90 lg:-translate-y-10 lg:scale-100'
          aria-hidden
        >
          <AnimatedCharacters
            isTyping={props.isTyping}
            showPassword={props.showPassword}
            passwordLength={props.passwordLength}
          />
        </div>
      </div>

      {showChrome ? (
        showLegalLinks ? (
          <div className='relative z-20 flex min-h-[2rem] flex-wrap items-center gap-4 text-sm text-gray-600 sm:gap-8 dark:text-gray-700'>
            {hasUserAgreement ? (
              <a
                href='/user-agreement'
                className='transition-colors hover:text-gray-900 dark:hover:text-black'
              >
                {t('User Agreement')}
              </a>
            ) : null}
            {hasPrivacyPolicy ? (
              <a
                href='/privacy-policy'
                className='transition-colors hover:text-gray-900 dark:hover:text-black'
              >
                {t('Privacy Policy')}
              </a>
            ) : null}
          </div>
        ) : (
          <div aria-hidden />
        )
      ) : (
        <div aria-hidden />
      )}
    </div>
  )
}

/** Reads animation sync state from {@link AuthAnimationProvider}. */
export function AuthAnimationSidebar() {
  const ctx = useAuthAnimation()
  const state = ctx?.state ?? defaultAuthAnimationState

  return (
    <AuthAnimationPanel
      forceShowOnMobile={false}
      isTyping={state.isTyping}
      showPassword={state.showPassword}
      passwordLength={state.passwordLength}
    />
  )
}

export { AnimatedCharacters, Pupil, EyeBall } from './animated-characters'
