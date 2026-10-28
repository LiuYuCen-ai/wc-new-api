import { useLocation } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import {
  resolveSiteAnalyticsScope,
  startSiteAnalyticsTracking,
  type SiteAnalyticsController,
} from '@/lib/site-analytics'
import { useAuthStore } from '@/stores/auth-store'

export function useSiteAnalytics(): void {
  const location = useLocation()
  const controllerRef = useRef<SiteAnalyticsController | null>(null)

  useEffect(() => {
    const scope = resolveSiteAnalyticsScope(location.pathname)

    if (!scope) {
      if (controllerRef.current) {
        controllerRef.current.flush()
        controllerRef.current.dispose()
        controllerRef.current = null
      }
      return undefined
    }

    if (controllerRef.current) {
      controllerRef.current.flush()
      controllerRef.current.dispose()
    }

    controllerRef.current = startSiteAnalyticsTracking(scope, () => {
      return !useAuthStore.getState().auth.user
    })

    return () => {
      if (controllerRef.current) {
        controllerRef.current.flush()
        controllerRef.current.dispose()
        controllerRef.current = null
      }
    }
  }, [location.pathname])

  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.flush()
        controllerRef.current.dispose()
        controllerRef.current = null
      }
    }
  }, [])
}
