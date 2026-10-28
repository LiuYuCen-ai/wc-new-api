import type { SetupResponse } from './types'

const LEGACY_SETUP_CHECKED_KEY = 'setup_status_checked'

let setupCompletedThisSession = false

function removeLegacySetupCheckedCache(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LEGACY_SETUP_CHECKED_KEY)
    }
  } catch {
    /* empty */
  }
}

removeLegacySetupCheckedCache()

export function isSetupPath(pathname: string): boolean {
  return pathname === '/setup' || pathname.startsWith('/setup/')
}

export function shouldEnterSetup(
  status: SetupResponse | null | undefined
): boolean {
  if (!status?.success || !status.data) {
    return true
  }
  return status.data.status !== true
}

export function rememberSetupCompleted(): void {
  setupCompletedThisSession = true
}

export function hasConfirmedSetupThisSession(): boolean {
  return setupCompletedThisSession
}

export function clearSetupSessionCache(): void {
  setupCompletedThisSession = false
  removeLegacySetupCheckedCache()
}
