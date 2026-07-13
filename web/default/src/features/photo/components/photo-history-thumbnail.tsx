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
import { useEffect, useState, type ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import {
  hydratePhotoResult,
  isPhotoHistoryImageUrl,
} from '../lib/photo-history-image'
import { getPhotoResultSrc } from '../lib/photo-utils'
import type { PhotoResult } from '../types'

interface PhotoHistoryThumbnailProps {
  image: PhotoResult
  alt: string
  ariaLabel: string
  className?: string
  onClick: (src: string) => void
  overlay?: ReactNode
}

export function PhotoHistoryThumbnail(props: PhotoHistoryThumbnailProps) {
  const [src, setSrc] = useState(() => getPhotoResultSrc(props.image))
  const [loading, setLoading] = useState(
    () => !src && Boolean(props.image.b64 || isPhotoHistoryImageUrl(props.image.url))
  )

  useEffect(() => {
    const immediate = getPhotoResultSrc(props.image)
    if (immediate) {
      setSrc(immediate)
      setLoading(false)
      return undefined
    }

    if (!props.image.b64 && !isPhotoHistoryImageUrl(props.image.url)) {
      setSrc('')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    hydratePhotoResult(props.image)
      .then((hydrated) => {
        if (cancelled) return
        setSrc(getPhotoResultSrc(hydrated))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    props.image.id,
    props.image.b64,
    props.image.url,
    props.image.mimeType,
  ])

  if (loading || !src) {
    return (
      <div
        className={cn(
          'bg-muted aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10',
          props.className
        )}
      >
        <Skeleton className='h-full w-full rounded-none' />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-muted group relative aspect-square overflow-hidden rounded-lg ring-1 ring-foreground/10',
        props.className
      )}
    >
      <button
        type='button'
        onMouseDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          props.onClick(src)
        }}
        className='absolute inset-0 cursor-zoom-in'
        aria-label={props.ariaLabel}
      >
        <img
          src={src}
          alt={props.alt}
          loading='lazy'
          decoding='async'
          className='h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]'
        />
      </button>
      {props.overlay}
    </div>
  )
}
