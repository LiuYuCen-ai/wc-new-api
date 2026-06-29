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
import { CreditCard, Gift, Ticket, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PromoCard } from '@/components/promo-card'
import { PROMO_POPUP_ITEMS } from '@/features/home/constants'

const PROMO_ICONS: Record<(typeof PROMO_POPUP_ITEMS)[number]['icon'], LucideIcon> =
  {
    Gift,
    CreditCard,
    Ticket,
  }

export function PromoBanner() {
  const { t } = useTranslation()

  return (
    <div className='grid gap-4 md:grid-cols-3'>
      {PROMO_POPUP_ITEMS.map((item) => {
        const Icon = PROMO_ICONS[item.icon]
        const href =
          item.linkType === 'recharge' ? '/wallet' : item.href

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
  )
}
