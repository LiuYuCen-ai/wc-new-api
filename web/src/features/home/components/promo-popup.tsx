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
            const href = 'href' in item ? item.href : rechargeHref

            return (
              <PromoCard
                key={item.title}
                icon={Icon}
                title={t(item.title)}
                description={t(item.description)}
                href={href}
                external={'external' in item ? item.external : false}
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
