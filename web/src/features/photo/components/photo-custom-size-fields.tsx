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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { SEEDREAM_CUSTOM_SIZE } from '../constants'

export function PhotoCustomSizeFields(props: {
  width: number
  height: number
  disabled?: boolean
  idPrefix?: string
  onCommit: (patch: { customWidth?: number; customHeight?: number }) => void
}) {
  const { t } = useTranslation()
  const [widthText, setWidthText] = useState(String(props.width))
  const [heightText, setHeightText] = useState(String(props.height))
  const widthId = `${props.idPrefix ?? 'photo-custom'}-width`
  const heightId = `${props.idPrefix ?? 'photo-custom'}-height`

  useEffect(() => {
    setWidthText(String(props.width))
  }, [props.width])

  useEffect(() => {
    setHeightText(String(props.height))
  }, [props.height])

  const commitWidth = () => {
    const parsed = Number(widthText)
    if (!Number.isFinite(parsed)) {
      setWidthText(String(props.width))
      return
    }
    props.onCommit({ customWidth: parsed })
  }

  const commitHeight = () => {
    const parsed = Number(heightText)
    if (!Number.isFinite(parsed)) {
      setHeightText(String(props.height))
      return
    }
    props.onCommit({ customHeight: parsed })
  }

  return (
    <div className='grid grid-cols-2 gap-2 px-1 pt-1'>
      <div className='space-y-1'>
        <Label htmlFor={widthId} className='text-xs'>
          {t('Width')}
        </Label>
        <Input
          id={widthId}
          type='number'
          inputMode='numeric'
          min={SEEDREAM_CUSTOM_SIZE.MIN}
          max={SEEDREAM_CUSTOM_SIZE.MAX}
          step={2}
          disabled={props.disabled}
          value={widthText}
          onChange={(event) => setWidthText(event.target.value)}
          onBlur={commitWidth}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitWidth()
            }
          }}
        />
      </div>
      <div className='space-y-1'>
        <Label htmlFor={heightId} className='text-xs'>
          {t('Height')}
        </Label>
        <Input
          id={heightId}
          type='number'
          inputMode='numeric'
          min={SEEDREAM_CUSTOM_SIZE.MIN}
          max={SEEDREAM_CUSTOM_SIZE.MAX}
          step={2}
          disabled={props.disabled}
          value={heightText}
          onChange={(event) => setHeightText(event.target.value)}
          onBlur={commitHeight}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitHeight()
            }
          }}
        />
      </div>
      <p className='text-muted-foreground col-span-2 text-[11px] leading-snug'>
        {t('{{min}}–{{max}} px', {
          min: SEEDREAM_CUSTOM_SIZE.MIN,
          max: SEEDREAM_CUSTOM_SIZE.MAX,
        })}
      </p>
    </div>
  )
}
