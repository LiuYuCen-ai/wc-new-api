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
import type { TFunction } from 'i18next'
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { useAuthStore } from '@/stores/auth-store'

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

const GUIDE_STEPS = [
  'Create an API key in the console',
  'Copy the API key into the application you want to use',
]

function GuideSlide({ t }: { t: TFunction }) {
  return (
    <div className='flex min-h-[20vh] flex-col items-center justify-center gap-5 py-2 sm:min-h-[28vh]'>
      <div className='flex w-full flex-col items-center gap-3'>
        {GUIDE_STEPS.map((step, i) => (
          <div key={i} className='flex w-full flex-col items-center gap-1'>
            <div className='flex items-center gap-3'>
              <div className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--announcement-primary,#facc15)] text-sm font-extrabold text-slate-900'>
                {i + 1}
              </div>
              <span className='text-base font-medium text-white'>{t(step)}</span>
            </div>
            {i < GUIDE_STEPS.length - 1 && (
              <div className='h-4 w-px bg-white/30' />
            )}
          </div>
        ))}
      </div>
      <p className='mt-1 max-w-xs text-center text-sm text-white/60'>
        {t('For questions, please check the detailed documentation or message customer support in the bottom-right corner')}
      </p>
    </div>
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
  const user = useAuthStore((state) => state.auth.user)
  const showRegisterButton = !user
  const [slide, setSlide] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const TOTAL_SLIDES = 2

  // 弹窗打开后 2 秒自动切换到第二屏
  useEffect(() => {
    if (!open) {
      setSlide(0)
      return
    }
    timerRef.current = setTimeout(() => {
      setSlide(1)
    }, 2000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [open])

  const goTo = (index: number) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSlide(index)
  }

  const titles = [t('Important Notice'), t('Usage Guide')]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[58vh] w-[82vw] overflow-hidden rounded-[28px] border border-white/22 bg-white/12 p-3.5 text-white shadow-[0_20px_45px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(255,255,255,0.08)] [backdrop-filter:blur(22px)_saturate(150%)] [-webkit-backdrop-filter:blur(22px)_saturate(150%)] sm:max-h-[76vh] sm:w-full sm:max-w-md sm:p-5 dark:border-white/15 dark:bg-white/8 dark:text-white'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <DialogTitle className='flex items-center gap-2 text-2xl font-semibold tracking-tight text-white dark:text-white'>
              <Megaphone className='h-5 w-5 text-[var(--announcement-primary,#facc15)]' />
              {titles[slide]}
            </DialogTitle>
            <div className='flex items-center gap-1'>
              <button
                onClick={() => goTo((slide - 1 + TOTAL_SLIDES) % TOTAL_SLIDES)}
                className='flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white'
                aria-label='上一页'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <button
                onClick={() => goTo((slide + 1) % TOTAL_SLIDES)}
                className='flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white'
                aria-label='下一页'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          </div>
          {/* 指示点 */}
          <div className='mt-1 flex items-center gap-1.5'>
            {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === slide ? 'w-4 bg-[var(--announcement-primary,#facc15)]' : 'w-1.5 bg-white/30 hover:bg-white/50'
                )}
                aria-label={`切换到第${i + 1}页`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className='mt-1 overflow-hidden'>
          <div
            className='flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]'
            style={{ transform: `translateX(-${slide * 100}%)` }}
          >
            {/* 第一屏：公告内容 */}
            <div className='w-full shrink-0'>
              <NoticeContent notice={notice} loading={loading} t={t} />
            </div>
            {/* 第二屏：使用指南 */}
            <div className='w-full shrink-0'>
              <GuideSlide t={t} />
            </div>
          </div>
        </div>

        <DialogFooter className='flex-col-reverse gap-3 bg-transparent sm:flex-col-reverse sm:gap-3'>
          <Button
            variant='ghost'
            className='h-9 w-full border-none bg-transparent text-sm font-medium text-white/86 shadow-none outline-none ring-0 transition-colors hover:bg-transparent hover:text-white focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent dark:text-white/86 dark:hover:bg-transparent dark:hover:text-white'
            onClick={onCloseToday}
          >
            {t('Close Today')}
          </Button>
          {showRegisterButton && (
            <Button
              variant='ghost'
              className='h-11 w-full rounded-2xl border border-white/12 bg-white/8 text-lg font-extrabold text-white transition-all hover:border-white/20 hover:bg-white/14 hover:text-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white'
              onClick={() => onOpenChange(false)}
              render={<Link to='/sign-up' />}
            >
              {t('Register now')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
