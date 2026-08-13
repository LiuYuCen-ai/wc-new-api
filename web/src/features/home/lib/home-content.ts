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
import type { LocalizedText } from '../types'

export function isChineseLanguage(language: string): boolean {
  return language.toLowerCase().startsWith('zh')
}

export function resolveHomePageLocalizedContent(
  language: string,
  content?: string,
  i18nContent?: string
): string | undefined {
  const selected = isChineseLanguage(language) ? content : i18nContent
  return selected?.trim() ? selected : undefined
}

export function getLocalizedText(
  value: LocalizedText | undefined,
  language: string,
  fallback: string
): string {
  if (!value) return fallback
  if (typeof value === 'string') return value || fallback

  const normalizedLanguage = language.trim().replaceAll('_', '-').toLowerCase()
  const primaryLanguage = normalizedLanguage.split('-')[0]
  const compactLanguage = normalizedLanguage.replaceAll('-', '')
  const languageCandidates = [
    language,
    normalizedLanguage,
    primaryLanguage,
    compactLanguage,
    normalizedLanguage === 'zh-cn' ? 'zhCN' : undefined,
    normalizedLanguage === 'zh-tw' ? 'zhTW' : undefined,
  ].filter(Boolean) as string[]

  for (const candidate of languageCandidates) {
    const matched = value[candidate]
    if (matched) return matched
  }

  return value.en || value.zhCN || value.zh || fallback
}

export function parseSlidesConfig<T extends { slides?: unknown }>(
  content: string | undefined
): T | null {
  if (!content?.trim()) return null
  try {
    const parsed = JSON.parse(content) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const config = parsed as T
    return Array.isArray(config.slides) ? config : null
  } catch {
    return null
  }
}
