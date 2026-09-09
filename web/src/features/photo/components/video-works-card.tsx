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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Play, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { VideoHistoryItem } from '@/features/video/types'

import {
  coverFocusPosition,
  feedCoverAspectCss,
} from '../lib/works-masonry'
import { WorksCardCaption } from './works-card-meta'

export function VideoWorksCard(props: {
  item: VideoHistoryItem
  authorName: string
  authorInitials: string
  coverAspect?: string
  generating?: boolean
  onOpen: (item: VideoHistoryItem) => void
  onDelete?: (id: string) => void
  onAspectMeasured?: (id: string, ratio: string) => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [hovering, setHovering] = useState(false)
  const item = props.item
  const durationSeconds = Number(item.duration)
  let durationLabel: string | null = null
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
    const total = Math.min(Math.round(durationSeconds), 5999)
    const minutes = Math.floor(total / 60)
    const rest = total % 60
    durationLabel = `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  }
  const title = item.prompt.trim() || t('Untitled')
  const canPlay = Boolean(item.url) && !props.generating

  useEffect(() => {
    const node = cardRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true)
        }
      },
      { rootMargin: '240px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !canPlay) return
    if (!hovering) {
      video.pause()
      video.currentTime = 0
      return
    }
    void video.play().catch(() => {
      setHovering(false)
    })
  }, [canPlay, hovering])

  return (
    <article ref={cardRef} className='group min-w-0'>
      <div className='relative'>
        <button
          type='button'
          disabled={!canPlay}
          onClick={() => {
            if (!canPlay) return
            setHovering(false)
            props.onOpen(item)
          }}
          onMouseEnter={() => {
            if (
              canPlay &&
              window.matchMedia('(hover: hover)').matches
            ) {
              setHovering(true)
            }
          }}
          onMouseLeave={() => setHovering(false)}
          className='flex w-full min-w-0 cursor-pointer flex-col text-left'
          aria-label={t('View video')}
        >
          <div
            className='bg-muted relative overflow-hidden rounded-lg'
            style={{
              aspectRatio: feedCoverAspectCss(
                props.coverAspect ?? item.aspectRatio
              ),
            }}
          >
            {canPlay && inView ? (
              <video
                ref={videoRef}
                src={item.url}
                muted
                loop
                playsInline
                preload='metadata'
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget
                  if (!video.videoWidth || !video.videoHeight) return
                  props.onAspectMeasured?.(
                    item.id,
                    `${video.videoWidth} / ${video.videoHeight}`
                  )
                }}
                className='h-full w-full object-cover'
                style={{ objectPosition: coverFocusPosition(item.id) }}
              />
            ) : (
              <div className='flex h-full w-full items-center justify-center'>
                {props.generating ? (
                  <Loader2 className='text-muted-foreground size-7 animate-spin' />
                ) : (
                  <Play className='text-muted-foreground size-7 fill-current' />
                )}
              </div>
            )}
            {canPlay && !hovering ? (
              <span
                aria-hidden='true'
                className='pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/55 to-transparent'
              />
            ) : null}
            <span className='pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10' />
            {item.model && !hovering ? (
              <span className='pointer-events-none absolute top-1.5 right-1.5 max-w-[72%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white'>
                {item.model}
              </span>
            ) : null}
            {canPlay && !hovering ? (
              <span
                aria-hidden='true'
                className='pointer-events-none absolute bottom-1.5 left-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]'
              >
                <Play className='size-3 fill-current' />
              </span>
            ) : null}
            {durationLabel && !hovering ? (
              <span className='pointer-events-none absolute right-2 bottom-1.5 text-[11px] font-medium text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]'>
                {durationLabel}
              </span>
            ) : null}
            {props.generating ? (
              <span className='pointer-events-none absolute inset-x-2 bottom-2 truncate text-center text-[11px] text-white/90'>
                {t('Generating...')}
              </span>
            ) : null}
          </div>
          <WorksCardCaption
            title={title}
            authorName={props.authorName}
            authorInitials={props.authorInitials}
          />
        </button>
        {props.onDelete && !props.generating ? (
          <button
            type='button'
            onClick={(event) => {
              event.stopPropagation()
              props.onDelete?.(item.id)
            }}
            className={cn(
              'absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-opacity hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100'
            )}
            aria-label={t('Delete history')}
          >
            <Trash2 className='size-3.5' />
          </button>
        ) : null}
      </div>
    </article>
  )
}
