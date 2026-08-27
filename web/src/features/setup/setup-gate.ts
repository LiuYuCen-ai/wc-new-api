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
