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
import { WorksCardCaption } from './works-card-meta'
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
        className='rounded-lg ring-0'
        onClick={props.onOpen}
        onAspectMeasured={props.onAspectMeasured}
        overlay={
          <>
            {props.model ? (
              <span className='pointer-events-none absolute top-1.5 right-1.5 max-w-[72%] truncate rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white'>
                {props.model}
              </span>
            ) : null}
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
          </>
        }
      />
      <WorksCardCaption
        title={title}
        authorName={props.authorName}
        authorInitials={props.authorInitials}
      />
    </article>
  )
}

