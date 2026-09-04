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
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

import { PhotoHistoryThumbnail } from './photo-history-thumbnail'
import { WorksCardMeta } from './works-card-meta'
import type { PhotoResult } from '../types'

export function PhotoWorksCard(props: {
  image: PhotoResult
  prompt: string
  model: string
  authorName: string
  authorInitials: string
  coverAspect?: string
  onOpen: (src: string) => void
  onDelete: () => void
  onAspectMeasured?: (ratio: string) => void
}) {
  const { t } = useTranslation()
  const title = props.prompt.trim() || t('Untitled')

  return (
    <article className='group min-w-0'>
      <PhotoHistoryThumbnail
        image={props.image}
        alt={title}
        ariaLabel={t('View image')}
        aspectRatio={props.coverAspect}
        className='rounded-xl ring-0'
        onClick={props.onOpen}
        onAspectMeasured={props.onAspectMeasured}
        overlay={
          <button
            type='button'
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              props.onDelete()
            }}
            className='absolute top-1.5 left-1.5 z-10 flex size-7 items-center justify-center rounded-full bg-black/70 text-white opacity-0 shadow-sm transition-opacity hover:bg-black/85 focus-visible:opacity-100 group-hover:opacity-100'
            aria-label={t('Delete image')}
          >
            <X className='size-3.5' />
          </button>
        }
      />
      <p className='mt-2 line-clamp-2 text-[13px] leading-snug font-semibold'>
        {title}
      </p>
      <WorksCardMeta
        authorName={props.authorName}
        authorInitials={props.authorInitials}
        meta={props.model}
      />
    </article>
  )
}

