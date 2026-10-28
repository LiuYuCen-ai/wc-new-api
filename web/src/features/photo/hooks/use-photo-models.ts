import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'

import { getPricing } from '@/features/pricing/api'
import type { PricingModel } from '@/features/pricing/types'
import { getUserModels } from '@/lib/api'

import {
  getPhotoSizeOptionsForModel,
  getVideoResolutionOptionsForModel,
  pickPhotoModels,
  pickVideoModels,
} from '../lib/photo-models'

const CUSTOM_MODEL_STORAGE_KEYS = {
  image: 'photoCustomModels:v1',
  video: 'videoCustomModels:v1',
} as const

function loadCustomModels(kind: 'image' | 'video'): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_MODEL_STORAGE_KEYS[kind])
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== ''
    )
  } catch {
    return []
  }
}

function saveCustomModels(kind: 'image' | 'video', models: string[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      CUSTOM_MODEL_STORAGE_KEYS[kind],
      JSON.stringify(models)
    )
  } catch {
    // private mode / quota
  }
}

export function usePhotoModels(kind: 'image' | 'video' = 'image') {
  const [customIds, setCustomIds] = useState(() => loadCustomModels(kind))

  const userQuery = useQuery({
    queryKey: ['user-models'],
    queryFn: async () => {
      const res = await getUserModels()
      return res.data ?? []
    },
  })

  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    staleTime: 5 * 60 * 1000,
  })

  const pricingByName = useMemo(() => {
    const map = new Map<string, PricingModel>()
    for (const model of pricingQuery.data?.data ?? []) {
      map.set(model.model_name, model)
    }
    return map
  }, [pricingQuery.data])

  const models = useMemo(() => {
    const userModels = userQuery.data ?? []
    if (kind === 'video') {
      return pickVideoModels(userModels, pricingByName, customIds)
    }
    return pickPhotoModels(userModels, pricingByName, customIds)
  }, [customIds, kind, pricingByName, userQuery.data])

  const addCustomModel = useCallback(
    (modelId: string) => {
      const id = modelId.trim()
      if (!id) return ''
      setCustomIds((prev) => {
        if (prev.includes(id)) return prev
        const next = [...prev, id]
        saveCustomModels(kind, next)
        return next
      })
      return id
    },
    [kind]
  )

  const getSizeOptions = useCallback(
    (modelId: string) => {
      const pricing = pricingByName.get(modelId)
      if (kind === 'video') {
        return getVideoResolutionOptionsForModel(modelId, pricing)
      }
      return getPhotoSizeOptionsForModel(modelId, pricing)
    },
    [kind, pricingByName]
  )

  return {
    models,
    isLoading: userQuery.isLoading,
    addCustomModel,
    getSizeOptions,
  }
}
