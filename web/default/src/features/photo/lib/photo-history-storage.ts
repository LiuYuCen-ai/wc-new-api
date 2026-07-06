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
import { getUserId } from '@/features/auth/lib/storage'
import { api } from '@/lib/api'
import type { PhotoGenerationSnapshot } from '../types'
import type { PhotoResult } from '../types'
import {
  appendPhotoHistoryImages as appendPhotoHistoryImagesApi,
  createPhotoHistoryItem,
  fetchPhotoHistory,
  type PhotoHistoryItem,
} from './photo-history-api'

export type { PhotoHistoryItem }

const LEGACY_PHOTO_HISTORY_KEY = 'photo_history'
const PHOTO_HISTORY_MIGRATION_KEY = 'photo_history_migrated_v2'
const PHOTO_HISTORY_LIMIT = 50

type LegacyHistoryItem = {
  id: string
  prompt: string
  model: string
  created_at: string
  images: PhotoResult[]
  generationParams?: PhotoGenerationSnapshot
}

function getPhotoHistoryStorageKey(userId: number) {
  return `${LEGACY_PHOTO_HISTORY_KEY}_${userId}`
}

function parseLegacyHistory(raw: string | null): LegacyHistoryItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as LegacyHistoryItem[]) : []
  } catch {
    return []
  }
}

function loadLegacyPhotoHistory(userId: number): LegacyHistoryItem[] {
  const storageKey = getPhotoHistoryStorageKey(userId)
  const own = parseLegacyHistory(localStorage.getItem(storageKey))
  const legacy = parseLegacyHistory(localStorage.getItem(LEGACY_PHOTO_HISTORY_KEY))
  const guest = parseLegacyHistory(
    localStorage.getItem(`${LEGACY_PHOTO_HISTORY_KEY}_guest`)
  )

  const seen = new Set<string>()
  const merged: LegacyHistoryItem[] = []
  for (const list of [own, legacy, guest]) {
    for (const item of list) {
      if (!item?.id || seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged.slice(0, PHOTO_HISTORY_LIMIT)
}

function clearLegacyPhotoHistory(userId: number) {
  localStorage.removeItem(getPhotoHistoryStorageKey(userId))
  localStorage.removeItem(LEGACY_PHOTO_HISTORY_KEY)
  localStorage.removeItem(`${LEGACY_PHOTO_HISTORY_KEY}_guest`)
}

function resolvePhotoHistoryUserId(userId?: number | null): number | null {
  if (userId != null && Number.isFinite(userId)) return userId
  const savedUserId = getUserId()
  if (!savedUserId) return null
  const parsed = Number(savedUserId)
  return Number.isFinite(parsed) ? parsed : null
}

async function migrateLegacyPhotoHistory(userId: number) {
  const migrationKey = `${PHOTO_HISTORY_MIGRATION_KEY}_${userId}`
  if (localStorage.getItem(migrationKey) === '1') return

  const legacyItems = loadLegacyPhotoHistory(userId)
  if (legacyItems.length === 0) {
    localStorage.setItem(migrationKey, '1')
    return
  }

  try {
    const existing = await fetchPhotoHistory(PHOTO_HISTORY_LIMIT)
    const existingIds = new Set(existing.map((item) => item.id))

    for (const item of [...legacyItems].reverse()) {
      if (existingIds.has(item.id) || item.images.length === 0) continue
      const created = await createPhotoHistoryItem({
        id: item.id,
        prompt: item.prompt,
        model: item.model,
        images: item.images,
        generationParams: item.generationParams,
      })
      if (created) {
        existingIds.add(created.id)
      }
    }

    clearLegacyPhotoHistory(userId)
    localStorage.setItem(migrationKey, '1')
  } catch {
    // Best-effort migration; keep legacy data for a later attempt.
  }
}

async function ensureActiveSession(): Promise<boolean> {
  try {
    const res = await api.get<{ success: boolean }>('/api/user/self', {
      skipErrorHandler: true,
    })
    return Boolean(res.data?.success)
  } catch {
    return false
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitForActiveSession(
  maxAttempts = 6,
  delayMs = 250
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (await ensureActiveSession()) return true
    if (attempt < maxAttempts - 1) {
      await sleep(delayMs)
    }
  }
  return false
}

export async function hasActivePhotoSession(): Promise<boolean> {
  return ensureActiveSession()
}

export async function loadPhotoHistoryForUser(
  userId?: number | null
): Promise<PhotoHistoryItem[]> {
  const resolvedUserId = resolvePhotoHistoryUserId(userId)
  if (resolvedUserId == null) return []

  const hasSession = await ensureActiveSession()
  if (!hasSession) return []

  await migrateLegacyPhotoHistory(resolvedUserId)
  return fetchPhotoHistory(PHOTO_HISTORY_LIMIT)
}

export async function savePhotoHistoryItem(
  input: Omit<LegacyHistoryItem, 'created_at'> & { created_at?: string }
): Promise<PhotoHistoryItem[] | null> {
  const created = await createPhotoHistoryItem({
    id: input.id,
    prompt: input.prompt,
    model: input.model,
    images: input.images,
    generationParams: input.generationParams,
  })
  if (!created) return null

  const history = await fetchPhotoHistory(PHOTO_HISTORY_LIMIT)
  if (history.some((item) => item.id === created.id)) {
    return history
  }
  return [created, ...history].slice(0, PHOTO_HISTORY_LIMIT)
}

export async function savePhotoHistoryImages(
  historyItemId: string,
  images: PhotoResult[],
  prompt?: string
): Promise<PhotoHistoryItem[] | null> {
  const updated = await appendPhotoHistoryImagesApi(historyItemId, images, prompt)
  if (!updated) return null
  return fetchPhotoHistory(PHOTO_HISTORY_LIMIT)
}
