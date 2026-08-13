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
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
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
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  activeTab: 'notice' | 'announcements'
  onTabChange: (tab: 'notice' | 'announcements') => void
  notice: NoticeRenderContent
  announcements: AnnouncementItem[]
  loading: boolean
  onCloseToday: () => void
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(publishDate: string | Date, t: TFunction): string {
  if (!publishDate) return ''

  const now = new Date()
  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (isNaN(pubDate.getTime()))
    return typeof publishDate === 'string' ? publishDate : ''

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  // Return relative time based on difference
  if (diffSeconds < 60) return t('Just now')
  if (diffMinutes < 60)
    return diffMinutes === 1
      ? t('1 minute ago')
      : t('{{count}} minutes ago', { count: diffMinutes })
  if (diffHours < 24)
    return diffHours === 1
      ? t('1 hour ago')
      : t('{{count}} hours ago', { count: diffHours })
  if (diffDays < 7)
    return diffDays === 1
      ? t('1 day ago')
      : t('{{count}} days ago', { count: diffDays })
  if (diffWeeks < 4)
    return diffWeeks === 1
      ? t('1 week ago')
      : t('{{count}} weeks ago', { count: diffWeeks })
  if (diffMonths < 12)
    return diffMonths === 1
      ? t('1 month ago')
      : t('{{count}} months ago', { count: diffMonths })
  if (diffYears < 2) return t('1 year ago')

  // Over 2 years, show specific date
  return formatDateTimeObject(pubDate)
}

/**
 * Announcement status dot indicator
 */
function AnnouncementDot({ type }: { type?: string }) {
  return (
    <span
      className={cn(
        'mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full',
        getAnnouncementColorClass(type)
      )}
    />
  )
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
          'flex min-h-[20vh] flex-col gap-3 text-slate-700 sm:min-h-[28vh] sm:gap-4 dark:text-slate-200',
          getPromoAlignClass(content.align),
          getPromoVerticalClass(content.verticalAlign)
        )}
      >
        {content.title && (
          <p className='max-w-md text-base leading-7 font-medium'>
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
          <p className='max-w-md text-base leading-7 font-medium'>
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
    <ScrollArea className='h-[24vh] pr-3 text-slate-700 sm:h-[34vh] sm:pr-4 dark:text-slate-200'>
      <NoticeBody content={notice} />
    </ScrollArea>
  )
}

/**
 * Announcements tab content
 */
function AnnouncementsContent({
  announcements,
  loading,
  t,
}: {
  announcements: AnnouncementItem[]
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return <EmptyState message={t('Loading...')} />
  }

  if (announcements.length === 0) {
    return <EmptyState message={t('No system announcements')} />
  }

  return (
    <ScrollArea className='h-[20vh] pr-3 text-slate-700 sm:h-[clamp(12rem,24vh,17rem)] sm:pr-4 dark:text-slate-200'>
      <div className='space-y-0'>
        {announcements.map((item, idx) => {
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, t)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''

          return (
            <div key={idx}>
              <div className='py-3'>
                <div className='flex items-start gap-3'>
                  <AnnouncementDot type={item.type} />
                  <div className='min-w-0 flex-1 space-y-2'>
                    {/* Content */}
                    <div className='text-sm leading-6 text-slate-700 dark:text-slate-200'>
                      <NoticeBody content={item.content || ''} />
                    </div>

                    {/* Extra info */}
                    {item.extra && (
                      <div className='text-xs text-slate-500 dark:text-slate-400'>
                        <Markdown>{item.extra}</Markdown>
                      </div>
                    )}

                    {/* Time */}
                    {absoluteTime && (
                      <div className='text-muted-foreground text-xs'>
                        {relativeTime && `${relativeTime} • `}
                        {absoluteTime}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {idx < announcements.length - 1 && <Separator />}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Notification dialog with Notice and Announcements tabs
 */
export function NotificationDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  notice,
  announcements,
  loading,
  onCloseToday,
}: NotificationDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[58vh] w-[82vw] overflow-hidden border border-white/45 bg-white/72 p-3.5 text-slate-800 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] ring-white/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/60 sm:max-h-[76vh] sm:w-full sm:max-w-md sm:p-5 dark:border-white/10 dark:bg-slate-950/62 dark:text-slate-100 dark:ring-white/10'>
        <DialogHeader>
          <DialogTitle className='text-lg font-semibold tracking-tight text-slate-900 dark:text-white'>
            {t('System Announcements')}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={onTabChange as (value: string) => void}
        >
          <TabsList className='grid w-full grid-cols-2 rounded-full border border-white/55 bg-white/58 p-1 shadow-inner shadow-slate-950/10 backdrop-blur-xl dark:border-white/10 dark:bg-white/10'>
            <TabsTrigger
              value='notice'
              className='gap-1.5 rounded-full text-slate-600 data-[state=active]:bg-white/90 data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_10px_rgba(15,23,42,0.18)] dark:text-slate-300 dark:data-[state=active]:bg-white/18 dark:data-[state=active]:text-white'
            >
              <Bell className='h-3.5 w-3.5' />
              {t('Notice')}
            </TabsTrigger>
            <TabsTrigger
              value='announcements'
              className='gap-1.5 rounded-full text-slate-600 data-[state=active]:bg-white/90 data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_10px_rgba(15,23,42,0.18)] dark:text-slate-300 dark:data-[state=active]:bg-white/18 dark:data-[state=active]:text-white'
            >
              <Megaphone className='h-3.5 w-3.5' />
              {t('Timeline')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='notice' className='mt-4'>
            <NoticeContent notice={notice} loading={loading} t={t} />
          </TabsContent>

          <TabsContent value='announcements' className='mt-4'>
            <AnnouncementsContent
              announcements={announcements}
              loading={loading}
              t={t}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className='-mx-3.5 -mb-3.5 flex-col-reverse gap-1.5 border-t border-white/30 bg-white/25 p-3.5 backdrop-blur-xl sm:-mx-5 sm:-mb-5 sm:flex-col-reverse sm:gap-2 sm:p-5 dark:border-white/10 dark:bg-white/5'>
          <Button
            variant='ghost'
            className='h-10 w-full rounded-full bg-white/78 text-slate-600 shadow-sm hover:bg-white/90 hover:text-slate-900 dark:bg-white/12 dark:text-slate-200 dark:hover:bg-white/18 dark:hover:text-white'
            onClick={onCloseToday}
          >
            {t('Close Today')}
          </Button>
          <Button
            className='h-10 w-full rounded-full text-slate-950 hover:opacity-90'
            style={{
              backgroundColor: 'var(--announcement-primary, #facc15)',
              boxShadow:
                '0 10px 28px -14px var(--announcement-primary, #facc15)',
            }}
            onClick={() => onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
