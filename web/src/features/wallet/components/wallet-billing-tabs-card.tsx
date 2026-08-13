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
import { useState } from 'react'
import { Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RechargeFormCard } from './recharge-form-card'
import { SubscriptionPlansCard } from './subscription-plans-card'
import type { ComponentProps } from 'react'

type RechargeFormCardProps = ComponentProps<typeof RechargeFormCard>
type SubscriptionPlansCardProps = ComponentProps<
  typeof SubscriptionPlansCard
>

interface WalletBillingTabsCardProps {
  recharge: RechargeFormCardProps
  subscription: SubscriptionPlansCardProps
  onOpenBilling?: () => void
}

export function WalletBillingTabsCard({
  recharge,
  subscription,
  onOpenBilling,
}: WalletBillingTabsCardProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('subscriptions')

  return (
    <div id='wallet-add-funds' className='scroll-mt-4'>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='min-w-0 gap-0'
      >
        <Card data-card-hover='false' className='gap-0 overflow-hidden py-0'>
          <CardHeader className='border-b p-3 !pb-3 sm:p-5 sm:!pb-5'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <TabsList className='h-auto w-full flex-wrap justify-start sm:w-fit'>
                <TabsTrigger value='subscriptions'>
                  {t('Subscription Management')}
                </TabsTrigger>
                <TabsTrigger value='funds'>{t('Add Funds')}</TabsTrigger>
              </TabsList>
              {onOpenBilling ? (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={onOpenBilling}
                  className='w-full gap-2 sm:w-auto'
                >
                  <Receipt className='h-4 w-4' />
                  {t('Order History')}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className='p-3 sm:p-5'>
            <TabsContent
              value='subscriptions'
              className='mt-0 space-y-4 sm:space-y-5'
            >
              <SubscriptionPlansCard {...subscription} embedded />
            </TabsContent>
            <TabsContent value='funds' className='mt-0 space-y-4 sm:space-y-6'>
              <RechargeFormCard {...recharge} embedded />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
