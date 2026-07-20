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
// ============================================================================
// Home Page Types
// ============================================================================

/**
 * Response from home page content API
 */
export interface HomePageContentResponse {
  success: boolean
  message?: string
  data?: string
}

export interface HomePageHeroContentResponse {
  success: boolean
  message?: string
  data?: {
    content?: string
    i18nContent?: string
  }
}

export interface HomePageModelCarouselContentResponse {
  success: boolean
  message?: string
  data?: {
    content?: string
    i18nContent?: string
  }
}

export type LocalizedText = string | Record<string, string>

export interface HomePageHeroSlideContent {
  title?: LocalizedText
  desc?: LocalizedText
  model?: string
}

export interface HomePageHeroContentConfig {
  slides?: HomePageHeroSlideContent[]
}

export interface HomePageModelCarouselSlideContent {
  name?: LocalizedText
  description?: LocalizedText
  models?: string[]
}

export interface HomePageModelCarouselContentConfig {
  slides?: HomePageModelCarouselSlideContent[]
}

/**
 * Home page content result from hook
 */
export interface HomePageContentResult {
  content: string
  isLoaded: boolean
  isUrl: boolean
}
