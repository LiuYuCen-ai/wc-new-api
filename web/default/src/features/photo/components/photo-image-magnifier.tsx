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
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

type ImageBounds = {
  left: number
  top: number
  width: number
  height: number
  naturalWidth: number
  naturalHeight: number
}

type PhotoImageMagnifierProps = {
  src: string
  alt: string
  className?: string
  zoomScale?: number
  lensSize?: number
  zoomPanelSize?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getRenderedImageBounds(
  container: HTMLElement,
  image: HTMLImageElement
): ImageBounds | null {
  const naturalWidth = image.naturalWidth
  const naturalHeight = image.naturalHeight
  if (!naturalWidth || !naturalHeight) return null

  const containerRect = container.getBoundingClientRect()
  const imageRect = image.getBoundingClientRect()
  const elementWidth = imageRect.width
  const elementHeight = imageRect.height
  if (elementWidth < 48 || elementHeight < 48) return null

  const scale = Math.min(
    elementWidth / naturalWidth,
    elementHeight / naturalHeight
  )
  const width = naturalWidth * scale
  const height = naturalHeight * scale
  const offsetX = (elementWidth - width) / 2
  const offsetY = (elementHeight - height) / 2

  return {
    left: imageRect.left - containerRect.left + offsetX,
    top: imageRect.top - containerRect.top + offsetY,
    width,
    height,
    naturalWidth,
    naturalHeight,
  }
}

export function PhotoImageMagnifier({
  src,
  alt,
  className,
  zoomScale = 2.5,
  lensSize = 132,
  zoomPanelSize = 280,
}: PhotoImageMagnifierProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [bounds, setBounds] = useState<ImageBounds | null>(null)
  const [active, setActive] = useState(false)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [canMagnify, setCanMagnify] = useState(false)

  const updateBounds = useCallback(() => {
    const container = containerRef.current
    const image = imageRef.current
    if (!container || !image) return
    setBounds(getRenderedImageBounds(container, image))
  }, [])

  useEffect(() => {
    setActive(false)
    setBounds(null)
  }, [src])

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanMagnify(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    updateBounds()
    window.addEventListener('resize', updateBounds)

    const image = imageRef.current
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateBounds())
        : null
    if (resizeObserver && image) {
      resizeObserver.observe(image)
    }

    return () => {
      window.removeEventListener('resize', updateBounds)
      resizeObserver?.disconnect()
    }
  }, [updateBounds, src])

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canMagnify || !bounds) return

    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    const pointerX = event.clientX - containerRect.left
    const pointerY = event.clientY - containerRect.top

    const insideImage =
      pointerX >= bounds.left &&
      pointerX <= bounds.left + bounds.width &&
      pointerY >= bounds.top &&
      pointerY <= bounds.top + bounds.height

    if (!insideImage) {
      setActive(false)
      return
    }

    setActive(true)
    setPosition({
      x: ((pointerX - bounds.left) / bounds.width) * 100,
      y: ((pointerY - bounds.top) / bounds.height) * 100,
    })
  }

  const lensAspect = bounds
    ? bounds.width / Math.max(bounds.height, 1)
    : 1
  const lensWidth =
    lensAspect >= 1
      ? Math.min(lensSize, bounds?.width ?? lensSize)
      : Math.min(lensSize * lensAspect, bounds?.width ?? lensSize)
  const lensHeight =
    lensAspect >= 1
      ? Math.min(lensSize / lensAspect, bounds?.height ?? lensSize)
      : Math.min(lensSize, bounds?.height ?? lensSize)

  const lensLeft = bounds
    ? clamp(
        bounds.left + (position.x / 100) * bounds.width - lensWidth / 2,
        bounds.left,
        bounds.left + bounds.width - lensWidth
      )
    : 0
  const lensTop = bounds
    ? clamp(
        bounds.top + (position.y / 100) * bounds.height - lensHeight / 2,
        bounds.top,
        bounds.top + bounds.height - lensHeight
      )
    : 0

  const displayScale = bounds
    ? bounds.width / bounds.naturalWidth
    : 1
  const zoomImageWidth = bounds
    ? bounds.naturalWidth * displayScale * zoomScale
    : 0
  const zoomImageHeight = bounds
    ? bounds.naturalHeight * displayScale * zoomScale
    : 0
  const zoomImageLeft = bounds
    ? zoomPanelSize / 2 - (position.x / 100) * zoomImageWidth
    : 0
  const zoomImageTop = bounds
    ? zoomPanelSize / 2 - (position.y / 100) * zoomImageHeight
    : 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex max-h-[42vh] w-full items-center justify-center',
        canMagnify && 'cursor-crosshair',
        className
      )}
      onPointerEnter={updateBounds}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setActive(false)}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={updateBounds}
        className='max-h-[42vh] w-full object-contain select-none'
      />

      {canMagnify && active && bounds ? (
        <>
          <div
            aria-hidden
            className='pointer-events-none absolute z-10 border border-white/90 bg-white/20 shadow-[0_0_0_1px_rgba(0,0,0,0.12)] backdrop-blur-[1px]'
            style={{
              left: lensLeft,
              top: lensTop,
              width: lensWidth,
              height: lensHeight,
            }}
          />

          <div
            aria-hidden
            className='bg-background pointer-events-none absolute top-3 right-3 z-20 hidden overflow-hidden rounded-lg border shadow-xl sm:block'
            style={{
              width: zoomPanelSize,
              height: zoomPanelSize,
            }}
          >
            <img
              src={src}
              alt=''
              draggable={false}
              className='absolute max-w-none select-none'
              style={{
                width: zoomImageWidth,
                height: zoomImageHeight,
                left: zoomImageLeft,
                top: zoomImageTop,
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
