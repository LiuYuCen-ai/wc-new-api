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
import type { TFunction } from 'i18next'
import { Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PromoNoticeTemplate {
  template: 'promo'
  title?: string
  highlight?: string
  description?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  highlightSize?: 'small' | 'medium' | 'large' | 'xl'
}

type NoticeRenderContent = string | PromoNoticeTemplate

interface AnnouncementItem {
  type?: string
  content?: NoticeRenderContent
  extra?: string
  publishDate?: string | Date
}

interface NotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeTab?: 'notice' | 'announcements'
  onTabChange?: (tab: 'notice' | 'announcements') => void
  notice: NoticeRenderContent
  announcements?: AnnouncementItem[]
  loading: boolean
  onCloseToday: () => void
}

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className='flex flex-col items-center justify-center py-12 text-center'>
      <p className='text-slate-500 text-sm'>{message}</p>
    </div>
  )
}

function isPromoNoticeTemplate(value: NoticeRenderContent | undefined): value is PromoNoticeTemplate {
  return !!value && typeof value === 'object' && value.template === 'promo'
}

function getPromoAlignClass(align?: PromoNoticeTemplate['align']): string {
  if (align === 'left') return 'items-start text-left'
  if (align === 'right') return 'items-end text-right'
  return 'items-center text-center'
}

function getPromoVerticalClass(verticalAlign?: PromoNoticeTemplate['verticalAlign']): string {
  if (verticalAlign === 'top') return 'justify-start pt-4'
  if (verticalAlign === 'bottom') return 'justify-end pb-4'
  return 'justify-center'
}

function getPromoHighlightSizeClass(size?: PromoNoticeTemplate['highlightSize']): string {
  if (size === 'small') return 'text-3xl'
  if (size === 'medium') return 'text-4xl'
  if (size === 'xl') return 'text-7xl'
  return 'text-5xl'
}

function NoticeBody({ content }: { content: NoticeRenderContent }) {
  if (isPromoNoticeTemplate(content)) {
    return (
      <div
        className={cn(
          'flex min-h-[20vh] flex-col gap-3 text-white sm:min-h-[28vh] sm:gap-4 dark:text-white',
          getPromoAlignClass(content.align),
          getPromoVerticalClass(content.verticalAlign)
        )}
      >
        {content.title && (
          <p className='max-w-md text-xl leading-7 font-medium'>
            {content.title}
          </p>
        )}
        {content.highlight && (
          <div
            className={cn(
              'font-extrabold tracking-tight text-[var(--announcement-primary,#facc15)]',
              getPromoHighlightSizeClass(content.highlightSize)
            )}
          >
            {content.highlight}
          </div>
        )}
        {content.description && (
          <p className='max-w-md text-xl leading-7 font-medium'>
            {content.description}
          </p>
        )}
      </div>
    )
  }

  return (
    <Markdown className='text-center [&_h1]:my-5 [&_h1]:text-5xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h1]:text-[var(--announcement-primary,#facc15)] [&_p]:mx-auto [&_p]:max-w-md [&_p]:text-center [&_strong]:font-bold'>
      {content}
    </Markdown>
  )
}

/**
 * Notice tab content
 */
function NoticeContent({
  notice,
  loading,
  t,
}: {
  notice: NoticeRenderContent
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return <EmptyState message={t('Loading...')} />
  }

  if (!notice) {
    return <EmptyState message={t('No announcements at this time')} />
  }

  return (
    <ScrollArea className='h-[24vh] pr-3 text-white sm:h-[34vh] sm:pr-4 dark:text-white'>
      <NoticeBody content={notice} />
    </ScrollArea>
  )
}

/**
 * Promo notice dialog
 */
export function NotificationDialog({
  open,
  onOpenChange,
  notice,
  loading,
  onCloseToday,
}: NotificationDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[58vh] w-[82vw] overflow-hidden rounded-[28px] border border-white/22 bg-white/12 p-3.5 text-white shadow-[0_20px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.08)] [backdrop-filter:blur(22px)_saturate(150%)] [-webkit-backdrop-filter:blur(22px)_saturate(150%)] sm:max-h-[76vh] sm:w-full sm:max-w-md sm:p-5 dark:border-white/15 dark:bg-white/8 dark:text-white'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-2xl font-semibold tracking-tight text-white dark:text-white'>
            <Megaphone className='h-5 w-5 text-[var(--announcement-primary,#facc15)]' />
            {t('Important Notice')}
          </DialogTitle>
        </DialogHeader>

        <div className='mt-1'>
          <NoticeContent notice={notice} loading={loading} t={t} />
        </div>

        <DialogFooter className='flex-col-reverse gap-3 bg-transparent sm:flex-col-reverse sm:gap-3'>
          <Button
            variant='ghost'
            className='h-11 w-full rounded-2xl border border-white/12 bg-white/8 text-white transition-all hover:border-white/20 hover:bg-white/14 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white'
            onClick={onCloseToday}
          >
            {t('Close Today')}
          </Button>
          <Button
            variant='ghost'
            className='h-11 w-full rounded-2xl border border-white/12 bg-white/8 text-white transition-all hover:border-white/20 hover:bg-white/14 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white'
            onClick={() => onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
