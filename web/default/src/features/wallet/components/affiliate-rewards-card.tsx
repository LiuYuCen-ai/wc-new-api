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
import { ArrowRightLeft, Gift, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyButton } from '@/components/copy-button'
import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard({
  user,
  affiliateLink,
  onTransfer,
  complianceConfirmed = true,
  loading,
}: AffiliateRewardsCardProps) {
  const { t } = useTranslation()
  if (loading) {
    return (
      <Card data-card-hover='false' className='overflow-hidden py-0'>
        <CardContent className='space-y-4 p-0'>
          <Skeleton className='h-28 rounded-none' />
          <div className='space-y-4 p-4'>
            <Skeleton className='h-9 rounded-lg' />
            <Skeleton className='h-24 rounded-lg' />
            <Skeleton className='h-40 rounded-lg' />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (user?.aff_quota ?? 0) > 0

  const rewardNotes = [
    t(
      'Invite friends to register. You will receive corresponding rewards after they add funds.'
    ),
    t(
      'Use the transfer function to move reward quota into your account balance.'
    ),
    t('Invite more friends to earn more rewards.'),
  ]

  const rechargeRules = [
    t('Recharge rebate ratio: 10%'),
    t("Recharge rebate count: your friend's first 3 top-ups"),
  ]

  const agentRules = [
    t('Agent commission'),
    t('Commission ratio: 5.0%'),
    t(
      'Subordinate accounts must be registered for 15 days before participating in commission calculation.'
    ),
    t('Each subordinate account has a monthly commission contribution limit.'),
  ]

  return (
    <Card data-card-hover='false' className='overflow-hidden py-0'>
      <CardContent className='p-0'>
        <div className='relative overflow-hidden bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 px-4 py-4 text-white sm:px-5'>
          <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.12),transparent_32%)]' />
          <div className='relative flex items-center justify-between gap-3'>
            <div>
              <div className='flex items-center gap-2 text-sm font-semibold'>
                <Gift className='size-4' />
                {t('Revenue Statistics')}
              </div>
              <p className='mt-1 text-xs text-white/70'>
                {t('Invite friends to earn additional rewards')}
              </p>
            </div>
            <Button
              size='sm'
              variant='secondary'
              onClick={onTransfer}
              disabled={!hasRewards || !complianceConfirmed}
              className='h-8 shrink-0 gap-1.5 rounded-full bg-white/15 px-3 text-white hover:bg-white/25 hover:text-white'
            >
              <ArrowRightLeft className='size-3.5' />
              {t('Transfer rewards')}
            </Button>
          </div>

          <div className='relative mt-5 grid grid-cols-3 gap-3 text-center'>
            {[
              [t('Available Rewards'), formatQuota(user?.aff_quota ?? 0)],
              [t('Total Earned'), formatQuota(user?.aff_history_quota ?? 0)],
              [t('Invites'), String(user?.aff_count ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className='min-w-0'>
                <div className='truncate text-lg font-bold tabular-nums'>
                  {value}
                </div>
                <div className='mt-1 truncate text-[11px] text-white/70'>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='space-y-4 p-4 sm:p-5'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between gap-2'>
              <LabelLike title={t('Referral Link')} />
              <span className='text-muted-foreground inline-flex items-center gap-1 text-xs'>
                <Users className='size-3.5' />
                {t('Share with friends')}
              </span>
            </div>
            <div className='relative'>
              <Input
                value={affiliateLink}
                readOnly
                className='bg-muted/40 h-9 pr-20 font-mono text-xs'
              />
              <CopyButton
                value={affiliateLink}
                className='absolute top-1/2 right-1 h-7 -translate-y-1/2 gap-1 rounded-md px-2 active:not-aria-[haspopup]:-translate-y-1/2'
                iconClassName='size-3.5'
                tooltip={t('Copy referral link')}
                aria-label={t('Copy referral link')}
              >

              </CopyButton>
            </div>
          </div>

          <div className='rounded-xl border'>
            <div className='border-b px-4 py-3 text-sm font-semibold'>
              {t('Invitation Rebate')}
            </div>
            <div className='grid grid-cols-2 divide-x px-4 py-4 text-center'>
              <div>
                <div className='text-lg font-bold'>
                  {formatQuota(user?.aff_quota ?? 0)}
                </div>
                <div className='text-muted-foreground mt-1 text-xs'>
                  {t('Available Rewards')}
                </div>
              </div>
              <div>
                <div className='text-lg font-bold'>
                  {formatQuota(user?.aff_history_quota ?? 0)}
                </div>
                <div className='text-muted-foreground mt-1 text-xs'>
                  {t('Accumulated Rebate')}
                </div>
              </div>
            </div>
          </div>

          <div className='space-y-3 rounded-xl border p-4'>
            <div className='text-sm font-semibold'>{t('Reward Rules')}</div>
            <ul className='space-y-2 text-sm'>
              {rewardNotes.map((note) => (
                <li key={note} className='flex gap-2'>
                  <span className='mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500' />
                  <span>{note}</span>
                </li>
              ))}
            </ul>

            <div className='rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100'>
              <ul className='space-y-2'>
                {rechargeRules.map((rule) => (
                  <li key={rule} className='flex gap-2'>
                    <span className='mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500' />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'>
              <ul className='space-y-2'>
                {agentRules.map((rule) => (
                  <li key={rule} className='flex gap-2'>
                    <span className='mt-2 size-1.5 shrink-0 rounded-full bg-amber-500' />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className='text-muted-foreground text-xs'>
              {t('View invited users and commission records')}
            </p>
          </div>

          {!complianceConfirmed ? (
            <p className='text-muted-foreground text-xs'>
              {t(
                'Referral reward transfer is disabled until the administrator confirms compliance terms.'
              )}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function LabelLike(props: { title: string }) {
  return <div className='text-sm font-medium'>{props.title}</div>
}
