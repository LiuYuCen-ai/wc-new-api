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
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { getNotice } from '@/lib/api'
import { useNotificationStore } from '@/stores/notification-store'

function hashString(input: string): string {
  let hash = 0
  if (!input) return '0'

  for (let i = 0; i < input.length; i += 1) {
    const chr = input.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }

  return hash.toString(36)
}

/**
 * Generate a unique key for an announcement
 * Prefer backend id, fall back to a content hash so edits register
 */
function getAnnouncementKey(item: Record<string, unknown>): string {
  if (!item) return ''

  if (item.id !== undefined && item.id !== null) {
    return `id:${item.id}`
  }

  const fingerprint = JSON.stringify({
    publishDate: (item?.publishDate as string) || '',
    content: getUnknownContentKey(item?.content),
    extra: ((item?.extra as string) || '').trim(),
    type: (item?.type as string) || '',
    title: ((item?.title as string) || '').trim(),
    link: ((item?.link as string) || '').trim(),
  })
  return `hash:${hashString(fingerprint)}`
}

type PromoNoticeTemplate = {
  template: 'promo'
  title?: string
  highlight?: string
  description?: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  highlightSize?: 'small' | 'medium' | 'large' | 'xl'
}

type NoticeRenderContent = string | PromoNoticeTemplate

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPromoNoticeTemplate(value: unknown): value is PromoNoticeTemplate {
  return isRecord(value) && value.template === 'promo'
}

function getNoticeLanguageCandidates(language: string): string[] {
  const normalized = language.trim().replaceAll('_', '-').toLowerCase()

  if (normalized === 'zhcn' || normalized === 'zh-cn' || normalized === 'zh-hans') {
    return ['zhCN', 'zh-CN', 'zh-Hans', 'zh']
  }

  if (
    normalized === 'zhtw' ||
    normalized === 'zh-tw' ||
    normalized === 'zh-hk' ||
    normalized === 'zh-mo' ||
    normalized === 'zh-hant'
  ) {
    return ['zhTW', 'zh-TW', 'zh-Hant']
  }

  const shortLanguage = normalized.split('-')[0]
  return [...new Set([language, normalized, shortLanguage])]
}

function pickLocalizedNoticeContent(
  content: string,
  i18nContent: string,
  language: string
): string {
  if (!i18nContent) return content

  try {
    const parsed = JSON.parse(i18nContent) as unknown
    if (!isRecord(parsed)) return content

    for (const candidate of getNoticeLanguageCandidates(language)) {
      const localized = parsed[candidate]
      if (typeof localized === 'string') {
        if (localized.trim()) return localized.trim()
        continue
      }
      if (localized) return JSON.stringify(localized)
    }

    return content
  } catch {
    return content
  }
}

function normalizeNoticeContent(content: string): NoticeRenderContent {
  if (!content) return ''

  try {
    const parsed = JSON.parse(content) as unknown
    const notice = Array.isArray(parsed) ? parsed[0] : parsed

    if (isPromoNoticeTemplate(notice)) return notice

    if (isRecord(notice) && 'content' in notice) {
      const noticeContent = notice.content
      return isPromoNoticeTemplate(noticeContent)
        ? noticeContent
        : String(noticeContent || '').trim()
    }
  } catch {
    return content
  }

  return content
}

function getNoticeContentKey(content: NoticeRenderContent): string {
  return typeof content === 'string' ? content : JSON.stringify(content)
}

function getUnknownContentKey(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (!content) return ''
  return JSON.stringify(content)
}

function normalizeAnnouncementItem(item: Record<string, unknown>): Record<string, unknown> {
  const content = item.content

  if (typeof content !== 'string') return item

  return {
    ...item,
    content: normalizeNoticeContent(content),
  }
}

/**
 * Hook to manage notifications (Notice + Announcements)
 * Provides unread counts and read status management
 */
