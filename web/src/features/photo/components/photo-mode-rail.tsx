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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Film, ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type PhotoWorkspaceMode = 'image' | 'video'

export function PhotoModeRail(props: {
  mode: PhotoWorkspaceMode
  onModeChange: (mode: PhotoWorkspaceMode) => void
}) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('Experience Hub')}
      className='bg-background/80 flex shrink-0 items-center gap-1 border-b px-3 py-2 backdrop-blur md:w-20 md:flex-col md:items-stretch md:gap-2 md:border-r md:border-b-0 md:px-2 md:py-4'
    >
      <ModeRailButton
        active={props.mode === 'image'}
        label={t('Image generation')}
        onClick={() => props.onModeChange('image')}
      >
        <ImageIcon className='size-5' />
      </ModeRailButton>
      <ModeRailButton
        active={props.mode === 'video'}
        label={t('Video generation')}
        onClick={() => props.onModeChange('video')}
      >
        <Film className='size-5' />
      </ModeRailButton>
    </nav>
  )
}

function ModeRailButton(props: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type='button'
      onClick={props.onClick}
      aria-current={props.active ? 'page' : undefined}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors md:flex-none md:py-3',
        props.active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {props.children}
      <span className='w-full truncate text-center leading-tight'>
        {props.label}
      </span>
    </button>
  )
}
