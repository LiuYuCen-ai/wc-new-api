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
import {
  CreditCard,
  Gift,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { PromoCard } from '@/components/promo-card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { PROMO_POPUP_ITEMS } from '../constants'

const PROMO_ICONS: Record<(typeof PROMO_POPUP_ITEMS)[number]['icon'], LucideIcon> =
  {
    Gift,
    CreditCard,
    Ticket,
  }

interface PromoPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCloseToday: () => void
  isAuthenticated?: boolean
}

export function PromoPopup({
  open,
  onOpenChange,
  onCloseToday,
  isAuthenticated = false,
}: PromoPopupProps) {
  const { t } = useTranslation()
  const rechargeHref = isAuthenticated ? '/console/topup' : '/sign-up'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='gap-5 border-white/80 bg-white p-5 sm:max-w-4xl sm:p-6'
        showCloseButton
      >
        <div className='grid gap-4 sm:grid-cols-3'>
          {PROMO_POPUP_ITEMS.map((item) => {
            const Icon = PROMO_ICONS[item.icon]
            const href =
              item.linkType === 'recharge'
                ? rechargeHref
                : item.href

            return (
              <PromoCard
                key={item.title}
                icon={Icon}
                title={t(item.title)}
                description={t(item.description)}
                href={href}
                external={item.external}
              />
            )
          })}
        </div>

        <DialogFooter className='border-0 bg-transparent p-0 sm:justify-center'>
          <Button variant='outline' onClick={onCloseToday}>
            {t('Close Today')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('Close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
