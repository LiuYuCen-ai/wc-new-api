import { api } from '@/lib/api'

import type {
  HomePageContentResponse,
  HomePageHeroContentResponse,
  HomePageModelCarouselContentResponse,
} from './types'

// ============================================================================
// Home Page APIs
// ============================================================================

/**
 * Get custom home page content
 * Returns Markdown/HTML content or iframe URL
 */
export async function getHomePageContent(): Promise<HomePageContentResponse> {
  const res = await api.get('/api/home_page_content')
  return res.data
}

export async function getHomePageHeroContent(): Promise<HomePageHeroContentResponse> {
  const res = await api.get('/api/home_page_hero_content', {
    params: { t: Date.now() },
  })
  return res.data
}

export async function getHomePageModelCarouselContent(): Promise<HomePageModelCarouselContentResponse> {
  const res = await api.get('/api/home_page_model_carousel_content', {
    params: { t: Date.now() },
  })
  return res.data
}
