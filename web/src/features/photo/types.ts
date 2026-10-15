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
export type PhotoModel = {
  id: string
  label: string
  description?: string
  endpointTypes?: string[]
}

export type PhotoAspectRatio =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '21:9'

export type PhotoImageSize = string

export type PhotoSizeOption = {
  value: string
  hint: string
}

export type PhotoParams = {
  model: string
  prompt: string
  n: number | ''
  size: string
  resolution: PhotoImageSize
  aspectRatio: PhotoAspectRatio
  imageSize: PhotoImageSize
  customWidth: number
  customHeight: number
  imageUrlEnabled: boolean
  imageDataUrls: { name: string; dataUrl: string }[]
  endpointTypes?: string[]
}

export type PhotoResult = {
  id?: string
  url?: string
  b64?: string
  mimeType?: string
  revisedPrompt?: string
}

export type PhotoGenerationSnapshot = Pick<
  PhotoParams,
  | 'size'
  | 'resolution'
  | 'aspectRatio'
  | 'imageSize'
  | 'customWidth'
  | 'customHeight'
>