export function useNotifications({
  autoOpenDialog = false,
}: { autoOpenDialog?: boolean } = {}) {
  const { i18n } = useTranslation()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpenState] = useState(false)
  const [autoDialogOpened, setAutoDialogOpened] = useState(false)
  const [activeTab, setActiveTab] = useState<'notice' | 'announcements'>(
    'notice'
  )

  // Fetch Notice from API
  const {
    data: noticeResponse,
    isLoading: noticeLoading,
    refetch: refetchNotice,
  } = useQuery({
    queryKey: ['notice'],
    queryFn: getNotice,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  // Fetch Announcements from status
  const { status, loading: statusLoading } = useStatus()
  const announcementsEnabled = status?.announcements_enabled ?? false
  const statusAnnouncements = status?.announcements
  const announcements: Record<string, unknown>[] = useMemo(
    () =>
      announcementsEnabled
        ? ((statusAnnouncements || []) as Record<string, unknown>[])
            .slice(0, 20)
            .map(normalizeAnnouncementItem)
        : [],
    [announcementsEnabled, statusAnnouncements]
  )

  // Notification store
  const {
    lastReadNotice,
    markNoticeRead,
    markAnnouncementsRead,
    isAnnouncementRead,
    setClosedUntilDate,
    isNoticeClosed,
  } = useNotificationStore()

  // Extract notice content
  const rawNoticeContent = noticeResponse?.success
    ? String(noticeResponse.data || '').trim()
    : ''
  const noticeI18nContent = noticeResponse?.success
    ? String(noticeResponse.i18nContent || '').trim()
    : ''
  const noticeContent = normalizeNoticeContent(
    pickLocalizedNoticeContent(rawNoticeContent, noticeI18nContent, i18n.language)
  )
  const loading = noticeLoading || statusLoading

  // Calculate unread counts
  const unreadCounts = useMemo(() => {
    const noticeUnread =
      noticeContent && getNoticeContentKey(noticeContent) !== lastReadNotice ? 1 : 0

    const announcementsUnread = announcements.filter(
      (item: Record<string, unknown>) => {
        const key = getAnnouncementKey(item)
        return !isAnnouncementRead(key)
      }
    ).length

    return {
      notice: noticeUnread,
      announcements: announcementsUnread,
      total: noticeUnread + announcementsUnread,
    }
  }, [noticeContent, lastReadNotice, announcements, isAnnouncementRead])

  const markAnnouncementsAsRead = useCallback(() => {
    if (announcements.length > 0) {
      const allKeys = announcements.map((item: Record<string, unknown>) =>
        getAnnouncementKey(item)
      )
      markAnnouncementsRead(allKeys)
    }
  }, [announcements, markAnnouncementsRead])

  const markVisibleContentAsRead = useCallback(
    (tab: 'notice' | 'announcements') => {
      if (noticeContent) {
        markNoticeRead(getNoticeContentKey(noticeContent))
      }
      if (tab === 'announcements') {
        markAnnouncementsAsRead()
      }
    },
    [markAnnouncementsAsRead, markNoticeRead, noticeContent]
  )

  // Handle popover open
  const handleOpenPopover = (tab?: 'notice' | 'announcements') => {
    const nextTab = tab || activeTab
    markVisibleContentAsRead(nextTab)
    setActiveTab(nextTab)
    setPopoverOpen(true)
  }

  const handlePopoverOpenChange = (open: boolean) => {
    if (open) {
      handleOpenPopover(activeTab)
      return
    }

    setPopoverOpen(false)
  }

  const handleOpenDialog = (tab?: 'notice' | 'announcements') => {
    const nextTab = tab || activeTab
    markVisibleContentAsRead(nextTab)
    setActiveTab(nextTab)
    setDialogOpenState(true)
  }

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      handleOpenDialog(activeTab)
      return
    }

    setDialogOpenState(false)
  }

  useEffect(() => {
    if (
      !autoOpenDialog ||
      autoDialogOpened ||
      loading ||
      dialogOpen ||
      popoverOpen ||
      isNoticeClosed()
    ) {
      return
    }
    if (!noticeContent && announcements.length === 0) return

    const nextTab = noticeContent ? 'notice' : 'announcements'
    setActiveTab(nextTab)
    setAutoDialogOpened(true)
    setDialogOpenState(true)
  }, [
    announcements.length,
    autoDialogOpened,
    autoOpenDialog,
    dialogOpen,
    isNoticeClosed,
    loading,
    noticeContent,
    popoverOpen,
  ])

  const closeToday = () => {
    setClosedUntilDate(new Date().toDateString())
    setDialogOpenState(false)
  }

  // Handle tab change - mark announcements as read when switching to that tab
  const handleTabChange = (tab: 'notice' | 'announcements') => {
    setActiveTab(tab)

    if (tab === 'announcements') {
      markAnnouncementsAsRead()
    }
  }

  return {
    // Data
    notice: noticeContent,
    announcements,
    loading,

    // Unread counts
    unreadCount: unreadCounts.total,
    unreadNoticeCount: unreadCounts.notice,
    unreadAnnouncementsCount: unreadCounts.announcements,

    // Popover state
    popoverOpen,
    setPopoverOpen: handlePopoverOpenChange,
    activeTab,
    setActiveTab: handleTabChange,

    // Dialog state (public header)
    dialogOpen,
    setDialogOpen: handleDialogOpenChange,

    // Actions
    openPopover: handleOpenPopover,
    closePopover: () => setPopoverOpen(false),
    openDialog: handleOpenDialog,
    closeDialog: () => setDialogOpenState(false),
    closeToday,
    refetchNotice,
  }
}
