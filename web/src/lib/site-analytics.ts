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

const VISITOR_ID_KEY = 'site_analytics:v1:visitor_id'
const SESSION_TRACKED_KEY_PREFIX = 'site_analytics:v1:session_tracked:'
const MIN_DWELL_SECONDS = 3
const MAX_DWELL_SECONDS = 4 * 60 * 60

export type SiteAnalyticsScope = 'home' | 'photo'

export type SiteAnalyticsEvent = 'pageview' | 'dwell'

export interface SiteAnalyticsTrackPayload {
  visitor_id: string
  event: SiteAnalyticsEvent
  dwell_seconds?: number
  is_guest: boolean
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* empty */
  }
}

function readSessionStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSessionStorage(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* empty */
  }
}

function createVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

export function getSiteAnalyticsVisitorId(): string {
  const existing = readStorage(VISITOR_ID_KEY)?.trim()
  if (existing) return existing

  const visitorId = createVisitorId()
  writeStorage(VISITOR_ID_KEY, visitorId)
  return visitorId
}

export function sendSiteAnalyticsEvent(
  payload: SiteAnalyticsTrackPayload
): void {
  const body = JSON.stringify(payload)
  const url = '/api/visit/track'

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    if (navigator.sendBeacon(url, blob)) return
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    credentials: 'include',
    keepalive: true,
  }).catch(() => {
    /* ignore analytics failures */
  })
}

export function resolveSiteAnalyticsScope(
  pathname: string
): SiteAnalyticsScope | null {
  if (pathname === '/') return 'home'
  if (pathname === '/photo' || pathname.startsWith('/photo/')) return 'photo'
  return null
}

export function trackSitePageview(
  scope: SiteAnalyticsScope,
  isGuest: boolean
): void {
  const sessionKey = `${SESSION_TRACKED_KEY_PREFIX}${scope}`
  if (readSessionStorage(sessionKey) === '1') return
  writeSessionStorage(sessionKey, '1')

  sendSiteAnalyticsEvent({
    visitor_id: getSiteAnalyticsVisitorId(),
    event: 'pageview',
    is_guest: isGuest,
  })
}

export function trackSiteDwell(isGuest: boolean, dwellSeconds: number): void {
  const rounded = Math.floor(dwellSeconds)
  if (rounded < MIN_DWELL_SECONDS || rounded > MAX_DWELL_SECONDS) return

  sendSiteAnalyticsEvent({
    visitor_id: getSiteAnalyticsVisitorId(),
    event: 'dwell',
    dwell_seconds: rounded,
    is_guest: isGuest,
  })
}

export interface SiteAnalyticsController {
  flush: () => void
  dispose: () => void
}

type IsGuestResolver = () => boolean

export function startSiteAnalyticsTracking(
  scope: SiteAnalyticsScope,
  isGuestResolver: IsGuestResolver
): SiteAnalyticsController {
  trackSitePageview(scope, isGuestResolver())

  let visibleStartedAt = Date.now()
  let accumulatedMs = 0

  const flush = () => {
    if (document.visibilityState === 'visible') {
      accumulatedMs += Date.now() - visibleStartedAt
      visibleStartedAt = Date.now()
    }
    const dwellSeconds = Math.floor(accumulatedMs / 1000)
    accumulatedMs = 0
    trackSiteDwell(isGuestResolver(), dwellSeconds)
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      accumulatedMs += Date.now() - visibleStartedAt
      return
    }
    visibleStartedAt = Date.now()
  }

  const handlePageHide = () => {
    flush()
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', handlePageHide)

  return {
    flush,
    dispose: () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    },
  }
}
