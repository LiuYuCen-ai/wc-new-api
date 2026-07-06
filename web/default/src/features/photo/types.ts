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
  // OpenAI images API
  sizes?: string[]
  // Gemini image_config
  aspectRatios?: string[]
  imageSizes?: string[]
  // Whether the model supports n (count)
  supportsN?: boolean
  // Whether the model supports resolution (size)
  supportsSize?: boolean
  // Whether the model supports the "quality" option (OpenAI image models)
  supportsQuality?: boolean
  // Restrict the list of allowed qualities; defaults to low/medium/high
  qualities?: PhotoQuality[]
}

export type PhotoAspectRatio =
  | '1:1'
  | '16:9'
  | '9:16'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '4:5'
  | '5:4'
  | '21:9'
  | '4:1'
  | '1:4'
  | '8:1'
  | '1:8'

// Official GPT-Image-2 resolutions (per the public docs)
export type PhotoResolution =
  | '1024x1024'
  | '1024x1536'
  | '1536x1024'
  | '2048x2048'
  | '2048x1152'
  | '3840x2160'
  | '2160x3840'
  | 'auto'

// OpenAI image quality levels
export type PhotoQuality = 'low' | 'medium' | 'high' | 'auto'

export type PhotoImageSize = '0.5K' | '1K' | '2K' | '4K'

export type PhotoParams = {
  model: string
  prompt: string
  n: number | ''
  size: PhotoResolution
  resolution: '1K' | '2K' | '4K'
  quality: PhotoQuality
  aspectRatio: PhotoAspectRatio
  imageSize: PhotoImageSize
  imageUrlEnabled: boolean
  imageDataUrls: { name: string; dataUrl: string }[]
}

export type PhotoResult = {
  url?: string
  b64?: string
  mimeType?: string
  revisedPrompt?: string
}

export type PhotoGenerationSnapshot = Pick<
  PhotoParams,
  'size' | 'resolution' | 'quality' | 'aspectRatio' | 'imageSize'
>
