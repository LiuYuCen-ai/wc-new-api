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
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import type { VideoHistoryItem } from '@/features/video/types'

export function VideoNoteViewer(props: {
  items: VideoHistoryItem[]
  activeId: string | null
  onClose: () => void
  onActiveIdChange: (id: string) => void
  onDelete: (id: string) => void | Promise<boolean | void>
  onUsePrompt: (item: VideoHistoryItem) => void
}) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const open = Boolean(props.activeId)
  const index = props.items.findIndex((item) => item.id === props.activeId)
  const item = index >= 0 ? props.items[index] : null
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < props.items.length - 1

  const activeId = props.activeId
  const onClose = props.onClose
  const onActiveIdChange = props.onActiveIdChange

  const goBy = (step: -1 | 1) => {
    const nextIndex = index + step
    const next = props.items[nextIndex]
    if (!next) return
    onActiveIdChange(next.id)
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play().then(() => setPaused(false)).catch(() => setPaused(true))
      return
    }
    video.pause()
    setPaused(true)
  }

  useEffect(() => {
    if (activeId && !item) {
      onClose()
    }
  }, [activeId, item, onClose])

  useEffect(() => {
    const video = videoRef.current
    if (!open || !video || !item?.url) return
    setProgress(0)
    video.currentTime = 0
    const play = video.play()
    if (play) {
      void play.then(() => setPaused(false)).catch(() => setPaused(true))
    }
  }, [item?.url, open, activeId])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        const next = props.items[index - 1]
        if (next) onActiveIdChange(next.id)
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        const next = props.items[index + 1]
        if (next) onActiveIdChange(next.id)
      } else if (event.key === ' ') {
        event.preventDefault()
        const video = videoRef.current
        if (!video) return
        if (video.paused) {
          void video.play().then(() => setPaused(false)).catch(() => setPaused(true))
          return
        }
        video.pause()
        setPaused(true)
      } else if (event.key === 'm' || event.key === 'M') {
        event.preventDefault()
        setMuted((current) => !current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onActiveIdChange, open, props.items])

  const handleCopyPrompt = async () => {
    const prompt = item?.prompt.trim()
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  if (!item) return null

  const durationSeconds = Number(item.duration)
  const durationLabel =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? t('{{value}}s', { value: durationSeconds })
      : null
  const title = item.prompt.trim() || t('Untitled')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) props.onClose()
      }}
    >
      <DialogPortal>
        <DialogOverlay className='bg-black/80 supports-backdrop-filter:backdrop-blur-none' />
        <DialogPrimitive.Popup
          data-slot='dialog-content'
          className='fixed inset-0 z-50 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col bg-black p-0 text-white outline-none md:flex-row'
        >
          <DialogTitle className='sr-only'>{title}</DialogTitle>
          <div
            className='relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-black'
            onTouchStart={(event) => {
              const touch = event.changedTouches[0]
              if (!touch) return
              touchStart.current = { x: touch.clientX, y: touch.clientY }
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current
              const touch = event.changedTouches[0]
              touchStart.current = null
              if (!start || !touch) return
              const dx = touch.clientX - start.x
              const dy = touch.clientY - start.y
              if (Math.abs(dy) > 72 && Math.abs(dy) > Math.abs(dx)) {
                goBy(dy < 0 ? 1 : -1)
                return
              }
              if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy)) {
                goBy(dx < 0 ? 1 : -1)
              }
            }}
          >
            <button
              type='button'
              onClick={props.onClose}
              className='absolute top-3 left-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75'
              aria-label={t('Close')}
            >
              <X className='size-5' />
            </button>
            {hasPrev ? (
              <button
                type='button'
                onClick={() => goBy(-1)}
                className='absolute top-1/2 left-3 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/70 md:flex'
                aria-label={t('Previous video')}
              >
                <ChevronLeft className='size-6' />
              </button>
            ) : null}
            {hasNext ? (
              <button
                type='button'
                onClick={() => goBy(1)}
                className='absolute top-1/2 right-3 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/70 md:flex'
                aria-label={t('Next video')}
              >
                <ChevronRight className='size-6' />
              </button>
            ) : null}
            {item.url ? (
              <video
                ref={videoRef}
                key={item.id}
                src={item.url}
                muted={muted}
                loop
                playsInline
                autoPlay
                className='max-h-full max-w-full cursor-pointer object-contain'
                onClick={togglePlayback}
                onTimeUpdate={(event) => {
                  const video = event.currentTarget
                  if (!video.duration) return
                  setProgress(video.currentTime / video.duration)
                }}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
              />
            ) : null}
            <div className='absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/25 to-transparent px-4 pt-16 pb-4 md:hidden'>
              <p className='line-clamp-6 text-sm leading-relaxed whitespace-pre-wrap'>
                {title}
              </p>
              <p className='mt-1 truncate text-xs text-white/70'>
                {[item.model, durationLabel, item.aspectRatio]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className='mt-3 flex gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  onClick={() => props.onUsePrompt(item)}
                >
                  {t('Use prompt')}
                </Button>
                {item.url ? (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    className='border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white'
                    render={
                      <a
                        href={item.url}
                        download
                        target='_blank'
                        rel='noreferrer'
                      />
                    }
                  >
                    {t('Download')}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className='absolute top-3 right-3 z-20 flex items-center gap-2 md:top-auto md:right-3 md:bottom-4'>
              <button
                type='button'
                onClick={() => setMuted((current) => !current)}
                className='flex size-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75'
                aria-label={muted ? t('Unmute') : t('Mute')}
              >
                {muted ? (
                  <VolumeX className='size-4' />
                ) : (
                  <Volume2 className='size-4' />
                )}
              </button>
              <button
                type='button'
                onClick={togglePlayback}
                className='flex size-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75'
                aria-label={paused ? t('Play video') : t('Pause video')}
              >
                {paused ? (
                  <Play className='size-4 fill-current' />
                ) : (
                  <Pause className='size-4 fill-current' />
                )}
              </button>
            </div>
            <div
              className='absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-pointer'
              onClick={(event) => {
                const video = videoRef.current
                if (!video?.duration) return
                const rect = event.currentTarget.getBoundingClientRect()
                const next = (event.clientX - rect.left) / rect.width
                const clamped = Math.min(1, Math.max(0, next))
                setProgress(clamped)
                video.currentTime = clamped * video.duration
              }}
            >
              <span className='sr-only'>{t('Video duration')}</span>
              <span className='absolute inset-x-0 bottom-0 h-1 bg-white/25'>
                <span
                  className='block h-full bg-white'
                  style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
                />
              </span>
            </div>
          </div>
          <aside className='hidden h-full w-[min(100%,22rem)] shrink-0 flex-col border-l border-white/10 bg-zinc-950 md:flex'>
            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-5'>
              <section className='space-y-2'>
                <h2 className='text-xs font-medium text-white/45'>
                  {t('Prompt')}
                </h2>
                <p className='text-sm leading-relaxed whitespace-pre-wrap'>
                  {item.prompt.trim() || t('Untitled')}
                </p>
              </section>
              <p className='text-sm text-white/65'>
                {[
                  item.model,
                  durationLabel,
                  item.aspectRatio,
                  item.resolution,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {item.createdAt ? (
                <p className='text-xs text-white/45'>
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className='flex flex-col gap-2 border-t border-white/10 p-4'>
              <Button
                type='button'
                variant='secondary'
                onClick={() => props.onUsePrompt(item)}
              >
                {t('Use prompt')}
              </Button>
              <Button
                type='button'
                variant='outline'
                className='border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white'
                onClick={() => {
                  void handleCopyPrompt()
                }}
              >
                {t('Copy prompt')}
              </Button>
              {item.url ? (
                <Button
                  type='button'
                  variant='outline'
                  className='border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white'
                  render={
                    <a
                      href={item.url}
                      download
                      target='_blank'
                      rel='noreferrer'
                    />
                  }
                >
                  <Download className='size-4' />
                  {t('Download')}
                </Button>
              ) : null}
              <Button
                type='button'
                variant='destructive'
                onClick={() => {
                  const next =
                    props.items[index + 1] ?? props.items[index - 1] ?? null
                  void Promise.resolve(props.onDelete(item.id)).then((ok) => {
                    if (ok === false) return
                    if (next) {
                      props.onActiveIdChange(next.id)
                      return
                    }
                    props.onClose()
                  })
                }}
              >
                <Trash2 className='size-4' />
                {t('Delete history')}
              </Button>
            </div>
          </aside>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
