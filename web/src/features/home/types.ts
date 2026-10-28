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
