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
