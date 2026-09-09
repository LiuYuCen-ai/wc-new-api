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
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { useMasonryColumnCount } from '../hooks/use-masonry-column-count'
import { packMasonryColumns } from '../lib/works-masonry'

const COLUMN_KEYS = ['col-a', 'col-b', 'col-c', 'col-d', 'col-e'] as const

export function WorksFeedHeader() {
  const { t } = useTranslation()
  return (
    <h2 className='text-[15px] font-semibold tracking-tight'>{t('Works')}</h2>
  )
}

export function WorksMasonry<T>(props: {
  items: T[]
  getItemKey: (item: T) => string
  getItemWeight: (item: T) => number
  renderItem: (item: T) => ReactNode
}) {
  const { containerRef, columnCount } = useMasonryColumnCount()
  const columns = packMasonryColumns(
    props.items,
    columnCount,
    props.getItemWeight
  )

  return (
    <div ref={containerRef} className='flex items-start gap-2 sm:gap-2.5'>
      {columns.map((column, columnIndex) => (
        <div
          key={COLUMN_KEYS[columnIndex] ?? 'col-a'}
          className='flex min-w-0 flex-1 flex-col gap-3'
        >
          {column.map((item) => (
            <div
              key={props.getItemKey(item)}
              className='[content-visibility:auto] [contain-intrinsic-size:0_320px]'
            >
              {props.renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function WorksLoadMoreSentinel(props: {
  enabled: boolean
  loading?: boolean
  onLoadMore: () => void
}) {
  const enabled = props.enabled
  const onLoadMore = props.onLoadMore
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      onLoadMore()
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore()
        }
      },
      { rootMargin: '480px 0px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled, onLoadMore])

  return (
    <div
      ref={sentinelRef}
      className='flex justify-center py-4'
      aria-hidden={!props.loading}
    >
      {props.loading ? (
        <Loader2 className='text-muted-foreground size-5 animate-spin' />
      ) : (
        <div className='h-1 w-full' />
      )}
    </div>
  )
}
